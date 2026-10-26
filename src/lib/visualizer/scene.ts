import type { InfoMap } from "@/shared/info-map";
import type { DisplaySettings } from "@/shared/project-file";
import { CONDUCTOR, GLOW_SIZE } from "./seating";
import type { FrameState } from "./frame-state";
import type { GlowSprite, RenderScene } from "./renderer";

export function partColor(infoMap: InfoMap, display: DisplaySettings, partId: string): string {
  const inst = infoMap.instruments.find((i) => i.id === partId);
  if (!inst) return display.sectionColors.Other;
  const section = display.sections[partId] ?? inst.section;
  return display.colors[partId] ?? display.sectionColors[section];
}

/** Build the renderer scene from frame state + display settings. */
export function buildScene(
  infoMap: InfoMap,
  display: DisplaySettings,
  frame: FrameState | null,
  options: { showSeating?: boolean; showConductor?: boolean; selectedId?: string | null; forceLevel?: number } = {},
): RenderScene {
  const visible = new Set(display.visibleParts);
  const sprites: GlowSprite[] = [];
  for (const inst of infoMap.instruments) {
    if (!visible.has(inst.id)) continue;
    const pf = frame?.parts.find((p) => p.id === inst.id);
    const level = options.forceLevel ?? pf?.level ?? 0;
    if (level <= 0 && options.selectedId !== inst.id) continue;
    const section = display.sections[inst.id] ?? inst.section;
    const pos = display.positions[inst.id] ?? { x: 0.5, y: 0.5 };
    const size = GLOW_SIZE[section];
    const angle = Math.atan2(pos.x - CONDUCTOR.x, CONDUCTOR.y - pos.y);
    sprites.push({
      id: inst.id,
      x: pos.x,
      y: pos.y,
      rx: size.rx,
      ry: size.ry,
      angle,
      color: partColor(infoMap, display, inst.id),
      level,
      dynamic: pf?.dynamic ?? "mp",
      selected: options.selectedId === inst.id,
    });
  }
  return {
    sprites,
    showSeating: options.showSeating ?? true,
    showConductor: options.showConductor ?? true,
    glowScale: display.glowScale,
  };
}
