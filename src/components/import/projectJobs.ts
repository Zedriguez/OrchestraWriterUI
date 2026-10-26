"use client";

import { useCallback, useState } from "react";
import type { Job } from "@/shared/jobs";
import { api } from "@/lib/api";
import { useJob } from "@/lib/api/useJob";

/**
 * Jobs outlive the page that started them (an upload keeps going when the
 * user opens another step). The job id is remembered per project and purpose
 * ("<projectId>:score", "<projectId>:align", ...) so a page that mounts again
 * picks the running job back up, and the completion callback is registered
 * when the job starts, not in a component effect, so it runs even if the page
 * is gone by then.
 */
const remembered = new Map<string, string>();
/** keys whose API call is in flight (the job id is not known yet) */
const starting = new Set<string>();

/** True while `start` for this key is waiting for the API to hand back a job. */
export function isStarting(key: string): boolean {
  return starting.has(key);
}

export function rememberedJobId(key: string): string | null {
  return remembered.get(key) ?? null;
}

export function forgetJob(key: string) {
  remembered.delete(key);
}

/** Test helper. */
export function forgetAllJobs() {
  remembered.clear();
  starting.clear();
}

export interface WatchOptions<T> {
  onSucceeded?: (job: Job<T>) => void | Promise<void>;
  onFailed?: (job: Job<T>) => void;
  /** drop the remembered id once the job succeeds (default false) */
  forgetOnSuccess?: boolean;
}

/** Subscribe until the job reaches a terminal state, then call the matching callback once. */
export function watchJob<T>(key: string, jobId: string, options: WatchOptions<T>) {
  let done = false;
  let unsubscribe: (() => void) | null = null;
  const handle = (job: Job<T>) => {
    if (done || (job.status !== "succeeded" && job.status !== "failed")) return;
    done = true;
    queueMicrotask(() => unsubscribe?.());
    if (job.status === "succeeded") {
      if (options.forgetOnSuccess && remembered.get(key) === jobId) remembered.delete(key);
      void options.onSucceeded?.(job);
    } else {
      options.onFailed?.(job);
    }
  };
  unsubscribe = api.subscribeJob<T>(jobId, handle);
  if (done) unsubscribe();
}

/**
 * The job for one project-scoped purpose. `start(run)` runs the API call,
 * remembers the job id and wires the callbacks; `clear()` forgets it.
 */
export function useProjectJob<T>(key: string, options: WatchOptions<T> = {}) {
  const [state, setState] = useState(() => ({ key, jobId: rememberedJobId(key) }));
  // a different key (another project) starts from that key's memory
  const jobId = state.key === key ? state.jobId : rememberedJobId(key);
  if (state.key !== key) setState({ key, jobId });
  const job = useJob<T>(jobId);
  const { onSucceeded, onFailed, forgetOnSuccess } = options;

  const start = useCallback(
    async (run: () => Promise<Job<T>>): Promise<Job<T>> => {
      starting.add(key);
      let next: Job<T>;
      try {
        next = await run();
      } finally {
        starting.delete(key);
      }
      remembered.set(key, next.id);
      watchJob<T>(key, next.id, { onSucceeded, onFailed, forgetOnSuccess });
      setState({ key, jobId: next.id });
      return next;
    },
    [key, onSucceeded, onFailed, forgetOnSuccess],
  );

  const clear = useCallback(() => {
    remembered.delete(key);
    setState({ key, jobId: null });
  }, [key]);

  return { job, jobId, start, clear };
}

export function isRunning(job: Job<unknown> | null | undefined): boolean {
  return !!job && (job.status === "queued" || job.status === "running");
}
