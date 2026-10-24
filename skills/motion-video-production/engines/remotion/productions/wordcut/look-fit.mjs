// look-fit.mjs — fit the lens (look.ts) so six landing frames' mean texture numbers (look.mjs) land within ±10 % of the
// reference's (objective: the worst relative error). Seeded random local search; bundles once.
// Usage (engine folder): node productions/wordcut/look-fit.mjs <analysis.json> ['<start look json>']
//   analysis.json is the reference's ref-analyze.py output; its `look` block is the target. ITERS (default 60).
// Prints every evaluation and the best look; paste the best into look.ts. Writes only scratch stills under renders/.
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { metrics } from './look.mjs';
import { LOOK } from './look.ts';
import { WORDCUT as T } from './timing.ts';

const ref = JSON.parse(readFileSync(process.argv[2], 'utf8')).look;
let look = { ...LOOK, ...JSON.parse(process.argv[3] ?? '{}') };
// six landings spread across the film, 3 frames after each lands (at rest)
const FRAMES = [0, 0.2, 0.4, 0.6, 0.8, 1].map((p) => T.cuts[Math.round(p * (T.cuts.length - 1))].f + 3);
const RANGE = { dof: [0, 4], shadowTint: [0, 0.12], gamma: [1, 2.2], light: [0, 1], shade: [0, 0.6], vignette: [0, 0.9], grain: [0, 0.08], contrast: [0.8, 1.4], saturate: [0.5, 5], brightness: [0.8, 1.05] };
const KEYS = ['sharpRatio', 'rms', 'sat', 'chroma', 'black', 'grain'];
const dir = 'renders/wordcut/look-fit';
mkdirSync(dir, { recursive: true });

const root = join(homedir(), 'Library/Caches/ms-playwright');
const exe = process.env.CHROME_PATH ?? (existsSync(root) ? readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()
  .map((d) => join(root, d, 'chrome-mac/headless_shell')).find((p) => existsSync(p)) : undefined);
const serveUrl = await bundle({ entryPoint: resolve('src/index.ts'), ...(existsSync('public') ? { publicDir: resolve('public') } : {}) });

// Encode proxy: the fitted numbers must hold after the master's h264 encode (crf 17, yuv420p), which drops faint
// per-frame grain and some near-black chroma. Each landing renders the 5 frames ending at it, encodes them as a clip
// and is measured on the last decoded frame (a P-frame, as in the master).
async function evaluate(l) {
  const inputProps = { aspect: '9x16', diag: false, look: l };
  const composition = await selectComposition({ serveUrl, id: 'wordcut', inputProps, browserExecutable: exe });
  const rows = [];
  for (const frame of FRAMES) {
    for (let k = 0; k < 5; k++) {
      await renderStill({ serveUrl, composition, frame: Math.max(0, frame - 4 + k), inputProps, imageFormat: 'png', output: join(dir, `b${frame}_${k}.png`), browserExecutable: exe });
    }
    const clip = join(dir, `b${frame}.mp4`);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '30', '-i', join(dir, `b${frame}_%d.png`), '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', clip]);
    rows.push(metrics(execFileSync('ffmpeg', ['-loglevel', 'error', '-i', clip, '-vf', 'select=eq(n\\,4),scale=540:960:flags=area', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 540 * 960 * 4 })));
  }
  const mean = Object.fromEntries(KEYS.map((k) => [k, rows.reduce((s, r) => s + r[k], 0) / rows.length]));
  const err = Math.max(...KEYS.map((k) => Math.abs(mean[k] / ref[k] - 1)));
  console.log(JSON.stringify({ err: +err.toFixed(3), mean: Object.fromEntries(KEYS.map((k) => [k, +mean[k].toFixed(4)])), look: l }));
  return err;
}

let best = await evaluate(look);
// seeded random local search: nudge two parameters at a time, keep improvements, shrink the step after 12 misses
let seed = 20261024;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const keys = Object.keys(RANGE);
let scale = 0.25, misses = 0;
for (let it = 0; it < Number(process.env.ITERS ?? 60) && best > 0.06; it++) {
  const cand = { ...look };
  for (let j = 0; j < 2; j++) {
    const k = keys[Math.floor(rnd() * keys.length)], [a, b] = RANGE[k];
    cand[k] = +Math.min(b, Math.max(a, cand[k] + (rnd() * 2 - 1) * scale * (b - a))).toFixed(4);
  }
  const e = await evaluate(cand);
  if (e < best) { best = e; look = cand; misses = 0; } else if (++misses >= 12) { scale /= 2; misses = 0; }
}
console.log(JSON.stringify({ best: +best.toFixed(3), look }));
