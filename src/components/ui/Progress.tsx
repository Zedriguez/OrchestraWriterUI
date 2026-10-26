import { cx } from "@/lib/utils/format";

export function Progress({
  value,
  className,
  tone = "brass",
  indeterminate,
}: {
  /** 0–1 */
  value: number;
  className?: string;
  tone?: "brass" | "ink" | "ok" | "danger";
  indeterminate?: boolean;
}) {
  const fill =
    tone === "brass" ? "brass-gradient" : tone === "ok" ? "bg-ok" : tone === "danger" ? "bg-danger" : "bg-ink";
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-paper-4", className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cx("h-full rounded-full transition-[width] duration-300 ease-out", fill, indeterminate && "shimmer")}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}
