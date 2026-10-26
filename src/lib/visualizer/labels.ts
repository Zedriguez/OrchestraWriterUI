import type { InfoMap } from "@/shared/info-map";
import type { DisplaySettings } from "@/shared/project-file";
import { BRAVURA_DYNAMICS, DYNAMICS, louder, type Dynamic } from "@/shared/dynamics";
import { SECTION_ORDER, type Section } from "@/shared/sections";
import { mix } from "@/lib/utils/color";
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
  /**
   * Loudest written dynamic among the group's playing parts; null when none
   * of them is playing (the name stays, dimmed, without a glyph).
   */
  dynamic: Dynamic | null;
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
/** Minimum horizontal distance between neighboring top (percussion) label centers, px. */
export const LABEL_TOP_SPACING = 110;
/** Free space between the stage's top edge and the highest label block, px. */
export const LABEL_TOP_INSET = 12;
/** Height of a label block (10 px name + 4 px gap + 19 px dynamic, rounded up for the DOM line box), px. */
export const LABEL_BLOCK_HEIGHT = 34;
/** Horizontal padding kept between a top label and its neighbors or the side columns, px. */
const TOP_LABEL_PAD = 16;

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
    out.push({ key, text, dynamic: dyn, color, x, y, side, level, partIds: g.ids });
  }
  // stable order: sections then y
  out.sort((a, b) => SECTION_ORDER.indexOf(sectionOf(a.partIds[0])) - SECTION_ORDER.indexOf(sectionOf(b.partIds[0])) || a.y - b.y);
  return out;
}

export interface PlaceLabelsOptions {
  /** preferred distance between label centers on a side; default LABEL_MIN_GAP */
  minGap?: number;
  /** px kept free at the bottom (e.g. for an export caption) */
  bottomInset?: number;
  /** a box in the top-left corner (e.g. the export legend) that labels must stay out of, px */
  avoidTopLeft?: { right: number; bottom: number };
}

/**
 * Column placement with collision avoidance, and leader lines that bend once.
 *
 * Left and right columns keep every block between LABEL_TOP_INSET and the
 * bottom limit. A column with more labels than fit at `minGap` is squeezed to
 * the largest even spacing that fits (about 28 px for 24 labels on a 720-px
 * stage) rather than letting clamped labels stack at one edge. Top
 * labels sit LABEL_TOP_INSET below the edge, spread horizontally between the
 * two columns, with a leader from the bottom of the block to the glow.
 */
