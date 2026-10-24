// The state of every element at time t — a pure function with no React/remotion imports, so the picture
// (CarryDemo.tsx) and the carry probe's track (track.ts) read the same numbers and cannot drift apart.
import { irisRadius } from '../../motions/iris/iris.ts';
import { ease, progress } from '../../motions/_lib/ease.ts';
import { CARRY_DEMO as T } from './timing.ts';

/** the first word is carried across the iris: it lifts from its line to a label above the big line and shrinks */
export const LABEL = { lift: -200, scale: 0.4 } as const;
const INK = [0x1d, 0x1d, 0x1f], GREY = [0xa1, 0xa1, 0xa6];

export function scene(t: number) {
  const rise = ease.out(progress(t, T.riseAt, 0.5));
  const carry = ease.swipe(progress(t, T.iris.t0, T.iris.d));
  const pop = ease.back(progress(t, T.bigAt, 0.3));
  return {
    /** white layer, removed when the iris has closed over it */
    paper: t < T.iris.t0 + T.iris.d,
    /** ink layer revealed through the iris: radius in CSS circle() percent, null before it starts */
    inkRadius: t >= T.iris.t0 ? irisRadius(t, T.iris) : null,
    lead: {
      opacity: rise,
      dy: 50 * (1 - rise) + LABEL.lift * carry,
      scale: 1 + (LABEL.scale - 1) * carry,
      /** ink on paper → grey that reads on both grounds while the iris passes behind it */
      color: `rgb(${INK.map((c, i) => Math.round(c + (GREY[i] - c) * carry)).join(', ')})`,
    },
    big: { opacity: pop, scale: 0.6 + 0.4 * pop },
    tail: { opacity: ease.out(progress(t, T.tailAt, 0.4)) },
  };
}
