/**
 * Where to go after signing in or up. The proxy sends signed-out visitors to
 * `/sign-in?next=<path>`; only same-origin paths are honored, so a crafted
 * link cannot bounce a fresh session to another site.
 */
export function safeNext(value: string | string[] | undefined | null): string | null {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  // the auth pages themselves would just redirect again
  if (/^\/sign-(in|up)(\/|\?|$)/.test(next)) return null;
  return next;
}

export const AFTER_AUTH = "/library";

/** `/sign-in` or `/sign-up`, keeping `next` when there is one. */
export function authHref(page: "/sign-in" | "/sign-up", next: string | null): string {
  return next ? `${page}?next=${encodeURIComponent(next)}` : page;
}