export function placeLabels(labels: StageLabel[], w: number, h: number, options: PlaceLabelsOptions = {}): PlacedLabel[] {
  if (!w || !h) return [];
  const minGap = options.minGap ?? LABEL_MIN_GAP;
  const top = LABEL_TOP_INSET + LABEL_BLOCK_HEIGHT / 2;
  const bottom = Math.max(top, h - 30 - (options.bottomInset ?? 0));
  const margin = w * 0.045;
  const out: PlacedLabel[] = [];
  const colWidth = { left: 0, right: 0 };
  const avoid = options.avoidTopLeft;
  for (const side of ["left", "right"] as const) {
    const col = labels.filter((l) => l.side === side).sort((a, b) => a.y - b.y);
    if (col.length === 0) continue;
    colWidth[side] = Math.max(...col.map((l) => labelWidthEstimate(l.text)));
    // the left column starts below a top-left box (it shares the column's x range)
    const colTop = side === "left" && avoid && avoid.right > margin ? Math.max(top, avoid.bottom + 8 + LABEL_BLOCK_HEIGHT / 2) : top;
    const ys = spread(
      col.map((l) => h * l.y),
      colTop,
      bottom,
      col.map(() => minGap),
    );
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

  const tops = labels.filter((l) => l.side === "top").sort((a, b) => a.x - b.x);
  if (tops.length > 0) {
    const widths = tops.map((l) => labelWidthEstimate(l.text));
    // keep clear of the side columns' whole x range, not just the labels at the same height
    let left = colWidth.left ? margin + colWidth.left + TOP_LABEL_PAD : margin;
    if (avoid && avoid.bottom > LABEL_TOP_INSET) left = Math.max(left, avoid.right + TOP_LABEL_PAD);
    const right = colWidth.right ? w - margin - colWidth.right - TOP_LABEL_PAD : w - margin;
    const gaps = widths.map((wd, i) => (i === 0 ? 0 : Math.max(LABEL_TOP_SPACING, (widths[i - 1] + wd) / 2 + TOP_LABEL_PAD)));
    const xs = spread(
      tops.map((l) => w * l.x),
      left + widths[0] / 2,
      right - widths[widths.length - 1] / 2,
      gaps,
    );
    const ly = LABEL_TOP_INSET;
    const lineTop = ly + LABEL_BLOCK_HEIGHT + 4;
    tops.forEach((l, i) => {
      const lx = xs[i];
      // aim just above the glow center, but never back up into the label
      const end: [number, number] = [w * l.x, Math.max(lineTop + 6, h * l.y - h * 0.05)];
      out.push({ ...l, lx, ly, line: [[lx, lineTop], end] });
    });
  }
  return out;
}

/**
 * 1-D collision avoidance: move sorted positions apart by at least gaps[i]
 * (distance from item i-1 to item i; gaps[0] is ignored) while keeping them
 * within [lo, hi]. When the gaps don't fit, they shrink proportionally until
 * they do, so a crowded run is spaced evenly instead of piling up at an edge.
 */
function spread(desired: number[], lo: number, hi: number, gaps: number[]): number[] {
  const n = desired.length;
  if (n === 0) return [];
  const hiC = Math.max(lo, hi);
  const room = hiC - lo;
  let g = gaps.map((v, i) => (i === 0 ? 0 : v));
  const need = g.reduce((a, b) => a + b, 0);
  if (need > room) g = g.map((v) => (v * room) / need);
  const out = desired.map((v) => Math.max(lo, Math.min(hiC, v)));
  for (let i = 1; i < n; i++) out[i] = Math.max(out[i], out[i - 1] + g[i]);
  let limit = hiC;
  for (let i = n - 1; i >= 0; i--) {
    out[i] = Math.min(out[i], limit);
    limit = out[i] - g[i];
  }
  return out;
}

/**
 * Width of a label name in px: uppercase, 10 px semibold, 0.18em tracking.
 * Per-character classes because wide capitals (W, M) and narrow ones (I)
 * differ by 2× at this size; within ~10 % of measureText for orchestra names.
 */
export function labelWidthEstimate(text: string): number {
  let px = 0;
  for (const ch of text.toUpperCase()) px += NARROW.test(ch) ? 5 : WIDE.test(ch) ? 11.5 : 9;
  return Math.min(150, Math.max(60, px));
}
const NARROW = /[I1.,:;'’()\-/ ]/;
const WIDE = /[MW]/;

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
  /** legend ladder accent (--brass-2) */
  accent: string;
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
  accent: "#d7ae55",
};

/** Read the stage tokens (--stage-text*, --brass-2, --font-inter, --font-lora) and whether Bravura Text is loaded. */
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
    accent: v("--brass-2") || FALLBACK_LABEL_STYLE.accent,
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
    // a silent group keeps its name (dimmed by level) and draws no glyph
    if (!l.dynamic) continue;
    ctx.fillStyle = l.color;
    const dynTop = top + m.textSize + m.dynGap;
    setDynFont(ctx, style, m.dynSize);
    ctx.fillText(dynGlyph(style, l.dynamic), l.lx, dynTop);
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

/* ------------------------------------------------------------------ */
/* Legend (export)                                                      */
/* ------------------------------------------------------------------ */

/** Logical px. Mirrors LadderDots (src/components/music/DynamicLegend.tsx) at left-4 top-4. */
export const LEGEND_METRICS = {
  x: 16,
  y: 16,
  padX: 14,
  padY: 8,
  radius: 16,
  dot: 12,
  /** gap-3 between the seven columns */
  colGap: 12,
  /** gap-1.5 between a dot and its glyph */
  dotGap: 6,
  dynSize: 15,
  captionGap: 6,
  captionSize: 9.5,
  captionTracking: 1.71,
  /** the section color key below the ladder */
  keyGap: 8,
  keyPadX: 12,
  keyPadY: 9,
  keyDot: 8,
  keyRow: 18,
  keyTextSize: 10,
  keyTracking: 1.8,
} as const;

/** .stage-glass in globals.css has no token yet; these mirror it. */
const GLASS_FILL = "rgba(10, 13, 17, 0.55)";
const GLASS_LINE = "rgba(255, 255, 255, 0.08)";
/** LadderDots mixes the accent with this dark brass: color-mix(in srgb, var(--brass-2) 30–100 %, #3a3221). */
const LADDER_DARK = "#3a3221";
const LEGEND_CAPTION = "SOFTEST TO LOUDEST";

export interface DrawLegendOptions {
  /** logical stage size in px; the caller sets the device-pixel transform */
  width: number;
  height: number;
  sectionColors: Record<Section, string>;
  /** sections listed in the color key, in display order; empty draws the ladder only */
  sectionsPresent: Section[];
  style?: LabelStyle;
}

export interface LegendBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

type LegendCtx = LabelCtx & Pick<CanvasRenderingContext2D, "arc" | "arcTo" | "closePath" | "fill" | "createRadialGradient">;

/** Sections that have at least one visible part, in seating order (for the export color key). */
export function visibleSections(infoMap: InfoMap, display: DisplaySettings): Section[] {
  const visible = new Set(display.visibleParts);
  const present = new Set<Section>();
  for (const inst of infoMap.instruments) if (visible.has(inst.id)) present.add(display.sections[inst.id] ?? inst.section);
  return SECTION_ORDER.filter((s) => present.has(s));
}

/** Where the legend (ladder plus optional key) lands, in logical px. Use it to keep labels clear. */
export function legendBounds(ctx: LegendCtx, options: DrawLegendOptions): LegendBox {
  return legendLayout(ctx, options).bounds;
}

/**
 * The pp → fff brightness ladder in the top-left corner (seven dots, dim to
 * bright, the dynamic below each, "Softest to loudest"), plus a section
 * color key under it when `sectionsPresent` is non-empty. Matches the
 * on-stage LadderDots so exported video carries a visible legend.
 */
export function drawLegend(ctx: LegendCtx, options: DrawLegendOptions): LegendBox {
  const style = options.style ?? FALLBACK_LABEL_STYLE;
  const m = LEGEND_METRICS;
  const lay = legendLayout(ctx, options);
  if (lay.bounds.width + m.x * 2 > options.width || lay.bounds.height + m.y * 2 > options.height) return { x: m.x, y: m.y, width: 0, height: 0 };
  ctx.save();
  ctx.globalAlpha = 1;

  // ladder panel
  glassPanel(ctx, m.x, m.y, lay.ladder.width, lay.ladder.height, m.radius);
  const dotY = m.y + m.padY + m.dot / 2;
  let cx = m.x + (lay.ladder.width - lay.rowWidth) / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  DYNAMICS.forEach((d, i) => {
    const t = i / (DYNAMICS.length - 1);
    const colW = lay.colWidths[i];
    const x = cx + colW / 2;
    // soft glow (box-shadow 0 0 4–16px in LadderDots)
    const reach = m.dot / 2 + 4 + t * 12;
    const glow = ctx.createRadialGradient(x, dotY, 0, x, dotY, reach);
    glow.addColorStop(0, withAlpha(style.accent, 0.1 + t * 0.6));
    glow.addColorStop(m.dot / 2 / reach, withAlpha(style.accent, (0.1 + t * 0.6) * 0.6));
    glow.addColorStop(1, withAlpha(style.accent, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, dotY, reach, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isHex(style.accent) ? mix(LADDER_DARK, style.accent, 0.3 + t * 0.7) : style.accent;
    ctx.beginPath();
    ctx.arc(x, dotY, m.dot / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = style.textStrong;
    setDynFont(ctx, style, m.dynSize);
    ctx.fillText(dynGlyph(style, d), x, dotY + m.dot / 2 + m.dotGap);
    cx += colW + m.colGap;
  });
  ctx.font = `600 ${m.captionSize}px ${style.sans}`;
  ctx.fillStyle = style.textMuted;
  withTracking(ctx, m.captionTracking, () => ctx.fillText(LEGEND_CAPTION, m.x + lay.ladder.width / 2, lay.captionTop));

  // section color key
  if (lay.key) {
    const k = lay.key;
    glassPanel(ctx, m.x, k.y, k.width, k.height, 12);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${m.keyTextSize}px ${style.sans}`;
    options.sectionsPresent.forEach((section, i) => {
      const y = k.y + m.keyPadY + m.keyRow * i + m.keyRow / 2;
      ctx.fillStyle = options.sectionColors[section];
      ctx.beginPath();
      ctx.arc(m.x + m.keyPadX + m.keyDot / 2, y, m.keyDot / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = style.text;
      withTracking(ctx, m.keyTracking, () => ctx.fillText(section.toUpperCase(), m.x + m.keyPadX + m.keyDot + 8, y));
    });
  }
  ctx.restore();
  return lay.bounds;
}

function legendLayout(ctx: LegendCtx, options: DrawLegendOptions) {
  const style = options.style ?? FALLBACK_LABEL_STYLE;
  const m = LEGEND_METRICS;
  ctx.save();
  setDynFont(ctx, style, m.dynSize);
  const colWidths = DYNAMICS.map((d) => Math.max(m.dot, ctx.measureText(dynGlyph(style, d)).width));
  ctx.font = `600 ${m.captionSize}px ${style.sans}`;
  const captionW = ctx.measureText(LEGEND_CAPTION).width + m.captionTracking * LEGEND_CAPTION.length;
  ctx.font = `600 ${m.keyTextSize}px ${style.sans}`;
  const keyTextW = Math.max(0, ...options.sectionsPresent.map((s) => ctx.measureText(s.toUpperCase()).width + m.keyTracking * s.length));
  ctx.restore();

  const rowWidth = colWidths.reduce((a, b) => a + b, 0) + m.colGap * (DYNAMICS.length - 1);
  const ladder = {
    width: Math.max(rowWidth, captionW) + m.padX * 2,
    height: m.padY * 2 + m.dot + m.dotGap + m.dynSize + m.captionGap + m.captionSize,
  };
  const captionTop = m.y + m.padY + m.dot + m.dotGap + m.dynSize + m.captionGap;
  const n = options.sectionsPresent.length;
  const key = n
    ? { y: m.y + ladder.height + m.keyGap, width: m.keyPadX * 2 + m.keyDot + 8 + keyTextW, height: m.keyPadY * 2 + m.keyRow * n }
    : null;
  const bounds: LegendBox = {
    x: m.x,
    y: m.y,
    width: Math.max(ladder.width, key?.width ?? 0),
    height: key ? key.y + key.height - m.y : ladder.height,
  };
  return { colWidths, rowWidth, ladder, captionTop, key, bounds };
}

function glassPanel(ctx: LegendCtx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fillStyle = GLASS_FILL;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = GLASS_LINE;
  ctx.stroke();
}

function setDynFont(ctx: LabelCtx, style: LabelStyle, size: number) {
  ctx.font = style.bravura ? `${size}px "Bravura Text"` : `italic 600 ${size}px ${style.serif}`;
}

function dynGlyph(style: LabelStyle, d: Dynamic) {
  return style.bravura ? BRAVURA_DYNAMICS[d] : d;
}

function isHex(c: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());
}

/** Accent at a given alpha; non-hex tokens fall back to the default brass. */
function withAlpha(c: string, a: number) {
  const hex = isHex(c) ? c.trim() : FALLBACK_LABEL_STYLE.accent;
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const n = parseInt(full.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
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
