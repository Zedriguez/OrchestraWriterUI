"use client";

import { useEffect, useRef, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ProjectDto } from "@/shared/api";
import { api, errorMessage } from "@/lib/api";
import { useProject } from "@/lib/store/project";
import { usePlayback } from "@/lib/store/playback";
import { Button } from "@/components/ui/Button";

/** One create per `/projects/new` visit, shared across StrictMode re-mounts. */
let createInFlight: Promise<ProjectDto> | null = null;

/**
 * Loads a project into the store when the workflow layout mounts. `new`
 * creates a project and replaces the URL with its id; otherwise the project,
 * its info map and audio URL are fetched. Shows a shimmer while loading, the
 * not-found page for unknown ids, and a retry card on failure.
 */
export function ProjectLoader({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const router = useRouter();
  const isNew = projectId === "new";
  const status = useProject((s) => s.status);
  const loadedId = useProject((s) => s.projectId);
  const error = useProject((s) => s.error);
  const durationSec = useProject((s) => s.summary?.durationSec ?? null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lastReset = useRef<string | null>(null);

  useEffect(() => {
    if (!isNew) {
      void useProject.getState().load(projectId);
      return;
    }
    let cancelled = false;
    createInFlight ??= api.createProject();
    createInFlight
      .then((project) => {
        if (!cancelled) router.replace(`/projects/${project.id}/import`);
      })
      .catch((err: unknown) => {
        if (!cancelled) setCreateError(errorMessage(err, "The project could not be created"));
      })
      .finally(() => {
        createInFlight = null;
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, isNew, router, attempt]);

  const ready = !isNew && status === "ready" && loadedId === projectId;

  // One transport reset per project: the recording engine (WS3) corrects the
  // duration once it has loaded metadata.
  useEffect(() => {
    if (!ready || lastReset.current === projectId) return;
    lastReset.current = projectId;
    usePlayback.getState().reset(durationSec ?? 0);
  }, [ready, projectId, durationSec]);

  if (!isNew && status === "not-found" && loadedId === projectId) notFound();

  const failure = createError ?? (!isNew && status === "error" && loadedId === projectId ? error : null);
  if (failure) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-5 py-10 md:px-8">
        <div className="card mx-auto max-w-lg p-8 text-center" role="alert">
          <AlertTriangle size={22} className="mx-auto mb-4 text-conf-low" aria-hidden />
          <h1 className="display mb-2 text-2xl">{isNew ? "Could not start a project" : "Could not open this project"}</h1>
          <p className="mb-6 text-sm text-ink-3">{failure}</p>
          <Button
            leading={<RefreshCw size={14} />}
            onClick={() => {
              if (isNew) {
                setCreateError(null);
                setAttempt((n) => n + 1);
              } else {
                useProject.setState({ projectId: null, status: "idle", error: null });
                void useProject.getState().load(projectId);
              }
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-5 py-10 md:px-8" aria-busy="true" aria-live="polite">
        <div className="h-5 w-32 rounded-full shimmer mb-4" />
        <div className="h-12 w-2/3 rounded-full shimmer mb-8" />
        <div className="aspect-video w-full rounded-[var(--radius-lg)] shimmer" />
      </div>
    );
  }
  return <>{children}</>;
}
