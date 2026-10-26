"use client";

import { useEffect } from "react";
import { useProject } from "@/lib/store/project";
import { usePlayback } from "@/lib/store/playback";

/** Loads a project into the store when the workflow layout mounts. */
export function ProjectLoader({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const loaded = useProject((s) => s.projectId === projectId && s.infoMap !== null);
  useEffect(() => {
    if (loaded) return;
    const before = useProject.getState().projectId;
    useProject.getState().load(projectId);
    const summary = useProject.getState().summary;
    if (before !== projectId) usePlayback.getState().reset(summary?.durationSec ?? 438, projectId === "beethoven-5" ? 42 : 0);
  }, [projectId, loaded]);
  if (!loaded) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-5 py-10 md:px-8">
        <div className="h-5 w-32 rounded-full shimmer mb-4" />
        <div className="h-12 w-2/3 rounded-full shimmer mb-8" />
        <div className="aspect-video w-full rounded-[var(--radius-lg)] shimmer" />
      </div>
    );
  }
  return <>{children}</>;
}
