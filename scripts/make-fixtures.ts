/**
 * Regenerates the generated fixtures (deterministic: running it twice gives
 * byte-identical files).
 *
 *   npm run fixtures
 *
 * Writes:
 *   fixtures/scores/orchestra-demo.musicxml   14-part demo score ("Overture in D")
 *   fixtures/scores/orchestra-demo.mxl        the same score, compressed
 *   fixtures/audio/orchestra-demo.mp3         synthesized, tempo-warped demo recording (22050 Hz mono, 48 kbps)
 *   fixtures/audio/orchestra-demo.json        true measure starts in the recording (for scoring the aligner)
 *   fixtures/scores/quirks/compressed.mxl            .mxl with META-INF/container.xml pointing into a folder
 *   fixtures/scores/quirks/compressed-no-container.mxl  .mxl without container.xml
 *   fixtures/scores/quirks/utf16-bom.musicxml        UTF-16 LE with BOM
 *
 * @breezystack/lamejs (LGPL-3.0) is a devDependency used only here, to encode
 * the fixture MP3; it is never bundled into the app.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { strToU8, zipSync, type Zippable } from "fflate";
import { parseMusicXml } from "../src/shared/score";
import { buildDemoScore } from "./lib/demo-score";
import { renderDemoRecording } from "./lib/demo-audio";
import { writeMusicXml } from "./lib/musicxml-writer";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = (rel: string) => resolve(root, rel);

/** Fixed local-time mtime so zip bytes don't depend on the clock or time zone. */
const ZIP_MTIME = new Date(2026, 0, 1, 0, 0, 0);

function write(rel: string, data: string | Uint8Array) {
  mkdirSync(dirname(out(rel)), { recursive: true });
  writeFileSync(out(rel), data);
  const size = typeof data === "string" ? Buffer.byteLength(data) : data.length;
  console.log(`  ${rel}  ${(size / 1024).toFixed(1)} KB`);
}

function mxl(entries: Array<[string, Uint8Array]>, container: string | null): Uint8Array {
  const files: Zippable = {};
  // mimetype first and stored, as the MusicXML spec recommends
  files["mimetype"] = [strToU8("application/vnd.recordare.musicxml"), { level: 0 }];
  if (container) {
    files["META-INF/container.xml"] = strToU8(
      `<?xml version="1.0" encoding="UTF-8"?>\n<container>\n  <rootfiles>\n    <rootfile full-path="${container}" media-type="application/vnd.recordare.musicxml+xml"/>\n  </rootfiles>\n</container>\n`,
    );
  }
  for (const [name, bytes] of entries) files[name] = bytes;
  return zipSync(files, { level: 9, mtime: ZIP_MTIME });
}

async function encodeMp3(samples: Float32Array, sampleRate: number, kbps: number): Promise<Uint8Array> {
  // dynamic import: the package's CommonJS entry is an IIFE without exports, the ESM entry works
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
  const chunks: Uint8Array[] = [];
  const block = 1152;
  for (let i = 0; i < pcm.length; i += block) {
    const buf = encoder.encodeBuffer(pcm.subarray(i, i + block));
    if (buf.length > 0) chunks.push(new Uint8Array(buf));
  }
  const end = encoder.flush();
  if (end.length > 0) chunks.push(new Uint8Array(end));
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const mp3 = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    mp3.set(c, o);
    o += c.length;
  }
  return mp3;
}

async function main() {
  console.log("Demo score");
  const xml = writeMusicXml(buildDemoScore());
  write("fixtures/scores/orchestra-demo.musicxml", xml);
  write("fixtures/scores/orchestra-demo.mxl", mxl([["orchestra-demo.musicxml", strToU8(xml)]], "orchestra-demo.musicxml"));

  const parsed = parseMusicXml({ bytes: strToU8(xml), filename: "orchestra-demo.musicxml" });
  if (!parsed.ok) throw new Error(`demo score does not parse: ${parsed.error}`);
  const { infoMap, meta } = parsed;
  console.log(`  ${meta.title} — ${meta.movement} (${meta.composer}): ${meta.parts} parts, ${meta.measures} measures, ${meta.durationSec.toFixed(2)} s score time`);
  for (const w of meta.warnings) console.log(`  warning: ${w}`);

  console.log("Demo recording");
  const rec = renderDemoRecording(infoMap);
  const mp3 = await encodeMp3(rec.samples, rec.sampleRate, 48);
  if (mp3.length > 1024 * 1024) throw new Error(`demo MP3 is ${mp3.length} bytes; keep it under 1 MB`);
  write("fixtures/audio/orchestra-demo.mp3", mp3);
  write("fixtures/audio/orchestra-demo.json", JSON.stringify(rec.truth, null, 2) + "\n");
  console.log(`  ${rec.truth.durationSec.toFixed(2)} s recording time`);

  console.log("Quirk fixtures");
  const small = readFileSync(out("fixtures/scores/quirks/divisions-change.musicxml"));
  write(
    "fixtures/scores/quirks/compressed.mxl",
    mxl(
      [
        ["aaa-decoy.xml", strToU8('<?xml version="1.0"?><not-the-score/>')],
        ["score/divisions-change.musicxml", new Uint8Array(small)],
      ],
      "score/divisions-change.musicxml",
    ),
  );
  write("fixtures/scores/quirks/compressed-no-container.mxl", mxl([["divisions-change.musicxml", new Uint8Array(small)]], null));

  const utf16Source = readFileSync(out("fixtures/scores/quirks/timewise-as-partwise.musicxml"), "utf8")
    .replace('encoding="UTF-8"', 'encoding="UTF-16"')
    .replace("<part-name>Cello</part-name>", "<part-name>Violoncelle — solo</part-name>");
  const body = Buffer.from(utf16Source, "utf16le");
  write("fixtures/scores/quirks/utf16-bom.musicxml", new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xfe]), body])));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
