// Pure checks over chapter-source seconds: covered joins, bounded cards and chapter bridges.
// shortcut: short shots after an overlay need source cut times; add that check when plans carry them.
import { readFileSync } from 'node:fs';

export const TIMELINE: { joinGap: number; cardMax: number; bridgeMin: number } =
  JSON.parse(readFileSync(new URL('./verify-limits.json', import.meta.url), 'utf8')).timeline;

/** a motion as planned: shown from start to end (null = its clip length); a clip shorter than that holds its last frame */
export type Item = { id: string; start: number; end: number | null; clip: number };
/** a motion as composed: length past `clip` is the held last frame */
export type Row = { id: string; start: number; length: number; clip: number; fadeIn: boolean; fadeOut: boolean };
/** the source stops at `at` (video and audio) while clip `id` plays full frame for `seconds` */
export type Pause = { at: number; seconds: number; id: string };
export type Chapter = { n: number; length: number; offset?: number; bridgeAfter?: number; pauses: Pause[]; items?: Item[]; rows?: Row[] };
export type Plan = { fps: number; fadeIn: number; fadeOut: number; chapters: Chapter[] };
export type Gate = 'no-peek' | 'card' | 'bridge';
export type Failure = { gate: Gate; n: number; t: number; message: string };

export const REASON: Record<Gate, string> = {
  'no-peek': 'a flash of source footage between overlays reads as a broken cut',
  card: 'long or stacked holds make a card linger',
  bridge: 'a chapter bridge needs time to read',
};

/** Validate external JSON before timing arithmetic; explicit rows must be in compositor order. */
export function validatePlan(value: unknown): asserts value is Plan {
  const p = value as Plan;
  const num = (x: unknown, min = 0): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min;
  const valid = p && num(p.fps, 1) && num(p.fadeIn) && num(p.fadeOut) && Array.isArray(p.chapters) && p.chapters.length > 0 &&
    p.chapters.every((ch) => ch && num(ch.n, 1) && num(ch.length, 0.001) &&
      (ch.offset === undefined || num(ch.offset)) && (ch.bridgeAfter === undefined || num(ch.bridgeAfter)) &&
      Array.isArray(ch.pauses) && ch.pauses.every((s) => s && typeof s.id === 'string' && num(s.at) && s.at <= ch.length && num(s.seconds, 0.001)) &&
      (Array.isArray(ch.rows) || Array.isArray(ch.items)) &&
      (ch.rows === undefined || (Array.isArray(ch.rows) && ch.rows.every((r, i) => r && typeof r.id === 'string' &&
        num(r.start) && r.start < ch.length && num(r.length, 0.001) && num(r.clip, 0.001) &&
        typeof r.fadeIn === 'boolean' && typeof r.fadeOut === 'boolean' && (i === 0 || r.start >= ch.rows![i - 1].start)))) &&
      (ch.items === undefined || (Array.isArray(ch.items) && ch.items.every((it) => it && typeof it.id === 'string' &&
        num(it.start) && it.start < ch.length && num(it.clip, 0.001) && (it.end === null || num(it.end, it.start + 0.001))))));
  if (!valid) throw new Error('invalid timeline plan: see references/verification.md for the schema');
}

const pausePoints = (ch: Chapter, fps: number) => ch.pauses.map((p) => ({ ...p, at: Math.round(p.at * fps) / fps }));

/** where chapter time t lands in the final file: chapter offset (0 if unset) + pauses inserted before t */
export const finalTime = (ch: Chapter, t: number, fps: number) =>
  (ch.offset ?? 0) + t + pausePoints(ch, fps).filter((p) => p.at < t).reduce((sum, p) => sum + p.seconds, 0);

function where(ch: Chapter, t: number, fps: number): string {
  const head = `ch${ch.n} ${t.toFixed(2)} s`;
  if (ch.offset === undefined) return head;
  const s = Math.round(finalTime(ch, t, fps) * 10) / 10;
  return `${head} (final ${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')})`;
}

/** Items → rows, snapped to chapter edges and pause points. */
export function placeRows(ch: Chapter, plan: Plan): Row[] {
  const D = ch.length, gap = TIMELINE.joinGap, f = 1 / plan.fps;
  const rows = (ch.items ?? []).map((it): Row => ({
    id: it.id, start: it.start, length: Math.min(it.end === null ? it.clip : it.end - it.start, D - it.start), clip: it.clip, fadeIn: true, fadeOut: true,
  })).sort((a, b) => a.start - b.start);
  const pauses = pausePoints(ch, plan.fps);
  for (const r of rows) {
    if (r.start < gap) { r.length += r.start; r.start = 0; r.fadeIn = false; } // chapter opens on this motion
    if (D - (r.start + r.length) < gap) { r.length = D - r.start; r.fadeOut = false; } // chapter closes on it
    for (const { at } of pauses) {
      const end = r.start + r.length;
      if ((at - end >= 0 && at - end < gap) || (r.start < at && at <= end)) { r.length = at - r.start + f; r.fadeOut = false; } // runs into the pause
      if (r.start - at >= 0 && r.start - at < gap) { r.length += r.start - at; r.start = at; r.fadeIn = false; } // right after it
    }
  }
  return rows;
}

