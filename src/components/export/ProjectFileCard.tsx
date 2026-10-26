"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import type { ExportResult } from "@/shared/jobs";
import { api } from "@/lib/api";
import { useProject } from "@/lib/store/project";
import { Button } from "@/components/ui/Button";
import { useProjectJob } from "@/components/import/projectJobs";
import { FailureRow, FilenameField, isActive, JobLine, ResultRow, slugify } from "./shared";

export function ProjectFileCard({ projectId, defaultName, onExported }: { projectId: string; defaultName: string; onExported: () => void }) {
  const [filename, setFilename] = useState(defaultName);
  const [startError, setStartError] = useState<string | null>(null);
  const { job, start, clear } = useProjectJob<ExportResult>(`${projectId}:project-file`, { onSucceeded: onExported });
  const running = isActive(job);

  const run = async () => {
    const name = slugify(filename) || defaultName;
    setFilename(name);
    setStartError(null);
    try {
      // the file is packed from the server copy: write pending edits first
      await useProject.getState().saveNow();
      await start(() => api.exportProjectFile(projectId, name));
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "The export could not start.");
    }
  };

  return (
    <section className="card flex flex-col p-6" aria-labelledby="project-file-title">
      <h2 id="project-file-title" className="font-serif text-xl text-ink">
        Project file
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        The score, the recording, alignment markers and every display setting in one .ovproj file. Open it later from Import.
      </p>

      <div className="mt-5 flex-1">
        <FilenameField id="project-filename" value={filename} onChange={setFilename} suffix=".ovproj" disabled={running} />
      </div>

      <div className="mt-6">
        {!job && !startError && (
          <Button variant="brass" leading={<Package size={15} />} onClick={run} disabled={!filename.trim()}>
            Save project file
          </Button>
        )}
        {startError && <FailureRow error={startError} onRetry={run} />}
        {job && running && <JobLine job={job} />}
        {job?.status === "succeeded" && job.result && <ResultRow icon={<Package size={15} />} result={job.result} onAgain={clear} againLabel="Save again" />}
        {job?.status === "failed" && <FailureRow error={job.error ?? "The project file could not be written."} onRetry={run} />}
      </div>
    </section>
  );
}
