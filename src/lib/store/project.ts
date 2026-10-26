"use client";

import { create } from "zustand";
import type { InfoMap } from "@/shared/info-map";
import type { DisplaySettings, PartPosition } from "@/shared/project-file";
import { DEFAULT_SECTION_COLORS, type Section } from "@/shared/sections";
import type { ManualMarker, SyncState } from "@/shared/sync";
import type { ProjectSummary } from "@/shared/domain";
import { buildMockInfoMap } from "@/lib/mock/info-map";
import { specForProject } from "@/lib/mock/scores";
import { buildMockAlignment } from "@/lib/mock/sync";
import { getProject } from "@/lib/mock/library";
import { defaultPositions } from "@/lib/visualizer/seating";

export function defaultDisplay(infoMap: InfoMap): DisplaySettings {
  return {
    visibleParts: infoMap.instruments.map((i) => i.id),
    positions: defaultPositions(infoMap.instruments),
    colors: {},
    sectionColors: { ...DEFAULT_SECTION_COLORS },
    sections: {},
    showLabels: true,
    labelMode: "sections",
    reducedMotion: false,
    glowScale: 1,
  };
}

interface ProjectState {
  projectId: string | null;
  summary: ProjectSummary | null;
  infoMap: InfoMap | null;
  display: DisplaySettings | null;
  sync: SyncState | null;
  dirty: boolean;
  savedAt: string | null;
  load: (id: string) => void;
  // display
  setVisible: (id: string, visible: boolean) => void;
  setSectionVisible: (section: Section, visible: boolean) => void;
  soloPart: (id: string) => void;
  setPartColor: (id: string, color: string | null) => void;
  setSectionColor: (section: Section, color: string) => void;
  setPartSection: (id: string, section: Section) => void;
  setPosition: (id: string, pos: PartPosition) => void;
  resetPositions: () => void;
  resetColors: () => void;
  setShowLabels: (v: boolean) => void;
  setLabelMode: (m: DisplaySettings["labelMode"]) => void;
  setReducedMotion: (v: boolean) => void;
  setGlowScale: (v: number) => void;
  // sync
  addMarker: (measure: number, startSec: number) => void;
  nudgeMarker: (measure: number, deltaSec: number) => void;
  removeMarker: (measure: number) => void;
  replaceAuto: (sync: SyncState) => void;
  // persistence
  markSaved: () => void;
}

const cache = new Map<string, { infoMap: InfoMap; sync: SyncState | null }>();

function materialize(id: string) {
  const summary = getProject(id) ?? null;
  const cached = cache.get(id);
  if (cached) return { summary, ...cached };
  const spec = specForProject(id);
  const infoMap = buildMockInfoMap(spec);
  const sync = summary?.hasRecording ? buildMockAlignment(infoMap, spec.seed) : null;
  cache.set(id, { infoMap, sync });
  return { summary, infoMap, sync };
}

