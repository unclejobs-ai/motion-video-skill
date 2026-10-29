// Timeline core: inspect · apply · validate over the project's edit.json.
// Pure functions, no DOM and no Node APIs, so the editor (browser), the server and the agent CLI share one file.
// The shape follows the stage contract the gates already read (bpm, fps, cuts[t, d, src, line?, rate?]) and adds
// two optional tracks the gates ignore: text[] and audio[].
//
//   cuts  [{ id, t, d, src: "clip:<name>@<s>" | "file:<path>@<s>", line?, rate? }]   contiguous from 0
//   text  [{ id, t, d, text }]                                                          captions / on-screen lines
//   audio [{ id, kind: "voice" | "music", file, t, in, d, gain, fadeIn, fadeOut, duck? }]  gain in dB, times in s
//
// apply() takes atomic ops and is all-or-nothing. It returns the new doc and the inverse ops (undo), never mutates.

export const TRACKS = ['cuts', 'text', 'audio'];
const PREFIX = { cuts: 'c', text: 't', audio: 'a' };
const EPS = 1e-6;

const num = (x) => typeof x === 'number' && Number.isFinite(x);
const round = (x, p = 1e4) => Math.round(x * p) / p;
const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

export const beat = (doc) => 60 / doc.bpm;
export const length = (doc) => Math.max(0, ...doc.cuts.map((c) => c.t + c.d));
export const frame = (doc) => 1 / (doc.fps || 30);

/** Fill defaults and ids so every item can be addressed. Returns a new doc. */
export function normalize(raw) {
  const doc = clone(raw) || {};
  doc.fps ??= 30;
  for (const track of TRACKS) doc[track] = Array.isArray(doc[track]) ? doc[track] : [];
  for (const track of TRACKS) {
    const used = new Set(doc[track].map((x) => x.id).filter(Boolean));
    let n = 1;
    for (const x of doc[track]) {
      if (x.id) continue;
      while (used.has(PREFIX[track] + n)) n++;
      x.id = PREFIX[track] + n;
      used.add(x.id);
    }
  }
  for (const a of doc.audio) {
    a.kind ??= 'music';
    a.in ??= 0;
    a.gain ??= 0;
    a.fadeIn ??= 0;
    a.fadeOut ??= 0;
  }
  doc.cuts.sort((a, b) => a.t - b.t);
  return doc;
}

/** Schema problems that make a doc unusable. Empty array means the shape is fine. */
function shapeErrors(doc) {
  const e = [];
  if (!num(doc.bpm) || doc.bpm <= 0) e.push('bpm must be a positive number');
  if (!num(doc.fps) || doc.fps <= 0) e.push('fps must be a positive number');
  for (const track of TRACKS) {
    const ids = new Set();
    for (const x of doc[track]) {
      if (typeof x.id !== 'string' || !x.id) e.push(`${track}: item without id`);
      else if (ids.has(x.id)) e.push(`${track}: duplicate id ${x.id}`);
      ids.add(x.id);
      if (!num(x.t) || x.t < -EPS) e.push(`${track} ${x.id}: t must be >= 0`);
      if (!num(x.d) || x.d <= 0) e.push(`${track} ${x.id}: d must be > 0`);
    }
  }
  for (const c of doc.cuts) if (typeof c.src !== 'string' || !/^(clip|file):[^@]+@[0-9.]+$/.test(c.src)) e.push(`cuts ${c.id}: src must be clip:<name>@<s> or file:<path>@<s>`);
  for (const x of doc.text) if (typeof x.text !== 'string') e.push(`text ${x.id}: text must be a string`);
  for (const a of doc.audio) {
    if (typeof a.file !== 'string' || !a.file) e.push(`audio ${a.id}: file is required`);
    if (a.kind !== 'voice' && a.kind !== 'music') e.push(`audio ${a.id}: kind must be voice or music`);
    if (!num(a.in) || a.in < 0) e.push(`audio ${a.id}: in must be >= 0`);
    if (!num(a.gain) || a.gain < -60 || a.gain > 12) e.push(`audio ${a.id}: gain must be -60..12 dB`);
    if (!num(a.fadeIn) || !num(a.fadeOut) || a.fadeIn < 0 || a.fadeOut < 0 || a.fadeIn + a.fadeOut > a.d + EPS) e.push(`audio ${a.id}: fades must be >= 0 and fit in d`);
  }
  return e;
}

