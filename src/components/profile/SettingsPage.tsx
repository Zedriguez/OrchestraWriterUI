"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Download, HardDrive, LogOut, Trash2 } from "lucide-react";
import type { Director } from "@/shared/domain";
import { DEMO_DIRECTOR } from "@/lib/mock/library";
import { useSession } from "@/lib/auth/session";
import { usePreferences, type ThemeId } from "@/lib/store/preferences";
import { cx } from "@/lib/utils/format";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Toggle } from "@/components/ui/Toggle";
import { Progress } from "@/components/ui/Progress";

type Tab = "account" | "appearance" | "export" | "storage";

const TABS: Array<{ value: Tab; label: string; short: string; hint: string }> = [
  { value: "account", label: "Account", short: "Account", hint: "Name, email, ensemble" },
  { value: "appearance", label: "Appearance & playback", short: "Appearance", hint: "Theme, motion, labels" },
  { value: "export", label: "Export defaults", short: "Export", hint: "Resolution, frame rate" },
  { value: "storage", label: "Storage & data", short: "Storage", hint: "Files, downloads, account" },
];

const ROLES: Director["role"][] = ["Music director", "Conductor", "Educator", "Student", "Listener"];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("account");

  return (
    <div className="space-y-8">
      <PageHeader
        className="fade-up"
        eyebrow="Settings"
        title={
          <>
            Account & <em>preferences</em>
          </>
        }
        meta={<span>Changes apply immediately. Nothing here leaves your browser in this build.</span>}
      />

      {/* mobile tabs */}
      <div className="lg:hidden overflow-x-auto scroll-thin fade-up fade-up-1">
        <Segmented value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t.value, label: t.short }))} ariaLabel="Settings section" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] fade-up fade-up-1">
        {/* desktop tab list */}
        <nav className="hidden lg:block lg:sticky lg:top-24 lg:self-start" aria-label="Settings sections">
          <ul className="space-y-1">
            {TABS.map((t) => {
              const active = t.value === tab;
              return (
                <li key={t.value}>
                  <button
                    type="button"
                    onClick={() => setTab(t.value)}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex w-full flex-col items-start rounded-[var(--radius)] px-3.5 py-2.5 text-left transition-colors",
                      active ? "bg-paper-2 shadow-sm border border-line" : "border border-transparent hover:bg-paper-3/60",
                    )}
                  >
                    <span className={cx("text-sm", active ? "text-ink font-medium" : "text-ink-2")}>{t.label}</span>
                    <span className="text-xs text-ink-3">{t.hint}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {tab === "account" && <AccountTab />}
          {tab === "appearance" && <AppearanceTab />}
          {tab === "export" && <ExportTab />}
          {tab === "storage" && <StorageTab />}
        </div>
      </div>
    </div>
  );
}

function Section({ eyebrow, title, body, children, footer }: { eyebrow: string; title: ReactNode; body?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="card">
      <div className="border-b border-line px-5 py-5 md:px-7">
        <p className="eyebrow mb-1">{eyebrow}</p>
        <h2 className="display text-[1.7rem]">{title}</h2>
        {body && <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-3">{body}</p>}
      </div>
      <div className="px-5 py-5 md:px-7">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 md:px-7">{footer}</div>}
    </section>
  );
}

/* ---------------- Account ---------------- */

function AccountTab() {
  const sessionUser = useSession((s) => s.user);
  const user = sessionUser ?? DEMO_DIRECTOR;
  const updateProfile = useSession((s) => s.updateProfile);
  const signOut = useSession((s) => s.signOut);
  const [form, setForm] = useState({ name: user.name, email: user.email, ensemble: user.ensemble, role: user.role, handle: user.handle });
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    updateProfile(form);
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit}>
        <Section
          eyebrow="Account"
          title={
            <>
              Who is <em>conducting</em>
            </>
          }
          body="This is how you appear on shared program pages and in exports."
          footer={
            <>
              <span className="text-xs text-ink-3">Signed in as {user.email}</span>
              <Button type="submit" variant="primary" size="sm" leading={saved ? <Check size={14} /> : undefined}>
                {saved ? "Saved" : "Save changes"}
              </Button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </Field>
            <Field label="Ensemble">
              <Input value={form.ensemble} onChange={(e) => set("ensemble", e.target.value)} />
            </Field>
            <Field label="Role">
              <Select value={form.role} onChange={(e) => set("role", e.target.value as Director["role"])}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Handle" hint="Used in your public page address." className="sm:col-span-2">
              <Input value={form.handle} onChange={(e) => set("handle", e.target.value.replace(/\s+/g, "."))} leading={<span className="text-sm">@</span>} />
            </Field>
          </div>
        </Section>
      </form>

      <Section
        eyebrow="Danger zone"
        title={
          <>
            Sessions
          </>
        }
        body="Signing out everywhere ends this session too. Your project files stay on your computer."
      >
        <Button variant="outline" size="sm" leading={<LogOut size={14} />} onClick={signOut}>
          Sign out of all devices
        </Button>
      </Section>
    </div>
  );
}

/* ---------------- Appearance & playback ---------------- */

