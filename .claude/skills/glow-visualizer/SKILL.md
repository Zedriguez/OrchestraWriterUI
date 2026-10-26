---
name: glow-visualizer
description: How the orchestra glow visualizer encodes playing state, written dynamic, and section; the seating layout, label rules, brightness ladder, fades, reduced motion, and the 64-part performance budget. Use when building or changing anything the viewer sees in Customize, Preview, or MP4 export.
---
# Glow visualizer

## Encoding (MVP, exactly three)
| Musical fact | Visual | Notes |
|---|---|---|
| Part is playing | glow visible | off when resting / hidden |
| Written dynamic | brightness | ladder pp p mp mf f ff fff → 7 fixed steps |
| Section | hue | strings, woodwinds, brass, percussion default hues; user-editable |

Everything else (pitch, articulation, ramps, look-ahead) is later phase.

## Layout
- Default: labeled orchestra seating plan, conductor at bottom center.
  Strings front, woodwinds behind, brass behind them, percussion at the back.
- Each part is a movable blob with a label (part name + current dynamic in
  Bravura). Labels sit beside the glow with a leader line; never on top of it.
- Positions and colors are user settings saved in the project file.

## Color
- 8–10 distinct hues max. Within a section use tints (lightness steps) and
  rely on labels. Generate palettes with Adobe Leonardo-style contrast steps
  so adjacent tints stay distinguishable on the dark stage.
- Brightness ladder is applied as luminance, not alpha, so overlapping glows
  don't wash out.

## Motion
- Fade in on note onset, fade out on release; short (≈100–250 ms). Tune with
  the Figma timing prototypes before hard-coding.
- Reduced motion: no fades, instant on/off.

## Performance
- Budget: 64 parts, 60 fps in Preview; export at chosen resolution/frame rate
  without dropping frames. Batch draws; avoid per-part filters when a shared
  blur pass works. Measure, then change.

## Rendering library
Not decided. PixiJS + pixi-filters is the suggestion. Keep the renderer behind
`render(frameState)` so it can be swapped; preview and export call the same code.
