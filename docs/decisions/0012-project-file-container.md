# 0012. Project file (.ovproj) is a zip with project.json, the score and the audio

Date: 2026-10-26
Status: accepted

## Context
Requirement 8 needs one importable file that round-trips score, audio,
alignment markers and display settings, with versioning from day one.

## Decision
- `.ovproj` = zip (`fflate`, MIT) containing `project.json` (version 1,
  `createdWith`, score/audio metadata, `sync`, `display`, optional `infoMap`
  cache), `score/<original filename>` and `audio/<original filename>` when a
  recording exists. No absolute paths.
- Saving packs the current project in the browser (score and audio bytes are
  fetched from S3) and uploads the result to the export history as well.
- Opening unpacks in the browser, creates a project through the API, uploads
  the originals and restores `sync` and `display`; the server re-parses the
  score so the info map cache is never trusted blindly.
- `migrateProjectFile()` runs version steps in order; unknown newer versions
  fail with a clear message.

## Consequences
- Any new user setting must be added to `DisplaySettings` (and therefore to
  the file) in the same PR; the reviewer agent checks this.
