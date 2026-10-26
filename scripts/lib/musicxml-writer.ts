/**
 * Tiny MusicXML 4.0 partwise writer for generated fixtures. Pitches in the
 * model are SOUNDING MIDI numbers; parts with `transposeChromatic` are written
 * transposed (written = sounding - transposeChromatic), like a real score.
 */

export const DIVISIONS = 4; // per quarter note → 16th-note grid

export type Articulation = "staccato" | "accent" | "strong-accent" | "tenuto";

export interface WEvent {
  /** 16ths from the start of the measure */
  offset: number;
  /** 16ths */
  dur: number;
  /** sounding MIDI pitches; empty = rest */
  pitches: number[];
  voice: 1 | 2;
  /** staff number for multi-staff parts */
  staff?: 1 | 2;
  tieStart?: boolean;
  tieStop?: boolean;
  articulation?: Articulation;
  slur?: "start" | "stop";
  tremolo?: boolean;
}

export interface WDirection {
  /** 16ths from the start of the measure */
  offset: number;
  dynamic?: string;
  words?: string;
  tempo?: number;
  pizzicato?: boolean;
}

export interface WMeasure {
  events: WEvent[];
  directions: WDirection[];
  forwardRepeat?: boolean;
  backwardRepeat?: boolean;
  finalBarline?: boolean;
  /** whole-measure rest in every voice */
  rest?: boolean;
}

export interface WPart {
  id: string;
  name: string;
  abbreviation?: string;
  instrumentSound: string;
  midiProgram: number;
  midiChannel: number;
  clef: "treble" | "bass" | "alto";
  /** second staff clef for two-staff parts */
  clef2?: "treble" | "bass";
  /** sounding = written + transposeChromatic (B♭ clarinet: -2) */
  transposeChromatic?: number;
  transposeDiatonic?: number;
  measures: WMeasure[];
}

export interface WScore {
  title: string;
  movement: string;
  composer: string;
  /** key signature (concert), fifths */
  fifths: number;
  beats: number;
  beatType: number;
  parts: WPart[];
}

const SHARP_SPELLING: Array<[string, number]> = [
  ["C", 0], ["C", 1], ["D", 0], ["D", 1], ["E", 0], ["F", 0], ["F", 1], ["G", 0], ["G", 1], ["A", 0], ["A", 1], ["B", 0],
];

const TYPES: Array<[number, string, number]> = [
  [16, "whole", 0],
  [12, "half", 1],
  [8, "half", 0],
  [6, "quarter", 1],
  [4, "quarter", 0],
  [3, "eighth", 1],
  [2, "eighth", 0],
  [1, "16th", 0],
];

function typeOf(dur: number): [string, number] {
  const t = TYPES.find(([d]) => d === dur);
  if (!t) throw new Error(`no note type for ${dur} sixteenths`);
  return [t[1], t[2]];
}

