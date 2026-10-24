// render.mjs — render a composition to a muted h264 picture master, or chosen stills for a contact sheet.
// Usage:
//   node pipeline/render.mjs <compositionId> [outDir=renders/<id>]              → <outDir>/picture.mp4
//   node pipeline/render.mjs <compositionId> --stills 0.5 2.4 3.1 [--out dir]   → <outDir>/stills/t_2.40.png … + contact.png
// Env: CHROME_PATH (browser binary), CONCURRENCY (default: half the cores).
// Browser: CHROME_PATH, else a Playwright headless shell already in the cache, else Remotion's own headless shell
// (run `npx remotion browser ensure` once; it downloads, so ask first).
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { cpus, homedir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const id = args[0];
if (!id) { console.error('usage: node pipeline/render.mjs <compositionId> [outDir] | --stills <t…> [--out dir]'); process.exit(2); }
const stillsAt = args.includes('--stills') ? args.slice(args.indexOf('--stills') + 1).filter((a) => !a.startsWith('--') && !Number.isNaN(Number(a))).map(Number) : null;
const outDir = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : (!stillsAt && args[1]) || join('renders', id));

function browserExecutable() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = join(homedir(), 'Library/Caches/ms-playwright');
  const dirs = existsSync(root) ? readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse() : [];
  for (const d of dirs) for (const sub of ['chrome-mac/headless_shell', 'chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-headless-shell-linux64/chrome-headless-shell']) {
    const p = join(root, d, sub);
    if (existsSync(p)) return p;
  }
  return undefined;
}

const exe = browserExecutable();
const serveUrl = await bundle({ entryPoint: resolve('src/index.ts'), ...(existsSync('public') ? { publicDir: resolve('public') } : {}) });
const composition = await selectComposition({ serveUrl, id, browserExecutable: exe });
mkdirSync(outDir, { recursive: true });
const started = Date.now();

if (stillsAt) {
  const dir = join(outDir, 'stills');
  mkdirSync(dir, { recursive: true });
  const files = [];
  for (const t of stillsAt) {
    const output = join(dir, `t_${t.toFixed(2)}.png`);
    await renderStill({ serveUrl, composition, frame: Math.min(composition.durationInFrames - 1, Math.round(t * composition.fps)), output, browserExecutable: exe });
    files.push(output);
  }
  const cols = Math.min(4, files.length);
  const tiles = files.map((_, i) => `[${i}]scale=480:270[s${i}]`).join(';');
  const layout = files.map((_, i) => `${(i % cols) * 480}_${Math.floor(i / cols) * 270}`).join('|');
  const stack = files.length === 1 ? '[s0]null' : `${files.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=black`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex', `${tiles};${stack}`, '-frames:v', '1', join(outDir, 'contact.png')]);
  // this ffmpeg build has no drawtext, so tiles are unlabeled: row-major in the order given
  console.log(`rendered ${files.length} stills → ${join(outDir, 'contact.png')} (row-major, ${cols} per row: ${stillsAt.join(' ')} s) in ${Date.now() - started} ms`);
} else {
  const output = join(outDir, 'picture.mp4');
  await renderMedia({
    serveUrl, composition, codec: 'h264', crf: 17, pixelFormat: 'yuv420p', imageFormat: 'png', muted: true,
    outputLocation: output, browserExecutable: exe, concurrency: Number(process.env.CONCURRENCY ?? Math.max(1, Math.floor(cpus().length / 2))),
  });
  const frames = composition.durationInFrames, ms = Date.now() - started;
  console.log(`rendered ${frames} frames (${composition.width}x${composition.height} @ ${composition.fps}) → ${output} in ${ms} ms (${(ms / frames).toFixed(1)} ms/frame)`);
}
