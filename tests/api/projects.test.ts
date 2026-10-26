import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExportDto, ProjectDto, ProjectUrls, RegisterScoreResponse, UploadTarget } from "@/shared/api";
import type { ActivityItem, ProjectSummary } from "@/shared/domain";
import type { InfoMap } from "@/shared/info-map";
import type { DisplaySettings } from "@/shared/project-file";
import { DEFAULT_SECTION_COLORS } from "@/shared/sections";
import type { SyncState } from "@/shared/sync";
import { Client, putToS3, setupDatabase, signUp, teardown, TINY_MUSICXML, upload, waitForJob } from "./helpers";

beforeAll(setupDatabase);
afterAll(teardown);

async function newProject(client: Client, title?: string): Promise<ProjectDto> {
  const res = await client.post<{ project: ProjectDto }>("/api/projects", title === undefined ? {} : { title });
  expect(res.status).toBe(201);
  return res.body.project;
}

const DISPLAY: DisplaySettings = {
  visibleParts: ["P1"],
  positions: { P1: { x: 0.3, y: 0.6 } },
  colors: { P1: "#ffcc00" },
  sectionColors: { ...DEFAULT_SECTION_COLORS },
  sections: { P1: "Strings" },
  showLabels: true,
  labelMode: "parts",
  reducedMotion: false,
  glowScale: 1.1,
};

const SYNC: SyncState = {
  method: "chroma-dtw",
  auto: [
    { n: 1, startSec: 0, confidence: 95 },
    { n: 2, startSec: 2.1, confidence: 71 },
  ],
  manual: [{ id: "m1", measure: 2, startSec: 2.0, createdAt: new Date().toISOString() }],
  averageConfidence: 83,
};

describe("projects CRUD", () => {
  it("creates, lists, reads, patches and deletes", async () => {
    const { client } = await signUp();
    const empty = await client.get<{ projects: ProjectSummary[] }>("/api/projects");
    expect(empty.body.projects).toEqual([]);

    const untitled = await newProject(client);
    expect(untitled).toMatchObject({
      title: "Untitled project",
      stage: "import",
      status: "importing",
      hasRecording: false,
      parts: 0,
      exports: 0,
      programIds: [],
      thumbnail: [],
      scoreKey: null,
      sync: null,
      display: null,
    });
    expect(untitled.id).toMatch(/^\d+$/);

    const named = await newProject(client, "Symphony No. 5");
    const list = await client.get<{ projects: ProjectSummary[] }>("/api/projects");
    expect(list.body.projects.map((p) => p.id)).toEqual([named.id, untitled.id]);
    // Summaries do not carry the heavy fields.
    expect(list.body.projects[0]).not.toHaveProperty("sync");

    const patched = await client.patch<{ project: ProjectDto }>(`/api/projects/${untitled.id}`, {
      title: "Jupiter",
      subtitle: "from The Planets",
      composer: "Gustav Holst",
      movement: "IV",
      stage: "customize",
    });
    expect(patched.status).toBe(200);
    expect(patched.body.project).toMatchObject({
      title: "Jupiter",
      subtitle: "from The Planets",
      composer: "Gustav Holst",
      movement: "IV",
      stage: "customize",
    });
    // Patched project moves to the top.
    const reordered = await client.get<{ projects: ProjectSummary[] }>("/api/projects");
    expect(reordered.body.projects[0]!.id).toBe(untitled.id);

    const cleared = await client.patch<{ project: ProjectDto }>(`/api/projects/${untitled.id}`, { subtitle: null });
    expect(cleared.body.project.subtitle).toBeUndefined();

    for (const body of [{ title: "" }, { stage: "mixing" }, { programIds: "1" }, { programIds: ["abc"] }]) {
      expect((await client.patch(`/api/projects/${untitled.id}`, body)).status, JSON.stringify(body)).toBe(400);
    }

    expect((await client.delete(`/api/projects/${untitled.id}`)).status).toBe(204);
    expect((await client.get(`/api/projects/${untitled.id}`)).status).toBe(404);
    expect((await client.delete(`/api/projects/${untitled.id}`)).status).toBe(404);
    expect((await client.get("/api/projects/not-a-number")).status).toBe(404);
  });
});

