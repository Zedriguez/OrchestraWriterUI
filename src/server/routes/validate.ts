// Small hand-rolled validators for request bodies and params. Routes narrow
// `unknown` JSON into typed values here before anything reaches a service, and
// only the fields named are ever read (no spreading a body into a query).
import type { Context } from "hono";
import { NotFoundError, ValidationError } from "../errors";

export type Body = Record<string, unknown>;

/** Parse the JSON body as an object. 400 if it is missing or not an object. */
export async function jsonBody(c: Context): Promise<Body> {
  const body: unknown = await c.req.json().catch(() => undefined);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  return body as Body;
}

/** Like jsonBody(), but an empty body is {}. */
export async function optionalJsonBody(c: Context): Promise<Body> {
  const text = await c.req.text();
  if (text.trim() === "") return {};
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ValidationError("Request body must be a JSON object");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  return body as Body;
}

/**
 * A positive integer id from the URL. Anything else cannot name a row this
 * user owns, so it is a 404 like any other missing record.
 */
export function idParam(c: Context, name: string, what: string): number {
  const raw = c.req.param(name) ?? "";
  if (!/^[1-9][0-9]{0,9}$/.test(raw)) throw new NotFoundError(what);
  const id = Number(raw);
  if (id > 2_147_483_647) throw new NotFoundError(what);
  return id;
}

/** A string id from a body (ids are strings on the wire). */
export function idValue(value: unknown, field: string): number {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string" || !/^[1-9][0-9]{0,9}$/.test(raw) || Number(raw) > 2_147_483_647) {
    throw new ValidationError(`${field} must be an id`);
  }
  return Number(raw);
}

export function idList(value: unknown, field: string, max = 500): number[] {
  if (!Array.isArray(value)) throw new ValidationError(`${field} must be an array of ids`);
  if (value.length > max) throw new ValidationError(`${field} has more than ${max} entries`);
  return value.map((v) => idValue(v, field));
}

type StringOptions = { min?: number; max: number; trim?: boolean };

export function str(value: unknown, field: string, opts: StringOptions): string {
  if (typeof value !== "string") throw new ValidationError(`${field} must be a string`);
  const v = opts.trim === false ? value : value.trim();
  const min = opts.min ?? 0;
  if (v.length < min) throw new ValidationError(min <= 1 ? `${field} is required` : `${field} must be at least ${min} characters`);
  if (v.length > opts.max) throw new ValidationError(`${field} must be at most ${opts.max} characters`);
  return v;
}

/** undefined when absent; otherwise validated like str(). */
export function optStr(value: unknown, field: string, opts: StringOptions): string | undefined {
  return value === undefined ? undefined : str(value, field, opts);
}

/** undefined when absent, null when null (or an empty string); otherwise validated like str(). */
export function nullableStr(value: unknown, field: string, opts: StringOptions): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const v = str(value, field, opts);
  return v === "" ? null : v;
}

export function oneOf<T extends string | number>(value: unknown, field: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw new ValidationError(`${field} must be one of ${allowed.join(", ")}`);
  return value as T;
}

export function optOneOf<T extends string | number>(value: unknown, field: string, allowed: readonly T[]): T | undefined {
  return value === undefined ? undefined : oneOf(value, field, allowed);
}

export function bool(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new ValidationError(`${field} must be true or false`);
  return value;
}

export function num(value: unknown, field: string, opts: { min?: number; max?: number } = {}): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ValidationError(`${field} must be a number`);
  if (opts.min !== undefined && value < opts.min) throw new ValidationError(`${field} must be at least ${opts.min}`);
  if (opts.max !== undefined && value > opts.max) throw new ValidationError(`${field} must be at most ${opts.max}`);
  return value;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Reject keys outside `allowed`, so a typo or an unexpected field is a 400, not silently ignored. */
export function onlyKeys(body: Body, allowed: readonly string[], what = "body"): void {
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  if (extra.length > 0) throw new ValidationError(`Unknown field${extra.length > 1 ? "s" : ""} in ${what}: ${extra.join(", ")}`);
}
