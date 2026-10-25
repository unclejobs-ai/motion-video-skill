import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probe, type Box, type Film } from './carry.ts';

const ground: Box = { id: 'ground', role: 'ground', x: 0, y: 0, w: 1920, h: 1080, opacity: 1 };
const card = (id: string, x = 660, opacity = 1): Box => ({ id, role: 'element', x, y: 390, w: 600, h: 300, opacity });
const film = (track: (t: number) => Box[], beatBoundaries = [2]): Film =>
  ({ width: 1920, height: 1080, fps: 30, seconds: 5, track, cuts: [], beatBoundaries });

test('replacement on a static ground: one bare boundary, carry 0.00, fail', () => {
  const r = probe(film((t) => [ground, t < 2 ? card('a') : card('b')]));
  assert.deepEqual(r.boundaries.map((b) => [b.kind, b.survivors]), [['bare', []]]);
  assert.ok(Math.abs(r.boundaries[0].t - 2) <= 0.2, `boundary at ${r.boundaries[0].t}`);
  assert.equal(r.score, 0);
  assert.equal(r.verdict, 'fail');
});

test('the same id moves 60 px while the ground changes: carried, 1.00, pass', () => {
  const other: Box = { ...ground, id: 'ink' };
  const r = probe(film((t) => [t < 2 ? ground : other, card('a', t < 2 ? 660 : 720), ...(t >= 2 ? [card('b', 100)] : [])]));
  assert.deepEqual(r.boundaries.map((b) => [b.kind, b.survivors]), [['carried', ['a']]]);
  assert.equal(r.score, 1);
  assert.equal(r.verdict, 'pass');
});

test('a new id fading in at the old card size reads as a replacement (the two-element blind spot)', () => {
  const r = probe(film((t) => [ground, card('a', 660, t < 2 ? 1 : 0), card('b', 660, t < 2 ? 0 : 1)]));
  assert.deepEqual(r.boundaries.map((b) => b.kind), ['bare']);
  assert.equal(r.verdict, 'fail');
});

test('a film with no boundaries warns and never scores 1.00', () => {
  const r = probe(film(() => [ground, card('a')]));
  assert.equal(r.boundaries.length, 0);
  assert.equal(r.score, null);
  assert.equal(r.verdict, 'warn');
  assert.equal(r.notes.length, 1);
});

test('boundaries in the last 1.2 s and at declared cuts are exempt', () => {
  const tail = probe(film((t) => [ground, t < 4.2 ? card('a') : card('b')], []));
  assert.deepEqual(tail.boundaries.map((b) => b.exempt), ['tail']);
  assert.equal(tail.verdict, 'warn');
  const cut = probe({ ...film((t) => [ground, t < 2 ? card('a') : card('b')], []), cuts: [2] });
  assert.deepEqual(cut.boundaries.map((b) => b.exempt), ['cut']);
});

test('a declared cut and the boundary it marks count once: two transitions are not a burst', () => {
  const track = (t: number): Box[] => [{ id: t < 2 ? 'a' : t < 3 ? 'b' : 'c', role: 'element', x: 600, y: 300, w: 600, h: 300, opacity: 1 }];
  const r = probe({ width: 1920, height: 1080, fps: 30, seconds: 6, cuts: [2], beatBoundaries: [2, 3], track });
  assert.deepEqual(r.boundaries.map((b) => b.exempt), ['cut', undefined]);
  assert.equal(r.considered, 1);
  assert.equal(r.score, 0);
  assert.equal(r.verdict, 'fail');
});

test('an entrance onto an empty ground is not a boundary; an exit and a later entrance are bridged into one', () => {
  const entrance = probe(film((t) => [ground, ...(t >= 1 ? [card('a')] : [])], []));
  assert.equal(entrance.boundaries.length, 0);
  const bridged = probe(film((t) => [ground, ...(t < 1.5 ? [card('a')] : t >= 2.5 ? [card('b')] : [])]));
  assert.deepEqual(bridged.boundaries.map((b) => b.kind), ['bare']);
});
