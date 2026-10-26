import type { InfoMap } from "@/shared/info-map";

/**
 * Bar numbers as the user reads them. Measures are numbered in playback order
 * (repeats expanded); `MeasureInfo.label` keeps the printed number when it
 * differs, so the second pass of a repeat reads "41 (33)": playback bar 41,
 * printed bar 33.
 */
export function printedLabel(infoMap: InfoMap | null | undefined, n: number): string | null {
  const label = infoMap?.measures[n - 1]?.label;
  return label && label !== String(n) ? label : null;
}

/** "41 (33)" when the printed number differs, else "41". */
export function barNumber(infoMap: InfoMap | null | undefined, n: number): string {
  const printed = printedLabel(infoMap, n);
  return printed ? `${n} (${printed})` : String(n);
}

/** "bar 41 (33)" / "Bar 41 (33)" */
export function barText(infoMap: InfoMap | null | undefined, n: number, capital = false): string {
  return `${capital ? "Bar" : "bar"} ${barNumber(infoMap, n)}`;
}
