import { describe, expect, it } from "vitest";
import {
  LABEL_BLOCK_HEIGHT,
  LABEL_MIN_GAP,
  LABEL_TOP_INSET,
  LEGEND_METRICS,
  computeLabels,
  drawLabels,
  drawLegend,
  labelWidthEstimate,
  legendBounds,
  placeLabels,
  visibleSections,
  type StageLabel,
} from "@/lib/visualizer/labels";
import { hexToRgb } from "@/lib/utils/color";
import { BRAVURA_DYNAMICS, type Dynamic } from "@/shared/dynamics";
import type { InfoMap, Instrument } from "@/shared/info-map";
import type { DisplaySettings } from "@/shared/project-file";
import type { Section } from "@/shared/sections";

function inst(id: string, name: string, section: Section): Instrument {
  return { id, name, shortName: name, section, notes: [] };
}

const infoMap: InfoMap = {
  instruments: [
    inst("P1", "Violin I", "Strings"),
    inst("P2", "Cello", "Strings"),
    inst("P3", "Flute", "Woodwinds"),
    inst("P4", "Oboe", "Woodwinds"),
    inst("P5", "Timpani", "Percussion"),
    inst("P6", "Cymbals", "Percussion"),
  ],
  measures: [{ number: 1, startTime: 0, duration: 2 }],
  duration: 2,
  tempo: 120,
  timeSignature: "4/4",
  warnings: [],
};

const display: DisplaySettings = {
  visibleParts: ["P1", "P2", "P3", "P4", "P5", "P6"],
  positions: {
    P1: { x: 0.2, y: 0.7 },
    P2: { x: 0.8, y: 0.7 },
    P3: { x: 0.45, y: 0.45 },
    P4: { x: 0.55, y: 0.45 },
    P5: { x: 0.4, y: 0.15 },
    P6: { x: 0.6, y: 0.15 },
  },
  colors: { P1: "#ff0000" },
  sectionColors: { Strings: "#e2b04c", Woodwinds: "#5cba9a", Brass: "#e8705e", Percussion: "#9298e0", Other: "#c98bc9" },
  sections: {},
  showLabels: true,
  labelMode: "sections",
  reducedMotion: false,
  glowScale: 1,
};

const parts = [
  { id: "P1", playing: true, dynamic: "f" as Dynamic, level: 0.74 },
  { id: "P2", playing: false, dynamic: "p" as Dynamic, level: 0 },
  { id: "P3", playing: true, dynamic: "mp" as Dynamic, level: 0.47 },
  { id: "P4", playing: true, dynamic: "ff" as Dynamic, level: 0.88 },
  { id: "P5", playing: false, dynamic: "mf" as Dynamic, level: 0 },
  { id: "P6", playing: true, dynamic: "pp" as Dynamic, level: 0.22 },
];

