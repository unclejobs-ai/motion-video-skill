// score.mjs — a procedural score keyed to a production's timing contract: no samples, no network, sample-exact.
// Usage: node pipeline/score.mjs productions/<id>        → productions/<id>/audio/score.wav (48 kHz stereo, 16-bit)
// The production's timing.ts exports MUSIC: { seconds, bpm, root?: Hz, hits: s[], vo?: [start, end][] }.
// Pad on the root chord, a soft kick on every beat, a low hit + noise swell into each hit, and the pad thinned under
// every VO window (so the voice sits on top before mix-mux.sh ducks it further). The last 0.1 s is silent.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = process.argv[2];
if (!dir) { console.error('usage: node pipeline/score.mjs productions/<id>'); process.exit(2); }
const { MUSIC } = await import(pathToFileURL(resolve(dir, 'timing.ts')).href);
if (!MUSIC) throw new Error(`${dir}/timing.ts does not export MUSIC`);

const RATE = 48_000, TAU = 2 * Math.PI;
const n = Math.round(MUSIC.seconds * RATE), beat = 60 / MUSIC.bpm, root = MUSIC.root ?? 110;
const L = new Float32Array(n), R = new Float32Array(n);
let seed = 0x5eed;
const noise = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32) * 2 - 1;
const inVo = (t) => (MUSIC.vo ?? []).some(([a, b]) => t >= a - beat / 8 && t <= b + beat / 4);

for (let i = 0; i < n; i++) {
  const t = i / RATE;
  const fade = Math.min(1, t / 0.4, Math.max(0, (MUSIC.seconds - 0.1 - t) / 0.6));
  const thin = inVo(t) ? 0.45 : 1;
  // pad: root, fifth, octave; the octave (the part that masks speech) is what thins under VO
  const pad = 0.10 * Math.sin(TAU * root * t) + 0.07 * Math.sin(TAU * root * 1.5 * t) + 0.05 * thin * Math.sin(TAU * root * 2 * t);
  // kick: pitch drop 120 → 50 Hz with a 0.12 s decay on every beat
  const kb = t % beat, kick = 0.35 * Math.exp(-kb / 0.12) * Math.sin(TAU * (50 * kb + 70 * 0.04 * (1 - Math.exp(-kb / 0.04))));
  let hit = 0, swell = 0;
  for (const h of MUSIC.hits) {
    const d = t - h;
    if (d >= 0 && d < 1.5) hit += 0.5 * Math.exp(-d / 0.35) * Math.sin(TAU * root / 2 * d);
    if (d < 0 && d > -beat) swell += 0.12 * (1 + d / beat) ** 2 * noise();
  }
  const s = fade * (pad + kick + hit + swell);
  L[i] = s; R[i] = s * 0.96 + 0.04 * pad;
}
// peak-normalise to -3 dBFS; loudness is set later by mix-mux.sh
let peak = 0;
for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const gain = peak ? 10 ** (-3 / 20) / peak : 0;
const buf = Buffer.alloc(44 + n * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(RATE, 24);
buf.writeUInt32LE(RATE * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) {
  buf.writeInt16LE(Math.round(L[i] * gain * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(R[i] * gain * 32767), 46 + i * 4);
}
mkdirSync(join(dir, 'audio'), { recursive: true });
writeFileSync(join(dir, 'audio', 'score.wav'), buf);
console.log(`wrote ${join(dir, 'audio', 'score.wav')} (${n} samples = ${MUSIC.seconds} s @ ${RATE} Hz, ${MUSIC.bpm} BPM, hits ${MUSIC.hits.join(' ')})`);
