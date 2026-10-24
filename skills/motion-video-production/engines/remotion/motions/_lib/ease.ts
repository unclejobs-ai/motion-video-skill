// Easing curves shared by every motion module. Pure functions of progress u ∈ [0, 1] → eased progress.
// Names match the motion vocabulary in the art-direction reference.

export type Ease = (u: number) => number;

/** CSS cubic-bezier(x1, y1, x2, y2), solved for x by Newton iterations with a bisection fallback. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const bx = (s: number) => 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s ** 2 * (1 - s) + s ** 3;
  const by = (s: number) => 3 * y1 * s * (1 - s) ** 2 + 3 * y2 * s ** 2 * (1 - s) + s ** 3;
  const dx = (s: number) => 3 * x1 * (1 - s) ** 2 + 6 * (x2 - x1) * s * (1 - s) + 3 * (1 - x2) * s ** 2;
  return (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let s = u;
    for (let i = 0; i < 8; i++) {
      const err = bx(s) - u;
      if (Math.abs(err) < 1e-7) return by(s);
      const d = dx(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0, hi = 1;
    s = u;
    for (let i = 0; i < 40; i++) {
      if (bx(s) < u) lo = s; else hi = s;
      s = (lo + hi) / 2;
    }
    return by(s);
  };
}

export const ease = {
  /** opens, slides */
  out: cubicBezier(0.22, 1, 0.36, 1),
  /** entrances with overshoot */
  back: cubicBezier(0.34, 1.56, 0.64, 1),
  /** exits that leave the frame */
  in: cubicBezier(0.4, 0, 1, 1),
  /** wipes and pushes */
  swipe: cubicBezier(0.65, 0, 0.35, 1),
  linear: (u: number) => Math.min(1, Math.max(0, u)),
} satisfies Record<string, Ease>;

/** Progress of a window that starts at t0 and lasts d seconds, clamped to [0, 1]. */
export const progress = (t: number, t0: number, d: number) => Math.min(1, Math.max(0, (t - t0) / d));
