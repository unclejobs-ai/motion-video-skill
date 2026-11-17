// Check shipped source paths, not project outputs, commands, placeholders or glob examples.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const skill = resolve(import.meta.dirname, '..');
const repo = resolve(skill, '../..');
const engine = join(skill, 'engines/remotion');
const docs = [join(skill, 'SKILL.md'), ...readdirSync(join(skill, 'references')).filter((f) => f.endsWith('.md')).map((f) => join(skill, 'references', f)),
  ...['README.md', 'README.ko.md', 'docs/runtimes.md'].map((f) => join(repo, f)).filter(existsSync)];
const path = /^(skills|docs|references|templates|harness|scripts|engines|timeline|motions|pipeline|productions|src)\/[\w./-]+$/;

function missingPaths(text, doc) {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1])
    .filter((token) => path.test(token) && ![repo, skill, engine, dirname(doc)].some((base) => existsSync(join(base, token))));
}

test('every literal shipped path named in the skill, references and READMEs exists', () => {
  assert.deepEqual(docs.flatMap((doc) => missingPaths(readFileSync(doc, 'utf8'), doc).map((p) => `${doc}: ${p}`)), []);
});

test('the path check catches stale paths and ignores commands and output placeholders', () => {
  assert.deepEqual(missingPaths('`pipeline/missing.mjs` `pipeline/<id>.mjs` `node pipeline/missing.mjs` `out/final.mp4`', docs[0]), ['pipeline/missing.mjs']);
});

test('the skill folder name matches its frontmatter name', () => {
  assert.equal(readFileSync(join(skill, 'SKILL.md'), 'utf8').match(/^name:\s*(.+)$/m)?.[1].trim(), basename(skill));
});
