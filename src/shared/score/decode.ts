import { strFromU8, unzipSync } from "fflate";

/**
 * Bytes → MusicXML text. Handles plain .musicxml/.xml (UTF-8, UTF-16 with or
 * without BOM, legacy encodings named in the XML declaration) and compressed
 * .mxl (zip; rootfile from META-INF/container.xml, else the first score entry).
 * Isomorphic: TextDecoder + fflate only.
 */

export type DecodeOutcome = { ok: true; text: string; compressed: boolean } | { ok: false; error: string };

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && ZIP_MAGIC.every((b, i) => bytes[i] === b);
}

export function decodeScoreBytes(bytes: Uint8Array, filename: string): DecodeOutcome {
  if (bytes.length === 0) return { ok: false, error: `${filename || "The score file"} is empty.` };
  if (isZip(bytes)) return decodeMxl(bytes, filename);
  if (/\.mxl$/i.test(filename)) {
    return { ok: false, error: `${filename} is not a valid compressed MusicXML (.mxl) file: it is not a zip archive.` };
  }
  return { ok: true, text: decodeXmlText(bytes), compressed: false };
}

/** Decode XML text honoring a BOM, UTF-16 without BOM, and the declared encoding. */
export function decodeXmlText(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(bytes.subarray(3));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  // UTF-16 without BOM: "<" encoded as 3C 00 (LE) or 00 3C (BE)
  if (bytes[0] === 0x3c && bytes[1] === 0x00) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0x00 && bytes[1] === 0x3c) return new TextDecoder("utf-16be").decode(bytes);

  // Look for encoding="..." in the XML declaration (ASCII-compatible encodings).
  const head = String.fromCharCode(...bytes.subarray(0, Math.min(bytes.length, 200)));
  const declared = head.match(/^\s*<\?xml[^>]*encoding\s*=\s*["']([A-Za-z0-9._-]+)["']/)?.[1]?.toLowerCase();
  if (declared && declared !== "utf-8" && declared !== "utf8") {
    try {
      return new TextDecoder(declared).decode(bytes);
    } catch {
      // unknown label → fall through to UTF-8
    }
  }
  return new TextDecoder("utf-8").decode(bytes);
}

/** Largest uncompressed score entry we inflate (a 50 MB .mxl rarely expands past 10×). */
export const MAX_MXL_ENTRY_BYTES = 400 * 1024 * 1024;
const MAX_CONTAINER_BYTES = 1024 * 1024;

/**
 * Inflate only the entries we need: the container manifest (small) and the one
 * root score file, each capped by its declared size, so a zip bomb never
 * expands in memory.
 */
function decodeMxl(bytes: Uint8Array, filename: string): DecodeOutcome {
  const names: string[] = [];
  const sizes = new Map<string, number>();
  let container: Uint8Array | undefined;
  try {
    const first = unzipSync(bytes, {
      filter: (f) => {
        names.push(f.name);
        sizes.set(f.name, f.originalSize);
        return f.name === "META-INF/container.xml" && f.originalSize <= MAX_CONTAINER_BYTES;
      },
    });
    container = first["META-INF/container.xml"];
  } catch {
    return { ok: false, error: `${filename} could not be unzipped. The compressed MusicXML (.mxl) file may be damaged.` };
  }
  names.sort();
  let rootPath: string | null = null;
  if (container) {
    const xml = strFromU8(container);
    const m = xml.match(/<rootfile\b[^>]*\bfull-path\s*=\s*["']([^"']+)["']/);
    if (m && sizes.has(m[1])) rootPath = m[1];
  }
  if (!rootPath) {
    rootPath = names.find((n) => !n.startsWith("META-INF/") && /\.(musicxml|xml)$/i.test(n) && !n.endsWith("/")) ?? null;
  }
  if (!rootPath) return { ok: false, error: `${filename} does not contain a MusicXML score.` };
  const declared = sizes.get(rootPath) ?? 0;
  if (declared > MAX_MXL_ENTRY_BYTES) {
    return { ok: false, error: `${filename}: the score inside the archive is ${(declared / 1e6).toFixed(0)} MB; the limit is ${MAX_MXL_ENTRY_BYTES / 1e6} MB.` };
  }
  let entry: Uint8Array | undefined;
  try {
    entry = unzipSync(bytes, { filter: (f) => f.name === rootPath })[rootPath];
  } catch {
    return { ok: false, error: `${filename} could not be unzipped. The compressed MusicXML (.mxl) file may be damaged.` };
  }
  if (!entry || entry.length === 0) return { ok: false, error: `${filename}: the score inside the archive is empty.` };
  if (entry.length > MAX_MXL_ENTRY_BYTES) return { ok: false, error: `${filename}: the score inside the archive is too large.` };
  return { ok: true, text: decodeXmlText(entry), compressed: true };
}