/** Split a gap into notatable rest values. */
function restValues(gap: number): number[] {
  const out: number[] = [];
  let left = gap;
  while (left > 0) {
    const v = TYPES.find(([d]) => d <= left)![0];
    out.push(v);
    left -= v;
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function pitchXml(midi: number): string {
  const [step, alter] = SHARP_SPELLING[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${octave}</octave></pitch>`;
}

function clefXml(clef: "treble" | "bass" | "alto", number?: number): string {
  const n = number ? ` number="${number}"` : "";
  if (clef === "treble") return `<clef${n}><sign>G</sign><line>2</line></clef>`;
  if (clef === "bass") return `<clef${n}><sign>F</sign><line>4</line></clef>`;
  return `<clef${n}><sign>C</sign><line>3</line></clef>`;
}

export function writeMusicXml(score: WScore): string {
  const measureLen = (score.beats * 16) / score.beatType;
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  lines.push('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">');
  lines.push('<score-partwise version="4.0">');
  lines.push(`  <work><work-title>${esc(score.title)}</work-title></work>`);
  lines.push(`  <movement-title>${esc(score.movement)}</movement-title>`);
  lines.push("  <identification>");
  lines.push(`    <creator type="composer">${esc(score.composer)}</creator>`);
  lines.push("    <encoding><software>scripts/make-fixtures.ts (Orchestra Visualizer)</software></encoding>");
  lines.push("  </identification>");
  lines.push("  <part-list>");
  for (const p of score.parts) {
    lines.push(`    <score-part id="${p.id}">`);
    lines.push(`      <part-name>${esc(p.name)}</part-name>`);
    if (p.abbreviation) lines.push(`      <part-abbreviation>${esc(p.abbreviation)}</part-abbreviation>`);
    lines.push(`      <score-instrument id="${p.id}-I1"><instrument-name>${esc(p.name)}</instrument-name><instrument-sound>${p.instrumentSound}</instrument-sound></score-instrument>`);
    lines.push(`      <midi-instrument id="${p.id}-I1"><midi-channel>${p.midiChannel}</midi-channel><midi-program>${p.midiProgram}</midi-program></midi-instrument>`);
    lines.push("    </score-part>");
  }
  lines.push("  </part-list>");

  for (const p of score.parts) {
    const t = p.transposeChromatic ?? 0;
    const written = (midi: number) => midi - t;
    const twoStaves = !!p.clef2;
    lines.push(`  <part id="${p.id}">`);
    p.measures.forEach((m, idx) => {
      lines.push(`    <measure number="${idx + 1}">`);
      if (m.forwardRepeat) lines.push('      <barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>');
      if (idx === 0) {
        const keyFifths = t !== 0 ? score.fifths + transposeFifths(t) : score.fifths;
        lines.push("      <attributes>");
        lines.push(`        <divisions>${DIVISIONS}</divisions>`);
        lines.push(`        <key><fifths>${keyFifths}</fifths></key>`);
        lines.push(`        <time><beats>${score.beats}</beats><beat-type>${score.beatType}</beat-type></time>`);
        if (twoStaves) lines.push("        <staves>2</staves>");
        lines.push(`        ${clefXml(p.clef, twoStaves ? 1 : undefined)}`);
        if (p.clef2) lines.push(`        ${clefXml(p.clef2, 2)}`);
        if (t !== 0) lines.push(`        <transpose><diatonic>${p.transposeDiatonic ?? 0}</diatonic><chromatic>${t}</chromatic></transpose>`);
        lines.push("      </attributes>");
      }

      const voices: Array<1 | 2> = [1, 2];
      const dirs = [...m.directions].sort((a, b) => a.offset - b.offset);
      let dirIdx = 0;
      const emitDirectionsUpTo = (offset: number) => {
        while (dirIdx < dirs.length && dirs[dirIdx].offset <= offset) {
          lines.push(`      ${directionXml(dirs[dirIdx])}`);
          dirIdx++;
        }
      };

      if (m.rest || m.events.length === 0) {
        emitDirectionsUpTo(Infinity);
        lines.push(`      <note><rest measure="yes"/><duration>${measureLen * (DIVISIONS / 4)}</duration><voice>1</voice>${twoStaves ? "<staff>1</staff>" : ""}</note>`);
      } else {
        let wroteVoice = false;
        for (const v of voices) {
          const evs = m.events.filter((e) => e.voice === v).sort((a, b) => a.offset - b.offset);
          if (evs.length === 0) continue;
          if (wroteVoice) lines.push(`      <backup><duration>${measureLen * (DIVISIONS / 4)}</duration></backup>`);
          wroteVoice = true;
          let cursor = 0;
          const staff = evs[0].staff;
          const staffXml = twoStaves ? `<staff>${staff ?? v}</staff>` : "";
          for (const e of evs) {
            if (e.offset > cursor) {
              for (const r of restValues(e.offset - cursor)) {
                if (v === 1) emitDirectionsUpTo(cursor);
                const [type, dots] = typeOf(r);
                lines.push(`      <note><rest/><duration>${r * (DIVISIONS / 4)}</duration><voice>${v}</voice><type>${type}</type>${"<dot/>".repeat(dots)}${staffXml}</note>`);
                cursor += r;
              }
            }
            if (v === 1) emitDirectionsUpTo(e.offset);
            const [type, dots] = typeOf(e.dur);
            const pitches = e.pitches.length > 0 ? e.pitches : [];
            if (pitches.length === 0) {
              lines.push(`      <note><rest/><duration>${e.dur * (DIVISIONS / 4)}</duration><voice>${v}</voice><type>${type}</type>${"<dot/>".repeat(dots)}${staffXml}</note>`);
            }
            pitches.forEach((pitch, k) => {
              const parts: string[] = ["<note>"];
              if (k > 0) parts.push("<chord/>");
              parts.push(pitchXml(written(pitch)));
              parts.push(`<duration>${e.dur * (DIVISIONS / 4)}</duration>`);
              if (e.tieStop) parts.push('<tie type="stop"/>');
              if (e.tieStart) parts.push('<tie type="start"/>');
              parts.push(`<voice>${v}</voice><type>${type}</type>${"<dot/>".repeat(dots)}`);
              if (twoStaves) parts.push(`<staff>${e.staff ?? v}</staff>`);
              const notations: string[] = [];
              if (e.tieStop) notations.push('<tied type="stop"/>');
              if (e.tieStart) notations.push('<tied type="start"/>');
              if (k === 0 && e.slur) notations.push(`<slur type="${e.slur}" number="1"/>`);
              if (k === 0 && e.tremolo) notations.push('<ornaments><tremolo type="single">3</tremolo></ornaments>');
              if (k === 0 && e.articulation) notations.push(`<articulations><${e.articulation}/></articulations>`);
              if (notations.length > 0) parts.push(`<notations>${notations.join("")}</notations>`);
              parts.push("</note>");
              lines.push(`      ${parts.join("")}`);
            });
            cursor = e.offset + e.dur;
          }
          if (cursor < measureLen) {
            for (const r of restValues(measureLen - cursor)) {
              const [type, dots] = typeOf(r);
              lines.push(`      <note><rest/><duration>${r * (DIVISIONS / 4)}</duration><voice>${v}</voice><type>${type}</type>${"<dot/>".repeat(dots)}${staffXml}</note>`);
            }
          }
        }
        emitDirectionsUpTo(Infinity);
      }

      if (m.backwardRepeat) lines.push('      <barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>');
      else if (m.finalBarline) lines.push('      <barline location="right"><bar-style>light-heavy</bar-style></barline>');
      lines.push("    </measure>");
    });
    lines.push("  </part>");
  }
  lines.push("</score-partwise>");
  return lines.join("\n") + "\n";
}

/** Key change for a transposing part: written key = concert key + this many fifths. */
function transposeFifths(chromatic: number): number {
  // -2 (B♭ instruments) → +2 sharps; -9 (A instruments) → +3; -7 (F horn) → +1
  const table: Record<number, number> = { [-2]: 2, [-3]: -3, [-7]: 1, [-9]: 3, [-14]: 2, [2]: -2 };
  return table[chromatic] ?? 0;
}

function directionXml(d: WDirection): string {
  const types: string[] = [];
  if (d.words) types.push(`<direction-type><words>${esc(d.words)}</words></direction-type>`);
  if (d.tempo) types.push(`<direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${d.tempo}</per-minute></metronome></direction-type>`);
  if (d.dynamic) types.push(`<direction-type><dynamics><${d.dynamic}/></dynamics></direction-type>`);
  const soundAttrs: string[] = [];
  if (d.tempo) soundAttrs.push(`tempo="${d.tempo}"`);
  if (d.pizzicato !== undefined) soundAttrs.push(`pizzicato="${d.pizzicato ? "yes" : "no"}"`);
  const sound = soundAttrs.length > 0 ? `<sound ${soundAttrs.join(" ")}/>` : "";
  const placement = d.dynamic && !d.words && !d.tempo ? "below" : "above";
  return `<direction placement="${placement}">${types.join("")}${sound}</direction>`;
}
