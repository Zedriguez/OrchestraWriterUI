"use client";

import { create } from "zustand";

export type ThemeId = "program" | "stage";

interface Preferences {
  theme: ThemeId;
  reducedMotion: boolean;
  showLabelsDefault: boolean;
  exportResolution: "720p" | "1080p" | "4k";
  exportFrameRate: 30 | 60;
  emailOnExport: boolean;
  setTheme: (t: ThemeId) => void;
  setReducedMotion: (v: boolean) => void;
  setShowLabelsDefault: (v: boolean) => void;
  setExportResolution: (v: Preferences["exportResolution"]) => void;
  setExportFrameRate: (v: Preferences["exportFrameRate"]) => void;
  setEmailOnExport: (v: boolean) => void;
}

/** In-memory user preferences. No localStorage in the MVP (requirement 8). */
export const usePreferences = create<Preferences>((set) => ({
  theme: "program",
  reducedMotion: false,
  showLabelsDefault: true,
  exportResolution: "1080p",
  exportFrameRate: 60,
  emailOnExport: true,
  setTheme: (theme) => set({ theme }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setShowLabelsDefault: (showLabelsDefault) => set({ showLabelsDefault }),
  setExportResolution: (exportResolution) => set({ exportResolution }),
  setExportFrameRate: (exportFrameRate) => set({ exportFrameRate }),
  setEmailOnExport: (emailOnExport) => set({ emailOnExport }),
}));
