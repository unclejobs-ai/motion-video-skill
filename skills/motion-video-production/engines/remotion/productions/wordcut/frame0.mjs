// frame0.mjs: does the cut's first frame read like the reference's (a mid-shot on the word, not a page)?
//  offset : centre of the keyword highlight (yellow-green: G and R high, B low) from the frame centre, in px of the
//           frame scaled to 540 px on its short side, and as a fraction of width / height
//  focus  : sharpness of a band one highlight high on the keyword line ÷ the mean sharpness of the same bands on the
//           2nd text line above and below it (sharpness = Laplacian variance per unit luma variance, grain smoothed out).
//           A reference cut that opens on a focus band measures about 2.5 on frame 0 and racks open to about 1 by 0.3 s;
//           a flat page shot measures below 1.
//  colour : reported, not gated: share of pixels away from the word whose 9 px box-blurred chroma is > 30 (blue
//           hashtags; a strong RGB split also scores, the reference's frame 0 does); blue: the same with blue > max(R, G) + 25
// Assumes a yellow-green highlighter behind the word (sheets.css.ts --hl); change the test in frame0() if yours differs.
// Usage (engine folder): node productions/wordcut/frame0.mjs [--check] [<video|png>[@seconds] …]
//   no file: renders/wordcut/wordcut-9x16.mp4@0 and renders/wordcut/wordcut-16x9.mp4@0 (those that exist)
// --check exits 1 when a frame fails: |offset x| > 5 % W, |offset y| > 12 % H, focus < LIMIT.focus.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const LIMIT = { x: 0.05, y: 0.12, focus: 2 };

