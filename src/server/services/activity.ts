// The recent-activity feed: one line per import, sync save, display edit, export.
import type { ActivityDto } from "@/shared/api";
import { query } from "../db/client";
import type { ActivityRow } from "../types/db";

export type ActivityKind = ActivityRow["kind"];

const FEED_LENGTH = 25;
/** Display and sync saves are frequent (every drag or nudge); log at most one line per kind per project per window. */
const THROTTLE_WINDOW = "10 minutes";

function toDto(row: ActivityRow): ActivityDto {
  return {
    id: String(row.id),
    kind: row.kind,
    projectId: String(row.project_id),
    text: row.text,
    at: row.created_at.toISOString(),
  };
}

/** Append one line. The project must already be known to belong to userId. */
export async function logActivity(userId: number, projectId: number, kind: ActivityKind, text: string): Promise<void> {
  await query(
    `INSERT INTO app.activity (user_id, project_id, kind, text)
     SELECT $1, p.id, $3, $4 FROM app.projects p WHERE p.id = $2 AND p.user_id = $1`,
    [userId, projectId, kind, text.slice(0, 300)],
  );
}

/** Log `kind` unless a line of that kind was logged for this project within the window. */
export async function logThrottled(userId: number, projectId: number, kind: ActivityKind, text: string): Promise<void> {
  await query(
    `INSERT INTO app.activity (user_id, project_id, kind, text)
     SELECT $1, p.id, $3, $4 FROM app.projects p
      WHERE p.id = $2 AND p.user_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM app.activity a
           WHERE a.project_id = p.id AND a.kind = $3
             AND a.created_at > now() - interval '${THROTTLE_WINDOW}')`,
    [userId, projectId, kind, text.slice(0, 300)],
  );
}

/** @deprecated use logThrottled(userId, projectId, "edit", text) */
export const logEditThrottled = (userId: number, projectId: number, text: string) => logThrottled(userId, projectId, "edit", text);

export async function listActivity(userId: number): Promise<ActivityDto[]> {
  const rows = await query<ActivityRow>(
    `SELECT id, user_id, project_id, kind, text, created_at
       FROM app.activity
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT ${FEED_LENGTH}`,
    [userId],
  );
  return rows.map(toDto);
}
