"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchPublicResource,
  PublicRequestError,
  type NetworkPhase,
} from "@/lib/retry-coordinator";

export type ResourceState<T> =
  | Readonly<{ kind: "loading" | "preparing" }>
  | Readonly<{ kind: "ready"; data: T }>
  | Readonly<{ kind: "empty"; data: T }>
  | Readonly<{ kind: "offline" | "invalid" | "error"; status?: number }>;

export function usePublicResource<T>(
  key: string,
  url: string | null,
  isEmpty: (data: T) => boolean,
) {
  const [cycle, setCycle] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    if (!url) {
      queueMicrotask(() => {
        if (active) setState({ kind: "invalid" });
      });
      return () => {
        active = false;
      };
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      if (active) setState({ kind: "loading" });
    });

    void fetchPublicResource<T>(url, {
      signal: controller.signal,
      onPhase: (phase: NetworkPhase) => {
        if (active) setState({ kind: phase });
      },
    })
      .then((data) => {
        if (active) {
          setState(isEmpty(data) ? { kind: "empty", data } : { kind: "ready", data });
        }
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        if (error instanceof PublicRequestError) {
          setState({
            kind:
              error.kind === "exhausted" ? "error" : error.kind,
            status: error.status,
          });
          return;
        }
        setState({ kind: "error" });
      });

    return () => {
      active = false;
      controller.abort(new DOMException("Navigation changed", "AbortError"));
    };
  }, [key, url, cycle, isEmpty]);

  const retry = useCallback(() => setCycle((value) => value + 1), []);
  return { state, retry };
}
