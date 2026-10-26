"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Globe, Pencil } from "lucide-react";
import type { Director } from "@/shared/domain";
import type { ProfileDto, ProfileUpdate } from "@/shared/api";
import { SECTION_TOKEN } from "@/shared/sections";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session";
import { formatBytes, formatDate, formatDuration } from "@/lib/utils/format";
import { Aurora } from "@/components/brand/Aurora";
import { Dot } from "@/components/shell/PageHeader";
import { FormError, FormField } from "@/components/shell/FormField";
import { ActivityList } from "@/components/library/LibraryPage";
import { formatProgramDate, piecesFor, plural } from "@/components/library/format";
import { LoadError, Skeleton } from "@/components/library/states";
import { useResource } from "@/components/library/useResource";
import { ROLES } from "@/components/auth/AuthForm";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { toast } from "@/components/ui/toast";
import { normalizeWebsite, websiteHref, websiteLabel } from "./website";

const SHOWN_PROGRAMS = 5;
const SHOWN_ACTIVITY = 10;

export function ProfilePage() {
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const [editOpen, setEditOpen] = useState(false);

  const projects = useResource(() => api.listProjects());
  const programs = useResource(() => api.listPrograms());
  const activity = useResource(() => api.listActivity());
  const usage = useResource(() => api.getUsage());

  const byId = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p])), [projects.data]);
  const titles = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.title])), [projects.data]);
  const exportsTotal = projects.data?.reduce((n, p) => n + p.exports, 0);

  return (
    <div className="space-y-8">
      {user ? <Hero user={user} onEdit={() => setEditOpen(true)} /> : status === "loading" ? <HeroSkeleton /> : <SignedOutHero />}

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4 fade-up fade-up-1">
        <Stat label="Scores" value={projects.data?.length} failed={Boolean(projects.error)} />
        <Stat label="Programs" value={programs.data?.length} failed={Boolean(programs.error)} />
        <Stat label="Exports" value={exportsTotal} failed={Boolean(projects.error)} />
        <Stat label="Storage" value={usage.data ? formatBytes(usage.data.totalBytes) : undefined} failed={Boolean(usage.error)} />
      </dl>

      <div className="grid gap-8 lg:grid-cols-2 fade-up fade-up-2">
        <section className="card p-5 md:p-6" aria-labelledby="profile-programs">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="profile-programs" className="display text-[1.5rem]">
              Programs
            </h2>
            <Link href="/programs" className="text-[13px] text-ink-3 hover:text-ink">
              All programs
            </Link>
          </div>
          {programs.error && !programs.data ? (
            <LoadError variant="inline" error={programs.error} message={programs.errorText} onRetry={programs.reload} />
          ) : !programs.data ? (
            <ListSkeleton />
          ) : programs.data.length === 0 ? (
            <p className="text-[13px] text-ink-3">No programs yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {programs.data.slice(0, SHOWN_PROGRAMS).map((pr) => {
                const pieces = piecesFor(pr.projectIds, byId);
                const total = pieces.reduce((n, p) => n + p.durationSec, 0);
                return (
                  <li key={pr.id}>
                    <Link href={`/programs/${pr.id}`} className="group flex items-center gap-3 py-3">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SECTION_TOKEN[pr.color] }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-serif text-[1.05rem] text-ink transition-colors group-hover:text-brass-3">{pr.name}</span>
                        <span className="block text-xs text-ink-3 tnum">
                          {formatProgramDate(pr.date)} · {plural(pr.projectIds.length, "piece")}
                          {pieces.length > 0 && ` · ${formatDuration(total)}`}
                        </span>
                      </span>
                      <ChevronRight size={14} className="text-ink-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-5 md:p-6" aria-labelledby="profile-activity">
          <h2 id="profile-activity" className="display mb-4 text-[1.5rem]">
            Recent activity
          </h2>
          {activity.error && !activity.data ? (
            <LoadError variant="inline" error={activity.error} message={activity.errorText} onRetry={activity.reload} />
          ) : !activity.data ? (
            <ListSkeleton />
          ) : activity.data.length === 0 ? (
            <p className="text-[13px] text-ink-3">Nothing yet. Imports, syncs and exports show up here.</p>
          ) : (
            <ActivityList items={activity.data.slice(0, SHOWN_ACTIVITY)} titles={titles} />
          )}
        </section>
      </div>

      {editOpen && user && <EditProfileDialog user={user} onClose={() => setEditOpen(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function HeroFrame({ children }: { children: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-xl)] border border-line bg-paper-2 grain fade-up">
      <Aurora subtle />
      <div className="relative z-10 flex flex-col gap-6 p-6 md:flex-row md:items-end md:justify-between md:p-10">{children}</div>
    </section>
  );
}

function Hero({ user, onEdit }: { user: ProfileDto; onEdit: () => void }) {
  const facts = (
    [
      ["role", user.role],
      ["ensemble", user.ensemble],
      ["location", user.location],
    ] as const
  ).filter(([, v]) => Boolean(v));
  return (
    <HeroFrame>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar initials={user.initials} size="xl" className="shrink-0" />
        <div className="min-w-0">
          <h1 className="display text-[2rem] md:text-[2.4rem]">{user.name}</h1>
          {facts.length > 0 && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">
              {facts.map(([kind, value], i) => (
                <span key={kind} className="inline-flex items-center gap-2.5">
                  {i > 0 && <Dot />}
                  {value}
                </span>
              ))}
            </p>
          )}
          {user.bio && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">{user.bio}</p>}
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-3">
            {user.website && (
              <a href={websiteHref(user.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-brass-3 hover:underline">
                <Globe size={13} aria-hidden />
                {websiteLabel(user.website)}
              </a>
            )}
            <span>@{user.handle}</span>
            <span>Joined {formatDate(user.joinedAt)}</span>
          </p>
        </div>
      </div>
      <div className="shrink-0">
        <Button variant="primary" size="sm" leading={<Pencil size={14} aria-hidden />} onClick={onEdit}>
          Edit profile
        </Button>
      </div>
    </HeroFrame>
  );
}

function HeroSkeleton() {
  return (
    <HeroFrame>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center" aria-busy="true" aria-label="Loading profile">
        <Skeleton className="h-24 w-24 shrink-0 rounded-full" />
        <div className="space-y-2.5">
          <Skeleton className="h-10 w-64 max-w-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
    </HeroFrame>
  );
}

function SignedOutHero() {
  return (
    <HeroFrame>
      <div>
        <h1 className="display text-[2rem] md:text-[2.4rem]">Profile</h1>
        <p className="mt-2 text-sm text-ink-3">Sign in to see your profile.</p>
      </div>
      <Button href="/sign-in?next=%2Fprofile" variant="primary" size="sm">
        Sign in
      </Button>
    </HeroFrame>
  );
}

function Stat({ label, value, failed }: { label: string; value: number | string | undefined; failed: boolean }) {
  return (
    <div className="card flex flex-col-reverse px-5 py-4">
      <dt className="mt-1 text-[13px] text-ink-3">{label}</dt>
      <dd className="display text-[2.2rem] tnum">
        {value !== undefined ? (
          value
        ) : failed ? (
          <span className="text-ink-4" title="Could not load">
            –
          </span>
        ) : (
          <Skeleton className="my-1.5 h-8 w-16" />
        )}
      </dd>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3.5" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Edit                                                                */
/* ------------------------------------------------------------------ */

function EditProfileDialog({ user, onClose }: { user: ProfileDto; onClose: () => void }) {
  const updateProfile = useSession((s) => s.updateProfile);
  const [form, setForm] = useState({
    name: user.name,
    role: user.role,
    ensemble: user.ensemble,
    location: user.location,
    website: user.website ?? "",
    bio: user.bio,
  });
  const [errors, setErrors] = useState<{ name?: string; website?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const name = form.name.trim();
    const website = normalizeWebsite(form.website);
    const found: typeof errors = {};
    if (!name) found.name = "Enter your name.";
    if (website === false) found.website = "Enter a web address, like https://yourensemble.org.";
    setErrors(found);
    if (found.name || found.website) return;

    const patch: ProfileUpdate = {
      name,
      role: form.role,
      ensemble: form.ensemble.trim(),
      location: form.location.trim(),
      bio: form.bio.trim(),
      website: website || null,
    };
    setBusy(true);
    setError(null);
    try {
      await updateProfile(patch);
      toast.success("Profile updated");
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not save the profile."));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Edit profile"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" form="edit-profile-form" loading={busy}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-profile-form" onSubmit={submit} className="space-y-4" noValidate>
        <FormField label="Name" error={errors.name}>
          {(p) => <Input {...p} value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={100} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Role">
            {(p) => (
              <Select {...p} value={form.role} onChange={(e) => set("role", e.target.value as Director["role"])}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Ensemble">
            {(p) => <Input {...p} value={form.ensemble} onChange={(e) => set("ensemble", e.target.value)} autoComplete="organization" maxLength={120} />}
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Location">
            {(p) => <Input {...p} value={form.location} onChange={(e) => set("location", e.target.value)} maxLength={120} />}
          </FormField>
          <FormField label="Website" error={errors.website}>
            {(p) => <Input {...p} type="url" inputMode="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://yourensemble.org" maxLength={200} />}
          </FormField>
        </div>
        <FormField label="Bio">
          {(p) => <Textarea {...p} value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={3} maxLength={1000} />}
        </FormField>
        <FormError>{error}</FormError>
      </form>
    </Dialog>
  );
}
