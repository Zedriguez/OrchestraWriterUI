/**
 * Abbreviations for crowded labels ("Violin I" → "Vln. I"). The parser prefers
 * the score's own part-abbreviation and falls back to this table.
 */
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/^(1st |first )?violins? i$|^violin 1$/i, "Vln. I"],
  [/^(2nd |second )?violins? ii$|^violin 2$/i, "Vln. II"],
  [/^violins?\b/i, "Vln."],
  [/^violas?\b/i, "Vla."],
  [/^(violon)?cellos?\b/i, "Vc."],
  [/^(double bass|contrabass|string bass|bass)$/i, "Cb."],
  [/^double bass|^contrabass(?!oon|\s*clarinet)/i, "Cb."],
  [/^piccolo/i, "Picc."],
  [/^alto flute/i, "A. Fl."],
  [/^flutes?\b/i, "Fl."],
  [/^oboes?\b/i, "Ob."],
  [/^english horn|^cor anglais/i, "E.H."],
  [/^bass clarinet/i, "B. Cl."],
  [/^clarinets?\b/i, "Cl."],
  [/^contrabassoon/i, "Cbsn."],
  [/^bassoons?\b/i, "Bsn."],
  [/^soprano sax/i, "S. Sax."],
  [/^alto sax/i, "A. Sax."],
  [/^tenor sax/i, "T. Sax."],
  [/^baritone sax/i, "Bar. Sax."],
  [/^(french )?horns?\b/i, "Hn."],
  [/^trumpets?\b/i, "Tpt."],
  [/^cornets?\b/i, "Cnt."],
  [/^bass trombone/i, "B. Tbn."],
  [/^trombones?\b/i, "Tbn."],
  [/^euphonium/i, "Euph."],
  [/^tubas?\b/i, "Tba."],
  [/^timpani/i, "Timp."],
  [/^percussion/i, "Perc."],
  [/^snare drum/i, "S.D."],
  [/^bass drum/i, "B.D."],
  [/^cymbals?\b/i, "Cym."],
  [/^triangle/i, "Tri."],
  [/^glockenspiel/i, "Glk."],
  [/^xylophone/i, "Xyl."],
  [/^marimba/i, "Mar."],
  [/^vibraphone/i, "Vib."],
  [/^celesta/i, "Cel."],
  [/^harps?\b/i, "Hp."],
  [/^piano/i, "Pno."],
  [/^organ/i, "Org."],
  [/^guitar/i, "Gtr."],
];

const NUMBER_SUFFIX = /\s(I{1,3}|IV|V|VI{0,3}|\d{1,2})$/;

/** "Violin I" → "Vln. I", "Horn 2" → "Hn. 2", "Clarinet in B♭" → "Cl.". */
export function abbreviateInstrumentName(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  for (const [re, abbr] of ABBREVIATIONS) {
    if (re.test(clean)) {
      if (NUMBER_SUFFIX.test(abbr)) return abbr;
      const suffix = clean.match(NUMBER_SUFFIX)?.[1];
      return suffix ? `${abbr} ${suffix}` : abbr;
    }
  }
  if (clean.length <= 6) return clean;
  return clean.slice(0, 4).trimEnd() + ".";
}
