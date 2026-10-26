"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Check, Save } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { toast } from "@/components/ui/toast";
import { useProject } from "@/lib/store/project";
import { cx } from "@/lib/utils/format";
import { UserMenu } from "./UserMenu";
import type { ProjectStage } from "@/shared/domain";

const STEPS: Array<{ id: ProjectStage; label: string }> = [
  { id: "import", label: "Import" },
  { id: "sync", label: "Sync" },
  { id: "customize", label: "Customize" },
  { id: "preview", label: "Preview" },
  { id: "export", label: "Export" },
];

const ORDER: ProjectStage[] = STEPS.map((s) => s.id);

interface StepState {
  id: ProjectStage;
  label: string;
  active: boolean;
  done: boolean;
  enabled: boolean;
  skipped: boolean;
}

export function WorkflowNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const summary = useProject((s) => s.summary);
  const loadedId = useProject((s) => s.projectId);
  const dirty = useProject((s) => s.dirty);
  const savedAt = useProject((s) => s.savedAt);
  const saveError = useProject((s) => s.saveError);
  // `markSaved` is the fire-and-forget form of `saveNow`; awaiting it drives "Saving…"
  const saveNow = useProject((s) => s.saveNow);
  const [saving, setSaving] = useState(false);

  // the store may still hold the previous project while this one loads
  const project = loadedId === projectId ? summary : null;
  const current = ORDER.find((st) => pathname.endsWith("/" + st)) ?? "import";
  const reached = ORDER.indexOf(project?.stage ?? "import");
  const noRecording = project ? !project.hasRecording : false;

  const steps: StepState[] = STEPS.map((s) => {
    const idx = ORDER.indexOf(s.id);
    const active = s.id === current;
    const skipped = s.id === "sync" && noRecording;
    return {
      ...s,
      active,
      skipped,
      done: idx < reached && !skipped && !active,
      enabled: active || (idx <= reached && !skipped && project !== null),
    };
  });

  useEffect(() => {
    if (saveError) toast.error("Could not save the project", { id: "project-save-error", description: saveError });
  }, [saveError]);

  const save = async () => {
    setSaving(true);
    try {
      await saveNow();
    } finally {
      setSaving(false);
    }
  };

  const saveLabel = saving ? "Saving…" : dirty ? "Unsaved changes" : savedAt ? "Saved" : "";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-5 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Tooltip label="Back to library" side="bottom">
            <Link href="/library" className="focus-round grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-paper-3 hover:text-ink" aria-label="Back to library">
              <ArrowLeft size={16} aria-hidden />
            </Link>
          </Tooltip>
          <Logo compact />
        </div>
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex" aria-label="Project steps">
          <ol className="flex items-center gap-0.5">
            {steps.map((s) => (
              <li key={s.id}>
                <Step step={s} projectId={projectId} />
              </li>
            ))}
          </ol>
        </nav>
        <div className="flex-1 md:hidden" />
        <span className="hidden text-[12px] text-ink-3 sm:inline" aria-live="polite">
          {saveLabel}
        </span>
        <Button variant={dirty ? "primary" : "outline"} size="sm" leading={<Save size={14} aria-hidden />} onClick={save} loading={saving} disabled={!project}>
          Save
        </Button>
        <UserMenu />
      </div>
      {/* mobile stepper */}
      <nav className="overflow-x-auto px-5 pb-2 md:hidden" aria-label="Project steps">
        <ol className="flex gap-4">
          {steps.map((s) => (
            <li key={s.id} className="shrink-0">
              {s.enabled ? (
                <Link
                  href={`/projects/${projectId}/${s.id}`}
                  aria-current={s.active ? "step" : undefined}
                  className={cx("text-[13px] whitespace-nowrap", s.active ? "font-medium text-ink" : "text-ink-3", s.skipped && "line-through")}
                >
                  {s.label}
                </Link>
              ) : (
                <span aria-disabled className={cx("text-[13px] whitespace-nowrap text-ink-4", s.skipped && "line-through")}>
                  {s.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </header>
  );
}

function Step({ step: s, projectId }: { step: StepState; projectId: string }) {
  const cls = cx(
    "relative flex items-center gap-1.5 px-2.5 py-2 text-[13.5px] transition-colors lg:px-3",
    s.active ? "font-medium text-ink" : s.enabled ? "text-ink-2 hover:text-ink" : "text-ink-4",
    s.skipped && "line-through decoration-ink-4",
  );
  const inner = (
    <>
      {s.done && <Check size={12} className="text-brass" aria-hidden />}
      {s.label}
      {s.done && <span className="sr-only"> (done)</span>}
      {s.active && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-brass" aria-hidden />}
    </>
  );
  if (!s.enabled) {
    return (
      <Tooltip label={s.skipped ? "No recording: playback is generated from the score" : "Finish the previous step first"} side="bottom">
        <span className={cls} aria-disabled tabIndex={0}>
          {inner}
        </span>
      </Tooltip>
    );
  }
  return (
    <Link href={`/projects/${projectId}/${s.id}`} className={cls} aria-current={s.active ? "step" : undefined}>
      {inner}
    </Link>
  );
}
