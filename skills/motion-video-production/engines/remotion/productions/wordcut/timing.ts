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
  /** the burst is hard cuts with a one-frame whip; declared as cuts to the probe */
  burst,
} as const;

export const kindOf = (k: SheetRef): SheetKind | 'textbook' | 'dict' => (typeof k === 'number' ? DATA.sheets[k].kind : k);

/** what pipeline/score.mjs reads: a hit on every landing outside the burst, plus the dictionary */
export const MUSIC = { seconds: PLAN.seconds, bpm: 120, hits: cuts.slice(1).filter((c) => !burst.includes(c.f)).map((c) => c.f / PLAN.fps) };
