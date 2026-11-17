// One table over the existing media gate and engine checks, cheapest first. No rendering or paid calls.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { CARRY, probe } from './carry.ts';
import { REASON, bridge, cards, composed, finalTime, noPeek, peekSpots, TIMELINE, validatePlan } from './timeline-gates.ts';

const root = resolve(import.meta.dirname, '..');
const L = JSON.parse(readFileSync(new URL('./verify-limits.json', import.meta.url), 'utf8'));
let a;
try {
  ({ values: a } = parseArgs({ options: {
    production: { type: 'string' }, video: { type: 'string' }, project: { type: 'string' },
    plan: { type: 'string' }, src: { type: 'string' }, 'skill-root': { type: 'string' }, all: { type: 'boolean' },
  } }));
} catch (e) { console.error(e.message); process.exit(2); }
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
const video = a.video ? resolve(a.video) : a.project ? resolve(a.project, 'out/final.mp4') : null;
const skill = resolve(a['skill-root'] ?? process.env.SKILL_ROOT ?? join(root, '../..'));
let film, plan, contract = {};
try {
  if (video && !existsSync(video)) throw new Error('video does not exist');
  if (a.src && (!video || !a.plan || !existsSync(resolve(a.src)))) throw new Error('--src needs an existing source file, --video (or --project), and --plan');
  if (a.production) ({ film } = await import(pathToFileURL(resolve(a.production, 'track.ts')).href));
  if (film) contract = { fps: film.fps, width: film.width, height: film.height, cuts: [{ t: 0, d: film.seconds }] };
  if (a.project) contract = JSON.parse(readFileSync(resolve(a.project, 'edit.json'), 'utf8'));
  if (a.plan) { plan = JSON.parse(readFileSync(resolve(a.plan), 'utf8')); validatePlan(plan); }
  if (video && !existsSync(join(skill, 'harness/gate.py'))) throw new Error('set --skill-root to the installed skill folder (the shared media gate is required)');
} catch (e) { console.error(e.message); process.exit(2); }

const media = {};
const measure = (stage) => {
  if (media[stage]) return media[stage];
  const r = spawnSync('python3', [join(skill, 'harness/gate.py'), 'media', video, stage], {
    input: JSON.stringify(contract), encoding: 'utf8', timeout: 120000, maxBuffer: 1 << 26,
  });
  if (r.error || ![0, 1].includes(r.status)) throw new Error(r.error?.message ?? `media gate failed: ${r.stderr.trim()}`);
  media[stage] = JSON.parse(r.stdout);
  return media[stage];
};
const mediaLeg = (leg, id) => ({ leg, reason: `shared gate ${id}`, run() {
  if (!video) return { status: 'skip', measured: 'no video' };
  const { checks, limits } = measure(['F05', 'F06'].includes(id) ? 'audio' : 'container');
  const c = checks.find((c) => c.id === id);
  if (!c) return { status: 'fail', measured: checks.find((c) => c.level === 'BLOCK')?.message ?? `${id} not measured` };
  if ((id === 'F04' && (!contract.width || !contract.height)) || (id === 'F08' && !contract.fps))
    return { status: 'skip', measured: c.message, limit: 'no external target; use --project or --production' };
  return { status: id === 'F11' && c.level === 'WARN' ? 'fail' : { PASS: 'pass', WARN: 'warn', BLOCK: 'fail' }[c.level],
    measured: c.message, limit: limits[id] ?? (id === 'F02' ? (contract.cuts?.length ? 'project/production length' : 'stream header only') : '') };
} });
const gateLeg = (leg, limit, check) => ({ leg, reason: REASON[leg], run() {
  if (!plan) return { status: 'skip', measured: 'no --plan' };
  const failures = plan.chapters.flatMap((ch) => check(ch, composed(ch, plan), plan));
  return { status: failures.length ? 'fail' : 'pass', measured: `${failures.length} failures`, limit, details: failures.map((f) => f.message) };
} });

