"use client";

import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Mic, MoreHorizontal, Play, Plus, Trash2, X } from "lucide-react";
import type { ProjectSummary } from "@/shared/domain";
import type { ProgramDto } from "@/shared/api";
import { SECTION_TOKEN } from "@/shared/sections";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/api/errors";
import { cx, formatDuration, formatTime } from "@/lib/utils/format";
import { PageHeader, Dot } from "@/components/shell/PageHeader";
import { StageThumb } from "@/components/visualizer/StageThumb";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { Tooltip } from "@/components/ui/Tooltip";
import { toast } from "@/components/ui/toast";
import { StatusChip, projectHref } from "./projectStatus";
import { formatProgramDate, isPresentable, plural } from "./format";
import { LoadError, Skeleton } from "./states";
import { useResource } from "./useResource";

type ProgramData = { program: ProgramDto; projects: ProjectSummary[] };

/** Loads the program in the browser (the session cookie rides along with the API call). */
export function ProgramDetail({ programId }: { programId: string }) {
  const res = useResource(() => api.getProgram(programId), programId);

  if (res.error && res.data === undefined) {
    return (
      <div className="space-y-6">
        <BackLink />
        <LoadError error={res.error} message={res.errorText} onRetry={res.reload} />
      </div>
    );
  }
  if (res.data === undefined) return <ProgramSkeleton />;
  if (res.data === null) return <ProgramNotFound />;
  return <ProgramView data={res.data} mutate={res.mutate} />;
}

function BackLink() {
  return (
    <Link href="/programs" className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
      <ArrowLeft size={13} aria-hidden /> All programs
    </Link>
  );
}

function ProgramNotFound() {
  return (
    <div className="space-y-6">
      <BackLink />
      <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
        <h1 className="display text-[2rem]">Program not found</h1>
        <p className="max-w-md text-sm text-ink-3">It may have been deleted, or the link belongs to another account.</p>
        <Button href="/programs" variant="outline" size="sm">
          All programs
        </Button>
      </div>
    </div>
  );
}

function ProgramSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading program">
      <div>
        <Skeleton className="mb-4 h-4 w-24" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="mt-2.5 h-4 w-60 max-w-full" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card divide-y divide-line overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="hidden aspect-[16/10] w-30 rounded-[var(--radius-sm)] sm:block" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
        <div className="card p-5">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-3 h-36 w-full" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loaded                                                              */
/* ------------------------------------------------------------------ */

