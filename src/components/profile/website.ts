/**
 * Profile websites are stored as full http(s) URLs (the API rejects anything
 * else). People type bare domains, so the form adds `https://` for them.
 */
const URL_RE = /^https?:\/\/[^\s]+$/i;

/** "" → "" (clear); "ensemble.org" → "https://ensemble.org"; invalid → false */
export function normalizeWebsite(input: string): string | false {
  const value = input.trim();
  if (!value) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  if (!URL_RE.test(withScheme)) return false;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return false;
  } catch {
    return false;
  }
  return withScheme;
}

/** Link target; older profiles may hold a bare domain. */
export function websiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

/** "https://www.ensemble.org/" → "www.ensemble.org" */
export function websiteLabel(website: string): string {
  return website.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
