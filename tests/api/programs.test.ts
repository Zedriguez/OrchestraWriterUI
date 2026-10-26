import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProgramDto, ProjectDto } from "@/shared/api";
import type { ActivityItem, ProjectSummary } from "@/shared/domain";
import { setupDatabase, signUp, teardown } from "./helpers";

beforeAll(setupDatabase);
afterAll(teardown);

describe("programs", () => {
  it("creates, lists, reorders, patches and deletes programs", async () => {
    const { client } = await signUp();
    const titles = ["Overture", "Concerto", "Symphony"];
    const projects: ProjectDto[] = [];
    for (const title of titles) {
      projects.push((await client.post<{ project: ProjectDto }>("/api/projects", { title })).body.project);
    }

    const created = await client.post<{ program: ProgramDto }>("/api/programs", {
      name: "Autumn Gala",
      season: "2026-27",
      date: "2026-11-14",
      venue: "Main Hall",
      description: "Opening night",
      color: "Brass",
    });
    expect(created.status).toBe(201);
    const program = created.body.program;
    expect(program).toMatchObject({
      name: "Autumn Gala",
      season: "2026-27",
      date: "2026-11-14",
      venue: "Main Hall",
      description: "Opening night",
      color: "Brass",
      notes: "",
      projectIds: [],
    });
    expect(program.id).toMatch(/^\d+$/);

    const minimal = await client.post<{ program: ProgramDto }>("/api/programs", { name: "Spring" });
    expect(minimal.body.program).toMatchObject({ date: "", season: "", color: "Strings" });

    // Running order: Symphony, Overture, Concerto.
    const order = [projects[2]!.id, projects[0]!.id, projects[1]!.id];
    const patched = await client.patch<{ program: ProgramDto }>(`/api/programs/${program.id}`, {
      projectIds: order,
      notes: "Intermission after the concerto",
      date: null,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.program).toMatchObject({ projectIds: order, notes: "Intermission after the concerto", date: "" });

    const detail = await client.get<{ program: ProgramDto; projects: ProjectSummary[] }>(`/api/programs/${program.id}`);
    expect(detail.body.projects.map((p) => p.title)).toEqual(["Symphony", "Overture", "Concerto"]);
    expect(detail.body.projects[0]!.programIds).toEqual([program.id]);

    // Reorder and drop one.
    const reordered = await client.patch<{ program: ProgramDto }>(`/api/programs/${program.id}`, {
      projectIds: [projects[1]!.id, projects[2]!.id],
    });
    expect(reordered.body.program.projectIds).toEqual([projects[1]!.id, projects[2]!.id]);

    // Membership from the project side: add Overture to both programs (appended at the end).
    const viaProject = await client.patch<{ project: ProjectDto }>(`/api/projects/${projects[0]!.id}`, {
      programIds: [program.id, minimal.body.program.id],
    });
    expect([...viaProject.body.project.programIds].sort()).toEqual([program.id, minimal.body.program.id].sort());
    const afterAdd = await client.get<{ program: ProgramDto }>(`/api/programs/${program.id}`);
    expect(afterAdd.body.program.projectIds).toEqual([projects[1]!.id, projects[2]!.id, projects[0]!.id]);
    // ...and remove it from one.
    await client.patch(`/api/projects/${projects[0]!.id}`, { programIds: [minimal.body.program.id] });
    expect((await client.get<{ program: ProgramDto }>(`/api/programs/${program.id}`)).body.program.projectIds).toEqual([
      projects[1]!.id,
      projects[2]!.id,
    ]);

    const list = await client.get<{ programs: ProgramDto[] }>("/api/programs");
    expect(list.body.programs.map((p) => p.name).sort()).toEqual(["Autumn Gala", "Spring"]);

    // Validation.
    for (const body of [{ name: "" }, { color: "Neon" }, { date: "next friday" }, { projectIds: ["x"] }, { projectIds: ["999999999"] }]) {
      const res = await client.patch(`/api/programs/${program.id}`, body);
      expect([400, 404], JSON.stringify(body)).toContain(res.status);
    }
    expect((await client.post("/api/programs", {})).status).toBe(400);

    // Deleting a project removes it from the running order.
    await client.delete(`/api/projects/${projects[1]!.id}`);
    expect((await client.get<{ program: ProgramDto }>(`/api/programs/${program.id}`)).body.program.projectIds).toEqual([projects[2]!.id]);

    expect((await client.delete(`/api/programs/${program.id}`)).status).toBe(204);
    expect((await client.get(`/api/programs/${program.id}`)).status).toBe(404);
    // Projects survive their program.
    expect((await client.get(`/api/projects/${projects[2]!.id}`)).status).toBe(200);
  });

  it("keeps programs private", async () => {
    const a = await signUp();
    const b = await signUp();
    const program = (await a.client.post<{ program: ProgramDto }>("/api/programs", { name: "Private" })).body.program;
    expect((await b.client.get(`/api/programs/${program.id}`)).status).toBe(404);
    expect((await b.client.patch(`/api/programs/${program.id}`, { name: "Taken" })).status).toBe(404);
    expect((await b.client.delete(`/api/programs/${program.id}`)).status).toBe(404);
    expect((await b.client.get<{ programs: ProgramDto[] }>("/api/programs")).body.programs).toEqual([]);
    const projectB = (await b.client.post<{ project: ProjectDto }>("/api/projects", {})).body.project;
    expect((await b.client.patch(`/api/projects/${projectB.id}`, { programIds: [program.id] })).status).toBe(404);
    expect((await a.client.get<{ program: ProgramDto }>(`/api/programs/${program.id}`)).body.program.name).toBe("Private");
  });
});

describe("activity", () => {
  it("throttles repeated sync saves on one project to one line", async () => {
    const { client } = await signUp();
    const project = (await client.post<{ project: ProjectDto }>("/api/projects", {})).body.project;
    const sync = { method: "manual", auto: [], manual: [], averageConfidence: 0 };
    for (let i = 0; i < 5; i++) {
      await client.put(`/api/projects/${project.id}/sync`, { ...sync, averageConfidence: i });
    }
    const activity = (await client.get<{ activity: ActivityItem[] }>("/api/activity")).body.activity;
    expect(activity.filter((a) => a.kind === "sync")).toHaveLength(1);
    expect(activity[0]).toMatchObject({ kind: "sync", projectId: project.id, text: "Saved sync · 0% average confidence" });
  });

  it("lists the last 25 lines, newest first", async () => {
    const { client } = await signUp();
    const sync = { method: "manual", auto: [], manual: [], averageConfidence: 0 };
    let last: ProjectDto | null = null;
    for (let i = 0; i < 27; i++) {
      last = (await client.post<{ project: ProjectDto }>("/api/projects", {})).body.project;
      await client.put(`/api/projects/${last.id}/sync`, { ...sync, averageConfidence: i });
    }
    const activity = (await client.get<{ activity: ActivityItem[] }>("/api/activity")).body.activity;
    expect(activity).toHaveLength(25);
    expect(activity[0]).toMatchObject({ kind: "sync", projectId: last!.id, text: "Saved sync · 26% average confidence" });
    expect(activity[24]!.text).toBe("Saved sync · 2% average confidence");
    for (let i = 1; i < activity.length; i++) {
      expect(Date.parse(activity[i - 1]!.at)).toBeGreaterThanOrEqual(Date.parse(activity[i]!.at));
    }
  });
});
