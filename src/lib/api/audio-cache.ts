/**
 * Small LRU of decoded recordings keyed by project id, so an upload, the
 * alignment worker and the MP4 export share one decode. Decoded PCM is large
 * (~10 MB per minute of stereo 44.1 kHz), hence the tight cap.
 */
const MAX_ENTRIES = 3;
const cache = new Map<string, AudioBuffer>();

export function getCachedAudio(projectId: string): AudioBuffer | null {
  const hit = cache.get(projectId);
  if (!hit) return null;
  // refresh recency
  cache.delete(projectId);
  cache.set(projectId, hit);
  return hit;
}

export function cacheAudio(projectId: string, buffer: AudioBuffer): void {
  cache.delete(projectId);
  cache.set(projectId, buffer);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function evictAudio(projectId: string): void {
  cache.delete(projectId);
}

export function clearAudioCache(): void {
  cache.clear();
}
