/** STUB (WS2 replaces): runs the aligner in a Web Worker with progress. */
import type { InfoMap } from "@/shared/info-map";
import type { AlignAudio, AlignProgress, SyncState } from "@/shared/sync";

export async function alignInWorker(_infoMap: InfoMap, _audio: AlignAudio, _onProgress?: AlignProgress, _signal?: AbortSignal): Promise<SyncState> {
  throw new Error("Alignment worker not implemented yet");
}
