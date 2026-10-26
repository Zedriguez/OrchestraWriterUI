/** "Violin I" → "Vln. I". Placeholder; WS2 moves the real table here from src/lib/mock/info-map.ts. */
export function abbreviateInstrumentName(name: string): string {
  return name.length > 6 ? name.slice(0, 5) + "." : name;
}
