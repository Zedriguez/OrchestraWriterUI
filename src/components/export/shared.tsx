"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import type { ExportResult, Job } from "@/shared/jobs";
import { formatBytes } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Progress } from "@/components/ui/Progress";

export type ExportKind = "mp4" | "project";

export interface HistoryRow {
  id: string;
  filename: string;
  kind: ExportKind;
  bytes: number;
  at: string;
  url: string;
}

/** "Symphony No. 5" → "symphony-no-5" */
export function slugify(s: string) {
  const slug = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "project";
}

export function isActive(job: Job<unknown> | null): boolean {
  return job !== null && (job.status === "queued" || job.status === "running");
}

/** Seconds since the job started, ticking while it runs. */
export function useElapsed(job: Job<unknown> | null): number {
  const [now, setNow] = useState(() => Date.now());
  const active = isActive(job);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  if (!job) return 0;
  const end = active ? now : new Date(job.updatedAt).getTime();
  return Math.max(0, (end - new Date(job.startedAt).getTime()) / 1000);
}

/** Calls `onComplete` once per succeeded job. */
export function useOnComplete(job: Job<ExportResult> | null, kind: ExportKind, onComplete: (row: HistoryRow) => void) {
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!job || job.status !== "succeeded" || !job.result || seen.current === job.id) return;
    seen.current = job.id;
    onComplete({ id: job.id, filename: job.result.filename, kind, bytes: job.result.bytes, at: job.updatedAt, url: job.result.url });
  }, [job, kind, onComplete]);
}

export function FilenameField({
  id,
  value,
  onChange,
  suffix,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  disabled?: boolean;
}) {
  return (
    <Field label="Filename">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          className="pr-20"
          aria-describedby={`${id}-suffix`}
        />
        <span id={`${id}-suffix`} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3">
          {suffix}
        </span>
      </div>
    </Field>
  );
}

export function JobLine({ job, trailing }: { job: Job<unknown>; trailing?: ReactNode }) {
  const pct = Math.round(job.progress * 100);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="truncate text-ink-2">{job.status === "queued" ? "Queued" : job.message}…</span>
        <span className="tnum shrink-0 text-ink-3">
          {pct}%{trailing}
        </span>
      </div>
      <Progress value={job.progress} className="mt-2" />
    </div>
  );
}

export function ResultRow({
  icon,
  result,
  onAgain,
  againLabel,
}: {
  icon: ReactNode;
  result: ExportResult;
  onAgain: () => void;
  againLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-line bg-paper p-4 fade-up">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brass-soft text-brass-3">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{result.filename}</p>
        <p className="tnum text-xs text-ink-3">{formatBytes(result.bytes)} · ready</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onAgain}>
          {againLabel}
        </Button>
        <Button variant="primary" size="sm" href={result.url} leading={<Download size={13} />}>
          Download
        </Button>
      </div>
    </div>
  );
}

export function FailureRow({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-danger/30 bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
        <p className="text-[13px] leading-relaxed text-ink-2">{error}</p>
      </div>
      <Button variant="primary" size="sm" className="mt-4" leading={<RefreshCw size={13} />} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
