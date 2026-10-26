"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronRight, Film, Mic, MoreHorizontal, Plus, Search, Share2, SlidersHorizontal, Trash2, Upload, Waves } from "lucide-react";
import type { ActivityItem, ProjectSummary } from "@/shared/domain";
import type { ProgramDto } from "@/shared/api";
import { SECTION_TOKEN } from "@/shared/sections";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/api/errors";
import { relativeTime } from "@/lib/utils/format";
import { PageHeader, Dot } from "@/components/shell/PageHeader";
import { StageThumb } from "@/components/visualizer/StageThumb";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { Segmented } from "@/components/ui/Segmented";
import { Progress } from "@/components/ui/Progress";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tooltip } from "@/components/ui/Tooltip";
import { toast } from "@/components/ui/toast";
import { StatusChip, projectHref, projectMeta, statusDetailFor } from "./projectStatus";
import { formatProgramDate, plural } from "./format";
import { LoadError, Skeleton } from "./states";
import { useResource } from "./useResource";

type Filter = "all" | "ready" | "needs-sync" | "importing" | "failed";
type View = "grid" | "list";
type Sort = "updated" | "title" | "composer" | "duration";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "needs-sync", label: "Needs sync" },
  { value: "importing", label: "Importing" },
  { value: "failed", label: "Failed" },
];

/** While a score is being parsed on the server, refresh the list this often. */
const IMPORT_POLL_MS = 4000;

export const ACTIVITY_ICON: Record<ActivityItem["kind"], ReactNode> = {
  import: <Upload size={14} aria-hidden />,
  sync: <Waves size={14} aria-hidden />,
  export: <Film size={14} aria-hidden />,
  edit: <SlidersHorizontal size={14} aria-hidden />,
  share: <Share2 size={14} aria-hidden />,
};

function matchesFilter(p: ProjectSummary, f: Filter) {
  if (f === "all") return true;
  if (f === "ready") return p.status === "ready" || p.status === "exported";
  return p.status === f;
}

