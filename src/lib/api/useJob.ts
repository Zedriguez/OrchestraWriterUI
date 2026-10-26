"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Job } from "@/shared/jobs";
import { api } from "./index";

const noop = () => {};

/** Subscribe to a job by id. Returns null until the job exists. */
export function useJob<T>(jobId: string | null): Job<T> | null {
  const subscribe = useCallback((cb: () => void) => (jobId ? api.subscribeJob<T>(jobId, cb) : noop), [jobId]);
  const get = useCallback(() => (jobId ? api.getJob<T>(jobId) : null), [jobId]);
  return useSyncExternalStore(subscribe, get, () => null);
}
