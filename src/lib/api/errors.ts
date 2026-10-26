/**
 * Errors thrown by the HTTP client. Every non-2xx response from our routes
 * carries `{ error, code? }`; the message is surfaced as-is so pages can show
 * it. A 401 becomes `AuthRequiredError` and also notifies the session store
 * through `onAuthRequired` so a stale session flips to signed-out anywhere.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export class AuthRequiredError extends ApiRequestError {
  constructor(message = "Not signed in") {
    super(message, 401);
    this.name = "AuthRequiredError";
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to 401 responses. Returns an unsubscribe function. */
export function onAuthRequired(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function emitAuthRequired(): void {
  listeners.forEach((l) => l());
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ApiRequestError && err.status === 404;
}

export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}
