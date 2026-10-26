"use client";

import { Progress as RadixProgress } from "radix-ui";
import { cx } from "@/lib/utils/format";

const fills = {
  brass: "brass-gradient",
  ink: "bg-ink",
  ok: "bg-ok",
  danger: "bg-danger",
} as const;

/** Thin progress bar (Radix Progress). `value` is 0–1. */
export function Progress({
  value,
  className,
  tone = "brass",
  indeterminate,
  ariaLabel,
}: {
  /** 0–1 */
  value: number;
  className?: string;
  tone?: keyof typeof fills;
  /** progress is unknown; the bar shimmers and no percentage is announced */
  indeterminate?: boolean;
  /** what is progressing, e.g. "Rendering video" */
  ariaLabel?: string;
}) {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <RadixProgress.Root
      value={indeterminate ? null : Math.round(clamped * 100)}
      max={100}
      aria-label={ariaLabel}
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-paper-4", className)}
    >
      <RadixProgress.Indicator
        className={cx("h-full rounded-full transition-[width] duration-300 ease-out", fills[tone], indeterminate && "shimmer")}
        style={{ width: `${clamped * 100}%` }}
      />
    </RadixProgress.Root>
  );
}
