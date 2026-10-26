export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Mix two hex colors; t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Lighten toward white (used for tints within a section). */
export function tint(hex: string, amount: number): string {
  return mix(hex, "#ffffff", amount);
}

export function shade(hex: string, amount: number): string {
  return mix(hex, "#000000", amount);
}

/** Tints within a section so 64 parts stay distinguishable without extra hues. */
export function sectionTints(base: string, count: number): string[] {
  if (count <= 1) return [base];
  return Array.from({ length: count }, (_, i) => {
    const t = (i / (count - 1)) * 0.5 - 0.15; // -0.15 … +0.35
    return t < 0 ? shade(base, -t) : tint(base, t);
  });
}
