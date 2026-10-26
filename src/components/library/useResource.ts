"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { errorMessage } from "@/lib/api/errors";

export interface Resource<T> {
  /** last loaded value for the current key; kept while a reload is in flight */
  data: T | undefined;
  /** the raw failure of the latest attempt (null while loading or after success) */
  error: unknown;
  /** readable message for `error` */
  errorText: string | null;
  /** a request for the current key is in flight */
  loading: boolean;
  /** fetch again; `data` stays on screen until the new value arrives */
  reload: () => void;
  /** local edit of the loaded value (optimistic updates, removals) */
  mutate: (update: (current: T | undefined) => T | undefined) => void;
}

interface Settled<T> {
  token: string | null;
  key: string | null;
  data: T | undefined;
  error: unknown;
}

/**
 * Client-side fetch for a page section. `load` may be an inline arrow: it is
 * read through an effect event, so only `key` (and `reload`) trigger a fetch.
 * A response that arrives after the key changed is ignored.
 */
export function useResource<T>(load: () => Promise<T>, key = ""): Resource<T> {
  const [attempt, setAttempt] = useState(0);
  const token = `${key}\u0000${attempt}`;
  const [state, setState] = useState<Settled<T>>({ token: null, key: null, data: undefined, error: null });
  const run = useEffectEvent(load);

  useEffect(() => {
    let cancelled = false;
    run().then(
      (data) => {
        if (!cancelled) setState({ token, key, data, error: null });
      },
      (error: unknown) => {
        if (!cancelled) setState((s) => ({ token, key, data: s.key === key ? s.data : undefined, error: error ?? new Error("Could not load") }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token, key]);

  const reload = useCallback(() => setAttempt((a) => a + 1), []);
  const mutate = useCallback((update: (current: T | undefined) => T | undefined) => {
    setState((s) => ({ ...s, data: update(s.data) }));
  }, []);

  const settled = state.token === token;
  const error = settled ? state.error : null;
  return {
    data: state.key === key ? state.data : undefined,
    error,
    errorText: error ? errorMessage(error, "Could not load") : null,
    loading: !settled,
    reload,
    mutate,
  };
}
