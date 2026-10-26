"use client";

import { Slider as RadixSlider } from "radix-ui";
import { cx } from "@/lib/utils/format";

/**
 * Single-value slider (Radix). Arrow keys step, Page Up/Down step ×10,
 * Home/End jump. `formatValue` gives screen readers a readable value
 * ("110%") instead of the raw number.
 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step,
  ariaLabel,
  onStage,
  disabled,
  className,
  formatValue,
  onCommit,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  ariaLabel: string;
  onStage?: boolean;
  disabled?: boolean;
  className?: string;
  formatValue?: (value: number) => string;
  /** fires once when the user releases the thumb or presses a key */
  onCommit?: (value: number) => void;
}) {
  return (
    <RadixSlider.Root
      value={[value]}
      onValueChange={(next) => onChange(next[0])}
      onValueCommit={onCommit ? (next) => onCommit(next[0]) : undefined}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cx("relative flex h-8 w-full touch-none select-none items-center data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45", className)}
    >
      <RadixSlider.Track className={cx("relative h-1.5 grow overflow-hidden rounded-full", onStage ? "bg-white/15" : "bg-paper-4")}>
        <RadixSlider.Range className="brass-gradient absolute h-full rounded-full" />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        aria-label={ariaLabel}
        aria-valuetext={formatValue?.(value)}
        className="focus-round block h-4 w-4 cursor-grab rounded-full border-2 border-brass bg-white shadow-sm transition-transform duration-150 ease-out hover:scale-110 active:cursor-grabbing"
      />
    </RadixSlider.Root>
  );
}
