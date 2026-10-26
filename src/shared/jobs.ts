/**
 * The web app is a thin client over an async job API (ADR 0004):
 * upload → job id → poll or subscribe → result.
 */
export type JobKind = "parse-score" | "generate-audio" | "align" | "export-mp4" | "export-project";

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

export interface AlignResult {
  measures: number;
  averageConfidence: number;
  uncertainMeasures: number;
}

export interface ExportResult {
  filename: string;
  bytes: number;
  url: string;
}
