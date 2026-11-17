import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const skill = resolve(import.meta.dirname, '..');
const scratch = tmpdir();
mkdirSync(scratch, { recursive: true });
const work = mkdtempSync(join(scratch, 'verify-'));
const ff = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { timeout: 30000 });
const edit = { fps: 30, width: 320, height: 180, cuts: [{ t: 0, d: 2 }] };
const row = { id: 'card', start: 0, length: 2, clip: 2, fadeIn: false, fadeOut: false };
const plan = { fps: 30, fadeIn: 0.2, fadeOut: 0.2, chapters: [{ n: 1, length: 2, pauses: [], rows: [row] }] };
const json = (name, value) => writeFileSync(join(work, name), JSON.stringify(value));
const run = (args, command = ['node', join(skill, 'engines/remotion/pipeline/verify.mjs')]) => {
  const r = spawnSync(command[0], [...command.slice(1), ...args], { encoding: 'utf8', timeout: 60000 });
  assert.ifError(r.error);
  return r;
};

test('the table reuses the final gate, reports observe failures, and works from a copied engine', async (t) => {
  try {
    mkdirSync(join(work, 'out'));
    const video = join(work, 'out/final.mp4');
    ff('-f', 'lavfi', '-i', 'color=black:s=320x180:r=30:d=2', '-f', 'lavfi', '-i', 'sine=f=440:d=2',
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', video);
    json('edit.json', edit); json('plan.json', plan);
    await t.test('existing shell entry point writes PASS, LOOK artifacts and a file stamp', () => {
      const r = run([video, '--project', work], ['bash', join(skill, 'scripts/verify.sh')]);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const report = readFileSync(join(work, 'out/qa/VERIFY.md'), 'utf8');
      assert.match(report, /verdict: PASS/);
      assert.match(report, /video mtime: .*size: \d+ bytes/);
      assert.match(report, /loudness \| enforce \| PASS/);
      assert.match(report, /contact sheet \|  \| LOOK/);
      assert.ok(existsSync(join(work, 'out/qa/final.last.png')));
    });
    await t.test('a truncated contract fails the shared frame gate and stops before LOOK', () => {
      json('edit.json', { ...edit, cuts: [{ t: 0, d: 3 }] });
      const r = run(['--project', work]);
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.match(r.stdout, /frames \| enforce \| FAIL/);
      assert.doesNotMatch(r.stdout, /contact sheet \|/);
      assert.doesNotMatch(r.stdout, /loudness \|/);
      const all = run(['--project', work, '--all']);
      assert.equal(all.status, 1, all.stdout + all.stderr);
      assert.match(all.stdout, /contact sheet \|  \| LOOK/);
      json('edit.json', edit);
    });
    await t.test('unsafe overlay joins, long cards and short bridges warn without blocking', () => {
      json('plan.json', { ...plan, chapters: [{ n: 1, length: 12, bridgeAfter: 2,
        pauses: [{ at: 10, seconds: 15, id: 'pause-card' }], rows: [
          { ...row, length: 4, clip: 4, fadeOut: true },
          { ...row, id: 'next', start: 4.5, length: 4, clip: 4, fadeIn: true, fadeOut: true },
        ] }] });
      const r = run(['--project', work, '--plan', join(work, 'plan.json')]);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      for (const gate of ['no-peek', 'card', 'bridge']) assert.ok(r.stdout.includes(`${gate} | observe | WARN`), r.stdout);
      json('plan.json', plan);
    });
    await t.test('an exposed picture join warns without blocking; a covered join passes', () => {
      const args = ['--project', work, '--plan', join(work, 'plan.json'), '--src'];
      const exposed = run([...args, video]);
      assert.equal(exposed.status, 0, exposed.stdout + exposed.stderr);
      assert.match(exposed.stdout, /picture-peek \| observe \| WARN/);
      const source = join(work, 'source.mp4');
      ff('-f', 'lavfi', '-i', 'color=white:s=320x180:r=30:d=2', '-c:v', 'libx264', source);
      const covered = run([...args, source]);
      assert.equal(covered.status, 0, covered.stdout + covered.stderr);
      assert.match(covered.stdout, /picture-peek \| observe \| PASS/);
    });
    await t.test('missing source and invalid external plans are usage errors, not silent passes', () => {
      assert.equal(run(['--unknown']).status, 2);
      assert.equal(run(['--video']).status, 2);
      assert.equal(run(['--project', work, '--plan', join(work, 'plan.json'), '--src', join(work, 'missing.mp4')]).status, 2);
      json('plan.json', { fps: 0 });
      assert.equal(run(['--plan', join(work, 'plan.json')]).status, 2);
    });
    await t.test('copied engine uses the installed shared gate without npm install', () => {
      const engine = join(work, 'engine');
      cpSync(join(skill, 'engines/remotion'), engine, { recursive: true, filter: (src) => basename(src) !== 'node_modules' });
      const r = run(['--project', work, '--skill-root', skill], ['node', join(engine, 'pipeline/verify.mjs')]);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /tests \| enforce \| PASS/);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
