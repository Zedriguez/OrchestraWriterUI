# Handoff log — main

Append-only. Newest entry at the bottom. Written by `/handoff`.

---

## 2026-10-22 — Claude setup scaffolded

**Done**
- Added CLAUDE.md, .claude/ (settings, hooks, rules, agents, skills, commands),
  docs/STATE.md, docs/spec/, docs/decisions/0001–0003, docs/handoffs/.

**Decisions**
- 0001 MVP scope, 0002 visual encoding, 0003 page flow (all from the spec docs).

**Open questions / blockers**
- Stack, alignment method, visual direction A vs B, audience, MP4 pipeline.

**Next steps**
1. Pick the stack and write 0004-stack.md; fill the commands block in CLAUDE.md.
2. Adjust `paths:` globs in `.claude/rules/*.md` to the real source layout.
3. Build the no-audio path end to end: Import → Customize → Preview.

**Verified by**
- n/a (no code yet)

## 2026-10-26 — Front end built (all screens, mock data)

**Done**
- Merged the Claude setup repo into this folder; scaffolded Next.js 16 (App
  Router, TypeScript, Tailwind v4) with Lora, Inter, Bravura Text, Lucide.
- Design tokens for direction A with direction B as a theme (ADR 0005).
- Screens: sign-in, sign-up, library, programs, program detail, profile,
  settings, and the five workflow screens (import, sync, customize, preview,
  export) behind the stepper nav.
- Visualizer: `GlowRenderer` interface + Canvas 2D implementation, frame
  engine with fades and reduced motion, labeled seating plan with leader
  lines, legend, drag-to-move in Customize.
- Mock job API (`src/lib/api/mock.ts`) with progress/failure states; zustand
  stores for project, playback, preferences, session.

**Decisions**
- 0005 visual direction, 0006 front-end architecture.

**Open questions / blockers**
- Real MusicXML parser, alignment service, audio element wiring, MP4 pipeline.
- Clerk wiring for the auth pages (adapter in `src/lib/auth/session.ts`).
- Engraved score rendering (OSMD/Verovio) to replace the schematic strip.

**Next steps**
1. Wire `src/lib/api/index.ts` to the AWS job API; keep the mock for tests.
2. Add an `<audio>` element driven by the playback store (recording path).
3. Replace `buildMockInfoMap` with the parser output; keep fixtures.

**Verified by**
- `npm run lint`, `npx tsc --noEmit`, `npm run build`; every route opened in
  the in-app browser at desktop and phone widths.
