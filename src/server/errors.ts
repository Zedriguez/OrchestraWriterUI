// Typed errors thrown by services and routes. One handler (routes/errors.ts)
// turns them into `{ error, code }` responses; nothing else builds error bodies.

export class AppError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 503,
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400: the request body or parameters are malformed. */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, "invalid");
  }
}

/** 404: the record does not exist or is not visible to this user (never 403; that would confirm the id). */
export class NotFoundError extends AppError {
  constructor(what = "Resource") {
    super(404, `${what} not found`, "not_found");
  }
}

/** 403: an object key outside the caller's upload prefix. The one place 403 is used. */
export class ForbiddenKeyError extends AppError {
  constructor() {
    super(403, "That object key does not belong to this project", "forbidden_key");
  }
}

/** 409: unique constraint or state conflict. */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, "conflict");
  }
}

/** 413: an uploaded object is larger than the kind allows. */
export class TooLargeError extends AppError {
  constructor(message: string) {
    super(413, message, "too_large");
  }
}

/** 503: Postgres could not be reached (docker compose down, Aurora resuming). */
export class DatabaseUnreachableError extends AppError {
  constructor() {
    super(503, "Database unreachable", "db_unreachable");
  }
}

/** 503: S3_AUDIO_BUCKET is not configured on this server. */
export class StorageNotConfiguredError extends AppError {
  constructor() {
    super(503, "File storage is not configured on this server", "storage_unconfigured");
  }
}