function ProgramView({
  data,
  mutate,
}: {
  data: ProgramData;
  mutate: (update: (d: ProgramData | null | undefined) => ProgramData | null | undefined) => void;
}) {
  const router = useRouter();
  const { program, projects } = data;
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const total = projects.reduce((n, p) => n + p.durationSec, 0);
  const first = projects.find(isPresentable);
  const ids = useId();
  const moveId = (dir: "up" | "down", projectId: string) => `${ids}-${dir}-${projectId}`;

  const setOrder = (next: ProjectSummary[]) =>
    mutate((d) => (d ? { ...d, projects: next, program: { ...d.program, projectIds: next.map((p) => p.id) } } : d));

  /** Optimistic: show the new order now, revert if the server refuses. */
  const saveOrder = async (next: ProjectSummary[]): Promise<boolean> => {
    const previous = projects;
    setOrder(next);
    setSaving(true);
    try {
      const saved = await api.updateProgram(program.id, { projectIds: next.map((p) => p.id) });
      mutate((d) => (d ? { ...d, program: saved } : d));
      return true;
    } catch (err) {
      setOrder(previous);
      toast.error("Could not update the running order", { description: errorMessage(err) });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const move = (index: number, dir: "up" | "down") => {
    if (saving) return;
    const to = dir === "up" ? index - 1 : index + 1;
    if (to < 0 || to >= projects.length) return;
    const next = [...projects];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    void saveOrder(next);
    // the row moved in the DOM; keep focus on the button that moved it (or its twin at the edge)
    const atEdge = dir === "up" ? to === 0 : to === projects.length - 1;
    const target = atEdge ? moveId(dir === "up" ? "down" : "up", item.id) : moveId(dir, item.id);
    requestAnimationFrame(() => document.getElementById(target)?.focus());
  };

  const remove = async (project: ProjectSummary) => {
    if (saving) return;
    const ok = await saveOrder(projects.filter((p) => p.id !== project.id));
    if (ok) toast.success(`Removed “${project.title}” from the program`);
  };

  const add = async (picked: ProjectSummary[]) => {
    const ok = await saveOrder([...projects, ...picked]);
    if (ok) {
      toast.success(picked.length === 1 ? `Added “${picked[0].title}”` : `Added ${picked.length} pieces`);
      setAddOpen(false);
    }
  };

  const deleteProgram = async () => {
    await api.deleteProgram(program.id);
    toast.success(`Deleted “${program.name}”`);
    router.push("/programs");
  };

  return (
    <div className="space-y-8">
      <div className="fade-up">
        <div className="mb-4">
          <BackLink />
        </div>
        <PageHeader
          title={
            <span className="inline-flex items-center gap-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: SECTION_TOKEN[program.color] }} aria-hidden />
              {program.name}
            </span>
          }
          meta={
            <>
              <span>{formatProgramDate(program.date)}</span>
              {program.venue && (
                <>
                  <Dot />
                  <span>{program.venue}</span>
                </>
              )}
              {program.season && (
                <>
                  <Dot />
                  <span>{program.season}</span>
                </>
              )}
              <Dot />
              <span className="tnum">{plural(projects.length, "piece")}</span>
              {projects.length > 0 && (
                <>
                  <Dot />
                  <span className="tnum">{formatDuration(total)}</span>
                </>
              )}
            </>
          }
          actions={
            <>
              <Button variant="outline" size="sm" leading={<Plus size={14} aria-hidden />} onClick={() => setAddOpen(true)}>
                Add pieces
              </Button>
              {first ? (
                <Button href={`/projects/${first.id}/preview`} variant="brass" size="sm" leading={<Play size={14} aria-hidden />}>
                  Present
                </Button>
              ) : (
                <Tooltip label={projects.length === 0 ? "Add a piece first" : "No piece is ready to present yet"}>
                  <Button variant="brass" size="sm" leading={<Play size={14} aria-hidden />} disabled>
                    Present
                  </Button>
                </Tooltip>
              )}
              <Menu
                align="end"
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label="More program actions">
                    <MoreHorizontal size={16} aria-hidden />
                  </Button>
                }
              >
                <MenuItem tone="danger" icon={<Trash2 size={15} />} onSelect={() => window.setTimeout(() => setDeleteOpen(true), 0)}>
                  Delete program…
                </MenuItem>
              </Menu>
            </>
          }
        />
        {program.description && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">{program.description}</p>}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 fade-up fade-up-1" aria-labelledby="running-order">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="running-order" className="display text-[1.5rem]">
              Running order
            </h2>
            {projects.length > 0 && <span className="text-[13px] text-ink-3 tnum">{formatDuration(total)} of music</span>}
          </div>

          {projects.length === 0 ? (
            <EmptyState
              title={
                <>
                  Nothing <em>programmed</em> yet
                </>
              }
              body="Add pieces from your library. They play here in running order."
              action={
                <Button variant="brass" size="sm" leading={<Plus size={14} aria-hidden />} onClick={() => setAddOpen(true)}>
                  Add pieces
                </Button>
              }
            />
          ) : (
            <ol className="card divide-y divide-line overflow-hidden" aria-busy={saving || undefined}>
              {projects.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
                  <span className="w-6 shrink-0 font-serif text-lg text-ink-3 tnum" aria-hidden>
                    {i + 1}.
                  </span>
                  <span className="hidden w-30 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-stage sm:block">
                    <StageThumb project={p} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-ink-3">{p.composer}</span>
                    <Link href={projectHref(p)} className="block font-serif text-[1.1rem] leading-snug text-ink hover:text-brass-3">
                      {p.title} {p.subtitle && <em className="text-ink-2">{p.subtitle}</em>}
                    </Link>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                      {p.movement && (
                        <>
                          <span className="truncate">{p.movement}</span>
                          <Dot />
                        </>
                      )}
                      <span className="tnum">{formatTime(p.durationSec)}</span>
                      {p.hasRecording && (
                        <>
                          <Dot />
                          <span className="inline-flex items-center gap-1">
                            <Mic size={11} aria-hidden /> recording
                          </span>
                        </>
                      )}
                    </span>
                    <span className="mt-2 flex items-center gap-2 md:hidden">
                      <StatusChip project={p} />
                    </span>
                  </span>
                  <span className="hidden md:block">
                    <StatusChip project={p} />
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <OrderButton id={moveId("up", p.id)} label={`Move “${p.title}” up`} disabled={i === 0} onClick={() => move(i, "up")}>
                      <ArrowUp size={14} aria-hidden />
                    </OrderButton>
                    <OrderButton id={moveId("down", p.id)} label={`Move “${p.title}” down`} disabled={i === projects.length - 1} onClick={() => move(i, "down")}>
                      <ArrowDown size={14} aria-hidden />
                    </OrderButton>
                    <OrderButton label={`Remove “${p.title}” from the program`} onClick={() => void remove(p)}>
                      <X size={14} aria-hidden />
                    </OrderButton>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="min-w-0 space-y-6 fade-up fade-up-2 lg:sticky lg:top-24 lg:self-start">
          <NotesCard key={program.id} program={program} onSaved={(saved) => mutate((d) => (d ? { ...d, program: saved } : d))} />
        </aside>
      </div>

      {addOpen && <AddPiecesDialog existing={program.projectIds} onClose={() => setAddOpen(false)} onAdd={add} />}
      <ConfirmDeleteProgram open={deleteOpen} name={program.name} onClose={() => setDeleteOpen(false)} onConfirm={deleteProgram} />
    </div>
  );
}

function OrderButton({ id, label, disabled, onClick, children }: { id?: string; label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip label={label}>
      <button
        id={id}
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="focus-round grid h-8 w-8 place-items-center rounded-full text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
      >
        {children}
      </button>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

function NotesCard({ program, onSaved }: { program: ProgramDto; onSaved: (p: ProgramDto) => void }) {
  const [notes, setNotes] = useState(program.notes);
  const [saved, setSaved] = useState(program.notes);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const fieldId = useId();

  const save = async () => {
    if (notes === saved || status === "saving") return;
    const value = notes;
    setStatus("saving");
    try {
      const program2 = await api.updateProgram(program.id, { notes: value });
      setSaved(value);
      setStatus("saved");
      onSaved(program2);
    } catch (err) {
      setStatus("error");
      toast.error("Could not save the notes", { description: errorMessage(err) });
    }
  };

  const statusText =
    status === "saving" ? "Saving…" : status === "error" ? "Not saved. Click outside the box to try again." : notes !== saved ? "Saves when you leave the box." : status === "saved" ? "Saved" : "Only you see these.";

  return (
    <section className="card p-5" aria-labelledby={`${fieldId}-label`}>
      <label id={`${fieldId}-label`} htmlFor={fieldId} className="display mb-3 block text-[1.4rem]">
        Notes
      </label>
      <Textarea
        id={fieldId}
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          if (status === "saved") setStatus("idle");
        }}
        onBlur={() => void save()}
        rows={7}
        maxLength={5000}
        aria-describedby={`${fieldId}-status`}
        placeholder="Lobby screens, cues, who needs the link…"
      />
      <p id={`${fieldId}-status`} className={cx("mt-1.5 text-xs", status === "error" ? "text-danger" : "text-ink-3")} aria-live="polite">
        {statusText}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Add pieces                                                          */
/* ------------------------------------------------------------------ */

function AddPiecesDialog({ existing, onClose, onAdd }: { existing: string[]; onClose: () => void; onAdd: (picked: ProjectSummary[]) => Promise<void> }) {
  const library = useResource(() => api.listProjects());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const available = useMemo(() => {
    const taken = new Set(existing);
    return (library.data ?? []).filter((p) => !taken.has(p.id));
  }, [library.data, existing]);

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || selected.size === 0) return;
    setBusy(true);
    try {
      await onAdd(available.filter((p) => selected.has(p.id)));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (!busy) onClose();
  };

  let body: ReactNode;
  if (library.error && !library.data) {
    body = <LoadError variant="inline" error={library.error} message={library.errorText} onRetry={library.reload} />;
  } else if (!library.data) {
    body = (
      <div className="space-y-3" aria-busy="true" aria-label="Loading your library">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-4" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (library.data.length === 0) {
    body = (
      <p className="text-sm text-ink-3">
        Your library has no scores yet.{" "}
        <Link href="/projects/new" className="font-medium text-ink underline-offset-4 hover:underline">
          Start a new project
        </Link>
      </p>
    );
  } else if (available.length === 0) {
    body = <p className="text-sm text-ink-3">Every score in your library is already in this program.</p>;
  } else {
    body = (
      <fieldset>
        <legend className="sr-only">Scores to add</legend>
        <ul className="-mx-2 max-h-80 divide-y divide-line overflow-y-auto scroll-thin">
          {available.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] px-2 py-2.5 hover:bg-paper-3/60">
                <input type="checkbox" className="h-4 w-4 shrink-0 accent-brass" checked={selected.has(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {p.title} {p.subtitle && <em className="text-ink-2">{p.subtitle}</em>}
                  </span>
                  <span className="block truncate text-xs text-ink-3">
                    {p.composer}
                    {p.durationSec > 0 && ` · ${formatTime(p.durationSec)}`}
                  </span>
                </span>
                <StatusChip project={p} />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    );
  }

  return (
    <Dialog
      open
      onClose={close}
      title="Add pieces"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="brass" size="sm" type="submit" form="add-pieces-form" loading={busy} disabled={selected.size === 0}>
            {selected.size > 1 ? `Add ${selected.size} pieces` : "Add piece"}
          </Button>
        </>
      }
    >
      <form id="add-pieces-form" onSubmit={submit}>
        {body}
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Delete program                                                      */
/* ------------------------------------------------------------------ */

function ConfirmDeleteProgram({
  open,
  name,
  onClose,
  onConfirm,
}: {
  open: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const close = () => {
    if (!busy) onClose();
  };
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } catch (err) {
      setBusy(false);
      toast.error("Could not delete the program", { description: errorMessage(err) });
    }
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      width="sm"
      title={`Delete “${name}”?`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={confirm} loading={busy}>
            Delete program
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-2">The running order and notes are removed. The pieces stay in your library.</p>
    </Dialog>
  );
}

