import type { ProjectSummary } from "@/shared/domain";
import { Chip } from "@/components/ui/Chip";
import { formatTime } from "@/lib/utils/format";

/** Where a card should take the director: broken/unfinished imports go back to Import. */
export function projectHref(project: ProjectSummary): string {
  if (project.status === "importing" || project.status === "failed") return `/projects/${project.id}/import`;
  return `/projects/${project.id}/${project.stage}`;
}

export function StatusChip({ project, className }: { project: ProjectSummary; className?: string }) {
  switch (project.status) {
    case "ready":
      return (
        <Chip tone="ok" className={className}>
          Ready
        </Chip>
      );
    case "needs-sync":
      return (
        <Chip tone="warn" className={className}>
          Needs sync
        </Chip>
      );
    case "importing":
      return (
        <Chip tone="info" className={className}>
          Importing
        </Chip>
      );
    case "exported":
      return (
        <Chip tone="brass" className={className}>
          Exported
        </Chip>
      );
    case "failed":
      return (
        <Chip tone="danger" className={className}>
          Failed
        </Chip>
      );
  }
}

/** Status detail is only worth reading when something needs attention or is in flight. */
export function statusDetailFor(project: ProjectSummary): string | undefined {
  if (project.status === "needs-sync" || project.status === "importing" || project.status === "failed") return project.statusDetail;
  return undefined;
}

/** "14 parts · 56 bars · 2:05"; empty until the score has been read. Durations are fractional seconds. */
export function projectMeta(project: ProjectSummary): string {
  if (project.parts === 0 && project.measures === 0) return "";
  const parts = `${project.parts} ${project.parts === 1 ? "part" : "parts"}`;
  const bars = `${project.measures} ${project.measures === 1 ? "bar" : "bars"}`;
  return `${parts} · ${bars} · ${formatTime(project.durationSec)}`;
}
