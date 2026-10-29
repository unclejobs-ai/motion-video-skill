#!/usr/bin/env node
// Local timeline editor for a project folder. Node standard library and ffmpeg only.
//   node serve.mjs <project> [--port 4321] [--no-open]
// The browser and the agent edit the same edit.json: the editor writes through /api/apply,
// the agent through apply.mjs, and each side sees the other's change (revision + file mtime).
import { execFile, execFileSync, spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply, validate } from './core.mjs';
import { inside, media, open, read, srcPath, write } from './project.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = dirname(HERE);
const args = process.argv.slice(2);
const root = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--port');
if (!root) { console.error('usage: node serve.mjs <project> [--port 4321] [--no-open]'); process.exit(2); }
const port = Number(args[args.indexOf('--port') + 1]) || 4321;
const p = open(root);
const cache = join(p.root, 'qa', 'timeline', 'cache');
mkdirSync(cache, { recursive: true });

let doc = read(p);
let revision = 1;
let mtime = statSync(p.file).mtimeMs;

/** Pick up edits made outside the editor (the agent, a text editor). */
function sync() {
  const now = statSync(p.file).mtimeMs;
  if (now === mtime) return;
  try { doc = read(p); revision++; } catch { /* half-written file: try again on the next poll */ return; }
  mtime = now;
}

const state = () => {
  const m = media(p, doc);
  return { name: basename(p.root), revision, doc, media: m, diagnostics: validate(doc, m), hasSkillGate: existsSync(join(SKILL, 'harness', 'gate.py')) };
};

const TYPES = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && url.pathname === '/') return file(res, join(HERE, 'editor.html'));
    if (url.pathname === '/favicon.ico') return send(res, 204);
    if (req.method === 'GET' && url.pathname === '/core.mjs') return file(res, join(HERE, 'core.mjs'));
    if (req.method === 'GET' && url.pathname === '/api/doc') {
      sync();
      if (Number(url.searchParams.get('since')) === revision) return send(res, 204);
      return json(res, 200, state());
    }
    if (req.method === 'POST' && url.pathname === '/api/apply') {
      sync();
      const body = JSON.parse(await text(req));
      if (body.revision !== revision) return json(res, 409, state());
      const r = apply(doc, body.ops, media(p, doc));
      if (!r.ok) return json(res, 422, { diagnostics: r.diagnostics });
      doc = r.doc;
      mtime = write(p, doc);
      revision++;
      return json(res, 200, { ...state(), inverse: r.inverse });
    }
    if (req.method === 'POST' && (url.pathname === '/api/gate' || url.pathname === '/api/build')) {
      const cmd = url.pathname === '/api/gate'
        ? ['python3', [join(SKILL, 'harness', 'gate.py'), 'edit', p.root]]
        : [process.execPath, [join(HERE, 'build.mjs'), p.root]];
      execFile(cmd[0], cmd[1], { maxBuffer: 1 << 24 }, (err, stdout, stderr) =>
        json(res, 200, { code: err ? (err.code ?? 1) : 0, text: `${stdout}${stderr}`.trim() }));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/peaks') return peaks(res, url.searchParams.get('file'));
    if (req.method === 'GET' && url.pathname === '/api/thumb') return thumb(res, url.searchParams.get('src'), Number(url.searchParams.get('t')) || 0);
    if (req.method === 'GET' && url.pathname.startsWith('/media/')) {
      const abs = inside(p, decodeURIComponent(url.pathname.slice(7)));
      if (!abs || !existsSync(abs)) return send(res, 404);
      return file(res, abs, req.headers.range);
    }
    send(res, 404);
  } catch (e) {
    json(res, 500, { diagnostics: [{ code: 'S00', severity: 'error', ids: [], message: String(e.message || e) }] });
  }
});

/** Waveform peaks, 100 per second, from mono 4 kHz PCM. Cached by path and mtime. */
function peaks(res, rel) {
  const abs = rel && inside(p, rel);
  if (!abs || !existsSync(abs)) return send(res, 404);
  const out = join(cache, `${hash(abs)}.peaks.json`);
  if (!existsSync(out)) {
    const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', abs, '-ac', '1', '-ar', '4000', '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
    const n = Math.floor(pcm.length / 2), step = 40, list = [];
    for (let i = 0; i < n; i += step) {
      let m = 0;
      for (let j = i; j < Math.min(n, i + step); j++) m = Math.max(m, Math.abs(pcm.readInt16LE(j * 2)));
      list.push(Math.round((m / 32768) * 1000) / 1000);
    }
    writeFileSync(out, JSON.stringify(list));
  }
  file(res, out);
}

/** One JPEG frame of a cut's source at t seconds into the source. */
function thumb(res, src, t) {
  const s = srcPath(src);
  const abs = s && inside(p, s.path);
  if (!abs || !existsSync(abs)) return send(res, 404);
  const out = join(cache, `${hash(abs, t.toFixed(2))}.jpg`);
  if (!existsSync(out)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', abs, '-frames:v', '1', '-vf', 'scale=-2:144', '-q:v', '4', out]);
  file(res, out);
}

/** Cache key: the file, its mtime (so a regenerated clip gets new thumbnails) and an optional extra. */
function hash(abs, extra = '') {
  return createHash('sha1').update(`${abs}:${statSync(abs).mtimeMs}:${extra}`).digest('hex').slice(0, 16);
}

function file(res, abs, range) {
  const size = statSync(abs).size;
  const type = TYPES[extname(abs).toLowerCase()] || 'application/octet-stream';
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (m) {
    const start = m[1] ? Number(m[1]) : size - Number(m[2]);
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-cache' });
    return createReadStream(abs, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
  createReadStream(abs).pipe(res);
}
const send = (res, code) => { res.writeHead(code); res.end(); };
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const text = (req) => new Promise((ok, no) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => ok(s)); req.on('error', no); });

server.listen(port, '127.0.0.1', () => {
  const at = `http://127.0.0.1:${port}/`;
  console.log(`timeline editor for ${p.root}\n${at}`);
  if (!args.includes('--no-open') && process.platform === 'darwin') spawn('open', [at], { stdio: 'ignore', detached: true }).unref();
});
