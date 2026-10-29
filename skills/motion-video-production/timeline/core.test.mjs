import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, normalize, rollOps, serialize, snap, validate } from './core.mjs';

const base = () => normalize({
  bpm: 120, fps: 30,
  cuts: [{ t: 0, d: 2, src: 'clip:01@0', line: 'n1' }, { t: 2, d: 2, src: 'clip:02@0.5' }],
  text: [{ t: 0.5, d: 1, text: 'hello' }],
  audio: [{ id: 'n1', kind: 'voice', file: 'vo/n1.wav', t: 0.5, d: 1 }, { id: 'm', file: 'audio/score.wav', t: 0, d: 4 }],
});
const codes = (ds) => ds.map((d) => d.code).sort();

test('normalize gives ids and audio defaults without touching the input', () => {
  const raw = { bpm: 120, cuts: [{ t: 0, d: 1, src: 'clip:01@0' }] };
  const doc = normalize(raw);
  assert.equal(doc.cuts[0].id, 'c1');
  assert.equal(raw.cuts[0].id, undefined);
  assert.deepEqual(base().audio[1], { id: 'm', kind: 'music', file: 'audio/score.wav', t: 0, d: 4, in: 0, gain: 0, fadeIn: 0, fadeOut: 0 });
});

test('a clean doc has no diagnostics', () => {
  assert.deepEqual(validate(base()), []);
});

test('timing checks mirror the gates', () => {
  const doc = base();
  doc.cuts[1].t = 2.2; // gap and off-beat start
  doc.audio[0].d = 2; // line runs past its cut
  doc.text.push({ id: 't2', t: 1, d: 1, text: 'x' }); // overlaps t1
  assert.deepEqual(codes(validate(doc, { 'vo/n1.wav': 1.5 })), ['A10', 'B02', 'B02', 'B03', 'B05', 'T01']);
});

test('apply is atomic and its inverse restores the doc', () => {
  const doc = base();
  const r = apply(doc, [
    { op: 'update', track: 'text', id: 't1', patch: { text: 'bye', t: 1 } },
    { op: 'create', track: 'text', item: { t: 3, d: 0.5, text: 'new' } },
    { op: 'delete', track: 'audio', id: 'm' },
  ]);
  assert.ok(r.ok);
  assert.equal(r.doc.text.find((x) => x.id === 't2').text, 'new');
  assert.equal(doc.text.length, 1, 'input untouched');
  const back = apply(r.doc, r.inverse);
  assert.ok(back.ok);
  assert.deepEqual(back.doc, doc);
});

test('a bad op refuses the whole batch', () => {
  const r = apply(base(), [{ op: 'update', track: 'text', id: 't1', patch: { text: 'ok' } }, { op: 'update', track: 'text', id: 'nope', patch: {} }]);
  assert.equal(r.ok, false);
  assert.equal(apply(base(), [{ op: 'update', track: 'audio', id: 'm', patch: { gain: 40 } }]).ok, false);
});

test('update with null removes a field and undo brings it back', () => {
  const r = apply(base(), [{ op: 'update', track: 'cuts', id: 'c1', patch: { line: null } }]);
  assert.equal('line' in r.doc.cuts[0], false);
  assert.equal(apply(r.doc, r.inverse).doc.cuts[0].line, 'n1');
});

test('roll edit keeps cuts contiguous and moves the right in-point', () => {
  const doc = base();
  const r = apply(doc, rollOps(doc, 'c1', 2.5));
  assert.ok(r.ok);
  assert.deepEqual(r.doc.cuts.map((c) => [c.t, c.d, c.src]), [[0, 2.5, 'clip:01@0'], [2.5, 1.5, 'clip:02@1']]);
  assert.ok(!codes(r.diagnostics).includes('B03'));
});

test('roll edit stops where the right cut would run out of source', () => {
  const doc = base();
  const r = apply(doc, rollOps(doc, 'c1', 1));
  assert.deepEqual(r.doc.cuts.map((c) => [c.t, c.src]), [[0, 'clip:01@0'], [1.5, 'clip:02@0']]);
});

test('snap goes to the nearest beat', () => {
  assert.equal(snap(base(), 1.26), 1.5);
});

test('serialize keeps the gate fields first and drops empty tracks', () => {
  const doc = normalize({ bpm: 96, cuts: [{ t: 0, d: 1, src: 'clip:01@0' }] });
  assert.deepEqual(Object.keys(JSON.parse(serialize(doc))), ['bpm', 'fps', 'cuts']);
});
