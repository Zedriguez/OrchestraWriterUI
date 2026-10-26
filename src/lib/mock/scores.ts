import type { MockScoreSpec } from "./info-map";

/** Beethoven 5, I — the hero demo: 22 parts, 502 bars, 7:18. */
export const BEETHOVEN_5: MockScoreSpec = {
  seed: 5,
  measures: 502,
  durationSec: 438,
  tempo: 108,
  timeSignature: "2/4",
  parts: [
    { name: "Piccolo" },
    { name: "Flute I" },
    { name: "Flute II" },
    { name: "Oboe I" },
    { name: "Oboe II" },
    { name: "Clarinet I" },
    { name: "Clarinet II" },
    { name: "Bassoon I" },
    { name: "Bassoon II" },
    { name: "Contrabassoon" },
    { name: "Horn I" },
    { name: "Horn II" },
    { name: "Trumpet I" },
    { name: "Trumpet II" },
    { name: "Trombone I" },
    { name: "Trombone II" },
    { name: "Timpani" },
    { name: "Violin I" },
    { name: "Violin II" },
    { name: "Viola" },
    { name: "Cello" },
    { name: "Double Bass" },
  ],
  warnings: ["Repeat at bar 124 expanded.", "Transposing instruments shown at written pitch."],
};

export const DVORAK_9: MockScoreSpec = {
  seed: 9,
  measures: 348,
  durationSec: 680,
  tempo: 152,
  timeSignature: "4/4",
  parts: [
    { name: "Flute I" }, { name: "Flute II" }, { name: "Oboe I" }, { name: "Oboe II" },
    { name: "Clarinet I" }, { name: "Clarinet II" }, { name: "Bassoon I" }, { name: "Bassoon II" },
    { name: "Horn I" }, { name: "Horn II" }, { name: "Horn III" }, { name: "Horn IV" },
    { name: "Trumpet I" }, { name: "Trumpet II" }, { name: "Trombone I" }, { name: "Trombone II" },
    { name: "Trombone III" }, { name: "Tuba" }, { name: "Timpani" }, { name: "Cymbals" },
    { name: "Violin I" }, { name: "Violin II" }, { name: "Viola" }, { name: "Cello" }, { name: "Double Bass" },
  ],
};

export const MOZART_40: MockScoreSpec = {
  seed: 40,
  measures: 299,
  durationSec: 450,
  tempo: 120,
  timeSignature: "2/2",
  parts: [
    { name: "Flute I" }, { name: "Oboe I" }, { name: "Oboe II" }, { name: "Clarinet I" }, { name: "Clarinet II" },
    { name: "Bassoon I" }, { name: "Bassoon II" }, { name: "Horn I" }, { name: "Horn II" },
    { name: "Violin I" }, { name: "Violin II" }, { name: "Viola" }, { name: "Cello" }, { name: "Double Bass" },
  ],
};

export function specForProject(projectId: string): MockScoreSpec {
  switch (projectId) {
    case "dvorak-9":
      return DVORAK_9;
    case "mozart-40":
      return MOZART_40;
    default:
      return BEETHOVEN_5;
  }
}
