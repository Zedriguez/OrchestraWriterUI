import { XMLParser, XMLValidator } from "fast-xml-parser";

/**
 * Minimal ordered element tree over fast-xml-parser's preserveOrder output.
 * Order matters inside <measure> (attributes, notes, backup/forward and
 * directions are walked in document order), so we never use the unordered
 * object form.
 */
export interface XEl {
  tag: string;
  attrs: Record<string, string>;
  children: XEl[];
  /** concatenated, trimmed text content of this element (not descendants) */
  text: string;
}

type OrderedNode = Record<string, unknown> & { ":@"?: Record<string, string> };

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  // decodes numeric character references (&#x266D; → ♭); XML's five named entities stay as usual
  htmlEntities: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

export type XmlOutcome = { ok: true; root: XEl } | { ok: false; error: string };

/** Parse XML text into an ordered tree. Returns the document element. */
export function parseXml(text: string): XmlOutcome {
  const trimmed = text.replace(/^﻿/, "").trimStart();
  if (!trimmed.startsWith("<")) return { ok: false, error: "The file is not XML." };
  const valid = XMLValidator.validate(trimmed);
  if (valid !== true) {
    const { msg, line } = valid.err;
    const unclosed = msg.match(/^Invalid '\[([\s\S]*)\]' found/);
    if (unclosed) {
      const tags = unclosed[1].match(/"([^"]+)"/g)?.map((t) => t.slice(1, -1)) ?? [];
      const last = tags[tags.length - 1];
      return { ok: false, error: `The file ends early: <${last ?? "?"}> and ${Math.max(0, tags.length - 1)} enclosing element(s) are never closed. It may be cut off.` };
    }
    return { ok: false, error: `The file is not well-formed XML (line ${line}: ${msg})` };
  }
  let nodes: OrderedNode[];
  try {
    nodes = parser.parse(trimmed) as OrderedNode[];
  } catch (e) {
    return { ok: false, error: `The file is not well-formed XML (${e instanceof Error ? e.message : String(e)})` };
  }
  const elements = convert(nodes);
  const root = elements.find((el) => !el.tag.startsWith("!"));
  if (!root) return { ok: false, error: "The file is empty or has no XML elements." };
  return { ok: true, root };
}

function convert(nodes: OrderedNode[]): XEl[] {
  const out: XEl[] = [];
  for (const node of nodes) {
    for (const key of Object.keys(node)) {
      if (key === ":@" || key === "#text") continue;
      const raw = node[key];
      const kids = Array.isArray(raw) ? (raw as OrderedNode[]) : [];
      const attrs = node[":@"] ?? {};
      let text = "";
      for (const k of kids) if (typeof k["#text"] === "string" || typeof k["#text"] === "number") text += String(k["#text"]);
      out.push({ tag: key, attrs, children: convert(kids), text: text.trim() });
    }
  }
  return out;
}

export function child(el: XEl | undefined, tag: string): XEl | undefined {
  if (!el) return undefined;
  for (const c of el.children) if (c.tag === tag) return c;
  return undefined;
}

export function childrenOf(el: XEl | undefined, tag: string): XEl[] {
  if (!el) return [];
  return el.children.filter((c) => c.tag === tag);
}

/** Text of a direct child, or "" when absent. */
export function childText(el: XEl | undefined, tag: string): string {
  return child(el, tag)?.text ?? "";
}

/** Path lookup: path(el, "pitch", "step"). */
export function path(el: XEl | undefined, ...tags: string[]): XEl | undefined {
  let cur = el;
  for (const t of tags) cur = child(cur, t);
  return cur;
}

export function num(text: string | undefined): number | null {
  if (text == null || text === "") return null;
  const v = Number(text);
  return Number.isFinite(v) ? v : null;
}
