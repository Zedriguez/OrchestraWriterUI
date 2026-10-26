import type { InfoMap } from "../../src/shared/info-map";
import { makeTempoWarp, renderInfoMapAudio, type TempoWarpSpec } from "../../src/lib/score/synth-notes";
import { demoWarpSpec } from "./demo-score";

/**
 * The demo "recording": the parsed demo score synthesized with a deliberate
 * tempo warp so recording time does NOT equal score time. Shared by
 * scripts/make-fixtures.ts (which MP3-encodes it) and the aligner tests
 * (which use the PCM directly, since there is no MP3 decoder in Node).
 */

export const DEMO_SAMPLE_RATE = 22050;

export interface DemoTruth {
  scoreFile: string;
  audioFile: string;
  sampleRate: number;
  /** recording seconds */
  durationSec: number;
  warp: TempoWarpSpec;
  measures: Array<{ n: number; scoreStartSec: number; recordingStartSec: number }>;
}

export interface DemoRecording {
  samples: Float32Array;
  sampleRate: number;
  truth: DemoTruth;
}

export function renderDemoRecording(infoMap: InfoMap, sampleRate = DEMO_SAMPLE_RATE): DemoRecording {
  const spec = demoWarpSpec(infoMap.duration);
  const warp = makeTempoWarp(spec);
  // sounding pitch comes from the parsed <transpose> (B♭ clarinet: written − 2)
  const samples = renderInfoMapAudio(infoMap, { sampleRate, warp, tailSec: 1.5 });
  const truth: DemoTruth = {
    scoreFile: "fixtures/scores/orchestra-demo.musicxml",
    audioFile: "fixtures/audio/orchestra-demo.mp3",
    sampleRate,
    durationSec: round3(samples.length / sampleRate),
    warp: { ...spec, splitScoreSec: round3(spec.splitScoreSec) },
    measures: infoMap.measures.map((m) => ({
      n: m.number,
      scoreStartSec: round3(m.startTime),
      recordingStartSec: round3(warp(m.startTime)),
    })),
  };
  return { samples, sampleRate, truth };
}

function round3(v: number) {
  return Math.round(v * 1000) / 1000;
}
