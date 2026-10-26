import type { AlignResult, ExportResult, Job, JobKind, ParseScoreResult } from "@/shared/jobs";
import { PROJECTS } from "@/lib/mock/library";
import type { ApiClient, ExportMp4Options } from "./types";

type Listener = (job: Job<unknown>) => void;

const jobs = new Map<string, Job<unknown>>();
const listeners = new Map<string, Set<Listener>>();

let counter = 0;
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;

interface Step {
  until: number;
  message: string;
}

function emit(job: Job<unknown>) {
  jobs.set(job.id, job);
  listeners.get(job.id)?.forEach((l) => l(job));
}

/** Run a fake job that walks through steps over `durationMs`, optionally failing. */
function runJob<T>(kind: JobKind, steps: Step[], durationMs: number, result: () => T, failWith?: string): Job<T> {
  const id = newId(kind.replace(/-/g, ""));
  const startedAt = new Date().toISOString();
  const job: Job<T> = { id, kind, status: "queued", progress: 0, message: "Queued", startedAt, updatedAt: startedAt };
  emit(job as Job<unknown>);

  const begin = performance.now() + 350;
  const tick = () => {
    const now = performance.now();
    if (now < begin) {
      requestAnimationFrame(tick);
      return;
    }
    const p = Math.min(1, (now - begin) / durationMs);
    const step = steps.find((s) => p <= s.until) ?? steps[steps.length - 1];
    if (failWith && p >= 0.62) {
      emit({ ...job, status: "failed", progress: p, message: "Failed", error: failWith, updatedAt: new Date().toISOString() });
      return;
    }
    if (p >= 1) {
      emit({ ...job, status: "succeeded", progress: 1, message: "Done", result: result(), updatedAt: new Date().toISOString() });
      return;
    }
    emit({ ...job, status: "running", progress: p, message: step.message, updatedAt: new Date().toISOString() });
    setTimeout(tick, 120);
  };
  setTimeout(tick, 50);
  return job;
}

export const mockApi: ApiClient = {
  async listProjects() {
    await wait(120);
    return PROJECTS;
  },
  async getProject(id) {
    await wait(60);
    return PROJECTS.find((p) => p.id === id) ?? null;
  },
  async createProject() {
    await wait(80);
    return { id: "new" };
  },
  async uploadScore(_projectId, file) {
    const tooBig = /mahler/i.test(file.name);
    return runJob<ParseScoreResult>(
      "parse-score",
      [
        { until: 0.18, message: "Uploading score" },
        { until: 0.42, message: "Reading part list" },
        { until: 0.7, message: "Walking measures and dynamics" },
        { until: 0.9, message: "Building the information map" },
        { until: 1, message: "Finishing" },
      ],
      4200,
      () => ({
        title: "Symphony No. 5",
        composer: "Ludwig van Beethoven",
        movement: "I. Allegro con brio",
        parts: 22,
        measures: 502,
        durationSec: 438,
        warnings: ["Repeat at bar 124 expanded.", "Transposing instruments shown at written pitch."],
      }),
      tooBig ? "86 parts exceed the 64-part limit. Split the score or hide parts before export." : undefined,
    );
  },
  async uploadAudio() {
    return runJob<void>(
      "generate-audio",
      [
        { until: 0.5, message: "Uploading recording" },
        { until: 0.85, message: "Decoding and analyzing waveform" },
        { until: 1, message: "Finishing" },
      ],
      2600,
      () => undefined,
    );
  },
  async startAlignment() {
    return runJob<AlignResult>(
      "align",
      [
        { until: 0.2, message: "Rendering score to audio" },
        { until: 0.45, message: "Computing chroma features" },
        { until: 0.8, message: "Warping score time onto the recording" },
        { until: 0.95, message: "Scoring confidence per measure" },
        { until: 1, message: "Finishing" },
      ],
      5200,
      () => ({ measures: 502, averageConfidence: 91, uncertainMeasures: 23 }),
    );
  },
  async exportMp4(options: ExportMp4Options) {
    const frames = options.frameRate === 60 ? "60 fps" : "30 fps";
    return runJob<ExportResult>(
      "export-mp4",
      [
        { until: 0.1, message: "Preparing renderer" },
        { until: 0.78, message: `Rendering frames · ${options.resolution} · ${frames}` },
        { until: 0.92, message: options.audio === "uploaded" ? "Muxing uploaded recording" : "Muxing generated playback" },
        { until: 1, message: "Finishing" },
      ],
      6800,
      () => ({
        filename: `${options.filename}.mp4`,
        bytes: options.resolution === "4k" ? 612_000_000 : options.resolution === "1080p" ? 184_000_000 : 96_000_000,
        url: "#",
      }),
    );
  },
  async exportProjectFile(_projectId, filename) {
    return runJob<ExportResult>(
      "export-project",
      [
        { until: 0.4, message: "Packing score, audio and markers" },
        { until: 0.8, message: "Writing display settings" },
        { until: 1, message: "Zipping" },
      ],
      1800,
      () => ({ filename: `${filename}.ovproj`, bytes: 14_800_000, url: "#" }),
    );
  },
  getJob<T>(jobId: string) {
    return (jobs.get(jobId) as Job<T> | undefined) ?? null;
  },
  subscribeJob<T>(jobId: string, cb: (job: Job<T>) => void) {
    const set = listeners.get(jobId) ?? new Set();
    set.add(cb as Listener);
    listeners.set(jobId, set);
    const current = jobs.get(jobId);
    if (current) cb(current as Job<T>);
    return () => {
      set.delete(cb as Listener);
    };
  },
};

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
