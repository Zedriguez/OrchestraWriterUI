# 0002. The visual encodes exactly three things: playing, written dynamic, section

Date: 2026-10-22
Status: accepted

## Context
Design principle 1 says the light must match the score, not the recording.
Principle 3 says many bright parts must still read as separate sections.
Adding encodings makes both harder.

## Decision
Brightness = written dynamic on a fixed pp–fff ladder. Hue = section (about
8–10 distinct hues max; tints and labels beyond that). Glow on/off = part
is playing. Audio loudness never drives the visual. Pitch, articulation,
ramps, and look-ahead rings are later phase.

## Consequences
Rendering code has one small frame-state input. Customize in MVP exposes only
colors, positions, and visibility. The "Mappings" and pitch-ramp controls in
the Customize mockup are labeled later phase.
