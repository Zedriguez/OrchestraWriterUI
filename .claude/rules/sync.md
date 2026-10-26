---
paths:
  - "src/lib/align/**"
  - "src/components/sync/**"
  - "src/shared/sync.ts"
---
# Score-to-audio sync

- Sync exists only when the user uploaded an MP3. Without audio, playback is
  generated from the score and the Sync page is skipped.
- Unit of alignment is the **measure**. Each measure gets a start time in the
  recording and a **confidence 0–100%**. Confidence is grouped into bands
  and shown as a color (red = uncertain). Keep the legend in sync with the
  bands.
- Manual markers always win over automatic ones. Store them separately so
  re-running auto-alignment never overwrites a user's edit.
- Alignment must stay **monotonic**: a later measure never starts before an
  earlier one. Reject or warn on edits that break this.
- Default editing control is **nudge buttons**; millisecond fields are the
  advanced option.
- The alignment algorithm is **undecided**. Do not commit to one silently.
  Prototype behind an interface, then write an ADR in `docs/decisions/`.
