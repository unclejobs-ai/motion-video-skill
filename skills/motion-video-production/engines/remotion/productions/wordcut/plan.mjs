// plan.mjs — turn a reference analysis (scripts/ref-analyze.py → analysis.json) into the word cut's timing (plan.ts).
// Usage (engine folder): node productions/wordcut/plan.mjs <analysis.json> [seconds=20] [fps=30]
// What it reads, and what it sets (frames at the composition fps):
//   edit.shots      → open (the first shot), hold (median of shots 0.25–2 s), burstStep (median of shots < 0.25 s),
//                     burstCount (how many shots < 0.25 s, capped at 12)
//   edit.holdMeanS  → the textbook beat (a long hold) is at least this long
//   motion.transitions dirs → the whip direction cycle (most common first)
//   blur.alongPx    → whip blur, scaled from the 540 px analysis width to the 390 px design width
// Then render, analyse the render with the same script, and compare with `gate.py ref`: plan.ts is a first guess, the
// gate is the judge.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DATA } from './data.ts';

const [, , path, secArg = '20', fpsArg = '30'] = process.argv;
if (!path) { console.error('usage: node productions/wordcut/plan.mjs <analysis.json> [seconds] [fps]'); process.exit(2); }
const a = JSON.parse(readFileSync(path, 'utf8'));
const fps = Number(fpsArg), seconds = Number(secArg);
const median = (xs) => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const fr = (s) => Math.max(1, Math.round(s * fps));

const shots = a.edit.shots;
const short = shots.filter((s) => s < 0.25), mid = shots.filter((s) => s >= 0.25 && s <= 2);
const open = fr(Math.min(2, Math.max(0.8, shots.find((s) => s > 0.25) ?? 1.2)));
const hold = fr(median(mid) ?? 1);
const burstStep = Math.max(3, fr(median(short) ?? 0.17));
const burstCount = Math.min(12, Math.max(4, short.length));
// the slow landings (same count as buildCuts in timing.ts) and the burst take what they take; the textbook gets the
// longer of the reference's mean hold and 4 s, and the dictionary keeps at least 2.5 s
const n = DATA.sheets.length;
const slowHolds = Math.min(n, Math.max(1, Math.ceil(n * 0.6))) - 1;
const used = open + slowHolds * hold + burstCount * burstStep;
const textbook = Math.max(fr(Math.max(4, a.edit.holdMeanS)), Math.min(fr(5.5), seconds * fps - used - fr(2.5)));
const toDir = { 0: 'r', 180: 'l', 90: 'd', 270: 'u' };
const dirs = a.motion.transitions.map((t) => toDir[t.dir]).filter(Boolean).join('').slice(0, 12) || 'lrulrdlr';
const k = 390 / a.analysisShortSide;
const blur = Math.max(4, Math.round(a.blur.alongPx * k * 4));

const plan = {
  source: `plan.mjs from ${path.split('/').pop()} (${a.source.seconds} s, ${a.source.fps} fps, ${a.edit.cutCount} cuts)`,
  fps, seconds, open, hold, burstStep, burstCount, textbook,
  whip: { outShift: 0.34, inShift: 0.2, outBlur: blur, inBlur: Math.round(blur * 0.7) },
  refocus: [Math.round(blur * 0.7), Math.round(blur * 0.25), 1.5],
  dirs,
};
if (used + textbook + fr(2) > seconds * fps) throw new Error(`plan does not fit in ${seconds} s: raise seconds`);
const out = fileURLToPath(new URL('./plan.ts', import.meta.url));
writeFileSync(out, `// Written by plan.mjs from a reference analysis (scripts/ref-analyze.py → analysis.json). Edit by re-running plan.mjs,
// or by hand for a first draft. Every time is in frames at \`fps\`.
export const PLAN = ${JSON.stringify(plan, null, 2)} as const;
`);
console.log(`wrote ${out}\n${JSON.stringify(plan)}`);
