// The contract every lane reads (picture: CarryDemo.tsx, track: track.ts, score: pipeline/score.mjs).
// 96 BPM → beat 0.625 s. The big line lands on beat 3 (1.875 s); the carry window is centred on it.
const beat = 60 / 96;

export const CARRY_DEMO = {
  fps: 60,
  seconds: 5,
  bpm: 96,
  beat,
  riseAt: 0.9,
  bigAt: 3 * beat,
  iris: { t0: 3 * beat - 0.2, d: 0.4 },
  tailAt: 4 * beat,
} as const;

/** what pipeline/score.mjs reads: a hit where the big line lands */
export const MUSIC = { seconds: CARRY_DEMO.seconds, bpm: CARRY_DEMO.bpm, hits: [CARRY_DEMO.bigAt] } as const;
