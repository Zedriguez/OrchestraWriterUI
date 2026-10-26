"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut, Trash2 } from "lucide-react";
import type { Director } from "@/shared/domain";
import type { ProfileDto, UsageDto } from "@/shared/api";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session";
import { usePreferences, type ThemeId } from "@/lib/store/preferences";
import { cx, formatBytes } from "@/lib/utils/format";
import { PageHeader } from "@/components/shell/PageHeader";
import { FormError, FormField } from "@/components/shell/FormField";
import { ROLES } from "@/components/auth/AuthForm";
import { plural } from "@/components/library/format";
import { LoadError, Skeleton } from "@/components/library/states";
import { useResource } from "@/components/library/useResource";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { TabPanel, Tabs, type TabItem } from "@/components/ui/Tabs";
import { Toggle } from "@/components/ui/Toggle";
import { toast } from "@/components/ui/toast";
import { normalizeWebsite } from "./website";

type Tab = "account" | "appearance" | "export";

const TABS: TabItem<Tab>[] = [
  { value: "account", label: "Account", hint: "Profile, storage, sign out" },
  { value: "appearance", label: "Appearance", hint: "Theme, motion, labels" },
  { value: "export", label: "Export defaults", shortLabel: "Export", hint: "Resolution, frame rate" },
];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("account");
  return (
    <div className="space-y-8">
      <PageHeader className="fade-up" title="Settings" />
      <Tabs value={tab} onValueChange={setTab} items={TABS} orientation="responsive" ariaLabel="Settings sections" className="fade-up fade-up-1">
        <TabPanel value="account">
          <AccountTab />
        </TabPanel>
        <TabPanel value="appearance">
          <AppearanceTab />
        </TabPanel>
        <TabPanel value="export">
          <ExportTab />
        </TabPanel>
      </Tabs>
    </div>
  );
}

/** A settings card: one heading, an optional line under it, the controls, an optional footer. */
function Section({ title, body, children, footer, id }: { title: string; body?: string; children: ReactNode; footer?: ReactNode; id: string }) {
  return (
    <section className="card" aria-labelledby={id}>
      <div className="border-b border-line px-5 py-4 md:px-7">
        <h2 id={id} className="display text-[1.4rem]">
          {title}
        </h2>
        {body && <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-3">{body}</p>}
      </div>
      <div className="px-5 py-5 md:px-7">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 md:px-7">{footer}</div>}
    </section>
  );
}

/* ---------------- Account ---------------- */

function AccountTab() {
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  return (
    <div className="space-y-6">
      {user ? (
        <ProfileForm key={user.id} user={user} />
      ) : status === "loading" ? (
        <Section id="settings-profile" title="Profile">
          <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading profile">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-11 w-full rounded-[var(--radius)]" />
              </div>
            ))}
          </div>
        </Section>
      ) : null}
      <StorageSection />
      <SessionSection />
      <DeleteAccountSection />
    </div>
  );
}

const HANDLE_RE = /^[a-z0-9][a-z0-9-]{2,29}$/;

