"use client";

import { useState, type ReactNode } from "react";
import { Film, Info } from "lucide-react";
import { api, type ExportMp4Options } from "@/lib/api";
import { cancelJob } from "@/lib/jobs/registry";
import type { ExportResult } from "@/shared/jobs";
import { estimateMp4Bytes, mp4ExportUnsupportedReason } from "@/lib/export";
import { useProject } from "@/lib/store/project";
import { usePreferences } from "@/lib/store/preferences";
import { formatBytes, formatTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { useProjectJob } from "@/components/import/projectJobs";
import { FailureRow, FilenameField, isActive, JobLine, ResultRow, slugify, useElapsed } from "./shared";

type Resolution = ExportMp4Options["resolution"];
type FrameRate = "30" | "60";
type Audio = ExportMp4Options["audio"];

const RESOLUTION_LABEL: Record<Resolution, string> = { "720p": "720p", "1080p": "1080p", "4k": "4K" };

export function VideoCard({
  projectId,
  defaultName,
  hasRecording,
  durations,
  onExported,
}: {
  projectId: string;
  defaultName: string;
  hasRecording: boolean;
  /** seconds of video for each audio source */
  durations: { uploaded: number; generated: number };
  onExported: () => void;
}) {
  const prefResolution = usePreferences((s) => s.exportResolution);
  const prefFrameRate = usePreferences((s) => s.exportFrameRate);
  const [unsupported] = useState(() => mp4ExportUnsupportedReason());

  const [resolution, setResolution] = useState<Resolution>(prefResolution);
  const [frameRate, setFrameRate] = useState<FrameRate>(String(prefFrameRate) as FrameRate);
  const [audio, setAudio] = useState<Audio>(hasRecording ? "uploaded" : "generated");
  // follows the resolution until the user types a name
  const [customName, setCustomName] = useState<string | null>(null);
  const filename = customName ?? `${defaultName}-${resolution}`;
  const [startError, setStartError] = useState<string | null>(null);

  const { job, start, clear } = useProjectJob<ExportResult>(`${projectId}:mp4`, { onSucceeded: onExported });
  const running = isActive(job);
  const elapsed = useElapsed(job);

  const fps = Number(frameRate) as 30 | 60;
  const source: Audio = hasRecording ? audio : "generated";
  const durationSec = source === "uploaded" ? durations.uploaded : durations.generated;
  const estimate = estimateMp4Bytes(durationSec, resolution, fps);

  const run = async () => {
    const name = slugify(filename) || defaultName;
    setCustomName(name);
    setStartError(null);
    try {
      // the render reads display settings and markers from the server copy
      await useProject.getState().saveNow();
      await start(() => api.exportMp4({ projectId, filename: name, resolution, frameRate: fps, audio: source }));
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "The render could not start.");
    }
  };

  return (
    <section className="card flex flex-col p-6" aria-labelledby="video-title">
      <h2 id="video-title" className="font-serif text-xl text-ink">
        Video (MP4)
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">The visualization with audio, rendered with the same stage as Preview.</p>

      <div className="mt-5 space-y-3">
        <SettingRow label="Resolution">
          <Segmented<Resolution>
            ariaLabel="Resolution"
            size="sm"
            value={resolution}
            onChange={setResolution}
            options={(["720p", "1080p", "4k"] as const).map((r) => ({ value: r, label: RESOLUTION_LABEL[r], disabled: running }))}
          />
        </SettingRow>
        <SettingRow label="Frame rate">
          <Segmented<FrameRate>
            ariaLabel="Frame rate"
            size="sm"
            value={frameRate}
            onChange={setFrameRate}
            options={[
              { value: "30", label: "30 fps", disabled: running },
              { value: "60", label: "60 fps", disabled: running },
            ]}
          />
        </SettingRow>
        <SettingRow label="Audio">
          <Segmented<Audio>
            ariaLabel="Audio"
            size="sm"
            value={source}
            onChange={setAudio}
            options={[
              { value: "uploaded", label: "Uploaded recording", disabled: !hasRecording || running },
              { value: "generated", label: "Generated from score", disabled: running },
            ]}
          />
        </SettingRow>
      </div>

      <div className="mt-5 flex-1">
        <FilenameField id="video-filename" value={filename} onChange={setCustomName} suffix=".mp4" disabled={running} />
        <p className="tnum mt-2 text-xs text-ink-3">
          About {formatBytes(estimate)} · {formatTime(durationSec)} at {RESOLUTION_LABEL[resolution]}, {fps} fps
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {unsupported ? (
          <p className="flex items-start gap-2 rounded-[var(--radius)] bg-paper-3 p-3 text-[13px] leading-relaxed text-ink-2" role="note">
            <Info size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
            {unsupported}
          </p>
        ) : (
          <>
            {!job && !startError && (
              <Button variant="primary" leading={<Film size={15} />} onClick={run} disabled={!filename.trim()}>
                Render MP4
              </Button>
            )}
            {startError && <FailureRow error={startError} onRetry={run} />}
            {job && running && (
              <div className="space-y-2">
                <JobLine job={job} trailing={<> · {formatTime(elapsed)} elapsed</>} />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-ink-3">Rendering runs in this tab. Keep it open until the video is ready.</p>
                  <Button variant="ghost" size="sm" onClick={() => cancelJob(job.id)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {job?.status === "succeeded" && job.result && <ResultRow icon={<Film size={15} />} result={job.result} onAgain={clear} againLabel="Render another" />}
            {job?.status === "failed" && <FailureRow error={job.error ?? "The render did not finish."} onRetry={run} />}
          </>
        )}
      </div>
    </section>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
    </div>
  );
}
