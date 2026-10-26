// /api/programs: concert programs and their running order.
import { Hono } from "hono";
import { SECTIONS } from "@/shared/sections";
import { ValidationError } from "../errors";
import * as programs from "../services/programs";
import { requireUser, type AuthEnv } from "./session";
import { idList, idParam, jsonBody, nullableStr, optOneOf, optStr, str, type Body } from "./validate";

export const programsRoutes = new Hono<AuthEnv>();

programsRoutes.use("*", requireUser);

const programId = (c: Parameters<typeof idParam>[0]) => idParam(c, "id", "Program");

function parseDate(body: Body): string | null | undefined {
  const date = nullableStr(body.date, "date", { max: 10 });
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))) {
    throw new ValidationError("date must be YYYY-MM-DD");
  }
  return date;
}

function parseFields(body: Body) {
  return {
    season: optStr(body.season, "season", { max: 100 }),
    date: parseDate(body),
    venue: optStr(body.venue, "venue", { max: 200 }),
    description: optStr(body.description, "description", { max: 2000 }),
    color: optOneOf(body.color, "color", SECTIONS),
  };
}

programsRoutes.get("/", async (c) => {
  return c.json({ programs: await programs.listPrograms(c.get("userId")) });
});

programsRoutes.post("/", async (c) => {
  const body = await jsonBody(c);
  const program = await programs.createProgram(c.get("userId"), {
    name: str(body.name, "name", { min: 1, max: 200 }),
    ...parseFields(body),
  });
  return c.json({ program }, 201);
});

programsRoutes.get("/:id", async (c) => {
  return c.json(await programs.getProgramWithProjects(c.get("userId"), programId(c)));
});

programsRoutes.patch("/:id", async (c) => {
  const id = programId(c);
  const body = await jsonBody(c);
  const program = await programs.updateProgram(
    c.get("userId"),
    id,
    {
      name: optStr(body.name, "name", { min: 1, max: 200 }),
      notes: optStr(body.notes, "notes", { max: 5000 }),
      ...parseFields(body),
    },
    body.projectIds === undefined ? undefined : idList(body.projectIds, "projectIds"),
  );
  return c.json({ program });
});

programsRoutes.delete("/:id", async (c) => {
  await programs.deleteProgram(c.get("userId"), programId(c));
  return c.body(null, 204);
});
