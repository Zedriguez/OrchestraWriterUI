import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@/shared/jobs";
import type { ProjectDto } from "@/shared/api";

// Keep the HTTP client test independent of the audio / align / export modules.
vi.mock("@/lib/audio", () => ({
  decodeAudioFile: vi.fn(),
  peaksFromAudioBuffer: vi.fn(() => []),
  peaksFromInfoMap: vi.fn(() => []),
  toAlignAudio: vi.fn(),
  renderScoreToAudioBuffer: vi.fn(),
}));
vi.mock("@/lib/align/worker-client", () => ({ alignInWorker: vi.fn() }));
vi.mock("@/lib/export", () => ({ renderMp4: vi.fn(), packProjectFile: vi.fn(), unpackProjectFile: vi.fn() }));

import { createHttpApi } from "@/lib/api/http";
import { ApiRequestError, AuthRequiredError, onAuthRequired } from "@/lib/api/errors";
import { subscribeJob } from "@/lib/jobs/registry";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const calls: Call[] = [];
type Handler = (call: Call) => Response | Promise<Response>;
let routes: Array<{ method: string; path: RegExp | string; handle: Handler }> = [];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function route(method: string, path: RegExp | string, handle: Handler) {
  routes.push({ method, path, handle });
}

function installFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method ?? "GET").toUpperCase();
      const headers = Object.fromEntries(new Headers(init?.headers).entries());
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
      const call = { url, method, headers, body };
      calls.push(call);
      const match = routes.find((r) => r.method === method && (typeof r.path === "string" ? r.path === url : r.path.test(url)));
      if (!match) return json({ error: `No mock route for ${method} ${url}` }, 404);
      return match.handle(call);
    }),
  );
}

/** Minimal XMLHttpRequest that records the PUT and reports progress. */
const xhrPuts: Array<{ url: string; headers: Record<string, string>; body: Blob }> = [];
class FakeXHR {
  static status = 200;
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  private url = "";
  private headers: Record<string, string> = {};
  open(_method: string, url: string) {
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  abort() {
    this.onabort?.();
  }
  send(body: Blob) {
    xhrPuts.push({ url: this.url, headers: this.headers, body });
    setTimeout(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
      this.status = FakeXHR.status;
      this.onload?.();
    }, 0);
  }
}

function waitForJob<T>(id: string): Promise<Job<T>> {
  return new Promise((resolve) => {
    const off = subscribeJob<T>(id, (job) => {
      if (job.status === "succeeded" || job.status === "failed") {
        off();
        resolve(job);
      }
    });
  });
}

const project: ProjectDto = {
  id: "p1",
  title: "Untitled",
  composer: "",
  movement: "",
  parts: 0,
  measures: 0,
  durationSec: 0,
  hasRecording: false,
  scoreName: "",
  stage: "import",
  status: "ready",
  updatedAt: "2026-10-26T10:00:00Z",
  createdAt: "2026-10-26T10:00:00Z",
  programIds: [],
  thumbnail: [],
  exports: 0,
  scoreKey: null,
  audioFileId: null,
  audioKey: null,
  infoMapKey: null,
  audioPeaks: null,
  parseJobId: null,
  sync: null,
  display: null,
};

beforeEach(() => {
  calls.length = 0;
  xhrPuts.length = 0;
  routes = [];
  FakeXHR.status = 200;
  installFetch();
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("httpApi request shapes", () => {
  it("createProject POSTs JSON to /api/projects with same-origin credentials", async () => {
    route("POST", "/api/projects", () => json({ project }, 201));
    const api = createHttpApi();
    const created = await api.createProject({ title: "Untitled" });
    expect(created.id).toBe("p1");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: "/api/projects", method: "POST", body: { title: "Untitled" } });
    expect(calls[0].headers["content-type"]).toBe("application/json");
    const init = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("same-origin");
  });

  it("getProject returns null on 404 and rethrows other errors", async () => {
    route("GET", "/api/projects/missing", () => json({ error: "Project not found" }, 404));
    route("GET", "/api/projects/boom", () => json({ error: "Database down", code: "DB" }, 500));
    const api = createHttpApi();
    expect(await api.getProject("missing")).toBeNull();
    await expect(api.getProject("boom")).rejects.toMatchObject({ message: "Database down", status: 500, code: "DB" });
    await expect(api.getProject("boom")).rejects.toBeInstanceOf(ApiRequestError);
  });
});

