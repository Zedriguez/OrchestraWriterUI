/** STUB (WS3 replaces): MP4 rendering and the .ovproj container. Keep these names. */
import type { InfoMap } from "@/shared/info-map";
import type { DisplaySettings, ProjectFile } from "@/shared/project-file";
import type { MeasureAlignment } from "@/shared/sync";

export interface RenderMp4Options {
  infoMap: InfoMap;
  display: DisplaySettings;
  /** merged alignment (empty when playback is generated from the score) */
  aligned: MeasureAlignment[];
  audio: AudioBuffer | null;
  durationSec: number;
  resolution: "720p" | "1080p" | "4k";
  frameRate: 30 | 60;
  title: string;
  onProgress?: (progress: number, message: string) => void;
  signal?: AbortSignal;
}

export async function renderMp4(_options: RenderMp4Options): Promise<Blob> {
  throw new Error("renderMp4 not implemented yet");
}

export interface PackProjectInput {
  project: ProjectFile;
  scoreBytes: Uint8Array;
  scoreFilename: string;
  audioBytes?: Uint8Array;
  audioFilename?: string;
}

export function packProjectFile(_input: PackProjectInput): Uint8Array {
  throw new Error("packProjectFile not implemented yet");
}

export function unpackProjectFile(_bytes: Uint8Array): { project: ProjectFile; scoreBytes: Uint8Array; audioBytes?: Uint8Array } {
  throw new Error("unpackProjectFile not implemented yet");
}
