/** MP4 rendering (WebCodecs + mp4-muxer, same renderer as Preview) and the .ovproj container. */
export { renderMp4, mp4ExportUnsupportedReason, pickAudioConfig, pickVideoConfig, type RenderMp4Options, type RenderMp4Result } from "./mp4";
export {
  DEFAULT_CREATED_WITH,
  MIGRATIONS,
  PROJECT_JSON,
  ProjectFileError,
  buildProjectFile,
  migrateProjectFile,
  packProjectFile,
  unpackProjectFile,
  type BuildProjectInput,
  type PackProjectInput,
  type ProjectFileErrorCode,
  type UnpackedProject,
} from "./project-file";
export {
  EXPORT_LOGICAL,
  RESOLUTIONS,
  captionText,
  AUDIO_BITRATE,
  defaultVideoBitrate,
  estimateMp4Bytes,
  exportFrameCount,
  safeFilename,
  type ExportFrameRate,
  type ExportResolution,
} from "./frames";
