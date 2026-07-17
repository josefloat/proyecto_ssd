import { describe, expect, it, vi } from "vitest";
import {
  fetchPublicResource,
  MAX_REQUESTS,
  NOMINAL_BUDGET_MS,
  PublicRequestError,
  RETRY_DELAYS_MS,
} from "../lib/retry-coordinator";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("coordinador de espera ante cold start", () => {
  it("agrupa 504/503 y llega a ready sin encadenar errores (FLOW-3.1)", async () => {
    // Arrange
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(504, {}))
      .mockResolvedValueOnce(json(503, {}))
      .mockResolvedValueOnce(json(200, { items: [1] }));
    const phases: string[] = [];
    const delays: number[] = [];

    // Act
    const result = await fetchPublicResource<{ items: number[] }>("/api/demo", {
      signal: new AbortController().signal,
      fetcher,
      onPhase: (phase) => phases.push(phase),
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
      timeoutSignal: () => new AbortController().signal,
    });

    // Assert
    expect(result).toEqual({ items: [1] });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(phases).toEqual(["loading", "preparing", "preparing"]);
    expect(delays).toEqual([1_000, 2_000]);
  });

  it("agota exactamente siete requests y permite un presupuesto nuevo (FLOW-3.2)", async () => {
    // Arrange
    const fetcher = vi.fn().mockResolvedValue(json(504, {}));
    const delays: number[] = [];
    const run = () =>
      fetchPublicResource("/api/demo", {
        signal: new AbortController().signal,
        fetcher,
        onPhase: vi.fn(),
        sleep: async (milliseconds) => {
          delays.push(milliseconds);
        },
        timeoutSignal: () => new AbortController().signal,
      });

    // Act / Assert
    await expect(run()).rejects.toMatchObject({ kind: "exhausted" });
    expect(fetcher).toHaveBeenCalledTimes(MAX_REQUESTS);
    expect(delays).toEqual([...RETRY_DELAYS_MS]);
    expect(NOMINAL_BUDGET_MS).toBe(88_000);

    fetcher.mockResolvedValueOnce(json(200, { items: [] }));
    await expect(run()).resolves.toEqual({ items: [] });
    expect(fetcher).toHaveBeenCalledTimes(MAX_REQUESTS + 1);
  });

  it("offline detiene reintentos y no simula preparación (FLOW-3.3)", async () => {
    // Arrange
    const fetcher = vi.fn();

    // Act
    const run = fetchPublicResource("/api/demo", {
      signal: new AbortController().signal,
      fetcher,
      onPhase: vi.fn(),
      isOnline: () => false,
      timeoutSignal: () => new AbortController().signal,
    });

    // Assert
    await expect(run).rejects.toEqual(new PublicRequestError("offline"));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("abortar cancela el request anterior y sus temporizadores (FLOW-3.4)", async () => {
    // Arrange
    const controller = new AbortController();
    const fetcher = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
    );
    const run = fetchPublicResource("/api/demo", {
      signal: controller.signal,
      fetcher,
      onPhase: vi.fn(),
      timeoutSignal: () => new AbortController().signal,
    });

    // Act
    controller.abort(new DOMException("Navigation", "AbortError"));

    // Assert
    await expect(run).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
