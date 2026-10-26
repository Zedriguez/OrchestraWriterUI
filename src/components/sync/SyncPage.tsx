"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Crosshair, RefreshCw, SkipForward, Trash2 } from "lucide-react";
import { CONFIDENCE_BANDS, UNCERTAIN_THRESHOLD, confidenceBand } from "@/shared/sync";
import type { AlignResult } from "@/shared/jobs";
import { api } from "@/lib/api";
import { useJob } from "@/lib/api/useJob";
import { useProject } from "@/lib/store/project";
import { usePlayback } from "@/lib/store/playback";
import { useProjectTiming } from "@/lib/store/useProjectTiming";
import { buildMockAlignment } from "@/lib/mock/sync";
import { formatTime, cx } from "@/lib/utils/format";
import { useWaveform } from "@/components/visualizer/useWaveform";
import { Transport } from "@/components/music/Transport";
import { ScoreStrip } from "@/components/music/ScoreStrip";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Progress } from "@/components/ui/Progress";
import { Input } from "@/components/ui/Field";
import { Kbd } from "@/components/ui/Kbd";
import { Dot } from "@/components/shell/PageHeader";
import { ConfidenceStrip } from "./ConfidenceStrip";
import { MeasureTimeline } from "./MeasureTimeline";

const WINDOW = 8;

