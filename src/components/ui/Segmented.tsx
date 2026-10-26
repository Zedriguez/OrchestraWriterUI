"use client";

import { ToggleGroup } from "radix-ui";
import { cx } from "@/lib/utils/format";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * Pick one of a few options (Radix ToggleGroup, single). Renders a radiogroup
 * of radios; arrow keys move between options, Space/Enter selects. One option
 * is always selected: clicking the active one does nothing.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  onStage,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  className?: string;
  onStage?: boolean;
  ariaLabel?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      orientation="horizontal"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
      aria-label={ariaLabel}
      className={cx("inline-flex items-center rounded-full p-0.5", onStage ? "bg-white/10" : "bg-paper-3", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cx(
            "focus-round relative rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            // sm keeps its 28 px look; ::before grows the hit area to 32 px
            size === "sm" ? "h-7 px-3 text-[12px] before:absolute before:inset-x-0 before:-inset-y-0.5" : "h-8 px-3.5 text-[13px]",
            o.value === value ? (onStage ? "bg-white/15 text-stage-text shadow-sm" : "bg-paper-2 text-ink shadow-sm") : onStage ? "text-stage-text-2 hover:text-stage-text" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
