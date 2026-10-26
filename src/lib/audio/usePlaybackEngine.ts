"use client";

import { useEffect } from "react";
import type { InfoMap } from "@/shared/info-map";
import { usePlayback } from "@/lib/store/playback";
import { createRecordingEngine, createScoreSynthEngine, type AudioEngine } from "./engine";

/** What the transport should play: the uploaded recording (presigned URL) or the score itself. */
export type PlaybackSource = { kind: "recording"; url: string } | { kind: "score"; infoMap: InfoMap } | null;

export function createEngineFor(source: Exclude<PlaybackSource, null>): AudioEngine {
  return source.kind === "recording" ? createRecordingEngine(source.url) : createScoreSynthEngine(source.infoMap);
}

/**
 * Imperative form: create the engine, attach it to the playback store, and
 * return a cleanup that detaches and destroys it.
 */
export function attachPlaybackSource(source: PlaybackSource): () => void {
  if (!source) {
    usePlayback.getState().attach(null);
    return () => {};
  }
  const engine = createEngineFor(source);
  usePlayback.getState().attach(engine);
  return () => {
    if (usePlayback.getState().engine === engine) usePlayback.getState().attach(null);
    engine.destroy();
  };
}

/**
 * Mount once in the workflow layout. Recreates the engine when the URL or
 * info map changes (e.g. a refreshed presigned URL); the store keeps the
 * playhead and re-seeks the new engine once it has loaded. Returns the
 * store's loading/error state for convenience.
 */
export function useAudioEngine(source: PlaybackSource): { ready: boolean; error: string | null } {
  const kind = source?.kind ?? null;
  const url = source?.kind === "recording" ? source.url : null;
  const infoMap = source?.kind === "score" ? source.infoMap : null;

  useEffect(() => {
    if (kind === "recording" && url) return attachPlaybackSource({ kind, url });
    if (kind === "score" && infoMap) return attachPlaybackSource({ kind, infoMap });
    return attachPlaybackSource(null);
  }, [kind, url, infoMap]);

  const ready = usePlayback((s) => s.ready);
  const error = usePlayback((s) => s.error);
  return { ready, error };
}

/** Alias matching the file name. */
export const usePlaybackEngine = useAudioEngine;
