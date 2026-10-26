import type { InfoMap } from "@/shared/info-map";
import type { DisplaySettings } from "@/shared/project-file";
import { BRAVURA_DYNAMICS, louder, type Dynamic } from "@/shared/dynamics";
import { SECTION_ORDER, type Section } from "@/shared/sections";
import { partColor } from "./scene";

/**
 * Part / section labels beside each glow, with leader lines. The same layout
 * feeds the DOM overlay in Preview (Stage.tsx) and the canvas drawing used by
 * MP4 export (drawLabels), so exported frames match what the user previewed.
 * All coordinates are logical (CSS) pixels of the stage.
 */

export interface StageLabel {
  key: string;
  text: string;
  dynamic: Dynamic;
  color: string;
  /** normalized anchor on the stage */
  x: number;
  y: number;
  side: "left" | "right" | "top";
  level: number;
  partIds: string[];
}

export interface PlacedLabel extends StageLabel {
  /** label anchor in px: left edge (left side), right edge (right side) or center (top) */
  lx: number;
  /** vertical center (left/right) or top edge (top) in px */
  ly: number;
  /** leader line points in px, from the label toward the glow */
  line: Array<[number, number]>;
}

export interface LabelPart {
  id: string;
  playing: boolean;
  dynamic: Dynamic;
  level: number;
}

export type LabelMode = DisplaySettings["labelMode"];

/** Minimum vertical distance between two label centers on the same side, px. */
export const LABEL_MIN_GAP = 46;
/** Horizontal distance between neighboring top (percussion) labels, px. */
export const LABEL_TOP_SPACING = 110;

/** Typography of a label block, in logical px. Mirrors the DOM overlay classes in Stage.tsx. */
export const LABEL_METRICS = {
  textSize: 10,
  /** 0.18em tracking */
  tracking: 1.8,
  dynSize: 19,
  /** gap between the name and the dynamic (mt-1) */
  dynGap: 4,
  conductorSize: 9,
  /** 0.2em tracking */
  conductorTracking: 1.8,
} as const;

/** Strings get their own labels; other sections are labeled as a group with their loudest dynamic. */
export function computeLabels(
  infoMap: InfoMap,
  display: DisplaySettings,
  parts: LabelPart[],
  mode: LabelMode,
  previewAll?: boolean,
): StageLabel[] {
  const visible = new Set(display.visibleParts);
  const byId = new Map(parts.map((p) => [p.id, p]));
  const instById = new Map(infoMap.instruments.map((i) => [i.id, i]));
  const sectionOf = (id: string): Section => display.sections[id] ?? instById.get(id)?.section ?? "Other";
  const out: StageLabel[] = [];
  const groups = new Map<string, { section: Section; ids: string[] }>();

  for (const inst of infoMap.instruments) {
    if (!visible.has(inst.id)) continue;
    const section = sectionOf(inst.id);
    const key = mode === "parts" || section === "Strings" ? inst.id : section;
    const g = groups.get(key) ?? { section, ids: [] };
    g.ids.push(inst.id);
    groups.set(key, g);
  }

  for (const [key, g] of groups) {
    let sx = 0;
    let sy = 0;
    let level = 0;
    let dyn: Dynamic | null = null;
    for (const id of g.ids) {
      const pos = display.positions[id] ?? { x: 0.5, y: 0.5 };
      sx += pos.x;
      sy += pos.y;
      const pf = byId.get(id);
      const lv = previewAll ? 0.55 : (pf?.level ?? 0);
      level = Math.max(level, lv);
      if (pf && (pf.playing || previewAll)) dyn = dyn ? louder(dyn, pf.dynamic) : pf.dynamic;
    }
    const n = g.ids.length;
    const x = sx / n;
    const y = sy / n;
    const inst = instById.get(g.ids[0])!;
    const text = g.ids.length === 1 && (mode === "parts" || g.section === "Strings") ? inst.name : g.section;
    const color = g.ids.length === 1 ? partColor(infoMap, display, g.ids[0]) : display.sectionColors[g.section];
    const side: StageLabel["side"] = g.section === "Percussion" && g.ids.length > 1 ? "top" : x < 0.5 ? "left" : "right";
    out.push({ key, text, dynamic: dyn ?? byId.get(g.ids[0])?.dynamic ?? "mp", color, x, y, side, level, partIds: g.ids });
  }
  // stable order: sections then y
  out.sort((a, b) => SECTION_ORDER.indexOf(sectionOf(a.partIds[0])) - SECTION_ORDER.indexOf(sectionOf(b.partIds[0])) || a.y - b.y);
  return out;
}

