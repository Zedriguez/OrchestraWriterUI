export const SECTIONS = ["Strings", "Woodwinds", "Brass", "Percussion", "Other"] as const;
export type Section = (typeof SECTIONS)[number];

/** Default hue per section. Users can change any of them in Customize. */
export const DEFAULT_SECTION_COLORS: Record<Section, string> = {
  Strings: "#e2b04c",
  Woodwinds: "#5cba9a",
  Brass: "#e8705e",
  Percussion: "#9298e0",
  Other: "#c98bc9",
};

export const SECTION_TOKEN: Record<Section, string> = {
  Strings: "var(--sec-strings)",
  Woodwinds: "var(--sec-woodwinds)",
  Brass: "var(--sec-brass)",
  Percussion: "var(--sec-percussion)",
  Other: "var(--sec-other)",
};

/**
 * Keyword table, checked in order. Specific wind, brass and percussion names
 * come before the generic string words so "Bass Clarinet", "Bass Trombone",
 * "Bass Drum" and "English Horn" don't fall into the wrong section.
 * Includes common Italian/German/French score names.
 */
const KEYWORDS: Array<[RegExp, Section]> = [
  [
    /flute|fl[oö]te|fl[uû]te|flaut|piccolo|ottavino|oboe|oboi|hautbois|english horn|cor anglais|corno inglese|clarinet|klarinett|bassoon|fagott|basson|saxophone|\bsax\b|recorder/i,
    "Woodwinds",
  ],
  [/horn|h[oö]rner|corno|corni|\bcor\b|trumpet|trompet|tromba|trombe|trombone|posaune|tuba|cornet|flugelhorn|euphonium/i, "Brass"],
  [
    /timpani|timbales|pauken|percussion|drum|cymbal|triangle|tambourine|glockenspiel|xylophone|marimba|vibraphone|tam-tam|gong|celesta|chimes|bells|crotales|wood ?block|castanets|claves|maracas|snare|tom-tom/i,
    "Percussion",
  ],
  [/violin|violino|violini|viola|viole|bratsche|cello|violoncell|contrabass|contrabbass|kontrabass|double bass|string bass|bass/i, "Strings"],
];

/** Derive the section from an instrument name; falls back to Other. */
export function sectionForInstrumentName(name: string): Section {
  for (const [re, section] of KEYWORDS) {
    if (re.test(name)) return section;
  }
  return "Other";
}

export interface InstrumentClues {
  /** part-name (or instrument-name) as written in the score */
  name: string;
  abbreviation?: string | null;
  /** MusicXML instrument-sound id, e.g. "strings.violin", "wind.reed.clarinet.bflat" */
  instrumentSound?: string | null;
  /** General MIDI program, 1-based as written in MusicXML (1–128) */
  midiProgram?: number | null;
  /** MIDI channel, 1-based; channel 10 is the GM percussion channel */
  midiChannel?: number | null;
}

/** MusicXML standard sound ids (sounds.xml) → section, by prefix. */
function sectionForInstrumentSound(sound: string): Section | null {
  const s = sound.toLowerCase().trim();
  if (!s) return null;
  if (s.includes("celesta")) return "Percussion";
  if (s.includes("harp")) return "Other";
  if (s.startsWith("strings.")) {
    return /violin|viola|cello|contrabass|double-bass|group|fiddle/.test(s) ? "Strings" : "Other";
  }
  if (s.startsWith("wind.")) return "Woodwinds";
  if (s.startsWith("brass.")) return "Brass";
  if (/^(drum|metal|wood|rattle|pitched-percussion|percussion)\./.test(s)) return "Percussion";
  if (/^(keyboard|pluck|voice|synth|effect)\./.test(s)) return "Other";
  return null;
}

/** General MIDI program (1–128) → section. */
function sectionForMidiProgram(program: number): Section | null {
  if (!Number.isFinite(program) || program < 1 || program > 128) return null;
  if (program === 47) return "Other"; // orchestral harp
  if (program === 48) return "Percussion"; // timpani
  if (program <= 8) return "Other"; // piano
  if (program <= 16) return "Percussion"; // chromatic percussion
  if (program <= 24) return "Other"; // organ
  if (program <= 32) return "Other"; // guitar
  if (program <= 40) return "Strings"; // bass
  if (program <= 48) return "Strings"; // strings
  if (program <= 52) return "Strings"; // string ensembles
  if (program <= 56) return "Other"; // choir, voice, orchestra hit
  if (program <= 64) return "Brass";
  if (program <= 80) return "Woodwinds"; // reed + pipe
  if (program >= 113 && program <= 120) return "Percussion";
  return "Other";
}

/**
 * Classify a part into a section from every clue the score offers, most
 * specific first: the standard instrument-sound id, then the part name, then
 * the MIDI channel (10 = percussion) and General MIDI program, then the
 * abbreviation. Falls back to Other. Users can re-assign in Customize.
 */
export function classifyInstrument(clues: InstrumentClues): Section {
  const fromSound = clues.instrumentSound ? sectionForInstrumentSound(clues.instrumentSound) : null;
  if (fromSound) return fromSound;
  const fromName = sectionForInstrumentName(clues.name);
  if (fromName !== "Other") return fromName;
  if (clues.midiChannel === 10) return "Percussion";
  const fromProgram = clues.midiProgram != null ? sectionForMidiProgram(clues.midiProgram) : null;
  if (fromProgram) return fromProgram;
  if (clues.abbreviation) {
    const fromAbbr = sectionForInstrumentName(clues.abbreviation);
    if (fromAbbr !== "Other") return fromAbbr;
  }
  return "Other";
}

/** Presentation order on stage and in lists. */
export const SECTION_ORDER: Section[] = ["Strings", "Woodwinds", "Brass", "Percussion", "Other"];
