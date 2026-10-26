import type { Dynamic } from "@/shared/dynamics";

/** One glow to draw. Coordinates are normalized 0–1 on the stage. */
export interface GlowSprite {
  id: string;
  x: number;
  y: number;
  /** half-width / half-height as a fraction of stage width */
  rx: number;
  ry: number;
  /** radians; elongation direction */
  angle: number;
  /** hex color */
  color: string;
  /** brightness 0–1 (luminance, not alpha) */
  level: number;
  dynamic: Dynamic;
  selected?: boolean;
}

export interface RenderScene {
  sprites: GlowSprite[];
  showSeating: boolean;
  showConductor: boolean;
  /** 0.6–1.4 */
  glowScale: number;
}

/**
 * The one renderer interface. Preview, Customize, auth demo and MP4 export all
 * call `render(scene)`. Swap the implementation (PixiJS, Three, headless
 * canvas on AWS) without touching the pages.
 */
export interface GlowRenderer {
  mount(canvas: HTMLCanvasElement): void;
  resize(width: number, height: number, dpr: number): void;
  render(scene: RenderScene): void;
  destroy(): void;
}
