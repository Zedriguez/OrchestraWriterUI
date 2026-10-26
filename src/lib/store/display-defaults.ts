import type { InfoMap } from "@/shared/info-map";
import type { DisplaySettings } from "@/shared/project-file";
import { DEFAULT_SECTION_COLORS } from "@/shared/sections";
import { defaultPositions } from "@/lib/visualizer/seating";

/**
 * Display settings for a freshly parsed score: every part visible on the
 * labeled seating plan with the default section colors. Lives apart from the
 * store so the HTTP client can use it without importing the store.
 */
export function defaultDisplay(infoMap: InfoMap): DisplaySettings {
  return {
    visibleParts: infoMap.instruments.map((i) => i.id),
    positions: defaultPositions(infoMap.instruments),
    colors: {},
    sectionColors: { ...DEFAULT_SECTION_COLORS },
    sections: {},
    showLabels: true,
    labelMode: "sections",
    reducedMotion: false,
    glowScale: 1,
  };
}
