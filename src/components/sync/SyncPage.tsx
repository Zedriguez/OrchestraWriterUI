"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Crosshair, RefreshCw, SkipForward, Trash2 } from "lucide-react";
import { UNCERTAIN_THRESHOLD, confidenceBand, type MeasureAlignment } from "@/shared/sync";
import type { AlignResult, Job } from "@/shared/jobs";
import type { InfoMap } from "@/shared/info-map";
import { api } from "@/lib/api";
import { useProject } from "@/lib/store/project";
import { usePlayback } from "@/lib/store/playback";
import { useProjectTiming } from "@/lib/store/useProjectTiming";
import { formatTime, cx } from "@/lib/utils/format";
import { useWaveform } from "@/components/visualizer/useWaveform";
import { Transport } from "@/components/music/Transport";
import { ScoreStrip } from "@/components/music/ScoreStrip";
import { NeedsScore } from "@/components/music/NeedsScore";
import { barNumber, barText } from "@/components/music/bars";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Field";
import { Collapsible } from "@/components/ui/Collapsible";
import { Tooltip } from "@/components/ui/Tooltip";
import { PageHeader, Dot } from "@/components/shell/PageHeader";
import { JobLine } from "@/components/export/shared";
import { isRunning, isStarting, useProjectJob } from "@/components/import/projectJobs";
import { ConfidenceStrip } from "./ConfidenceStrip";
import { MeasureTimeline } from "./MeasureTimeline";

const WINDOW = 8;
const NUDGES_MS = [-100, -10, 10, 100];
/** a marker must stay this far from its neighbors (matches mergeAlignment's monotonic gap) */
const MIN_GAP_SEC = 0.01;

