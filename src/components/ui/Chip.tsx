import type { ReactNode } from "react";
import { cx } from "@/lib/utils/format";

export type ChipTone = "neutral" | "brass" | "ok" | "warn" | "danger" | "info" | "stage";

const tones: Record<ChipTone, string> = {
  neutral: "bg-paper-3 text-ink-2",
  brass: "bg-brass-soft text-brass-3",
  ok: "bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-[color-mix(in_srgb,var(--ok)_80%,var(--ink))]",
  warn: "bg-[color-mix(in_srgb,var(--warn)_16%,transparent)] text-[color-mix(in_srgb,var(--warn)_70%,var(--ink))]",
  danger: "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[color-mix(in_srgb,var(--danger)_85%,var(--ink))]",
  info: "bg-[color-mix(in_srgb,var(--info)_14%,transparent)] text-[color-mix(in_srgb,var(--info)_80%,var(--ink))]",
  stage: "bg-white/10 text-stage-text",
};

export function Chip({
  children,
  tone = "neutral",
  dot,
  className,
}: {
  children: ReactNode;
  tone?: ChipTone;
  dot?: string;
  className?: string;
}) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 h-6 text-[12px] font-medium leading-none", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} aria-hidden />}
      {children}
    </span>
  );
}
