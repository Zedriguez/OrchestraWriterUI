// The parse-score job, run in-process after POST /api/projects/:id/score answers 202.
//
//   read the score from S3 -> parseMusicXml -> summarizeInfoMap
//   -> write info-map-<jobId>.json to S3 -> update the project -> job succeeded
//
// The only server code that reads uploaded bytes. Progress and the outcome are
// recorded on the app.jobs row, which clients poll. If a newer score was
// registered while this ran, the project row no longer points at this job and
// the result is discarded.
import type { ParseScoreResult } from "@/shared/jobs";
import { MAX_PARTS } from "@/shared/info-map";
import { parseMusicXml, summarizeInfoMap } from "@/shared/score";
import { query } from "../db/client";
import { deleteObject, infoMapKey } from "../storage/keys";
import { getObjectBytes, putObjectBytes } from "../storage/objects";
import { logActivity } from "./activity";
import { defaultDisplaySettings } from "./display-defaults";
import { finishJob, updateJobProgress } from "./jobs";
import { getPreferences } from "./profiles";

export type ParseScoreInput = {
  userId: number;
  projectId: number;
  jobId: number;
  scoreKey: string;
  filename: string;
};

/** Shown to the user when something other than the score itself went wrong. */
const GENERIC_FAILURE = "Could not process the score. Try again, or upload the file again.";

function titleFromFilename(filename: string): string {
  return filename.replace(/\.(musicxml|mxl|xml)$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 200);
}

async function fail(input: ParseScoreInput, error: string): Promise<void> {
  await finishJob(input.jobId, { status: "failed", error, message: "Import failed" });
  const updated = await query(
    `UPDATE app.projects SET parse_status = 'failed', parse_error = $4, updated_at = now()
      WHERE id = $1 AND user_id = $2 AND parse_job_id = $3 RETURNING id`,
    [input.projectId, input.userId, input.jobId, error.slice(0, 2000)],
  );
  if (updated.length > 0) await logActivity(input.userId, input.projectId, "import", `Import failed · ${error}`);
}

export async function runParseScore(input: ParseScoreInput): Promise<void> {
  const { userId, projectId, jobId } = input;
  let writtenKey: string | null = null;
  try {
    await updateJobProgress(jobId, 0.05, "Reading score");
    const bytes = await getObjectBytes(input.scoreKey);

    await updateJobProgress(jobId, 0.3, "Building the information map");
    const outcome = parseMusicXml({ bytes, filename: input.filename });
    if (!outcome.ok) {
      await fail(input, outcome.error);
      return;
    }
    const { infoMap, meta } = outcome;
    if (infoMap.instruments.length > MAX_PARTS) {
      await fail(input, `${infoMap.instruments.length} parts exceed the ${MAX_PARTS}-part limit`);
      return;
    }
    const summary = summarizeInfoMap(infoMap);

    await updateJobProgress(jobId, 0.8, "Saving");
    writtenKey = infoMapKey(userId, projectId, jobId);
    await putObjectBytes(writtenKey, JSON.stringify(infoMap), "application/json");
    const display = defaultDisplaySettings(infoMap, await getPreferences(userId));

    // Title/composer/movement come from the score when it names them; an
    // untitled score keeps the current title, or takes the filename if there is none.
    const fallbackTitle = titleFromFilename(input.filename) || "Untitled project";
    const [project] = await query<{ title: string; composer: string; movement: string; parts: number; measures: number; duration_seconds: number; warnings: string[] }>(
      `UPDATE app.projects
          SET title = CASE WHEN $4 <> '' THEN $4
                           WHEN title = 'Untitled project' OR title = '' THEN $5
                           ELSE title END,
              composer = CASE WHEN $6 <> '' THEN $6 ELSE composer END,
              movement = CASE WHEN $7 <> '' THEN $7 ELSE movement END,
              parts = $8, measures = $9, duration_seconds = $10, tempo = $11, time_signature = $12,
              warnings = $13::jsonb, thumbnail = $14::jsonb, info_map_key = $15,
              display = COALESCE(display, $16::jsonb),
              parse_status = 'succeeded', parse_error = NULL, stage = 'import', updated_at = now()
        WHERE id = $1 AND user_id = $2 AND parse_job_id = $3
        RETURNING title, composer, movement, parts, measures, duration_seconds, warnings`,
      [
        projectId,
        userId,
        jobId,
        meta.title.trim().slice(0, 200),
        fallbackTitle,
        meta.composer.trim().slice(0, 200),
        meta.movement.trim().slice(0, 200),
        summary.parts,
        summary.measures,
        summary.durationSec,
        meta.tempo || null,
        meta.timeSignature || null,
        JSON.stringify(meta.warnings ?? []),
        JSON.stringify(summary.thumbnail ?? []),
        writtenKey,
        JSON.stringify(display),
      ],
    );

    if (!project) {
      // Superseded by a newer score, or the project was deleted meanwhile.
      await deleteObject(writtenKey).catch(() => {});
      await finishJob(jobId, { status: "failed", error: "Superseded by a newer upload", message: "Cancelled" });
      return;
    }
    writtenKey = null; // the project now points at it; never clean it up from here

    const result: ParseScoreResult = {
      title: project.title,
      composer: project.composer,
      movement: project.movement,
      parts: project.parts,
      measures: project.measures,
      durationSec: project.duration_seconds,
      warnings: project.warnings,
    };
    await finishJob(jobId, { status: "succeeded", result, message: "Done" });
    await logActivity(userId, projectId, "import", `Imported score · ${project.parts} parts, ${project.measures} measures`);
  } catch (err) {
    console.error(`parse-score job ${jobId} (project ${projectId}) failed`, err);
    if (writtenKey) await deleteObject(writtenKey).catch(() => {});
    await fail(input, GENERIC_FAILURE).catch((e) => console.error(`could not record failure of job ${jobId}`, e));
  }
}
