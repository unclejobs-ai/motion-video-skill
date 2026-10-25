// look.mjs — five texture numbers per frame, to match the render's look to the reference video.
//  sharpRatio : Laplacian variance of the top + bottom 25 % of the frame ÷ that of the middle 50 % (depth of field)
//  rms        : RMS contrast, std of luma / 255
//  sat        : mean HSV saturation, (max − min) / max (unstable near black: a near-black pixel with any tint scores high)
//  chroma     : mean (max − min) / 255, the same colourfulness without the near-black blow-up
//  black      : 1st-percentile luma (0–255)
//  grain      : high-pass std (luma − its 3×3 mean) in the flattest 20 % of 8×8 blocks (flat = lowest 5×5-smoothed variance)
// Every frame is scaled to 540×960 first so grain and sharpness compare like for like (ref-analyze.py measures the same six).
// Usage: node look.mjs <video|png>@<seconds|-> …   → JSON lines {src, t, …} then the mean of each metric.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const W = Number(process.env.LOOK_W ?? 540), H = Number(process.env.LOOK_H ?? 960); // 16:9: LOOK_W=960 LOOK_H=540

function frame(src, t) {
  const args = ['-loglevel', 'error', ...(t === '-' ? [] : ['-ss', String(t)]), '-i', src, '-frames:v', '1', '-vf', `scale=${W}:${H}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'];
  return execFileSync('ffmpeg', args, { maxBuffer: W * H * 4 });
}

export function metrics(rgb) {
  const n = W * H, Y = new Float32Array(n);
  let sat = 0, chroma = 0;
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    Y[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    sat += mx ? (mx - mn) / mx : 0;
    chroma += (mx - mn) / 255;
  }
  const lapVar = (y0, y1) => {
    let s = 0, s2 = 0, c = 0;
    for (let y = Math.max(1, y0); y < Math.min(H - 1, y1); y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, v = 4 * Y[i] - Y[i - 1] - Y[i + 1] - Y[i - W] - Y[i + W];
      s += v; s2 += v * v; c++;
    }
    return s2 / c - (s / c) ** 2;
  };
  const edge = (lapVar(0, H * 0.25) + lapVar(H * 0.75, H)) / 2, mid = lapVar(H * 0.25, H * 0.75);
  let m = 0; for (const v of Y) m += v; m /= n;
  let v2 = 0; for (const v of Y) v2 += (v - m) ** 2;
  const sorted = Float32Array.from(Y).sort();
  // grain
  const box = (r) => { const o = new Float32Array(n); for (let y = r; y < H - r; y++) for (let x = r; x < W - r; x++) { let s = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) s += Y[(y + dy) * W + x + dx]; o[y * W + x] = s / (2 * r + 1) ** 2; } return o; };
  const b1 = box(1), b2 = box(2), blocks = [];
  for (let by = 8; by < H - 16; by += 8) for (let bx = 8; bx < W - 16; bx += 8) {
    let sm = 0, sm2 = 0, h2 = 0;
    for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 8; x++) { const i = y * W + x; sm += b2[i]; sm2 += b2[i] ** 2; h2 += (Y[i] - b1[i]) ** 2; }
    blocks.push({ flat: sm2 / 64 - (sm / 64) ** 2, hp: Math.sqrt(h2 / 64) });
  }
  blocks.sort((a, b) => a.flat - b.flat);
  const flat = blocks.slice(0, Math.round(blocks.length * 0.2)).map((b) => b.hp).sort((a, b) => a - b);
  return { sharpRatio: edge / mid, rms: Math.sqrt(v2 / n) / 255, sat: sat / n, chroma: chroma / n, black: sorted[Math.floor(n * 0.01)], grain: flat[flat.length >> 1] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = process.argv.slice(2).map((spec) => {
    const at = spec.lastIndexOf('@'), src = spec.slice(0, at), t = spec.slice(at + 1);
    const r = { src: src.split('/').pop(), t, ...metrics(frame(src, t)) };
    console.log(JSON.stringify(r, (k, v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v)));
    return r;
  });
  const keys = ['sharpRatio', 'rms', 'sat', 'chroma', 'black', 'grain'];
  const mean = Object.fromEntries(keys.map((k) => [k, Math.round(rows.reduce((s, r) => s + r[k], 0) / rows.length * 1e4) / 1e4]));
  console.log(JSON.stringify({ mean }));
}
