"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy, ExternalLink, Film, Globe, Pencil, Share2, SlidersHorizontal, Upload, Waves } from "lucide-react";
import type { ActivityItem, Director } from "@/shared/domain";
import { SECTION_TOKEN } from "@/shared/sections";
import { ACTIVITY, DEMO_DIRECTOR, PROGRAMS, PROJECTS, getProject, projectsInProgram } from "@/lib/mock/library";
import { useSession } from "@/lib/auth/session";
import { formatDate, formatDuration, relativeTime } from "@/lib/utils/format";
import { Aurora } from "@/components/brand/Aurora";
import { Dot } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

const ACTIVITY_ICON: Record<ActivityItem["kind"], React.ReactNode> = {
  import: <Upload size={14} />,
  sync: <Waves size={14} />,
  export: <Film size={14} />,
  edit: <SlidersHorizontal size={14} />,
  share: <Share2 size={14} />,
};

const ROLES: Director["role"][] = ["Music director", "Conductor", "Educator", "Student", "Listener"];

export function ProfilePage() {
  const sessionUser = useSession((s) => s.user);
  const user = sessionUser ?? DEMO_DIRECTOR;
  const [editOpen, setEditOpen] = useState(false);

  const exportsTotal = PROJECTS.reduce((n, p) => n + p.exports, 0);
  const publicProgram = PROGRAMS[0];
  const publicPieces = projectsInProgram(publicProgram.id);

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="relative overflow-hidden rounded-[var(--radius-xl)] border border-line bg-paper-2 grain fade-up">
        <Aurora subtle />
        <div className="relative z-10 flex flex-col gap-6 p-6 md:flex-row md:items-end md:justify-between md:p-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar initials={user.initials} size="xl" className="shrink-0" />
            <div className="min-w-0">
              <p className="eyebrow mb-2">Director</p>
              <h1 className="display text-[2.4rem] md:text-[3rem]">{user.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">
                <span>{user.role}</span>
                <Dot />
                <span>{user.ensemble}</span>
                <Dot />
                <span>{user.location}</span>
              </div>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">{user.bio}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-3">
                {user.website && (
                  <a href={`https://${user.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-brass-3 hover:underline">
                    <Globe size={13} />
                    {user.website}
                  </a>
                )}
                <span>@{user.handle}</span>
                <span>Joined {formatDate(user.joinedAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" leading={<Pencil size={14} />} onClick={() => setEditOpen(true)}>
              Edit profile
            </Button>
            <Button variant="outline" size="sm" trailing={<ExternalLink size={13} />}>
              Public page
            </Button>
          </div>
        </div>
      </section>

      {/* stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 fade-up fade-up-1">
        <Stat label="Scores" value={String(PROJECTS.length)} />
        <Stat label="Programs" value={String(PROGRAMS.length)} />
        <Stat label="Hours visualized" value="14.2" />
        <Stat label="Exports" value={String(exportsTotal)} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2 fade-up fade-up-2">
        {/* pinned programs */}
        <section className="card p-5 md:p-6">
          <p className="eyebrow mb-1">Pinned programs</p>
          <h2 className="display text-[1.6rem] mb-3">On the calendar</h2>
          <ul className="divide-y divide-line">
            {PROGRAMS.map((pr) => {
              const pieces = projectsInProgram(pr.id);
              const total = pieces.reduce((n, p) => n + p.durationSec, 0);
              return (
                <li key={pr.id}>
                  <Link href={`/programs/${pr.id}`} className="group flex items-center gap-3 py-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SECTION_TOKEN[pr.color] }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-serif text-[1.05rem] text-ink group-hover:text-brass-3 transition-colors">{pr.name}</span>
                      <span className="block text-xs text-ink-3 tnum">
                        {formatDate(pr.date)} · {pieces.length} pieces · {formatDuration(total)}
                      </span>
                    </span>
                    <ChevronRight size={14} className="text-ink-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* activity */}
        <section className="card p-5 md:p-6">
          <p className="eyebrow mb-1">Recent activity</p>
          <h2 className="display text-[1.6rem] mb-4">What you did</h2>
          <ol className="relative space-y-0 border-l border-line pl-6">
            {ACTIVITY.map((a) => {
              const project = getProject(a.projectId);
              return (
                <li key={a.id} className="relative pb-5 last:pb-0">
                  <span className="absolute -left-[37px] top-0 grid h-7 w-7 place-items-center rounded-full border border-line bg-paper-2 text-ink-2">{ACTIVITY_ICON[a.kind]}</span>
                  <p className="text-[13px] leading-snug text-ink">{a.text}</p>
                  <p className="mt-0.5 text-xs text-ink-3" suppressHydrationWarning>
                    {project?.title ?? "Project"} · {relativeTime(a.at)}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {/* public program page preview */}
      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] fade-up fade-up-3">
        <div>
          <p className="eyebrow mb-1">Public program page</p>
          <h2 className="display text-[1.6rem] mb-2">What musicians see</h2>
          <p className="text-[13px] leading-relaxed text-ink-3">
            A program link opens a plain page with the running order. Each piece plays with the visual and the recording. No account, no settings.
          </p>
          <ShareLink url={`https://orchestra.app/p/${publicProgram.id}`} />
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-line bg-paper-3/60 px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-ink-4" />
            <span className="h-2 w-2 rounded-full bg-ink-4" />
            <span className="h-2 w-2 rounded-full bg-ink-4" />
            <span className="ml-3 truncate text-xs text-ink-3 tnum">orchestra.app/p/{publicProgram.id}</span>
          </div>
          <div className="p-5 md:p-7">
            <p className="eyebrow mb-1.5">{user.ensemble}</p>
            <h3 className="display text-[1.9rem]">{publicProgram.name}</h3>
            <p className="mt-1 text-[13px] text-ink-3">
              {formatDate(publicProgram.date)} · {publicProgram.venue}
            </p>
            <ol className="mt-5 divide-y divide-line">
              {publicPieces.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 font-serif text-ink-3 tnum">{i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">
                      {p.composer} — {p.title} {p.subtitle && <em className="text-ink-2">{p.subtitle}</em>}
                    </span>
                    <span className="block text-xs text-ink-3">{p.movement}</span>
                  </span>
                  <span className="flex -space-x-1">
                    {Array.from(new Set(p.thumbnail.map((g) => g.section))).map((s) => (
                      <span key={s} className="h-2.5 w-2.5 rounded-full ring-2 ring-paper-2" style={{ background: SECTION_TOKEN[s] }} aria-hidden />
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {editOpen && <EditProfileDialog open onClose={() => setEditOpen(false)} user={user} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="display text-[2.2rem] tnum">{value}</p>
      <p className="mt-1 text-[13px] text-ink-3">{label}</p>
    </div>
  );
}

function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="mt-4 flex items-center gap-2">
      <input readOnly value={url} aria-label="Share link" className="h-10 min-w-0 flex-1 rounded-[var(--radius)] border border-line bg-paper-2 px-3.5 text-[13px] text-ink-2 tnum focus:outline-none" />
      <Button variant="outline" size="sm" onClick={copy} leading={copied ? <Check size={13} /> : <Copy size={13} />}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function EditProfileDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user: Director }) {
  const updateProfile = useSession((s) => s.updateProfile);
  const [form, setForm] = useState({
    name: user.name,
    role: user.role,
    ensemble: user.ensemble,
    location: user.location,
    website: user.website ?? "",
    bio: user.bio,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const initials = form.name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    updateProfile({ ...form, website: form.website || undefined, initials: initials || user.initials });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Profile"
      title={
        <>
          Edit <em>profile</em>
        </>
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" form="edit-profile-form">
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-profile-form" onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role">
            <Select value={form.role} onChange={(e) => set("role", e.target.value as Director["role"])}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ensemble">
            <Input value={form.ensemble} onChange={(e) => set("ensemble", e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location">
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Website">
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="yourensemble.org" />
          </Field>
        </div>
        <Field label="Bio" hint="Shown on your public program pages.">
          <Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={3} />
        </Field>
      </form>
    </Dialog>
  );
}
