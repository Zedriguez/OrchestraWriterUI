/**
 * HTTP API contracts shared by the Hono server (src/server) and the browser
 * client (src/lib/api/http.ts). Every route in docs/plan/backend-integration.md
 * sends or receives one of these shapes. Ids are strings on the wire even when
 * Postgres stores integers.
 */
import type { ActivityItem, Director, Program, ProjectStage, ProjectSummary } from "./domain";
import type { InfoMap } from "./info-map";
import type { Job } from "./jobs";
import type { DisplaySettings } from "./project-file";
import type { SyncState } from "./sync";

/** Error body for every non-2xx response from our routes. */
export interface ApiError {
  error: string;
  code?: string;
}

/* ------------------------------------------------------------------ */
/* Uploads (presigned S3 PUT; the server never proxies bytes)          */
/* ------------------------------------------------------------------ */

export type UploadKind = "score" | "audio" | "export" | "project";

export interface UploadRequest {
  kind: UploadKind;
  filename: string;
  contentType: string;
  /** required for score/audio/export so the key lands under the project prefix */
  projectId?: string;
  /** exact size of the file; signed into the PUT so the upload cannot grow, and checked against the per-kind limit */
  bytes?: number;
}

export interface UploadTarget {
  key: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

/* ------------------------------------------------------------------ */
/* Profile and preferences                                             */
/* ------------------------------------------------------------------ */

export interface Preferences {
  theme: "program" | "stage";
  reducedMotion: boolean;
  showLabelsDefault: boolean;
  exportResolution: "720p" | "1080p" | "4k";
  exportFrameRate: 30 | 60;
  emailOnExport: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "program",
  reducedMotion: false,
  showLabelsDefault: true,
  exportResolution: "1080p",
  exportFrameRate: 60,
  emailOnExport: false,
};

export interface ProfileDto extends Director {
  image: string | null;
  preferences: Preferences;
}

export interface ProfileUpdate {
  name?: string;
  handle?: string;
  role?: Director["role"];
  ensemble?: string;
  location?: string;
  bio?: string;
  website?: string | null;
  preferences?: Partial<Preferences>;
}

export interface UsageBucket {
  count: number;
  bytes: number;
}

export interface UsageDto {
  scores: UsageBucket;
  recordings: UsageBucket;
  exports: UsageBucket;
  totalBytes: number;
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export interface ProjectDto extends ProjectSummary {
  scoreKey: string | null;
  audioFileId: string | null;
  audioKey: string | null;
  infoMapKey: string | null;
  /** 0–1 peaks, 420 bars, computed in the browser after decoding the recording */
  audioPeaks: number[] | null;
  /** id of the running or last parse-score job */
  parseJobId: string | null;
  sync: SyncState | null;
  display: DisplaySettings | null;
}

export interface ProjectCreate {
  title?: string;
}

export interface ProjectPatch {
  title?: string;
  subtitle?: string | null;
  composer?: string;
  movement?: string;
  stage?: ProjectStage;
  programIds?: string[];
}

export interface RegisterScoreRequest {
  key: string;
  filename: string;
}

export interface RegisterAudioRequest {
  key: string;
  filename: string;
  /** whole seconds, read in the browser */
  durationSec: number;
  peaks?: number[];
}

export interface ProjectUrls {
  score: string | null;
  audio: string | null;
  infoMap: string | null;
  expiresInSeconds: number;
}

/** Returned by GET /api/projects/:id/info-map-url consumers after fetching the JSON. */
export type InfoMapDocument = InfoMap;

/* ------------------------------------------------------------------ */
/* Exports                                                             */
/* ------------------------------------------------------------------ */

export type ExportKind = "mp4" | "project";

export interface ExportDto {
  id: string;
  projectId: string;
  kind: ExportKind;
  filename: string;
  key: string;
  bytes: number;
  resolution: "720p" | "1080p" | "4k" | null;
  frameRate: 30 | 60 | null;
  createdAt: string;
}

export interface RegisterExportRequest {
  kind: ExportKind;
  filename: string;
  key: string;
  bytes: number;
  resolution?: "720p" | "1080p" | "4k";
  frameRate?: 30 | 60;
}

/* ------------------------------------------------------------------ */
/* Programs and activity                                               */
/* ------------------------------------------------------------------ */

export interface ProgramDto extends Program {
  notes: string;
  createdAt: string;
}

export interface ProgramCreate {
  name: string;
  season?: string;
  date?: string;
  venue?: string;
  description?: string;
  color?: Program["color"];
}

export interface ProgramPatch extends Partial<ProgramCreate> {
  notes?: string;
  /** full ordered list; replaces the running order */
  projectIds?: string[];
}

export type ActivityDto = ActivityItem;

/* ------------------------------------------------------------------ */
/* Jobs                                                                */
/* ------------------------------------------------------------------ */

/** Same shape as the browser-side Job so the client can mirror server jobs. */
export type JobDto = Job<unknown>;

/* ------------------------------------------------------------------ */
/* Response envelopes                                                  */
/* ------------------------------------------------------------------ */

export interface ProjectResponse {
  project: ProjectDto;
}
export interface ProjectListResponse {
  projects: ProjectSummary[];
}
export interface RegisterScoreResponse {
  project: ProjectDto;
  job: JobDto;
}
export interface ProgramResponse {
  program: ProgramDto;
  projects: ProjectSummary[];
}
