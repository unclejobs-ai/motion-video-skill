// The camera and every timed value at frame f — pure, no React/remotion imports. Wordcut.tsx paints it and track.ts
// hands the same numbers to the carry probe.
// Carry: the word sits in one slot (slotOf) for the whole film. Each sheet is placed so its own copy of the word lies
// under the slot (offsets measured once from the static layout), and the slot word drawn on top is that sheet's own
// word at rest. Whips move and blur the sheets, never the slot.
import type { Aspect } from './data.ts';
import { WORDCUT as T, kindOf, type Dir } from './timing.ts';

/** Design viewport in CSS px (sheet CSS is written for it), output size, and camera framing per aspect. */
export const VIEW = {
  '9x16': { w: 390, h: 693.33, out: [1080, 1920] as const, close: 1.6, slotY: 0.44 },
  '16x9': { w: 1280, h: 720, out: [1920, 1080] as const, close: 2.2, slotY: 0.44 },
} as const;

export const slotOf = (a: Aspect) => ({ x: VIEW[a].w / 2, y: VIEW[a].h * VIEW[a].slotY });

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const prog = (f: number, from: number, frames: number) => clamp((f - from) / Math.max(1, frames), 0, 1);
export const ease = {
  in: (x: number) => x * x * x,
  out: (x: number) => 1 - (1 - x) ** 3,
  io: (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
};
const D: Record<Dir, readonly [number, number]> = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1], n: [0, 0] };

export function cutAt(f: number): number {
  let i = 0;
  for (let k = 1; k < T.cuts.length; k++) if (f >= T.cuts[k].f) i = k;
  return i;
}

export type Cam = {
  i: number;
  /** sheet offset in design px, and its blur along x / y (directional motion blur) */
  dx: number; dy: number; bx: number; by: number;
  /** sheet scale about the slot */
  scale: number;
  /** highlighter width 0..1 on the textbook landing (1 everywhere else) */
  hl: number;
};

/** The textbook's word size at the end of its push, so the dictionary head word continues it without a jump. */
export const textbookEndScale = (a: Aspect) => VIEW[a].close * (1 + T.textbook.push);
/** dictionary head font size (design px): the textbook's end size × its 17 px body */
export const dictHeadPx = (a: Aspect) => 17 * textbookEndScale(a);

export function cam(f: number, a: Aspect): Cam {
  const V = VIEW[a];
  const i = cutAt(f), cur = T.cuts[i], next = T.cuts[i + 1];
  const since = f - cur.f;
  let dx = 0, dy = 0, blur = 0, dir: Dir = cur.d;
  if (cur.d !== 'n' && since < T.refocus.length) {
    if (since === 0) { dx = -D[cur.d][0] * V.w * T.whip.inShift; dy = -D[cur.d][1] * V.w * T.whip.inShift; }
    blur = since === 0 ? T.whip.inBlur : T.refocus[since];
  }
  // the outgoing sheet's last frame already flies off in the next whip's direction
  if (next && next.d !== 'n' && f === next.f - 1) {
    dx = D[next.d][0] * V.w * T.whip.outShift; dy = D[next.d][1] * V.w * T.whip.outShift;
    blur = T.whip.outBlur; dir = next.d;
  }
  const horizontal = dir === 'l' || dir === 'r';
  const bx = horizontal ? blur : blur * 0.15, by = horizontal ? blur * 0.15 : blur;

  const kind = kindOf(cur.k);
  let scale = kind === 'dict' ? 1 : V.close;
  if (kind === 'textbook') scale *= 1 + T.textbook.push * ease.io(prog(f, T.textbook.pushFrom, T.textbook.pushTo - T.textbook.pushFrom));
  if (kind === 'dict') scale = 1 + T.dict.push * ease.io(prog(f, cur.f, T.seconds * T.fps - cur.f));
  const hl = kind === 'textbook' ? ease.out(prog(f, T.textbook.hlFrom, T.textbook.hlFrames)) : 1;
  return { i, dx, dy, bx, by, scale, hl };
}

// ---- beat-local values ----
/** textbook: letters on the word's line scatter, then the rest of the page empties out */
export function textbookScatter(f: number) {
  const p = ease.in(prog(f, T.textbook.scatterFrom, T.textbook.scatterFrames));
  const q = prog(f, T.textbook.emptyFrom, T.textbook.emptyFrames);
  return { p, q };
}
/** per-letter offset for letter n of the textbook line at scatter progress p */
export function letterOffset(n: number, p: number) {
  const dir = n % 2 ? 1 : -1, r = ((n * 37) % 11) / 11;
  return { x: dir * p * (40 + r * 60), y: (r - 0.5) * p * 50, o: 1 - p };
}
/** dictionary definition n stacks in */
export function dictDef(f: number, n: number) {
  const a = ease.out(prog(f, T.dict.defFrom + n * T.dict.defStep, T.dict.defFrames));
  return { o: a, y: (1 - a) * 10, x: 0 };
}
