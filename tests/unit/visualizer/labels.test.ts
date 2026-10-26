import { describe, expect, it } from "vitest";
import { LABEL_MIN_GAP, computeLabels, drawLabels, placeLabels, type StageLabel } from "@/lib/visualizer/labels";
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
      style: { sans: "Inter", serif: "Lora", bravura: true, text: "#aaa", textStrong: "#fff", textMuted: "#777" },
    });
    const glyph = calls.find((c) => c.op === "fillText" && c.args[0] === BRAVURA_DYNAMICS.ff)!;
    expect(glyph.font).toContain("Bravura Text");
    expect(glyph.fillStyle).toBe(display.sectionColors.Woodwinds);
    expect(calls.some((c) => c.op === "fillText" && c.args[0] === "CONDUCTOR")).toBe(false);
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
