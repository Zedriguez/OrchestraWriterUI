"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, AudioLines, FolderOpen, Info, Music2, RefreshCw, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { useJob } from "@/lib/api/useJob";
import type { Job, ParseScoreResult } from "@/shared/jobs";
import { useProject } from "@/lib/store/project";
import { cx, formatBytes, formatTime } from "@/lib/utils/format";
import { Aurora } from "@/components/brand/Aurora";
import { PageHeader, Dot } from "@/components/shell/PageHeader";
import { Button, Spinner } from "@/components/ui/Button";
import { Chip, type ChipTone } from "@/components/ui/Chip";
import { Progress } from "@/components/ui/Progress";
import { Dropzone, hasExtension } from "./Dropzone";

const SCORE_EXT = [".musicxml", ".xml", ".mxl"];
const AUDIO_EXT = [".mp3"];
const PROJECT_EXT = [".ovproj"];

/**
 * The mock API has no persistence: a project created at /projects/new never
 * becomes a real record. Once a score is parsed we continue into the demo
 * project so the rest of the workflow has data to show.
 */
const DEMO_PROJECT_ID = "beethoven-5";

type Phase = "empty" | "processing" | "done" | "failed";

interface Parsed {
  title: string;
  composer: string;
  movement: string;
  parts: number;
  measures: number;
  durationSec: number;
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/* Upload state: one picked file, one job, one type error              */
/* ------------------------------------------------------------------ */

function useUpload<T>(start: (file: File) => Promise<Job<T>>, allowed: string[], typeMessage: string) {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const job = useJob<T>(jobId);

  const submit = async (f: File) => {
    setFile(f);
    if (!hasExtension(f.name, allowed)) {
      setJobId(null);
      setTypeError(typeMessage);
      return;
    }
    setTypeError(null);
    const next = await start(f);
    setJobId(next.id);
  };
  const retry = () => {
    if (file) void submit(file);
  };

  return { file, job, typeError, submit, retry };
}

function phaseOf(job: Job<unknown> | null, typeError: string | null, existing: boolean): Phase {
  if (job) return job.status === "succeeded" ? "done" : job.status === "failed" ? "failed" : "processing";
  if (typeError) return "failed";
  return existing ? "done" : "empty";
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function ImportPage({ projectId }: { projectId: string }) {
  const isNew = projectId === "new";
  const summary = useProject((s) => s.summary);
  const infoMap = useProject((s) => s.infoMap);
  const existing = isNew ? null : summary;

  const score = useUpload<ParseScoreResult>(
    (f) => api.uploadScore(projectId, f),
    SCORE_EXT,
    "That isn't a MusicXML file. Choose a .musicxml, .xml or .mxl export from your notation software.",
  );
  const audio = useUpload<void>((f) => api.uploadAudio(projectId, f), AUDIO_EXT, "That isn't an MP3. Other audio formats are a later phase.");

  const scorePhase = phaseOf(score.job, score.typeError, Boolean(existing?.scoreName));
  const audioPhase = phaseOf(audio.job, audio.typeError, Boolean(existing?.hasRecording));

  // The parsed summary: the fresh job result wins; otherwise the stored project.
  const parsed: Parsed | null = useMemo(() => {
    if (score.job?.status === "succeeded" && score.job.result) return score.job.result;
    if (existing) {
      return {
        title: existing.title,
        composer: existing.composer,
        movement: existing.movement,
        parts: existing.parts,
        measures: existing.measures,
        durationSec: existing.durationSec,
        warnings: infoMap?.warnings ?? [],
      };
    }
    return null;
  }, [score.job, existing, infoMap]);

  const scoreReady = scorePhase === "done";
  const hasRecording = audioPhase === "done";
  const targetId = isNew ? DEMO_PROJECT_ID : projectId;
  const continueHref = `/projects/${targetId}/${hasRecording ? "sync" : "customize"}`;

  const infoMapState: Phase =
    scorePhase === "done" ? "done" : scorePhase === "processing" && (score.job?.progress ?? 0) >= 0.7 ? "processing" : "empty";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 1 of 5 · Import"
        title="Bring in the score"
        meta={
          <>
            <span>MusicXML required</span>
            <Dot />
            <span>MP3 optional</span>
            {existing && (
              <>
                <Dot />
                <span>{existing.title}</span>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <ScoreCard upload={score} phase={scorePhase} existingName={existing?.scoreName ?? null} parsed={parsed} />
            <RecordingCard
              upload={audio}
              phase={audioPhase}
              existingName={existing?.hasRecording ? (existing.recordingName ?? null) : null}
              durationSec={parsed?.durationSec ?? 438}
            />
          </div>

          {parsed && scoreReady && <FileSummary parsed={parsed} className="fade-up" />}

          <OpenProjectCard targetId={targetId} />

          <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-3">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>Up to 64 parts. Repeats are expanded. Jumps (D.S., D.C.) are ignored and reported as a warning.</span>
          </p>
        </div>

        <StatusRail
          score={scorePhase}
          scoreName={score.file?.name ?? existing?.scoreName ?? null}
          recording={audioPhase}
          recordingName={audio.file?.name ?? (existing?.hasRecording ? (existing.recordingName ?? null) : null)}
          infoMap={infoMapState}
          hasRecording={hasRecording}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
        <Button variant="ghost" href="/library" leading={<ArrowLeft size={14} />}>
          Back to library
        </Button>
        {scoreReady ? (
          <Button variant="primary" href={continueHref} trailing={<ArrowRight size={14} />}>
            Continue to {hasRecording ? "Sync" : "Customize"}
          </Button>
        ) : (
          <Button variant="primary" disabled trailing={<ArrowRight size={14} />}>
            Continue to {hasRecording ? "Sync" : "Customize"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Score                                                                */
/* ------------------------------------------------------------------ */

function ScoreCard({
  upload,
  phase,
  existingName,
  parsed,
}: {
  upload: ReturnType<typeof useUpload<ParseScoreResult>>;
  phase: Phase;
  existingName: string | null;
  parsed: Parsed | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = () => inputRef.current?.click();
  const name = upload.file?.name ?? existingName ?? "";
  const job = upload.job;

  return (
    <section className="card flex flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Score · required</p>
          <h2 className="display text-[1.5rem]">MusicXML</h2>
        </div>
        {phase === "done" && (
          <Button variant="outline" size="sm" leading={<RefreshCw size={13} />} onClick={pick}>
            Replace
          </Button>
        )}
      </div>

      {phase === "empty" && (
        <Dropzone label="Drop a MusicXML score or browse" onFile={(f) => void upload.submit(f)} onOpen={pick} className="grain flex-1">
          <Aurora subtle />
          <EmptyHero icon={<Music2 size={16} />} title="Drop your score here" hint=".musicxml, .xml or .mxl" />
        </Dropzone>
      )}

      {phase === "processing" && job && (
        <ProcessingBox name={name} size={upload.file?.size}>
          <div className="mt-4 flex items-center justify-between text-[13px]">
            <span className="text-ink-2">{job.status === "queued" ? "Queued" : job.message}…</span>
            <span className="tnum text-ink-3">{Math.round(job.progress * 100)}%</span>
          </div>
          <Progress value={job.progress} className="mt-2" />
        </ProcessingBox>
      )}

      {phase === "failed" && (
        <FailureBox name={name} error={job?.error ?? upload.typeError ?? "The score could not be read."} onChoose={pick} onRetry={job ? upload.retry : undefined} />
      )}

      {phase === "done" && (
        <FileRow
          icon={<Music2 size={15} />}
          name={name}
          detail={parsed ? `Parsed · ${parsed.parts} parts · ${parsed.measures} measures` : "Parsed"}
        />
      )}

      <p className="mt-4 text-xs text-ink-3">MusicXML today — Sibelius and PDF are a later phase.</p>
      <input ref={inputRef} type="file" accept=".musicxml,.xml,.mxl" className="hidden" onChange={(e) => pickFrom(e.target, upload.submit)} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Recording                                                            */
/* ------------------------------------------------------------------ */

function RecordingCard({
  upload,
  phase,
  existingName,
  durationSec,
}: {
  upload: ReturnType<typeof useUpload<void>>;
  phase: Phase;
  existingName: string | null;
  durationSec: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = () => inputRef.current?.click();
  const name = upload.file?.name ?? existingName ?? "";
  const job = upload.job;

  return (
    <section className="card flex flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Recording · optional</p>
          <h2 className="display text-[1.5rem]">MP3</h2>
        </div>
        {phase === "done" && (
          <Button variant="outline" size="sm" leading={<RefreshCw size={13} />} onClick={pick}>
            Replace
          </Button>
        )}
      </div>

      {phase === "empty" && (
        <Dropzone label="Drop an MP3 recording or browse" onFile={(f) => void upload.submit(f)} onOpen={pick} className="grain flex-1">
          <Aurora subtle />
          <EmptyHero icon={<AudioLines size={16} />} title="Drop a recording here" hint=".mp3" />
        </Dropzone>
      )}

      {phase === "processing" && job && (
        <ProcessingBox name={name} size={upload.file?.size}>
          <WaveformPlaceholder className="mt-4" />
          <div className="mt-3 flex items-center justify-between text-[13px]">
            <span className="text-ink-2">{job.status === "queued" ? "Queued" : job.message}…</span>
            <span className="tnum text-ink-3">{Math.round(job.progress * 100)}%</span>
          </div>
          <Progress value={job.progress} className="mt-2" />
        </ProcessingBox>
      )}

      {phase === "failed" && (
        <FailureBox name={name} error={job?.error ?? upload.typeError ?? "The recording could not be decoded."} onChoose={pick} onRetry={job ? upload.retry : undefined} />
      )}

      {phase === "done" && <FileRow icon={<AudioLines size={15} />} name={name} detail={`Decoded · ${formatTime(durationSec)} · 44.1 kHz · stereo`} />}

      <p className="mt-4 text-xs text-ink-3">No recording? Playback is generated from the score and the Sync step is skipped.</p>
      <input ref={inputRef} type="file" accept=".mp3,audio/mpeg" className="hidden" onChange={(e) => pickFrom(e.target, upload.submit)} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Open a saved project                                                 */
/* ------------------------------------------------------------------ */

function OpenProjectCard({ targetId }: { targetId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const valid = file ? hasExtension(file.name, PROJECT_EXT) : false;

  return (
    <section className="card-flat p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-paper-3 text-ink-2">
          <FolderOpen size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-lg text-ink">Open a saved project</h2>
          <p className="text-[13px] text-ink-3">Project files (.ovproj) carry the score, audio, alignment markers and display settings.</p>
        </div>
        <div className="flex items-center gap-2">
          {file && valid && (
            // Opening a project file is a mock too: it lands in the demo project.
            <Button variant="primary" size="sm" href={`/projects/${targetId}/preview`} trailing={<ArrowRight size={13} />}>
              Open
            </Button>
          )}
          <Button variant="outline" size="sm" leading={<Upload size={13} />} onClick={() => inputRef.current?.click()}>
            {file ? "Choose another" : "Choose .ovproj"}
          </Button>
        </div>
      </div>
      {file && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-[13px]">
          <span className="truncate text-ink">{file.name}</span>
          <span className="tnum text-ink-3">{formatBytes(file.size)}</span>
          {valid ? <Chip tone="ok">Ready to open</Chip> : <Chip tone="danger">Not a project file</Chip>}
        </div>
      )}
      <input ref={inputRef} type="file" accept=".ovproj" className="hidden" onChange={(e) => pickFrom(e.target, setFile)} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* File summary                                                         */
/* ------------------------------------------------------------------ */

function FileSummary({ parsed, className }: { parsed: Parsed; className?: string }) {
  const facts: Array<[string, ReactNode]> = [
    ["Title", parsed.title],
    ["Composer", parsed.composer],
    ["Movement", parsed.movement],
    ["Parts", <span className="tnum" key="p">{parsed.parts}</span>],
    ["Measures", <span className="tnum" key="m">{parsed.measures}</span>],
    ["Duration", <span className="tnum" key="d">{formatTime(parsed.durationSec)}</span>],
  ];
  return (
    <section className={cx("card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">File summary</p>
          <h2 className="display text-[1.5rem]">
            {parsed.title} <em>{parsed.composer}</em>
          </h2>
        </div>
        <Chip tone="ok">Parsed</Chip>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="eyebrow eyebrow-muted text-[10px]">{k}</dt>
            <dd className="mt-0.5 truncate text-sm text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {parsed.warnings.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          {parsed.warnings.map((w) => (
            <Chip key={w} tone="warn" className="h-auto! min-h-6 py-1 text-left leading-snug">
              <AlertTriangle size={12} className="shrink-0" />
              {w}
            </Chip>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Status rail                                                          */
/* ------------------------------------------------------------------ */

const STATUS: Record<Phase, { label: string; tone: ChipTone }> = {
  empty: { label: "Waiting", tone: "neutral" },
  processing: { label: "Processing…", tone: "brass" },
  done: { label: "Done", tone: "ok" },
  failed: { label: "Failed", tone: "danger" },
};

function StatusRail({
  score,
  scoreName,
  recording,
  recordingName,
  infoMap,
  hasRecording,
}: {
  score: Phase;
  scoreName: string | null;
  recording: Phase;
  recordingName: string | null;
  infoMap: Phase;
  hasRecording: boolean;
}) {
  return (
    <aside className="card self-start p-5 lg:sticky lg:top-24">
      <p className="eyebrow mb-1.5">Processing</p>
      <h2 className="display mb-3 text-[1.7rem]">Status</h2>
      <ul className="divide-y divide-line">
        <StatusRow label="Score" sub={scoreName ?? "MusicXML"} phase={score} />
        <StatusRow label="Recording" sub={recordingName ?? "Optional"} phase={recording} />
        <StatusRow label="Information map" sub="Parts, notes, dynamics" phase={infoMap} />
      </ul>
      <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">
        {score === "done"
          ? hasRecording
            ? "Next, line up the score with the recording in Sync."
            : "Next, choose which parts to show in Customize. Playback is generated from the score."
          : "Add a score to continue. Everything downstream reads the information map, never the raw file."}
      </p>
    </aside>
  );
}

function StatusRow({ label, sub, phase }: { label: string; sub: string; phase: Phase }) {
  const s = STATUS[phase];
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        <span className="block truncate text-xs text-ink-3">{sub}</span>
      </span>
      <Chip tone={s.tone}>
        {phase === "processing" && <Spinner className="h-2.5 w-2.5 border-[1.5px]" />}
        {s.label}
      </Chip>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                         */
/* ------------------------------------------------------------------ */

function EmptyHero({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="relative z-10 flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-paper-2 text-brass shadow-sm">{icon}</span>
      <p className="font-serif text-xl text-ink">{title}</p>
      <p className="mt-1 text-[13px] text-ink-3">
        or <span className="text-brass underline underline-offset-2">browse</span> · {hint}
      </p>
    </div>
  );
}

function ProcessingBox({ name, size, children }: { name: string; size?: number; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-paper p-4">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="truncate font-medium text-ink">{name}</span>
        {size !== undefined && <span className="tnum shrink-0 text-ink-3">{formatBytes(size)}</span>}
      </div>
      {children}
    </div>
  );
}

function FailureBox({ name, error, onChoose, onRetry }: { name: string; error: string; onChoose: () => void; onRetry?: () => void }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-danger/30 bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0">
          {name && <p className="truncate text-[13px] font-medium text-ink">{name}</p>}
          <p className="text-[13px] leading-relaxed text-ink-2">{error}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onChoose}>
          Choose another file
        </Button>
        {onRetry && (
          <Button variant="primary" size="sm" leading={<RefreshCw size={13} />} onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

function FileRow({ icon, name, detail }: { icon: ReactNode; name: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-line bg-paper p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brass-soft text-brass-3">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{name}</p>
        <p className="text-xs text-ink-3">{detail}</p>
      </div>
    </div>
  );
}

const WAVE_BARS = Array.from({ length: 44 }, (_, i) => 25 + Math.round(55 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37))));

function WaveformPlaceholder({ className }: { className?: string }) {
  return (
    <div className={cx("flex h-12 items-end gap-[3px]", className)} aria-hidden>
      {WAVE_BARS.map((h, i) => (
        <span key={i} className="flex-1 rounded-full shimmer" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function pickFrom(input: HTMLInputElement, cb: (file: File) => unknown) {
  const file = input.files?.[0];
  if (file) cb(file);
  input.value = "";
}
