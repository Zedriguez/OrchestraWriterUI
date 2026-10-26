import type { ParseInput, ParseOutcome } from "./index";

/** Placeholder until the score engine lands (workstream WS2). */
export function parseMusicXml(_input: ParseInput): ParseOutcome {
  return { ok: false, error: "MusicXML parser not implemented yet" };
}
