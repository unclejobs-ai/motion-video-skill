// Project I/O shared by the server and the CLI: read and write edit.json, measure media with ffprobe.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { normalize, serialize } from './core.mjs';

export function open(root) {
  root = resolve(root);
  const file = join(root, 'edit.json');
  if (!existsSync(file)) throw new Error(`no edit.json in ${root}. Write one first (see timeline/README.md).`);
  return { root, file };
}

export function read(p) {
  return normalize(JSON.parse(readFileSync(p.file, 'utf8')));
}

/** Atomic write. The first write of a session keeps a copy of the original under qa/timeline/. */
export function write(p, doc) {
  if (!p.backedUp) {
    const dir = join(p.root, 'qa', 'timeline');
    mkdirSync(dir, { recursive: true });
    copyFileSync(p.file, join(dir, `edit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
    p.backedUp = true;
  }
  const tmp = `${p.file}.tmp-${process.pid}`;
  writeFileSync(tmp, serialize(doc));
  renameSync(tmp, p.file);
  return statSync(p.file).mtimeMs;
}

/** Absolute path for a project-relative path, or null when it escapes the project. */
export function inside(p, rel) {
  const abs = resolve(p.root, rel);
  return abs === p.root || abs.startsWith(p.root + sep) ? abs : null;
}

export function srcPath(src) {
  const m = /^(clip|file):([^@]+)@([0-9.]+)$/.exec(src || '');
  return m ? { path: m[1] === 'clip' ? `clip/${m[2]}.mp4` : m[2], at: Number(m[3]) } : null;
}

const lengths = new Map();
/** { path: seconds } for every file the doc points at (cached by mtime). Missing files are left out. */
export function media(p, doc) {
  const out = {};
  const paths = new Set([...doc.audio.map((a) => a.file), ...doc.cuts.map((c) => srcPath(c.src)?.path).filter(Boolean)]);
  for (const rel of paths) {
    const abs = inside(p, rel);
    if (!abs || !existsSync(abs)) continue;
    const key = `${abs}:${statSync(abs).mtimeMs}`;
    if (!lengths.has(key)) {
      try {
        lengths.set(key, Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', abs], { encoding: 'utf8' }).trim()));
      } catch { lengths.set(key, NaN); }
    }
    const len = lengths.get(key);
    if (Number.isFinite(len)) out[rel] = len;
  }
  return out;
}
