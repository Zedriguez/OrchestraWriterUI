# Orchestra Visualizer — web front end

Shows which parts of an orchestra are playing, and how loud the score says
they are, while a recording plays. Brightness = written dynamic, color =
section. Upload a MusicXML score and an optional MP3, check the sync, set up
the display, preview, export a project file or MP4.

This is the Next.js front end. It currently runs on deterministic mock data
and a simulated job API so every screen can be designed and reviewed before
the AWS services exist.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 — it redirects to the library. Useful routes:

| Route | Screen |
|---|---|
| `/sign-in`, `/sign-up` | auth (custom forms over an adapter; Clerk wires in here) |
| `/library` | the director's scores, programs rail, activity |
| `/programs`, `/programs/fall-gala` | concert programs (directories of pieces) |
| `/profile`, `/settings` | director profile; account, appearance (direction A/B), export defaults, storage |
| `/projects/beethoven-5/import` | Import — drop a file named `mahler*.musicxml` to see the failure state |
| `/projects/beethoven-5/sync` | Sync — confidence bands, markers, nudge, next uncertain |
| `/projects/beethoven-5/customize` | Customize — parts, drag glows, colors, labels |
| `/projects/beethoven-5/preview` | Preview — the reference screen |
| `/projects/beethoven-5/export` | Export — project file and MP4 jobs |

Keyboard on any playback screen: `Space` play/pause, `←`/`→` 5 s (`Shift` 30 s), `M` mute, `Home` start.

## Where things are

- `src/shared/` — contracts (info map, project file, sync, jobs). Will become the shared package.
- `src/lib/api/` — job API client interface + mock. Swap in `index.ts`.
- `src/lib/visualizer/` — `GlowRenderer` interface, Canvas 2D renderer, frame engine, seating plan.
- `src/lib/store/` — zustand stores (project, playback, preferences).
- `src/components/` — `ui` primitives, `music` (transport, score strip, dynamics), `visualizer` (Stage), one folder per screen.
- `docs/` — spec, decisions (ADRs), handoffs. `CLAUDE.md` holds the working rules.

## Checks

```bash
npm run lint
npx next typegen && npx tsc --noEmit
npm run build
```