describe("uploads", () => {
  it("presigns per kind with a content-type allowlist and the project prefix", async () => {
    const { client, userId } = await signUp();
    const project = await newProject(client);

    const ok: Array<[string, string]> = [
      ["score", "application/vnd.recordare.musicxml+xml"],
      ["score", "application/vnd.recordare.musicxml"],
      ["score", "application/xml"],
      ["score", "text/xml"],
      ["score", "application/octet-stream"],
      ["audio", "audio/mpeg"],
      ["audio", "audio/wav"],
      ["export", "video/mp4"],
      ["export", "application/zip"],
    ];
    for (const [kind, contentType] of ok) {
      const res = await client.post<UploadTarget>("/api/uploads", { kind, filename: "My File.bin", contentType, projectId: project.id });
      expect(res.status, `${kind} ${contentType}`).toBe(200);
      const folder = kind === "export" ? "exports" : kind;
      expect(res.body.key).toMatch(new RegExp(`^users/${userId}/projects/${project.id}/${folder}/[0-9a-f-]{36}-my-file\\.bin$`));
      expect(res.body.uploadUrl).toContain(encodeURIComponent(res.body.key).replace(/%2F/g, "/"));
      expect(res.body.expiresInSeconds).toBe(900);
    }

    const imported = await client.post<UploadTarget>("/api/uploads", {
      kind: "project",
      filename: "Concert.ovproj",
      contentType: "application/zip",
    });
    expect(imported.status).toBe(200);
    expect(imported.body.key).toMatch(new RegExp(`^users/${userId}/imports/[0-9a-f-]{36}-concert\\.ovproj$`));

    const rejected: Array<Record<string, unknown>> = [
      { kind: "score", filename: "x.mp3", contentType: "audio/mpeg", projectId: project.id },
      { kind: "audio", filename: "x.xml", contentType: "text/xml", projectId: project.id },
      { kind: "audio", filename: "x.html", contentType: "text/html", projectId: project.id },
      { kind: "export", filename: "x.mov", contentType: "video/quicktime", projectId: project.id },
      { kind: "project", filename: "x.json", contentType: "application/json" },
      { kind: "avatar", filename: "x.png", contentType: "image/png", projectId: project.id },
      { kind: "score", filename: "x.xml", contentType: "text/xml" },
      { kind: "score", filename: "", contentType: "text/xml", projectId: project.id },
    ];
    for (const body of rejected) {
      expect((await client.post("/api/uploads", body)).status, JSON.stringify(body)).toBe(400);
    }

    // Someone else's project: 404, never a URL.
    const other = await signUp();
    const res = await other.client.post("/api/uploads", { kind: "score", filename: "x.xml", contentType: "text/xml", projectId: project.id });
    expect(res.status).toBe(404);
  });
});

