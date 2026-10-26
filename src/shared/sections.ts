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

const KEYWORDS: Array<[RegExp, Section]> = [
  [/violin|viola|cello|violoncello|contrabass(?!oon)|double bass|bass(?!oon| drum| clarinet)/i, "Strings"],
  [/flute|piccolo|oboe|english horn|cor anglais|clarinet|bassoon|contrabassoon|saxophone/i, "Woodwinds"],
  [/horn|trumpet|trombone|tuba|cornet|euphonium/i, "Brass"],
  [/timpani|percussion|drum|cymbal|triangle|tambourine|glockenspiel|xylophone|marimba|vibraphone|tam-tam|gong|celesta|chimes/i, "Percussion"],
];

/** Derive the section from an instrument name; falls back to Other. */
export function sectionForInstrumentName(name: string): Section {
  for (const [re, section] of KEYWORDS) {
    if (re.test(name)) return section;
  }
  return "Other";
}

/** Presentation order on stage and in lists. */
export const SECTION_ORDER: Section[] = ["Strings", "Woodwinds", "Brass", "Percussion", "Other"];
