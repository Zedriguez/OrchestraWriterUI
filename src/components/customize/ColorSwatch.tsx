"use client";

import { cx } from "@/lib/utils/format";

/** Native color input dressed as a round swatch. */
export function ColorSwatch({ value, onChange, size = "md", label, className }: { value: string; onChange: (hex: string) => void; size?: "sm" | "md" | "lg"; label: string; className?: string }) {
  const s = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-9 w-9" : "h-6 w-6";
  return (
    <span className={cx("relative inline-flex shrink-0 rounded-full ring-1 ring-black/10 shadow-sm", s, className)} style={{ background: value }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}
