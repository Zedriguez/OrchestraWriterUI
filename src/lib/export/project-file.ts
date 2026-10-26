import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import type { InfoMap } from "@/shared/info-map";
import { PROJECT_FILE_VERSION, type AudioSource, type DisplaySettings, type ProjectFile } from "@/shared/project-file";
import type { SyncState } from "@/shared/sync";

/**
 * The .ovproj container: a zip with project.json plus the original score and
 * recording. project.json's score.musicxml and audio.mp3 hold the entry
 * paths inside the zip (never local paths). Pure: runs in the browser and in
 * node.
 */

export const PROJECT_JSON = "project.json";
export const SCORE_DIR = "score/";
export const AUDIO_DIR = "audio/";
/** Refuse to inflate any single entry larger than this (zip-bomb guard). */
export const MAX_ENTRY_BYTES = 1024 * 1024 * 1024;

export type ProjectFileErrorCode =
  | "not-a-zip"
  | "missing-project-json"
  | "invalid-json"
  | "missing-version"
  | "newer-version"
  | "unsupported-version"
  | "invalid-project"
  | "missing-score"
  | "missing-audio"
  | "entry-too-large";

export class ProjectFileError extends Error {
  readonly code: ProjectFileErrorCode;
  constructor(code: ProjectFileErrorCode, message: string) {
    super(message);
    this.name = "ProjectFileError";
    this.code = code;
  }
}

export interface PackProjectInput {
  project: ProjectFile;
  scoreBytes: Uint8Array;
  scoreFilename: string;
  audioBytes?: Uint8Array;
  audioFilename?: string;
}

export interface UnpackedProject {
  project: ProjectFile;
  scoreBytes: Uint8Array;
  audioBytes?: Uint8Array;
  /** original file names (as stored in project.json) */
  scoreFilename: string;
  audioFilename: string | null;
}

export interface BuildProjectInput {
  infoMap?: InfoMap | null;
  sync: SyncState | null;
  display: DisplaySettings;
  scoreFilename: string;
  audioFilename?: string | null;
  audioSource: AudioSource;
  /** app name + version, e.g. "orchestra-visualizer@0.1.0" */
  createdWith?: string;
}

export const DEFAULT_CREATED_WITH = "orchestra-visualizer@0.1.0";

/** Last path segment, without directories or drive letters; never empty. */
export function baseName(name: string | null | undefined, fallback: string): string {
  const last = (name ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = last.replace(/^[a-zA-Z]:/, "").replace(/[\u0000-\u001f]/g, "").trim();
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : fallback;
}

export function scoreEntryPath(filename: string): string {
  return SCORE_DIR + baseName(filename, "score.musicxml");
}

export function audioEntryPath(filename: string): string {
  return AUDIO_DIR + baseName(filename, "audio.mp3");
}

/** Assemble the ProjectFile object (paths point inside the .ovproj zip). */
export function buildProjectFile(input: BuildProjectInput): ProjectFile {
  const scoreName = baseName(input.scoreFilename, "score.musicxml");
  const audioName = input.audioFilename ? baseName(input.audioFilename, "audio.mp3") : null;
  const project: ProjectFile = {
    version: PROJECT_FILE_VERSION,
    createdWith: input.createdWith ?? DEFAULT_CREATED_WITH,
    score: { filename: scoreName, musicxml: scoreEntryPath(scoreName) },
    audio: {
      source: input.audioSource,
      filename: input.audioSource === "uploaded" ? audioName : null,
      mp3: input.audioSource === "uploaded" && audioName ? audioEntryPath(audioName) : null,
    },
    sync: input.sync,
    display: input.display,
  };
  if (input.infoMap) project.infoMap = input.infoMap;
  return project;
}

/** Zip the project. MP3 and compressed MusicXML (.mxl) are stored, plain XML is deflated. */
export function packProjectFile(input: PackProjectInput): Uint8Array {
  const { project } = input;
  if (!input.scoreBytes || input.scoreBytes.byteLength === 0) {
    throw new ProjectFileError("missing-score", "The score is empty, so there is nothing to save.");
  }
  if (project.audio.source === "uploaded" && !input.audioBytes) {
    throw new ProjectFileError("missing-audio", "This project uses an uploaded recording, but the recording was not provided to the project file.");
  }
  const scoreName = baseName(input.scoreFilename || project.score.filename, "score.musicxml");
  const scorePath = scoreEntryPath(scoreName);
  const hasAudio = !!input.audioBytes && project.audio.source === "uploaded";
  const audioName = hasAudio ? baseName(input.audioFilename || project.audio.filename, "audio.mp3") : null;
  const audioPath = audioName ? audioEntryPath(audioName) : null;

  const json: ProjectFile = {
    ...project,
    version: PROJECT_FILE_VERSION,
    score: { filename: scoreName, musicxml: scorePath },
    audio: { source: project.audio.source, filename: hasAudio ? audioName : null, mp3: audioPath },
  };

  const files: Zippable = {
    [PROJECT_JSON]: strToU8(JSON.stringify(json, null, 2)),
    [scorePath]: [input.scoreBytes, { level: /\.mxl$/i.test(scoreName) ? 0 : 6 }],
  };
  if (audioPath && input.audioBytes) files[audioPath] = [input.audioBytes, { level: 0 }];
  return zipSync(files, { level: 6 });
}

/** Open a .ovproj: validates, migrates older versions, and returns the original files. */
export function unpackProjectFile(bytes: Uint8Array): UnpackedProject {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        const wanted = f.name === PROJECT_JSON || f.name.startsWith(SCORE_DIR) || f.name.startsWith(AUDIO_DIR);
        if (wanted && f.originalSize > MAX_ENTRY_BYTES) {
          throw new ProjectFileError("entry-too-large", `The project file entry ${f.name} is too large to open.`);
        }
        return wanted;
      },
    });
  } catch (err) {
    if (err instanceof ProjectFileError) throw err;
    throw new ProjectFileError("not-a-zip", "This file is not an Orchestra Visualizer project (.ovproj): it could not be opened as a zip archive.");
  }

  const raw = files[PROJECT_JSON];
  if (!raw) {
    throw new ProjectFileError("missing-project-json", "The project file is missing project.json, so it cannot be opened.");
  }
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(raw));
  } catch {
    throw new ProjectFileError("invalid-json", "The project file's project.json is not valid JSON.");
  }

  const project = migrateProjectFile(json);

  const scoreBytes = files[project.score.musicxml];
  if (!scoreBytes) {
    throw new ProjectFileError("missing-score", `The project file is missing its score (${project.score.musicxml}).`);
  }
  let audioBytes: Uint8Array | undefined;
  if (project.audio.mp3) {
    audioBytes = files[project.audio.mp3];
    if (!audioBytes) {
      throw new ProjectFileError("missing-audio", `The project file is missing its recording (${project.audio.mp3}).`);
    }
  }
  return { project, scoreBytes, audioBytes, scoreFilename: project.score.filename, audioFilename: project.audio.filename };
}

