# 0003. Five pages; Sync appears only when a recording is uploaded

Date: 2026-10-22
Status: accepted

## Context
Both documents fix the flow Import → Sync → Customize → Preview → Export, with
Sync conditional on an uploaded MP3 and back-edges from Preview.

## Decision
Routes exist for all five pages. After Import, go to Sync if audio was
uploaded, otherwise straight to Customize. Preview offers "Edit display"
always and "Edit sync" only with a recording. Without audio, playback is
generated from the score.

## Consequences
Navigation state needs one flag (`hasRecording`). The Sync page and
alignment code can be built after the no-audio path works end to end.
