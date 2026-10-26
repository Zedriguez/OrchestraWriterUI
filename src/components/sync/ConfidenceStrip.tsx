"use client";

import { useMemo, useRef } from "react";
import type { MeasureAlignment } from "@/shared/sync";
import { CONFIDENCE_BANDS, confidenceBand } from "@/shared/sync";
import { cx } from "@/lib/utils/format";

/** Whole-piece confidence overview: one thin column per measure, colored by band. */
export function ConfidenceStrip({
  aligned,
  manual,
  current,
  selected,
  onPick,
  className,
}: {
  aligned: MeasureAlignment[];
  manual: Set<number>;
  current: number;
  selected: number | null;
  onPick: (measure: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const n = aligned.length;
  const cols = useMemo(() => aligned.map((a) => ({ n: a.n, token: confidenceBand(a.confidence).token, c: a.confidence })), [aligned]);
  const pick = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / r.width) * n);
    onPick(Math.max(1, Math.min(n, i + 1)));
  };
  return (
    <div className={className}>
      <div
        ref={ref}
        className="relative h-9 w-full cursor-crosshair overflow-hidden rounded-[var(--radius-sm)] border border-line bg-paper-3"
        onPointerDown={pick}
        onPointerMove={(e) => e.buttons === 1 && pick(e)}
        role="slider"
        aria-label="Confidence by measure"
        aria-valuenow={current}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${n} 10`} preserveAspectRatio="none" aria-hidden>
          {cols.map((c, i) => (
            <rect key={c.n} x={i} y={10 - Math.max(2, (c.c / 100) * 10)} width={1} height={Math.max(2, (c.c / 100) * 10)} fill={c.token} opacity={manual.has(c.n) ? 1 : 0.75} />
          ))}
          {[...manual].map((m) => (
            <rect key={m} x={m - 1} y={0} width={1} height={10} fill="var(--ink)" opacity={0.6} />
          ))}
        </svg>
        {selected && (
          <div className="pointer-events-none absolute top-0 bottom-0 border-x border-ink/60 bg-ink/5" style={{ left: `${((selected - 1) / n) * 100}%`, width: `${Math.max(0.4, 100 / n)}%` }} />
        )}
        <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-brass-2 shadow-[0_0_6px_var(--brass-glow)]" style={{ left: `${((current - 0.5) / n) * 100}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
        {CONFIDENCE_BANDS.map((b) => (
          <span key={b.id} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.token }} />
            {b.label} <span className="text-ink-4">{b.description}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-[2px] bg-ink" /> Manual marker
        </span>
      </div>
      <span className={cx("sr-only")}>Click a measure to select it.</span>
    </div>
  );
}