describe("computeLabels", () => {
  it("labels strings per part and other sections as a group with their loudest dynamic", () => {
    const labels = computeLabels(infoMap, display, parts, "sections");
    expect(labels.map((l) => l.text)).toEqual(["Violin I", "Cello", "Woodwinds", "Percussion"]);
    const ww = labels.find((l) => l.text === "Woodwinds")!;
    expect(ww.dynamic).toBe("ff");
    expect(ww.partIds).toEqual(["P3", "P4"]);
    expect(ww.color).toBe(display.sectionColors.Woodwinds);
    expect(ww.level).toBeCloseTo(0.88);
    expect(labels.find((l) => l.text === "Violin I")!.color).toBe("#ff0000");
    expect(labels.find((l) => l.text === "Percussion")!.side).toBe("top");
    expect(labels.find((l) => l.text === "Violin I")!.side).toBe("left");
    expect(labels.find((l) => l.text === "Cello")!.side).toBe("right");
  });

  it("labels every part in parts mode and skips hidden parts", () => {
    const labels = computeLabels(infoMap, { ...display, visibleParts: ["P1", "P3", "P4"] }, parts, "parts");
    expect(labels.map((l) => l.text)).toEqual(["Violin I", "Flute", "Oboe"]);
  });

  it("gives a group no dynamic while none of its parts is playing", () => {
    const labels = computeLabels(infoMap, display, parts, "sections");
    // Cello (P2) is silent; its last written dynamic (p) is not shown
    expect(labels.find((l) => l.text === "Cello")!.dynamic).toBeNull();
    const silentPerc = parts.map((p) => (p.id === "P6" ? { ...p, playing: false, level: 0 } : p));
    const perc = computeLabels(infoMap, display, silentPerc, "sections").find((l) => l.text === "Percussion")!;
    expect(perc.dynamic).toBeNull();
    expect(perc.level).toBe(0);
  });

  it("takes the loudest dynamic among the playing parts only", () => {
    // Timpani (mf) is silent, Cymbals (pp) plays: the group reads pp, not mf
    const perc = computeLabels(infoMap, display, parts, "sections").find((l) => l.text === "Percussion")!;
    expect(perc.dynamic).toBe("pp");
  });

  it("shows every visible part's dynamic at a mid level when previewing all (Customize, paused)", () => {
    const labels = computeLabels(infoMap, display, parts, "sections", true);
    expect(labels.find((l) => l.text === "Cello")!.dynamic).toBe("p");
    expect(labels.find((l) => l.text === "Percussion")!.dynamic).toBe("mf");
    expect(labels.every((l) => l.dynamic !== null && Math.abs(l.level - 0.55) < 1e-9)).toBe(true);
  });

  it("follows a user's section reassignment", () => {
    const labels = computeLabels(infoMap, { ...display, sections: { P3: "Brass", P4: "Brass" } }, parts, "sections");
    expect(labels.some((l) => l.text === "Brass" && l.partIds.length === 2)).toBe(true);
  });
});

