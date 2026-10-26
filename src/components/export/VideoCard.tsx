"use client";

import { useState, type ReactNode } from "react";
import { Film } from "lucide-react";
import { api, type ExportMp4Options } from "@/lib/api";
import { useJob } from "@/lib/api/useJob";
import type { ExportResult } from "@/shared/jobs";
import { usePreferences } from "@/lib/store/preferences";
import { formatBytes, formatTime } from "@/lib/utils/format";
import { Button, Spinner } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Tooltip } from "@/components/ui/Tooltip";
import { FailureRow, FilenameField, isActive, JobLine, ResultRow, slugify, useElapsed, useOnComplete, type HistoryRow } from "./shared";

type Resolution = ExportMp4Options["resolution"];
type FrameRate = "30" | "60";
type Audio = ExportMp4Options["audio"];

/** Rough H.264 bitrates (Mbps) at 60 fps; 30 fps is about three quarters. */
const MBPS: Record<Resolution, number> = { "720p": 1.75, "1080p": 3.4, "4k": 11.2 };

export function estimateBytes(resolution: Resolution, frameRate: 30 | 60, durationSec: number) {
  const mbps = MBPS[resolution] * (frameRate === 30 ? 0.75 : 1);
  return Math.round((mbps * 1_000_000 * durationSec) / 8);
}

export function VideoCard({
  projectId,
  defaultName,
  durationSec,
  hasRecording,
  onComplete,
}: {
  projectId: string;
  defaultName: string;
  durationSec: number;
  hasRecording: boolean;
  onComplete: (row: HistoryRow) => void;
}) {
  const prefResolution = usePreferences((s) => s.exportResolution);
  const prefFrameRate = usePreferences((s) => s.exportFrameRate);

  const [resolution, setResolution] = useState<Resolution>(prefResolution);
  const [frameRate, setFrameRate] = useState<FrameRate>(String(prefFrameRate) as FrameRate);
  const [audio, setAudio] = useState<Audio>(hasRecording ? "uploaded" : "generated");
  const [filename, setFilename] = useState(`${defaultName}-${prefResolution}`);
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useJob<ExportResult>(jobId);
  const running = isActive(job);
  const elapsed = useElapsed(job);

  useOnComplete(job, "mp4", onComplete);

  const fps = Number(frameRate) as 30 | 60;
  const estimate = estimateBytes(resolution, fps, durationSec);

  const start = async () => {
    const name = slugify(filename) || defaultName;
    setFilename(name);
    const next = await api.exportMp4({ projectId, filename: name, resolution, frameRate: fps, audio });
    setJobId(next.id);
  };

  const audioControl = (
    <Segmented<Audio>
      ariaLabel="Audio"
      size="sm"
      value={audio}
      onChange={setAudio}
      options={[
        { value: "uploaded", label: "Uploaded recording", disabled: !hasRecording },
        { value: "generated", label: "Generated from score" },
      ]}
    />
  );

  return (
    <section className="card flex flex-col p-6">
      <p className="eyebrow mb-2">Video</p>
      <h2 className="display text-[1.8rem]">
        Render a video <em>.mp4</em>
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        The full visualization with audio, for lobby screens, LED walls or sharing. Brightness follows the written dynamic, colour follows
        the section, exactly as in Preview.
      </p>

      <div className="mt-5 space-y-3">
        <SettingRow label="Resolution">
          <Segmented<Resolution>
            ariaLabel="Resolution"
            size="sm"
            value={resolution}
            onChange={setResolution}
            options={[
              { value: "720p", label: "720p" },
              { value: "1080p", label: "1080p" },
              { value: "4k", label: "4K" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Frame rate">
          <Segmented<FrameRate>
            ariaLabel="Frame rate"
            size="sm"
            value={frameRate}
            onChange={setFrameRate}
            options={[
              { value: "30", label: "30 fps" },
              { value: "60", label: "60 fps" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Audio">
          {hasRecording ? audioControl : <Tooltip label="No recording uploaded · playback is generated from the score">{audioControl}</Tooltip>}
        </SettingRow>
      </div>

      <div className="mt-5 flex-1">
        <FilenameField id="video-filename" value={filename} onChange={setFilename} suffix=".mp4" disabled={running} />
        <p className="tnum mt-2 text-xs text-ink-3">
          Estimated size ≈ {formatBytes(estimate)} · {formatTime(durationSec)} at {resolution === "4k" ? "4K" : resolution}, {fps} fps
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {!job && (
          <Button variant="primary" leading={<Film size={15} />} onClick={start} disabled={!filename.trim()}>
            Render MP4
          </Button>
        )}
        {job && running && (
          <>
            <RenderStrip message={job.status === "queued" ? "Queued" : job.message} elapsed={elapsed} />
            <JobLine job={job} trailing={<> · {formatTime(elapsed)} elapsed</>} />
          </>
        )}
        {job?.status === "succeeded" && job.result && (
          <ResultRow icon={<Film size={15} />} result={job.result} onAgain={() => setJobId(null)} againLabel="Render another" />
        )}
        {job?.status === "failed" && <FailureRow error={job.error ?? "The render did not finish."} onRetry={start} />}
      </div>

      <p className="mt-4 text-xs text-ink-3">Exports render with the same visualizer as Preview, headless on the server.</p>
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

/** A dark stage strip that stands in for the frames being rendered. */
function RenderStrip({ message, elapsed }: { message: string; elapsed: number }) {
  return (
    <div className="stage-frame aspect-[16/6] w-full">
      <div className="shimmer absolute inset-0 opacity-[0.07]" aria-hidden />
      <div className="absolute inset-0" aria-hidden>
        <span className="absolute left-[22%] top-[58%] h-14 w-14 rounded-full bg-sec-strings opacity-70 blur-xl animate-pulse" />
        <span className="absolute left-[68%] top-[60%] h-14 w-14 rounded-full bg-sec-strings opacity-50 blur-xl animate-pulse [animation-delay:400ms]" />
        <span className="absolute left-[46%] top-[34%] h-12 w-12 rounded-full bg-sec-woodwinds opacity-60 blur-xl animate-pulse [animation-delay:800ms]" />
        <span className="absolute left-[46%] top-[12%] h-16 w-16 rounded-full bg-sec-brass opacity-80 blur-2xl animate-pulse [animation-delay:200ms]" />
        <span className="absolute left-[80%] top-[14%] h-10 w-10 rounded-full bg-sec-percussion opacity-40 blur-xl animate-pulse [animation-delay:1000ms]" />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 py-3 text-[12px] text-stage-text-2">
        <span className="flex min-w-0 items-center gap-2">
          <Spinner className="h-3 w-3 border-[1.5px] shrink-0" />
          <span className="truncate">{message}</span>
        </span>
        <span className="tnum shrink-0">{formatTime(elapsed)}</span>
      </div>
    </div>
  );
}
