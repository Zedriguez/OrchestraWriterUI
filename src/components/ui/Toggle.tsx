"use client";

import { useId } from "react";
import { Switch } from "radix-ui";
import { cx } from "@/lib/utils/format";

const sizes = {
  // the ::before extends the hit area to 34 px without changing the look
  sm: { track: "h-4.5 w-8 before:-inset-y-2", thumb: "h-3.5 w-3.5", travel: "translate-x-3" },
  md: { track: "h-5.5 w-10 before:-inset-y-1.5", thumb: "h-4 w-4", travel: "translate-x-4.5" },
} as const;

/** On/off switch (Radix Switch). With `label`, the whole row is clickable. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  size = "md",
  className,
  onStage,
  ariaLabel,
  id,
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
  /** accessible name when there is no visible `label` */
  ariaLabel?: string;
  id?: string;
}) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const descriptionId = `${uid}-description`;
  const s = sizes[size];

  const control = (
    <Switch.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label ? undefined : ariaLabel}
      aria-labelledby={label ? labelId : undefined}
      aria-describedby={label && description ? descriptionId : undefined}
      className={cx(
        "focus-round relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 before:absolute before:inset-x-0 disabled:cursor-not-allowed disabled:opacity-40",
        s.track,
        checked ? "brass-gradient" : onStage ? "bg-white/15" : "bg-paper-4",
      )}
    >
      <Switch.Thumb
        className={cx(
          "absolute left-0.75 rounded-full bg-white shadow-sm transition-transform duration-200 ease-spring",
          s.thumb,
          checked && s.travel,
        )}
      />
    </Switch.Root>
  );

  if (!label) return control;
  return (
    <label className={cx("flex items-center justify-between gap-4", disabled ? "cursor-not-allowed" : "cursor-pointer", className)}>
      <span className="min-w-0">
        <span id={labelId} className={cx("block text-sm", onStage ? "text-stage-text" : "text-ink")}>
          {label}
        </span>
        {description && (
          <span id={descriptionId} className={cx("mt-0.5 block text-xs", onStage ? "text-stage-text-2" : "text-ink-3")}>
            {description}
          </span>
        )}
      </span>
      {control}
    </label>
  );
}
