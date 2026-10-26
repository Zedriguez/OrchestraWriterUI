/** STUB (WS2 replaces): chroma-DTW aligner behind the shared Aligner interface. */
import type { Aligner } from "@/shared/sync";

export const chromaDtwAligner: Aligner = {
  method: "chroma-dtw",
  async align() {
    throw new Error("Aligner not implemented yet");
  },
};
