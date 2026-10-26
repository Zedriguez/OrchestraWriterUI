import type { InfoMap } from "./info-map";
import type { Section } from "./sections";
import type { SyncState } from "./sync";

export interface PartPosition {
  /** 0–1, left → right */
  x: number;
  /** 0–1, back → front (top → bottom of the stage) */
  y: number;
}

/** Every user-adjustable display setting. Saved inside the project file. */
export interface DisplaySettings {
  visibleParts: string[];
  positions: Record<string, PartPosition>;
  /** per-part color override (hex) */
  colors: Record<string, string>;
  /** per-section color (hex) */
  sectionColors: Record<Section, string>;
  /** user re-assignment of a part's section */
  sections: Record<string, Section>;
  showLabels: boolean;
  labelMode: "sections" | "parts";
  reducedMotion: boolean;
  /** 0.6–1.4 multiplier on glow size */
  glowScale: number;
}

export type AudioSource = "uploaded" | "generated";

export interface ProjectFile {
  version: 1;
  createdWith: string;
  score: { filename: string; musicxml: string };
  audio: { source: AudioSource; filename: string | null; mp3: string | null };
  /** optional cache; must be rebuildable from score */
  infoMap?: InfoMap;
  sync: SyncState | null;
  display: DisplaySettings;
}

export const PROJECT_FILE_VERSION = 1 as const;
export const PROJECT_FILE_EXTENSION = ".ovproj";
