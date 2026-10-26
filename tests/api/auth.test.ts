import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app, Client, PASSWORD, setupDatabase, signUp, teardown, uniqueEmail } from "./helpers";

beforeAll(setupDatabase);
afterAll(teardown);

describe("public endpoints", () => {
  it("answers health, db health, config and status without a session", async () => {
    const anon = new Client();
    expect((await anon.get("/api/health")).body).toEqual({ ok: true });
    expect((await anon.get("/api/health/db")).body).toEqual({ ok: true });
    const config = await anon.get<{ googleEnabled: boolean }>("/api/config");
    expect(typeof config.body.googleEnabled).toBe("boolean");
    const status = await anon.get<{ ok: boolean; database: { ok: boolean }; storage: { ok: boolean }; auth: { signedIn: boolean } }>(
      "/api/status",
    );
    expect(status.body.database.ok).toBe(true);
    expect(status.body.storage.ok).toBe(true);
    expect(status.body.auth.signedIn).toBe(false);
  });

  it("answers unknown API paths with a JSON 404", async () => {
    const res = await new Client().get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found", code: "not_found" });
  });
});

describe("protected routes", () => {
  const routes: Array<[string, string]> = [
    ["GET", "/api/me"],
    ["PUT", "/api/me"],
    ["DELETE", "/api/me"],
    ["GET", "/api/me/usage"],
    ["POST", "/api/uploads"],
    ["GET", "/api/projects"],
    ["POST", "/api/projects"],
    ["GET", "/api/projects/1"],
    ["PATCH", "/api/projects/1"],
    ["DELETE", "/api/projects/1"],
    ["POST", "/api/projects/1/score"],
    ["POST", "/api/projects/1/audio"],
    ["DELETE", "/api/projects/1/audio"],
    ["GET", "/api/projects/1/urls"],
    ["PUT", "/api/projects/1/sync"],
    ["PUT", "/api/projects/1/display"],
    ["GET", "/api/projects/1/exports"],
    ["POST", "/api/projects/1/exports"],
    ["GET", "/api/exports/1/download-url"],
    ["GET", "/api/jobs/1"],
    ["GET", "/api/programs"],
    ["POST", "/api/programs"],
    ["GET", "/api/programs/1"],
    ["PATCH", "/api/programs/1"],
    ["DELETE", "/api/programs/1"],
    ["GET", "/api/activity"],
    ["GET", "/api/files"],
    ["GET", "/api/transcriptions"],
    ["GET", "/api/sheets/1/download-url"],
  ];

  it.each(routes)("%s %s is 401 without a session", async (method, path) => {
    const res = await new Client().request(method, path, method === "GET" || method === "DELETE" ? undefined : {});
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Not signed in" });
  });

  it("rejects form-style requests from another origin (CSRF)", async () => {
    const { client } = await signUp();
    const res = await app.request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "text/plain", cookie: client.cookieHeader() },
      body: JSON.stringify({ title: "csrf" }),
    });
    expect(res.status).toBe(403);
    expect((await client.get<{ projects: unknown[] }>("/api/projects")).body.projects).toEqual([]);
  });

  it("rejects a forged session cookie", async () => {
    const client = new Client();
    client.jar.set("better-auth.session_token", "forged.value");
    expect((await client.get("/api/projects")).status).toBe(401);
  });
});

describe("sessions", () => {
  it("signs up, reads the session, signs out, and signs back in", async () => {
    const email = uniqueEmail("session");
    const { client, userId } = await signUp("Grace Hopper", email);
    expect(client.jar.has("better-auth.session_token")).toBe(true);

    const session = await client.get<{ user: { id: string; email: string } }>("/api/auth/get-session");
    expect(session.body.user).toMatchObject({ id: userId, email });
    expect((await client.get("/api/projects")).status).toBe(200);

    const out = await client.post("/api/auth/sign-out", {});
    expect(out.status).toBe(200);
    expect(client.jar.has("better-auth.session_token")).toBe(false);
    expect((await client.get("/api/auth/get-session")).body).toBeNull();
    expect((await client.get("/api/projects")).status).toBe(401);

    const wrong = await client.post("/api/auth/sign-in/email", { email, password: "not-the-password" });
    expect(wrong.status).toBe(401);
    const back = await client.post("/api/auth/sign-in/email", { email, password: PASSWORD });
    expect(back.status).toBe(200);
    expect((await client.get("/api/projects")).status).toBe(200);
  });
});
