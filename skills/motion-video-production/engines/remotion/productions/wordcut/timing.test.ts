import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA } from './data.ts';
import { PLAN } from './plan.ts';
import { WORDCUT, buildCuts } from './timing.ts';

const count = (s: string) => s.split('{w}').length - 1;

test('every sheet holds the word exactly once', () => {
  DATA.sheets.forEach((s, i) => assert.equal(count(JSON.stringify(s)), 1, `sheet ${i} (${s.kind})`));
  assert.equal(count(JSON.stringify(DATA.textbook)), 0, 'the textbook line marks the word between line[0] and line[1]');
});

test('cuts are integer frames, strictly increasing, and the dictionary keeps at least 2 s', () => {
  const fs = WORDCUT.cuts.map((c) => c.f);
  fs.forEach((f, i) => { assert.ok(Number.isInteger(f)); if (i) assert.ok(f > fs[i - 1], `cut ${i}`); });
  assert.ok(WORDCUT.seconds * WORDCUT.fps - fs[fs.length - 1] >= 2 * WORDCUT.fps);
});

test('structure is fixed: one opener, slow landings, a burst of hard cuts, textbook, dictionary', () => {
  const { cuts, burst } = buildCuts(10, PLAN);
  assert.equal(cuts[0].d, 'n');
  assert.equal(burst.length, PLAN.burstCount);
  assert.deepEqual(cuts.slice(-2).map((c) => c.k), ['textbook', 'dict']);
  assert.deepEqual(burst.slice(1).map((f, i) => f - burst[i]), Array(PLAN.burstCount - 1).fill(PLAN.burstStep));
});
