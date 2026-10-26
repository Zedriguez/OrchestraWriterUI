// Shared helpers for the API integration tests. They drive the Hono app
// directly (app.request), so no server needs to be running, but Postgres and
// S3Mock must be: `docker compose up -d`.
import { randomUUID } from "node:crypto";
import { app } from "@/server/app";
import { closePool } from "@/server/db/client";
import { databaseStatus, prepareDatabase } from "@/server/db/readiness";

export { app };

/** What Better Auth's CSRF check expects; matches BETTER_AUTH_URL's local default. */
export const ORIGIN = "http://localhost:3000";

export type ApiResponse<T = unknown> = { status: number; body: T; headers: Headers };

/**
 * One browser: a cookie jar plus JSON helpers. Set-Cookie from responses is
 * stored and sent back, so sign-up / sign-in / sign-out behave as in a browser.
 */
export class Client {
  readonly jar = new Map<string, string>();

  cookieHeader(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private store(headers: Headers): void {
    for (const raw of headers.getSetCookie()) {
      const [pair, ...attrs] = raw.split(";");
      const eq = pair!.indexOf("=");
      const name = pair!.slice(0, eq).trim();
      const value = pair!.slice(eq + 1).trim();
      const expired =
        value === "" ||
        attrs.some((a) => /^\s*max-age=0\s*$/i.test(a)) ||
        attrs.some((a) => /^\s*expires=/i.test(a) && Date.parse(a.split("=")[1]!) < Date.now());
      if (expired) this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }

  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { origin: ORIGIN };
    if (this.jar.size > 0) headers.cookie = this.cookieHeader();
    let payload: string | undefined;
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await app.request(`${ORIGIN}${path}`, { method, headers, body: payload });
    this.store(res.headers);
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // not JSON; keep the text
    }
    return { status: res.status, body: parsed as T, headers: res.headers };
  }

  get<T = unknown>(path: string) {
    return this.request<T>("GET", path);
  }
  post<T = unknown>(path: string, body: unknown = {}) {
    return this.request<T>("POST", path, body);
  }
  put<T = unknown>(path: string, body: unknown) {
    return this.request<T>("PUT", path, body);
  }
  patch<T = unknown>(path: string, body: unknown) {
    return this.request<T>("PATCH", path, body);
  }
  delete<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }
}

export const PASSWORD = "Test-Password-123";

export function uniqueEmail(label = "test"): string {
  return `${label}-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`;
}

/** A new account, signed in. */
export async function signUp(name = "Ada Lovelace", email = uniqueEmail()): Promise<{ client: Client; email: string; userId: string }> {
  const client = new Client();
  const res = await client.post<{ user: { id: string } }>("/api/auth/sign-up/email", { name, email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { client, email, userId: res.body.user.id };
}

/** PUT bytes to a presigned URL, the way the browser does. */
export async function putToS3(url: string, bytes: Uint8Array<ArrayBuffer> | string, contentType: string): Promise<number> {
  const res = await fetch(url, { method: "PUT", headers: { "content-type": contentType }, body: bytes });
  await res.arrayBuffer();
  return res.status;
}

type Job = { id: string; status: string; progress: number; message: string; error?: string; result?: unknown };

/** Poll GET /api/jobs/:id until the job is succeeded or failed. */
export async function waitForJob(client: Client, jobId: string, timeoutMs = 20_000): Promise<Job> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await client.get<{ job: Job }>(`/api/jobs/${jobId}`);
    if (res.status !== 200) throw new Error(`job poll failed: ${res.status} ${JSON.stringify(res.body)}`);
    if (res.body.job.status === "succeeded" || res.body.job.status === "failed") return res.body.job;
    if (Date.now() > deadline) throw new Error(`job ${jobId} still ${res.body.job.status} after ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Upload through the real presign flow and return the key. */
export async function upload(
  client: Client,
  input: { kind: "score" | "audio" | "export" | "project"; filename: string; contentType: string; projectId?: string },
  bytes: Uint8Array<ArrayBuffer> | string,
): Promise<string> {
  const target = await client.post<{ key: string; uploadUrl: string }>("/api/uploads", input);
  if (target.status !== 200) throw new Error(`presign failed: ${target.status} ${JSON.stringify(target.body)}`);
  const status = await putToS3(target.body.uploadUrl, bytes, input.contentType);
  if (status !== 200) throw new Error(`S3 PUT failed: HTTP ${status}`);
  return target.body.key;
}

/** A tiny but valid MusicXML score (one part, two measures). */
export const TINY_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Test Piece</work-title></work>
  <identification><creator type="composer">Test Composer</creator></identification>
  <part-list><score-part id="P1"><part-name>Violin I</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction placement="below"><direction-type><dynamics><p/></dynamics></direction-type></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <direction placement="below"><direction-type><dynamics><f/></dynamics></direction-type></direction>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>
`;

/** Call from beforeAll: applies migrations + seeds (same code the server runs on boot). */
export async function setupDatabase(): Promise<void> {
  await prepareDatabase();
  if (databaseStatus() !== "ready") {
    throw new Error("Database not ready: run `docker compose up -d` (Postgres on 5433, S3Mock on 9090)");
  }
}

/** Call from afterAll so the test process can exit. */
export async function teardown(): Promise<void> {
  // Let fire-and-forget jobs (parse-score) finish their last writes first.
  await new Promise((r) => setTimeout(r, 200));
  await closePool();
}
