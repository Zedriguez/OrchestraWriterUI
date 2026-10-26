# Handoff log — feat/backend-integration

Append-only. Newest entry at the bottom. Written by `/handoff`.

---

## 2026-10-26 — Backend merged into Next.js; full demo flow wired

**Done**
- Phase 0: copied the OrchestraWriter backend into `src/server/`, wrote the
  shared contracts (`src/shared/api.ts`, score and aligner interfaces, jobs
  registry) and the plan in `docs/plan/backend-integration.md`.
- Phase 1 (five parallel workstreams): Hono API inside Next.js with Better
  Auth, migrations on boot, projects/programs/exports/activity/profile/uploads
  and the parse-score job (57 API tests); isomorphic MusicXML parser with 20
  quirk fixtures and a generated demo score + warped MP3; chroma-DTW aligner
  in a Web Worker; recording and score-synth audio engines; MP4 export
  (WebCodecs + mp4-muxer) and `.ovproj` pack/unpack; Radix UI primitives and
  sonner toasts; HTTP ApiClient, session store, route proxy, project store
  with autosave. 243 unit/component tests.
- Phase 2: pages wired to the real API and decluttered (see the next entry).
- Docs: ADRs 0007–0012, `docs/research/sync-and-instrument-identification.md`,
  `docs/backend/README.md` + `API.md`, STATE.md, CLAUDE.md, README, CI and
  Playwright configs.

**Decisions**
- 0007 Better Auth + Hono inside Next.js (supersedes Clerk in 0004).
- 0008 MusicXML parser approach; 0009 alignment (chroma DTW, browser);
  0010 MP4 export in the browser; 0011 Radix + sonner; 0012 `.ovproj` zip.

**Open questions / blockers**
- Safari and Firefox untested (WebCodecs/AAC); alignment confidence tuned on
  synthetic audio only; transcription pipeline kept but not surfaced.
- `@breezystack/lamejs` (LGPL-3.0) is a devDependency used only by
  `scripts/make-fixtures.ts` to encode the committed demo MP3.
- `hono/vercel` is deprecated in Hono 4 in favor of `@hono/vercel`.

**Next steps**
1. Run `scripts/deploy-init.sh` from `main` once merged; set the SSM secrets.
2. Try a real orchestral recording and retune the confidence thresholds.
3. Decide on the transcription pipeline (STATE.md question 6).

**Verified by**
- `npm run lint`, `npx tsc --noEmit`, `npm test` (243), `npm run test:api`
  (57 against docker compose); WS3 exercised export/audio in headless Chrome.
