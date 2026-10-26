import type { InfoMap } from "../info-map";
import type { ScoreSummary } from "./index";

/** Placeholder until the score engine lands (workstream WS2). */
export function summarizeInfoMap(infoMap: InfoMap): ScoreSummary {
  return { parts: infoMap.instruments.length, measures: infoMap.measures.length, durationSec: infoMap.duration, thumbnail: [] };
}
