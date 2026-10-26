"use client";

import { cx } from "@/lib/utils/format";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

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
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx(
        "inline-flex items-center rounded-full p-0.5",
        onStage ? "bg-white/10" : "bg-paper-3",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              "rounded-full font-medium transition-colors disabled:opacity-40",
              size === "sm" ? "h-7 px-3 text-[12px]" : "h-8 px-3.5 text-[13px]",
              active
                ? onStage
                  ? "bg-white/15 text-stage-text shadow-sm"
                  : "bg-paper-2 text-ink shadow-sm"
                : onStage
                  ? "text-stage-text-2 hover:text-stage-text"
                  : "text-ink-3 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
