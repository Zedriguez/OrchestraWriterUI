// The parse-score failure paths, independent of the real parser: the parser is
// mocked so each case is deterministic (stub-style { ok: false }, a throw, too many parts).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ProjectDto, RegisterScoreResponse } from "@/shared/api";
import type { ActivityItem } from "@/shared/domain";
import type { InfoMap } from "@/shared/info-map";
import type { ParseInput, ParseOutcome } from "@/shared/score";
import { setupDatabase, signUp, teardown, TINY_MUSICXML, upload, waitForJob, type Client } from "./helpers";

const parser = vi.hoisted(() => {
  const stub = (): ParseOutcome => ({ ok: false, error: "MusicXML parser not implemented yet" });
  return { impl: stub as (input: ParseInput) => ParseOutcome };
});

vi.mock("@/shared/score", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/score")>();
  return { ...actual, parseMusicXml: (input: ParseInput) => parser.impl(input) };
});

beforeAll(setupDatabase);
afterAll(teardown);

async function registerTinyScore(client: Client) {
  const project = (await client.post<{ project: ProjectDto }>("/api/projects", { title: "Keep me" })).body.project;
  const key = await upload(client, { kind: "score", filename: "tiny.musicxml", contentType: "text/xml", projectId: project.id }, TINY_MUSICXML);
  const reg = await client.post<RegisterScoreResponse>(`/api/projects/${project.id}/score`, { key, filename: "tiny.musicxml" });
  expect(reg.status).toBe(202);
  const job = await waitForJob(client, reg.body.job.id);
  const after = (await client.get<{ project: ProjectDto }>(`/api/projects/${project.id}`)).body.project;
  return { project, job, after };
}

function fakeInfoMap(parts: number): InfoMap {
  return {
    instruments: Array.from({ length: parts }, (_, i) => ({
      id: `P${i + 1}`,
      name: `Part ${i + 1}`,
      shortName: `P${i + 1}`,
      section: "Strings" as const,
      notes: [],
    })),
    measures: [{ number: 1, startTime: 0, duration: 2 }],
    duration: 2,
    tempo: 120,
    timeSignature: "4/4",
    warnings: [],
  };
}

describe("parse-score failures", () => {
  it("records a parser { ok: false } on the job and the project", async () => {
    parser.impl = () => ({ ok: false, error: "MusicXML parser not implemented yet" });
    const { client } = await signUp();
    const { project, job, after } = await registerTinyScore(client);
    expect(job).toMatchObject({ status: "failed", error: "MusicXML parser not implemented yet", message: "Import failed" });
    expect(after).toMatchObject({ status: "failed", statusDetail: "MusicXML parser not implemented yet", title: "Keep me", infoMapKey: null });
    const activity = (await client.get<{ activity: ActivityItem[] }>("/api/activity")).body.activity;
    expect(activity[0]).toMatchObject({ kind: "import", projectId: project.id, text: "Import failed · MusicXML parser not implemented yet" });
  });

  it("hides the detail of an unexpected exception", async () => {
    parser.impl = () => {
      throw new Error("internal stack detail that must not leak");
    };
    const { client } = await signUp();
    const { job, after } = await registerTinyScore(client);
    expect(job.status).toBe("failed");
    expect(job.error).not.toContain("internal");
    expect(after.status).toBe("failed");
    expect(after.statusDetail).toBe(job.error);
  });

  it("rejects more than 64 parts", async () => {
    parser.impl = () => ({
      ok: true,
      infoMap: fakeInfoMap(65),
      meta: { title: "Big", composer: "", movement: "", parts: 65, measures: 1, durationSec: 2, tempo: 120, timeSignature: "4/4", warnings: [] },
    });
    const { client } = await signUp();
    const { job, after } = await registerTinyScore(client);
    expect(job).toMatchObject({ status: "failed", error: "65 parts exceed the 64-part limit" });
    expect(after.status).toBe("failed");
  });

  it("fills the project and display defaults on success", async () => {
    parser.impl = () => ({
      ok: true,
      infoMap: fakeInfoMap(3),
      meta: { title: "", composer: "Anon", movement: "I", parts: 3, measures: 1, durationSec: 2, tempo: 96, timeSignature: "3/4", warnings: ["w1"] },
    });
    const { client } = await signUp();
    const { job, after } = await registerTinyScore(client);
    expect(job).toMatchObject({ status: "succeeded", progress: 1 });
    expect(job.result).toEqual({ title: "Keep me", composer: "Anon", movement: "I", parts: 3, measures: 1, durationSec: 2, warnings: ["w1"] });
    expect(after).toMatchObject({ status: "ready", stage: "import", parts: 3, measures: 1, durationSec: 2, title: "Keep me", composer: "Anon" });
    expect(after.display?.visibleParts).toEqual(["P1", "P2", "P3"]);
    expect(Object.keys(after.display?.positions ?? {})).toEqual(["P1", "P2", "P3"]);
  });
});
