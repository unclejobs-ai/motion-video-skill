#!/usr/bin/env node
// The agent's entry to the timeline: the same core the editor uses.
//   node apply.mjs <project>                 print the timeline and its diagnostics
//   node apply.mjs <project> ops.json        apply ops (a JSON array) and write edit.json
//   node apply.mjs <project> -               read the ops from stdin
// An open editor picks the change up within two seconds. Exit 0 = applied (or printed) with no errors, 1 = errors.
import { readFileSync } from 'node:fs';
import { apply, length, validate } from './core.mjs';
import { media, open, read, write } from './project.mjs';

const [, , root, opsArg] = process.argv;
if (!root) { console.error('usage: node apply.mjs <project> [ops.json|-]'); process.exit(2); }
const p = open(root);
let doc = read(p);
let diagnostics;
if (opsArg) {
  const ops = JSON.parse(readFileSync(opsArg === '-' ? 0 : opsArg, 'utf8'));
  const r = apply(doc, ops, media(p, doc));
  if (!r.ok) { print(r.diagnostics); process.exit(1); }
  write(p, r.doc);
  doc = r.doc;
  diagnostics = r.diagnostics;
  console.log(`applied ${ops.length} op(s) to ${p.file}`);
} else diagnostics = validate(doc, media(p, doc));

const f = (x) => x.toFixed(2).padStart(6);
console.log(`${doc.bpm} BPM · ${doc.fps} fps · ${length(doc).toFixed(2)} s`);
for (const c of doc.cuts) console.log(`cut   ${c.id.padEnd(5)} ${f(c.t)} +${f(c.d)}  ${c.src}${c.line ? `  line ${c.line}` : ''}`);
for (const x of doc.text) console.log(`text  ${x.id.padEnd(5)} ${f(x.t)} +${f(x.d)}  ${JSON.stringify(x.text)}`);
for (const a of doc.audio) console.log(`${a.kind.padEnd(5)} ${a.id.padEnd(5)} ${f(a.t)} +${f(a.d)}  ${a.file}@${a.in}  ${a.gain} dB`);
print(diagnostics);
process.exit(diagnostics.some((d) => d.severity === 'error') ? 1 : 0);

function print(ds) {
  if (!ds.length) return console.log('no problems');
  for (const d of ds) console.log(`${d.severity === 'error' ? 'BLOCK' : 'WARN '} ${d.code} ${d.message}`);
}
