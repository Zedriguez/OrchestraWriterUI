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
 * loops a stretch of the Beethoven info map with an ambient clock.
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
        <p className="text-[12px] text-ink-4">© 2026 Orchestra Visualizer · The light follows the written score, never the recording.</p>
      </div>

      <div className="relative z-10 hidden lg:flex flex-col justify-center p-10 xl:p-14">
        <div className="relative">
          <Stage infoMap={infoMap} display={display} clock={clock} className="shadow-lg" showLegend />
          <div className="pointer-events-none absolute left-5 bottom-5 stage-glass rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-stage-text-2">
            Live demo · Symphony No. 5
          </div>
        </div>
        <div className="mt-8 max-w-lg">
          <p className="eyebrow mb-2">Tonight&apos;s program</p>
          <h2 className="display text-[2.2rem] leading-tight">
            Know which section is playing <em>at a glance.</em>
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-3">
            Brightness follows the written dynamic from <Dyn value="pp" size="sm" className="text-ink" /> to <Dyn value="fff" size="sm" className="text-ink" />. Color
            names the section. Nothing else competes for attention.
          </p>
        </div>
      </div>
    </div>
  );
}
