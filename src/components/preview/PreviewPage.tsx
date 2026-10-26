"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Maximize2, Music2, SlidersHorizontal, Waves } from "lucide-react";
import type { Dynamic } from "@/shared/dynamics";
import { SECTION_ORDER, type Section } from "@/shared/sections";
import { useProject } from "@/lib/store/project";
import { usePlayback } from "@/lib/store/playback";
import { useProjectTiming } from "@/lib/store/useProjectTiming";
import { partColor } from "@/lib/visualizer";
import { cx } from "@/lib/utils/format";
import { Stage } from "@/components/visualizer/Stage";
import { useWaveform } from "@/components/visualizer/useWaveform";
import { Transport } from "@/components/music/Transport";
import { ScoreStrip } from "@/components/music/ScoreStrip";
import { Dyn } from "@/components/music/Dyn";
import { DynamicLegend } from "@/components/music/DynamicLegend";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Chip } from "@/components/ui/Chip";
import { Dot } from "@/components/shell/PageHeader";

type PartFrame = { id: string; playing: boolean; dynamic: Dynamic; level: number };

export function PreviewPage({ projectId }: { projectId: string }) {
  const summary = useProject((s) => s.summary)!;
  const infoMap = useProject((s) => s.infoMap)!;
  const display = useProject((s) => s.display)!;
  const setShowLabels = useProject((s) => s.setShowLabels);
  const setReducedMotion = useProject((s) => s.setReducedMotion);
  const { clock, measureAt, seekMeasure, hasRecording } = useProjectTiming();
  const peaks = useWaveform(summary.id.length * 7 + summary.measures);

  const [measure, setMeasure] = useState(() => measureAt(usePlayback.getState().time));
  const [frame, setFrame] = useState<PartFrame[]>([]);
  const [panels, setPanels] = useState({ stage: true, score: true, orchestra: false });
  const toggle = (k: keyof typeof panels) => setPanels((p) => ({ ...p, [k]: !p[k] }));

  const onFrame = useCallback((parts: PartFrame[]) => setFrame(parts), []);
  const onMeasure = useCallback((m: number) => setMeasure(m), []);

  const visible = useMemo(() => new Set(display.visibleParts), [display.visibleParts]);

  // "What's playing" rows: strings individually, other sections grouped (as in the mockup).
  const rows = useMemo(() => {
    const byId = new Map(frame.map((f) => [f.id, f]));
    const out: Array<{ key: string; label: string; color: string; dynamic: Dynamic; playing: boolean; level: number }> = [];
    for (const section of SECTION_ORDER) {
      const members = infoMap.instruments.filter((i) => visible.has(i.id) && (display.sections[i.id] ?? i.section) === section);
      if (members.length === 0) continue;
      if (section === "Strings") {
        for (const m of members) {
          const f = byId.get(m.id);
          out.push({ key: m.id, label: m.name, color: partColor(infoMap, display, m.id), dynamic: f?.dynamic ?? "mp", playing: !!f?.playing, level: f?.level ?? 0 });
        }
      } else {
        let dyn: Dynamic = "pp";
        let playing = false;
        let level = 0;
        for (const m of members) {
          const f = byId.get(m.id);
          if (f?.playing) {
            playing = true;
            if (idx(f.dynamic) > idx(dyn)) dyn = f.dynamic;
          }
          level = Math.max(level, f?.level ?? 0);
        }
        out.push({ key: section, label: section, color: display.sectionColors[section as Section], dynamic: playing ? dyn : "pp", playing, level });
      }
    }
    return out;
  }, [frame, infoMap, display, visible]);

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Now showing</p>
          <h1 className="display text-[2.5rem] md:text-[3.1rem]">
            {summary.title} {summary.subtitle && <em>{summary.subtitle}</em>}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">
            <span>{summary.movement}</span>
            <Dot />
            <span className="tnum">
              bar {measure} of {infoMap.measures.length}
            </span>
            <Dot />
            <span>{display.visibleParts.length} parts</span>
            {hasRecording && (
              <>
                <Dot />
                <span>{summary.averageConfidence ?? 90}% sync confidence</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasRecording && (
            <Button href={`/projects/${projectId}/sync`} variant="outline" size="sm" leading={<Waves size={14} />}>
              Edit sync
            </Button>
          )}
          <Button href={`/projects/${projectId}/customize`} variant="outline" size="sm" leading={<SlidersHorizontal size={14} />}>
            Edit display
          </Button>
          <Button href={`/projects/${projectId}/export`} variant="primary" size="sm" trailing={<ArrowRight size={14} />}>
            Continue to Export
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* stage column */}
        <div className="space-y-4 min-w-0">
          <Panel
            title="Visualizer"
            icon={<Waves size={14} />}
            open={panels.stage}
            onToggle={() => toggle("stage")}
            bare
            trailing={
              <div className="flex items-center gap-2">
                <Chip tone="neutral" className="whitespace-nowrap">{hasRecording ? "Uploaded recording" : "Generated from score"}</Chip>
                <Chip tone="neutral" className="hidden sm:inline-flex">1080p</Chip>
              </div>
            }
          >
            <div className="relative">
              <Stage infoMap={infoMap} display={display} clock={clock} onFrame={onFrame} onMeasure={onMeasure} />
              <button
                type="button"
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full stage-glass text-stage-text-2 hover:text-stage-text"
                aria-label="Fullscreen"
                onClick={(e) => (e.currentTarget.parentElement as HTMLElement).requestFullscreen?.()}
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </Panel>

          <Transport peaks={peaks} measureLabel={`Measure ${measure} / ${infoMap.measures.length}`} />

          <Panel title="Score" icon={<Music2 size={14} />} open={panels.score} onToggle={() => toggle("score")}>
            <ScoreStrip infoMap={infoMap} currentMeasure={measure} onSeekMeasure={seekMeasure} visibleParts={visible} />
          </Panel>

          <Panel title="Orchestra viewer" icon={<SlidersHorizontal size={14} />} open={panels.orchestra} onToggle={() => toggle("orchestra")}>
            <OrchestraViewer frame={frame} />
          </Panel>
        </div>

        {/* what's playing */}
        <aside className="card p-5 self-start lg:sticky lg:top-24">
          <p className="eyebrow mb-1.5">Parts</p>
          <h2 className="display text-[1.7rem] mb-3">What&apos;s playing</h2>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-3 py-2.5" style={{ opacity: r.playing ? 1 : 0.45, transition: "opacity 200ms" }}>
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="h-4 w-4 shrink-0 rounded-full"
                    style={{
                      background: r.color,
                      boxShadow: r.playing ? `0 0 ${6 + r.level * 10}px ${r.color}` : "none",
                      opacity: 0.45 + r.level * 0.55,
                    }}
                  />
                  <span className="text-sm text-ink truncate">{r.label}</span>
                </span>
                <Dyn value={r.dynamic} className="text-ink" />
              </li>
            ))}
          </ul>
          <DynamicLegend className="mt-5 border-t border-line pt-5" />
          <div className="mt-6 space-y-3 border-t border-line pt-5">
            <Toggle label="Show part labels" checked={display.showLabels} onChange={setShowLabels} />
            <Toggle label="Reduced motion" checked={display.reducedMotion} onChange={setReducedMotion} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function idx(d: Dynamic) {
  return ["pp", "p", "mp", "mf", "f", "ff", "fff"].indexOf(d);
}

