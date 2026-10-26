import { afterEach, describe, expect, it, vi } from "vitest";
import { Canvas2DGlowRenderer, FALLBACK_STAGE_PALETTE, resolveStagePalette } from "@/lib/visualizer/canvas2d";

/** Minimal 2D context: records gradient stops and normalizes fillStyle like a browser does for the colors used here. */
function fakeContext() {
  const gradients: Array<Array<[number, string]>> = [];
  const strokes: Array<{ style: unknown; alpha: number }> = [];
  const ctx: Record<string, unknown> = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    filter: "none",
    lineWidth: 1,
    strokeStyle: "#000",
    _fill: "#000000" as unknown,
    get fillStyle() {
      return this._fill;
    },
    set fillStyle(v: unknown) {
      this._fill = typeof v === "string" ? v.replace(/\s+/g, "").replace(/,/g, ", ") : v;
    },
    createRadialGradient() {
      const stops: Array<[number, string]> = [];
      gradients.push(stops);
      return { addColorStop: (o: number, c: string) => stops.push([o, c]) };
    },
    stroke() {
      strokes.push({ style: ctx.strokeStyle, alpha: ctx.globalAlpha as number });
    },
  };
  const noop = () => {};
  for (const m of ["setTransform", "fillRect", "clearRect", "drawImage", "save", "restore", "beginPath", "ellipse", "moveTo", "lineTo", "arc", "fill", "setLineDash", "translate", "rotate", "scale"]) ctx[m] = noop;
  // save/restore must bring globalAlpha back for the seating test
  const stack: number[] = [];
  ctx.save = () => stack.push(ctx.globalAlpha as number);
  ctx.restore = () => (ctx.globalAlpha = stack.pop() ?? 1);
  return { ctx, gradients, strokes };
}

function stubDom(tokens: Record<string, string>) {
  const made: Array<ReturnType<typeof fakeContext>> = [];
  const canvas = () => {
    const c = fakeContext();
    made.push(c);
    return { width: 0, height: 0, getContext: () => c.ctx };
  };
  vi.stubGlobal("document", { documentElement: {}, createElement: canvas });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: (name: string) => tokens[name] ?? "" }));
  vi.stubGlobal("CSS", { supports: (_p: string, v: string) => !v.includes("nonsense") });
  return { canvas, made };
}

const scene = { sprites: [], showSeating: true, showConductor: false, glowScale: 1 };

afterEach(() => vi.unstubAllGlobals());

describe("stage palette", () => {
  it("falls back to the built-in colors without a DOM", () => {
    expect(resolveStagePalette()).toEqual(FALLBACK_STAGE_PALETTE);
  });

  it("reads --stage, --stage-2, --stage-3 and --stage-line, ignoring empty or invalid values", () => {
    stubDom({ "--stage": " #0b0e12 ", "--stage-2": "#12161c", "--stage-3": "nonsense", "--stage-line": "rgba(255, 255, 255, 0.08)" });
    expect(resolveStagePalette()).toEqual({
      ...FALLBACK_STAGE_PALETTE,
      edge: "#0b0e12",
      mid: "#12161c",
      line: "rgba(255, 255, 255, 0.08)",
    });
  });

  it("paints the background, vignette and seating from the tokens and re-reads them on resize", () => {
    const tokens: Record<string, string> = { "--stage": "#0b0e12", "--stage-2": "#12161c", "--stage-3": "#1a1f27", "--stage-line": "rgba(255, 255, 255, 0.08)" };
    const { canvas, made } = stubDom(tokens);
    const r = new Canvas2DGlowRenderer();
    const el = canvas();
    r.mount(el as never);
    r.resize(1280, 720, 1);
    r.render(scene);
    const main = made[0];
    const [bg, vignette] = main.gradients;
    expect(bg).toEqual([
      [0, "#1a1f27"],
      [0.55, "#12161c"],
      [1, "#0b0e12"],
    ]);
    // no token for the vignette yet: the shipped black at 55 %, faded from the same color at 0
    expect(vignette).toEqual([
      [0, "rgba(0, 0, 0, 0)"],
      [1, FALLBACK_STAGE_PALETTE.vignette],
    ]);
    // arcs at 0.05 and spokes at 0.035 effective alpha, as before
    const alphas = [...new Set(main.strokes.map((s) => +(s.alpha * 0.08).toFixed(4)))];
    expect(alphas).toEqual([0.05, 0.035]);
    expect(main.strokes.every((s) => s.style === tokens["--stage-line"])).toBe(true);

    // gradients are cached between frames…
    r.render(scene);
    expect(main.gradients).toHaveLength(2);
    // …and rebuilt from fresh tokens on resize (Direction B, or a token change)
    tokens["--stage"] = "#000000";
    tokens["--stage-vignette"] = "rgba(10, 20, 30, 0.4)";
    r.resize(1280, 720, 1);
    r.render(scene);
    expect(main.gradients[2].at(-1)).toEqual([1, "#000000"]);
    expect(main.gradients[3]).toEqual([
      [0, "rgba(10, 20, 30, 0)"],
      [1, "rgba(10, 20, 30, 0.4)"],
    ]);
  });
});
