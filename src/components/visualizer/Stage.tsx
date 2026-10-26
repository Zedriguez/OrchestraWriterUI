"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InfoMap } from "@/shared/info-map";
import type { DisplaySettings } from "@/shared/project-file";
import { louder, type Dynamic } from "@/shared/dynamics";
import { SECTION_ORDER, type Section } from "@/shared/sections";
import { usePlayback } from "@/lib/store/playback";
import { Canvas2DGlowRenderer, FrameEngine, buildScene, partColor, type GlowRenderer } from "@/lib/visualizer";
import { cx } from "@/lib/utils/format";
import { Dyn } from "@/components/music/Dyn";
import { LadderDots } from "@/components/music/DynamicLegend";

export interface StageLabel {
  key: string;
  text: string;
  dynamic: Dynamic;
  color: string;
  /** normalized anchor on the stage */
  x: number;
  y: number;
  side: "left" | "right" | "top";
  level: number;
  partIds: string[];
}

export interface StageProps {
  infoMap: InfoMap;
  display: DisplaySettings;
  /** seconds; default reads the playback store */
  clock?: () => number;
  className?: string;
  /** customize mode: drag glows, click to select */
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, pos: { x: number; y: number }) => void;
  /** show a constant mid level for every visible part (Customize when paused) */
  previewAll?: boolean;
  showLegend?: boolean;
  showSeating?: boolean;
  onMeasure?: (measure: number) => void;
  /** throttled (~10 Hz) per-part frame data for side panels */
  onFrame?: (parts: Array<{ id: string; playing: boolean; dynamic: Dynamic; level: number }>) => void;
  /** force label mode */
  labelMode?: DisplaySettings["labelMode"] | "none";
}

const LABEL_HZ = 10;

