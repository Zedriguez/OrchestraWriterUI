import { DYNAMIC_INDEX, DYNAMICS, type Dynamic } from "@/shared/dynamics";
import type { InfoMap, Instrument } from "@/shared/info-map";

/**
 * Activity helpers over the info map (score time). The renderer asks "is this
 * part playing at t, and at which written dynamic?" every frame, so notes are
 * folded into sorted, non-overlapping segments once and searched by bisection.
 */

/** A stretch of score time in which a part plays at one written dynamic. */
export interface ActivitySegment {
  /** seconds, score time */
  start: number;
  /** seconds, score time (exclusive) */
  end: number;
  dynamic: Dynamic;
}

/**
 * Fold a part's notes into sorted, non-overlapping segments. Overlapping
 * voices take the louder written dynamic. Gaps up to `gap` seconds between
 * segments with the same dynamic are bridged so short rests between notes
 * don't flicker. Zero-length (grace) notes don't create activity.
 */
export function activitySegments(inst: Instrument, gap = 0.12): ActivitySegment[] {
  type Edge = { t: number; delta: 1 | -1; level: number };
  const edges: Edge[] = [];
  for (const n of inst.notes) {
    if (!(n.duration > 0)) continue;
    const level = DYNAMIC_INDEX[n.dynamics];
    edges.push({ t: n.time, delta: 1, level }, { t: n.time + n.duration, delta: -1, level });
  }
  if (edges.length === 0) return [];
  // at equal times process note-offs first so back-to-back notes split cleanly
  edges.sort((a, b) => a.t - b.t || a.delta - b.delta);

  const active = new Array<number>(DYNAMICS.length).fill(0);
  const raw: ActivitySegment[] = [];
  let curLevel = -1;
  let curStart = 0;
  for (let i = 0; i < edges.length; ) {
    const t = edges[i].t;
    while (i < edges.length && edges[i].t === t) {
      active[edges[i].level] += edges[i].delta;
      i++;
    }
    let level = -1;
    for (let l = active.length - 1; l >= 0; l--) {
      if (active[l] > 0) {
        level = l;
        break;
      }
    }
    if (level !== curLevel) {
      if (curLevel >= 0 && t > curStart) raw.push({ start: curStart, end: t, dynamic: DYNAMICS[curLevel] });
      curLevel = level;
      curStart = t;
    }
  }

  const segs: ActivitySegment[] = [];
  for (const s of raw) {
    const last = segs[segs.length - 1];
    if (last && last.dynamic === s.dynamic && s.start - last.end <= gap) last.end = s.end;
    else segs.push({ ...s });
  }
  return segs;
}

/** Binary search for the active segment at time t (segments sorted, non-overlapping). */
export function segmentAt(segs: ActivitySegment[], t: number): ActivitySegment | null {
  let lo = 0;
  let hi = segs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = segs[mid];
    if (t < s.start) hi = mid - 1;
    else if (t >= s.end) lo = mid + 1;
    else return s;
  }
  return null;
}

/**
 * Per-measure, per-part dynamic summary (for score strips and cards): the
 * loudest written dynamic among the notes that start in that measure, or null
 * when the part has no note starting there.
 */
export function measureDynamic(inst: Instrument, measure: number): Dynamic | null {
  const notes = inst.notes;
  // notes are sorted by time, so measure numbers ascend: find the first note of the measure
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].measure < measure) lo = mid + 1;
    else hi = mid;
  }
  let best: Dynamic | null = null;
  for (let i = lo; i < notes.length && notes[i].measure === measure; i++) {
    if (best === null || DYNAMIC_INDEX[notes[i].dynamics] > DYNAMIC_INDEX[best]) best = notes[i].dynamics;
  }
  return best;
}

const segmentCache = new WeakMap<Instrument, ActivitySegment[]>();

/** Cached activitySegments(inst) with the default gap. */
export function cachedSegments(inst: Instrument): ActivitySegment[] {
  let segs = segmentCache.get(inst);
  if (!segs) {
    segs = activitySegments(inst);
    segmentCache.set(inst, segs);
  }
  return segs;
}

/** Parts sounding at score time t, in info-map order, with their written dynamic. */
export function partsPlayingAt(infoMap: InfoMap, t: number): Array<{ id: string; dynamic: Dynamic }> {
  const out: Array<{ id: string; dynamic: Dynamic }> = [];
  for (const inst of infoMap.instruments) {
    const seg = segmentAt(cachedSegments(inst), t);
    if (seg) out.push({ id: inst.id, dynamic: seg.dynamic });
  }
  return out;
}
