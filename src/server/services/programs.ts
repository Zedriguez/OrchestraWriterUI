// Concert programs: a named, dated, ordered list of the user's projects.
import type { ProgramDto } from "@/shared/api";
import type { ProjectSummary } from "@/shared/domain";
import type { Section } from "@/shared/sections";
import { query, withTransaction } from "../db/client";
import { NotFoundError } from "../errors";
import type { ProgramRow } from "../types/db";
import { listProjectsByIds } from "./projects";

type ProgramJoinRow = ProgramRow & { project_ids: number[] };

// DATE is read as text: pg would otherwise build a local-time Date and shift the day.
const SELECT_PROGRAM = `
  SELECT pr.id, pr.user_id, pr.name, pr.season, to_char(pr.date, 'YYYY-MM-DD') AS date, pr.venue,
         pr.description, pr.color, pr.notes, pr.created_at, pr.updated_at,
         COALESCE((SELECT array_agg(pp.project_id ORDER BY pp.position, pp.project_id)
                     FROM app.program_projects pp WHERE pp.program_id = pr.id), '{}') AS project_ids
    FROM app.programs pr`;

function toDto(row: ProgramJoinRow): ProgramDto {
  return {
    id: String(row.id),
    name: row.name,
    season: row.season,
    date: row.date ?? "",
    venue: row.venue,
    description: row.description,
    projectIds: row.project_ids.map(String),
    color: row.color as Section,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}

export type ProgramFields = {
  name?: string;
  season?: string;
  /** YYYY-MM-DD, or null to clear */
  date?: string | null;
  venue?: string;
  description?: string;
  color?: Section;
  notes?: string;
};

export async function listPrograms(userId: number): Promise<ProgramDto[]> {
  const rows = await query<ProgramJoinRow>(
    `${SELECT_PROGRAM} WHERE pr.user_id = $1 ORDER BY pr.date ASC NULLS LAST, pr.id DESC`,
    [userId],
  );
  return rows.map(toDto);
}

export async function getProgram(userId: number, programId: number): Promise<ProgramDto> {
  const [row] = await query<ProgramJoinRow>(`${SELECT_PROGRAM} WHERE pr.id = $1 AND pr.user_id = $2`, [programId, userId]);
  if (!row) throw new NotFoundError("Program");
  return toDto(row);
}

/** The program plus its projects as summaries, in running order. */
export async function getProgramWithProjects(
  userId: number,
  programId: number,
): Promise<{ program: ProgramDto; projects: ProjectSummary[] }> {
  const program = await getProgram(userId, programId);
  const projects = await listProjectsByIds(userId, program.projectIds.map(Number));
  return { program, projects };
}

export async function createProgram(userId: number, fields: ProgramFields & { name: string }): Promise<ProgramDto> {
  const [row] = await query<{ id: number }>(
    `INSERT INTO app.programs (user_id, name, season, date, venue, description, color, notes)
     VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8) RETURNING id`,
    [
      userId,
      fields.name,
      fields.season ?? "",
      fields.date ?? null,
      fields.venue ?? "",
      fields.description ?? "",
      fields.color ?? "Strings",
      fields.notes ?? "",
    ],
  );
  return getProgram(userId, row!.id);
}

/** Update fields; `projectIds` (if given) replaces the running order. Every id must be the caller's project. */
export async function updateProgram(
  userId: number,
  programId: number,
  fields: ProgramFields,
  projectIds?: number[],
): Promise<ProgramDto> {
  await withTransaction(async (db) => {
    const found = await db.query("SELECT id FROM app.programs WHERE id = $1 AND user_id = $2 FOR UPDATE", [programId, userId]);
    if (found.rowCount === 0) throw new NotFoundError("Program");

    const sets: string[] = [];
    const params: unknown[] = [programId, userId];
    const set = (column: string, value: unknown, cast = "") => {
      params.push(value);
      sets.push(`${column} = $${params.length}${cast}`);
    };
    if (fields.name !== undefined) set("name", fields.name);
    if (fields.season !== undefined) set("season", fields.season);
    if (fields.date !== undefined) set("date", fields.date, "::date");
    if (fields.venue !== undefined) set("venue", fields.venue);
    if (fields.description !== undefined) set("description", fields.description);
    if (fields.color !== undefined) set("color", fields.color);
    if (fields.notes !== undefined) set("notes", fields.notes);
    sets.push("updated_at = now()");
    await db.query(`UPDATE app.programs SET ${sets.join(", ")} WHERE id = $1 AND user_id = $2`, params);

    if (projectIds !== undefined) {
      const ordered = [...new Set(projectIds)];
      const owned = await db.query<{ id: number }>(
        "SELECT id FROM app.projects WHERE user_id = $1 AND id = ANY($2::int[])",
        [userId, ordered],
      );
      if (owned.rowCount !== ordered.length) throw new NotFoundError("Project");
      await db.query("DELETE FROM app.program_projects WHERE program_id = $1", [programId]);
      if (ordered.length > 0) {
        await db.query(
          `INSERT INTO app.program_projects (program_id, project_id, position)
           SELECT $1, t.project_id, t.ord - 1
             FROM unnest($2::int[]) WITH ORDINALITY AS t(project_id, ord)`,
          [programId, ordered],
        );
      }
    }
  });
  return getProgram(userId, programId);
}

export async function deleteProgram(userId: number, programId: number): Promise<void> {
  const rows = await query("DELETE FROM app.programs WHERE id = $1 AND user_id = $2 RETURNING id", [programId, userId]);
  if (rows.length === 0) throw new NotFoundError("Program");
}
