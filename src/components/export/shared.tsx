"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import type { ExportResult, Job } from "@/shared/jobs";
import { cx, formatBytes } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Field";
import { Progress } from "@/components/ui/Progress";

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
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  if (!job) return 0;
  const end = active ? now : new Date(job.updatedAt).getTime();
  return Math.max(0, (end - new Date(job.startedAt).getTime()) / 1000);
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
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        Filename
      </label>
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
    </div>
  );
}

/** Step message, percentage and a thin bar. `indeterminate` hides the percentage. */
export function ProgressLine({
  message,
  progress = 0,
  indeterminate,
  trailing,
}: {
  message: string;
  progress?: number;
  indeterminate?: boolean;
  trailing?: ReactNode;
}) {
  const pct = Math.round(progress * 100);
  return (
    <div aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="truncate text-ink-2">{message}…</span>
        <span className="tnum shrink-0 text-ink-3">
          {!indeterminate && `${pct}%`}
          {trailing}
        </span>
      </div>
      <Progress value={indeterminate ? 0.35 : progress} indeterminate={indeterminate} ariaLabel={message} className="mt-2" />
    </div>
  );
}

/** A running job: its current step, percentage and bar. */
export function JobLine({ job, trailing }: { job: Job<unknown>; trailing?: ReactNode }) {
  return <ProgressLine message={job.status === "queued" ? "Queued" : job.message} progress={job.progress} trailing={trailing} />;
}

/** Looks like a primary Button; a real anchor so `download` works with blob: URLs. */
export const downloadLinkClass =
  "focus-round inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-ink px-3 text-[13px] font-medium text-paper shadow-sm transition-colors hover:bg-ink-2";

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
  const warnings = result.warnings ?? [];
  return (
    <div className="fade-up rounded-[var(--radius-lg)] border border-line bg-paper p-4" data-testid="export-result">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brass-soft text-brass-3" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{result.filename}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <span className="tnum">{formatBytes(result.bytes)}</span>
            {result.codec && <Chip className="h-5 px-2 text-[11px]">{result.codec}</Chip>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onAgain}>
            {againLabel}
          </Button>
          <a href={result.url} download={result.filename} className={downloadLinkClass}>
            <Download size={13} aria-hidden />
            Download
          </a>
        </div>
      </div>
      {warnings.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3" aria-label="Export warnings">
          {warnings.map((w) => (
            <li key={w}>
              <Chip tone="warn" className="h-auto! min-h-6 py-1 text-left leading-snug">
                <AlertTriangle size={12} className="shrink-0" aria-hidden />
                {w}
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FailureRow({ error, onRetry, className }: { error: string; onRetry: () => void; className?: string }) {
  return (
    <div className={cx("rounded-[var(--radius-lg)] border border-danger/30 bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] p-4", className)} role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />
        <p className="text-[13px] leading-relaxed text-ink-2">{error}</p>
      </div>
      <Button variant="primary" size="sm" className="mt-4" leading={<RefreshCw size={13} />} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