describe("placeLabels", () => {
  function column(n: number, side: "left" | "right"): StageLabel[] {
    return Array.from({ length: n }, (_, i) => ({
      key: `${side}${i}`,
      text: `Part ${i}`,
      dynamic: "mf" as Dynamic,
      color: "#fff",
      x: side === "left" ? 0.3 : 0.7,
      // bunched together near the same height
      y: 0.5 + (i % 3) * 0.004,
      side,
      level: 0.5,
      partIds: [`${side}${i}`],
    }));
  }

  it("keeps labels on a side at least minGap apart", () => {
    const placed = placeLabels([...column(9, "left"), ...column(7, "right")], 1280, 720);
    for (const side of ["left", "right"] as const) {
      const ys = placed.filter((l) => l.side === side).map((l) => l.ly).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(LABEL_MIN_GAP - 1e-9);
    }
  });

  it("respects a custom minGap and keeps the bottom inset clear when there is room", () => {
    const placed = placeLabels(column(6, "left"), 1280, 720, { minGap: 60, bottomInset: 40 });
    const ys = placed.map((l) => l.ly).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(60 - 1e-9);
    expect(Math.max(...ys)).toBeLessThanOrEqual(720 - 30 - 40);
  });

  it("anchors left labels at the margin and right labels at the opposite margin, with a 3-point leader", () => {
    const placed = placeLabels([...column(1, "left"), ...column(1, "right")], 1000, 500);
    const l = placed.find((p) => p.side === "left")!;
    const r = placed.find((p) => p.side === "right")!;
    expect(l.lx).toBeCloseTo(45);
    expect(r.lx).toBeCloseTo(955);
    expect(l.line).toHaveLength(3);
    // the leader ends beside the glow, not on it
    expect(l.line[2][0]).toBeLessThan(1000 * 0.3);
    expect(r.line[2][0]).toBeGreaterThan(1000 * 0.7);
  });

  it("spreads top labels horizontally", () => {
    const tops: StageLabel[] = [0, 1, 2].map((i) => ({ key: `t${i}`, text: "Perc", dynamic: "p", color: "#fff", x: 0.5, y: 0.1, side: "top", level: 0, partIds: [] }));
    const placed = placeLabels(tops, 1280, 720);
    const xs = placed.map((p) => p.lx).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeGreaterThanOrEqual(100);
    expect(xs[2] - xs[1]).toBeGreaterThanOrEqual(100);
  });

  function topLabel(i: number, x: number, y: number, text = "Percussion"): StageLabel {
    return { key: `t${i}`, text, dynamic: "mf", color: "#fff", x, y, side: "top", level: 0.5, partIds: [`t${i}`] };
  }

  it("keeps the whole top label block inside the stage with the top inset, leader from its bottom to the glow", () => {
    for (const [w, h] of [
      [1280, 720],
      [640, 360],
      [420, 236],
    ]) {
      // percussion at the very back of the stage, as in the default seating
      const [l] = placeLabels([topLabel(0, 0.5, 0.03)], w, h);
      expect(l.ly).toBeGreaterThanOrEqual(LABEL_TOP_INSET);
      expect(l.ly + LABEL_BLOCK_HEIGHT).toBeLessThanOrEqual(h);
      const [start, end] = [l.line[0], l.line.at(-1)!];
      expect(start[0]).toBeCloseTo(l.lx);
      expect(start[1]).toBeGreaterThanOrEqual(l.ly + LABEL_BLOCK_HEIGHT);
      // never back up into the label, even when the glow sits level with it
      expect(end[1]).toBeGreaterThan(start[1]);
      expect(end[0]).toBeCloseTo(w * 0.5);
    }
    const [low] = placeLabels([topLabel(0, 0.4, 0.3)], 1280, 720);
    expect(low.line.at(-1)).toEqual([1280 * 0.4, 720 * 0.3 - 720 * 0.05]);
  });

  it("spreads top labels without overlapping each other or the side columns' x range", () => {
    const w = 1280;
    const sides = [...column(5, "left"), ...column(5, "right")].map((l, i) => ({ ...l, text: i % 2 ? "Double Bass III" : "Violin II", y: 0.05 + i * 0.01 }));
    // three top labels crowded toward the left edge
    const tops = [topLabel(0, 0.05, 0.05), topLabel(1, 0.08, 0.05, "Timpani"), topLabel(2, 0.1, 0.06)];
    const placed = placeLabels([...sides, ...tops], w, 720);
    const margin = w * 0.045;
    const leftEdge = margin + Math.max(...placed.filter((l) => l.side === "left").map((l) => labelWidthEstimate(l.text)));
    const rightEdge = w - margin - Math.max(...placed.filter((l) => l.side === "right").map((l) => labelWidthEstimate(l.text)));
    const boxes = placed
      .filter((l) => l.side === "top")
      .map((l) => [l.lx - labelWidthEstimate(l.text) / 2, l.lx + labelWidthEstimate(l.text) / 2])
      .sort((a, b) => a[0] - b[0]);
    expect(boxes).toHaveLength(3);
    for (const [a, b] of boxes) {
      expect(a).toBeGreaterThan(leftEdge);
      expect(b).toBeLessThan(rightEdge);
    }
    for (let i = 1; i < boxes.length; i++) expect(boxes[i][0]).toBeGreaterThan(boxes[i - 1][1]);
  });

  it("keeps a column that starts at the top edge below the top inset", () => {
    const col = column(4, "right").map((l, i) => ({ ...l, y: 0.01 + i * 0.002 }));
    const placed = placeLabels(col, 1280, 720);
    for (const l of placed) expect(l.ly - LABEL_BLOCK_HEIGHT / 2).toBeGreaterThanOrEqual(LABEL_TOP_INSET - 1e-9);
    const ys = placed.map((l) => l.ly).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(LABEL_MIN_GAP - 1e-9);
  });

  describe("dense parts mode", () => {
    // 24 string parts all seated left of center, plus a few on the right: one label each
    const dense: InfoMap = {
      ...infoMap,
      instruments: [
        ...Array.from({ length: 24 }, (_, i) => inst(`L${i}`, `Violin ${i + 1}`, "Strings")),
        ...Array.from({ length: 4 }, (_, i) => inst(`R${i}`, `Cello ${i + 1}`, "Strings")),
      ],
    };
    const denseDisplay: DisplaySettings = {
      ...display,
      labelMode: "parts",
      visibleParts: dense.instruments.map((i) => i.id),
      positions: Object.fromEntries(
        dense.instruments.map((p, i) => [p.id, p.id.startsWith("L") ? { x: 0.15 + (i % 4) * 0.08, y: 0.1 + (i % 6) * 0.12 } : { x: 0.8, y: 0.4 + i * 0.01 }]),
      ),
    };
    const denseParts = dense.instruments.map((p) => ({ id: p.id, playing: true, dynamic: "f" as Dynamic, level: 0.7 }));
    const labels = computeLabels(dense, denseDisplay, denseParts, "parts");

    function check(h: number, bottomInset: number) {
      const placed = placeLabels(labels, h * (16 / 9), h, { bottomInset });
      const left = placed.filter((l) => l.side === "left").map((l) => l.ly).sort((a, b) => a - b);
      expect(left).toHaveLength(24);
      expect(left[0] - LABEL_BLOCK_HEIGHT / 2).toBeGreaterThanOrEqual(LABEL_TOP_INSET - 1e-9);
      expect(left.at(-1)!).toBeLessThanOrEqual(h - 30 - bottomInset + 1e-9);
      const gaps = left.slice(1).map((y, i) => y - left[i]);
      return Math.min(...gaps);
    }

    it("squeezes 24 labels on one side to fit a 720-px stage, staying at least 28 px apart", () => {
      expect(check(720, 0)).toBeGreaterThanOrEqual(28);
    });

    it("stays within bounds when the floor no longer fits, spacing labels evenly instead of stacking them", () => {
      // export caption inset: 24 labels need 23 × 28 px but get a little less
      expect(check(720, 22)).toBeGreaterThan(27);
      // a small Customize stage: far too little room, but nothing leaves the stage or lands on another label
      expect(check(360, 0)).toBeGreaterThan(12);
    });
  });

  it("keeps the left column and top labels clear of a top-left box (the export legend)", () => {
    const box = { right: 230, bottom: 81 };
    const left = column(3, "left").map((l) => ({ ...l, y: 0.02 }));
    const top = { key: "t", text: "Percussion", dynamic: "mf" as Dynamic, color: "#fff", x: 0.05, y: 0.05, side: "top" as const, level: 1, partIds: [] };
    const right = column(2, "right").map((l) => ({ ...l, y: 0.02 }));
    const placed = placeLabels([...left, ...right, top], 1280, 720, { avoidTopLeft: box });
    for (const l of placed.filter((p) => p.side === "left")) expect(l.ly - LABEL_BLOCK_HEIGHT / 2).toBeGreaterThanOrEqual(box.bottom + 8 - 1e-9);
    // the right column is not affected
    expect(Math.min(...placed.filter((p) => p.side === "right").map((p) => p.ly))).toBeLessThan(box.bottom);
    const t = placed.find((p) => p.side === "top")!;
    expect(t.lx - labelWidthEstimate(t.text) / 2).toBeGreaterThan(box.right);
  });

  it("returns nothing for a zero-size stage", () => {
    expect(placeLabels(column(3, "left"), 0, 0)).toEqual([]);
  });
});

