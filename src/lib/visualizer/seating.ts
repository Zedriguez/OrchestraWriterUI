import type { Instrument } from "@/shared/info-map";
import { SECTION_ORDER, type Section } from "@/shared/sections";
import type { PartPosition } from "@/shared/project-file";

/**
 * Default labeled orchestra seating plan, normalized to a 0–1 stage.
 * Conductor at bottom center. Strings front, woodwinds behind, brass behind
 * them, percussion at the back. Positions are user-editable afterwards.
 */
export const CONDUCTOR: PartPosition = { x: 0.5, y: 0.93 };

/** Arc radius (fraction of stage width) per section, measured from the conductor. */
const ARC_RADIUS: Record<Section, number> = {
  Strings: 0.3,
  Woodwinds: 0.46,
  Brass: 0.58,
  Percussion: 0.72,
  Other: 0.66,
};

/** Angular span in radians (0 = straight up) per section. */
const ARC_SPAN: Record<Section, [number, number]> = {
  Strings: [-1.25, 1.25],
  Woodwinds: [-0.42, 0.42],
  Brass: [-0.95, 0.95],
  Percussion: [-1.25, 1.25],
  Other: [-1.4, -0.9],
};

const STAGE_ASPECT = 16 / 9;

export function polarToStage(radius: number, angle: number): PartPosition {
  const x = CONDUCTOR.x + Math.sin(angle) * radius;
  const y = CONDUCTOR.y - Math.cos(angle) * radius * STAGE_ASPECT * 0.78;
  return { x: clamp01(x), y: clamp01(y) };
}

/** Tangent angle of the arc at a given angle, for elongating glows along the arc. */
export function arcTangent(angle: number): number {
  return angle;
}

/** Fixed seats for the classic string layout; everyone else spreads along its arc. */
const STRING_SEATS: Array<[RegExp, number, number]> = [
  [/^violin i$/i, -0.95, 0.3],
  [/^violin ii$/i, -0.45, 0.33],
  [/^viola$/i, 0.4, 0.33],
  [/^cello|^violoncello/i, 0.9, 0.3],
  [/bass$|contrabass/i, 1.2, 0.42],
];

export function defaultPositions(instruments: Instrument[], sections?: Record<string, Section>): Record<string, PartPosition> {
  const out: Record<string, PartPosition> = {};
  for (const section of SECTION_ORDER) {
    const members = instruments.filter((i) => (sections?.[i.id] ?? i.section) === section);
    if (members.length === 0) continue;
    const [a0, a1] = ARC_SPAN[section];
    members.forEach((inst, idx) => {
      if (section === "Strings") {
        const seat = STRING_SEATS.find(([re]) => re.test(inst.name));
        if (seat) {
          out[inst.id] = polarToStage(seat[2], seat[1]);
          return;
        }
      }
      const t = members.length === 1 ? 0.5 : idx / (members.length - 1);
      const angle = a0 + (a1 - a0) * t;
      // nudge every second member slightly outward so neighbors don't stack
      const r = ARC_RADIUS[section] + (idx % 2 === 1 ? 0.035 : 0);
      out[inst.id] = polarToStage(r, angle);
    });
  }
  return out;
}

/** Visual footprint per section: strings read as big pools, winds as bands. */
export const GLOW_SIZE: Record<Section, { rx: number; ry: number }> = {
  Strings: { rx: 0.11, ry: 0.19 },
  Woodwinds: { rx: 0.075, ry: 0.11 },
  Brass: { rx: 0.08, ry: 0.11 },
  Percussion: { rx: 0.085, ry: 0.1 },
  Other: { rx: 0.07, ry: 0.1 },
};

function clamp01(v: number) {
  return Math.max(0.03, Math.min(0.97, v));
}