describe("score registration and the parse-score job", () => {
  it("registers an uploaded score, runs the job to a terminal state, and keeps the project consistent", async () => {
    const { client, userId } = await signUp();
    const project = await newProject(client);
    const key = await upload(
      client,
      { kind: "score", filename: "test-piece.musicxml", contentType: "application/vnd.recordare.musicxml+xml", projectId: project.id },
      TINY_MUSICXML,
    );

    const reg = await client.post<RegisterScoreResponse>(`/api/projects/${project.id}/score`, { key, filename: "test-piece.musicxml" });
    expect(reg.status).toBe(202);
    expect(reg.body.job).toMatchObject({ kind: "parse-score", status: "running" });
    expect(reg.body.job.id).toMatch(/^\d+$/);
    expect(reg.body.project).toMatchObject({ scoreKey: key, scoreName: "test-piece.musicxml", parseJobId: reg.body.job.id });

    const job = await waitForJob(client, reg.body.job.id);
    const after = (await client.get<{ project: ProjectDto }>(`/api/projects/${project.id}`)).body.project;

    if (job.status === "failed") {
      // The parser stub (or a parser that rejects this file) ends here.
      expect(job.error).toBeTruthy();
      expect(after.status).toBe("failed");
      expect(after.statusDetail).toBe(job.error);
      expect(after.infoMapKey).toBeNull();
      if (/not implemented/i.test(job.error!)) console.info("parse-score: parser is still the stub; job failed as expected");
    } else {
      expect(job.status).toBe("succeeded");
      expect(job.progress).toBe(1);
      expect(job.result).toMatchObject({ parts: after.parts, measures: after.measures });
      expect(after.status).toBe("ready");
      expect(after.parts).toBeGreaterThan(0);
      expect(after.infoMapKey).toBe(`users/${userId}/projects/${project.id}/info-map-${job.id}.json`);
      expect(after.display?.visibleParts.length).toBe(after.parts);
      const urls = (await client.get<ProjectUrls>(`/api/projects/${project.id}/urls`)).body;
      const infoMap = (await (await fetch(urls.infoMap!)).json()) as InfoMap;
      expect(infoMap.instruments.length).toBe(after.parts);
    }

    // The score itself can be downloaded back, byte for byte.
    const urls = (await client.get<ProjectUrls>(`/api/projects/${project.id}/urls`)).body;
    expect(await (await fetch(urls.score!)).text()).toBe(TINY_MUSICXML);
    expect(urls.audio).toBeNull();

    const activity = (await client.get<{ activity: ActivityItem[] }>("/api/activity")).body.activity;
    expect(activity[0]).toMatchObject({ kind: "import", projectId: project.id });
  });

  it("rejects keys outside the project's score folder and unknown uploads", async () => {
    const a = await signUp();
    const b = await signUp();
    const projectA = await newProject(a.client);
    const projectB = await newProject(b.client);
    const keyB = await upload(
      b.client,
      { kind: "score", filename: "b.xml", contentType: "text/xml", projectId: projectB.id },
      TINY_MUSICXML,
    );
    const audioKeyA = await upload(
      a.client,
      { kind: "audio", filename: "a.mp3", contentType: "audio/mpeg", projectId: projectA.id },
      new Uint8Array(10),
    );

    // B's key on A's project: 403 (the prefix check).
    expect((await a.client.post(`/api/projects/${projectA.id}/score`, { key: keyB, filename: "b.xml" })).status).toBe(403);
    // A's own audio key used as a score: 403.
    expect((await a.client.post(`/api/projects/${projectA.id}/score`, { key: audioKeyA, filename: "a.xml" })).status).toBe(403);
    // Path tricks: 403.
    const tricky = `users/${a.userId}/projects/${projectA.id}/score/../../../../users/${b.userId}/x`;
    expect((await a.client.post(`/api/projects/${projectA.id}/score`, { key: tricky, filename: "x.xml" })).status).toBe(403);
    // Well-formed key that was never uploaded: 400.
    const ghost = `users/${a.userId}/projects/${projectA.id}/score/00000000-0000-0000-0000-000000000000-ghost.xml`;
    expect((await a.client.post(`/api/projects/${projectA.id}/score`, { key: ghost, filename: "ghost.xml" })).status).toBe(400);
    // Missing fields: 400.
    expect((await a.client.post(`/api/projects/${projectA.id}/score`, { filename: "x.xml" })).status).toBe(400);
  });
});

