// Export history: MP4 and project-file exports rendered in the browser and
// uploaded to the project's exports/ folder. The row records it; the file is in S3.
import type { ExportDto, ExportKind } from "@/shared/api";
import { query } from "../db/client";
import { ConflictError, ForbiddenKeyError, NotFoundError, ValidationError } from "../errors";
import { headObject, isProjectObjectKey, presignDownload } from "../storage/keys";
import type { ExportRow } from "../types/db";
import { logActivity } from "./activity";
import { assertProjectOwned } from "./projects";

const COLUMNS = "id, user_id, project_id, kind, filename, s3_key, bytes, resolution, frame_rate, created_at";

function toDto(row: ExportRow): ExportDto {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    kind: row.kind,
    filename: row.filename,
    key: row.s3_key,
    bytes: Number(row.bytes),
    resolution: row.resolution,
    frameRate: row.frame_rate === 30 || row.frame_rate === 60 ? row.frame_rate : null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listExports(userId: number, projectId: number): Promise<ExportDto[]> {
  await assertProjectOwned(userId, projectId);
  const rows = await query<ExportRow>(
    `SELECT ${COLUMNS} FROM app.exports WHERE project_id = $1 AND user_id = $2 ORDER BY created_at DESC, id DESC`,
    [projectId, userId],
  );
  return rows.map(toDto);
}

export type ExportInput = {
  kind: ExportKind;
  filename: string;
  key: string;
  resolution?: "720p" | "1080p" | "4k";
  frameRate?: 30 | 60;
};

/** Record an uploaded export. The size is always read from S3, which also proves the upload happened. */
export async function registerExport(userId: number, projectId: number, input: ExportInput): Promise<ExportDto> {
  await assertProjectOwned(userId, projectId);
  if (!isProjectObjectKey(input.key, userId, projectId, "exports")) throw new ForbiddenKeyError();
  const head = await headObject(input.key);
  if (!head) throw new ValidationError("No uploaded export at that key; PUT the file to the upload URL first");

  let row: ExportRow;
  try {
    const rows = await query<ExportRow>(
      `INSERT INTO app.exports (user_id, project_id, kind, filename, s3_key, bytes, resolution, frame_rate)
       SELECT $1, p.id, $3, $4, $5, $6, $7, $8 FROM app.projects p WHERE p.id = $2 AND p.user_id = $1
       RETURNING ${COLUMNS}`,
      [
        userId,
        projectId,
        input.kind,
        input.filename,
        input.key,
        head.bytes,
        input.kind === "mp4" ? (input.resolution ?? null) : null,
        input.kind === "mp4" ? (input.frameRate ?? null) : null,
      ],
    );
    if (!rows[0]) throw new NotFoundError("Project");
    row = rows[0];
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new ConflictError("That export is already registered");
    throw err;
  }

  await query("UPDATE app.projects SET updated_at = now() WHERE id = $1 AND user_id = $2", [projectId, userId]);
  const text =
    input.kind === "mp4"
      ? `Exported MP4${input.resolution ? ` (${input.resolution}${input.frameRate ? `, ${input.frameRate} fps` : ""})` : ""}`
      : "Saved a project file";
  await logActivity(userId, projectId, "export", text);
  return toDto(row);
}

/** Presigned download (15 min) that saves under the export's filename. */
export async function getExportDownloadUrl(userId: number, exportId: number): Promise<string> {
  const [row] = await query<Pick<ExportRow, "s3_key" | "filename">>(
    "SELECT s3_key, filename FROM app.exports WHERE id = $1 AND user_id = $2",
    [exportId, userId],
  );
  if (!row) throw new NotFoundError("Export");
  return presignDownload(row.s3_key, { filename: row.filename });
}
