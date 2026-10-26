import type { ReactNode } from "react";
import { cx } from "@/lib/utils/format";

/**
 * The page's one `h1`, with an optional meta line under it and actions on the
 * right. `eyebrow` exists for the rare page that needs context the nav does
 * not give; leave it off by default.
 */
export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="display text-[2rem] leading-tight md:text-[2.4rem]">{title}</h1>
        {meta && <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Dot() {
  return (
    <span className="text-ink-4" aria-hidden>
      ·
    </span>
  );
}
