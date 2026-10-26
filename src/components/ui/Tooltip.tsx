import type { ReactNode } from "react";

/** Lightweight CSS tooltip. Content must be short. */
export function Tooltip({ label, children, side = "top" }: { label: string; children: ReactNode; side?: "top" | "bottom" }) {
  return (
    <span className="relative inline-flex group/tip">
      {children}
      <span
        role="tooltip"
        className={
          "pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-paper opacity-0 shadow-md transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 " +
          (side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5")
        }
      >
        {label}
      </span>
    </span>
  );
}
