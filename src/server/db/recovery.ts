// Jobs run inside this process, so any job still "running" when the server
// boots died with the previous process. Mark them failed so the Import page
// stops polling and the user can retry.
import { query } from "./client";

const MESSAGE = "The server restarted while this job was running. Please try again.";

export async function recoverInterruptedJobs(): Promise<number> {
  const jobs = await query<{ id: number }>(
    `UPDATE app.jobs SET status = 'failed', error = $1, message = 'Failed', updated_at = now()
      WHERE status IN ('queued', 'running') RETURNING id`,
    [MESSAGE],
  );
  await query(
    `UPDATE app.projects SET parse_status = 'failed', parse_error = $1, updated_at = now()
      WHERE parse_status IN ('queued', 'running')`,
    [MESSAGE],
  );
  return jobs.length;
}
