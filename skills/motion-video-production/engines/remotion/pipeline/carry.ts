// carry.ts — the continuity oracle (clean-room). Reads what a composition declares with
// `track(t)`, not the video: every frame is rasterised onto a coarse ownership grid (each cell belongs to the
// topmost box that covers it at opacity ≥ 0.5). A boundary is a 0.4 s window in which most of the owned area changes
// identity: the area of ids that disappear or appear, over all area — except a ground present on both sides, which is
// left out entirely (otherwise a static background would hide every swap of the things on it). Moving is not a change
// of identity. Each boundary is carried (an element survives and moves or scales), anchored (a large element survives
// unchanged) or bare (nothing survives). Grounds never survive, so a persistent background cannot anchor.

export type Circle = { cx: number; cy: number; r: number };

/** One screen-space box at time t, in paint order (later boxes are on top). x/y/w/h are the final rect after scale. */
export type Box = { id: string; role: 'ground' | 'element'; x: number; y: number; w: number; h: number; opacity: number; clip?: Circle };

export type Film = {
  width: number;
  height: number;
  fps: number;
  seconds: number;
  track: (t: number) => Box[];
  /** declared hard cuts, seconds — boundaries within the window of one are exempt */
  cuts: readonly number[];
  /** beat boundaries the beat sheet intends — fewer probe boundaries than this is a warning, never a pass */
  beatBoundaries: readonly number[];
};

export type Kind = 'carried' | 'anchored' | 'bare';
export type Boundary = { t: number; change: number; kind: Kind; survivors: string[]; exempt?: 'cut' | 'burst' | 'tail' };
export type Report = { boundaries: Boundary[]; considered: number; score: number | null; verdict: 'pass' | 'warn' | 'fail'; notes: string[] };

export const CARRY = {
  window: 0.4,
  changeShare: 0.5,
  opaque: 0.5,
  grid: [192, 108] as const,
  moveOfDiagonal: 0.02,
  scale: 1.1,
  anchorOfFrame: 0.03,
  burst: { cuts: 3, within: 1.5 },
  tail: 1.2,
  fail: 0.5,
  warn: 0.7,
} as const;

const center = (b: Box) => [b.x + b.w / 2, b.y + b.h / 2] as const;

/** Cells owned by each id at one sample (a cell belongs to the topmost box covering its centre). */
function owned(boxes: Box[], width: number, height: number): Map<string, number> {
  const [gw, gh] = CARRY.grid;
  const cells = new Int32Array(gw * gh).fill(-1);
  boxes.forEach((b, k) => {
    if (b.opacity < CARRY.opaque) return;
    const x0 = Math.max(0, Math.floor((b.x / width) * gw)), x1 = Math.min(gw, Math.ceil(((b.x + b.w) / width) * gw));
    const y0 = Math.max(0, Math.floor((b.y / height) * gh)), y1 = Math.min(gh, Math.ceil(((b.y + b.h) / height) * gh));
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) {
      const px = ((i + 0.5) / gw) * width, py = ((j + 0.5) / gh) * height;
      if (px < b.x || px > b.x + b.w || py < b.y || py > b.y + b.h) continue;
      if (b.clip && Math.hypot(px - b.clip.cx, py - b.clip.cy) > b.clip.r) continue;
      cells[j * gw + i] = k;
    }
  });
  const perBox = new Array<number>(boxes.length).fill(0);
  for (const k of cells) if (k >= 0) perBox[k]++;
  const m = new Map<string, number>();
  boxes.forEach((b, k) => { if (perBox[k]) m.set(b.id, (m.get(b.id) ?? 0) + perBox[k]); });
  return m;
}

/** Elements visible at a sample: they own at least one cell. Keyed by id; a later box with the same id wins. */
function visible(boxes: Box[], owned: Map<string, number>): Map<string, Box> {
  return new Map(boxes.filter((b) => b.role === 'element' && owned.has(b.id)).map((b) => [b.id, b]));
}

