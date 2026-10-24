// probe.mjs — the carry oracle over a production's declared track (pipeline/carry.ts). Reads the composition, not
// the video, so it runs before any render.
// Usage: node pipeline/probe.mjs productions/<id>        (the directory must hold track.ts exporting `film`)
// Exit: 0 pass or warn, 1 fail.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CARRY, probe } from './carry.ts';

const dir = process.argv[2];
if (!dir) { console.error('usage: node pipeline/probe.mjs productions/<id>'); process.exit(2); }
const { film } = await import(pathToFileURL(resolve(dir, 'track.ts')).href);
const r = probe(film);

console.log(`== carry (declared track, ${CARRY.grid.join('x')} ownership grid, ${CARRY.window} s window)`);
for (const b of r.boundaries) {
  const who = b.survivors.length ? `survivors: ${b.survivors.join(', ')}` : 'nothing survives';
  console.log(`  ${b.t.toFixed(3)} s  ${b.kind.padEnd(8)}  change ${b.change.toFixed(2)}  ${who}${b.exempt ? `  (exempt: ${b.exempt})` : ''}`);
}
if (!r.boundaries.length) console.log('  no boundaries');
for (const n of r.notes) console.log(`  WARN ${n}`);
const score = r.score === null ? 'n/a' : r.score.toFixed(2);
console.log(`carry ${score} over ${r.considered} boundaries (beat sheet: ${film.beatBoundaries.length}; fail < ${CARRY.fail}, warn < ${CARRY.warn}) → ${r.verdict.toUpperCase()}`);
process.exit(r.verdict === 'fail' ? 1 : 0);
