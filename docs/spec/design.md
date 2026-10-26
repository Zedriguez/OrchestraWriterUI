# Orchestra Visualizer design spec

Source: `Orchestra_Visualizer_Design_Spec.pdf`. Preliminary; open to change.

## Overview
Shows which parts of an orchestra are playing, and how loud the score says
they are, while a recording plays. Upload MusicXML + optional MP3, check sync,
set up the display, preview, export a project file or MP4.

- Audience (to confirm): new listeners following a symphony without reading a
  score; musicians maximizing prep time.
- Goal: look at the screen and know which section is playing, plus details.

## Scope
| | MVP | Later phase |
|---|---|---|
| Input | MusicXML, optional MP3 | other score and audio formats |
| Sync | auto alignment, manual fixes, confidence per measure | — |
| Display | one style, labeled layout, adjustable colors and positions, up to 64 parts, brightness follows dynamics | custom mappings, color and brightness gradients |
| Playback | controls, current-measure highlight, click a measure to start | — |
| Saving/export | manual project file, no account; project file or MP4 | auto-restore, sign-in, cloud storage |

## Design principles
1. **Match the score.** The light shows which parts play and their written
   dynamic, not how loud the recording is.
2. **No training needed.** Plain part names and a legend; a first-time
   listener can name the section that's playing.
3. **Clear when busy.** Lots of bright parts still read as separate sections.

## Visual direction (undecided)
- **A. Concert program** – paper background, ink text, brass accent, big serif
  titles. Dark stage sits in a frame; dense settings stay on light surfaces.
- **B. One material** – everything dark with an amber accent and floating
  controls. Most cinematic, best for the video; dense settings and section
  colors are harder to read on dark.

Both mockups show: title + movement + "bar N of M · K parts" header; the
glow stage with a labeled seating plan (strings front, woodwinds, brass,
percussion back, conductor bottom center); part labels with the current
dynamic in a music font beside each glow; a pp→fff brightness legend; a
"What's playing" parts list (A) or section chips (B); play button, time,
waveform/scrubber, duration; "Save project"; toggles for part labels and
reduced motion.

## Screens
Sync appears only when the user uploads a recording.

- **Import** – score (required) and MP3 (optional), file summary, reopen a
  saved project.
- **Sync** – measure numbers over the waveform, confidence % per measure, add
  or move markers, "Next uncertain" button. Nudge buttons by default,
  millisecond fields as advanced.
- **Customize** – show/hide parts (up to 64), position them, set colors, test
  with playback. Rename the two "Dynamics" rows; label pitch ramp and Mappings
  as later phase.
- **Preview** – watch with audio; collapsible score, orchestra viewer, and
  visualizer panels; click a measure to start; part names and dynamics beside
  each glow. Buttons: Edit sync, Edit display, Back to Customize, Continue to
  Export. Shows "Audio: Uploaded recording", resolution, fullscreen, follow
  toggle on the score panel, measure N / total, tempo.
- **Export** – project file or MP4 (resolution, frame rate, audio), progress,
  retry.

## Visual encoding
Three things on screen: whether a part is playing, written dynamic, section.
Everything else (pitch, articulation, ramps, look-ahead ring) is later phase.

## Color
- Each section gets its own default color; users can change any.
- Brightness conveys dynamics; color indicates section.
- About 8–10 distinct hues max, so 64 parts need tints and labels.

## Design tools and assets
| Need | Tool | Note |
|---|---|---|
| Fonts | Lora, Inter | free Google Fonts (open to change) |
| Dynamic markings | Bravura | SIL OFL music font, pp–fff |
| Icons | Lucide | ISC |
| Color | Adobe Leonardo | Apache 2.0 |
| Timing prototypes | Figma prototyping | easing/spring presets for fade in/out |
| Final animation | Rive | MIT runtimes incl. web |
| Glow in code | PixiJS + pixi-filters | suggestion; devs' call |