export function probe(film: Film): Report {
  const { width, height, fps } = film;
  const n = Math.round(film.seconds * fps), lag = Math.round(CARRY.window * fps);
  const diag = Math.hypot(width, height);
  const boxes = Array.from({ length: n }, (_, f) => film.track(f / fps));
  const areas = boxes.map((b) => owned(b, width, height));
  const grounds = new Set(boxes.flat().filter((b) => b.role === 'ground').map((b) => b.id));

  // Fades through the ground are bridged: the window starts at the last sample before f that showed an element,
  // and a boundary needs something to leave and something to arrive — an entrance onto an empty ground is not one.
  const hasElement = (f: number) => [...areas[f].keys()].some((id) => !grounds.has(id));
  const before = (f: number) => { while (f > 0 && !hasElement(f)) f--; return f; };
  // identity change of window [before(f), f + lag]; runs above the threshold collapse to one boundary at their peak
  const change = (f: number) => {
    const a = areas[before(f)], b = areas[f + lag];
    let gone = 0, came = 0, all = 0;
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      const x = a.get(id) ?? 0, y = b.get(id) ?? 0;
      if (x && y && grounds.has(id)) continue;
      all += x + y;
      if (!y) gone += x;
      if (!x) came += y;
    }
    return gone && came ? (gone + came) / all : 0;
  };
  const found: Boundary[] = [];
  let run: number[] = [];
  const flush = () => {
    if (!run.length) return;
    const peak = Math.max(...run.map(change));
    const ties = run.filter((f) => change(f) === peak);
    const f = ties[Math.floor((ties.length - 1) / 2)];
    const pre = visible(boxes[before(f)], areas[before(f)]), post = visible(boxes[f + lag], areas[f + lag]);
    const survivors = [...pre.keys()].filter((id) => post.has(id));
    const moved = survivors.filter((id) => {
      const a = pre.get(id)!, b = post.get(id)!;
      const [ax, ay] = center(a), [bx, by] = center(b);
      const s = Math.sqrt((b.w * b.h) / (a.w * a.h));
      return Math.hypot(bx - ax, by - ay) >= CARRY.moveOfDiagonal * diag || s >= CARRY.scale || s <= 1 / CARRY.scale;
    });
    const large = survivors.filter((id) => pre.get(id)!.w * pre.get(id)!.h >= CARRY.anchorOfFrame * width * height);
    const kind: Kind = moved.length ? 'carried' : large.length ? 'anchored' : 'bare';
    found.push({ t: (f + lag / 2) / fps, change: peak, kind, survivors });
    run = [];
  };
  for (let f = 0; f + lag < n; f++) {
    if (change(f) > CARRY.changeShare) run.push(f);
    else flush();
  }
  flush();

  // a declared cut marks a detected boundary within one window of it: the same transition, counted once in a burst
  const marks = (c: number, t: number) => Math.abs(c - t) <= CARRY.window;
  const hits = [...found.map((b) => b.t), ...film.cuts.filter((c) => !found.some((b) => marks(c, b.t)))].sort((a, b) => a - b);
  // in a burst: some 1.5 s window that contains the boundary holds ≥ 3 boundaries or declared cuts
  const inBurst = (t: number) => hits.some((t0) => t0 <= t && t - t0 <= CARRY.burst.within
    && hits.filter((h) => h >= t0 && h - t0 <= CARRY.burst.within).length >= CARRY.burst.cuts);
  for (const b of found) {
    if (film.cuts.some((c) => marks(c, b.t))) b.exempt = 'cut';
    else if (inBurst(b.t)) b.exempt = 'burst';
    else if (b.t > film.seconds - CARRY.tail) b.exempt = 'tail';
  }

  const counted = found.filter((b) => !b.exempt);
  const notes: string[] = [];
  if (counted.length < film.beatBoundaries.length) {
    notes.push(`probe found ${counted.length} counted boundaries, the beat sheet has ${film.beatBoundaries.length}: a score over fewer boundaries is not evidence`);
  }
  if (!counted.length) return { boundaries: found, considered: 0, score: null, verdict: 'warn', notes };
  const carried = counted.filter((b) => b.kind === 'carried').length, anchored = counted.filter((b) => b.kind === 'anchored').length;
  const score = (carried + anchored / 2) / counted.length;
  const verdict = score < CARRY.fail ? 'fail' : score < CARRY.warn || notes.length ? 'warn' : 'pass';
  return { boundaries: found, considered: counted.length, score, verdict, notes };
}
