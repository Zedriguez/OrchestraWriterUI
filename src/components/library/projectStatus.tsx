import type { ProjectSummary } from "@/shared/domain";
import { Chip } from "@/components/ui/Chip";

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

export function projectMeta(project: ProjectSummary): string {
  const m = Math.floor(project.durationSec / 60);
  const s = String(project.durationSec % 60).padStart(2, "0");
  return `${project.parts} parts · ${project.measures} bars · ${m}:${s}`;
}
