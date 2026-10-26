import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProfileDto, UsageDto } from "@/shared/api";
import { DEFAULT_PREFERENCES } from "@/shared/api";
import { Client, ORIGIN, PASSWORD, setupDatabase, signUp, teardown, uniqueEmail, upload } from "./helpers";

beforeAll(setupDatabase);
afterAll(teardown);

describe("/api/me", () => {
  it("creates the profile on first read, from the auth user", async () => {
    const email = uniqueEmail("ada.lovelace");
    const { client, userId } = await signUp("Ada Lovelace", email);
    const res = await client.get<{ profile: ProfileDto }>("/api/me");
    expect(res.status).toBe(200);
    const p = res.body.profile;
    expect(p).toMatchObject({
      id: userId,
      name: "Ada Lovelace",
      email,
      role: "Music director",
      ensemble: "",
      location: "",
      bio: "",
      initials: "AL",
      image: null,
      preferences: DEFAULT_PREFERENCES,
    });
    expect(p.handle).toMatch(/^ada-lovelace-/);
    expect(Number.isNaN(Date.parse(p.joinedAt))).toBe(false);
    // Second read returns the same row.
    expect((await client.get<{ profile: ProfileDto }>("/api/me")).body.profile.handle).toBe(p.handle);
  });

  it("unique-ifies handles derived from the same email local part", async () => {
    const local = `same-${Date.now()}`;
    const a = await signUp("A", `${local}@one.example.com`);
    const b = await signUp("B", `${local}@two.example.com`);
    const ha = (await a.client.get<{ profile: ProfileDto }>("/api/me")).body.profile.handle;
    const hb = (await b.client.get<{ profile: ProfileDto }>("/api/me")).body.profile.handle;
    expect(ha).toBe(local);
    expect(hb).toBe(`${local}-2`);
  });

  it("updates fields and merges preferences", async () => {
    const { client } = await signUp("Clara Schumann");
    const handle = `clara-${Date.now().toString(36)}`;
    const res = await client.put<{ profile: ProfileDto }>("/api/me", {
      name: "Clara Wieck Schumann",
      handle,
      role: "Conductor",
      ensemble: "Leipzig Gewandhaus",
      location: "Leipzig",
      bio: "Pianist and composer.",
      website: "https://example.com/clara",
      preferences: { theme: "stage", exportFrameRate: 30 },
    });
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      name: "Clara Wieck Schumann",
      handle,
      role: "Conductor",
      ensemble: "Leipzig Gewandhaus",
      website: "https://example.com/clara",
      initials: "CS",
      preferences: { ...DEFAULT_PREFERENCES, theme: "stage", exportFrameRate: 30 },
    });
    // A second partial update keeps earlier preferences.
    const again = await client.put<{ profile: ProfileDto }>("/api/me", { preferences: { reducedMotion: true }, website: null });
    expect(again.body.profile.preferences).toMatchObject({ theme: "stage", exportFrameRate: 30, reducedMotion: true });
    expect(again.body.profile.website).toBeUndefined();
  });

  it("validates the update", async () => {
    const { client } = await signUp();
    const bad = [
      { name: "" },
      { handle: "x" },
      { handle: "Has Spaces" },
      { role: "Emperor" },
      { website: "javascript:alert(1)" },
      { bio: "x".repeat(1001) },
      { preferences: { theme: "neon" } },
      { preferences: { notAPreference: true } },
      { preferences: { exportFrameRate: 24 } },
    ];
    for (const body of bad) {
      const res = await client.put("/api/me", body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body).toMatchObject({ error: expect.any(String) });
    }
    expect((await client.request("PUT", "/api/me")).status).toBe(400);
  });

  it("answers 409 for a handle someone else has", async () => {
    const a = await signUp();
    const b = await signUp();
    const handle = (await a.client.get<{ profile: ProfileDto }>("/api/me")).body.profile.handle;
    const res = await b.client.put("/api/me", { handle });
    expect(res.status).toBe(409);
  });
});

describe("/api/me/usage", () => {
  it("counts scores, recordings and exports with their bytes", async () => {
    const { client } = await signUp();
    const empty = await client.get<UsageDto>("/api/me/usage");
    expect(empty.body).toEqual({
      scores: { count: 0, bytes: 0 },
      recordings: { count: 0, bytes: 0 },
      exports: { count: 0, bytes: 0 },
      totalBytes: 0,
    });

    const { body } = await client.post<{ project: { id: string } }>("/api/projects", { title: "Usage" });
    const projectId = body.project.id;
    const score = "<score-partwise/>".repeat(10);
    const scoreKey = await upload(client, { kind: "score", filename: "u.musicxml", contentType: "application/xml", projectId }, score);
    expect((await client.post(`/api/projects/${projectId}/score`, { key: scoreKey, filename: "u.musicxml" })).status).toBe(202);
    const audio = new Uint8Array(3000).fill(7);
    const audioKey = await upload(client, { kind: "audio", filename: "u.mp3", contentType: "audio/mpeg", projectId }, audio);
    expect((await client.post(`/api/projects/${projectId}/audio`, { key: audioKey, filename: "u.mp3", durationSec: 3 })).status).toBe(200);
    const mp4 = new Uint8Array(1234).fill(1);
    const exportKey = await upload(client, { kind: "export", filename: "u.mp4", contentType: "video/mp4", projectId }, mp4);
    expect(
      (await client.post(`/api/projects/${projectId}/exports`, { kind: "mp4", filename: "u.mp4", key: exportKey, bytes: 0 })).status,
    ).toBe(201);

    const usage = (await client.get<UsageDto>("/api/me/usage")).body;
    expect(usage.scores).toEqual({ count: 1, bytes: score.length });
    expect(usage.recordings).toEqual({ count: 1, bytes: 3000 });
    expect(usage.exports).toEqual({ count: 1, bytes: 1234 });
    expect(usage.totalBytes).toBe(score.length + 3000 + 1234);
  });
});

describe("DELETE /api/me", () => {
  it("deletes the account and its data, and clears the session", async () => {
    const email = uniqueEmail("leaving");
    const { client } = await signUp("Leaving Soon", email);
    const { body } = await client.post<{ project: { id: string } }>("/api/projects", {});
    const key = await upload(
      client,
      { kind: "audio", filename: "bye.mp3", contentType: "audio/mpeg", projectId: body.project.id },
      new Uint8Array(100),
    );
    expect((await client.post(`/api/projects/${body.project.id}/audio`, { key, filename: "bye.mp3", durationSec: 1 })).status).toBe(200);
    const urls = await client.get<{ audio: string }>(`/api/projects/${body.project.id}/urls`);

    const res = await client.delete("/api/me");
    expect(res.status).toBe(204);
    expect(client.jar.has("better-auth.session_token")).toBe(false);
    expect((await client.get("/api/me")).status).toBe(401);

    // The account is gone: signing in fails.
    const again = new Client();
    expect((await again.post("/api/auth/sign-in/email", { email, password: PASSWORD })).status).toBe(401);
    // And so is its storage.
    const gone = await fetch(urls.body.audio, { headers: { origin: ORIGIN } });
    await gone.arrayBuffer();
    expect(gone.status).toBe(404);
  });
});
