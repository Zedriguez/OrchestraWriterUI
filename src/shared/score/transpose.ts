import type { Instrument } from "../info-map";

/**
 * Semitones from written to sounding pitch for a part (Instrument.transpose,
 * from MusicXML <transpose>: chromatic + 12 × octave-change); 0 when absent.
 * Note pitches in the info map stay WRITTEN.
 *
 * Kept in its own module so the aligner and synth can use it without pulling
 * the XML parser into their bundles.
 */
export function soundingTranspose(inst: Instrument): number {
  const t = inst.transpose;
  return typeof t === "number" && Number.isFinite(t) ? t : 0;
}

/** @deprecated Instrument now has `transpose`; use Instrument. */
export type ParsedInstrument = Instrument;
