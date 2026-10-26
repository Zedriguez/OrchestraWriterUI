"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Eye, EyeOff, Headphones, Lock, MousePointer2, RotateCcw } from "lucide-react";
import { SECTION_ORDER, SECTIONS, type Section } from "@/shared/sections";
import { useProject } from "@/lib/store/project";
import { usePlayback } from "@/lib/store/playback";
import { useProjectTiming } from "@/lib/store/useProjectTiming";
import { partColor } from "@/lib/visualizer";
import { cx } from "@/lib/utils/format";
import { Stage } from "@/components/visualizer/Stage";
import { useWaveform } from "@/components/visualizer/useWaveform";
import { Transport } from "@/components/music/Transport";
import { DynamicLegend } from "@/components/music/DynamicLegend";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Segmented } from "@/components/ui/Segmented";
import { Chip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Field";
import { Tooltip } from "@/components/ui/Tooltip";
import { Dot } from "@/components/shell/PageHeader";
import { ColorSwatch } from "./ColorSwatch";

const PALETTES: Array<{ id: string; name: string; colors: Record<Section, string> }> = [
  { id: "concert", name: "Concert", colors: { Strings: "#e2b04c", Woodwinds: "#5cba9a", Brass: "#e8705e", Percussion: "#9298e0", Other: "#c98bc9" } },
  { id: "aurora", name: "Aurora", colors: { Strings: "#7fd4c1", Woodwinds: "#8fb7ff", Brass: "#ffa26b", Percussion: "#d79bff", Other: "#ffd27a" } },
  { id: "ember", name: "Ember", colors: { Strings: "#f2b544", Woodwinds: "#f08a4b", Brass: "#e8545f", Percussion: "#b86cd8", Other: "#8bd3dd" } },
  { id: "tints", name: "Brass tints", colors: { Strings: "#e9c67a", Woodwinds: "#c8a24f", Brass: "#f1dca0", Percussion: "#a3833b", Other: "#d9b35f" } },
];

export function CustomizePage({ projectId }: { projectId: string }) {
  const summary = useProject((s) => s.summary)!;
  const infoMap = useProject((s) => s.infoMap)!;
  const display = useProject((s) => s.display)!;
  const {
    setVisible, setSectionVisible, soloPart, setPartColor, setSectionColor, setPartSection, setPosition,
    resetPositions, resetColors, setShowLabels, setLabelMode, setReducedMotion, setGlowScale,
  } = useProject.getState();
  const playing = usePlayback((s) => s.playing);
  const { clock } = useProjectTiming();
  const peaks = useWaveform(summary.id.length * 7 + summary.measures);
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const visible = useMemo(() => new Set(display.visibleParts), [display.visibleParts]);
  const sectionOf = (id: string) => display.sections[id] ?? infoMap.instruments.find((i) => i.id === id)!.section;
  const grouped = useMemo(
    () =>
      SECTION_ORDER.map((section) => ({
        section,
        members: infoMap.instruments.filter((i) => (display.sections[i.id] ?? i.section) === section),
      })).filter((g) => g.members.length > 0),
    [infoMap, display.sections],
  );
  const sel = selected ? infoMap.instruments.find((i) => i.id === selected) ?? null : null;
  const sectionCount = grouped.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Step 3 of 5 · Customize</p>
          <h1 className="display text-[2.5rem] md:text-[3.1rem]">
            Shape the <em>stage</em>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">
            <span>{summary.title}</span>
            <Dot />
            <span>
              {display.visibleParts.length} of {infoMap.instruments.length} parts shown
            </span>
            <Dot />
            <span>{sectionCount} sections</span>
            <Dot />
            <span className="inline-flex items-center gap-1">
              <MousePointer2 size={12} /> drag a glow to move it
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" leading={<RotateCcw size={14} />} onClick={() => { resetPositions(); resetColors(); }}>
            Reset layout
          </Button>
          <Button href={`/projects/${projectId}/preview`} size="sm" trailing={<ArrowRight size={14} />}>
            Continue to Preview
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[272px_minmax(0,1fr)_304px] lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* parts list */}
        <aside className="card p-3 self-start lg:sticky lg:top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scroll-thin">
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <p className="eyebrow">Parts</p>
            <span className="tnum text-[11px] text-ink-3">{infoMap.instruments.length} / 64</span>
          </div>
          {grouped.map(({ section, members }) => {
            const shown = members.filter((m) => visible.has(m.id)).length;
            const isCollapsed = collapsed[section];
            return (
              <div key={section} className="mb-1">
                <div className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-paper-3">
                  <ColorSwatch size="sm" value={display.sectionColors[section]} onChange={(c) => setSectionColor(section, c)} label={`${section} color`} />
                  <button type="button" className="flex-1 text-left text-[13px] font-medium text-ink" onClick={() => setCollapsed((c) => ({ ...c, [section]: !c[section] }))}>
                    {section}
                  </button>
                  <span className="tnum text-[11px] text-ink-3">
                    {shown}/{members.length}
                  </span>
                  <Tooltip label={shown === members.length ? "Hide section" : "Show section"}>
                    <button type="button" className="rounded-full p-1 text-ink-3 hover:text-ink" onClick={() => setSectionVisible(section, shown !== members.length)} aria-label="Toggle section visibility">
                      {shown === members.length ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </Tooltip>
                </div>
                {!isCollapsed &&
                  members.map((m) => {
                    const on = visible.has(m.id);
                    const isSel = selected === m.id;
                    return (
                      <div
                        key={m.id}
                        className={cx(
                          "group flex items-center gap-2 rounded-[var(--radius-sm)] py-1.5 pl-6 pr-2 cursor-pointer",
                          isSel ? "bg-brass-soft" : "hover:bg-paper-3",
                          !on && "opacity-50",
                        )}
                        onClick={() => setSelected(isSel ? null : m.id)}
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: partColor(infoMap, display, m.id) }} />
                        <span className={cx("flex-1 truncate text-[13px]", isSel ? "text-ink" : "text-ink-2")}>{m.name}</span>
                        <Tooltip label="Solo">
                          <button
                            type="button"
                            className="hidden rounded px-1 text-[10px] font-semibold text-ink-3 hover:text-ink group-hover:inline"
                            onClick={(e) => { e.stopPropagation(); soloPart(m.id); }}
                          >
                            S
                          </button>
                        </Tooltip>
                        <button
                          type="button"
                          className="rounded-full p-1 text-ink-3 hover:text-ink"
                          onClick={(e) => { e.stopPropagation(); setVisible(m.id, !on); }}
                          aria-label={on ? `Hide ${m.name}` : `Show ${m.name}`}
                        >
                          {on ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                      </div>
                    );
                  })}
              </div>
            );
          })}
          <p className="px-2 pt-2 text-[11px] leading-relaxed text-ink-4">Hiding a part changes the visual only. The audio is unchanged.</p>
        </aside>

        {/* stage */}
        <div className="min-w-0 space-y-4">
          <Stage
            infoMap={infoMap}
            display={display}
            clock={clock}
            interactive
            selectedId={selected}
            onSelect={setSelected}
            onMove={setPosition}
            previewAll={!playing}
            showLegend
          />
          <Transport peaks={peaks} />
          <p className="text-[12px] text-ink-3 inline-flex items-center gap-1.5">
            <Headphones size={12} /> {playing ? "Playing — glows follow the written dynamics." : "Paused — every visible part is shown at a mid level so you can place it."}
          </p>
        </div>

        {/* settings */}
        <aside className="space-y-4 self-start xl:sticky xl:top-24 lg:col-span-2 xl:col-span-1">
          <section className="card p-4">
            <p className="eyebrow mb-3">{sel ? "Selected part" : "Selection"}</p>
            {sel ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-[20px]">{sel.name}</h3>
                  <ColorSwatch size="lg" value={partColor(infoMap, display, sel.id)} onChange={(c) => setPartColor(sel.id, c)} label={`${sel.name} color`} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[12px] text-ink-3">Section</label>
                    <Select value={sectionOf(sel.id)} onChange={(e) => setPartSection(sel.id, e.target.value as Section)} className="h-9 text-[13px]">
                      {SECTIONS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-[12px] text-ink-3">Color</label>
                    <Button variant="outline" size="sm" className="w-full h-9" onClick={() => setPartColor(sel.id, null)} disabled={!display.colors[sel.id]}>
                      Use section color
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-[12px] text-ink-3">Position</label>
                  <div className="mt-1 grid grid-cols-4 gap-1.5">
                    {([["←", -0.02, 0], ["→", 0.02, 0], ["↑", 0, -0.03], ["↓", 0, 0.03]] as const).map(([k, dx, dy]) => (
                      <Button key={k} variant="secondary" size="sm" className="h-8" onClick={() => {
                        const p = display.positions[sel.id];
                        setPosition(sel.id, { x: Math.min(0.97, Math.max(0.03, p.x + dx)), y: Math.min(0.9, Math.max(0.05, p.y + dy)) });
                      }}>
                        {k}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setVisible(sel.id, !visible.has(sel.id))}>
                    {visible.has(sel.id) ? "Hide" : "Show"}
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => soloPart(sel.id)}>
                    Solo
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-[13px] leading-relaxed text-ink-3">Click a glow on the stage or a part in the list to recolor, reassign or reposition it.</p>
            )}
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="eyebrow">Section colors</p>
              <button type="button" className="text-[12px] text-ink-3 hover:text-ink" onClick={resetColors}>
                Reset
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => SECTIONS.forEach((s) => setSectionColor(s, p.colors[s]))}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-paper-2 py-1 pl-1.5 pr-2.5 text-[12px] text-ink-2 hover:border-line-strong"
                >
                  <span className="flex -space-x-1">
                    {SECTION_ORDER.slice(0, 4).map((s) => (
                      <span key={s} className="h-3.5 w-3.5 rounded-full ring-1 ring-paper-2" style={{ background: p.colors[s] }} />
                    ))}
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
            <ul className="space-y-2">
              {grouped.map(({ section, members }) => (
                <li key={section} className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 text-ink-2">
                    <ColorSwatch value={display.sectionColors[section]} onChange={(c) => setSectionColor(section, c)} label={`${section} color`} />
                    {section}
                  </span>
                  <span className="tnum text-[11px] text-ink-3">{members.length} parts</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-4">About 8–10 distinct hues read well. Beyond that, parts within a section use tints and labels.</p>
          </section>

          <section className="card p-4 space-y-3">
            <p className="eyebrow">Labels</p>
            <Toggle label="Show part labels" checked={display.showLabels} onChange={setShowLabels} />
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink">Label by</span>
              <Segmented size="sm" value={display.labelMode} onChange={setLabelMode} options={[{ value: "sections", label: "Sections" }, { value: "parts", label: "Parts" }]} />
            </div>
            <Toggle label="Reduced motion" description="Fades become instant switches." checked={display.reducedMotion} onChange={setReducedMotion} />
          </section>

          <section className="card p-4 space-y-3">
            <p className="eyebrow">Dynamics → brightness</p>
            <DynamicLegend compact />
            <div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-ink">Glow size</span>
                <span className="tnum text-ink-3">{Math.round(display.glowScale * 100)}%</span>
              </div>
              <input type="range" min={0.6} max={1.4} step={0.05} value={display.glowScale} onChange={(e) => setGlowScale(Number(e.target.value))} className="mt-1.5 w-full accent-[var(--brass)]" aria-label="Glow size" />
            </div>
            <div className="divide-y divide-line border-t border-line pt-1">
              {["Pitch ramp", "Mappings"].map((row) => (
                <div key={row} className="flex items-center justify-between py-2 text-[13px] text-ink-4">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock size={12} /> {row}
                  </span>
                  <Chip tone="neutral">Later phase</Chip>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
