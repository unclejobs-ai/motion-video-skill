// The contract for the one-word cut (picture: Wordcut.tsx/scene.ts, probe: track.ts, checks: drift.mjs, score: MUSIC).
// Built from data.ts (what is shown) and plan.ts (how long, from the reference). Every time is an integer frame so a
// whip never straddles two frames. Structure: the first sheet holds, the next sheets land one per `hold`, a burst of
// hard cuts every `burstStep` cycles through the sheets, then the textbook (letters scatter) and the dictionary.
import { DATA, type SheetKind } from './data.ts';
import { PLAN } from './plan.ts';

export type Dir = 'l' | 'r' | 'u' | 'd' | 'n';
/** a sheet index into DATA.sheets, or one of the two ending pages */
export type SheetRef = number | 'textbook' | 'dict';
export type Cut = { k: SheetRef; f: number; d: Dir };

export function buildCuts(nSheets: number, plan: typeof PLAN): { cuts: Cut[]; burst: number[]; dictAt: number } {
  const dirs = [...plan.dirs] as Dir[];
  const dir = (n: number) => dirs[n % dirs.length];
  const slow = Math.min(nSheets, Math.max(1, Math.ceil(nSheets * 0.6)));
  const cuts: Cut[] = [{ k: 0, f: 0, d: 'n' }];
  let f = plan.open;
  for (let i = 1; i < slow; i++, f += plan.hold) cuts.push({ k: i, f, d: dir(i - 1) });
  const burst: number[] = [];
  for (let n = 0; n < plan.burstCount; n++, f += plan.burstStep) {
    cuts.push({ k: (slow + n) % nSheets, f, d: dir(slow + n) });
    burst.push(f);
  }
  cuts.push({ k: 'textbook', f, d: 'u' });
  const dictAt = f + plan.textbook;
  cuts.push({ k: 'dict', f: dictAt, d: 'n' });
  return { cuts, burst, dictAt };
}

/** One word in focus per shot, and every shot varies angle, scale and depth of field (a reference contact sheet mixes
 *  pages on a desk, phones held up and flat screens; close, closer, very close). push multiplies the close-up scale; rx
 *  tilts the page back like paper on a desk (+) or a phone held up (−) and rz rolls it, both about the word, degrees;
 *  dof is the blur of the first ring round the word as a fraction of the frame height (rings 2 and 3 take 2× and 4×);
 *  split is the RGB offset on the out-of-focus rings (design px); ground shows round the page (null: the sheet's
 *  paper); light and grain scale the lens (the light's streak angle also turns per shot). The presets cycle, so no
 *  two neighbours share tilt + push + dof. */
export type Shot = { push: number; rx: number; rz: number; dof: number; split: number; ground: string | null; light: number; grain: number };
export const SHOT_PRESETS: Shot[] = [
  { push: 1, rx: 0, rz: 0, dof: 0.006, split: 1.1, ground: null, light: 1, grain: 2 }, // flat, close
  { push: 1.25, rx: 26, rz: -4, dof: 0.009, split: 1.2, ground: '#3a2f25', light: 1.4, grain: 1.5 }, // page on a desk
  { push: 1.5, rx: 0, rz: 1.5, dof: 0.009, split: 1.2, ground: null, light: 0.7, grain: 3 }, // very close, flat
  { push: 1.15, rx: -14, rz: 3, dof: 0.006, split: 1, ground: '#1c1d20', light: 0.5, grain: 1.5 }, // phone held up
  { push: 1.6, rx: 18, rz: 0, dof: 0.0075, split: 1.2, ground: '#22302a', light: 1.2, grain: 2 }, // very close, on a desk
  { push: 1, rx: 0, rz: -2, dof: 0.0045, split: 0.8, ground: null, light: 0.7, grain: 1 }, // flat, shallow
];
/** the ending pages stay flat at push 1 (the dictionary continues the textbook's word size) */
const ENDING_SHOT: Record<'textbook' | 'dict', Shot> = {
  textbook: { push: 1, rx: 0, rz: 0, dof: 0.0055, split: 1, ground: null, light: 1, grain: 1.5 },
  dict: { push: 1, rx: 0, rz: 0, dof: 0.003, split: 0.6, ground: null, light: 1, grain: 1.5 },
};

const { cuts, burst, dictAt } = buildCuts(DATA.sheets.length, PLAN);
const tb = cuts[cuts.length - 2].f, tbLen = dictAt - tb;

export const WORDCUT = {
  fps: PLAN.fps,
  seconds: PLAN.seconds,
  cuts,
  whip: PLAN.whip,
  refocus: PLAN.refocus,
  textbook: {
    pushFrom: tb, pushTo: dictAt, push: 0.035, hlFrom: tb + 12, hlFrames: 12,
    scatterFrom: tb + Math.round(tbLen * 0.6), scatterFrames: Math.round(tbLen * 0.3),
    emptyFrom: tb + Math.round(tbLen * 0.77), emptyFrames: Math.round(tbLen * 0.23),
  },
  /** the camera keeps pushing in on the dictionary entry while the definitions stack in */
  dict: { push: 0.15, defFrom: dictAt + 15, defStep: 16, defFrames: 14 },
  /** closing image (DATA.closing): fades in over the last 2 s and holds */
  closing: { from: PLAN.seconds * PLAN.fps - 2 * PLAN.fps, frames: 15 },
  /** frame 0 is a mid-shot, not a page: the opener (cut 0) is pushed in past the page so the word's line runs off both
   *  edges, a focus band keeps only that line and its neighbours sharp, and an RGB split is on. Both rack open over
   *  `rack` frames to the shot's `dof` / `splitRest`. Blur and split are fractions of the frame height. frame0.mjs checks it. */
  opener: { push: { '9x16': 1.4, '16x9': 2 }, rack: 9, band: 0.008, split: 0.0035, splitRest: 0.0006 },
  /** one shot per cut (same index as `cuts`); focus.mjs checks the focus on every landing */
  shots: cuts.map((c, i) => (c.k === 'textbook' || c.k === 'dict' ? ENDING_SHOT[c.k] : SHOT_PRESETS[i % SHOT_PRESETS.length])),
  /** the burst is hard cuts with a one-frame whip; declared as cuts to the probe */
  burst,
} as const;

export const kindOf = (k: SheetRef): SheetKind | 'textbook' | 'dict' => (typeof k === 'number' ? DATA.sheets[k].kind : k);

/** what pipeline/score.mjs reads: a hit on every landing outside the burst, plus the dictionary */
export const MUSIC = { seconds: PLAN.seconds, bpm: 120, hits: cuts.slice(1).filter((c) => !burst.includes(c.f)).map((c) => c.f / PLAN.fps) };