export function SyncPage({ projectId }: { projectId: string }) {
  const summary = useProject((s) => s.summary)!;
  const infoMap = useProject((s) => s.infoMap)!;
  const sync = useProject((s) => s.sync);
  const { addMarker, nudgeMarker, removeMarker, replaceAuto } = useProject.getState();
  const { aligned, measureAt, seekMeasure } = useProjectTiming();
  const time = usePlayback((s) => s.time);
  const duration = usePlayback((s) => s.duration);
  const peaks = useWaveform(summary.id.length * 7 + summary.measures);

  const current = measureAt(time);
  const [selected, setSelected] = useState<number | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [msField, setMsField] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useJob<AlignResult>(jobId);

  useEffect(() => {
    if (job?.status === "succeeded") {
      replaceAuto(buildMockAlignment(infoMap, summary.measures + 1));
      const t = setTimeout(() => setJobId(null), 1800);
      return () => clearTimeout(t);
    }
  }, [job?.status, infoMap, summary.measures, replaceAuto]);

  const manualSet = useMemo(() => new Set(sync?.manual.map((m) => m.measure) ?? []), [sync]);
  const confidenceMap = useMemo(() => new Map(aligned.map((a) => [a.n, a.confidence])), [aligned]);
  const uncertain = useMemo(() => aligned.filter((a) => a.confidence < UNCERTAIN_THRESHOLD && !manualSet.has(a.n)).sort((a, b) => a.confidence - b.confidence), [aligned, manualSet]);
  const avg = useMemo(() => (aligned.length ? Math.round(aligned.reduce((s, a) => s + a.confidence, 0) / aligned.length) : 0), [aligned]);

  if (!sync || !summary.hasRecording) {
    return (
      <div className="card p-10 text-center">
        <p className="eyebrow mb-2">Sync</p>
        <h1 className="display text-3xl mb-3">No recording to sync</h1>
        <p className="text-ink-3 mb-6">Playback is generated from the score, so every measure is already in time.</p>
        <Button href={`/projects/${projectId}/customize`} trailing={<ArrowRight size={14} />}>
          Continue to Customize
        </Button>
      </div>
    );
  }

  const sel = selected ?? current;
  const selAuto = sync.auto.find((a) => a.n === sel);
  const selAligned = aligned.find((a) => a.n === sel);
  const selManual = sync.manual.find((m) => m.measure === sel);
  const conf = confidenceMap.get(sel) ?? 0;
  const band = confidenceBand(conf);
  const prev = aligned[sel - 2];
  const next = aligned[sel];
  const windowStart = Math.max(1, Math.min(aligned.length - WINDOW + 1, sel - 2));

  const pick = (m: number) => {
    setSelected(m);
    seekMeasure(m);
  };
  const nextUncertain = () => {
    const after = aligned.find((a) => a.n > sel && a.confidence < UNCERTAIN_THRESHOLD && !manualSet.has(a.n)) ?? uncertain[0];
    if (after) pick(after.n);
  };
  const nudge = (ms: number) => {
    const target = (selAligned?.startSec ?? 0) + ms / 1000;
    if (prev && target <= prev.startSec) return;
    if (next && target >= next.startSec) return;
    nudgeMarker(sel, ms / 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Step 2 of 5 · Sync</p>
          <h1 className="display text-[2.5rem] md:text-[3.1rem]">
            Line up the <em>recording</em>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">
            <span>{summary.recordingName}</span>
            <Dot />
            <span className="tnum">{aligned.length} measures</span>
            <Dot />
            <span className="tnum">{avg}% average confidence</span>
            <Dot />
            <span className="tnum">{uncertain.length} uncertain</span>
            <Dot />
            <span>{sync.manual.length} manual markers</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" leading={<RefreshCw size={14} className={job && job.status === "running" ? "animate-spin" : ""} />} onClick={async () => setJobId((await api.startAlignment(projectId)).id)} disabled={!!job && job.status !== "succeeded" && job.status !== "failed"}>
            Re-run auto-alignment
          </Button>
          <Button href={`/projects/${projectId}/customize`} size="sm" trailing={<ArrowRight size={14} />}>
            Continue to Customize
          </Button>
        </div>
      </div>

      {job && (
        <div className="card flex items-center gap-4 px-5 py-3.5 fade-up">
          <div className="flex-1">
            <p className="text-[13px] text-ink">
              {job.status === "succeeded" ? "Alignment updated — manual markers kept." : job.message}
            </p>
            <Progress value={job.progress} className="mt-2" tone={job.status === "succeeded" ? "ok" : "brass"} />
          </div>
          <span className="tnum text-[12px] text-ink-3">{Math.round(job.progress * 100)}%</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_316px]">
        <div className="min-w-0 space-y-5">
          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="eyebrow">Confidence across the piece</p>
              <Button variant="secondary" size="sm" leading={<SkipForward size={13} />} onClick={nextUncertain} disabled={uncertain.length === 0}>
                Next uncertain
              </Button>
            </div>
            <ConfidenceStrip aligned={aligned} manual={manualSet} current={current} selected={selected} onPick={pick} />
          </section>

          <section className="card p-4 space-y-4">
            <p className="eyebrow">Score over the recording</p>
            <ScoreStrip infoMap={infoMap} currentMeasure={current} onSeekMeasure={pick} maxParts={6} confidence={confidenceMap} />
            <MeasureTimeline
              peaks={peaks}
              duration={duration}
              aligned={aligned}
              manual={manualSet}
              from={windowStart}
              to={Math.min(aligned.length, windowStart + WINDOW - 1)}
              time={time}
              selected={selected}
              onSelect={setSelected}
              onSeek={(t) => usePlayback.getState().seek(t)}
            />
          </section>

          <Transport peaks={peaks} measureLabel={`Measure ${current} / ${aligned.length}`} markers={sync.manual.map((m) => ({ at: m.startSec / duration, color: "var(--brass)", strong: true }))} />
        </div>

        <aside className="space-y-4 self-start lg:sticky lg:top-24">
          <section className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow mb-1">Selected measure</p>
                <h2 className="display text-[2rem] leading-none tnum">{sel}</h2>
              </div>
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
                  {selManual && <span className="ml-1 text-brass">●</span>}
                </dd>
              </div>
            </dl>

            <p className="mt-4 mb-1.5 text-[12px] text-ink-3">Nudge start</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[-100, -10, 10, 100].map((ms) => (
                <Button key={ms} variant="secondary" size="sm" className="tnum h-9" onClick={() => nudge(ms)}>
                  {ms > 0 ? `+${ms}` : ms} ms
                </Button>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <Button variant="outline" size="sm" className="flex-1" leading={<Crosshair size={13} />} onClick={() => addMarker(sel, usePlayback.getState().time)}>
                Set to playhead
              </Button>
              {selManual && (
                <Button variant="ghost" size="icon-sm" aria-label="Remove marker" onClick={() => removeMarker(sel)}>
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
            {(prev || next) && (
              <p className="mt-2 text-[11px] leading-relaxed text-ink-4">
                Must stay between {prev ? formatTime(prev.startSec, true) : "0:00"} and {next ? formatTime(next.startSec, true) : formatTime(duration)}. Later measures never start before earlier ones.
              </p>
            )}

            <button type="button" onClick={() => setAdvanced((a) => !a)} className="mt-3 flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink">
              <ChevronDown size={13} className={cx("transition-transform", !advanced && "-rotate-90")} /> Advanced
            </button>
            {advanced && (
              <form
                className="mt-2 flex gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = Number(msField);
                  if (!Number.isNaN(v)) addMarker(sel, v / 1000);
                }}
              >
                <Input value={msField} onChange={(e) => setMsField(e.target.value)} placeholder={String(Math.round((selAligned?.startSec ?? 0) * 1000))} inputMode="numeric" className="h-9 tnum" aria-label="Start time in milliseconds" />
                <Button type="submit" variant="outline" size="sm" className="h-9">
                  Set ms
                </Button>
              </form>
            )}
          </section>

          <section className="card p-4">
            <p className="eyebrow mb-2">Uncertain measures</p>
            {uncertain.length === 0 ? (
              <p className="text-[13px] text-ink-3">Every measure is above {UNCERTAIN_THRESHOLD}%. Nice recording.</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto scroll-thin">
                {uncertain.slice(0, 40).map((a) => (
                  <li key={a.n}>
                    <button type="button" onClick={() => pick(a.n)} className={cx("flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] hover:bg-paper-3", a.n === sel && "bg-brass-soft")}>
                      <span className="tnum text-ink">Measure {a.n}</span>
                      <span className="tnum flex items-center gap-1.5 text-ink-3">
                        <span className="h-2 w-2 rounded-full" style={{ background: confidenceBand(a.confidence).token }} />
                        {a.confidence}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <p className="eyebrow mb-2">Manual markers</p>
            {sync.manual.length === 0 ? (
              <p className="text-[13px] text-ink-3">None yet. Nudging a measure or setting it to the playhead adds one. Manual markers always win over automatic ones.</p>
            ) : (
              <ul className="space-y-1">
                {sync.manual.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] hover:bg-paper-3">
                    <button type="button" className="tnum text-ink" onClick={() => pick(m.measure)}>
                      Measure {m.measure} · {formatTime(m.startSec, true)}
                    </button>
                    <button type="button" className="text-ink-3 hover:text-danger" onClick={() => removeMarker(m.measure)} aria-label="Remove marker">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4 text-[12px] text-ink-3 space-y-1.5">
            <p className="eyebrow mb-2">Legend & keys</p>
            {CONFIDENCE_BANDS.map((b) => (
              <p key={b.id} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.token }} /> {b.label} · {b.description}
              </p>
            ))}
            <p className="pt-2 flex flex-wrap gap-x-3 gap-y-1">
              <span><Kbd>Space</Kbd> play</span>
              <span><Kbd>←</Kbd><Kbd>→</Kbd> 5 s</span>
              <span><Kbd>⇧</Kbd>+drag scrub</span>
            </p>
            <p className="pt-1 text-ink-4">Method: {sync.method}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
