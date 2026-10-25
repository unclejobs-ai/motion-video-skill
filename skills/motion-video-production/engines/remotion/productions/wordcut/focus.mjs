// focus.mjs — one word in focus per shot: frame0.mjs's measure (keyword centre offset, focus ratio = sharpness of the
// keyword line ÷ the 2nd text line above and below) on every sheet's landing frame, not only frame 0.
// Landing = the first frame after the refocus (cut + 3); the textbook lands unhighlighted, so its landing is the end of
// the highlighter wipe. Optional --sheet <png> tiles the landing frames into one contact sheet (row-major, cut order).
// Usage (engine folder): node productions/wordcut/focus.mjs [--check] [--sheet out.png] [video]   (default: renders/wordcut/wordcut-<DATA.aspect>.mp4)
// --check exits 1 when any sheet's focus < LIMIT (sheets with no measurable ±2 lines are reported, not failed).
import { execFileSync } from 'node:child_process';
import { frame0 } from './frame0.mjs';
import { WORDCUT as T, kindOf } from './timing.ts';
import { DATA } from './data.ts';

const LIMIT = 2;
// a 4-frame burst sheet's landing is its last frame before the next whip's out-frame
export const landings = () => T.cuts.map((c, i) => ({
  i, k: String(c.k),
  f: kindOf(c.k) === 'textbook' ? T.textbook.hlFrom + T.textbook.hlFrames : T.cuts[i + 1] ? Math.min(c.f + T.refocus.length, T.cuts[i + 1].f - 2) : c.f + T.refocus.length,
}));

function frameAt(src, n) {
  const [w0, h0] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src]).toString().trim().split(',').map(Number);
  const k = 540 / Math.min(w0, h0), W = Math.round(w0 * k), H = Math.round(h0 * k);
  const rgb = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', src, '-vf', `select=eq(n\\,${n}),scale=${W}:${H}:flags=area`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: W * H * 4 });
  return { W, H, rgb };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), check = args.includes('--check');
  const sheetAt = args.indexOf('--sheet'), sheet = sheetAt >= 0 ? args[sheetAt + 1] : null;
  const src = args.filter((a, n) => !a.startsWith('--') && (sheetAt < 0 || n !== sheetAt + 1))[0] ?? `renders/wordcut/wordcut-${DATA.aspect}.mp4`;
  const L = landings();
  let fails = 0;
  for (const l of L) {
    const m = frame0(frameAt(src, l.f));
    const r = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
    const ok = !m.error && m.focus !== null && m.focus >= LIMIT;
    if (!ok && m.focus !== null) fails++;
    console.log(`cut ${String(l.i).padStart(2)} ${l.k.padEnd(9)} f${String(l.f).padStart(3)}  focus ${m.error ? m.error : String(r(m.focus)).padEnd(5)}  kw ${r(m.kwSharp)} around ${r(m.aroundSharp)}  dx,dy ${r(m.dx)}, ${r(m.dy)}  ${m.focus === null || m.error ? 'n/a' : ok ? 'pass' : 'FAIL'}`);
  }
  if (sheet) {
    const portrait = src.includes('9x16');
    const sel = L.map((l) => `eq(n\\,${l.f})`).join('+');
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-vf', `select='${sel}',scale=${portrait ? '270:480' : '480:270'},tile=${portrait ? '9x2' : '6x3'}`, '-frames:v', '1', sheet]);
    console.log(`sheet → ${sheet}`);
  }
  if (check && fails) { console.error(`focus: ${fails} sheet(s) below ${LIMIT}`); process.exit(1); }
}
