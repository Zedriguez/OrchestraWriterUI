import { cx } from "@/lib/utils/format";

/** Drifting section-hued light field. Purely decorative; respects reduced motion via CSS. */
export function Aurora({ subtle, className }: { subtle?: boolean; className?: string }) {
  return (
    <div className={cx("aurora", subtle && "opacity-30", className)} aria-hidden>
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
