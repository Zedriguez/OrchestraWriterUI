import type { ProjectSummary } from "@/shared/domain";

/** "1 score", "3 scores" */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Program dates are calendar days (`YYYY-MM-DD`, or "" when unset). Parse
 * them as local dates: `new Date("2026-11-14")` is UTC midnight and shows the
 * previous day west of Greenwich.
 */
export function formatProgramDate(date: string, fallback = "No date"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return fallback;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/** Projects that can be watched: parsed, and synced when they have a recording. */
export function isPresentable(project: ProjectSummary): boolean {
  return project.status === "ready" || project.status === "exported";
}

/** Look up summaries for a program's running order, skipping ids that are gone. */
export function piecesFor(projectIds: string[], byId: Map<string, ProjectSummary>): ProjectSummary[] {
  return projectIds.flatMap((id) => {
    const p = byId.get(id);
    return p ? [p] : [];
  });
}
