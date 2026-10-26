"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Link2, Mic, Play, Share2 } from "lucide-react";
import type { Program, ProjectSummary } from "@/shared/domain";
import { SECTION_TOKEN } from "@/shared/sections";
import { formatDate, formatDuration, formatTime } from "@/lib/utils/format";
import { PageHeader, Dot } from "@/components/shell/PageHeader";
import { StageThumb } from "@/components/visualizer/StageThumb";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip, projectHref } from "./projectStatus";

const DEFAULT_NOTES: Record<string, string> = {
  "fall-gala": "Lobby screens run the Beethoven visual 20 minutes before downbeat. Dvořák still needs the finale re-synced before the dress rehearsal.",
  "youth-prep": "Section leaders get the share link on Monday. Ask the winds to watch Appalachian Spring with part labels on.",
  pops: "Exports go to the LED wall operator as 4K, 60 fps. Firebird finale is the encore if the weather holds.",
};

export function ProgramDetail({ program, projects }: { program: Program; projects: ProjectSummary[] }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState(DEFAULT_NOTES[program.id] ?? program.description);
  const total = projects.reduce((n, p) => n + p.durationSec, 0);
  const first = projects.find((p) => p.status !== "importing" && p.status !== "failed") ?? projects[0];
  const shareUrl = `https://orchestra.app/p/${program.id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      /* clipboard unavailable: the link is still visible in the field */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="space-y-8">
      <div className="fade-up">
        <Link href="/programs" className="mb-4 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
          ← All programs
        </Link>
        <PageHeader
          eyebrow={program.season}
          title={
            <span className="inline-flex items-center gap-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: SECTION_TOKEN[program.color] }} aria-hidden />
              {program.name}
            </span>
          }
          meta={
            <>
              <span>{formatDate(program.date)}</span>
              <Dot />
              <span>{program.venue}</span>
              <Dot />
              <span className="tnum">
                {projects.length} {projects.length === 1 ? "piece" : "pieces"}
              </span>
              <Dot />
              <span className="tnum">{formatDuration(total)}</span>
            </>
          }
          actions={
            <>
              <Button variant="outline" size="sm" leading={<Share2 size={14} />} onClick={() => setShareOpen(true)}>
                Share
              </Button>
              {first && (
                <Button href={`/projects/${first.id}/preview`} variant="brass" size="sm" leading={<Play size={14} />}>
                  Present
                </Button>
              )}
            </>
          }
        />
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-2">{program.description}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 fade-up fade-up-1">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="eyebrow mb-1">Order of pieces</p>
              <h2 className="display text-[1.6rem]">Running order</h2>
            </div>
            <span className="text-[13px] text-ink-3 tnum">{formatDuration(total)} of music</span>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              eyebrow="Empty program"
              title={
                <>
                  Nothing <em>programmed</em> yet
                </>
              }
              body="Add pieces from your library and they will appear here in running order."
              action={
                <Button href="/library" variant="outline" size="sm">
                  Open library
                </Button>
              }
            />
          ) : (
            <ol className="card divide-y divide-line overflow-hidden">
              {projects.map((p, i) => (
                <li key={p.id} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
                  <span className="w-6 shrink-0 font-serif text-lg text-ink-3 tnum">{i + 1}.</span>
                  <span className="hidden w-[120px] shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-stage sm:block">
                    <StageThumb project={p} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-ink-3">{p.composer}</span>
                    <span className="block font-serif text-[1.1rem] leading-snug text-ink">
                      {p.title} {p.subtitle && <em className="text-ink-2">{p.subtitle}</em>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                      <span className="truncate">{p.movement}</span>
                      <Dot />
                      <span className="tnum">{formatTime(p.durationSec)}</span>
                      {p.hasRecording && (
                        <>
                          <Dot />
                          <span className="inline-flex items-center gap-1">
                            <Mic size={11} /> recording
                          </span>
                        </>
                      )}
                    </span>
                    <span className="mt-2 flex items-center gap-2 sm:hidden">
                      <StatusChip project={p} />
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    <StatusChip project={p} />
                  </span>
                  <Link
                    href={projectHref(p)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3 text-[13px] font-medium text-ink hover:bg-paper-3"
                  >
                    Open <ArrowRight size={13} />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-6 min-w-0 fade-up fade-up-2 lg:sticky lg:top-24 lg:self-start">
          <section className="card p-5">
            <p className="eyebrow mb-1">Notes</p>
            <h2 className="display text-[1.5rem] mb-3">For the night</h2>
            <Field hint="Notes stay with the program. Musicians do not see them.">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} aria-label="Program notes" />
            </Field>
          </section>

          <section className="card p-5">
            <p className="eyebrow mb-1">Musicians</p>
            <h2 className="display text-[1.5rem] mb-2">Shared page</h2>
            <p className="text-[13px] leading-relaxed text-ink-3">
              Anyone with the link can watch each piece with the visual and the recording, without an account.
            </p>
            <Button variant="outline" size="sm" className="mt-4" leading={<Link2 size={14} />} onClick={() => setShareOpen(true)}>
              Copy share link
            </Button>
          </section>
        </aside>
      </div>

      <Dialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        eyebrow="Share"
        title={
          <>
            Send <em>{program.name}</em> to musicians
          </>
        }
        footer={
          <Button variant="primary" size="sm" onClick={() => setShareOpen(false)}>
            Done
          </Button>
        }
      >
        <p className="mb-4 text-sm text-ink-2">Everyone with this link sees the running order and can watch each piece. No sign-in needed.</p>
        <div className="flex items-center gap-2">
          <input readOnly value={shareUrl} aria-label="Share link" className="h-11 min-w-0 flex-1 rounded-[var(--radius)] border border-line bg-paper-3 px-3.5 text-sm text-ink-2 tnum focus:outline-none" />
          <Button variant={copied ? "secondary" : "primary"} size="md" onClick={copy} leading={copied ? <Check size={14} /> : <Copy size={14} />}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-ink-3">Links are mock in this build and go nowhere yet.</p>
      </Dialog>
    </div>
  );
}
