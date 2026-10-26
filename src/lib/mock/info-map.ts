import { BRIGHTNESS_LADDER, DYNAMICS, dynamicFromIndex, type Dynamic } from "@/shared/dynamics";
import type { InfoMap, Instrument, Note, StyleMarking } from "@/shared/info-map";
import { sectionForInstrumentName, type Section } from "@/shared/sections";
import { createRng, smoothNoise } from "@/lib/utils/rng";
import { abbreviateInstrumentName } from "@/shared/score/names";

export interface MockPartSpec {
  name: string;
  shortName?: string;
  section?: Section;
}

export interface MockScoreSpec {
  seed: number;
  parts: MockPartSpec[];
  measures: number;
  durationSec: number;
  tempo: number;
  timeSignature: string;
  warnings?: string[];
}

const PLAY_DENSITY: Record<Section, number> = {
  Strings: 0.72,
  Woodwinds: 0.5,
  Brass: 0.36,
  Percussion: 0.26,
  Other: 0.4,
};

const PITCH_RANGE: Record<Section, [number, number]> = {
  Strings: [43, 88],
  Woodwinds: [55, 96],
  Brass: [40, 82],
  Percussion: [36, 60],
  Other: [48, 84],
};

const STYLES: StyleMarking[] = ["Staccato", "Slur", "Marcato", "Tenuto", "Accent", "Legato"];

/**
 * Builds a deterministic, musically plausible info map for demos: phrases,
 * section entrances, dynamic arcs, a loud opening and a loud finish.
 */
export function buildMockInfoMap(spec: MockScoreSpec): InfoMap {
  const rng = createRng(spec.seed);
  const measureDur = spec.durationSec / spec.measures;
  const measures = Array.from({ length: spec.measures }, (_, i) => ({
    number: i + 1,
    startTime: i * measureDur,
    duration: measureDur,
  }));

  // A global intensity curve for the whole piece (0–1).
  const arc = smoothNoise(rng, 2);
  const intensity = (m: number) => {
    const p = m / spec.measures;
    const climaxes = Math.exp(-((p - 0.33) ** 2) / 0.004) * 0.35 + Math.exp(-((p - 0.86) ** 2) / 0.006) * 0.5;
    const ending = p > 0.95 ? (p - 0.95) / 0.05 : 0;
    return Math.min(1, Math.max(0, 0.42 + arc(m) * 0.25 + climaxes + ending * 0.5));
  };

  const instruments: Instrument[] = spec.parts.map((p, idx) => {
    const section = p.section ?? sectionForInstrumentName(p.name);
    const partRng = createRng(spec.seed * 31 + idx * 7 + 1);
    const presence = smoothNoise(partRng, 3);
    const dyn = smoothNoise(partRng, 2);
    const density = PLAY_DENSITY[section];
    const [lo, hi] = PITCH_RANGE[section];
    const notes: Note[] = [];

    let phraseStyle: StyleMarking | null = partRng.pick(STYLES);

    for (let m = 0; m < spec.measures; m++) {
      const inten = intensity(m);
      // opening: strings + clarinets hammer the motif; finale: everyone
      const opening = m < 5 && (section === "Strings" || /clarinet/i.test(p.name));
      const finale = m >= spec.measures - 12;
      const threshold = 1 - density - inten * 0.35;
      const playing = opening || finale || presence(m) * 0.5 + 0.5 > threshold;
      if (!playing) continue;

      let dIdx = 1.2 + (dyn(m) * 0.5 + 0.5) * 2.4 + inten * 3.2;
      if (opening) dIdx = 5.5;
      if (finale) dIdx = Math.max(dIdx, 5);
      if (section === "Percussion" && !finale) dIdx -= 1.2;
      const dynamics: Dynamic = dynamicFromIndex(dIdx);

      if (partRng.chance(0.08)) phraseStyle = partRng.pick(STYLES);
      const count = section === "Percussion" ? partRng.int(1, 2) : partRng.int(1, 4);
      const slot = measureDur / count;
      for (let k = 0; k < count; k++) {
        const start = measures[m].startTime + slot * k + partRng.range(0, slot * 0.1);
        const dur = slot * partRng.range(0.55, 0.98);
        notes.push({
          time: start,
          duration: dur,
          pitch: partRng.int(lo, hi),
          dynamics,
          styleMarking: partRng.chance(0.7) ? phraseStyle : null,
          measure: m + 1,
        });
      }
    }

    return {
      id: `P${idx + 1}`,
      name: p.name,
      shortName: p.shortName ?? abbreviateInstrumentName(p.name),
      section,
      notes,
    };
  });

  return {
    instruments,
    measures,
    duration: spec.durationSec,
    tempo: spec.tempo,
    timeSignature: spec.timeSignature,
    warnings: spec.warnings ?? [],
  };
}

/** Moved to src/shared/score/names.ts; kept as an alias for older imports. */
export const abbreviate = abbreviateInstrumentName;

/** Moved to src/lib/score/segments.ts; re-exported so existing imports keep working. */
export { activitySegments, segmentAt, measureDynamic, type ActivitySegment } from "@/lib/score/segments";

export { BRIGHTNESS_LADDER, DYNAMICS };