describe("audio, sync and display", () => {
  it("registers a recording, round-trips sync and display, and removes the recording", async () => {
    const { client } = await signUp();
    const project = await newProject(client, "With audio");
    const bytes = new Uint8Array(4096).map((_, i) => i % 251);
    const key = await upload(client, { kind: "audio", filename: "Take 1.mp3", contentType: "audio/mpeg", projectId: project.id }, bytes);
    const peaks = Array.from({ length: 420 }, (_, i) => (i % 10) / 10);

    const reg = await client.post<{ project: ProjectDto }>(`/api/projects/${project.id}/audio`, {
      key,
      filename: "Take 1.mp3",
      durationSec: 12.4,
      peaks,
    });
    expect(reg.status).toBe(200);
    expect(reg.body.project).toMatchObject({
      hasRecording: true,
      recordingName: "Take 1.mp3",
      audioKey: key,
      stage: "sync",
      sync: null,
    });
    expect(reg.body.project.audioFileId).toMatch(/^\d+$/);
    expect(reg.body.project.audioPeaks).toHaveLength(420);

    // The recording streams back from S3 unchanged.
    const urls = (await client.get<ProjectUrls>(`/api/projects/${project.id}/urls`)).body;
    expect(new Uint8Array(await (await fetch(urls.audio!)).arrayBuffer())).toEqual(bytes);

    // Sync round trip.
    const sync = await client.put<{ project: ProjectDto }>(`/api/projects/${project.id}/sync`, SYNC);
    expect(sync.status).toBe(200);
    expect(sync.body.project.sync).toEqual(SYNC);
    expect(sync.body.project.averageConfidence).toBe(83);
    expect((await client.get<{ project: ProjectDto }>(`/api/projects/${project.id}`)).body.project.sync).toEqual(SYNC);
    for (const bad of [{ ...SYNC, auto: "x" }, { ...SYNC, averageConfidence: 140 }, { ...SYNC, auto: [{ n: 1 }] }, [SYNC]]) {
      expect((await client.put(`/api/projects/${project.id}/sync`, bad)).status).toBe(400);
    }

    // Display round trip.
    const display = await client.put<{ project: ProjectDto }>(`/api/projects/${project.id}/display`, DISPLAY);
    expect(display.status).toBe(200);
    expect(display.body.project.display).toEqual(DISPLAY);
    for (const bad of [{ ...DISPLAY, glowScale: 3 }, { ...DISPLAY, positions: [] }, { ...DISPLAY, sections: { P1: "Choir" } }]) {
      expect((await client.put(`/api/projects/${project.id}/display`, bad)).status).toBe(400);
    }
    // Display edits log at most one "edit" line per 10 minutes.
    await client.put(`/api/projects/${project.id}/display`, { ...DISPLAY, glowScale: 1.2 });
    const activity = (await client.get<{ activity: ActivityItem[] }>("/api/activity")).body.activity;
    expect(activity.filter((a) => a.kind === "edit")).toHaveLength(1);
    expect(activity.some((a) => a.kind === "sync")).toBe(true);

    // A new recording clears sync.
    const key2 = await upload(client, { kind: "audio", filename: "Take 2.mp3", contentType: "audio/mpeg", projectId: project.id }, bytes);
    const reg2 = await client.post<{ project: ProjectDto }>(`/api/projects/${project.id}/audio`, { key: key2, filename: "Take 2.mp3", durationSec: 12 });
    expect(reg2.body.project).toMatchObject({ recordingName: "Take 2.mp3", sync: null, audioPeaks: null });
    const oldGone = await fetch(urls.audio!);
    await oldGone.arrayBuffer();
    expect(oldGone.status).toBe(404);

    // Remove the recording.
    const removed = await client.delete<{ project: ProjectDto }>(`/api/projects/${project.id}/audio`);
    expect(removed.status).toBe(200);
    expect(removed.body.project).toMatchObject({ hasRecording: false, audioKey: null, audioFileId: null, sync: null, stage: "customize" });
    expect(removed.body.project.recordingName).toBeUndefined();

    // Bad audio bodies.
    expect((await client.post(`/api/projects/${project.id}/audio`, { key: key2, filename: "x.mp3", durationSec: -1 })).status).toBe(400);
    expect((await client.post(`/api/projects/${project.id}/audio`, { key: key2, filename: "x.mp3", durationSec: 3, peaks: [2] })).status).toBe(400);
  });
});

