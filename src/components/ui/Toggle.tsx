"use client";

import { cx } from "@/lib/utils/format";

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  size = "md",
  className,
  onStage,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  /** render on the dark stage */
  onStage?: boolean;
}) {
  const w = size === "sm" ? "w-8 h-[18px]" : "w-10 h-[22px]";
  const knob = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const travel = size === "sm" ? "translate-x-[14px]" : "translate-x-[18px]";
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40",
        w,
        checked ? "brass-gradient" : onStage ? "bg-white/15" : "bg-paper-4",
      )}
    >
      <span
        className={cx(
          "absolute left-[3px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-spring)]",
          knob,
          checked && travel,
        )}
      />
    </button>
  );
  if (!label) return control;
  return (
    <label className={cx("flex items-center justify-between gap-4 cursor-pointer", className)}>
      <span className="min-w-0">
        <span className={cx("block text-sm", onStage ? "text-stage-text" : "text-ink")}>{label}</span>
        {description && <span className={cx("block text-xs mt-0.5", onStage ? "text-stage-text-2" : "text-ink-3")}>{description}</span>}
      </span>
      {control}
    </label>
  );
}
