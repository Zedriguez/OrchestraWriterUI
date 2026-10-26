"use client";

import { useEffect } from "react";
import { usePreferences } from "@/lib/store/preferences";

/** Mirrors preferences onto <html> so tokens switch (Direction A ↔ B, reduced motion). */
export function ThemeSync() {
  const theme = usePreferences((s) => s.theme);
  const reducedMotion = usePreferences((s) => s.reducedMotion);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "stage") root.setAttribute("data-theme", "stage");
    else root.removeAttribute("data-theme");
    root.setAttribute("data-reduced-motion", String(reducedMotion));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "stage" ? "#0d1014" : "#f6f2ea");
  }, [theme, reducedMotion]);
  return null;
}
