---
paths:
  - "**/visual*/**"
  - "**/render*/**"
  - "**/orchestra*/**"
---
# The visualizer

Three things, and only three, are on screen in the MVP:

1. **Whether a part is playing**
2. **Its written dynamic** → brightness, on a fixed ladder pp → fff
3. **Its section** → hue

Pitch, articulation, ramps, look-ahead rings, gradients, and custom mappings
are later phase. If you find yourself encoding a fourth thing, stop.

- Start from a **labeled orchestra seating layout**. Every part is independently
  selectable and movable; positions and colors are saved in the project file.
- About **8–10 distinct hues** is the practical maximum. With 64 parts, use
  tints within a section plus labels, not more hues.
- Show part names and the current dynamic beside each glow so a first-time
  listener can name what's lit.
- Many bright parts must still read as separate sections: no bloom that
  merges neighbors.
- Respect a **reduced-motion** toggle: fades become instant switches.
- Performance budget: 64 parts at 60 fps in preview and at export resolution.
  Measure before and after any rendering change.
- Rendering library is not decided (PixiJS + pixi-filters is the suggestion).
  Keep rendering behind one interface so it can be swapped.