/**
 * Timing checks, the same ones the gates make (B02 beat grid, B03 contiguous cuts, B05 line inside its cut)
 * plus editor checks. media: { [path]: seconds } for files whose length is known.
 * Returns [{ code, severity: "error" | "warn", ids, message }].
 */
export function validate(doc, media = {}) {
  const out = shapeErrors(doc).map((message) => ({ code: 'S01', severity: 'error', ids: [], message }));
  if (out.length) return out;
  const add = (code, severity, ids, message) => out.push({ code, severity, ids, message });
  const b = beat(doc), half = frame(doc) / 2, end = length(doc);
  const cuts = [...doc.cuts].sort((x, y) => x.t - y.t);
  if (!cuts.length) add('B01', 'error', [], 'no cuts yet');
  for (const c of cuts) {
    for (const [what, v] of [['start', c.t], ['end', c.t + c.d]]) {
      const off = Math.abs(v / b - Math.round(v / b)) * b;
      if (off > half + EPS) add('B02', 'warn', [c.id], `cut ${what} ${v.toFixed(3)} s is ${(off * 1000).toFixed(0)} ms off the beat`);
    }
  }
  if (cuts.length && Math.abs(cuts[0].t) > frame(doc) + EPS) add('B03', 'error', [cuts[0].id], 'the first cut must start at 0');
  for (let i = 0; i + 1 < cuts.length; i++) {
    const gap = cuts[i + 1].t - (cuts[i].t + cuts[i].d);
    if (Math.abs(gap) > frame(doc) + EPS) add('B03', 'error', [cuts[i].id, cuts[i + 1].id], `${gap > 0 ? 'gap' : 'overlap'} of ${Math.abs(gap).toFixed(3)} s between cuts`);
  }
  const voice = new Map(doc.audio.filter((a) => a.kind === 'voice').map((a) => [a.id, a]));
  for (const c of cuts) {
    const v = c.line && voice.get(c.line);
    if (v && (v.t < c.t - EPS || v.t + v.d > c.t + c.d + EPS)) add('B05', 'error', [c.id, v.id], `line ${v.id} runs outside its cut ${c.id}; the mouth gets cut`);
  }
  const texts = [...doc.text].sort((x, y) => x.t - y.t);
  for (let i = 0; i + 1 < texts.length; i++) {
    if (texts[i].t + texts[i].d > texts[i + 1].t + EPS) add('T01', 'warn', [texts[i].id, texts[i + 1].id], 'two text items overlap');
  }
  for (const x of [...doc.text, ...doc.audio]) {
    if (end && x.t + x.d > end + EPS) add('X01', 'warn', [x.id], `${x.id} runs ${(x.t + x.d - end).toFixed(2)} s past the last cut`);
  }
  for (const a of doc.audio) {
    const len = media[a.file];
    if (num(len) && a.in + a.d > len + 0.05) add('A10', 'error', [a.id], `${a.id} uses ${(a.in + a.d).toFixed(2)} s of a ${len.toFixed(2)} s file`);
  }
  for (const c of cuts) {
    const m = /^(clip|file):([^@]+)@([0-9.]+)$/.exec(c.src);
    const path = m && (m[1] === 'clip' ? `clip/${m[2]}.mp4` : m[2]);
    const len = path && media[path];
    if (num(len) && Number(m[3]) + c.d * (c.rate ?? 1) > len + 0.05) add('B06', 'error', [c.id], `${c.id} needs ${(Number(m[3]) + c.d * (c.rate ?? 1)).toFixed(2)} s of a ${len.toFixed(2)} s clip`);
  }
  return out;
}

/** Nearest beat (or frame when beats are off) to t. */
export function snap(doc, t, { beats = true } = {}) {
  const step = beats ? beat(doc) : frame(doc);
  return round(Math.max(0, Math.round(t / step) * step));
}

/**
 * Apply ops atomically.
 *   { op: "update", track, id, patch }   patch fields; a field set to null is removed
 *   { op: "create", track, item, index? }
 *   { op: "delete", track, id }
 * Returns { ok: true, doc, inverse, diagnostics } or { ok: false, diagnostics }.
 * Shape errors refuse the whole batch; timing problems come back as diagnostics so a half-finished edit can be saved.
 */
