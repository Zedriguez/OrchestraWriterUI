"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, MapPin, Plus, Share2 } from "lucide-react";
import type { Program } from "@/shared/domain";
import { SECTION_TOKEN } from "@/shared/sections";
import { PROGRAMS, projectsInProgram } from "@/lib/mock/library";
import { formatDate, formatDuration } from "@/lib/utils/format";
import { PageHeader, Dot } from "@/components/shell/PageHeader";
import { StageThumb } from "@/components/visualizer/StageThumb";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";

export function ProgramsPage() {
  const [open, setOpen] = useState(false);
  const totalPieces = PROGRAMS.reduce((n, p) => n + p.projectIds.length, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        className="fade-up"
        eyebrow="Programs"
        title={
          <>
            Your <em>concerts</em>
          </>
        }
        meta={
          <>
            <span className="tnum">{PROGRAMS.length} programs</span>
            <Dot />
            <span className="tnum">{totalPieces} pieces</span>
            <Dot />
            <span>Share a program with musicians as one link</span>
          </>
        }
        actions={
          <Button variant="brass" leading={<Plus size={15} />} onClick={() => setOpen(true)}>
            New program
          </Button>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 fade-up fade-up-1">
        {PROGRAMS.map((program) => (
          <ProgramCard key={program.id} program={program} />
        ))}
      </div>

      <NewProgramDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function ProgramCard({ program }: { program: Program }) {
  const pieces = projectsInProgram(program.id);
  const total = pieces.reduce((n, p) => n + p.durationSec, 0);
  return (
    <article className="card flex flex-col overflow-hidden">
      <Link href={`/programs/${program.id}`} className="group block p-5 pb-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: SECTION_TOKEN[program.color] }} aria-hidden />
          <p className="eyebrow">{program.season}</p>
        </div>
        <h2 className="display text-[1.8rem] text-ink transition-colors group-hover:text-brass-3">{program.name}</h2>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={13} />
            {formatDate(program.date)}
          </span>
          <Dot />
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <MapPin size={13} className="shrink-0" />
            <span className="truncate">{program.venue}</span>
          </span>
        </div>
        <p className="mt-2 text-[13px] text-ink-3 tnum">
          {pieces.length} {pieces.length === 1 ? "piece" : "pieces"} · {formatDuration(total)}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {pieces.slice(0, 3).map((p) => (
            <span key={p.id} className="overflow-hidden rounded-[var(--radius-sm)] bg-stage">
              <StageThumb project={p} />
            </span>
          ))}
          {pieces.length === 0 && (
            <span className="col-span-3 grid h-16 place-items-center rounded-[var(--radius-sm)] border border-dashed border-line-strong text-xs text-ink-3">
              No pieces yet
            </span>
          )}
        </div>
      </Link>
      <div className="mt-auto flex items-center justify-between border-t border-line px-3 py-2.5">
        <Button variant="ghost" size="sm" leading={<Share2 size={14} />}>
          Share with musicians
        </Button>
        <Button href={`/programs/${program.id}`} variant="ghost" size="sm" trailing={<ArrowRight size={14} />}>
          Open
        </Button>
      </div>
    </article>
  );
}

function NewProgramDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setName("");
    setDate("");
    setVenue("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="New program"
      title={
        <>
          Plan a <em>concert</em>
        </>
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brass" size="sm" type="submit" form="new-program-form">
            Create program
          </Button>
        </>
      }
    >
      <form id="new-program-form" onSubmit={submit} className="space-y-4">
        <Field label="Program name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring Gala" autoFocus required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Venue">
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Concert hall" />
          </Field>
        </div>
        <p className="text-xs text-ink-3">You can add pieces from your library once the program exists.</p>
      </form>
    </Dialog>
  );
}
