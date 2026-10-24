import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iris } from './iris.ts';

const P = { t0: 2.2, d: 0.4 };

test('closed before the window, open after it', () => {
  assert.equal(iris(0, P), 'circle(0.000% at 50% 50%)');
  assert.equal(iris(2.2, P), 'circle(0.000% at 50% 50%)');
  assert.equal(iris(2.6, P), 'circle(75.000% at 50% 50%)');
  assert.equal(iris(9, P), 'circle(75.000% at 50% 50%)');
});

test('swipe easing is symmetric: half radius at the midpoint (the beat)', () => {
  assert.equal(iris(2.4, P), 'circle(37.500% at 50% 50%)');
});

test('radius grows monotonically across the window, frame by frame at 60 fps', () => {
  const r = (t: number) => Number(iris(t, P).match(/circle\(([\d.]+)%/)![1]);
  for (let f = 132; f < 156; f++) assert.ok(r((f + 1) / 60) >= r(f / 60), `frame ${f}`);
});

test('centre and final radius are parameters', () => {
  assert.equal(iris(3, { ...P, x: 0, y: 100, to: 150 }), 'circle(150.000% at 0% 100%)');
});
