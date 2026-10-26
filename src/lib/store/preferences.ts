"use client";

import { create } from "zustand";
import { DEFAULT_PREFERENCES, type Preferences } from "@/shared/api";
import { api } from "@/lib/api";

export type ThemeId = Preferences["theme"];

/** Debounce for PUT /api/me { preferences } after a change. */
export const PREFERENCES_SAVE_DEBOUNCE_MS = 600;

interface PreferencesState extends Preferences {
  /** true once a signed-in profile seeded the values; changes persist only then */
  hydrated: boolean;
  setTheme: (t: ThemeId) => void;
  setReducedMotion: (v: boolean) => void;
  setShowLabelsDefault: (v: boolean) => void;
  setExportResolution: (v: Preferences["exportResolution"]) => void;
  setExportFrameRate: (v: Preferences["exportFrameRate"]) => void;
  setEmailOnExport: (v: boolean) => void;
  /** seed from GET /api/me; ignored while a local change is still being saved */
  hydrateFrom: (prefs: Partial<Preferences> | null | undefined) => void;
  /** back to defaults, stop persisting (sign-out) */
  reset: () => void;
}

export function pickPreferences(s: Preferences): Preferences {
  return {
    theme: s.theme,
    reducedMotion: s.reducedMotion,
    showLabelsDefault: s.showLabelsDefault,
    exportResolution: s.exportResolution,
    exportFrameRate: s.exportFrameRate,
    emailOnExport: s.emailOnExport,
  };
}

function sanitize(prefs: Partial<Preferences> | null | undefined): Preferences {
  const p = prefs ?? {};
  return {
    theme: p.theme === "stage" ? "stage" : "program",
    reducedMotion: typeof p.reducedMotion === "boolean" ? p.reducedMotion : DEFAULT_PREFERENCES.reducedMotion,
    showLabelsDefault: typeof p.showLabelsDefault === "boolean" ? p.showLabelsDefault : DEFAULT_PREFERENCES.showLabelsDefault,
    exportResolution: p.exportResolution === "720p" || p.exportResolution === "1080p" || p.exportResolution === "4k" ? p.exportResolution : DEFAULT_PREFERENCES.exportResolution,
    exportFrameRate: p.exportFrameRate === 30 || p.exportFrameRate === 60 ? p.exportFrameRate : DEFAULT_PREFERENCES.exportFrameRate,
    emailOnExport: typeof p.emailOnExport === "boolean" ? p.emailOnExport : DEFAULT_PREFERENCES.emailOnExport,
  };
}

let timer: ReturnType<typeof setTimeout> | null = null;
let inflight = 0;

/** Preferences live on the profile (requirement 8: no localStorage). */
export const usePreferences = create<PreferencesState>((set, get) => {
  const persist = () => {
    if (!get().hydrated) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      inflight++;
      void api
        .updateProfile({ preferences: pickPreferences(get()) })
        .catch(() => {
          /* keep the local value; the next change retries */
        })
        .finally(() => {
          inflight--;
        });
    }, PREFERENCES_SAVE_DEBOUNCE_MS);
  };
  const update = (patch: Partial<Preferences>) => {
    set(patch);
    persist();
  };

  return {
    ...DEFAULT_PREFERENCES,
    hydrated: false,
    setTheme: (theme) => update({ theme }),
    setReducedMotion: (reducedMotion) => update({ reducedMotion }),
    setShowLabelsDefault: (showLabelsDefault) => update({ showLabelsDefault }),
    setExportResolution: (exportResolution) => update({ exportResolution }),
    setExportFrameRate: (exportFrameRate) => update({ exportFrameRate }),
    setEmailOnExport: (emailOnExport) => update({ emailOnExport }),
    hydrateFrom: (prefs) => {
      // A local edit is still on its way to the server: don't let an older
      // profile response roll it back.
      if (timer || inflight > 0) {
        set({ hydrated: true });
        return;
      }
      set({ ...sanitize(prefs), hydrated: true });
    },
    reset: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      set({ ...DEFAULT_PREFERENCES, hydrated: false });
    },
  };
});
