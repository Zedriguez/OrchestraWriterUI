/**
 * Written dynamics. The visual's brightness is read from this ladder — never
 * from the loudness of the recording (design principle 1).
 */
export const DYNAMICS = ["pp", "p", "mp", "mf", "f", "ff", "fff"] as const;
export type Dynamic = (typeof DYNAMICS)[number];

export const DYNAMIC_INDEX: Record<Dynamic, number> = {
  pp: 0,
  p: 1,
  mp: 2,
  mf: 3,
  f: 4,
  ff: 5,
  fff: 6,
};

/** Fixed seven-step brightness ladder (luminance multiplier 0–1). */
export const BRIGHTNESS_LADDER: Record<Dynamic, number> = {
  pp: 0.22,
  p: 0.34,
  mp: 0.47,
  mf: 0.6,
  f: 0.74,
  ff: 0.88,
  fff: 1,
};

/** SMuFL code points in Bravura Text for each dynamic. */
export const BRAVURA_DYNAMICS: Record<Dynamic, string> = {
  pp: "",
  p: "",
  mp: "",
  mf: "",
  f: "",
  ff: "",
  fff: "",
};

export const DYNAMIC_LABELS: Record<Dynamic, string> = {
  pp: "pianissimo",
  p: "piano",
  mp: "mezzo-piano",
  mf: "mezzo-forte",
  f: "forte",
  ff: "fortissimo",
  fff: "fortississimo",
};

export function dynamicFromIndex(i: number): Dynamic {
  const clamped = Math.max(0, Math.min(DYNAMICS.length - 1, Math.round(i)));
  return DYNAMICS[clamped];
}

export function louder(a: Dynamic, b: Dynamic): Dynamic {
  return DYNAMIC_INDEX[a] >= DYNAMIC_INDEX[b] ? a : b;
}
