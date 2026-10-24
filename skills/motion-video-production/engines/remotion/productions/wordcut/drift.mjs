// drift.mjs — measures, in rendered pixels, that the word never leaves its slot.
//  slot  : diag-slotbox render (the slot word's box solid magenta, lens layers off). Coverage-weighted centroid on the
//          last frame before and the first frame after every cut (both whip frames).
//  lens  : the same pairs on the real render, from the yellow highlighter's anti-aliased edges. Grain and the blurred
//          sheet showing through the 72 % highlighter make this the noisy one; it is kept as the end-to-end check.
//  sheet : glyph centroid of each sheet's own word (diag-sheet: its glyphs magenta, slot hidden) minus the glyph centroid
//          of the slot word on the same frame (diag-slot), with the sheet at rest 3 frames after it lands: how far the
//          document's word sits from the word drawn over it. Same font, size and scale, so glyph shape cancels.
// Slot centres are also compared with the slot centre the layout asks for (VIEW × slotY). Writes renders/wordcut/drift-<aspect>.json.
// Usage (engine folder): node productions/wordcut/drift.mjs [9x16|16x9]     Exit 1 when the slot moves more than 0.5 px or a measurement is missing.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { VIEW, slotOf } from './scene.ts';
import { WORDCUT as T, kindOf } from './timing.ts';
import { DATA } from './data.ts';

const aspect = process.argv[2] ?? DATA.aspect;
if (!['9x16', '16x9'].includes(aspect)) { console.error('usage: drift.mjs [9x16|16x9]'); process.exit(2); }
const V = VIEW[aspect], [W, H] = V.out, k = W / V.w, S = slotOf(aspect);
const want = { x: S.x * k, y: S.y * k };
const dir = `renders/wordcut/drift-${aspect}`;

// frame pairs straddling each boundary; the textbook lands unhighlighted, so its "after" is the end of the highlighter wipe.
const pairs = T.cuts.slice(1).map((c) => [c.f - 1, kindOf(c.k) === 'textbook' ? T.textbook.hlFrom + T.textbook.hlFrames : c.f]);
// each sheet at rest: 3 frames after it lands, but never on or after the next whip's out-frame (next.f - 1), where the
// sheet is shifted on purpose; in a 4-frame burst that is the frame after landing + 2 (refocus blur only, no offset)
const rest = T.cuts.map((c, i) => (T.cuts[i + 1] ? Math.min(c.f + 3, T.cuts[i + 1].f - 2) : c.f + 3));

const render = (frames, mode) => {
  const out = join(dir, mode);
  mkdirSync(out, { recursive: true });
  const flag = { lens: [], sheet: ['--diag'], slot: ['--diag-slot'], slotbox: ['--diag-slotbox'] }[mode];
  execFileSync('node', ['productions/wordcut/render.mjs', 'stills', aspect, ...frames.map(String), ...flag, '--out', out], { stdio: 'inherit' });
  return out;
};
const rgb = (png) => execFileSync('ffmpeg', ['-loglevel', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: W * H * 4 });
const at = (b, x, y) => { const i = (y * W + x) * 3; return [b[i], b[i + 1], b[i + 2]]; };
const png = (d, f) => join(d, `f_${String(f).padStart(4, '0')}.png`);

/** highlighter centre: yellowness Y = (R+G)/2 − B; per row, the yellow run's edges refined by the edge pixels' coverage */
function slotCentre(b) {
  const Y = (x, y) => { const [r, g, bl] = at(b, x, y); return (r + g) / 2 - bl; };
  const box = { x0: Math.round(want.x - W * 0.3), x1: Math.round(want.x + W * 0.3), y0: Math.round(want.y - H * 0.08), y1: Math.round(want.y + H * 0.08) };
  const rows = [];
  let top = Infinity, bottom = -Infinity;
  for (let y = box.y0; y <= box.y1; y++) {
    let xl = -1, xr = -1;
    for (let x = box.x0; x <= box.x1; x++) if (Y(x, y) > 50) { if (xl < 0) xl = x; xr = x; }
    if (xl < 0 || xr - xl < 20) continue;
    top = Math.min(top, y); bottom = Math.max(bottom, y);
    const full = (Y(xl + 2, y) + Y(xr - 2, y)) / 2, bgL = Y(xl - 3, y), bgR = Y(xr + 3, y);
    const cov = (v, bg) => Math.min(1, Math.max(0, (v - bg) / (full - bg)));
    rows.push(((xl - cov(Y(xl - 1, y), bgL)) + (xr + 1 + cov(Y(xr + 1, y), bgR))) / 2);
  }
  if (!rows.length) return null;
  // drop the band's first/last two rows (gradient stop rows), average the rest
  const mid = rows.slice(2, -2).length ? rows.slice(2, -2) : rows;
  return { x: mid.reduce((s, v) => s + v, 0) / mid.length, y: (top + bottom + 1) / 2, rows: mid.length };
}