describe("drawLabels", () => {
  function fakeCtx() {
    const calls: Array<{ op: string; args: unknown[]; font?: string; fillStyle?: unknown; alpha?: number }> = [];
    const ctx = {
      font: "",
      fillStyle: "" as unknown,
      strokeStyle: "" as unknown,
      lineWidth: 1,
      globalAlpha: 1,
      textAlign: "left",
      textBaseline: "alphabetic",
      letterSpacing: "0px",
      save: () => calls.push({ op: "save", args: [] }),
      restore: () => calls.push({ op: "restore", args: [] }),
      beginPath: () => calls.push({ op: "beginPath", args: [] }),
      moveTo: (...a: unknown[]) => calls.push({ op: "moveTo", args: a }),
      lineTo: (...a: unknown[]) => calls.push({ op: "lineTo", args: a }),
      stroke: () => calls.push({ op: "stroke", args: [] }),
      measureText: (t: string) => ({ width: t.length * 6 }),
      fillText(...a: unknown[]) {
        calls.push({ op: "fillText", args: a, font: this.font, fillStyle: this.fillStyle, alpha: this.globalAlpha });
      },
    };
    return { ctx, calls };
  }

  const layout = placeLabels(computeLabels(infoMap, display, parts, "sections"), 1280, 720);

  it("draws a leader line, an uppercase name and the dynamic for each label, plus the conductor caption", () => {
    const { ctx, calls } = fakeCtx();
    drawLabels(ctx as never, layout, { width: 1280, height: 720, showConductor: true });
    const texts = calls.filter((c) => c.op === "fillText").map((c) => c.args[0]);
    expect(texts).toContain("VIOLIN I");
    expect(texts).toContain("WOODWINDS");
    expect(texts).toContain("CONDUCTOR");
    // fallback style (no Bravura loaded in node): dynamics drawn as Lora italic letters
    expect(texts).toContain("ff");
    expect(calls.filter((c) => c.op === "stroke")).toHaveLength(layout.length);
    expect(calls[0].op).toBe("save");
    expect(calls.at(-1)!.op).toBe("restore");
  });

  it("uses Bravura glyphs when the music font is loaded, in the label's color", () => {
    const { ctx, calls } = fakeCtx();
    drawLabels(ctx as never, layout, {
      width: 1280,
      height: 720,
      showConductor: false,
      style: { sans: "Inter", serif: "Lora", bravura: true, text: "#aaa", textStrong: "#fff", textMuted: "#777", accent: "#d7ae55" },
    });
    const glyph = calls.find((c) => c.op === "fillText" && c.args[0] === BRAVURA_DYNAMICS.ff)!;
    expect(glyph.font).toContain("Bravura Text");
    expect(glyph.fillStyle).toBe(display.sectionColors.Woodwinds);
    expect(calls.some((c) => c.op === "fillText" && c.args[0] === "CONDUCTOR")).toBe(false);
  });

  it("draws the name of a silent group without a dynamic glyph", () => {
    const { ctx, calls } = fakeCtx();
    drawLabels(ctx as never, layout, { width: 1280, height: 720, showConductor: false });
    const texts = calls.filter((c) => c.op === "fillText");
    expect(texts.some((c) => c.args[0] === "CELLO")).toBe(true);
    // Violin I (f), Woodwinds (ff), Percussion (pp) get glyphs; the silent Cello does not
    const glyphs = texts.filter((c) => String(c.font).startsWith("italic"));
    expect(glyphs.map((c) => c.args[0])).toEqual(["f", "ff", "pp"]);
  });

  it("dims quiet labels like the DOM overlay (opacity 0.4 + level × 0.6)", () => {
    const { ctx, calls } = fakeCtx();
    drawLabels(ctx as never, layout, { width: 1280, height: 720, showConductor: false });
    const cello = calls.find((c) => c.op === "fillText" && c.args[0] === "CELLO")!;
    const violin = calls.find((c) => c.op === "fillText" && c.args[0] === "VIOLIN I")!;
    expect(cello.alpha).toBeCloseTo(0.4);
    expect(violin.alpha).toBeCloseTo(0.4 + 0.74 * 0.6);
  });
});

