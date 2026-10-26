"use client";

import { useCallback, useMemo, useRef } from "react";
import { Logo } from "@/components/brand/Logo";
import { Aurora } from "@/components/brand/Aurora";
import { Stage } from "@/components/visualizer/Stage";
import { buildMockInfoMap } from "@/lib/mock/info-map";
import { BEETHOVEN_5 } from "@/lib/mock/scores";
import { defaultDisplay } from "@/lib/store/project";
import { Dyn } from "@/components/music/Dyn";

/**
 * Auth frame: the form on paper, the stage alive beside it. The demo stage
 * loops a stretch of the mock Beethoven info map with an ambient clock (on
 * purpose: it is decoration, not the visitor's data).
 */
export function AuthSplit({ children }: { children: React.ReactNode }) {
  const infoMap = useMemo(() => buildMockInfoMap({ ...BEETHOVEN_5, measures: 160, durationSec: 140 }), []);
  const display = useMemo(() => ({ ...defaultDisplay(infoMap), labelMode: "sections" as const }), [infoMap]);
  const startRef = useRef<number | null>(null);
  const clock = useCallback(() => {
    if (startRef.current === null) startRef.current = performance.now();
    return ((performance.now() - startRef.current) / 1000 + 12) % 140;
  }, []);

  return (
    <div className="relative grid min-h-screen flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] overflow-hidden grain">
      <Aurora subtle />
      <div className="relative z-10 flex flex-col px-6 py-6 md:px-12 lg:px-16">
        <Logo href="/sign-in" />
        <div className="flex flex-1 items-center py-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <p className="text-[12px] text-ink-4">© 2026 Orchestra Visualizer</p>
      </div>

      <div className="relative z-10 hidden lg:flex flex-col justify-center p-10 xl:p-14">
        <Stage infoMap={infoMap} display={display} clock={clock} className="shadow-lg" showLegend />
        <p className="mt-6 max-w-lg text-[14.5px] leading-relaxed text-ink-3">
          Brightness follows the written dynamic, <Dyn value="pp" size="sm" className="text-ink" /> to <Dyn value="fff" size="sm" className="text-ink" />; color names
          the section.
        </p>
      </div>
    </div>
  );
}