/** magenta centroid, weighted by coverage M = (min(R, B) − G) / 255 (blue and teal ink score below 0) */
function sheetCentre(b) {
  let sx = 0, sy = 0, s = 0;
  const x0 = Math.round(want.x - W * 0.3), x1 = Math.round(want.x + W * 0.3), y0 = Math.round(want.y - H * 0.08), y1 = Math.round(want.y + H * 0.08);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const [r, g, bl] = at(b, x, y), m = (Math.min(r, bl) - g) / 255;
    if (m < 0.02) continue; // neutral paper, ink and the dark sheets score ≈ 0; anti-aliased magenta edges keep their share
    const w = Math.min(1, m);
    sx += (x + 0.5) * w; sy += (y + 0.5) * w; s += w;
  }
  return s ? { x: sx / s, y: sy / s, area: s } : null;
}

const pairFrames = [...new Set(pairs.flat())].sort((a, b) => a - b);
const lensDir = render(pairFrames, 'lens'), boxDir = render(pairFrames, 'slotbox'), diagDir = render(rest, 'sheet'), glyphDir = render(rest, 'slot');
const r2 = (v) => Math.round(v * 100) / 100;
const report = { aspect, want, pairs: [], rest: [] };
const delta = (p, q) => (p && q ? { dx: r2(q.x - p.x), dy: r2(q.y - p.y) } : { dx: null, dy: null });
for (const [a, b] of pairs) {
  const p = sheetCentre(rgb(png(boxDir, a))), q = sheetCentre(rgb(png(boxDir, b)));
  const lp = slotCentre(rgb(png(lensDir, a))), lq = slotCentre(rgb(png(lensDir, b)));
  report.pairs.push({ before: a, after: b, ...delta(p, q), off: p && { x: r2(p.x - want.x), y: r2(p.y - want.y) }, lens: delta(lp, lq) });
}
T.cuts.forEach((c, n) => {
  const m = sheetCentre(rgb(png(diagDir, rest[n]))), g = sheetCentre(rgb(png(glyphDir, rest[n])));
  report.rest.push({ sheet: String(c.k), frame: rest[n], dx: m && g && r2(m.x - g.x), dy: m && g && r2(m.y - g.y) });
});
const maxAbs = (xs) => Math.max(...xs.filter((v) => v !== null).map(Math.abs));
report.max = {
  slotAcrossBoundary: { dx: maxAbs(report.pairs.map((p) => p.dx)), dy: maxAbs(report.pairs.map((p) => p.dy)) },
  slotVsWanted: { dx: maxAbs(report.pairs.map((p) => p.off?.x ?? null)), dy: maxAbs(report.pairs.map((p) => p.off?.y ?? null)) },
  lensAcrossBoundary: { dx: maxAbs(report.pairs.map((p) => p.lens.dx)), dy: maxAbs(report.pairs.map((p) => p.lens.dy)) },
  sheetWordVsSlot: { dx: maxAbs(report.rest.map((p) => p.dx)), dy: maxAbs(report.rest.map((p) => p.dy)) },
};
writeFileSync(`renders/wordcut/drift-${aspect}.json`, JSON.stringify(report, null, 1));
console.log(`== drift ${aspect} (${W}x${H}, slot centre wanted at ${r2(want.x)}, ${r2(want.y)} px)`);
for (const p of report.pairs) console.log(`  slot  f${p.before}→f${p.after}  Δ ${p.dx?.toFixed(2)}, ${p.dy?.toFixed(2)} px  (centre − wanted ${p.off?.x.toFixed(2)}, ${p.off?.y.toFixed(2)})  lens Δ ${p.lens.dx?.toFixed(2)}, ${p.lens.dy?.toFixed(2)}`);
for (const p of report.rest) console.log(`  sheet ${p.sheet.padEnd(9)} f${p.frame}  word − slot ${p.dx?.toFixed(2)}, ${p.dy?.toFixed(2)} px`);
const m = report.max, xy = (v) => `${v.dx.toFixed(2)}, ${v.dy.toFixed(2)} px`;
console.log(`max |Δ| slot across boundaries ${xy(m.slotAcrossBoundary)} · slot vs wanted ${xy(m.slotVsWanted)} · sheet word vs slot ${xy(m.sheetWordVsSlot)} · lens (noisy) ${xy(m.lensAcrossBoundary)}`);
const missing = [...report.pairs, ...report.rest].filter((r) => r.dx === null).length;
if (missing) console.log(`FAIL ${missing} measurements found no word (frame on a whip, or the word left the window)`);
process.exit(missing || Math.max(m.slotAcrossBoundary.dx, m.slotAcrossBoundary.dy, m.sheetWordVsSlot.dx, m.sheetWordVsSlot.dy) > 0.5 ? 1 : 0);