describe("httpApi error mapping", () => {
  it("maps 401 to AuthRequiredError and notifies listeners", async () => {
    route("GET", "/api/projects", () => json({ error: "Not signed in" }, 401));
    const listener = vi.fn();
    const off = onAuthRequired(listener);
    const api = createHttpApi();
    const err = await api.listProjects().catch((e: unknown) => e);
    off();
    expect(err).toBeInstanceOf(AuthRequiredError);
    expect((err as Error).message).toBe("Not signed in");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("getProfile resolves null when signed out", async () => {
    route("GET", "/api/me", () => json({ error: "Not signed in" }, 401));
    const api = createHttpApi();
    expect(await api.getProfile()).toBeNull();
  });
});

describe("httpApi.uploadScore", () => {
  it("presigns, PUTs with progress, registers, and mirrors the parse job into 0.4–1.0", async () => {
    let polls = 0;
    route("POST", "/api/uploads", () => json({ key: "users/u/projects/p1/score/sym.musicxml", uploadUrl: "https://s3.test/put", expiresInSeconds: 900 }));
    route("POST", "/api/projects/p1/score", () =>
      json({ project: { ...project, parseJobId: "rj1" }, job: { id: "rj1", kind: "parse-score", status: "queued", progress: 0, message: "Queued", startedAt: "", updatedAt: "" } }, 202),
    );
    route("GET", "/api/jobs/rj1", () => {
      polls++;
      const base = { id: "rj1", kind: "parse-score", startedAt: "", updatedAt: "" };
      if (polls === 1) return json({ job: { ...base, status: "running", progress: 0.5, message: "Walking measures" } });
      return json({
        job: {
          ...base,
          status: "succeeded",
          progress: 1,
          message: "Done",
          result: { title: "Symphony No. 5", composer: "Beethoven", movement: "I", parts: 22, measures: 502, durationSec: 438, warnings: [] },
        },
      });
    });

    const api = createHttpApi({ pollIntervalMs: 1 });
    const file = new File(["<score-partwise/>"], "sym.musicxml");
    const job = await api.uploadScore("p1", file);
    expect(job.status).toBe("queued"); // returned immediately, before any network work

    const seen: Array<{ progress: number; message: string }> = [];
    const off = subscribeJob(job.id, (j) => seen.push({ progress: j.progress, message: j.message }));
    const final = await waitForJob<{ title: string }>(job.id);
    off();

    expect(final.status).toBe("succeeded");
    expect(final.result?.title).toBe("Symphony No. 5");

    // presign body
    const presign = calls.find((c) => c.url === "/api/uploads");
    expect(presign?.body).toEqual({ kind: "score", projectId: "p1", filename: "sym.musicxml", contentType: "application/vnd.recordare.musicxml+xml" });
    // S3 PUT with the same content type
    expect(xhrPuts).toHaveLength(1);
    expect(xhrPuts[0].url).toBe("https://s3.test/put");
    expect(xhrPuts[0].headers["Content-Type"]).toBe("application/vnd.recordare.musicxml+xml");
    expect(xhrPuts[0].body).toBe(file);
    // register body
    const register = calls.find((c) => c.url === "/api/projects/p1/score");
    expect(register?.body).toEqual({ key: "users/u/projects/p1/score/sym.musicxml", filename: "sym.musicxml" });
    // remote progress 0.5 lands in the parse band (0.4–1.0) with the remote message
    const mirrored = seen.find((s) => s.message === "Walking measures");
    expect(mirrored).toBeDefined();
    expect(mirrored!.progress).toBeCloseTo(0.7, 5);
    // upload progress stayed below 0.4
    const uploading = seen.filter((s) => s.message === "Uploading score");
    expect(uploading.length).toBeGreaterThan(0);
    expect(Math.max(...uploading.map((s) => s.progress))).toBeLessThanOrEqual(0.4);
    expect(polls).toBe(2);
  });

  it("fails the local job when the parse job fails", async () => {
    route("POST", "/api/uploads", () => json({ key: "k", uploadUrl: "https://s3.test/put", expiresInSeconds: 900 }));
    route("POST", "/api/projects/p1/score", () => json({ project, job: { id: "rj2", kind: "parse-score", status: "queued", progress: 0, message: "", startedAt: "", updatedAt: "" } }, 202));
    route("GET", "/api/jobs/rj2", () => json({ job: { id: "rj2", kind: "parse-score", status: "failed", progress: 0.3, message: "Failed", error: "86 parts exceed the 64-part limit", startedAt: "", updatedAt: "" } }));
    const api = createHttpApi({ pollIntervalMs: 1 });
    const job = await api.uploadScore("p1", new File(["x"], "big.mxl"));
    const final = await waitForJob(job.id);
    expect(final.status).toBe("failed");
    expect(final.error).toBe("86 parts exceed the 64-part limit");
    expect(calls.find((c) => c.url === "/api/uploads")?.body).toMatchObject({ contentType: "application/vnd.recordare.musicxml" });
  });
});

describe("httpApi.getProjectUrls caching", () => {
  it("serves cached URLs for 10 minutes, then refetches", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T10:00:00Z"));
    let hits = 0;
    route("GET", "/api/projects/p1/urls", () => {
      hits++;
      return json({ score: `https://s3.test/score?${hits}`, audio: null, infoMap: null, expiresInSeconds: 900 });
    });
    const api = createHttpApi();
    const a = await api.getProjectUrls("p1");
    const b = await api.getProjectUrls("p1");
    expect(hits).toBe(1);
    expect(b).toBe(a);
    vi.setSystemTime(new Date("2026-10-26T10:09:00Z"));
    await api.getProjectUrls("p1");
    expect(hits).toBe(1);
    vi.setSystemTime(new Date("2026-10-26T10:11:00Z"));
    const c = await api.getProjectUrls("p1");
    expect(hits).toBe(2);
    expect(c.score).toBe("https://s3.test/score?2");
    vi.useRealTimers();
  });

  it("is invalidated by uploads", async () => {
    let hits = 0;
    route("GET", "/api/projects/p1/urls", () => {
      hits++;
      return json({ score: null, audio: null, infoMap: null, expiresInSeconds: 900 });
    });
    route("POST", "/api/uploads", () => json({ key: "k", uploadUrl: "https://s3.test/put", expiresInSeconds: 900 }));
    route("POST", "/api/projects/p1/score", () => json({ project, job: { id: "rj3", kind: "parse-score", status: "queued", progress: 0, message: "", startedAt: "", updatedAt: "" } }, 202));
    route("GET", "/api/jobs/rj3", () => json({ job: { id: "rj3", kind: "parse-score", status: "succeeded", progress: 1, message: "Done", result: {}, startedAt: "", updatedAt: "" } }));
    const api = createHttpApi({ pollIntervalMs: 1 });
    await api.getProjectUrls("p1");
    await api.getProjectUrls("p1");
    expect(hits).toBe(1);
    const job = await api.uploadScore("p1", new File(["x"], "s.xml"));
    await waitForJob(job.id);
    await api.getProjectUrls("p1");
    expect(hits).toBe(2);
  });
});
