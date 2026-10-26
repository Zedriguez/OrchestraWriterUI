"use client";

import type { Job, JobKind, JobStatus } from "@/shared/jobs";

/**
 * One in-memory registry for every job the UI can subscribe to, whether it
 * runs in the browser (alignment worker, MP4 export, project file) or on the
 * server (parse-score, mirrored by polling). Pages consume jobs through
 * `useJob(jobId)` and never care where the work happens.
 */
type Listener = (job: Job<unknown>) => void;

const jobs = new Map<string, Job<unknown>>();
const listeners = new Map<string, Set<Listener>>();
let counter = 0;

export function newJobId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;
}

export function putJob<T>(job: Job<T>): Job<T> {
  jobs.set(job.id, job as Job<unknown>);
  listeners.get(job.id)?.forEach((l) => l(job as Job<unknown>));
  return job;
}

export function getJob<T>(id: string): Job<T> | null {
  return (jobs.get(id) as Job<T> | undefined) ?? null;
}

export function subscribeJob<T>(id: string, cb: (job: Job<T>) => void): () => void {
  const set = listeners.get(id) ?? new Set<Listener>();
  set.add(cb as Listener);
  listeners.set(id, set);
  const current = jobs.get(id);
  if (current) cb(current as Job<T>);
  return () => {
    set.delete(cb as Listener);
    if (set.size === 0) listeners.delete(id);
  };
}

export function createJob<T>(kind: JobKind, id = newJobId(kind.replace(/-/g, ""))): Job<T> {
  const now = new Date().toISOString();
  return putJob<T>({ id, kind, status: "queued", progress: 0, message: "Queued", startedAt: now, updatedAt: now });
}

export function updateJob<T>(id: string, patch: Partial<Omit<Job<T>, "id" | "kind">>): Job<T> | null {
  const current = jobs.get(id) as Job<T> | undefined;
  if (!current) return null;
  return putJob<T>({ ...current, ...patch, updatedAt: new Date().toISOString() });
}

export interface LocalJobHandle {
  /** report progress 0–1 with a human-readable step */
  report: (progress: number, message: string) => void;
  signal: AbortSignal;
}

const controllers = new Map<string, AbortController>();

/**
 * Start a browser-side job. Returns the queued Job immediately; the work runs
 * asynchronously and the registry is updated as it reports progress.
 */
export function runLocalJob<T>(kind: JobKind, work: (handle: LocalJobHandle) => Promise<T>): Job<T> {
  const job = createJob<T>(kind);
  const controller = new AbortController();
  controllers.set(job.id, controller);
  const report = (progress: number, message: string) =>
    updateJob<T>(job.id, { status: "running", progress: Math.max(0, Math.min(1, progress)), message });
  queueMicrotask(async () => {
    try {
      updateJob<T>(job.id, { status: "running", progress: 0, message: "Starting" });
      const result = await work({ report, signal: controller.signal });
      updateJob<T>(job.id, { status: "succeeded", progress: 1, message: "Done", result });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      updateJob<T>(job.id, { status: "failed", message: "Failed", error });
    } finally {
      controllers.delete(job.id);
    }
  });
  return job;
}

export function cancelJob(id: string) {
  controllers.get(id)?.abort();
}

export function isTerminal(status: JobStatus): boolean {
  return status === "succeeded" || status === "failed";
}

/**
 * Mirror a server-side job into the registry by polling `fetchJob` until it
 * reaches a terminal state. Resolves with the final job.
 */
export async function mirrorRemoteJob<T>(
  localId: string,
  fetchJob: () => Promise<Job<T>>,
  options: {
    intervalMs?: number;
    signal?: AbortSignal;
    map?: (remote: Job<T>) => Partial<Job<T>>;
    /** consecutive fetch failures tolerated before the local job fails (network blips) */
    maxFailures?: number;
    /** a server job whose updatedAt is older than this while still running is considered dead */
    staleAfterMs?: number;
  } = {},
): Promise<Job<T>> {
  const interval = options.intervalMs ?? 1200;
  const maxFailures = options.maxFailures ?? 5;
  const staleAfterMs = options.staleAfterMs ?? 3 * 60_000;
  let failures = 0;
  for (;;) {
    if (options.signal?.aborted) throw new Error("Cancelled");
    let remote: Job<T>;
    try {
      remote = await fetchJob();
      failures = 0;
    } catch (err) {
      failures++;
      if (failures >= maxFailures) throw err;
      await new Promise((r) => setTimeout(r, interval * failures));
      continue;
    }
    const patch = options.map ? options.map(remote) : { status: remote.status, progress: remote.progress, message: remote.message, result: remote.result, error: remote.error };
    const updated = updateJob<T>(localId, patch) ?? remote;
    if (isTerminal(remote.status)) return updated;
    const age = Date.now() - new Date(remote.updatedAt).getTime();
    if (Number.isFinite(age) && age > staleAfterMs) {
      throw new Error("The server stopped reporting progress on this job. Please try again.");
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}
