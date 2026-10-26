import { DYNAMIC_INDEX, DYNAMICS } from "../dynamics";
import type { InfoMap } from "../info-map";
import { SECTION_ORDER } from "../sections";
import { defaultPositions } from "@/lib/visualizer/seating";
import type { ScoreSummary, ScoreThumbGlow } from "./index";

/**
 * Library-card summary of a parsed score. One thumbnail glow per section
 * present, placed at the centroid of that section's default seats, with a
 * level from how often the section plays and how loud the score marks it.
 */
export function summarizeInfoMap(infoMap: InfoMap): ScoreSummary {
  const totalMeasures = Math.max(1, infoMap.measures.length);
  const positions = defaultPositions(infoMap.instruments);
  const thumbnail: ScoreThumbGlow[] = [];
  const maxIndex = DYNAMICS.length - 1;

  for (const section of SECTION_ORDER) {
    const members = infoMap.instruments.filter((i) => i.section === section);
    if (members.length === 0) continue;
    const seats = members.map((m) => positions[m.id]).filter(Boolean);
    const x = seats.reduce((s, p) => s + p.x, 0) / Math.max(1, seats.length);
    const y = seats.reduce((s, p) => s + p.y, 0) / Math.max(1, seats.length);

    const playing = new Set<number>();
    let dynSum = 0;
    let dynCount = 0;
    for (const inst of members) {
      for (const n of inst.notes) {
        if (n.duration <= 0) continue;
        playing.add(n.measure);
        dynSum += DYNAMIC_INDEX[n.dynamics];
        dynCount++;
      }
    }
    const playFraction = playing.size / totalMeasures;
    const avgIndex = dynCount > 0 ? dynSum / dynCount : 0;
    // full presence at a forte-ish average reads as 1; quiet or sparse sections fade toward 0.2
    const raw = playFraction * (0.4 + (0.6 * avgIndex) / maxIndex) * 1.6;
    thumbnail.push({ section, x: round3(x), y: round3(y), level: round3(clamp(raw, 0.2, 1)) });
  }

  return { parts: infoMap.instruments.length, measures: infoMap.measures.length, durationSec: infoMap.duration, thumbnail };
}


function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function round3(v: number) {
  return Math.round(v * 1000) / 1000;
}