describe("drawLegend", () => {
  function legendCtx() {
    const calls: Array<{ op: string; args: unknown[]; fillStyle?: unknown; font?: string }> = [];
    const ctx = {
      font: "",
      fillStyle: "" as unknown,
      strokeStyle: "" as unknown,
      lineWidth: 1,
      globalAlpha: 1,
      textAlign: "left",
      textBaseline: "alphabetic",
      letterSpacing: "0px",
      save: () => calls.push({ op: "save", args: [] }),
      restore: () => calls.push({ op: "restore", args: [] }),
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arcTo: () => {},
      closePath: () => {},
      stroke: () => calls.push({ op: "stroke", args: [] }),
      measureText: (t: string) => ({ width: t.length * 6 }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      arc(...a: unknown[]) {
        calls.push({ op: "arc", args: a });
      },
      fill() {
        calls.push({ op: "fill", args: [], fillStyle: this.fillStyle });
      },
      fillText(...a: unknown[]) {
        calls.push({ op: "fillText", args: a, fillStyle: this.fillStyle, font: this.font });
      },
    };
    return { ctx, calls };
  }

  const base = { width: 1280, height: 720, sectionColors: display.sectionColors, sectionsPresent: [] as never[] };

  it("draws the seven ladder dots dim to bright with their dynamics and the caption", () => {
    const { ctx, calls } = legendCtx();
    drawLegend(ctx as never, base);
    const dotIdx = calls.flatMap((c, i) => (c.op === "arc" && c.args[2] === LEGEND_METRICS.dot / 2 ? [i] : []));
    expect(dotIdx).toHaveLength(7);
    // each dot is filled right after its arc, brighter than the one before
    const fills = dotIdx.map((i) => calls[i + 1]);
    expect(fills.every((f) => f.op === "fill")).toBe(true);
    const lum = fills.map((f) => hexToRgb(String(f.fillStyle)).reduce((a, b) => a + b, 0));
    for (let i = 1; i < lum.length; i++) expect(lum[i]).toBeGreaterThan(lum[i - 1]);
    expect(fills.at(-1)!.fillStyle).toBe("#d7ae55");
    const texts = calls.filter((c) => c.op === "fillText").map((c) => c.args[0]);
    expect(texts).toEqual(["pp", "p", "mp", "mf", "f", "ff", "fff", "SOFTEST TO LOUDEST"]);
    // dots left to right in the top-left corner
    const xs = dotIdx.map((i) => calls[i].args[0] as number);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(xs[0]).toBeGreaterThan(LEGEND_METRICS.x);
    expect(calls[0].op).toBe("save");
    expect(calls.at(-1)!.op).toBe("restore");
  });

  it("adds a section color key under the ladder when asked", () => {
    const { ctx, calls } = legendCtx();
    const sections = visibleSections(infoMap, { ...display, visibleParts: ["P1", "P3", "P5"] });
    expect(sections).toEqual(["Strings", "Woodwinds", "Percussion"]);
    const box = drawLegend(ctx as never, { ...base, sectionsPresent: sections });
    const keyDots = calls.flatMap((c, i) => (c.op === "arc" && c.args[2] === LEGEND_METRICS.keyDot / 2 ? [calls[i + 1].fillStyle] : []));
    expect(keyDots).toEqual([display.sectionColors.Strings, display.sectionColors.Woodwinds, display.sectionColors.Percussion]);
    const texts = calls.filter((c) => c.op === "fillText").map((c) => c.args[0]);
    expect(texts.slice(-3)).toEqual(["STRINGS", "WOODWINDS", "PERCUSSION"]);
    // the key sits below the ladder, and the reported box covers both
    const ladderOnly = legendBounds(ctx as never, base);
    expect(box.height).toBeGreaterThan(ladderOnly.height + 3 * LEGEND_METRICS.keyRow);
    expect(box.x).toBe(LEGEND_METRICS.x);
  });

  it("follows a section reassignment and leaves hidden sections out of the key", () => {
    expect(visibleSections(infoMap, { ...display, visibleParts: ["P3", "P4"], sections: { P4: "Brass" } })).toEqual(["Woodwinds", "Brass"]);
  });

  it("uses Bravura glyphs when the music font is loaded", () => {
    const { ctx, calls } = legendCtx();
    drawLegend(ctx as never, { ...base, style: { sans: "Inter", serif: "Lora", bravura: true, text: "#aaa", textStrong: "#fff", textMuted: "#777", accent: "#ecc97a" } });
    const glyph = calls.find((c) => c.op === "fillText" && c.args[0] === BRAVURA_DYNAMICS.fff)!;
    expect(glyph.font).toContain("Bravura Text");
    expect(glyph.fillStyle).toBe("#fff");
  });

  it("skips a stage too small to hold it", () => {
    const { ctx, calls } = legendCtx();
    expect(drawLegend(ctx as never, { ...base, width: 120, height: 60 }).width).toBe(0);
    expect(calls.some((c) => c.op === "fillText")).toBe(false);
  });
});
