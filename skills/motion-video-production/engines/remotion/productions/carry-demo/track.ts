// What carry-demo declares to the carry probe (pipeline/carry.ts): screen boxes per element over time, built from the
// same scene() the picture renders, so positions cannot drift. Text boxes are the glyph ink boxes at rest, measured
// on renderStill PNGs (ink = any channel > 48 away from the ground), then moved/scaled the way CarryDemo.tsx does.
import type { Box, Film } from '../../pipeline/carry.ts';
import { scene } from './scene.ts';
import { CARRY_DEMO as T } from './timing.ts';

const W = 1920, H = 1080;
/** CSS circle() percent is of sqrt((w² + h²) / 2) */
const CIRCLE_BASE = Math.hypot(W, H) / Math.SQRT2;

/** glyph ink boxes at rest (x, y, w, h), measured on Pretendard 1.3.9 stills at 1.5 s (lead) and 3.0 s (big, tail) */
const REST = {
  lead: { x: 700, y: 435, w: 519, h: 135 },
  big: { x: 591, y: 387, w: 737, h: 254 },
  tail: { x: 842, y: 727, w: 239, h: 65 },
};
/** centre of each scaled text div (transform origin): x centre of the 1920 line, top + fontSize × 1.1 / 2 */
const ORIGIN = { lead: [960, 420 + 165 / 2], big: [960, 360 + 308 / 2] } as const;

type Rect = { x: number; y: number; w: number; h: number };
const scaled = (r: Rect, [ox, oy]: readonly [number, number], s: number): Rect =>
  ({ x: ox + (r.x - ox) * s, y: oy + (r.y - oy) * s, w: r.w * s, h: r.h * s });

export function track(t: number): Box[] {
  const s = scene(t);
  const full = { x: 0, y: 0, w: W, h: H, opacity: 1 };
  const boxes: Box[] = [{ id: 'ink', role: 'ground', ...full }];
  if (s.paper) boxes.push({ id: 'paper', role: 'ground', ...full });
  if (s.inkRadius !== null) {
    const clip = { cx: W / 2, cy: H / 2, r: (s.inkRadius / 100) * CIRCLE_BASE };
    boxes.push({ id: 'ink', role: 'ground', ...full, clip });
    boxes.push({ id: 'big', role: 'element', ...scaled(REST.big, ORIGIN.big, s.big.scale), opacity: Math.min(1, s.big.opacity), clip });
    boxes.push({ id: 'tail', role: 'element', ...REST.tail, opacity: s.tail.opacity, clip });
  }
  const lead = scaled(REST.lead, ORIGIN.lead, s.lead.scale);
  boxes.push({ id: 'lead', role: 'element', ...lead, y: lead.y + s.lead.dy, opacity: s.lead.opacity });
  return boxes;
}

export const film: Film = { width: W, height: H, fps: T.fps, seconds: T.seconds, track, cuts: [], beatBoundaries: [T.bigAt] };