function ProfileForm({ user }: { user: ProfileDto }) {
  const updateProfile = useSession((s) => s.updateProfile);
  const [form, setForm] = useState({
    name: user.name,
    ensemble: user.ensemble,
    role: user.role,
    handle: user.handle,
    website: user.website ?? "",
  });
  const [errors, setErrors] = useState<{ name?: string; handle?: string; website?: string }>({});
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
    const handle = form.handle.trim().toLowerCase();
    const website = normalizeWebsite(form.website);
    const found: typeof errors = {};
    if (!name) found.name = "Enter your name.";
    if (!HANDLE_RE.test(handle)) found.handle = "3–30 lowercase letters, numbers or dashes, starting with a letter or number.";
    if (website === false) found.website = "Enter a web address, like https://yourensemble.org.";
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setBusy(true);
    setError(null);
    try {
      await updateProfile({ name, ensemble: form.ensemble.trim(), role: form.role, handle, website: website || null });
      if (website !== false) setForm((f) => ({ ...f, name, handle, website }));
      toast.success("Account saved");
    } catch (err) {
      setError(errorMessage(err, "Could not save your account."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Section
        id="settings-profile"
        title="Profile"
        footer={
          <>
            <FormError className="flex-1">{error}</FormError>
            <Button type="submit" variant="primary" size="sm" loading={busy} className="ml-auto">
              Save changes
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" error={errors.name}>
            {(p) => <Input {...p} value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={100} />}
          </FormField>
          <FormField label="Email" hint="Used to sign in. It can't be changed here.">
            {(p) => <Input {...p} type="email" value={user.email} readOnly className="bg-paper-3 text-ink-2" />}
          </FormField>
          <FormField label="Ensemble">
            {(p) => <Input {...p} value={form.ensemble} onChange={(e) => set("ensemble", e.target.value)} autoComplete="organization" maxLength={120} />}
          </FormField>
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
          <FormField label="Handle" hint="Letters, numbers and dashes." error={errors.handle}>
            {(p) => (
              <Input
                {...p}
                value={form.handle}
                onChange={(e) => set("handle", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                leading={<span className="text-sm">@</span>}
                autoCapitalize="none"
                spellCheck={false}
                maxLength={30}
              />
            )}
          </FormField>
          <FormField label="Website" error={errors.website}>
            {(p) => <Input {...p} type="url" inputMode="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://yourensemble.org" maxLength={200} />}
          </FormField>
        </div>
      </Section>
    </form>
  );
}

const BUCKETS: Array<{ key: "scores" | "recordings" | "exports"; label: string; unit: string }> = [
  { key: "scores", label: "Scores", unit: "score" },
  { key: "recordings", label: "Recordings", unit: "recording" },
  { key: "exports", label: "Exports", unit: "file" },
];

function StorageSection() {
  const usage = useResource(() => api.getUsage());
  return (
    <Section id="settings-storage" title="Storage" body="Files kept with your projects. Deleting a project removes its files.">
      {usage.error && !usage.data ? (
        <LoadError variant="inline" error={usage.error} message={usage.errorText} onRetry={usage.reload} />
      ) : !usage.data ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading storage">
          <Skeleton className="h-5 w-32" />
          {BUCKETS.map((b) => (
            <div key={b.key} className="flex items-center gap-4">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <UsageTable usage={usage.data} />
      )}
    </Section>
  );
}

function UsageTable({ usage }: { usage: UsageDto }) {
  return (
    <div>
      <p className="text-sm text-ink">
        <span className="tnum">{formatBytes(usage.totalBytes)}</span> <span className="text-ink-3">in use</span>
      </p>
      <ul className="mt-3 divide-y divide-line">
        {BUCKETS.map((b) => {
          const bucket = usage[b.key];
          const share = usage.totalBytes > 0 ? bucket.bytes / usage.totalBytes : 0;
          return (
            <li key={b.key} className="flex items-center gap-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">{b.label}</span>
                <span className="block text-xs text-ink-3 tnum">{plural(bucket.count, b.unit)}</span>
              </span>
              <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-paper-4 sm:block" aria-hidden>
                <span className="block h-full rounded-full bg-brass" style={{ width: `${Math.round(share * 100)}%` }} />
              </span>
              <span className="w-20 text-right text-sm text-ink-2 tnum">{formatBytes(bucket.bytes)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SessionSection() {
  const signOut = useSession((s) => s.signOut);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Section id="settings-session" title="Session">
      <Button
        variant="outline"
        size="sm"
        leading={<LogOut size={14} aria-hidden />}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          // the cookie must be gone before /sign-in, or the proxy bounces back to /library
          await signOut();
          router.push("/sign-in");
        }}
      >
        Sign out
      </Button>
    </Section>
  );
}

function DeleteAccountSection() {
  const signOut = useSession((s) => s.signOut);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.deleteAccount();
    } catch (err) {
      toast.error("Could not delete your account", { description: errorMessage(err) });
      setBusy(false);
      return;
    }
    // the server already ended the session; clear the local copy before leaving
    await signOut().catch(() => {});
    toast.success("Your account was deleted");
    router.push("/sign-up");
  };

  return (
    <Section id="settings-delete" title="Delete account" body="Removes your profile, every project with its score, recording, sync and exports, and your programs.">
      <Button variant="danger" size="sm" leading={<Trash2 size={14} aria-hidden />} onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        width="sm"
        title="Delete your account?"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Keep my account
            </Button>
            <Button variant="danger" size="sm" onClick={confirm} loading={busy}>
              Delete everything
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-2">
          Every project, recording, export and program is deleted with it. Files you already downloaded are not affected. This cannot be undone.
        </p>
      </Dialog>
    </Section>
  );
}

/* ---------------- Appearance ---------------- */

function AppearanceTab() {
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const reducedMotion = usePreferences((s) => s.reducedMotion);
  const setReducedMotion = usePreferences((s) => s.setReducedMotion);
  const showLabels = usePreferences((s) => s.showLabelsDefault);
  const setShowLabels = usePreferences((s) => s.setShowLabelsDefault);

  return (
    <div className="space-y-6">
      <Section id="settings-theme" title="Theme">
        <fieldset>
          <legend className="sr-only">Theme</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <ThemeCard id="program" current={theme} onSelect={setTheme} name="Concert program" blurb="Paper, ink and brass around a framed dark stage. Easiest to read.">
              <div className="h-full w-full rounded-[10px] bg-stage-text p-3">
                <div className="mb-2 h-1.5 w-10 rounded-full bg-brass" />
                <div className="mb-2 h-2 w-20 rounded-full bg-stage/80" />
                <div className="relative h-[46%] w-full overflow-hidden rounded-[7px] bg-stage">
                  <span className="absolute left-[30%] top-[70%] h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sec-strings opacity-70 blur-[6px]" />
                  <span className="absolute left-[55%] top-[40%] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sec-brass opacity-80 blur-[5px]" />
                </div>
                <div className="mt-2 flex gap-1.5">
                  <div className="h-1.5 w-12 rounded-full bg-stage/25" />
                  <div className="h-1.5 w-8 rounded-full bg-stage/25" />
                </div>
              </div>
            </ThemeCard>
            <ThemeCard id="stage" current={theme} onSelect={setTheme} name="One material" blurb="Everything dark with an amber accent. The most cinematic.">
              <div className="relative h-full w-full overflow-hidden rounded-[10px] bg-stage p-3">
                <span className="absolute left-[35%] top-[65%] h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sec-strings opacity-60 blur-[10px]" />
                <span className="absolute left-[62%] top-[38%] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sec-brass opacity-70 blur-[8px]" />
                <span className="absolute left-[50%] top-[25%] h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sec-woodwinds opacity-50 blur-[7px]" />
                <div className="relative mb-2 h-1.5 w-10 rounded-full brass-gradient" />
                <div className="relative h-2 w-20 rounded-full bg-stage-text/70" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-full stage-glass px-2 py-1.5">
                  <span className="h-2 w-2 rounded-full brass-gradient" />
                  <span className="h-1 flex-1 rounded-full bg-stage-text/25" />
                </div>
              </div>
            </ThemeCard>
          </div>
        </fieldset>
      </Section>

      <Section id="settings-motion" title="Motion and labels">
        <div className="divide-y divide-line">
          <Toggle className="py-3.5" label="Reduced motion" description="Fades become instant switches. Also follows your system setting." checked={reducedMotion} onChange={setReducedMotion} />
          <Toggle className="py-3.5" label="Show part labels by default" description="New projects open with the part name and dynamic beside each glow." checked={showLabels} onChange={setShowLabels} />
        </div>
      </Section>
    </div>
  );
}

function ThemeCard({
  id,
  current,
  onSelect,
  name,
  blurb,
  children,
}: {
  id: ThemeId;
  current: ThemeId;
  onSelect: (t: ThemeId) => void;
  name: string;
  blurb: string;
  children: ReactNode;
}) {
  const active = id === current;
  return (
    <label
      className={cx(
        "flex cursor-pointer flex-col rounded-[var(--radius-lg)] border p-3 transition-[border-color,box-shadow] has-focus-visible:shadow-[var(--focus)]",
        active ? "border-brass" : "border-line hover:border-line-strong",
      )}
    >
      <input type="radio" name="theme" value={id} checked={active} onChange={() => onSelect(id)} className="sr-only" />
      <span className="aspect-[16/10] w-full overflow-hidden rounded-[12px] border border-line bg-paper-3 p-1.5" aria-hidden>
        {children}
      </span>
      <span className="flex items-start justify-between gap-3 px-1 pt-3 pb-1">
        <span>
          <span className="block text-sm font-medium text-ink">{name}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">{blurb}</span>
        </span>
        <span
          className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors", active ? "border-brass bg-brass text-paper" : "border-line-strong")}
          aria-hidden
        >
          {active && <Check size={12} />}
        </span>
      </span>
    </label>
  );
}

/* ---------------- Export defaults ---------------- */

function ExportTab() {
  const resolution = usePreferences((s) => s.exportResolution);
  const setResolution = usePreferences((s) => s.setExportResolution);
  const frameRate = usePreferences((s) => s.exportFrameRate);
  const setFrameRate = usePreferences((s) => s.setExportFrameRate);

  return (
    <Section id="settings-export" title="Export defaults" body="Every video export starts from these. You can still change them on the Export step.">
      <div className="divide-y divide-line">
        <Row label="Resolution" description="4K for LED walls; 1080p is fine for lobby screens and sharing.">
          <Segmented
            value={resolution}
            onChange={setResolution}
            ariaLabel="Resolution"
            options={[
              { value: "720p", label: "720p" },
              { value: "1080p", label: "1080p" },
              { value: "4k", label: "4K" },
            ]}
          />
        </Row>
        <Row label="Frame rate" description="60 fps keeps fast fades smooth.">
          <Segmented
            value={String(frameRate) as "30" | "60"}
            onChange={(v) => setFrameRate(Number(v) as 30 | 60)}
            ariaLabel="Frame rate"
            options={[
              { value: "30", label: "30 fps" },
              { value: "60", label: "60 fps" },
            ]}
          />
        </Row>
      </div>
    </Section>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
