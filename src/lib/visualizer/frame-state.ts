import { BRIGHTNESS_LADDER, type Dynamic } from "@/shared/dynamics";
import type { InfoMap } from "@/shared/info-map";
import { activitySegments, segmentAt, type ActivitySegment } from "@/lib/score/segments";

export interface PartFrame {
  id: string;
  playing: boolean;
  dynamic: Dynamic;
  /** rendered brightness 0–1 after the fade envelope */
  level: number;
}

export interface FrameState {
  time: number;
  measure: number;
  parts: PartFrame[];
}

export interface FrameEngineOptions {
  /** ms */
  attack?: number;
  /** ms */
  release?: number;
}

/**
 * Turns an info map plus a clock into per-part frame state. Keeps the fade
 * envelope between frames; reduced motion makes the envelope instant.
 */
export class FrameEngine {
  private segments = new Map<string, ActivitySegment[]>();
  private levels = new Map<string, number>();
  private lastDynamic = new Map<string, Dynamic>();
  private attack: number;
  private release: number;

  constructor(private infoMap: InfoMap, options: FrameEngineOptions = {}) {
    this.attack = options.attack ?? 120;
    this.release = options.release ?? 240;
    for (const inst of infoMap.instruments) {
      this.segments.set(inst.id, activitySegments(inst));
      this.levels.set(inst.id, 0);
      this.lastDynamic.set(inst.id, "mp");
    }
  }

  setInfoMap(infoMap: InfoMap) {
    this.infoMap = infoMap;
    this.segments.clear();
    for (const inst of infoMap.instruments) {
      this.segments.set(inst.id, activitySegments(inst));
      if (!this.levels.has(inst.id)) this.levels.set(inst.id, 0);
      if (!this.lastDynamic.has(inst.id)) this.lastDynamic.set(inst.id, "mp");
    }
  }

  measureAt(time: number): number {
    const ms = this.infoMap.measures;
    let lo = 0;
    let hi = ms.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ms[mid].startTime <= time) lo = mid;
      else hi = mid - 1;
    }
    return ms[lo]?.number ?? 1;
  }

  /** @param dtMs time since the previous frame; @param instant skip fades */
  compute(time: number, dtMs: number, instant: boolean): FrameState {
    const parts: PartFrame[] = [];
    for (const inst of this.infoMap.instruments) {
      const seg = segmentAt(this.segments.get(inst.id) ?? [], time);
      const playing = seg !== null;
      const dynamic = seg?.dynamic ?? this.lastDynamic.get(inst.id) ?? "mp";
      if (seg) this.lastDynamic.set(inst.id, seg.dynamic);
      const target = playing ? BRIGHTNESS_LADDER[dynamic] : 0;
      const prev = this.levels.get(inst.id) ?? 0;
      let level: number;
      if (instant || dtMs > 500) {
        level = target;
      } else {
        const tau = target > prev ? this.attack : this.release;
        const k = 1 - Math.exp(-dtMs / tau);
        level = prev + (target - prev) * k;
        if (Math.abs(level - target) < 0.004) level = target;
      }
      this.levels.set(inst.id, level);
      parts.push({ id: inst.id, playing, dynamic, level });
    }
    return { time, measure: this.measureAt(time), parts };
  }
}
