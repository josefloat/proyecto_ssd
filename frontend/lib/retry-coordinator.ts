export const MAX_REQUESTS = 7;
export const REQUEST_TIMEOUT_MS = 10_000;
export const RETRY_DELAYS_MS = [1_000, 2_000, 3_000, 4_000, 4_000, 4_000] as const;
export const NOMINAL_BUDGET_MS =
  MAX_REQUESTS * REQUEST_TIMEOUT_MS +
  RETRY_DELAYS_MS.reduce((total, delay) => total + delay, 0);

export type NetworkPhase = "loading" | "preparing";

export class PublicRequestError extends Error {
  constructor(
    readonly kind: "invalid" | "offline" | "error" | "exhausted",
    readonly status?: number,
  ) {
    super(kind);
    this.name = new.target.name;
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type RetryOptions<T> = Readonly<{
  signal: AbortSignal;
  onPhase: (phase: NetworkPhase) => void;
  parse?: (response: Response) => Promise<T>;
  fetcher?: FetchLike;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
  isOnline?: () => boolean;
  timeoutSignal?: (milliseconds: number) => AbortSignal;
}>;

function esperaCancelable(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function esAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function esTransitorio(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError"))
  );
}

export async function fetchPublicResource<T>(
  url: string,
  options: RetryOptions<T>,
): Promise<T> {
  const fetcher = options.fetcher ?? fetch;
  const parse = options.parse ?? ((response: Response) => response.json() as Promise<T>);
  const sleep = options.sleep ?? esperaCancelable;
  const now = options.now ?? (() => performance.now());
  const isOnline =
    options.isOnline ??
    (() => typeof navigator === "undefined" || navigator.onLine !== false);
  const timeoutSignal =
    options.timeoutSignal ?? ((milliseconds) => AbortSignal.timeout(milliseconds));
  const deadline = now() + NOMINAL_BUDGET_MS;

  options.onPhase("loading");
  for (let attempt = 0; attempt < MAX_REQUESTS; attempt += 1) {
    if (options.signal.aborted) {
      throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
    }
    if (!isOnline()) {
      throw new PublicRequestError("offline");
    }

    const remaining = Math.max(1, deadline - now());
    const requestSignal = AbortSignal.any([
      options.signal,
      timeoutSignal(Math.min(REQUEST_TIMEOUT_MS, remaining)),
    ]);

    try {
      const response = await fetcher(url, {
        method: "GET",
        cache: "no-store",
        signal: requestSignal,
        headers: { accept: "application/json" },
      });
      if (response.ok) return parse(response);
      if ([400, 404, 422].includes(response.status)) {
        throw new PublicRequestError("invalid", response.status);
      }
      if (![502, 503, 504].includes(response.status)) {
        throw new PublicRequestError("error", response.status);
      }
    } catch (error) {
      if (error instanceof PublicRequestError) throw error;
      if (options.signal.aborted || (esAbort(error) && !requestSignal.aborted)) {
        throw options.signal.reason ?? error;
      }
      if (!isOnline()) throw new PublicRequestError("offline");
      if (!esTransitorio(error)) throw new PublicRequestError("error");
    }

    options.onPhase("preparing");
    if (attempt === MAX_REQUESTS - 1 || now() >= deadline) {
      throw new PublicRequestError("exhausted");
    }
    const delay = Math.min(RETRY_DELAYS_MS[attempt], Math.max(0, deadline - now()));
    await sleep(delay, options.signal);
  }

  throw new PublicRequestError("exhausted");
}
