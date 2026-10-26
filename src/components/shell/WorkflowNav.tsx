"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Save, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { useProject } from "@/lib/store/project";
import { cx, relativeTime } from "@/lib/utils/format";
import { UserMenu } from "./UserMenu";
import type { ProjectStage } from "@/shared/domain";

const STEPS: Array<{ id: ProjectStage; label: string }> = [
  { id: "import", label: "Import" },
  { id: "sync", label: "Sync" },
  { id: "customize", label: "Customize" },
  { id: "preview", label: "Preview" },
  { id: "export", label: "Export" },
];

const ORDER: ProjectStage[] = ["import", "sync", "customize", "preview", "export"];

export function WorkflowNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const summary = useProject((s) => s.summary);
  const dirty = useProject((s) => s.dirty);
  const savedAt = useProject((s) => s.savedAt);
  const markSaved = useProject((s) => s.markSaved);
  const current = (ORDER.find((st) => pathname.endsWith("/" + st)) ?? "import") as ProjectStage;
  const reached = ORDER.indexOf(summary?.stage ?? "import");
  const hasRecording = summary?.hasRecording ?? true;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-5 md:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <Tooltip label="Back to library" side="bottom">
            <Link href="/library" className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-paper-3 hover:text-ink" aria-label="Back to library">
              <ArrowLeft size={16} />
            </Link>
          </Tooltip>
          <Logo />
        </div>
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex" aria-label="Project steps">
          {STEPS.map((s) => {
            const idx = ORDER.indexOf(s.id);
            const skipped = s.id === "sync" && !hasRecording;
            const active = s.id === current;
            const done = idx < reached && !skipped;
            const enabled = idx <= reached && !skipped;
            const cls = cx(
              "relative flex items-center gap-1.5 px-2.5 lg:px-3 py-2 text-[13.5px] transition-colors",
              active ? "text-ink font-medium" : enabled ? "text-ink-2 hover:text-ink" : "text-ink-4",
              skipped && "line-through decoration-ink-4",
            );
            const inner = (
              <>
                {done && !active && <Check size={12} className="text-brass" />}
                {s.label}
                {active && <span className="absolute left-3 right-3 -bottom-[13px] h-[2px] rounded-full bg-brass" />}
              </>
            );
            if (!enabled) {
              return (
                <Tooltip key={s.id} label={skipped ? "No recording · playback is generated from the score" : "Finish the previous step first"} side="bottom">
                  <span className={cls} aria-disabled>
                    {inner}
                  </span>
                </Tooltip>
              );
            }
            return (
              <Link key={s.id} href={`/projects/${projectId}/${s.id}`} className={cls} aria-current={active ? "step" : undefined}>
                {inner}
              </Link>
            );
          })}
        </nav>
        <span className="hidden text-[12px] text-ink-3 xl:inline">
          {dirty ? "Unsaved changes" : savedAt ? `Saved ${relativeTime(savedAt)}` : "Saved"}
        </span>
        <Button variant={dirty ? "primary" : "outline"} size="sm" leading={<Save size={14} />} onClick={markSaved}>
          Save project
        </Button>
        <UserMenu />
      </div>
      {/* mobile stepper */}
      <div className="flex gap-4 overflow-x-auto px-5 pb-2 md:hidden">
        {STEPS.map((s) => (
          <Link key={s.id} href={`/projects/${projectId}/${s.id}`} className={cx("text-[13px] whitespace-nowrap", s.id === current ? "text-ink font-medium" : "text-ink-3")}>
            {s.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
