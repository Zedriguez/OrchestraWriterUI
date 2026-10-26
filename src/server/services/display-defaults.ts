// Display settings a project starts with once its score is parsed: every part
// visible, the labeled seating plan, default section colors. Mirrors the
// browser's defaultDisplay() so a project looks the same whether the defaults
// came from the server or the client.
import type { Preferences } from "@/shared/api";
import type { InfoMap } from "@/shared/info-map";
import type { DisplaySettings } from "@/shared/project-file";
import { DEFAULT_SECTION_COLORS } from "@/shared/sections";
import { defaultPositions } from "@/lib/visualizer/seating";

export function defaultDisplaySettings(infoMap: InfoMap, preferences: Preferences): DisplaySettings {
  return {
    visibleParts: infoMap.instruments.map((i) => i.id),
    positions: defaultPositions(infoMap.instruments),
    colors: {},
    sectionColors: { ...DEFAULT_SECTION_COLORS },
    sections: {},
    showLabels: preferences.showLabelsDefault,
    labelMode: "sections",
    reducedMotion: preferences.reducedMotion,
    glowScale: 1,
  };
}
