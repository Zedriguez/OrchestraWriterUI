# App requirements and screen descriptions

Source: `App_requirements.pdf`. Kept as markdown so Claude can read it.

## App description
A web app that creates a visualization with synced audio from a music score.
Users upload a score and an optional recording, customize the display,
preview the result, and export an importable project file or an MP4 with audio.

## Requirements

### 1. Upload score and optional audio
- Score as MusicXML; MP3 audio optional.
- No audio → the app generates playback from the score.
- Initial scope: MusicXML + MP3. Expanded: Sibelius, PDF, other audio formats.

### 2. Sync score and audio
- Initial scope: automatic alignment with manual corrections.
- Idea under discussion: generate audio per measure, sync each measure start
  to the recording, give each measure a certainty rating (percentages
  grouped), show confidence with colors (red = uncertain).
- Users add or adjust markers for measure/note alignment.
- The specific alignment method is undecided.

### 3. Information map
```
Instrument {
  Name: "Cello Section"
  Notes: [{ Time, Duration, Pitch, Dynamics: pp|p|mp|mf|f|ff|fff,
            StyleMarking: Staccato|Slur|Marcato|... }, ...]
}
```

### 4. Customize the display
Scope 1 (initial): one visualization style; adjustable colors and instrument
positions; choose which sections are displayed and where; each part
independently selectable and movable; up to 64 parts; start from a labeled
orchestra seating layout; note activity shown with brightness reflecting
written dynamics; hiding a part changes the visual, not the audio.

Scope 2 (expanded): customizable map → display settings; color / saturation /
brightness gradients; how to display different musical elements; custom
mappings from musical information to visual effects.

Designers and UI contributors: suggest styles and options based on tools or
libraries, state what they support and whether they fit initial or expanded
scope, and bring them to the team.

### 5. Generate the visual
Generate it, with the option to go back to editing.

### 6. Export
Importable project file, or MP4 with audio (uploaded or generated).

### 7. Playback
In-app playback; navigate score pages independently of the playing measure;
click a measure to start from it; playback controls and current-measure
highlight; return to timing or display editing.

### 8. Local saving and persistence
- Scope 1 (initial): save project to a file and open it later; preserves score,
  audio, alignment markers, visualization settings; settings live inside the
  project file; no automatic restore; no account or separate preferences.
- Scope 2: plus automatic restore in the same browser/device; no account
  required, account optional; clearing browser data may remove work.
- Scope 3: plus sign-in, online storage, cross-device access.

## Page flow
Import → Sync (if audio uploaded) → Customize → Preview → Export

### Import
MusicXML and optional MP3 upload areas; explain that playback is generated when
audio is omitted; open saved project; filenames, processing status, errors.
With audio → Sync; without → Customize.

### Sync
Score viewer with measure numbers above a waveform/timeline; certainty
percentages and confidence colors with a legend; controls to add/adjust
measure or note markers; playback controls; navigation to uncertain measures;
continue to Customize.

### Customize
Instrument list left, visual layout center, settings right; select visible
sections and position them independently; initial scope one style with colors
and positions; expanded scope gradients and mappings; playback controls to
test; continue to Preview.

### Preview / Playback
Large visualization with uploaded or generated audio; collapsible score
viewer, orchestra/instrument viewer, and visualizer; playback controls, score
page navigation, current-measure highlight; click measures to start; return to
display editing, or sync editing when using a recording; continue to Export.

### Export
Save an importable project (score, audio, timing adjustments, display
settings); export MP4 with uploaded or generated audio; filename, progress
indicator, download button, retry.
