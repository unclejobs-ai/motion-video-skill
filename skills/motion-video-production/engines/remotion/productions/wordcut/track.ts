// What the word cut declares to the carry probe, in output px of one aspect (WORDCUT_ASPECT, default DATA.aspect).
// Each source sheet fills the frame with its own paper, so it is declared as a full-frame element that whips with
// the sheet offset. The slot is the word's box: centred on the slot, its size the sheet's word size × camera scale
// (word sizes are the CSS sizes in sheets.css.ts for the element that holds the {w}; Hangul is 1 em per syllable,
// Latin about 0.6 em per letter, plus the .12 em side padding). From the textbook on, the paper under the word is one
// element ('paper'): the same blank page the textbook empties out and the dictionary writes on.
import type { Box, Film } from '../../pipeline/carry.ts';
import { DATA, type Aspect, type Sheet } from './data.ts';
import { VIEW, cam, dictDef, dictHeadPx, slotOf, textbookScatter } from './scene.ts';
import { WORDCUT as T, kindOf } from './timing.ts';

const aspect: Aspect = process.env.WORDCUT_ASPECT === '16x9' || process.env.WORDCUT_ASPECT === '9x16' ? process.env.WORDCUT_ASPECT : DATA.aspect;
const V = VIEW[aspect], k = V.out[0] / V.w, S = slotOf(aspect);
const has = (s: string | undefined) => !!s && s.includes('{w}');

/** font size (design px) of the element that holds the word, from sheets.css.ts */
export function wordPx(s: Sheet): number {
  switch (s.kind) {
    case 'post': return has(s.title) ? 21 : 16;
    case 'receipt': return 14;
    case 'qa': return has(s.q) ? 20 : 16;
    case 'news': return has(s.headline) ? 24 : 15;
    case 'chat': return 16;
    case 'subtitle': return 19;
    case 'memo': return 17;
    case 'search': return 20;
    case 'diary': return 18;
    case 'notice': return 15;
  }
}
const ems = [...DATA.word].reduce((n, ch) => n + (/[ㄱ-힝]/.test(ch) ? 1 : 0.6), 0) + 0.24;

const R = (id: string, x: number, y: number, w: number, h: number, opacity = 1, role: Box['role'] = 'element'): Box =>
  ({ id, role, x: x * k, y: y * k, w: w * k, h: h * k, opacity });

export function track(t: number): Box[] {
  const f = Math.round(t * T.fps);
  const c = cam(f, aspect), cur = T.cuts[c.i].k, kind = kindOf(cur);
  const boxes: Box[] = [R('ground', 0, 0, V.w, V.h, 1, 'ground')];
  if (kind === 'textbook' || kind === 'dict') {
    boxes.push(R('paper', 0, 0, V.w, V.h));
    if (kind === 'textbook') boxes.push(R('textbook', 0, S.y - V.h * 0.3, V.w, V.h * 0.6, 1 - textbookScatter(f).q));
    if (kind === 'dict') DATA.dict.forEach((_, n) => boxes.push(R(`def-${n}`, V.w * 0.1, S.y + 30 + n * 30, V.w * 0.8, 26, dictDef(f, n).o)));
  } else {
    boxes.push(R(`sheet-${String(cur)}`, c.dx, c.dy, V.w, V.h));
  }
  const base = typeof cur === 'number' ? wordPx(DATA.sheets[cur]) : kind === 'dict' ? dictHeadPx(aspect) : 17;
  const px = base * c.scale, w = px * ems, h = px * 1.3;
  boxes.push(R('slot', S.x - w / 2, S.y - h / 2, w, h));
  return boxes;
}

export const film: Film = {
  width: V.out[0], height: V.out[1], fps: T.fps, seconds: T.seconds, track, cuts: T.burst.map((f) => f / T.fps),
  beatBoundaries: T.cuts.slice(1).map((cut) => cut.f / T.fps),
};
