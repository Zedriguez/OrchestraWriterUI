/**
 * Repeat expansion: written measure order → playback order. MVP rules
 * (see .claude/skills/musicxml-info-map): forward/backward repeat barlines and
 * numbered ending brackets are expanded; each repeat plays at most twice;
 * D.C./D.S./Coda jumps are not followed (the parser warns about them).
 */

export interface BarFlags {
  /** written measure number (the MusicXML number attribute) for messages */
  label: string;
  /** forward repeat on the left barline */
  forward: boolean;
  /** backward repeat on the right barline */
  backward: boolean;
  /** the backward repeat's times attribute (total passes), if given */
  times: number | null;
  /** ending numbers covering this measure (null when not inside an ending bracket) */
  ending: number[] | null;
}

export interface PlaybackOrder {
  /** written measure indices (0-based) in playback order */
  order: number[];
  warnings: string[];
}

export const MAX_REPEAT_PASSES = 2;

export function expandRepeats(bars: BarFlags[]): PlaybackOrder {
  const warnings: string[] = [];
  const linear = bars.map((_, i) => i);
  const hasRepeats = bars.some((b) => b.forward || b.backward || b.ending);
  if (!hasRepeats) return { order: linear, warnings };

  const order: number[] = [];
  const jumps = new Map<number, number>();
  const limit = bars.length * (MAX_REPEAT_PASSES + 1) + 8;
  let i = 0;
  let start = 0;
  let pass = 1;
  let jumpedBack = false;
  let usedEndings = false;

  while (i < bars.length) {
    if (order.length > limit) {
      warnings.push("Repeats could not be expanded (unbalanced repeat signs); measures play in written order.");
      return { order: linear, warnings };
    }
    const bar = bars[i];
    if (bar.forward && !jumpedBack) {
      start = i;
      pass = 1;
    }
    jumpedBack = false;
    if (bar.ending && !bar.ending.includes(pass)) {
      usedEndings = true;
      i++;
      continue;
    }
    order.push(i);
    if (bar.backward) {
      const written = bar.times ?? MAX_REPEAT_PASSES;
      if (written > MAX_REPEAT_PASSES && (jumps.get(i) ?? 0) === 0 && pass === 1) {
        warnings.push(`Measure ${bar.label}: repeat marked ${written} times; it is played twice.`);
      }
      const passes = Math.max(1, Math.min(written, MAX_REPEAT_PASSES));
      const done = jumps.get(i) ?? 0;
      if (done + 1 < passes) {
        jumps.set(i, done + 1);
        const withEndings = bars.slice(start, i + 1).some((b) => b.ending) || (i + 1 < bars.length && bars[i + 1].ending !== null);
        warnings.push(
          `Repeat expanded: measures ${bars[start].label}–${bar.label} play twice${withEndings ? " (with 1st/2nd endings)" : ""}.`,
        );
        pass += 1;
        i = start;
        jumpedBack = true;
        continue;
      }
      jumps.set(i, 0);
      start = i + 1;
      pass = 1;
    } else if (bar.ending && !(i + 1 < bars.length && bars[i + 1].ending)) {
      // leaving the last ending bracket of a repeat block
      start = i + 1;
      pass = 1;
    }
    i++;
  }

  const played = new Set(order);
  const skipped = linear.filter((w) => !played.has(w));
  if (skipped.length > 0) {
    warnings.push(
      `Measures ${rangeLabel(skipped.map((w) => bars[w].label))} are never played (ending brackets without a matching repeat).`,
    );
  } else if (usedEndings && !warnings.some((w) => w.startsWith("Repeat expanded"))) {
    warnings.push("Ending brackets without a repeat sign were ignored.");
  }
  return { order, warnings };
}

function rangeLabel(labels: string[]): string {
  if (labels.length <= 3) return labels.join(", ");
  return `${labels[0]}–${labels[labels.length - 1]}`;
}

/** "1", "1, 2", "1.", "1,2" → [1, 2]. */
export function parseEndingNumbers(raw: string | undefined): number[] {
  if (!raw) return [];
  const nums = raw
    .split(/[,\s]+/)
    .map((s) => parseInt(s.replace(/\D/g, ""), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(nums)].sort((a, b) => a - b);
}