function Panel({
  title,
  icon,
  open,
  onToggle,
  children,
  bare,
  trailing,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  bare?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <section className={cx(!bare && "card p-4")}>
      <div className={cx("flex items-center justify-between gap-3", open && !bare && "mb-3", open && bare && "mb-2")}>
        <button type="button" onClick={onToggle} className="flex items-center gap-2 text-[13px] font-medium text-ink-2 hover:text-ink" aria-expanded={open}>
          <ChevronDown size={14} className={cx("transition-transform", !open && "-rotate-90")} />
          {icon}
          {title}
        </button>
        {trailing}
      </div>
      {open && children}
    </section>
  );
}

function OrchestraViewer({ frame }: { frame: PartFrame[] }) {
  const infoMap = useProject((s) => s.infoMap)!;
  const display = useProject((s) => s.display)!;
  const byId = new Map(frame.map((f) => [f.id, f]));
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {SECTION_ORDER.map((section) => {
        const members = infoMap.instruments.filter((i) => (display.sections[i.id] ?? i.section) === section);
        if (members.length === 0) return null;
        return (
          <div key={section}>
            <p className="eyebrow eyebrow-muted mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: display.sectionColors[section] }} />
              {section}
            </p>
            <ul className="space-y-1">
              {members.map((m) => {
                const f = byId.get(m.id);
                const hidden = !display.visibleParts.includes(m.id);
                return (
                  <li key={m.id} className={cx("flex items-center justify-between rounded-md px-2 py-1 text-[13px]", f?.playing ? "bg-paper-3 text-ink" : "text-ink-3", hidden && "line-through opacity-50")}>
                    <span>{m.name}</span>
                    {f?.playing && <Dyn value={f.dynamic} size="sm" />}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
