/**
 * Thin fetch helpers for the Hono API (same origin, cookie session) and for
 * presigned S3 URLs. Uploads use XMLHttpRequest because fetch exposes no
 * upload progress; a fetch fallback covers environments without XHR.
 */
import type { ApiError } from "@/shared/api";
import { ApiRequestError, AuthRequiredError, emitAuthRequired } from "./errors";

export const API_BASE = "/api";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  json?: unknown;
  signal?: AbortSignal;
  /** let the request outlive the page (pagehide flush); bodies must stay small */
  keepalive?: boolean;
}

/** JSON request against `/api`. Throws `ApiRequestError` (`AuthRequiredError` on 401). */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: string | undefined;
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    credentials: "same-origin",
    signal: options.signal,
    keepalive: options.keepalive,
  });
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function toError(res: Response): Promise<ApiRequestError> {
  let message = res.statusText || `Request failed (${res.status})`;
  let code: string | undefined;
  try {
    const parsed = (await res.json()) as Partial<ApiError> | null;
    if (parsed && typeof parsed.error === "string" && parsed.error) message = parsed.error;
    if (parsed && typeof parsed.code === "string") code = parsed.code;
  } catch {
    /* body was not JSON */
  }
  if (res.status === 401) {
    emitAuthRequired();
    return new AuthRequiredError(message);
  }
  return new ApiRequestError(message, res.status, code);
}

/** Download bytes from a presigned GET URL (no cookies are sent cross-origin). */
export async function fetchBytes(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return res.arrayBuffer();
}

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return (await res.json()) as T;
}

/**
 * PUT a blob to a presigned URL with the given Content-Type (it must match the
 * type the URL was signed for). `onProgress` receives 0–1.
 */
export function putWithProgress(
  url: string,
  body: Blob,
  contentType: string,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (typeof XMLHttpRequest === "undefined") {
    return fetch(url, { method: "PUT", body, headers: { "Content-Type": contentType }, signal }).then((res) => {
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      onProgress?.(1);
    });
  }
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Cancelled"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(Math.min(1, e.loaded / e.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status || "network error"})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.onabort = () => reject(new Error("Cancelled"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

/** Copy a Uint8Array into a standalone ArrayBuffer (decoders and Blob want one). */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

export function ensureExtension(filename: string, ext: string): string {
  const trimmed = filename.trim() || "export";
  return trimmed.toLowerCase().endsWith(ext) ? trimmed : `${trimmed}${ext}`;
}

/** MIME type for a MusicXML upload, by extension. */
export function scoreContentType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".mxl")) return "application/vnd.recordare.musicxml";
  if (lower.endsWith(".musicxml")) return "application/vnd.recordare.musicxml+xml";
  if (lower.endsWith(".xml")) return "application/xml";
  return "application/octet-stream";
}