function grab(spec) {
  const at = spec.lastIndexOf('@'), src = at > 0 ? spec.slice(0, at) : spec, t = at > 0 ? spec.slice(at + 1) : null;
  const [w0, h0] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src]).toString().trim().split(',').map(Number);
  const k = 540 / Math.min(w0, h0), W = Math.round(w0 * k), H = Math.round(h0 * k);
  const rgb = execFileSync('ffmpeg', ['-loglevel', 'error', ...(t ? ['-ss', t] : []), '-i', src, '-frames:v', '1', '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: W * H * 4 });
  return { src: src.split('/').pop() + (t ? `@${t}` : ''), W, H, rgb };
}

export function frame0({ W, H, rgb }) {
  const n = W * H, Y = new Float32Array(n), hl = new Uint8Array(n);
  let sx = 0, sy = 0, c = 0, y0 = H, y1 = 0;
  // the frame box-blurred by 9 px: thin RGB-split fringes average out (white text with its blue pulled off reads
  // yellow, like the highlighter), solid areas (the highlighter, blue hashtags) remain
  const r9 = 4, col0 = new Float32Array(n * 3);
  for (let y = r9; y < H - r9; y++) for (let x = r9; x < W - r9; x++) {
    let a = 0, b = 0, d = 0;
    for (let v = -r9; v <= r9; v++) for (let u = -r9; u <= r9; u++) { const j = ((y + v) * W + x + u) * 3; a += rgb[j]; b += rgb[j + 1]; d += rgb[j + 2]; }
    const i = (y * W + x) * 3, m = (2 * r9 + 1) ** 2; col0[i] = a / m; col0[i + 1] = b / m; col0[i + 2] = d / m;
  }
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    Y[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const R = col0[i * 3], G = col0[i * 3 + 1], Bl = col0[i * 3 + 2];
    if (G > 100 && R > 75 && G - Bl > 55 && R - Bl > 40) hl[i] = 1;
  }
  // keep the largest 4-connected highlight blob: the highlighter is one solid box, split fringes are scattered
  const lab = new Int32Array(n), sizes = [0];
  for (let i = 0; i < n; i++) {
    if (!hl[i] || lab[i]) continue;
    const id = sizes.length, stack = [i]; lab[i] = id; let k = 0;
    while (stack.length) { const j = stack.pop(); k++; for (const q of [j - 1, j + 1, j - W, j + W]) if (q >= 0 && q < n && hl[q] && !lab[q] && Math.abs((q % W) - (j % W)) <= 1) { lab[q] = id; stack.push(q); } }
    sizes.push(k);
  }
  const big = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < n; i++) { hl[i] = lab[i] === big && big > 0 ? 1 : 0; if (hl[i]) { sx += i % W; sy += (i / W) | 0; c++; } }
  if (c < 50) return { error: 'no keyword highlight found' };
  const cx = sx / c, cy = sy / c;
  // highlight height: rows near the centroid column span holding highlight pixels
  for (let y = 0; y < H; y++) { let m = 0; for (let x = Math.round(cx - 20); x < Math.round(cx + 20); x++) m += hl[y * W + x]; if (m > 8) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
  const h = Math.max(8, y1 - y0 + 1);
  // text line centres: peaks of the row luma std (smoothed over h/3), at least 0.8 h apart, std > 6. Lines are not evenly
  // spaced (headings, paragraph gaps), so the bands compared are the 2nd text line above and below the keyword's line.
  const rowStd = Array.from({ length: H }, (_, y) => { let s1 = 0, s2 = 0; for (let x = 0; x < W; x++) { const v = Y[y * W + x]; s1 += v; s2 += v * v; } return Math.sqrt(Math.max(0, s2 / W - (s1 / W) ** 2)); });
  const r3 = Math.max(1, Math.round(h / 6));
  const prof = rowStd.map((_, y) => { let t = 0, k = 0; for (let v = y - r3; v <= y + r3; v++) if (v >= 0 && v < H) { t += rowStd[v]; k++; } return t / k; });
  const win = Math.round(0.4 * h), peaks = [];
  for (let y = 0; y < H; y++) {
    if (prof[y] <= 6) continue;
    let top = true; for (let v = Math.max(0, y - win); v <= Math.min(H - 1, y + win); v++) if (prof[v] > prof[y] || (prof[v] === prof[y] && v < y)) { top = false; break; }
    if (top && (!peaks.length || y - peaks[peaks.length - 1] >= 0.8 * h)) peaks.push(y);
  }
  let at = 0; peaks.forEach((y, j) => { if (Math.abs(y - cy) < Math.abs(peaks[at] - cy)) at = j; });
  const lines = [peaks[at - 2], peaks[at + 2]].filter((y) => y !== undefined);
  // Laplacian at a 3 px step on the 3×3 box-smoothed luma: text edges register, per-pixel grain does not
  const B = new Float32Array(n);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { let t = 0; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) t += Y[(y + v) * W + x + u]; B[y * W + x] = t / 9; }
  const lapVar = (yc) => {
    let s = 0, s2 = 0, k = 0;
    for (let y = Math.max(4, Math.round(yc - h / 2)); y < Math.min(H - 4, Math.round(yc + h / 2)); y++) for (let x = 4; x < W - 4; x++) {
      const i = y * W + x, v = 4 * B[i] - B[i - 3] - B[i + 3] - B[i - 3 * W] - B[i + 3 * W];
      s += v; s2 += v * v; k++;
    }
    return k ? s2 / k - (s / k) ** 2 : 0;
  };
  // a band's sharpness is its Laplacian variance per unit of luma variance, so text density cancels; a band with no
  // text (luma std < 6) has nothing to be sharp or blurred and is left out
  const lumaVar = (yc) => {
    let s = 0, s2 = 0, k = 0;
    for (let y = Math.max(0, Math.round(yc - h / 2)); y < Math.min(H, Math.round(yc + h / 2)); y++) for (let x = 0; x < W; x++) { const v = Y[y * W + x]; s += v; s2 += v * v; k++; }
    return k ? s2 / k - (s / k) ** 2 : 0;
  };
  const sharp = (yc) => (lumaVar(yc) < 36 ? null : lapVar(yc) / lumaVar(yc));
  const kw = sharp(cy), around = lines.map(sharp).filter((v) => v !== null);
  const off = around.length ? around.reduce((a, b) => a + b) / around.length : null;
  let col = 0, blue = 0;
  for (let y = r9; y < H - r9; y++) for (let x = r9; x < W - r9; x++) {
    const i = y * W + x; if (Math.abs(x - cx) < W * 0.3 && Math.abs(y - cy) < h * 1.5) continue;
    const r = col0[i * 3], g = col0[i * 3 + 1], b = col0[i * 3 + 2]; if (Math.max(r, g, b) - Math.min(r, g, b) > 30) col++;
    if (b - Math.max(r, g) > 25) blue++;
  }
  return { W, H, dx: cx - W / 2, dy: cy - H / 2, fx: (cx - W / 2) / W, fy: (cy - H / 2) / H, hlH: h, lines: lines.map((y) => Math.round(y - cy)), focus: kw !== null && off !== null ? kw / off : null, kwSharp: kw, aroundSharp: off, colour: col / n, blue: blue / n };
}

const pass = (m) => !m.error && Math.abs(m.fx) <= LIMIT.x && Math.abs(m.fy) <= LIMIT.y && m.focus !== null && m.focus >= LIMIT.focus;

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), check = args.includes('--check');
  let files = args.filter((a) => a !== '--check');
  if (!files.length) files = ['9x16', '16x9'].map((a) => `renders/wordcut/wordcut-${a}.mp4`).filter(existsSync).map((p) => `${p}@0`);
  if (!files.length) { console.error('frame0: no render found; pass a video or png'); process.exit(2); }
  let ok = true;
  for (const spec of files) {
    const f = grab(spec), m = frame0(f), p = pass(m);
    ok &&= p;
    console.log(JSON.stringify({ src: f.src, ...m, pass: p }, (k, v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v)));
  }
  if (check && !ok) { console.error(`frame0: FAIL (limits ${JSON.stringify(LIMIT)})`); process.exit(1); }
}