function sortProjects(list: ProjectSummary[], sort: Sort): ProjectSummary[] {
  const sorted = [...list];
  switch (sort) {
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "composer":
      return sorted.sort((a, b) => a.composer.localeCompare(b.composer));
    case "duration":
      return sorted.sort((a, b) => b.durationSec - a.durationSec);
    default:
      return sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}

export function LibraryPage() {
  const projects = useResource(() => api.listProjects());
  const programs = useResource(() => api.listPrograms());
  const activity = useResource(() => api.listActivity());

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("grid");
  const [sort, setSort] = useState<Sort>("updated");
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);

  const all = projects.data;
  const shown = useMemo(() => {
    if (!all) return [];
    const q = query.trim().toLowerCase();
    const list = all
      .filter((p) => matchesFilter(p, filter))
      .filter((p) => !q || p.title.toLowerCase().includes(q) || p.composer.toLowerCase().includes(q) || (p.subtitle ?? "").toLowerCase().includes(q));
    return sortProjects(list, sort);
  }, [all, query, filter, sort]);

  // Parsing happens on the server; pick up the new status without a reload.
  const importing = all?.some((p) => p.status === "importing") ?? false;
  const { reload: reloadProjects, loading: projectsLoading } = projects;
  useEffect(() => {
    if (!importing || projectsLoading) return;
    const t = setTimeout(reloadProjects, IMPORT_POLL_MS);
    return () => clearTimeout(t);
  }, [importing, projectsLoading, reloadProjects]);

  const titles = useMemo(() => new Map((all ?? []).map((p) => [p.id, p.title])), [all]);

  const onDeleted = (project: ProjectSummary) => {
    projects.mutate((list) => list?.filter((p) => p.id !== project.id));
    programs.mutate((list) => list?.map((pr) => ({ ...pr, projectIds: pr.projectIds.filter((id) => id !== project.id) })));
    activity.reload();
  };

  const isEmptyLibrary = all !== undefined && all.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        className="fade-up"
        title="Library"
        meta={
          all && programs.data ? (
            <>
              <span className="tnum">{plural(all.length, "score")}</span>
              <Dot />
              <span className="tnum">{plural(programs.data.length, "program")}</span>
            </>
          ) : projects.error ? null : (
            <Skeleton className="h-4 w-36" />
          )
        }
      />

      {!isEmptyLibrary && !projects.error && (
        <div className="fade-up fade-up-1 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-sm">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title or composer" aria-label="Search scores" type="search" leading={<Search size={15} aria-hidden />} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="max-w-full overflow-x-auto scroll-thin">
              <Segmented value={filter} onChange={setFilter} options={FILTERS} size="sm" ariaLabel="Filter by status" />
            </div>
            <Segmented
              value={view}
              onChange={setView}
              size="sm"
              ariaLabel="View"
              options={[
                { value: "grid", label: "Grid" },
                { value: "list", label: "List" },
              ]}
            />
            <span className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Sort"
                className="h-8 appearance-none rounded-full border border-line bg-paper-2 pl-3.5 pr-8 text-[13px] font-medium text-ink-2 hover:text-ink focus:border-brass focus:outline-none focus:shadow-[var(--focus)]"
              >
                <option value="updated">Recently updated</option>
                <option value="title">Title A–Z</option>
                <option value="composer">Composer A–Z</option>
                <option value="duration">Longest first</option>
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 fade-up fade-up-2">
          {projects.error && !all ? (
            <LoadError error={projects.error} message={projects.errorText} onRetry={projects.reload} />
          ) : !all ? (
            <ProjectsSkeleton view={view} />
          ) : isEmptyLibrary ? (
            <EmptyState
              title={
                <>
                  Start with a <em>score</em>
                </>
              }
              body="Upload a MusicXML score, and a recording if you have one. Each part lights up as it plays, as bright as the score says."
              action={
                <Button href="/projects/new" variant="brass" size="md" leading={<Plus size={15} aria-hidden />}>
                  New project
                </Button>
              }
            />
          ) : shown.length === 0 ? (
            <EmptyState
              title={
                <>
                  No scores <em>match</em>
                </>
              }
              body="Try a different title or composer, or clear the status filter to see everything in your library."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Clear search and filters
                </Button>
              }
            />
          ) : view === "grid" ? (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Scores">
              <li>
                <NewProjectCard />
              </li>
              {shown.map((p) => (
                <li key={p.id}>
                  <ProjectCard project={p} onDelete={setDeleteTarget} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden" aria-label="Scores">
              <li>
                <NewProjectRow />
              </li>
              {shown.map((p) => (
                <li key={p.id}>
                  <ProjectRow project={p} onDelete={setDeleteTarget} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="min-w-0 space-y-6 fade-up fade-up-3 lg:sticky lg:top-24 lg:self-start" aria-label="Programs and activity">
          <ProgramsRail programs={programs.data} error={programs.error} errorText={programs.errorText} onRetry={programs.reload} />
          <ActivityRail activity={activity.data} titles={titles} error={activity.error} errorText={activity.errorText} onRetry={activity.reload} />
        </aside>
      </div>

      <DeleteProjectDialog project={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={onDeleted} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Project cards                                                       */
/* ------------------------------------------------------------------ */

function NewProjectCard() {
  return (
    <Link
      href="/projects/new"
      className="group flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-paper-2/40 p-6 text-center transition-colors hover:border-brass hover:bg-brass-soft/40"
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-paper-3 text-ink-2 transition-colors group-hover:bg-brass-soft group-hover:text-brass-3">
        <Plus size={18} aria-hidden />
      </span>
      <span className="font-serif text-lg text-ink">New project</span>
      <span className="text-xs text-ink-3">Upload a MusicXML score and an optional recording</span>
    </Link>
  );
}

function NewProjectRow() {
  return (
    <Link href="/projects/new" className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-paper-3/60">
      <span className="grid h-9 w-14 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-dashed border-line-strong text-ink-3 group-hover:border-brass group-hover:text-brass">
        <Plus size={16} aria-hidden />
      </span>
      <span className="font-serif text-[15px] text-ink">New project</span>
      <span className="hidden text-xs text-ink-3 sm:inline">Upload a score and an optional recording</span>
    </Link>
  );
}

/** Title link stretched over the whole card; the actions menu sits above it. */
function TitleLink({ project, className }: { project: ProjectSummary; className?: string }) {
  return (
    <Link href={projectHref(project)} className={`after:absolute after:inset-0 after:content-[''] ${className ?? ""}`}>
      {project.title} {project.subtitle && <em className="text-ink-2">{project.subtitle}</em>}
    </Link>
  );
}

function ProjectActions({ project, onDelete }: { project: ProjectSummary; onDelete: (p: ProjectSummary) => void }) {
  return (
    <Menu
      align="end"
      trigger={
        <button
          type="button"
          aria-label={`Actions for ${project.title}`}
          className="focus-round relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink"
        >
          <MoreHorizontal size={16} aria-hidden />
        </button>
      }
    >
      <MenuItem href={projectHref(project)} icon={<ArrowRight size={15} />}>
        Open
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        tone="danger"
        icon={<Trash2 size={15} />}
        onSelect={() => {
          // let the menu close and hand focus back to its trigger before the dialog takes it
          window.setTimeout(() => onDelete(project), 0);
        }}
      >
        Delete…
      </MenuItem>
    </Menu>
  );
}

function RecordingBadge() {
  return (
    <Tooltip label="Has a recording">
      <span className="relative z-10 grid h-5 w-5 place-items-center rounded-full bg-paper-3 text-ink-2" role="img" aria-label="Has a recording">
        <Mic size={11} aria-hidden />
      </span>
    </Tooltip>
  );
}

function ProjectCard({ project, onDelete }: { project: ProjectSummary; onDelete: (p: ProjectSummary) => void }) {
  const detail = statusDetailFor(project);
  const meta = projectMeta(project);
  return (
    <article className="group card relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="p-2.5 pb-0">
        <StageThumb project={project} />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-serif text-[1.2rem] leading-tight text-ink transition-colors group-hover:text-brass-3">
              <TitleLink project={project} />
            </h3>
            <p className="mt-1 text-[13px] text-ink-2">{project.composer}</p>
            {project.movement && <p className="truncate text-xs text-ink-3">{project.movement}</p>}
          </div>
          <ProjectActions project={project} onDelete={onDelete} />
        </div>
        {meta && <p className="text-xs text-ink-3 tnum">{meta}</p>}
        {project.status === "importing" && <Progress value={1} indeterminate tone="ink" className="h-1" ariaLabel={`Importing ${project.title}`} />}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex min-w-0 items-center gap-2">
            <StatusChip project={project} />
            {detail && <span className="truncate text-xs text-ink-3">{detail}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-ink-3">
            {project.hasRecording && <RecordingBadge />}
            <span>{relativeTime(project.updatedAt)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function ProjectRow({ project, onDelete }: { project: ProjectSummary; onDelete: (p: ProjectSummary) => void }) {
  const detail = statusDetailFor(project);
  return (
    <article className="group relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-paper-3/60">
      <span className="w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-stage">
        <StageThumb project={project} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="font-serif text-[15px] text-ink transition-colors group-hover:text-brass-3">
            <TitleLink project={project} />
          </h3>
          <span className="text-xs text-ink-3">{project.composer}</span>
        </div>
        <p className="truncate text-xs text-ink-3 tnum">{[projectMeta(project), detail].filter(Boolean).join(" · ")}</p>
        {project.status === "importing" && <Progress value={1} indeterminate tone="ink" className="mt-1.5 h-1 max-w-52" ariaLabel={`Importing ${project.title}`} />}
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        {project.hasRecording && <RecordingBadge />}
        <StatusChip project={project} />
      </div>
      <span className="hidden w-16 text-right text-xs text-ink-3 md:block">{relativeTime(project.updatedAt)}</span>
      <ProjectActions project={project} onDelete={onDelete} />
    </article>
  );
}

function ProjectsSkeleton({ view }: { view: View }) {
  const items = [0, 1, 2, 3, 4];
  if (view === "list") {
    return (
      <div className="card divide-y divide-line overflow-hidden" aria-busy="true" aria-label="Loading scores">
        <NewProjectRow />
        {items.map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-9 w-14 shrink-0 rounded-[var(--radius-sm)]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading scores">
      <NewProjectCard />
      {items.map((i) => (
        <div key={i} className="card flex flex-col overflow-hidden">
          <div className="p-2.5 pb-0">
            <Skeleton className="aspect-[16/10] w-full rounded-[var(--radius-lg)]" />
          </div>
          <div className="flex flex-col gap-2.5 p-4 pt-3.5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

function DeleteProjectDialog({
  project,
  onClose,
  onDeleted,
}: {
  project: ProjectSummary | null;
  onClose: () => void;
  onDeleted: (p: ProjectSummary) => void;
}) {
  const [busy, setBusy] = useState(false);
  // keep the title on screen while the dialog closes
  const [shown, setShown] = useState<ProjectSummary | null>(project);
  if (project && project !== shown) setShown(project);

  const close = () => {
    if (!busy) onClose();
  };

  const confirm = async () => {
    if (!project || busy) return;
    setBusy(true);
    try {
      await api.deleteProject(project.id);
      toast.success(`Deleted “${project.title}”`);
      onDeleted(project);
      onClose();
    } catch (err) {
      toast.error("Could not delete the project", { description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={project !== null}
      onClose={close}
      width="sm"
      title={`Delete “${shown?.title ?? "project"}”?`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={confirm} loading={busy}>
            Delete project
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-2">
        The score, the recording, sync markers, display settings and exported files are removed. Programs that list it drop it from their running order. This
        cannot be undone.
      </p>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Rail                                                                */
/* ------------------------------------------------------------------ */

const RAIL_PROGRAMS = 5;
const RAIL_ACTIVITY = 8;

function ProgramsRail({ programs, error, errorText, onRetry }: { programs: ProgramDto[] | undefined; error: unknown; errorText: string | null; onRetry: () => void }) {
  return (
    <section className="card p-5" aria-labelledby="rail-programs">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="rail-programs" className="display text-[1.4rem]">
          Programs
        </h2>
        <Link href="/programs" className="text-[13px] text-ink-3 hover:text-ink">
          All programs
        </Link>
      </div>
      {error && !programs ? (
        <LoadError variant="inline" error={error} message={errorText} onRetry={onRetry} />
      ) : !programs ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading programs">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : programs.length === 0 ? (
        <p className="text-[13px] text-ink-3">
          No programs yet.{" "}
          <Link href="/programs" className="font-medium text-ink underline-offset-4 hover:underline">
            Plan a concert
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {programs.slice(0, RAIL_PROGRAMS).map((pr) => (
            <li key={pr.id}>
              <Link href={`/programs/${pr.id}`} className="group flex items-center gap-3 py-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SECTION_TOKEN[pr.color] }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink group-hover:text-brass-3">{pr.name}</span>
                  <span className="block text-xs text-ink-3">
                    {formatProgramDate(pr.date)} · {plural(pr.projectIds.length, "piece")}
                  </span>
                </span>
                <ChevronRight size={14} className="text-ink-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityRail({
  activity,
  titles,
  error,
  errorText,
  onRetry,
}: {
  activity: ActivityItem[] | undefined;
  titles: Map<string, string>;
  error: unknown;
  errorText: string | null;
  onRetry: () => void;
}) {
  return (
    <section className="card p-5" aria-labelledby="rail-activity">
      <h2 id="rail-activity" className="display mb-3 text-[1.4rem]">
        Recent activity
      </h2>
      {error && !activity ? (
        <LoadError variant="inline" error={error} message={errorText} onRetry={onRetry} />
      ) : !activity ? (
        <div className="space-y-3.5" aria-busy="true" aria-label="Loading activity">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-5/6" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : activity.length === 0 ? (
        <p className="text-[13px] text-ink-3">Nothing yet. Imports, syncs and exports show up here.</p>
      ) : (
        <ActivityList items={activity.slice(0, RAIL_ACTIVITY)} titles={titles} />
      )}
    </section>
  );
}

export function ActivityList({ items, titles }: { items: ActivityItem[]; titles: Map<string, string> }) {
  return (
    <ul className="space-y-3.5">
      {items.map((a) => {
        const title = titles.get(a.projectId);
        return (
          <li key={a.id} className="flex gap-3">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper-3 text-ink-2">{ACTIVITY_ICON[a.kind]}</span>
            <span className="min-w-0">
              <span className="block text-[13px] leading-snug text-ink">{a.text}</span>
              <span className="block text-xs text-ink-3">
                {title ? `${title} · ` : ""}
                <time dateTime={a.at}>{relativeTime(a.at)}</time>
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
