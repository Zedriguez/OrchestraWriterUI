/**
 * Score engine contract. The parser is isomorphic (no DOM, no Node-only APIs)
 * so the same code runs in the parse-score job on the server and when a
 * project file is opened in the browser. Implementation lives in ./parse.ts;
 * everything else imports from this file only.
 */
import type { InfoMap } from "../info-map";
import type { Section } from "../sections";

export interface ScoreMeta {
  title: string;
  composer: string;
  movement: string;
  parts: number;
  measures: number;
  durationSec: number;
  tempo: number;
  timeSignature: string;
  warnings: string[];
}

export interface ScoreThumbGlow {
  section: Section;
  x: number;
  y: number;
  /** 0–1 prominence of the section across the piece */
  level: number;
}

export interface ScoreSummary {
  parts: number;
  measures: number;
  durationSec: number;
  thumbnail: ScoreThumbGlow[];
}

export interface ParseInput {
  /** raw .musicxml / .xml / .mxl bytes */
  bytes: Uint8Array;
  filename: string;
}

export type ParseOutcome = { ok: true; infoMap: InfoMap; meta: ScoreMeta } | { ok: false; error: string };

export { parseMusicXml } from "./parse";
export { summarizeInfoMap } from "./summary";
export { abbreviateInstrumentName } from "./names";