/* ------------------------------------------------------------------ */
/* Versioning                                                           */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

/**
 * MIGRATIONS[n] turns a version-n object into version n+1. When the shape
 * changes: bump PROJECT_FILE_VERSION in src/shared/project-file.ts, add
 * MIGRATIONS[old] here, and add a fixture test that opens an old file.
 */
export const MIGRATIONS: Record<number, (json: Json) => Json> = {};

/** Validate and bring any supported version up to the current one. */
export function migrateProjectFile(input: unknown): ProjectFile {
  if (!isObject(input)) throw new ProjectFileError("invalid-project", "project.json does not contain a project.");
  const version = input.version;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new ProjectFileError("missing-version", "project.json has no version number, so it cannot be opened.");
  }
  if (version > PROJECT_FILE_VERSION) {
    throw new ProjectFileError(
      "newer-version",
      `This project was saved by a newer version of Orchestra Visualizer (file version ${version}; this app opens up to version ${PROJECT_FILE_VERSION}). Update the app to open it.`,
    );
  }
  if (version < 1) throw new ProjectFileError("unsupported-version", `Project file version ${version} is not supported.`);

  let json: Json = input;
  for (let v = version; v < PROJECT_FILE_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new ProjectFileError("unsupported-version", `Project file version ${v} can no longer be opened (no migration to version ${v + 1}).`);
    json = { ...step(json), version: v + 1 };
  }
  return assertProjectShape(json);
}

function assertProjectShape(json: Json): ProjectFile {
  const fail = (what: string): never => {
    throw new ProjectFileError("invalid-project", `The project file is damaged: ${what}.`);
  };
  const score = json.score;
  if (!isObject(score) || typeof score.filename !== "string" || typeof score.musicxml !== "string" || !score.musicxml) fail("score is missing");
  const audio = json.audio;
  if (!isObject(audio) || (audio.source !== "uploaded" && audio.source !== "generated")) fail("audio source is missing");
  const a = audio as Json;
  if (a.filename !== null && typeof a.filename !== "string") fail("audio filename is invalid");
  if (a.mp3 !== null && typeof a.mp3 !== "string") fail("audio path is invalid");
  if (a.source === "uploaded" && !a.mp3) fail("the uploaded recording is missing");
  const display = json.display;
  if (!isObject(display) || !Array.isArray(display.visibleParts) || !isObject(display.positions) || !isObject(display.sectionColors)) {
    fail("display settings are missing");
  }
  const sync = json.sync;
  if (sync !== null && sync !== undefined && (!isObject(sync) || !Array.isArray(sync.auto) || !Array.isArray(sync.manual))) fail("sync markers are invalid");
  if (json.infoMap !== undefined && (!isObject(json.infoMap) || !Array.isArray((json.infoMap as Json).instruments))) fail("the cached information map is invalid");

  return {
    version: PROJECT_FILE_VERSION,
    createdWith: typeof json.createdWith === "string" ? json.createdWith : "unknown",
    score: { filename: (score as Json).filename as string, musicxml: (score as Json).musicxml as string },
    audio: { source: a.source as AudioSource, filename: (a.filename as string | null) ?? null, mp3: (a.mp3 as string | null) ?? null },
    ...(json.infoMap !== undefined ? { infoMap: json.infoMap as InfoMap } : {}),
    sync: (sync as SyncState | null | undefined) ?? null,
    display: display as unknown as DisplaySettings,
  };
}

function isObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
