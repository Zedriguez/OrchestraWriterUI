// The one place errors become HTTP responses. Mounted as the root app's
// onError and notFound in app.ts; sub-apps do not define their own.
// Bodies are always { error, code }. Unexpected errors are logged with their
// detail and answered with a generic 500; nothing internal reaches the client.
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiError } from "@/shared/api";
import { isConnectionError } from "../db/client";
import { AppError } from "../errors";

export function errorBody(error: string, code: string): ApiError {
  return { error, code };
}

export function handleError(err: unknown, c: Context): Response {
  if (err instanceof AppError) {
    if (err.status >= 500) console.error(`${c.req.method} ${c.req.path}: ${err.message}`);
    return c.json(errorBody(err.message, err.code), err.status as ContentfulStatusCode);
  }
  // Thrown by Hono middleware (csrf: 403 for a cross-origin form-style request).
  if (err instanceof HTTPException) {
    const status = err.status as ContentfulStatusCode;
    if (status === 403) return c.json(errorBody("Request origin not allowed", "forbidden_origin"), 403);
    return c.json(errorBody(err.message || "Request rejected", status >= 500 ? "internal" : "invalid"), status);
  }
  if (isConnectionError(err)) {
    console.error(`${c.req.method} ${c.req.path}: database unreachable`, err);
    return c.json(errorBody("Database unreachable", "db_unreachable"), 503);
  }
  console.error(`${c.req.method} ${c.req.path} failed`, err);
  return c.json(errorBody("Internal error", "internal"), 500);
}

export function handleNotFound(c: Context): Response {
  return c.json(errorBody("Not found", "not_found"), 404);
}
