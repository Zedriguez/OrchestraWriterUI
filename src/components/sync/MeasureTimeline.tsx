"use client";

import { useMemo, useRef } from "react";
import type { MeasureAlignment } from "@/shared/sync";
import { confidenceBand } from "@/shared/sync";
import { formatTime, cx } from "@/lib/utils/format";

/**
 * A zoomed stretch of the recording: waveform, measure boundaries from the
 * alignment (auto = thin, manual = brass pin), confidence tint per measure,
 * and the playhead. Click to select a measure; drag the playhead to scrub.
 */
export function MeasureTimeline({
  peaks,
  duration,
  aligned,
  manual,
  from,
  to,
  time,
  selected,
  onSelect,
  onSeek,
  className,
}: {
  peaks: number[];
  duration: number;
  aligned: MeasureAlignment[];
  manual: Set<number>;
  /** first/last measure (inclusive) in view */
  from: number;
  to: number;
  time: number;
  selected: number | null;
  onSelect: (m: number) => void;
  onSeek: (t: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const t0 = aligned[from - 1]?.startSec ?? 0;
  const t1 = aligned[to] ? aligned[to].startSec : (aligned[to - 1]?.startSec ?? duration - 1) + 1;
  const span = Math.max(0.5, t1 - t0);
  const x = (t: number) => ((t - t0) / span) * 100;

  const bars = useMemo(() => {
    const i0 = Math.floor((t0 / duration) * peaks.length);
    const i1 = Math.min(peaks.length, Math.ceil((t1 / duration) * peaks.length));
    const slice = peaks.slice(i0, i1);
    return slice.map((p, i) => ({ x: (i / slice.length) * 100, h: Math.max(6, p * 100), w: (100 / slice.length) * 0.6 }));
  }, [peaks, t0, t1, duration]);

  const measures = useMemo(() => {
    const out: Array<{ n: number; x0: number; x1: number; conf: number; manual: boolean }> = [];
    for (let n = from; n <= to; n++) {
      const a = aligned[n - 1];
      const b = aligned[n];
      if (!a) continue;
      out.push({ n, x0: x(a.startSec), x1: b ? x(b.startSec) : 100, conf: a.confidence, manual: manual.has(n) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aligned, from, to, manual, t0, span]);

  const handle = (e: React.PointerEvent, scrub: boolean) => {
    const r = ref.current!.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const t = t0 + f * span;
    if (scrub) onSeek(t);
    else {
      const m = measures.find((mm) => f * 100 >= mm.x0 && f * 100 < mm.x1);
      if (m) onSelect(m.n);
    }
  };

  return (
    <div className={cx("select-none", className)}>
      <div
        ref={ref}
        className="relative h-28 w-full overflow-hidden rounded-[var(--radius)] border border-line bg-paper-2"
        onPointerDown={(e) => handle(e, e.shiftKey)}
        onPointerMove={(e) => e.buttons === 1 && e.shiftKey && handle(e, true)}
        onDoubleClick={(e) => {
          const r = ref.current!.getBoundingClientRect();
          onSeek(t0 + ((e.clientX - r.left) / r.width) * span);
        }}
      >
        {/* confidence tints */}
        {measures.map((m) => (
          <div
            key={m.n}
            className="absolute top-0 bottom-0"
            style={{ left: `${m.x0}%`, width: `${Math.max(0, m.x1 - m.x0)}%`, background: confidenceBand(m.conf).token, opacity: m.n === selected ? 0.3 : 0.1 }}
          />
        ))}
        {/* waveform */}
        <svg className="absolute inset-x-0 top-7 bottom-5" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <g fill="rgba(29,26,22,0.3)">
            {bars.map((b, i) => (
              <rect key={i} x={b.x} y={(100 - b.h) / 2} width={b.w} height={b.h} rx="0.3" />
            ))}
          </g>
        </svg>
        {/* measure boundaries + numbers */}
        {measures.map((m) => (
          <div key={m.n} className="absolute top-0 bottom-0" style={{ left: `${m.x0}%` }}>
            <div className={cx("absolute top-0 bottom-0 w-px", m.manual ? "bg-brass w-[2px] shadow-[0_0_6px_var(--brass-glow)]" : "bg-ink/25")} />
            {m.manual && <div className="absolute -left-[5px] top-0 h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-brass" />}
            <span className={cx("tnum absolute left-1.5 top-1 text-[11px] font-medium", m.n === selected ? "text-ink" : "text-ink-3")}>{m.n}</span>
            <span className="tnum absolute left-1.5 bottom-1 text-[10px] text-ink-4">{formatTime(aligned[m.n - 1].startSec, true)}</span>
            <span
              className="absolute right-1.5 top-1 rounded-full px-1.5 text-[10px] font-semibold"
              style={{ background: `color-mix(in srgb, ${confidenceBand(m.conf).token} 18%, transparent)`, color: `color-mix(in srgb, ${confidenceBand(m.conf).token} 80%, var(--ink))` }}
            >
              {m.conf}%
            </span>
          </div>
        ))}
        {/* playhead */}
        {time >= t0 && time <= t1 && (
          <div className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-brass-2 shadow-[0_0_8px_var(--brass-glow)]" style={{ left: `${x(time)}%` }} />
        )}
      </div>
      <p className="mt-1.5 text-[11.5px] text-ink-4">
        Click a measure to select it · double-click to move the playhead · shift-drag to scrub. Window {formatTime(t0)}–{formatTime(t1)}.
      </p>
    </div>
  );
}