const tiers = [
  [0, [{ leg: 'tests', reason: 'engine unit checks', run() {
    const r = spawnSync('npm', ['test', '--silent'], { cwd: root, encoding: 'utf8', timeout: 120000 });
    const n = (k) => (r.stdout + r.stderr).match(new RegExp(`(?:ℹ|#) ${k} (\\d+)`))?.[1] ?? '?';
    return { status: r.status === 0 ? 'pass' : 'fail', measured: `${n('pass')} pass, ${n('fail')} fail`, limit: '0 fail',
      details: r.status === 0 ? [] : [(r.stdout + r.stderr).trim()] };
  } }]],
  [1, [
    { leg: 'carry', reason: 'an element must survive each declared boundary', run() {
      if (!film) return { status: 'skip', measured: 'no --production' };
      const r = probe(film);
      return { status: r.verdict, measured: `${r.score ?? 'n/a'} over ${r.considered} boundaries`, limit: `fail < ${CARRY.fail}, warn < ${CARRY.warn}` };
    } },
    gateLeg('no-peek', `overlays < ${TIMELINE.joinGap} s apart are held`, noPeek),
    gateLeg('card', `card ≤ ${TIMELINE.cardMax} s; no pause plus hold`, cards),
    gateLeg('bridge', `bridge ≥ ${TIMELINE.bridgeMin} s`, (ch, _rows, p) => bridge(ch, p)),
  ]],
  [2, [mediaLeg('frames', 'F02'), mediaLeg('audio-stream', 'F03'), mediaLeg('resolution', 'F04'),
    mediaLeg('fps', 'F08'), mediaLeg('cfr', 'F11'), mediaLeg('av-length', 'F09')]],
  [3, [mediaLeg('loudness', 'F05'), mediaLeg('true-peak', 'F06')]],
  [4, [{ leg: 'picture-peek', reason: REASON['no-peek'], run() {
    if (!video || !plan || !a.src) return { status: 'skip', measured: 'needs video, --plan and --src' };
    if (plan.chapters.length !== 1) return { status: 'skip', measured: '--src pairs with a one-chapter plan' };
    const ch = plan.chapters[0], fps = plan.fps, [w, h] = L.picture.size.split('x');
    const spots = peekSpots(composed(ch, plan)), bad = new Map();
    let samples = 0, skipped = 0;
    for (const t of spots) {
      const t0 = Math.max(0, t - 0.3), win = Math.min(0.8, ch.length - t0);
      // shortcut: windows crossing inserted pauses are not time-aligned; skip until piecewise sampling is supported.
      if (win <= 0 || ch.pauses.some((p) => p.at >= t0 && p.at <= t0 + win)) { skipped++; continue; }
      const out = sh('ffmpeg', ['-v', 'error', '-ss', String(finalTime(ch, t0, fps)), '-t', String(win), '-i', video,
        '-ss', String(t0), '-t', String(win), '-i', resolve(a.src), '-lavfi',
        `[0:v]fps=${fps},scale=${w}:${h},format=gray,setpts=PTS-STARTPTS[x];[1:v]fps=${fps},scale=${w}:${h},format=gray,setpts=PTS-STARTPTS[y];[x][y]psnr=stats_file=-:shortest=1`, '-f', 'null', '-']);
      const lines = out.split('\n').filter((l) => l.includes('psnr_avg:'));
      if (!lines.length) throw new Error('no PSNR samples at a planned join');
      samples += lines.length;
      for (const line of lines) {
        const db = Number(line.match(/psnr_avg:(\S+)/)[1].replace('inf', 'Infinity'));
        if (Number.isNaN(db)) throw new Error('invalid PSNR measurement');
        const tt = t0 + (Number(line.match(/n:(\d+)/)[1]) - 1) / fps;
        if (db > L.picture.peekDb) bad.set(tt.toFixed(3), `${tt.toFixed(3)} s: ${db} dB`);
      }
    }
    return { status: samples ? (bad.size ? 'fail' : 'pass') : 'skip', measured: `${bad.size} exposed frames; ${samples} samples; ${skipped} windows skipped`,
      limit: `PSNR ≤ ${L.picture.peekDb} dB at ${L.picture.size} gray`, details: [...bad.values()] };
  } }]],
  [5, ['contact sheet', 'last frame'].map((leg) => ({ leg, reason: 'human review required; never a machine PASS', run() {
    if (!video) return { status: 'skip', measured: 'no video' };
    const qa = join(dirname(video), 'qa'), base = basename(video, extname(video));
    mkdirSync(qa, { recursive: true });
    const out = join(qa, `${base}.${leg === 'contact sheet' ? 'contact.jpg' : 'last.png'}`);
    if (leg === 'contact sheet') {
      const secs = Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', video]).trim());
      if (!(secs > 0)) throw new Error('invalid video duration');
      const fps = Math.min(2, L.look.maxTiles / secs), tiles = Math.ceil(secs * fps);
      sh('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', `fps=${fps},scale=${L.look.width}:-2,tile=6x${Math.ceil(tiles / 6)}`, '-frames:v', '1', out]);
    } else {
      sh('ffmpeg', ['-v', 'error', '-y', '-sseof', '-0.5', '-i', video, '-vf', `scale=${L.look.width}:-2`, '-update', '1', out]);
    }
    if (!existsSync(out)) throw new Error('review image was not produced');
    return { status: 'look', measured: out };
  } }))],
];

