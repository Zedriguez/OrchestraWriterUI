"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, MapPin, Plus } from "lucide-react";
import type { ProjectSummary } from "@/shared/domain";
import type { ProgramDto } from "@/shared/api";
import { SECTION_TOKEN } from "@/shared/sections";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/api/errors";
import { formatDuration } from "@/lib/utils/format";
import { PageHeader, Dot } from "@/components/shell/PageHeader";
import { FormError, FormField } from "@/components/shell/FormField";
import { StageThumb } from "@/components/visualizer/StageThumb";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/toast";
import { formatProgramDate, piecesFor, plural } from "./format";
import { LoadError, Skeleton } from "./states";
import { useResource } from "./useResource";

export function ProgramsPage() {
  const programs = useResource(() => api.listPrograms());
  const projects = useResource(() => api.listProjects());
  const [open, setOpen] = useState(false);

  const byId = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p])), [projects.data]);
  const list = programs.data;
  const totalPieces = list?.reduce((n, p) => n + p.projectIds.length, 0) ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        className="fade-up"
        title="Programs"
        meta={
          list ? (
            <>
              <span className="tnum">{plural(list.length, "program")}</span>
              <Dot />
              <span className="tnum">{plural(totalPieces, "piece")}</span>
            </>
          ) : programs.error ? null : (
            <Skeleton className="h-4 w-32" />
          )
        }
        actions={
          <Button variant="brass" leading={<Plus size={15} aria-hidden />} onClick={() => setOpen(true)}>
            New program
          </Button>
        }
      />

      <div className="fade-up fade-up-1">
        {programs.error && !list ? (
          <LoadError error={programs.error} message={programs.errorText} onRetry={programs.reload} />
        ) : !list ? (
          <ProgramsSkeleton />
        ) : list.length === 0 ? (
          <EmptyState
            title={
              <>
                Plan a <em>concert</em>
              </>
            }
            body="A program is the running order of one concert. Add pieces from your library and present them one after another."
            action={
              <Button variant="brass" leading={<Plus size={15} aria-hidden />} onClick={() => setOpen(true)}>
                New program
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Programs">
            {list.map((program) => (
              <li key={program.id}>
                <ProgramCard program={program} pieces={piecesFor(program.projectIds, byId)} piecesLoading={!projects.data && !projects.error} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <NewProgramDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function ProgramCard({ program, pieces, piecesLoading }: { program: ProgramDto; pieces: ProjectSummary[]; piecesLoading: boolean }) {
  const total = pieces.reduce((n, p) => n + p.durationSec, 0);
  const count = program.projectIds.length;
  return (
    <Link href={`/programs/${program.id}`} className="group card flex h-full flex-col p-5 transition-shadow hover:shadow-md">
      <h2 className="display flex items-center gap-2.5 text-[1.6rem] text-ink transition-colors group-hover:text-brass-3">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SECTION_TOKEN[program.color] }} aria-hidden />
        <span className="min-w-0 truncate">{program.name}</span>
      </h2>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={13} aria-hidden />
          {formatProgramDate(program.date)}
        </span>
        {program.venue && (
          <>
            <Dot />
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin size={13} className="shrink-0" aria-hidden />
              <span className="truncate">{program.venue}</span>
            </span>
          </>
        )}
        {program.season && (
          <>
            <Dot />
            <span>{program.season}</span>
          </>
        )}
      </div>
      <p className="mt-2 text-[13px] text-ink-3 tnum">
        {plural(count, "piece")}
        {count > 0 && !piecesLoading && ` · ${formatDuration(total)}`}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {count === 0 ? (
          <span className="col-span-3 grid h-16 place-items-center rounded-[var(--radius-sm)] border border-dashed border-line-strong text-xs text-ink-3">No pieces yet</span>
        ) : piecesLoading ? (
          program.projectIds.slice(0, 3).map((id) => <Skeleton key={id} className="aspect-[16/10] w-full rounded-[var(--radius-sm)]" />)
        ) : (
          pieces.slice(0, 3).map((p) => (
            <span key={p.id} className="overflow-hidden rounded-[var(--radius-sm)] bg-stage">
              <StageThumb project={p} />
            </span>
          ))
        )}
      </div>
    </Link>
  );
}

function ProgramsSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading programs">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card p-5">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="mt-3 h-3.5 w-1/2" />
          <Skeleton className="mt-2.5 h-3.5 w-1/4" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="aspect-[16/10] w-full rounded-[var(--radius-sm)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const EMPTY_FORM = { name: "", date: "", venue: "", season: "" };

function NewProgramDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const close = () => {
    if (busy) return;
    setForm(EMPTY_FORM);
    setNameError(null);
    setError(null);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const name = form.name.trim();
    if (!name) {
      setNameError("Give the program a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const program = await api.createProgram({
        name,
        date: form.date || undefined,
        venue: form.venue.trim() || undefined,
        season: form.season.trim() || undefined,
      });
      toast.success(`Created “${program.name}”`);
      router.push(`/programs/${program.id}`);
    } catch (err) {
      setError(errorMessage(err, "Could not create the program."));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="New program"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="brass" size="sm" type="submit" form="new-program-form" loading={busy}>
            Create program
          </Button>
        </>
      }
    >
      <form id="new-program-form" onSubmit={submit} className="space-y-4" noValidate>
        <FormField label="Name" error={nameError}>
          {(p) => (
            <Input
              {...p}
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="Spring Gala"
              maxLength={200}
            />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Date" hint="Optional">
            {(p) => <Input {...p} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />}
          </FormField>
          <FormField label="Venue" hint="Optional">
            {(p) => <Input {...p} value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Concert hall" maxLength={200} />}
          </FormField>
        </div>
        <FormField label="Season" hint="Optional">
          {(p) => <Input {...p} value={form.season} onChange={(e) => set("season", e.target.value)} placeholder="2026–27" maxLength={100} />}
        </FormField>
        <FormError>{error}</FormError>
      </form>
    </Dialog>
  );
}
