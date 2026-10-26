import { hexToRgb } from "@/lib/utils/color";
import { CONDUCTOR } from "./seating";
import type { GlowRenderer, GlowSprite, RenderScene } from "./renderer";

/**
 * Canvas 2D implementation: additive radial gradients drawn at quarter
 * resolution with a blur pass, composited over a vignetted stage.
 * Brightness is applied as luminance (color → warm white) so overlapping
 * glows don't wash out, and the budget holds 64 parts at 60 fps.
 */
export interface Canvas2DGlowRendererOptions {
  /**
   * Upper bound on the device-pixel ratio. Preview keeps the default 2;
   * MP4 export renders a 1280×720 logical stage at up to 3× (4K).
   */
  maxDpr?: number;
}

export class Canvas2DGlowRenderer implements GlowRenderer {
  private readonly maxDpr: number;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private low: HTMLCanvasElement | null = null;
  private lowCtx: CanvasRenderingContext2D | null = null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private bg: CanvasGradient | null = null;
  private readonly downscale = 0.3;

  constructor(options: Canvas2DGlowRendererOptions = {}) {
    this.maxDpr = options.maxDpr ?? 2;
  }

  mount(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.low = document.createElement("canvas");
    this.lowCtx = this.low.getContext("2d");
  }

  resize(width: number, height: number, dpr: number) {
    if (!this.canvas || !this.low) return;
    this.w = Math.max(1, Math.floor(width));
    this.h = Math.max(1, Math.floor(height));
    this.dpr = Math.min(this.maxDpr, dpr);
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.low.width = Math.max(1, Math.floor(this.w * this.downscale));
    this.low.height = Math.max(1, Math.floor(this.h * this.downscale));
    this.bg = null;
  }

  render(scene: RenderScene) {
    const ctx = this.ctx;
    const low = this.lowCtx;
    if (!ctx || !low || !this.canvas || !this.low) return;
    const { w, h, dpr } = this;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";

    // stage background
    if (!this.bg) {
      const g = ctx.createRadialGradient(w * 0.5, h * 0.95, h * 0.1, w * 0.5, h * 0.6, Math.max(w, h) * 0.85);
      g.addColorStop(0, "#161b22");
      g.addColorStop(0.55, "#0e1217");
      g.addColorStop(1, "#070a0d");
      this.bg = g;
    }
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, w, h);

    if (scene.showSeating) this.drawSeating(ctx);

    // glows at low resolution, additive
    const lw = this.low.width;
    const lh = this.low.height;
    low.setTransform(1, 0, 0, 1, 0, 0);
    low.globalCompositeOperation = "source-over";
    low.clearRect(0, 0, lw, lh);
    low.globalCompositeOperation = "lighter";
    for (const s of scene.sprites) {
      if (s.level <= 0.002) continue;
      this.drawGlow(low, s, lw, lh, scene.glowScale);
    }

    ctx.globalCompositeOperation = "screen";
    const blurPx = Math.max(10, Math.min(w, h) * 0.035);
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(this.low, -blurPx, -blurPx, w + blurPx * 2, h + blurPx * 2);
    ctx.filter = "none";
    // a crisper second pass gives the cores some body
    ctx.globalAlpha = 0.55;
    ctx.drawImage(this.low, 0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // selection rings (Customize)
    for (const s of scene.sprites) {
      if (!s.selected) continue;
      ctx.beginPath();
      ctx.ellipse(s.x * w, s.y * h, s.rx * w * scene.glowScale * 0.9, s.ry * w * scene.glowScale * 0.6, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // vignette
    const v = ctx.createRadialGradient(w * 0.5, h * 0.55, Math.min(w, h) * 0.35, w * 0.5, h * 0.55, Math.max(w, h) * 0.78);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);

    if (scene.showConductor) this.drawConductor(ctx);
  }

  destroy() {
    this.canvas = null;
    this.ctx = null;
    this.low = null;
    this.lowCtx = null;
  }

  private drawSeating(ctx: CanvasRenderingContext2D) {
    const { w, h } = this;
    const cx = CONDUCTOR.x * w;
    const cy = CONDUCTOR.y * h;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (const r of [0.3, 0.46, 0.58, 0.72]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * w, r * w * (16 / 9) * 0.78, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    }
    // radial spokes
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    for (const a of [-1.1, -0.55, 0, 0.55, 1.1]) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(a) * 0.12 * w, cy - Math.cos(a) * 0.12 * w * 1.38);
      ctx.lineTo(cx + Math.sin(a) * 0.8 * w, cy - Math.cos(a) * 0.8 * w * 1.38);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawConductor(ctx: CanvasRenderingContext2D) {
    const { w, h } = this;
    const x = CONDUCTOR.x * w;
    const y = CONDUCTOR.y * h;
    const r = Math.max(6, Math.min(w, h) * 0.018);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private drawGlow(ctx: CanvasRenderingContext2D, s: GlowSprite, lw: number, lh: number, glowScale: number) {
    const [r, g, b] = hexToRgb(s.color);
    const lvl = Math.max(0, Math.min(1, s.level));
    // luminance ramp: color stays saturated at pp and warms toward white at fff
    const whiten = lvl * lvl * 0.55;
    const rr = r + (255 - r) * whiten;
    const gg = g + (255 - g) * whiten;
    const bb = b + (255 - b) * whiten;
    const alpha = 0.18 + lvl * 0.82;
    const size = (0.78 + lvl * 0.42) * glowScale;
    const rx = Math.max(2, s.rx * lw * size);
    const ry = Math.max(2, s.ry * lw * size * 0.62);

    ctx.save();
    ctx.translate(s.x * lw, s.y * lh);
    ctx.rotate(s.angle);
    ctx.scale(rx, ry);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, `rgba(${rr | 0},${gg | 0},${bb | 0},${alpha})`);
    grad.addColorStop(0.42, `rgba(${r},${g},${b},${alpha * 0.55})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
