"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Film, Mic, Plus, Search, Share2, SlidersHorizontal, Upload, Waves } from "lucide-react";
import type { ActivityItem, ProjectSummary } from "@/shared/domain";
import { SECTION_TOKEN } from "@/shared/sections";
import { ACTIVITY, PROGRAMS, PROJECTS, getProject } from "@/lib/mock/library";
import { cx, formatDate, relativeTime } from "@/lib/utils/format";
import { PageHeader, Dot } from "@/components/shell/PageHeader";
import { StageThumb } from "@/components/visualizer/StageThumb";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Progress } from "@/components/ui/Progress";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tooltip } from "@/components/ui/Tooltip";
import { StatusChip, projectHref, projectMeta, statusDetailFor } from "./projectStatus";

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

const ACTIVITY_ICON: Record<ActivityItem["kind"], React.ReactNode> = {
  import: <Upload size={14} />,
  sync: <Waves size={14} />,
  export: <Film size={14} />,
  edit: <SlidersHorizontal size={14} />,
  share: <Share2 size={14} />,
};

function matchesFilter(p: ProjectSummary, f: Filter) {
  if (f === "all") return true;
  if (f === "ready") return p.status === "ready" || p.status === "exported";
  return p.status === f;
}

export function LibraryPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("grid");
  const [sort, setSort] = useState<Sort>("updated");

  const projects = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = PROJECTS.filter((p) => matchesFilter(p, filter)).filter(
      (p) => !q || p.title.toLowerCase().includes(q) || p.composer.toLowerCase().includes(q) || (p.subtitle ?? "").toLowerCase().includes(q),
    );
    const sorted = [...list];
    switch (sort) {
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "composer":
        sorted.sort((a, b) => a.composer.localeCompare(b.composer));
        break;
      case "duration":
        sorted.sort((a, b) => b.durationSec - a.durationSec);
        break;
      default:
        sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return sorted;
  }, [query, filter, sort]);

  const nothingMatches = projects.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        className="fade-up"
        eyebrow="Library"
        title={
          <>
            Your <em>scores</em>
          </>
        }
        meta={
          <>
            <span className="tnum">{PROJECTS.length} scores</span>
            <Dot />
            <span className="tnum">{PROGRAMS.length} programs</span>
            <Dot />
            <span className="tnum">2.4 GB used</span>
          </>
        }
        actions={
          <Button href="/projects/new" variant="brass" size="md" leading={<Plus size={15} />}>
            New project
          </Button>
        }
      />

      {/* toolbar */}
      <div className="fade-up fade-up-1 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full lg:max-w-sm">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or composer"
            aria-label="Search scores"
            leading={<Search size={15} />}
          />
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
            <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />
          </span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* main */}
        <div className="min-w-0 fade-up fade-up-2">
          {nothingMatches ? (
            <EmptyState
              eyebrow="Nothing on the stand"
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
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <NewProjectCard />
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          ) : (
            <div className="card divide-y divide-line overflow-hidden">
              <NewProjectRow />
              {projects.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
            </div>
          )}
        </div>

        {/* rail */}
        <aside className="space-y-6 min-w-0 fade-up fade-up-3 lg:sticky lg:top-24 lg:self-start">
          <section className="card p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <div>
                <p className="eyebrow mb-1">Programs</p>
                <h2 className="display text-[1.5rem]">Upcoming</h2>
              </div>
              <Link href="/programs" className="text-[13px] text-ink-3 hover:text-ink">
                All
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {PROGRAMS.map((pr) => (
                <li key={pr.id}>
                  <Link href={`/programs/${pr.id}`} className="group flex items-center gap-3 py-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SECTION_TOKEN[pr.color] }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink group-hover:text-brass-3">{pr.name}</span>
                      <span className="block text-xs text-ink-3">
                        {formatDate(pr.date)} · {pr.projectIds.length} pieces
                      </span>
                    </span>
                    <ChevronRight size={14} className="text-ink-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <p className="eyebrow mb-1">Recent activity</p>
            <h2 className="display text-[1.5rem] mb-3">This month</h2>
            <ul className="space-y-3.5">
              {ACTIVITY.map((a) => {
                const project = getProject(a.projectId);
                return (
                  <li key={a.id} className="flex gap-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper-3 text-ink-2">{ACTIVITY_ICON[a.kind]}</span>
                    <span className="min-w-0">
                      <span className="block text-[13px] leading-snug text-ink">{a.text}</span>
                      <span className="block text-xs text-ink-3" suppressHydrationWarning>
                        {project?.title ?? "Project"} · {relativeTime(a.at)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function NewProjectCard() {
  return (
    <Link
      href="/projects/new"
      className="group flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-paper-2/40 p-6 text-center transition-colors hover:border-brass hover:bg-brass-soft/40"
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-paper-3 text-ink-2 transition-colors group-hover:bg-brass-soft group-hover:text-brass-3">
        <Plus size={18} />
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
        <Plus size={16} />
      </span>
      <span className="font-serif text-[15px] text-ink">New project</span>
      <span className="hidden text-xs text-ink-3 sm:inline">Upload a score and an optional recording</span>
    </Link>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const detail = statusDetailFor(project);
  return (
    <Link href={projectHref(project)} className="group card flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="p-2.5 pb-0">
        <StageThumb project={project} />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4 pt-3.5">
        <div className="min-w-0">
          <h3 className="font-serif text-[1.2rem] leading-tight text-ink group-hover:text-brass-3 transition-colors">
            {project.title} {project.subtitle && <em className="text-ink-2">{project.subtitle}</em>}
          </h3>
          <p className="mt-1 text-[13px] text-ink-2">{project.composer}</p>
          <p className="text-xs text-ink-3 truncate">{project.movement}</p>
        </div>
        <p className="text-xs text-ink-3 tnum">{projectMeta(project)}</p>
        {project.status === "importing" && <Progress value={0.64} indeterminate tone="brass" className="h-1" />}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex min-w-0 items-center gap-2">
            <StatusChip project={project} />
            {detail && <span className="truncate text-xs text-ink-3">{detail}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-ink-3">
            {project.hasRecording && (
              <Tooltip label="Has recording">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-paper-3 text-ink-2" aria-label="Has recording">
                  <Mic size={11} />
                </span>
              </Tooltip>
            )}
            <span suppressHydrationWarning>{relativeTime(project.updatedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ProjectRow({ project }: { project: ProjectSummary }) {
  const detail = statusDetailFor(project);
  return (
    <Link href={projectHref(project)} className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-paper-3/60">
      <span className="w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-stage">
        <StageThumb project={project} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-serif text-[15px] text-ink group-hover:text-brass-3 transition-colors">
            {project.title} {project.subtitle && <em className="text-ink-2">{project.subtitle}</em>}
          </span>
          <span className="text-xs text-ink-3">{project.composer}</span>
        </span>
        <span className={cx("block text-xs text-ink-3 tnum", "truncate")}>
          {projectMeta(project)}
          {detail && ` · ${detail}`}
        </span>
        {project.status === "importing" && <Progress value={0.64} indeterminate className="mt-1.5 h-1 max-w-[200px]" />}
      </span>
      <span className="hidden items-center gap-2 sm:flex">
        {project.hasRecording && (
          <span className="grid h-5 w-5 place-items-center rounded-full bg-paper-3 text-ink-2" aria-label="Has recording">
            <Mic size={11} />
          </span>
        )}
        <StatusChip project={project} />
      </span>
      <span className="hidden w-16 text-right text-xs text-ink-3 md:block" suppressHydrationWarning>
        {relativeTime(project.updatedAt)}
      </span>
      <ChevronRight size={14} className="shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
