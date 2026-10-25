import { ease, progress, type Ease } from '../_lib/ease.ts';

export type IrisParams = {
  /** transition start, seconds */
  t0: number;
  /** transition length, seconds (0.35–0.45 s reads as a motion transition, shorter as a cut) */
  d: number;
  /** circle centre in % of the frame (default the centre) */
  x?: number;
  y?: number;
  /** final radius in % — 75 covers a 16:9 frame from the centre; use ~150 from a corner */
  to?: number;
  easing?: Ease;
};

/**
 * Iris: the incoming layer is revealed through a growing circle.
 * Returns the CSS `clip-path` for the incoming layer at time t. Before t0 the circle is 0 %, after t0 + d it is `to`.
 */
export function iris(t: number, p: IrisParams): string {
  const { x = 50, y = 50 } = p;
  return `circle(${irisRadius(t, p).toFixed(3)}% at ${x}% ${y}%)`;
}

/** The iris radius at time t in CSS `circle()` percent: of sqrt((w² + h²) / 2) of the layer. */
export function irisRadius(t: number, { t0, d, to = 75, easing = ease.swipe }: IrisParams): number {
  return to * easing(progress(t, t0, d));
}
