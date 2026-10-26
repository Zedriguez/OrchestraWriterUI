"use client";

import { useState } from "react";
import { Check, Package } from "lucide-react";
import { api } from "@/lib/api";
import { useJob } from "@/lib/api/useJob";
import type { ExportResult } from "@/shared/jobs";
import { useProject } from "@/lib/store/project";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { FailureRow, FilenameField, isActive, JobLine, ResultRow, slugify, useOnComplete, type HistoryRow } from "./shared";

const CARRIES = ["Score", "Audio", "Alignment markers", "Confidence", "Display settings"];

export function ProjectFileCard({
  projectId,
  defaultName,
  onComplete,
}: {
  projectId: string;
  defaultName: string;
  onComplete: (row: HistoryRow) => void;
}) {
  const markSaved = useProject((s) => s.markSaved);
  const [filename, setFilename] = useState(defaultName);
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useJob<ExportResult>(jobId);
  const running = isActive(job);

  useOnComplete(job, "project", (row) => {
    markSaved();
    onComplete(row);
  });

  const start = async () => {
    const name = slugify(filename) || defaultName;
    setFilename(name);
    const next = await api.exportProjectFile(projectId, name);
    setJobId(next.id);
  };

  return (
    <section className="card flex flex-col p-6">
      <p className="eyebrow mb-2">Project file</p>
      <h2 className="display text-[1.8rem]">
        Save the project <em>.ovproj</em>
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        One file that round-trips everything: the score, the audio (or the flag that playback is generated), alignment markers with
        their confidence, and every display setting. Open it later from Import to pick up exactly where you left off.
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {CARRIES.map((c) => (
          <Chip key={c} tone="neutral">
            <Check size={11} className="text-brass" />
            {c}
          </Chip>
        ))}
      </div>

      <div className="mt-6 flex-1">
        <FilenameField id="project-filename" value={filename} onChange={setFilename} suffix=".ovproj" disabled={running} />
      </div>

      <div className="mt-6">
        {!job && (
          <Button variant="brass" leading={<Package size={15} />} onClick={start} disabled={!filename.trim()}>
            Save project file
          </Button>
        )}
        {job && running && <JobLine job={job} />}
        {job?.status === "succeeded" && job.result && (
          <ResultRow icon={<Package size={15} />} result={job.result} onAgain={() => setJobId(null)} againLabel="Export again" />
        )}
        {job?.status === "failed" && <FailureRow error={job.error ?? "The project file could not be written."} onRetry={start} />}
      </div>
    </section>
  );
}
