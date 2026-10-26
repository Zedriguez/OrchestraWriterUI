/**
 * Async jobs. Server jobs (parse-score) are polled over HTTP; browser jobs
 * (align, export-mp4, export-project, open-project, upload-*) run in the page
 * or a worker. Both publish into src/lib/jobs/registry.ts so pages consume
 * them the same way through useJob(jobId).
 */
export type JobKind =
  | "parse-score"
  | "upload-score"
  | "upload-audio"
  | "generate-audio"
  | "align"
  | "export-mp4"
  | "export-project"
  | "open-project"
  | "transcribe";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Job<T = unknown> {
  id: string;
  kind: JobKind;
  status: JobStatus;
  /** 0–1 */
  progress: number;
  /** human-readable current step */
  message: string;
  result?: T;
  error?: string;
  startedAt: string;
  updatedAt: string;
}

export interface ParseScoreResult {
  title: string;
  composer: string;
  movement: string;
  parts: number;
  measures: number;
  durationSec: number;
  warnings: string[];
}

export interface AudioUploadResult {
  filename: string;
  durationSec: number;
  /** 0–1, 420 bars */
  peaks: number[];
}

export interface AlignResult {
  measures: number;
  averageConfidence: number;
  uncertainMeasures: number;
  method: string;
}

export interface ExportResult {
  filename: string;
  bytes: number;
  /** download URL: a blob: URL right after a browser export, or a presigned S3 URL from history */
  url: string;
  exportId?: string;
}

export interface OpenProjectResult {
  projectId: string;
  hasRecording: boolean;
}