export function Stage({
  infoMap,
  display,
  clock,
  className,
  interactive,
  selectedId,
  onSelect,
  onMove,
  previewAll,
  showLegend,
  showSeating = true,
  onMeasure,
  onFrame,
  labelMode,
}: StageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GlowRenderer | null>(null);
  const engineRef = useRef<FrameEngine | null>(null);
  const displayRef = useRef(display);
  const [labels, setLabels] = useState<StageLabel[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const mode = labelMode ?? (display.showLabels ? display.labelMode : "none");
  const propsRef = useRef({ clock, interactive, selectedId, previewAll, showSeating, onMeasure, onFrame, mode });
  useEffect(() => {
    displayRef.current = display;
    propsRef.current = { clock, interactive, selectedId, previewAll, showSeating, onMeasure, onFrame, mode };
  });

  useEffect(() => {
    engineRef.current = new FrameEngine(infoMap);
  }, [infoMap]);

  // mount renderer + resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const renderer = new Canvas2DGlowRenderer();
    renderer.mount(canvas);
    rendererRef.current = renderer;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      renderer.resize(r.width, r.height, window.devicePixelRatio || 1);
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // render loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let labelAt = 0;
    let lastMeasure = -1;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const renderer = rendererRef.current;
      const engine = engineRef.current;
      if (!renderer || !engine) return;
      const p = propsRef.current;
      const d = displayRef.current;
      const t = p.clock ? p.clock() : usePlayback.getState().time;
      const dt = now - last;
      last = now;
      const frame = engine.compute(t, dt, d.reducedMotion);
      if (p.onMeasure && frame.measure !== lastMeasure) {
        lastMeasure = frame.measure;
        p.onMeasure(frame.measure);
      }
      const scene = buildScene(infoMap, d, frame, {
        showSeating: p.showSeating,
        selectedId: p.selectedId,
        forceLevel: p.previewAll ? 0.55 : undefined,
      });
      renderer.render(scene);
      if (now - labelAt > 1000 / LABEL_HZ) {
        labelAt = now;
        if (p.mode !== "none") setLabels(computeLabels(infoMap, d, frame.parts, p.mode, p.previewAll));
        p.onFrame?.(frame.parts);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [infoMap]);

  // dragging
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const hit = useCallback(
    (nx: number, ny: number) => {
      const d = displayRef.current;
      let best: string | null = null;
      let bestD = 0.09;
      for (const inst of infoMap.instruments) {
        if (!d.visibleParts.includes(inst.id)) continue;
        const pos = d.positions[inst.id];
        if (!pos) continue;
        const dist = Math.hypot((pos.x - nx) * 1.6, pos.y - ny);
        if (dist < bestD) {
          bestD = dist;
          best = inst.id;
        }
      }
      return best;
    },
    [infoMap],
  );

  const toNorm = (e: React.PointerEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const layout = useMemo(() => placeLabels(labels, size.w, size.h), [labels, size]);

  return (
    <div
      ref={wrapRef}
      className={cx("stage-frame aspect-video w-full", interactive && "cursor-grab", className)}
      onPointerDown={
        interactive
          ? (e) => {
              const { x, y } = toNorm(e);
              const id = hit(x, y);
              onSelect?.(id);
              if (id) {
                const pos = displayRef.current.positions[id];
                dragRef.current = { id, ox: pos.x - x, oy: pos.y - y };
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }
            }
          : undefined
      }
      onPointerMove={
        interactive
          ? (e) => {
              const drag = dragRef.current;
              if (!drag) return;
              const { x, y } = toNorm(e);
              onMove?.(drag.id, { x: clamp(x + drag.ox, 0.03, 0.97), y: clamp(y + drag.oy, 0.05, 0.9) });
            }
          : undefined
      }
      onPointerUp={interactive ? () => (dragRef.current = null) : undefined}
      onPointerCancel={interactive ? () => (dragRef.current = null) : undefined}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ width: "100%", height: "100%" }} aria-hidden />

      {/* leader lines */}
      {mode !== "none" && size.w > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" width={size.w} height={size.h} aria-hidden>
          {layout.map((l) => (
            <polyline
              key={l.key}
              points={l.line.map((p) => `${p[0]},${p[1]}`).join(" ")}
              fill="none"
              stroke={l.color}
              strokeOpacity={0.25 + l.level * 0.5}
              strokeWidth="1"
            />
          ))}
        </svg>
      )}

      {/* labels */}
      {mode !== "none" &&
        layout.map((l) => (
          <div
            key={l.key}
            className={cx(
              "pointer-events-none absolute flex flex-col leading-none transition-opacity duration-300",
              l.side === "right" ? "items-end text-right" : l.side === "top" ? "items-center text-center" : "items-start",
            )}
            style={{
              left: l.side === "top" ? l.lx : l.side === "left" ? l.lx : undefined,
              right: l.side === "right" ? size.w - l.lx : undefined,
              top: l.ly,
              transform: l.side === "top" ? "translate(-50%, 0)" : "translateY(-50%)",
              opacity: 0.4 + l.level * 0.6,
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stage-text-2">{l.text}</span>
            <Dyn value={l.dynamic} size="md" className="mt-1" style={{ color: l.color }} />
          </div>
        ))}

      {/* conductor caption */}
      <span className="pointer-events-none absolute bottom-[2.5%] left-1/2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-[0.2em] text-stage-text-3">
        Conductor
      </span>

      {showLegend && <LadderDots className="absolute left-4 top-4" />}
    </div>
  );
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

/** Strings get their own labels; other sections are labeled as a group with their loudest dynamic. */
function computeLabels(
  infoMap: InfoMap,
  display: DisplaySettings,
  parts: Array<{ id: string; playing: boolean; dynamic: Dynamic; level: number }>,
  mode: DisplaySettings["labelMode"],
  previewAll?: boolean,
): StageLabel[] {
  const visible = new Set(display.visibleParts);
  const byId = new Map(parts.map((p) => [p.id, p]));
  const out: StageLabel[] = [];
  const groups = new Map<string, { section: Section; ids: string[] }>();

  for (const inst of infoMap.instruments) {
    if (!visible.has(inst.id)) continue;
    const section = display.sections[inst.id] ?? inst.section;
    const key = mode === "parts" || section === "Strings" ? inst.id : section;
    const g = groups.get(key) ?? { section, ids: [] };
    g.ids.push(inst.id);
    groups.set(key, g);
  }

  for (const [key, g] of groups) {
    let sx = 0;
    let sy = 0;
    let level = 0;
    let dyn: Dynamic | null = null;
    for (const id of g.ids) {
      const pos = display.positions[id] ?? { x: 0.5, y: 0.5 };
      sx += pos.x;
      sy += pos.y;
      const pf = byId.get(id);
      const lv = previewAll ? 0.55 : (pf?.level ?? 0);
      level = Math.max(level, lv);
      if (pf && (pf.playing || previewAll)) dyn = dyn ? louder(dyn, pf.dynamic) : pf.dynamic;
    }
    const n = g.ids.length;
    const x = sx / n;
    const y = sy / n;
    const inst = infoMap.instruments.find((i) => i.id === g.ids[0])!;
    const text = g.ids.length === 1 && (mode === "parts" || g.section === "Strings") ? inst.name : g.section;
    const color = g.ids.length === 1 ? partColor(infoMap, display, g.ids[0]) : display.sectionColors[g.section];
    const side: StageLabel["side"] = g.section === "Percussion" && g.ids.length > 1 ? "top" : x < 0.5 ? "left" : "right";
    out.push({ key, text, dynamic: dyn ?? byId.get(g.ids[0])?.dynamic ?? "mp", color, x, y, side, level, partIds: g.ids });
  }
  // stable order: sections then y
  out.sort((a, b) => SECTION_ORDER.indexOf(sectionOf(a)) - SECTION_ORDER.indexOf(sectionOf(b)) || a.y - b.y);
  return out;

  function sectionOf(l: StageLabel): Section {
    const inst = infoMap.instruments.find((i) => i.id === l.partIds[0])!;
    return display.sections[inst.id] ?? inst.section;
  }
}

interface PlacedLabel extends StageLabel {
  lx: number;
  ly: number;
  line: Array<[number, number]>;
}

/** Column placement with collision avoidance, and leader lines that bend once. */
function placeLabels(labels: StageLabel[], w: number, h: number): PlacedLabel[] {
  if (!w || !h) return [];
  const minGap = 46;
  const margin = w * 0.045;
  const out: PlacedLabel[] = [];
  for (const side of ["left", "right", "top"] as const) {
    const col = labels.filter((l) => l.side === side).sort((a, b) => a.y - b.y);
    if (side === "top") {
      col.forEach((l, i) => {
        const lx = w * l.x + (i - (col.length - 1) / 2) * 110;
        const ly = h * 0.07;
        out.push({ ...l, lx, ly, line: [[lx, ly + 24], [lx, h * l.y - h * 0.05]] });
      });
      continue;
    }
    // spread vertically so labels don't overlap
    const ys = col.map((l) => h * l.y);
    for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1] + minGap) ys[i] = ys[i - 1] + minGap;
    for (let i = ys.length - 1; i >= 0; i--) {
      const limit = h - 30 - (ys.length - 1 - i) * minGap;
      if (ys[i] > limit) ys[i] = limit;
    }
    for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1] + minGap) ys[i] = ys[i - 1] + minGap;
    col.forEach((l, i) => {
      const ly = ys[i];
      const bx = w * l.x;
      const by = h * l.y;
      const lx = side === "left" ? margin : w - margin;
      const labelW = Math.min(120, Math.max(60, l.text.length * 7.2));
      const start: [number, number] = side === "left" ? [lx + labelW + 8, ly] : [lx - labelW - 8, ly];
      const reach = side === "left" ? bx - w * 0.07 : bx + w * 0.07;
      const bend: [number, number] = [side === "left" ? Math.max(start[0] + 8, reach - Math.abs(by - ly) * 0.9) : Math.min(start[0] - 8, reach + Math.abs(by - ly) * 0.9), ly];
      out.push({ ...l, lx, ly, line: [start, bend, [reach, by]] });
    });
  }
  return out;
}
