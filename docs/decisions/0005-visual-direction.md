# 0005. Visual direction A ("Concert program") as default; B ("One material") as a theme token set

Date: 2026-10-26
Status: accepted

## Context
The design spec left direction A (paper, ink, brass accent, serif titles, dark
stage in a frame) and B (everything dark, amber accent, floating controls)
undecided. The team's reference mockup for the Preview screen is direction A.
The brief for the front end also asks for a "magical", abstract feel in the
spirit of Perplexity's brand: calm, editorial, with soft fields of light.

## Decision
- Direction A is the default. Dense settings (Customize, Sync, Import, Export,
  Library, Settings) sit on light paper surfaces; the stage is always dark and
  framed.
- Direction B is implemented as an alternative token set
  (`html[data-theme="stage"]`, see `src/app/globals.css`) and is switchable in
  Settings → Appearance. Components never hard-code colors, so both directions
  share one codebase.
- The "magic" is confined to decoration that never carries information: the
  Aurora light field (section hues, slow drift, blurred) behind auth, empty
  states and hero cards; film grain on paper; brass gradients on primary
  accents. The three visual encodings on the stage stay exactly as ADR 0002.
- Fonts: Lora (titles), Inter (UI), Bravura Text (dynamic markings, loaded
  from a CDN with Lora italic as fallback). Icons: Lucide.

## Consequences
- New surfaces must use the tokens in `globals.css` (`--paper*`, `--ink*`,
  `--brass*`, `--stage*`, `--sec-*`, `--conf-*`). Tailwind utilities are
  generated from them (`bg-paper-2`, `text-ink-3`, `border-line`, …).
- Reduced motion (user preference or system setting) turns all fades into
  instant switches, including the Aurora drift.
- Direction B's readability of dense settings is still the weaker of the two;
  if the team later prefers B everywhere, only tokens change.