export function SyncPage({ projectId }: { projectId: string }) {
  const router = useRouter();
  const summary = useProject((s) => s.summary);
  const infoMap = useProject((s) => s.infoMap);
  const sync = useProject((s) => s.sync);
  const refresh = useProject((s) => s.refresh);
  const setStage = useProject((s) => s.setStage);
  const hasRecording = summary?.hasRecording ?? false;

  const alignKey = `${projectId}:align`;
  const onAligned = useCallback(() => refresh(), [refresh]);
  const align = useProjectJob<AlignResult>(alignKey, { onSucceeded: onAligned, forgetOnSuccess: true });
  const [startError, setStartError] = useState<string | null>(null);
  const aligning = isRunning(align.job);

  const startAlign = align.start;
  const beginAlignment = useCallback(
    () =>
      startAlign(async () => {
        // the aligner keeps the server's manual markers: write pending edits first
        await useProject.getState().saveNow();
        return api.startAlignment(projectId);
      }).catch((err: unknown) => {
        setStartError(err instanceof Error ? err.message : "Auto-alignment could not start.");
      }),
    [startAlign, projectId],
  );
  const runAlignment = () => {
    setStartError(null);
    void beginAlignment();
  };

  // First visit with a recording and no alignment yet: align automatically, once.
  const needsAlignment = hasRecording && Boolean(infoMap) && sync === null;
  const alignJobId = align.jobId;
  useEffect(() => {
    if (!needsAlignment || alignJobId || startError || isStarting(alignKey)) return;
    void beginAlignment();
  }, [needsAlignment, alignJobId, startError, alignKey, beginAlignment]);

  // "Alignment updated" stays up briefly after a re-run.
  const alignStatus = align.job?.status;
  const clearAlign = align.clear;
  useEffect(() => {
    if (alignStatus !== "succeeded" || sync === null) return;
    const t = setTimeout(clearAlign, 3000);
    return () => clearTimeout(t);
  }, [alignStatus, sync, clearAlign]);

  const goCustomize = () => {
    setStage("customize");
    router.push(`/projects/${projectId}/customize`);
  };

  if (!summary || !infoMap) return <NeedsScore projectId={projectId} title="Sync the recording" />;

  if (!hasRecording) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="display mb-2 text-[2rem]">No recording to sync</h1>
        <p className="mb-6 text-sm text-ink-3">Playback is generated from the score, so every bar is already in time.</p>
        <Button onClick={goCustomize} trailing={<ArrowRight size={14} />}>
          Continue to Customize
        </Button>
      </div>
    );
  }

  const continueButton = (
    <Button size="sm" onClick={goCustomize} trailing={<ArrowRight size={14} />}>
      Continue to Customize
    </Button>
  );

  if (!sync) {
    const failed = align.job?.status === "failed" || startError;
    return (
      <div className="space-y-6">
        <PageHeader title="Sync the recording" meta={<span>{summary.recordingName ?? "Recording"}</span>} />
        <section className="card mx-auto max-w-2xl p-6" aria-labelledby="align-title">
          <h2 id="align-title" className="font-serif text-xl text-ink">
            {failed ? "Auto-alignment failed" : "Aligning the recording to the score"}
          </h2>
          {failed ? (
            <>
              <p className="mt-2 flex items-start gap-2 text-sm text-ink-2" role="alert">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden />
                {startError ?? align.job?.error ?? "The alignment did not finish."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" leading={<RefreshCw size={13} />} onClick={runAlignment}>
                  Retry
                </Button>
                <Button size="sm" variant="ghost" onClick={goCustomize}>
                  Continue without alignment
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-3">Every bar gets a start time in the recording and a confidence. This runs in your browser and takes a few seconds.</p>
              <div className="mt-5">{align.job ? <JobLine job={align.job} /> : <p className="text-[13px] text-ink-3">Starting…</p>}</div>
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <SyncEditor
      infoMap={infoMap}
      recordingName={summary.recordingName ?? "Recording"}
      aligning={aligning}
      align={align.job}
      onRerun={runAlignment}
      continueButton={continueButton}
    />
  );
}

/* ------------------------------------------------------------------ */
/* The editor (alignment exists)                                       */
/* ------------------------------------------------------------------ */

function SyncEditor({
  infoMap,
  recordingName,
  aligning,
  align,
  onRerun,
  continueButton,
}: {
  infoMap: InfoMap;
  recordingName: string;
  aligning: boolean;
  align: Job<AlignResult> | null;
  onRerun: () => void;
  continueButton: React.ReactNode;
}) {
  const sync = useProject((s) => s.sync)!;
  const storePeaks = useProject((s) => s.peaks);
  const addMarker = useProject((s) => s.addMarker);
  const nudgeMarker = useProject((s) => s.nudgeMarker);
  const removeMarker = useProject((s) => s.removeMarker);
  const { aligned, measureAt, seekMeasure } = useProjectTiming();
  const time = usePlayback((s) => s.time);
  const duration = usePlayback((s) => s.duration);
  const peaks = useWaveform({ peaks: storePeaks });

  const current = measureAt(time);
  const [selected, setSelected] = useState<number | null>(null);
  const [msField, setMsField] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const manualSet = useMemo(() => new Set(sync.manual.map((m) => m.measure)), [sync.manual]);
  const confidenceMap = useMemo(() => new Map(aligned.map((a) => [a.n, a.confidence])), [aligned]);
  const toCheck = useMemo(
    () => aligned.filter((a) => a.confidence < UNCERTAIN_THRESHOLD && !manualSet.has(a.n)).sort((a, b) => a.confidence - b.confidence),
    [aligned, manualSet],
  );
  const avg = useMemo(() => (aligned.length ? Math.round(aligned.reduce((s, a) => s + a.confidence, 0) / aligned.length) : 0), [aligned]);

  const total = aligned.length;
  const sel = Math.max(1, Math.min(total, selected ?? current));
  const selAuto = sync.auto.find((a) => a.n === sel);
  const selAligned = aligned[sel - 1] as MeasureAlignment | undefined;
  const selManual = sync.manual.find((m) => m.measure === sel);
  const conf = confidenceMap.get(sel) ?? 0;
  const band = confidenceBand(conf);
  const prev = aligned[sel - 2];
  const next = aligned[sel];
  const lowBound = prev ? prev.startSec + MIN_GAP_SEC : 0;
  const highBound = next ? next.startSec - MIN_GAP_SEC : duration;
  const windowStart = Math.max(1, Math.min(total - WINDOW + 1, sel - 2));
  const label = (n: number) => barNumber(infoMap, n);

  const pick = (m: number) => {
    setSelected(m);
    setEditError(null);
    setMsField("");
    seekMeasure(m);
  };
  const select = (m: number) => {
    setSelected(m);
    setEditError(null);
    setMsField("");
  };
  const nextUncertain = () => {
    const after = aligned.find((a) => a.n > sel && a.confidence < UNCERTAIN_THRESHOLD && !manualSet.has(a.n)) ?? toCheck[0];
    if (after) pick(after.n);
  };

  /** Monotonic rule: a bar starts after the previous one and before the next. */
  const outOfRange = (t: number): string | null => {
    if (t >= lowBound && t <= highBound) return null;
    return `${barText(infoMap, sel, true)} must start between ${formatTime(Math.max(0, lowBound), true)} and ${formatTime(highBound, true)}. Later bars never start before earlier ones.`;
  };
  const setStart = (t: number) => {
    const err = outOfRange(t);
    setEditError(err);
    if (err) return false;
    addMarker(sel, t);
    return true;
  };
  const nudge = (ms: number) => {
    const target = (selAligned?.startSec ?? 0) + ms / 1000;
    const err = outOfRange(target);
    setEditError(err);
    if (err) return;
    // a manual marker moves by the delta; otherwise the shown (merged) start becomes the marker
    if (selManual) nudgeMarker(sel, ms / 1000);
    else addMarker(sel, target);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sync the recording"
        meta={
          <>
            <span>{recordingName}</span>
            <Dot />
            <span className="tnum">{total} bars</span>
            <Dot />
            <span className="tnum">{avg}% average confidence</span>
            <Dot />
            <span className="tnum">{toCheck.length} to check</span>
            <Dot />
            <span className="tnum">
              {sync.manual.length} manual {sync.manual.length === 1 ? "marker" : "markers"}
            </span>
          </>
        }
        actions={
          <>
            <Tooltip label={`Method: ${sync.method}. Manual markers are kept.`}>
              <Button variant="outline" size="sm" leading={<RefreshCw size={14} className={aligning ? "animate-spin" : ""} />} onClick={onRerun} disabled={aligning}>
                Re-run auto-alignment
              </Button>
            </Tooltip>
            {continueButton}
          </>
        }
      />

      {align && (
        <div className="card fade-up px-5 py-3.5" aria-live="polite">
          {align.status === "succeeded" ? (
            <p className="text-[13px] text-ink">
              {align.result ? `Aligned ${align.result.measures} bars, ${Math.round(align.result.averageConfidence)}% average confidence.` : "Alignment updated."}
              {sync.manual.length > 0 && " Manual markers were kept."}
            </p>
          ) : align.status === "failed" ? (
            <p className="flex items-center gap-2 text-[13px] text-danger" role="alert">
              <AlertTriangle size={14} aria-hidden /> {align.error ?? "Auto-alignment failed."}
            </p>
          ) : (
            <JobLine job={align} />
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_316px]">
        <div className="min-w-0 space-y-5">
          <section className="card p-4" aria-label="Confidence by bar">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] font-medium text-ink-2">Confidence by bar</p>
              <Button variant="secondary" size="sm" leading={<SkipForward size={13} />} onClick={nextUncertain} disabled={toCheck.length === 0}>
                Next uncertain
              </Button>
            </div>
            <ConfidenceStrip aligned={aligned} manual={manualSet} current={current} selected={selected} onPick={pick} labelOf={label} />
          </section>

          <section className="card space-y-4 p-4" aria-label="Score over the recording">
            <ScoreStrip infoMap={infoMap} currentMeasure={current} onSeekMeasure={pick} maxParts={6} confidence={confidenceMap} />
            <MeasureTimeline
              peaks={peaks}
              duration={duration}
              aligned={aligned}
              manual={manualSet}
              from={windowStart}
              to={Math.min(total, windowStart + WINDOW - 1)}
              time={time}
              selected={selected}
              onSelect={select}
              onSeek={(t) => usePlayback.getState().seek(t)}
              labelOf={label}
            />
          </section>

          <Transport
            peaks={peaks}
            measureLabel={`Bar ${label(current)} / ${total}`}
            markers={duration > 0 ? sync.manual.map((m) => ({ at: m.startSec / duration, color: "var(--brass)", strong: true })) : undefined}
          />
        </div>

        <aside className="space-y-4 self-start lg:sticky lg:top-24">
          <section className="card p-4" aria-labelledby="selected-bar-title">
            <div className="flex items-start justify-between gap-3">
              <h2 id="selected-bar-title" className="display text-[1.6rem] leading-none tnum">
                {barText(infoMap, sel, true)}
              </h2>
              <Chip tone={band.id === "high" ? "ok" : band.id === "mid" ? "warn" : "danger"}>
                {conf}% · {band.label}
              </Chip>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <dt className="text-ink-3">Auto start</dt>
                <dd className="tnum text-ink">{formatTime(selAuto?.startSec ?? 0, true)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Current start</dt>
                <dd className="tnum text-ink">
                  {formatTime(selAligned?.startSec ?? 0, true)}
                  {selManual && <span className="ml-1.5 text-[11px] text-brass-3">manual</span>}
                </dd>
              </div>
            </dl>

            <p className="mb-1.5 mt-4 text-[12px] text-ink-3" id="nudge-label">
              Nudge start
            </p>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-labelledby="nudge-label">
              {NUDGES_MS.map((ms) => (
                <Button key={ms} variant="secondary" size="sm" className="tnum h-9" onClick={() => nudge(ms)} disabled={aligning}>
                  {ms > 0 ? `+${ms}` : ms} ms
                </Button>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                leading={<Crosshair size={13} />}
                onClick={() => setStart(usePlayback.getState().time)}
                disabled={aligning}
              >
                Set to playhead
              </Button>
              {selManual && (
                <Tooltip label="Remove marker">
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove marker on ${barText(infoMap, sel)}`} onClick={() => removeMarker(sel)} disabled={aligning}>
                    <Trash2 size={14} />
                  </Button>
                </Tooltip>
              )}
            </div>
            {editError && (
              <p className="mt-2 text-[12px] leading-relaxed text-danger" role="alert">
                {editError}
              </p>
            )}

            <Collapsible open={advanced} onOpenChange={setAdvanced} trigger="Advanced" className="mt-3" triggerClassName="text-[12px] text-ink-3">
              <form
                className="mt-2 flex gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = Number(msField);
                  if (msField.trim() === "" || !Number.isFinite(v)) {
                    setEditError("Enter the start time in milliseconds.");
                    return;
                  }
                  if (setStart(v / 1000)) setMsField("");
                }}
              >
                <Input
                  value={msField}
                  onChange={(e) => setMsField(e.target.value)}
                  placeholder={String(Math.round((selAligned?.startSec ?? 0) * 1000))}
                  inputMode="numeric"
                  className="h-9 tnum"
                  aria-label="Start time in milliseconds"
                  disabled={aligning}
                />
                <Button type="submit" variant="outline" size="sm" className="h-9" disabled={aligning}>
                  Set ms
                </Button>
              </form>
            </Collapsible>
          </section>

          <section className="card p-4" aria-labelledby="to-check-title">
            <h2 id="to-check-title" className="mb-2 text-[13px] font-medium text-ink-2">
              Bars to check
            </h2>
            {toCheck.length === 0 ? (
              <p className="text-[13px] text-ink-3">Every bar is at {UNCERTAIN_THRESHOLD}% or above, or has a manual marker.</p>
            ) : (
              <ul className="scroll-thin max-h-56 space-y-1 overflow-y-auto">
                {toCheck.slice(0, 40).map((a) => (
                  <li key={a.n}>
                    <button
                      type="button"
                      onClick={() => pick(a.n)}
                      className={cx("flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] hover:bg-paper-3", a.n === sel && "bg-brass-soft")}
                    >
                      <span className="tnum text-ink">{barText(infoMap, a.n, true)}</span>
                      <span className="tnum flex items-center gap-1.5 text-ink-3">
                        <span className="h-2 w-2 rounded-full" style={{ background: confidenceBand(a.confidence).token }} aria-hidden />
                        {a.confidence}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4" aria-labelledby="markers-title">
            <h2 id="markers-title" className="mb-2 text-[13px] font-medium text-ink-2">
              Manual markers
            </h2>
            {sync.manual.length === 0 ? (
              <p className="text-[13px] text-ink-3">None yet. Nudging a bar or setting it to the playhead adds one; manual markers always win over automatic ones.</p>
            ) : (
              <ul className="space-y-1">
                {sync.manual.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] hover:bg-paper-3">
                    <button type="button" className="tnum text-ink" onClick={() => pick(m.measure)}>
                      {barText(infoMap, m.measure, true)} · {formatTime(m.startSec, true)}
                    </button>
                    <button
                      type="button"
                      className="text-ink-3 hover:text-danger disabled:opacity-40"
                      onClick={() => removeMarker(m.measure)}
                      aria-label={`Remove marker on ${barText(infoMap, m.measure)}`}
                      disabled={aligning}
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
