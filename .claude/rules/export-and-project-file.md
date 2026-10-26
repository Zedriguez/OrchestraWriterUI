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
  settings. Settings live inside the project file; there is no account and no
  separate preferences store in the MVP.
- Version the project-file schema from day one (`"version": 1`). Loading an
  older version must either migrate or fail with a clear message.
- **MP4 export** uses the uploaded audio or the generated playback, at a
  chosen resolution and frame rate, with a progress indicator, a filename
  field, a download button, and a retry option.
- Export must render from the same visualizer code as preview. No second
  renderer.
- No automatic restore after refresh in the MVP. Don't add localStorage
  persistence unless `docs/STATE.md` moves Scope 2 into scope.
