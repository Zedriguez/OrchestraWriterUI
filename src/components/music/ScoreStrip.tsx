"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { InfoMap } from "@/shared/info-map";
import { BRIGHTNESS_LADDER } from "@/shared/dynamics";
import { confidenceBand } from "@/shared/sync";
import { measureDynamic } from "@/lib/score/segments";
import { cx } from "@/lib/utils/format";
import { Dyn } from "./Dyn";
import { Toggle } from "@/components/ui/Toggle";
import { barNumber } from "./bars";

const MEASURES_PER_PAGE = 8;

/**
 * Schematic score viewer: one staff per part, note activity per measure,
 * current-measure highlight, click a measure to start playback, page
 * navigation independent of the playing measure, and a Follow toggle.
 * Headers show the printed bar number (`MeasureInfo.label`) when a repeat
 * makes it differ from the playback index.
 * Engraved notation (OSMD / Verovio) slots in here later.
 */
export function ScoreStrip({
  infoMap,
  currentMeasure,
  onSeekMeasure,
  visibleParts,
  className,
  maxParts = 10,
  confidence,
}: {
  infoMap: InfoMap;
  currentMeasure: number;
  onSeekMeasure: (measure: number) => void;
  visibleParts?: Set<string>;
  className?: string;
  maxParts?: number;
  /** per-measure 0–100 (Sync page) */
  confidence?: Map<number, number>;
}) {
  const total = infoMap.measures.length;
  const pages = Math.ceil(total / MEASURES_PER_PAGE);
  const [follow, setFollow] = useState(true);
  const followedPage = Math.floor((currentMeasure - 1) / MEASURES_PER_PAGE);
  const [manualPage, setManualPage] = useState<number | null>(null);
  const page = follow ? followedPage : (manualPage ?? followedPage);
  const setPage = (fn: (p: number) => number) => setManualPage(fn(page));

  const first = page * MEASURES_PER_PAGE + 1;
  const measures = useMemo(() => Array.from({ length: Math.min(MEASURES_PER_PAGE, total - first + 1) }, (_, i) => first + i), [first, total]);
  const parts = useMemo(() => {
    const list = visibleParts ? infoMap.instruments.filter((i) => visibleParts.has(i.id)) : infoMap.instruments;
    return list.slice(0, maxParts);
  }, [infoMap, visibleParts, maxParts]);

  return (
    <div className={cx("flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-full p-1 text-ink-3 hover:bg-paper-3 hover:text-ink disabled:opacity-30"
            onClick={() => {
              setFollow(false);
              setPage((p) => Math.max(0, p - 1));
            }}
            disabled={page === 0}
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="tnum text-[12.5px] text-ink-2">
            {page + 1} / {pages}
          </span>
          <button
            type="button"
            className="rounded-full p-1 text-ink-3 hover:bg-paper-3 hover:text-ink disabled:opacity-30"
            onClick={() => {
              setFollow(false);
              setPage((p) => Math.min(pages - 1, p + 1));
            }}
            disabled={page >= pages - 1}
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-ink-3">
          <span aria-hidden>Follow</span>
          <Toggle
            size="sm"
            ariaLabel="Follow playback"
            checked={follow}
            onChange={(v) => {
              setFollow(v);
              if (v) setManualPage(null);
            }}
          />
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[var(--radius)] border border-line bg-paper-2">
        {/* measure numbers */}
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `76px repeat(${measures.length}, minmax(0,1fr))` }}>
          <div />
          {measures.map((m) => {
            const conf = confidence?.get(m);
            const label = infoMap.measures[m - 1]?.label ?? String(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => onSeekMeasure(m)}
                className={cx(
                  "tnum relative h-7 text-[11px] font-medium transition-colors hover:bg-paper-3",
                  m === currentMeasure ? "text-ink" : "text-ink-3",
                )}
                aria-label={`Play from bar ${barNumber(infoMap, m)}`}
                aria-current={m === currentMeasure ? "true" : undefined}
              >
                {label}
                {conf !== undefined && (
                  <span className="absolute left-1 right-1 bottom-0 h-[3px] rounded-full" style={{ background: confidenceBand(conf).token }} aria-hidden />
                )}
              </button>
            );
          })}
        </div>

        {/* staves */}
        <div className="scroll-thin max-h-[380px] overflow-y-auto">
          {parts.map((inst) => (
            <div
              key={inst.id}
              className="grid items-stretch border-b border-line last:border-b-0"
              style={{ gridTemplateColumns: `76px repeat(${measures.length}, minmax(0,1fr))` }}
            >
              <div className="flex items-center px-2 text-[11px] text-ink-2 truncate" title={inst.name}>
                {inst.shortName}
              </div>
              {measures.map((m) => {
                const dyn = measureDynamic(inst, m);
                const notes = inst.notes.filter((n) => n.measure === m);
                const active = m === currentMeasure;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onSeekMeasure(m)}
                    className={cx("relative h-10 border-l border-line transition-colors hover:bg-paper-3", active && "bg-brass-soft")}
                    aria-label={`${inst.name}, bar ${barNumber(infoMap, m)}`}
                  >
                    {/* staff lines */}
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
                      {[10, 15, 20, 25, 30].map((y) => (
                        <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="var(--line)" strokeWidth="0.6" />
                      ))}
                      {notes.map((n, i) => {
                        const x = 6 + (i / Math.max(1, notes.length)) * 88;
                        const y = 32 - ((n.pitch - 40) / 56) * 24;
                        return <ellipse key={i} cx={x} cy={Math.max(8, Math.min(32, y))} rx="2.6" ry="1.9" fill="var(--ink)" opacity={0.55 + BRIGHTNESS_LADDER[n.dynamics] * 0.45} />;
                      })}
                    </svg>
                    {dyn && (
                      <span className="absolute left-1.5 bottom-0 text-ink-2">
                        <Dyn value={dyn} size="sm" className="!text-[11px]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {parts.length < (visibleParts ? visibleParts.size : infoMap.instruments.length) && (
            <p className="px-3 py-2 text-[11px] text-ink-3">
              Showing {parts.length} of {visibleParts ? visibleParts.size : infoMap.instruments.length} parts.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
