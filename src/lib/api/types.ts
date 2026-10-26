import type { AlignResult, ExportResult, Job, ParseScoreResult } from "@/shared/jobs";
import type { ProjectSummary } from "@/shared/domain";

export interface ExportMp4Options {
  projectId: string;
  filename: string;
  resolution: "720p" | "1080p" | "4k";
  frameRate: 30 | 60;
  audio: "uploaded" | "generated";
}

/**
 * Contract for the AWS job API (ADR 0004). The mock implementation in
 * `./mock.ts` simulates latency and progress; swap `api` in `./index.ts`
 * for the HTTP client when the services exist.
 */
export interface ApiClient {
  listProjects(): Promise<ProjectSummary[]>;
  getProject(id: string): Promise<ProjectSummary | null>;
  createProject(): Promise<{ id: string }>;
  uploadScore(projectId: string, file: File): Promise<Job<ParseScoreResult>>;
  uploadAudio(projectId: string, file: File): Promise<Job<void>>;
  startAlignment(projectId: string): Promise<Job<AlignResult>>;
  exportMp4(options: ExportMp4Options): Promise<Job<ExportResult>>;
  exportProjectFile(projectId: string, filename: string): Promise<Job<ExportResult>>;
  getJob<T>(jobId: string): Job<T> | null;
  subscribeJob<T>(jobId: string, cb: (job: Job<T>) => void): () => void;
}
