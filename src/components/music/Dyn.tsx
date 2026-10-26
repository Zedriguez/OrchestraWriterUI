import { BRAVURA_DYNAMICS, DYNAMIC_LABELS, type Dynamic } from "@/shared/dynamics";
import { cx } from "@/lib/utils/format";

/**
 * A written dynamic (pp–fff) in Bravura Text. The Lora-italic fallback is
 * typographically close when the music font has not loaded yet.
 */
export function Dyn({ value, className, size = "md", style }: { value: Dynamic; className?: string; size?: "sm" | "md" | "lg" | "xl"; style?: React.CSSProperties }) {
  const s = size === "sm" ? "text-[15px]" : size === "lg" ? "text-[26px]" : size === "xl" ? "text-[34px]" : "text-[19px]";
  return (
    <span className={cx("music inline-block align-baseline", s, className)} style={style} aria-label={DYNAMIC_LABELS[value]} title={DYNAMIC_LABELS[value]}>
      <span className="bravura" aria-hidden>
        {BRAVURA_DYNAMICS[value]}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