describe("exports", () => {
  it("registers exports, lists them newest first, and signs downloads", async () => {
    const { client } = await signUp();
    const project = await newProject(client, "Exported");
    const mp4 = new Uint8Array(2048).fill(9);
    const mp4Key = await upload(client, { kind: "export", filename: "Exported 1080p.mp4", contentType: "video/mp4", projectId: project.id }, mp4);
    const reg = await client.post<{ export: ExportDto }>(`/api/projects/${project.id}/exports`, {
      kind: "mp4",
      filename: "Exported 1080p.mp4",
      key: mp4Key,
      bytes: 0,
      resolution: "1080p",
      frameRate: 60,
    });
    expect(reg.status).toBe(201);
    expect(reg.body.export).toMatchObject({
      projectId: project.id,
      kind: "mp4",
      filename: "Exported 1080p.mp4",
      key: mp4Key,
      bytes: 2048,
      resolution: "1080p",
      frameRate: 60,
    });

    const zipKey = await upload(client, { kind: "export", filename: "Exported.ovproj", contentType: "application/zip", projectId: project.id }, "PK");
    const reg2 = await client.post<{ export: ExportDto }>(`/api/projects/${project.id}/exports`, {
      kind: "project",
      filename: "Exported.ovproj",
      key: zipKey,
      bytes: 999,
    });
    expect(reg2.body.export).toMatchObject({ kind: "project", bytes: 2, resolution: null, frameRate: null });

    const list = (await client.get<{ exports: ExportDto[] }>(`/api/projects/${project.id}/exports`)).body.exports;
    expect(list.map((e) => e.id)).toEqual([reg2.body.export.id, reg.body.export.id]);

    const summary = (await client.get<{ project: ProjectDto }>(`/api/projects/${project.id}`)).body.project;
    expect(summary.exports).toBe(2);

    const url = (await client.get<{ url: string }>(`/api/exports/${reg.body.export.id}/download-url`)).body.url;
    const dl = await fetch(url);
    expect(new Uint8Array(await dl.arrayBuffer())).toEqual(mp4);
    expect(dl.headers.get("content-disposition")).toContain('attachment; filename="Exported 1080p.mp4"');

    // Duplicate key: 409. Foreign-folder key: 403. Bad kind: 400.
    expect((await client.post(`/api/projects/${project.id}/exports`, { kind: "mp4", filename: "a.mp4", key: mp4Key })).status).toBe(409);
    const scoreKey = await upload(client, { kind: "score", filename: "s.xml", contentType: "text/xml", projectId: project.id }, "<x/>");
    expect((await client.post(`/api/projects/${project.id}/exports`, { kind: "mp4", filename: "s.mp4", key: scoreKey })).status).toBe(403);
    expect((await client.post(`/api/projects/${project.id}/exports`, { kind: "gif", filename: "a.gif", key: mp4Key })).status).toBe(400);

    const activity = (await client.get<{ activity: ActivityItem[] }>("/api/activity")).body.activity;
    expect(activity.filter((a) => a.kind === "export").map((a) => a.text)).toEqual(["Saved a project file", "Exported MP4 (1080p, 60 fps)"]);
  });
});

