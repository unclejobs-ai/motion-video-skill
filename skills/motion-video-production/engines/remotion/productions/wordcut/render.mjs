// render.mjs — the word cut needs inputProps (aspect, diag, look), which pipeline/render.mjs does not pass.
// Usage (from the engine folder):
//   node productions/wordcut/render.mjs video [9x16|16x9]                                  → renders/wordcut/wordcut-<aspect>.mp4
//   node productions/wordcut/render.mjs stills [9x16|16x9] <frame…> [--diag | --diag-slot | --diag-slotbox] [--look '{json}'] [--out dir]
//                                                                                          → <dir>/f_0000.png …  (lossless PNG)
// The aspect defaults to DATA.aspect. Env: CHROME_PATH (browser binary), CONCURRENCY (default: half the cores).
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { cpus, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { DATA } from './data.ts';

const [mode, ...args] = process.argv.slice(2);
const aspect = ['9x16', '16x9'].includes(args[0]) ? args.shift() : DATA.aspect;
if (!['video', 'stills'].includes(mode)) {
  console.error('usage: render.mjs video [9x16|16x9] | stills [9x16|16x9] <frame…> [--diag] [--out dir]');
  process.exit(2);
}
const diag = args.includes('--diag-slotbox') ? 'slotbox' : args.includes('--diag-slot') ? 'slot' : args.includes('--diag') ? 'sheet' : false;
const outIdx = args.indexOf('--out');
const frames = args.filter((a, i) => /^\d+$/.test(a) && args[i - 1] !== '--out').map(Number);

function browserExecutable() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = join(homedir(), 'Library/Caches/ms-playwright');
  const dirs = existsSync(root) ? readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse() : [];
  for (const d of dirs) for (const sub of ['chrome-mac/headless_shell', 'chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-headless-shell-linux64/chrome-headless-shell']) {
    const p = join(root, d, sub);
    if (existsSync(p)) return p;
  }
  return undefined; // Remotion's own headless shell (`npx remotion browser ensure` downloads it once; ask first)
}

const exe = browserExecutable();
const lookAt = args.indexOf('--look');
const inputProps = { aspect, diag, ...(lookAt >= 0 ? { look: JSON.parse(args[lookAt + 1]) } : {}) };
const serveUrl = await bundle({ entryPoint: resolve('src/index.ts'), ...(existsSync('public') ? { publicDir: resolve('public') } : {}) });
const composition = await selectComposition({ serveUrl, id: 'wordcut', inputProps, browserExecutable: exe });
const started = Date.now();

if (mode === 'stills') {
  const dir = resolve(outIdx >= 0 ? args[outIdx + 1] : join('renders/wordcut', `stills-${aspect}${diag ? `-diag-${diag}` : ''}`));
  mkdirSync(dir, { recursive: true });
  for (const frame of frames) {
    await renderStill({ serveUrl, composition, frame, inputProps, imageFormat: 'png', output: join(dir, `f_${String(frame).padStart(4, '0')}.png`), browserExecutable: exe });
  }
  console.log(`rendered ${frames.length} stills (${composition.width}x${composition.height}${diag ? `, diag ${diag}` : ''}) → ${dir} in ${Date.now() - started} ms`);
} else {
  mkdirSync('renders/wordcut', { recursive: true });
  const output = resolve(`renders/wordcut/wordcut-${aspect}.mp4`);
  await renderMedia({
    serveUrl, composition, inputProps, codec: 'h264', crf: 17, pixelFormat: 'yuv420p', imageFormat: 'png', muted: true,
    outputLocation: output, browserExecutable: exe, concurrency: Number(process.env.CONCURRENCY ?? Math.max(1, Math.floor(cpus().length / 2))),
  });
  const n = composition.durationInFrames, ms = Date.now() - started;
  console.log(`rendered ${n} frames (${composition.width}x${composition.height} @ ${composition.fps}) → ${output} in ${ms} ms (${(ms / n).toFixed(1)} ms/frame)`);
}
