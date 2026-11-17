import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bridge, cards, composed, finalTime, joinRows, noPeek, peekSpots, validatePlan } from './timeline-gates.ts';
import type { Chapter, Plan, Row } from './timeline-gates.ts';

const rows: Row[] = [
  { id: 'title', start: 0, length: 4, clip: 4, fadeIn: false, fadeOut: true },
  { id: 'detail', start: 4.5, length: 4, clip: 4, fadeIn: true, fadeOut: true },
];
const chapter: Chapter = { n: 1, length: 12, pauses: [], rows };
const plan: Plan = { fps: 30, fadeIn: 0.2, fadeOut: 0.2, chapters: [chapter] };

test('an exposed half-second join fails; holding until the next overlay is opaque passes', () => {
  assert.match(noPeek(chapter, rows, plan)[0].message, /between title and detail/);
  const held = joinRows(rows, plan);
  assert.deepEqual(noPeek(chapter, held, plan), []);
  assert.deepEqual(cards(chapter, held, plan), []);
  assert.equal(rows[0].length, 4);
  assert.equal(held[0].fadeOut, false);
  assert.ok(held[0].length >= 4.7);
  assert.deepEqual(peekSpots(held), [4.5, 0, held[0].length]);
});

test('a 15-second pause card fails; a 9-second card passes', () => {
  const ch = { ...chapter, rows: [], pauses: [{ at: 5, seconds: 15, id: 'card' }] };
  assert.match(cards(ch, [], plan)[0].message, /15.0 s > 9 s/);
  assert.deepEqual(cards({ ...ch, pauses: [{ ...ch.pauses[0], seconds: 9 }] }, [], plan), []);
});

test('a source pause and a held card cannot stack even below nine seconds', () => {
  const ch = { ...chapter, pauses: [{ at: 5, seconds: 2, id: 'title' }] };
  const held = [{ ...rows[0], length: 6 }];
  assert.match(cards(ch, held, plan)[0].message, /pause and the held title/);
});

test('a 2-second bridge fails; a 3.5-second bridge passes', () => {
  assert.match(bridge({ ...chapter, bridgeAfter: 2 }, plan)[0].message, /2 s < 3.5 s/);
  assert.deepEqual(bridge({ ...chapter, bridgeAfter: 3.5 }, plan), []);
});

test('items are composed at chapter edges and pauses map source to final time', () => {
  const ch: Chapter = { n: 2, length: 12, offset: 20, pauses: [{ at: 3, seconds: 2, id: 'pause' }],
    items: [{ id: 'title', start: 0.5, end: 2, clip: 2 }] };
  const [row] = composed(ch, plan);
  assert.equal(row.start, 0);
  assert.equal(row.fadeIn, false);
  assert.equal(row.fadeOut, false);
  assert.equal(finalTime(ch, 4, 30), 26);
});

test('plan validation rejects invalid timing, unordered rows and missing fields', () => {
  assert.doesNotThrow(() => validatePlan(plan));
  for (const bad of [null, {}, { ...plan, fps: 0 }, { ...plan, chapters: [] },
    { ...plan, chapters: [{ ...chapter, rows: rows.toReversed() }] },
    { ...plan, chapters: [{ ...chapter, rows: [{ ...rows[0], length: -1 }] }] }]) {
    assert.throws(() => validatePlan(bad));
  }
});
