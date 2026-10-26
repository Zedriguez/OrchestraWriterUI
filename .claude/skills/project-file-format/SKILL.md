---
name: project-file-format
description: Schema, versioning, and packaging rules for the importable Orchestra Visualizer project file that stores score, audio, alignment markers, and display settings. Use when saving, loading, migrating, or adding any new persisted state.
---
# Project file

## What it must contain
```
{
  "version": 1,
  "createdWith": "<app version>",
  "score":   { "filename": "...", "musicxml": "<inline or path in container>" },
  "audio":   { "source": "uploaded" | "generated", "filename": "...", "mp3": "<path>" | null },
  "infoMap": { ... },                    // optional cache; must be rebuildable from score
  "sync":    { "method": "...", "auto": [...], "manual": [...] },
  "display": { "visibleParts": [...], "positions": {...}, "colors": {...},
               "sections": {...}, "showLabels": true, "reducedMotion": false }
}
```

## Packaging
- Use a zip container (`.ovproj`) with `project.json` plus the original
  `score.musicxml` and `audio.mp3`. Keeping originals means re-import always
  works, even if the info map format changes.
- Never store absolute local paths.

## Versioning
- Bump `version` whenever the shape changes. Keep `migrate(vN → vN+1)`
  functions; loading runs them in order. Unknown newer version → clear error.
- `infoMap` is a cache: if missing or stale, rebuild from `score`.

## Rules
- Any new user setting must be added here in the same PR, or it isn't a
  setting. The reviewer agent checks this.
- MVP has no auto-restore and no account. Don't write to localStorage.