export interface PlaceLabelsOptions {
  /** minimum distance between label centers on a side; default LABEL_MIN_GAP */
  minGap?: number;
  /** px kept free at the bottom (e.g. for an export caption) */
  bottomInset?: number;
}

/** Column placement with collision avoidance, and leader lines that bend once. */
export function placeLabels(labels: StageLabel[], w: number, h: number, options: PlaceLabelsOptions = {}): PlacedLabel[] {
  if (!w || !h) return [];
  const minGap = options.minGap ?? LABEL_MIN_GAP;
  const bottom = h - 30 - (options.bottomInset ?? 0);
  const margin = w * 0.045;
  const out: PlacedLabel[] = [];
  for (const side of ["left", "right", "top"] as const) {
    const col = labels.filter((l) => l.side === side).sort((a, b) => a.y - b.y);
    if (side === "top") {
      col.forEach((l, i) => {
        const lx = w * l.x + (i - (col.length - 1) / 2) * LABEL_TOP_SPACING;
        const ly = h * 0.07;
        out.push({ ...l, lx, ly, line: [[lx, ly + 24], [lx, h * l.y - h * 0.05]] });
      });
      continue;
    }
    // spread vertically so labels don't overlap
    const ys = col.map((l) => h * l.y);
    for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1] + minGap) ys[i] = ys[i - 1] + minGap;
    for (let i = ys.length - 1; i >= 0; i--) {
      const limit = bottom - (ys.length - 1 - i) * minGap;
      if (ys[i] > limit) ys[i] = limit;
    }
    for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1] + minGap) ys[i] = ys[i - 1] + minGap;
    col.forEach((l, i) => {
      const ly = ys[i];
      const bx = w * l.x;
      const by = h * l.y;
      const lx = side === "left" ? margin : w - margin;
      const labelW = labelWidthEstimate(l.text);
      const start: [number, number] = side === "left" ? [lx + labelW + 8, ly] : [lx - labelW - 8, ly];
      const reach = side === "left" ? bx - w * 0.07 : bx + w * 0.07;
      const bend: [number, number] = [
        side === "left" ? Math.max(start[0] + 8, reach - Math.abs(by - ly) * 0.9) : Math.min(start[0] - 8, reach + Math.abs(by - ly) * 0.9),
        ly,
      ];
      out.push({ ...l, lx, ly, line: [start, bend, [reach, by]] });
    });
  }
  return out;
}

export function labelWidthEstimate(text: string): number {
  return Math.min(120, Math.max(60, text.length * 7.2));
}

/* ------------------------------------------------------------------ */
/* Canvas drawing (export)                                              */
/* ------------------------------------------------------------------ */

/** Fonts and colors for canvas labels, resolved from the app's CSS tokens. */
export interface LabelStyle {
  /** font-family list for UI text (Inter) */
  sans: string;
  /** font-family list for serif text (Lora) */
  serif: string;
  /** true when "Bravura Text" has loaded; otherwise dynamics are drawn as Lora italic letters */
  bravura: boolean;
  /** label text color (--stage-text-2) */
  text: string;
  /** strong caption text (--stage-text) */
  textStrong: string;
  /** conductor caption color (--stage-text-3) */
  textMuted: string;
}

/**
 * Used only when no app stylesheet is present (tests, headless harnesses).
 * Mirrors the stage tokens in src/app/globals.css.
 */
export const FALLBACK_LABEL_STYLE: LabelStyle = {
  sans: "Inter, ui-sans-serif, system-ui, sans-serif",
  serif: "Lora, 'Iowan Old Style', Georgia, serif",
  bravura: false,
  text: "rgba(236, 230, 218, 0.62)",
  textStrong: "#ece6da",
  textMuted: "rgba(236, 230, 218, 0.38)",
};

/** Read the stage tokens (--stage-text*, --font-inter, --font-lora) and whether Bravura Text is loaded. */
export function resolveLabelStyle(root?: Element): LabelStyle {
  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") return FALLBACK_LABEL_STYLE;
  const el = root ?? document.documentElement;
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const inter = v("--font-inter");
  const lora = v("--font-lora");
  return {
    sans: inter ? `${inter}, ui-sans-serif, system-ui, sans-serif` : FALLBACK_LABEL_STYLE.sans,
    serif: lora ? `${lora}, 'Iowan Old Style', Georgia, serif` : FALLBACK_LABEL_STYLE.serif,
    bravura: isBravuraLoaded(),
    text: v("--stage-text-2") || FALLBACK_LABEL_STYLE.text,
    textStrong: v("--stage-text") || FALLBACK_LABEL_STYLE.textStrong,
    textMuted: v("--stage-text-3") || FALLBACK_LABEL_STYLE.textMuted,
  };
}