export const useProject = create<ProjectState>((set, get) => ({
  projectId: null,
  summary: null,
  infoMap: null,
  display: null,
  sync: null,
  dirty: false,
  savedAt: null,

  load: (id) => {
    if (get().projectId === id && get().infoMap) return;
    const { summary, infoMap, sync } = materialize(id);
    set({ projectId: id, summary, infoMap, sync, display: defaultDisplay(infoMap), dirty: false, savedAt: summary?.updatedAt ?? null });
  },

  setVisible: (id, visible) =>
    set((s) => {
      if (!s.display) return s;
      const setV = new Set(s.display.visibleParts);
      if (visible) setV.add(id);
      else setV.delete(id);
      return { display: { ...s.display, visibleParts: [...setV] }, dirty: true };
    }),

  setSectionVisible: (section, visible) =>
    set((s) => {
      if (!s.display || !s.infoMap) return s;
      const setV = new Set(s.display.visibleParts);
      for (const inst of s.infoMap.instruments) {
        const sec = s.display.sections[inst.id] ?? inst.section;
        if (sec !== section) continue;
        if (visible) setV.add(inst.id);
        else setV.delete(inst.id);
      }
      return { display: { ...s.display, visibleParts: [...setV] }, dirty: true };
    }),

  soloPart: (id) =>
    set((s) => {
      if (!s.display || !s.infoMap) return s;
      const only = s.display.visibleParts.length === 1 && s.display.visibleParts[0] === id;
      return {
        display: { ...s.display, visibleParts: only ? s.infoMap.instruments.map((i) => i.id) : [id] },
        dirty: true,
      };
    }),

  setPartColor: (id, color) =>
    set((s) => {
      if (!s.display) return s;
      const colors = { ...s.display.colors };
      if (color) colors[id] = color;
      else delete colors[id];
      return { display: { ...s.display, colors }, dirty: true };
    }),

  setSectionColor: (section, color) =>
    set((s) => (s.display ? { display: { ...s.display, sectionColors: { ...s.display.sectionColors, [section]: color } }, dirty: true } : s)),

  setPartSection: (id, section) =>
    set((s) => (s.display ? { display: { ...s.display, sections: { ...s.display.sections, [id]: section } }, dirty: true } : s)),

  setPosition: (id, pos) =>
    set((s) => (s.display ? { display: { ...s.display, positions: { ...s.display.positions, [id]: pos } }, dirty: true } : s)),

  resetPositions: () =>
    set((s) =>
      s.display && s.infoMap
        ? { display: { ...s.display, positions: defaultPositions(s.infoMap.instruments, s.display.sections) }, dirty: true }
        : s,
    ),

  resetColors: () =>
    set((s) => (s.display ? { display: { ...s.display, colors: {}, sectionColors: { ...DEFAULT_SECTION_COLORS } }, dirty: true } : s)),

  setShowLabels: (showLabels) => set((s) => (s.display ? { display: { ...s.display, showLabels }, dirty: true } : s)),
  setLabelMode: (labelMode) => set((s) => (s.display ? { display: { ...s.display, labelMode }, dirty: true } : s)),
  setReducedMotion: (reducedMotion) => set((s) => (s.display ? { display: { ...s.display, reducedMotion }, dirty: true } : s)),
  setGlowScale: (glowScale) => set((s) => (s.display ? { display: { ...s.display, glowScale }, dirty: true } : s)),

  addMarker: (measure, startSec) =>
    set((s) => {
      if (!s.sync) return s;
      const manual = s.sync.manual.filter((m) => m.measure !== measure);
      const marker: ManualMarker = { id: `mk_${measure}_${Date.now().toString(36)}`, measure, startSec, createdAt: new Date().toISOString() };
      return { sync: { ...s.sync, manual: [...manual, marker].sort((a, b) => a.measure - b.measure) }, dirty: true };
    }),

  nudgeMarker: (measure, deltaSec) =>
    set((s) => {
      if (!s.sync) return s;
      const existing = s.sync.manual.find((m) => m.measure === measure);
      const base = existing?.startSec ?? s.sync.auto.find((a) => a.n === measure)?.startSec ?? 0;
      const startSec = Math.max(0, base + deltaSec);
      const manual = s.sync.manual.filter((m) => m.measure !== measure);
      const marker: ManualMarker = {
        id: existing?.id ?? `mk_${measure}_${Date.now().toString(36)}`,
        measure,
        startSec,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      return { sync: { ...s.sync, manual: [...manual, marker].sort((a, b) => a.measure - b.measure) }, dirty: true };
    }),

  removeMarker: (measure) =>
    set((s) => (s.sync ? { sync: { ...s.sync, manual: s.sync.manual.filter((m) => m.measure !== measure) }, dirty: true } : s)),

  replaceAuto: (sync) => set((s) => ({ sync: { ...sync, manual: s.sync?.manual ?? [] }, dirty: true })),

  markSaved: () => set({ dirty: false, savedAt: new Date().toISOString() }),
}));