export function apply(doc, ops, media = {}) {
  if (!Array.isArray(ops) || !ops.length) return refuse('ops must be a non-empty array');
  let next = clone(doc);
  const inverse = [];
  for (const op of ops) {
    if (!op || !TRACKS.includes(op.track)) return refuse(`unknown track ${op?.track}`);
    const list = next[op.track];
    if (op.op === 'update') {
      const i = list.findIndex((x) => x.id === op.id);
      if (i < 0) return refuse(`${op.track} ${op.id} not found`);
      if (!op.patch || typeof op.patch !== 'object' || 'id' in op.patch) return refuse('update needs a patch without id');
      const prev = list[i];
      const undo = {};
      for (const k of Object.keys(op.patch)) undo[k] = k in prev ? clone(prev[k]) : null;
      const item = { ...prev };
      for (const [k, v] of Object.entries(op.patch)) {
        if (v === null) delete item[k];
        else item[k] = typeof v === 'number' ? round(v) : clone(v);
      }
      list[i] = item;
      inverse.unshift({ op: 'update', track: op.track, id: op.id, patch: undo });
    } else if (op.op === 'create') {
      const item = clone(op.item);
      if (!item || typeof item !== 'object') return refuse('create needs an item');
      if (!item.id) item.id = freshId(next, op.track);
      if (list.some((x) => x.id === item.id)) return refuse(`${op.track} ${item.id} already exists`);
      const at = Number.isInteger(op.index) ? Math.max(0, Math.min(list.length, op.index)) : list.length;
      list.splice(at, 0, item);
      inverse.unshift({ op: 'delete', track: op.track, id: item.id });
    } else if (op.op === 'delete') {
      const i = list.findIndex((x) => x.id === op.id);
      if (i < 0) return refuse(`${op.track} ${op.id} not found`);
      const [gone] = list.splice(i, 1);
      inverse.unshift({ op: 'create', track: op.track, item: gone, index: i });
    } else return refuse(`unknown op ${op.op}`);
  }
  next = normalize(next);
  const diagnostics = validate(next, media);
  if (diagnostics.some((d) => d.code === 'S01')) return { ok: false, diagnostics };
  return { ok: true, doc: next, inverse, diagnostics };
}

export function freshId(doc, track) {
  const used = new Set(doc[track].map((x) => x.id));
  let n = 1;
  while (used.has(PREFIX[track] + n)) n++;
  return PREFIX[track] + n;
}

/** Where the boundary after cut leftId may go: [earliest, latest], so neither side vanishes or runs out of source. */
export function rollRange(doc, leftId) {
  const cuts = [...doc.cuts].sort((a, b) => a.t - b.t);
  const i = cuts.findIndex((c) => c.id === leftId);
  const a = cuts[i], b = cuts[i + 1], f = frame(doc);
  if (!a) return null;
  if (!b) return [a.t + f, Infinity];
  const m = /^(clip|file):([^@]+)@([0-9.]+)$/.exec(b.src);
  // the right cut keeps showing the same moment of its source, so its in-point moves with the boundary
  const earliest = m ? b.t - Number(m[3]) / (b.rate ?? 1) : -Infinity;
  return [Math.max(a.t + f, earliest), b.t + b.d - f];
}

/** Ops that move the boundary between cut leftId and the next cut to time t (a roll edit), clamped to rollRange. */
export function rollOps(doc, leftId, t) {
  const range = rollRange(doc, leftId);
  if (!range) return [];
  const cuts = [...doc.cuts].sort((a, b) => a.t - b.t);
  const i = cuts.findIndex((c) => c.id === leftId);
  const a = cuts[i], b = cuts[i + 1];
  t = Math.min(range[1], Math.max(range[0], t));
  if (!b) return [{ op: 'update', track: 'cuts', id: a.id, patch: { d: t - a.t } }];
  const m = /^(clip|file):([^@]+)@([0-9.]+)$/.exec(b.src);
  const src = m ? `${m[1]}:${m[2]}@${round(Math.max(0, Number(m[3]) + (t - b.t) * (b.rate ?? 1)))}` : b.src;
  return [
    { op: 'update', track: 'cuts', id: a.id, patch: { d: t - a.t } },
    { op: 'update', track: 'cuts', id: b.id, patch: { t, d: b.t + b.d - t, src } },
  ];
}

/** Clean JSON for edit.json: stable key order, defaults dropped where they equal the default. */
export function serialize(doc) {
  const { bpm, fps, width, height, cuts, text, audio, ...rest } = doc;
  const out = { bpm, fps, ...(width ? { width } : {}), ...(height ? { height } : {}), ...rest, cuts };
  if (text.length) out.text = text;
  if (audio.length) out.audio = audio;
  return JSON.stringify(out, null, 2) + '\n';
}

function refuse(message) {
  return { ok: false, diagnostics: [{ code: 'S01', severity: 'error', ids: [], message }] };
}