export function isBravuraLoaded(): boolean {
  if (typeof document === "undefined" || !document.fonts) return false;
  let loaded = false;
  document.fonts.forEach((f) => {
    if (f.family.replace(/["']/g, "") === "Bravura Text" && f.status === "loaded") loaded = true;
  });
  return loaded;
}

/** All dynamic glyphs, for document.fonts.load(…, text) so the unicode-range face is fetched. */
export const BRAVURA_SAMPLE = Object.values(BRAVURA_DYNAMICS).join("");

export interface DrawLabelsOptions {
  /** logical stage size in px; the caller sets the device-pixel transform */
  width: number;
  height: number;
  showConductor: boolean;
  style?: LabelStyle;
}

type LabelCtx = Pick<
  CanvasRenderingContext2D,
  | "save"
  | "restore"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "stroke"
  | "fillText"
  | "measureText"
  | "font"
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "globalAlpha"
  | "textAlign"
  | "textBaseline"
>;

/**
 * Draw leader lines, uppercase names and the current dynamic for each placed
 * label, plus the "Conductor" caption, onto a 2D canvas. Geometry matches the
 * DOM overlay in Stage.tsx: name 10px semibold uppercase, dynamic 19px below.
 */
export function drawLabels(ctx: LabelCtx, layout: PlacedLabel[], options: DrawLabelsOptions): void {
  const style = options.style ?? FALLBACK_LABEL_STYLE;
  const m = LABEL_METRICS;
  const blockH = m.textSize + m.dynGap + m.dynSize;
  ctx.save();

  // leader lines
  ctx.lineWidth = 1;
  for (const l of layout) {
    if (l.line.length < 2) continue;
    ctx.globalAlpha = clamp01(0.25 + l.level * 0.5);
    ctx.strokeStyle = l.color;
    ctx.beginPath();
    ctx.moveTo(l.line[0][0], l.line[0][1]);
    for (let i = 1; i < l.line.length; i++) ctx.lineTo(l.line[i][0], l.line[i][1]);
    ctx.stroke();
  }

  // text blocks
  ctx.textBaseline = "top";
  for (const l of layout) {
    ctx.globalAlpha = clamp01(0.4 + l.level * 0.6);
    ctx.textAlign = l.side === "right" ? "right" : l.side === "top" ? "center" : "left";
    const top = l.side === "top" ? l.ly : l.ly - blockH / 2;
    ctx.font = `600 ${m.textSize}px ${style.sans}`;
    ctx.fillStyle = style.text;
    withTracking(ctx, m.tracking, () => ctx.fillText(l.text.toUpperCase(), l.lx, top));
    ctx.fillStyle = l.color;
    const dynTop = top + m.textSize + m.dynGap;
    if (style.bravura) {
      ctx.font = `${m.dynSize}px "Bravura Text"`;
      ctx.fillText(BRAVURA_DYNAMICS[l.dynamic], l.lx, dynTop);
    } else {
      ctx.font = `italic 600 ${m.dynSize}px ${style.serif}`;
      ctx.fillText(l.dynamic, l.lx, dynTop);
    }
  }

  if (options.showConductor) {
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = `600 ${m.conductorSize}px ${style.sans}`;
    ctx.fillStyle = style.textMuted;
    withTracking(ctx, m.conductorTracking, () => ctx.fillText("CONDUCTOR", options.width / 2, options.height * 0.975));
  }
  ctx.restore();
}

/** Bottom-left caption for exported video: "Title · bar N of M". */
export function drawCaption(
  ctx: LabelCtx,
  caption: { title: string; detail: string },
  options: { width: number; height: number; style?: LabelStyle },
): void {
  const style = options.style ?? FALLBACK_LABEL_STYLE;
  const x = options.width * 0.045;
  const y = options.height - options.height * 0.025;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.font = `600 13px ${style.serif}`;
  ctx.fillStyle = style.textStrong;
  const title = caption.title.trim();
  ctx.fillText(title, x, y);
  const titleW = title ? ctx.measureText(title).width : 0;
  ctx.font = `500 12px ${style.sans}`;
  ctx.fillStyle = style.text;
  ctx.fillText(title ? `  ·  ${caption.detail}` : caption.detail, x + titleW, y);
  ctx.restore();
}

function withTracking(ctx: LabelCtx, px: number, draw: () => void) {
  const c = ctx as LabelCtx & { letterSpacing?: string };
  if (typeof c.letterSpacing !== "string") {
    draw();
    return;
  }
  const prev = c.letterSpacing;
  c.letterSpacing = `${px}px`;
  draw();
  c.letterSpacing = prev;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
