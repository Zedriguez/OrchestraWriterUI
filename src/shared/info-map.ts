import type { Dynamic } from "./dynamics";
import type { Section } from "./sections";

/**
 * The information map: the one parsed representation of the score that every
 * downstream feature (sync, display, export) reads. Never read raw MusicXML
 * past import. Times here are *score time* in seconds (before sync).
 */

export type StyleMarking =
  | "Staccato"
  | "Slur"
  | "Marcato"
  | "Tenuto"
  | "Accent"
  | "Pizzicato"
  | "Tremolo"
  | "Legato";

export interface Note {
  /** seconds, score time */
  time: number;
  /** seconds */
  duration: number;
  /** MIDI note number (written pitch) */
  pitch: number;
  dynamics: Dynamic;
  styleMarking: StyleMarking | null;
  /** 1-based measure number */
  measure: number;
}

export interface Instrument {
  /** stable id from the MusicXML part id (e.g. "P1") */
  id: string;
  /** "Violin I", "Cello Section" */
  name: string;
  /** abbreviation used on crowded labels ("Vln. I") */
  shortName: string;
  section: Section;
  notes: Note[];
  /**
   * Chromatic transposition from written to sounding pitch (MusicXML
   * <transpose>, e.g. -2 for a B-flat clarinet). Absent or 0 for concert
   * pitch instruments. Display keeps written pitch; audio and alignment add it.
   */
  transpose?: number;
}

export interface MeasureInfo {
  /** 1-based index in playback order (repeats expanded) */
  number: number;
  /** printed bar number when it differs from `number` (after a repeat) */
  label?: string;
  /** seconds, score time */
  startTime: number;
  /** seconds */
  duration: number;
}

export interface InfoMap {
  instruments: Instrument[];
  measures: MeasureInfo[];
  /** total score duration in seconds (score time) */
  duration: number;
  tempo: number;
  timeSignature: string;
  warnings: string[];
}

export const MAX_PARTS = 64;
