---
paths:
  - "src/lib/export/**"
  - "src/components/export/**"
  - "src/shared/project-file.ts"
  - "src/server/services/exports*.ts"
---
# Export and project files

- The **project file** must round-trip everything: score, audio (or the flag
  that audio is generated), alignment markers, confidence, and all display
  settings. Display settings live inside the project file; account-level
  preferences (theme, export defaults) live on the profile (ADR 0013).
- Version the project-file schema from day one (`"version": 1`). Loading an
  older version must either migrate or fail with a clear message.
- **MP4 export** uses the uploaded audio or the generated playback, at a
  chosen resolution and frame rate, with a progress indicator, a filename
  field, a download button, and a retry option.
- Export must render from the same visualizer code as preview. No second
  renderer.
- Projects persist on the server (ADR 0013); never add localStorage
  persistence of project state.