/** The hold/join step: a motion less than joinGap before the next holds (no fade-out) until the next is opaque. */
export function joinRows(rows: Row[], plan: Plan): Row[] {
  const out = rows.map((r) => ({ ...r }));
  for (let i = 0; i + 1 < out.length; i++) {
    const a = out[i], b = out[i + 1];
    if (b.start - (a.start + a.length) < TIMELINE.joinGap) { a.length = b.start + plan.fadeIn + 1 / plan.fps - a.start; a.fadeOut = false; }
  }
  return out;
}

export const composed = (ch: Chapter, plan: Plan): Row[] => ch.rows ?? joinRows(placeRows(ch, plan), plan);

/** (a) footage must not show between two motions, at a chapter edge next to a motion, or between a motion and a pause. */
export function noPeek(ch: Chapter, rows: Row[], plan: Plan): Failure[] {
  const D = ch.length, gap = TIMELINE.joinGap, out: Failure[] = [];
  const fail = (t: number, what: string) => out.push({ gate: 'no-peek', n: ch.n, t, message: `${where(ch, t, plan.fps)}: footage shows ${what} — ${REASON['no-peek']}` });
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i], b = rows[i + 1], end = a.start + a.length, g = b.start - end;
    if (!(g >= gap || (!a.fadeOut && end >= b.start + plan.fadeIn)))
      fail(end, `between ${a.id} and ${b.id} (${g.toFixed(2)} s apart, ${a.id} not held until ${b.id} is opaque)`);
  }
  for (const r of rows) {
    const end = r.start + r.length;
    if (r.start > 0 && r.start < gap) fail(0, `before ${r.id} at the chapter start`);
    if (D - end > 0 && D - end < gap && r.fadeOut) fail(end, `after ${r.id} at the chapter end`);
  }
  for (const { at } of pausePoints(ch, plan.fps)) for (const r of rows) {
    const end = r.start + r.length;
    if (at - end > 0 && at - end < gap && r.fadeOut) fail(end, `between ${r.id} and the pause at ${at.toFixed(2)} s`);
    if (r.start - at > 0 && r.start - at < gap) fail(at, `between the pause at ${at.toFixed(2)} s and ${r.id}`);
  }
  return out;
}

/** (b) a card = a motion's held last frame plus any source pause that touches that motion. */
export function cards(ch: Chapter, rows: Row[], plan: Plan): Failure[] {
  const f = 1 / plan.fps, out: Failure[] = [];
  const fail = (t: number, what: string) => out.push({ gate: 'card', n: ch.n, t, message: `${where(ch, t, plan.fps)}: ${what} — ${REASON.card}` });
  const pauses = pausePoints(ch, plan.fps), used = new Set<Pause>();
  rows.forEach((r, i) => {
    const next = rows[i + 1]; // frames under the next motion are covered by it, not a card
    const held = Math.max(0, Math.min(r.length, next && next.start < r.start + r.length ? next.start - r.start : Infinity) - r.clip);
    const touching = pauses.filter((p) => r.start - f <= p.at && p.at <= r.start + r.length + f);
    touching.forEach((p) => used.add(p));
    const paused = touching.reduce((s, p) => s + p.seconds, 0), shown = held + paused;
    const t = Math.min(r.start + Math.min(r.clip, r.length), ...touching.map((p) => p.at));
    if (held > f && paused > 0) fail(t, `the source pause and the held ${r.id} share one card (pause ${paused.toFixed(1)} s + held ${held.toFixed(1)} s)`);
    if (shown > TIMELINE.cardMax) fail(t, `card ${r.id} shown ${shown.toFixed(1)} s > ${TIMELINE.cardMax} s (held ${held.toFixed(1)} s + pause ${paused.toFixed(1)} s)`);
  });
  for (const p of pauses) if (!used.has(p) && p.seconds > TIMELINE.cardMax) fail(p.at, `pause card ${p.id} shown ${p.seconds.toFixed(1)} s > ${TIMELINE.cardMax} s`);
  return out;
}

/** (c) the bridge (loading screen) after a chapter. */
export function bridge(ch: Chapter, plan: Plan): Failure[] {
  if (ch.bridgeAfter === undefined || ch.bridgeAfter >= TIMELINE.bridgeMin) return [];
  return [{ gate: 'bridge', n: ch.n, t: ch.length, message: `${where(ch, ch.length, plan.fps)}: bridge after ch${ch.n} is ${ch.bridgeAfter} s < ${TIMELINE.bridgeMin} s — ${REASON.bridge}` }];
}

/** Chapter times where footage could flash in the render : joined starts, a chapter opening
 * on a motion, and every motion end without a fade-out. The picture leg of verify compares frames there. */
export function peekSpots(rows: Row[]): number[] {
  const joins = rows.slice(1).filter((b, i) => b.start - (rows[i].start + rows[i].length) < 0.05).map((b) => b.start);
  return [...joins, ...rows.filter((r) => r.start === 0).map((r) => r.start), ...rows.filter((r) => !r.fadeOut).map((r) => r.start + r.length)];
}