describe("isolation between users", () => {
  it("never shows or changes another user's project, recording, export or job", async () => {
    const a = await signUp("Owner");
    const b = await signUp("Intruder");
    const project = await newProject(a.client, "Private");
    const audioKey = await upload(a.client, { kind: "audio", filename: "a.mp3", contentType: "audio/mpeg", projectId: project.id }, new Uint8Array(64));
    await a.client.post(`/api/projects/${project.id}/audio`, { key: audioKey, filename: "a.mp3", durationSec: 1 });
    const scoreKey = await upload(a.client, { kind: "score", filename: "a.xml", contentType: "text/xml", projectId: project.id }, TINY_MUSICXML);
    const reg = await a.client.post<RegisterScoreResponse>(`/api/projects/${project.id}/score`, { key: scoreKey, filename: "a.xml" });
    const exportKey = await upload(a.client, { kind: "export", filename: "a.mp4", contentType: "video/mp4", projectId: project.id }, new Uint8Array(8));
    const exp = await a.client.post<{ export: ExportDto }>(`/api/projects/${project.id}/exports`, { kind: "mp4", filename: "a.mp4", key: exportKey });
    await waitForJob(a.client, reg.body.job.id);
    const before = (await a.client.get<{ project: ProjectDto }>(`/api/projects/${project.id}`)).body.project;

    const id = project.id;
    const attempts: Array<[string, string, unknown?]> = [
      ["GET", `/api/projects/${id}`],
      ["PATCH", `/api/projects/${id}`, { title: "Mine now" }],
      ["DELETE", `/api/projects/${id}`],
      ["GET", `/api/projects/${id}/urls`],
      ["PUT", `/api/projects/${id}/sync`, SYNC],
      ["PUT", `/api/projects/${id}/display`, DISPLAY],
      ["DELETE", `/api/projects/${id}/audio`],
      ["POST", `/api/projects/${id}/score`, { key: scoreKey, filename: "a.xml" }],
      ["POST", `/api/projects/${id}/audio`, { key: audioKey, filename: "a.mp3", durationSec: 1 }],
      ["GET", `/api/projects/${id}/exports`],
      ["POST", `/api/projects/${id}/exports`, { kind: "mp4", filename: "a.mp4", key: exportKey }],
      ["GET", `/api/exports/${exp.body.export.id}/download-url`],
      ["GET", `/api/jobs/${reg.body.job.id}`],
    ];
    for (const [method, path, body] of attempts) {
      const res = await b.client.request(method, path, body);
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    expect((await b.client.get<{ projects: ProjectSummary[] }>("/api/projects")).body.projects).toEqual([]);
    expect((await b.client.get<{ activity: ActivityItem[] }>("/api/activity")).body.activity).toEqual([]);

    // B cannot pull A's project into a program either.
    const prog = await b.client.post<{ program: { id: string } }>("/api/programs", { name: "Heist" });
    expect((await b.client.patch(`/api/programs/${prog.body.program.id}`, { projectIds: [id] })).status).toBe(404);

    // Nothing changed for A.
    const mine = (await a.client.get<{ project: ProjectDto }>(`/api/projects/${id}`)).body.project;
    expect(mine).toEqual(before);
    expect(mine).toMatchObject({ hasRecording: true, sync: null, exports: 1 });
    expect((await a.client.get(`/api/exports/${exp.body.export.id}/download-url`)).status).toBe(200);
  });
});

describe("project deletion", () => {
  it("removes the rows and every object under the project prefix", async () => {
    const { client } = await signUp();
    const project = await newProject(client);
    const audioKey = await upload(client, { kind: "audio", filename: "d.mp3", contentType: "audio/mpeg", projectId: project.id }, new Uint8Array(32));
    await client.post(`/api/projects/${project.id}/audio`, { key: audioKey, filename: "d.mp3", durationSec: 1 });
    const exportKey = await upload(client, { kind: "export", filename: "d.mp4", contentType: "video/mp4", projectId: project.id }, new Uint8Array(32));
    await client.post(`/api/projects/${project.id}/exports`, { kind: "mp4", filename: "d.mp4", key: exportKey });
    // An upload that was never registered still lives under the prefix.
    const target = await client.post<UploadTarget>("/api/uploads", { kind: "score", filename: "orphan.xml", contentType: "text/xml", projectId: project.id });
    expect(await putToS3(target.body.uploadUrl, "<x/>", "text/xml")).toBe(200);
    const urls = (await client.get<ProjectUrls>(`/api/projects/${project.id}/urls`)).body;

    expect((await client.delete(`/api/projects/${project.id}`)).status).toBe(204);
    const audio = await fetch(urls.audio!);
    await audio.arrayBuffer();
    expect(audio.status).toBe(404);
    expect((await client.get<{ projects: ProjectSummary[] }>("/api/projects")).body.projects).toEqual([]);
    // Recording row went with it.
    const usage = (await client.get<{ recordings: { count: number }; exports: { count: number } }>("/api/me/usage")).body;
    expect(usage.recordings.count).toBe(0);
    expect(usage.exports.count).toBe(0);
  });
});