const rows = [];
let failed = false, stoppedAt = null;
for (const [tier, legs] of tiers) {
  for (const { leg, reason, run } of legs) {
    let r;
    try { r = run(); } catch (e) { r = { status: 'fail', measured: `error: ${e.message.split('\n')[0]}` }; }
    const mode = L.modes[leg] ?? (tier === 5 ? '' : 'enforce');
    if (r.status === 'fail' && mode === 'observe') r.status = 'warn';
    if (r.status === 'fail') failed = true;
    rows.push({ tier, leg, mode, ...r, reason });
  }
  if (failed && !a.all) { stoppedAt = tier; break; }
}
const cell = (s) => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const head = ['tier', 'check', 'mode', 'status', 'measured / artifact', 'limit', 'reason'];
const table = [head, ...rows.map((r) => [r.tier, r.leg, r.mode, r.status.toUpperCase(), r.measured, r.limit, r.reason])]
  .map((c) => `| ${c.map(cell).join(' | ')} |`);
table.splice(1, 0, `|${head.map(() => '---').join('|')}|`);
const tail = rows.flatMap((r) => (r.details ?? []).map((d) => `- ${r.leg}: ${d}`));
if (stoppedAt !== null) tail.push(`Stopped after tier ${stoppedAt}; --all runs every tier.`);
console.log([...table, ...tail].join('\n'));
if (video) {
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim();
  const st = statSync(video), qa = join(dirname(video), 'qa');
  mkdirSync(qa, { recursive: true });
  writeFileSync(join(qa, 'VERIFY.md'), [`# VERIFY ${basename(video)}`, '',
    `- commit: ${git('rev-parse', '--short', 'HEAD') || 'unavailable'}${git('status', '--porcelain', '--untracked-files=no') ? ' (uncommitted changes)' : ''}`,
    `- command: node pipeline/verify.mjs ${process.argv.slice(2).join(' ')}`,
    `- video: ${video}`, `- video mtime: ${st.mtime.toISOString()}, size: ${st.size} bytes`,
    `- verdict: ${failed ? 'FAIL' : 'PASS'} (WARN/SKIP are not proof; LOOK needs human review)`, '', ...table, ...tail, ''].join('\n'));
  console.log(`wrote ${join(qa, 'VERIFY.md')}`);
}
process.exit(failed ? 1 : 0);
