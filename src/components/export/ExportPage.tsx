"use client";

import { useCallback, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useProject } from "@/lib/store/project";
import { PageHeader, Dot } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { ProjectFileCard } from "./ProjectFileCard";
import { VideoCard } from "./VideoCard";
import { ExportHistory, mockHistory } from "./ExportHistory";
import { slugify, type HistoryRow } from "./shared";

export function ExportPage({ projectId }: { projectId: string }) {
  const summary = useProject((s) => s.summary);
  const infoMap = useProject((s) => s.infoMap)!;

  // A project created at /projects/new has no summary in the mock; fall back to the info map.
  const title = summary?.title ?? "Untitled project";
  const movement = summary?.movement ?? null;
  const parts = summary?.parts ?? infoMap.instruments.length;
  const durationSec = summary?.durationSec ?? infoMap.duration;
  const hasRecording = summary?.hasRecording ?? false;
  const slug = slugify(title);

  const [history, setHistory] = useState<HistoryRow[]>(() => mockHistory(slug));
  const record = useCallback((row: HistoryRow) => setHistory((h) => [row, ...h]), []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 5 of 5 · Export"
        title="Take it with you"
        meta={
          <>
            <span>
              {title}
              {summary?.subtitle && <em className="font-serif"> {summary.subtitle}</em>}
            </span>
            {movement && (
              <>
                <Dot />
                <span>{movement}</span>
              </>
            )}
            <Dot />
            <span className="tnum">{parts} parts</span>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ProjectFileCard projectId={projectId} defaultName={slug} onComplete={record} />
        <VideoCard projectId={projectId} defaultName={slug} durationSec={durationSec} hasRecording={hasRecording} onComplete={record} />
      </div>

      <ExportHistory rows={history} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
        <Button variant="ghost" href={`/projects/${projectId}/preview`} leading={<ArrowLeft size={14} />}>
          Back to Preview
        </Button>
        <Button variant="outline" href="/library" leading={<Check size={14} />}>
          Done · Back to library
        </Button>
      </div>
    </div>
  );
}