function AppearanceTab() {
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const reducedMotion = usePreferences((s) => s.reducedMotion);
  const setReducedMotion = usePreferences((s) => s.setReducedMotion);
  const showLabels = usePreferences((s) => s.showLabelsDefault);
  const setShowLabels = usePreferences((s) => s.setShowLabelsDefault);

  return (
    <div className="space-y-6">
      <Section
        eyebrow="Theme"
        title={
          <>
            Two <em>directions</em>
          </>
        }
        body="Concert program keeps the dark stage inside a frame on warm paper. One material makes the whole app the stage."
      >
        <div role="radiogroup" aria-label="Theme" className="grid gap-4 sm:grid-cols-2">
          <ThemeCard id="program" current={theme} onSelect={setTheme} name="Concert program" blurb="Paper, ink, brass. Dense settings stay readable on light surfaces.">
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
          <ThemeCard id="stage" current={theme} onSelect={setTheme} name="One material" blurb="Everything dark with an amber accent. The most cinematic; best for video.">
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
      </Section>

      <Section
        eyebrow="Playback"
        title={
          <>
            Motion & <em>labels</em>
          </>
        }
      >
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
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(id)}
      className={cx(
        "group flex flex-col rounded-[var(--radius-lg)] border p-3 text-left transition-[border-color,box-shadow]",
        active ? "border-brass shadow-[var(--focus)]" : "border-line hover:border-line-strong",
      )}
    >
      <div className="aspect-[16/10] w-full overflow-hidden rounded-[12px] border border-line bg-paper-3 p-1.5">{children}</div>
      <div className="flex items-start justify-between gap-3 px-1 pt-3 pb-1">
        <div>
          <p className="text-sm font-medium text-ink">{name}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{blurb}</p>
        </div>
        <span
          className={cx(
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
            active ? "border-brass bg-brass text-paper" : "border-line-strong",
          )}
          aria-hidden
        >
          {active && <Check size={12} />}
        </span>
      </div>
    </button>
  );
}

/* ---------------- Export defaults ---------------- */

function ExportTab() {
  const resolution = usePreferences((s) => s.exportResolution);
  const setResolution = usePreferences((s) => s.setExportResolution);
  const frameRate = usePreferences((s) => s.exportFrameRate);
  const setFrameRate = usePreferences((s) => s.setExportFrameRate);
  const emailOnExport = usePreferences((s) => s.emailOnExport);
  const setEmailOnExport = usePreferences((s) => s.setEmailOnExport);

  return (
    <Section
      eyebrow="Export defaults"
      title={
        <>
          Starting <em>values</em>
        </>
      }
      body="Every export starts from these. You can still change them per project on the Export step."
    >
      <div className="divide-y divide-line">
        <Row label="Resolution" description="4K is for LED walls; 1080p is fine for lobby screens and sharing.">
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
        <Row label="Frame rate" description="60 fps keeps fast crescendos smooth.">
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
        <Toggle className="py-4" label="Email me when an export finishes" description="Long pieces can take a few minutes to render." checked={emailOnExport} onChange={setEmailOnExport} />
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

/* ---------------- Storage & data ---------------- */

const STORED = [
  { label: "Scores", detail: "9 MusicXML files", size: "48 MB", share: 0.02 },
  { label: "Recordings", detail: "6 MP3 files", size: "612 MB", share: 0.25 },
  { label: "Exports", detail: "11 MP4 renders", size: "1.7 GB", share: 0.73 },
];

function StorageTab() {
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="space-y-6">
      <Section
        eyebrow="Storage"
        title={
          <>
            What is <em>kept</em>
          </>
        }
        footer={
          <>
            <p className="max-w-lg text-xs leading-relaxed text-ink-3">
              The MVP keeps projects as manual <span className="tnum">.ovproj</span> files you save and reopen yourself. There is no automatic restore
              yet; download your files before clearing a browser.
            </p>
            <Button variant="outline" size="sm" leading={<Download size={14} />}>
              Download all project files
            </Button>
          </>
        }
      >
        <div className="mb-2 flex items-baseline justify-between">
          <p className="flex items-center gap-2 text-sm text-ink">
            <HardDrive size={14} className="text-ink-3" />
            <span className="tnum">2.4 GB of 10 GB</span>
          </p>
          <span className="text-xs text-ink-3 tnum">24% used</span>
        </div>
        <Progress value={0.24} />
        <ul className="mt-5 divide-y divide-line">
          {STORED.map((s) => (
            <li key={s.label} className="flex items-center gap-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">{s.label}</span>
                <span className="block text-xs text-ink-3">{s.detail}</span>
              </span>
              <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-paper-4 sm:block" aria-hidden>
                <span className="block h-full rounded-full bg-brass" style={{ width: `${Math.round(s.share * 100)}%` }} />
              </span>
              <span className="w-16 text-right text-sm text-ink-2 tnum">{s.size}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        eyebrow="Danger zone"
        title={
          <>
            Delete <em>account</em>
          </>
        }
        body="Removes your profile, programs and share links. Project files you downloaded stay on your computer."
      >
        <Button variant="danger" size="sm" leading={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
          Delete account
        </Button>
      </Section>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        eyebrow="Delete account"
        title={
          <>
            This cannot be <em>undone</em>
          </>
        }
        width="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
              Keep my account
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirm(false)}>
              Delete everything
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-2">
          Your 9 scores, 3 programs and every share link will stop working. Exports already downloaded are not affected.
        </p>
      </Dialog>
    </div>
  );
}
