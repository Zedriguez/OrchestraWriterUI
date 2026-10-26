import Link from "next/link";
import { cx } from "@/lib/utils/format";

/** Three nested arcs over a conductor's point — the seating plan as a mark. */
export function LogoMark({ size = 26, className, onStage }: { size?: number; className?: string; onStage?: boolean }) {
  const stroke = onStage ? "var(--brass-2)" : "var(--brass)";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <path d="M5 23a11 11 0 0 1 22 0" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      <path d="M9 23a7 7 0 0 1 14 0" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <path d="M13 23a3 3 0 0 1 6 0" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="26.5" r="1.6" fill={stroke} />
    </svg>
  );
}

export function Logo({ href = "/library", onStage, compact, className }: { href?: string; onStage?: boolean; compact?: boolean; className?: string }) {
  return (
    <Link href={href} className={cx("inline-flex items-center gap-2.5 group", className)} aria-label="Orchestra Visualizer home">
      <LogoMark onStage={onStage} />
      {!compact && (
        <span className={cx("hidden sm:inline whitespace-nowrap font-serif text-[19px] tracking-[-0.01em]", onStage ? "text-stage-text" : "text-ink")}>
          Orchestra Visualizer
        </span>
      )}
    </Link>
  );
}
