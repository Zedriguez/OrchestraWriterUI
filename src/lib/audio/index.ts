/** STUB (WS3 replaces): decoding, peaks, and the playback engines. Keep these names. */
import type { InfoMap } from "@/shared/info-map";
import type { AlignAudio } from "@/shared/sync";

export interface AudioEngine {
  readonly kind: "recording" | "score";
  readonly duration: number;
  load(): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  seek(t: number): void;
  setRate(r: number): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  currentTime(): number;
  /** true once the source reached its end */
  ended(): boolean;
  destroy(): void;
}

export async function decodeAudioFile(_input: File | ArrayBuffer): Promise<AudioBuffer> {
  throw new Error("decodeAudioFile not implemented yet");
}

export function peaksFromAudioBuffer(_buffer: AudioBuffer, _bars = 420): number[] {
  throw new Error("peaksFromAudioBuffer not implemented yet");
}

export function peaksFromInfoMap(infoMap: InfoMap, bars = 420): number[] {
  return Array.from({ length: bars }, () => (infoMap.instruments.length ? 0.3 : 0.05));
}

export function toAlignAudio(_buffer: AudioBuffer): AlignAudio {
  throw new Error("toAlignAudio not implemented yet");
}

export function createRecordingEngine(_url: string): AudioEngine {
  throw new Error("createRecordingEngine not implemented yet");
}

export function createScoreSynthEngine(_infoMap: InfoMap): AudioEngine {
  throw new Error("createScoreSynthEngine not implemented yet");
}

export async function renderScoreToAudioBuffer(_infoMap: InfoMap, _durationSec: number): Promise<AudioBuffer> {
  throw new Error("renderScoreToAudioBuffer not implemented yet");
}
