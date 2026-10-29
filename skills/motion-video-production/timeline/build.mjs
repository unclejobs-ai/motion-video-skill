#!/usr/bin/env node
// Build out/final.mp4 from edit.json: cuts from their sources, every audio item at its place with its gain and fades
// (music ducks under voice unless duck is false), text as out/captions.srt plus a subtitle track.
//   node build.mjs <project> [--burn]    --burn draws the text into the picture when ffmpeg has the subtitles filter
// Frame starts are rounded once from cumulative time (G12), so the frame count matches gate.py final.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { length, validate } from './core.mjs';
import { inside, media, open, read, srcPath } from './project.mjs';

const [, , root, ...flags] = process.argv;
if (!root) { console.error('usage: node build.mjs <project> [--burn]'); process.exit(2); }
const p = open(root);
const doc = read(p);
const errors = validate(doc, media(p, doc)).filter((d) => d.severity === 'error');
if (errors.length) {
  for (const d of errors) console.error(`BLOCK ${d.code} ${d.message}`);
  process.exit(1);
}

const F = doc.fps, total = length(doc), frames = Math.round(total * F);
const cuts = [...doc.cuts].sort((a, b) => a.t - b.t);
const abs = (rel) => {
  const a = inside(p, rel);
  if (!a || !existsSync(a)) { console.error(`missing file: ${rel}`); process.exit(1); }
  return a;
};
let [W, H] = [doc.width, doc.height];
if (!W || !H) {
  const s = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', abs(srcPath(cuts[0].src).path)], { encoding: 'utf8' }).trim().split(',');
  [W, H] = s.map(Number);
}

const inputs = [], graph = [];
cuts.forEach((c, i) => {
  const s = srcPath(c.src), rate = c.rate ?? 1;
  inputs.push('-ss', String(s.at), '-t', String(c.d * rate + 1), '-i', abs(s.path));
  const n = Math.round((c.t + c.d) * F) - Math.round(c.t * F);
  graph.push(`[${i}:v]setpts=(PTS-STARTPTS)/${rate},fps=${F},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,tpad=stop_mode=clone:stop_duration=${c.d},trim=end_frame=${n},setpts=PTS-STARTPTS[v${i}]`);
});
graph.push(`${cuts.map((_, i) => `[v${i}]`).join('')}concat=n=${cuts.length}:v=1:a=0[vout]`);

const voices = [], music = [];
doc.audio.forEach((a, k) => {
  const i = cuts.length + k, ms = Math.round(a.t * 1000);
  inputs.push('-ss', String(a.in), '-t', String(a.d), '-i', abs(a.file));
  const fades = [a.fadeIn > 0 && `afade=t=in:d=${a.fadeIn}`, a.fadeOut > 0 && `afade=t=out:st=${Math.max(0, a.d - a.fadeOut)}:d=${a.fadeOut}`].filter(Boolean);
  graph.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${a.gain}dB${fades.map((f) => `,${f}`).join('')},adelay=${ms}:all=1[a${k}]`);
  (a.kind === 'voice' ? voices : music).push({ label: `a${k}`, duck: a.duck !== false });
});
const mix = (list, out) => graph.push(list.length === 1 ? `[${list[0].label}]anull[${out}]` : `${list.map((x) => `[${x.label}]`).join('')}amix=inputs=${list.length}:normalize=0[${out}]`);
let audio;
if (!voices.length && !music.length) {
  graph.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${total}[aout]`);
  audio = 'aout';
} else {
  const parts = [];
  if (voices.length) mix(voices, 'vo');
  if (music.length) mix(music, 'mu');
  if (voices.length && music.length && music.some((m) => m.duck)) {
    // same ducking as scripts/mix-mux.sh: the voice keys a compressor on the music
    graph.push('[vo]asplit=2[vo1][key]', '[mu][key]sidechaincompress=threshold=0.03:ratio=5:attack=15:release=250:makeup=1[mud]');
    parts.push('vo1', 'mud');
  } else parts.push(...(voices.length ? ['vo'] : []), ...(music.length ? ['mu'] : []));
  graph.push(`${parts.map((x) => `[${x}]`).join('')}amix=inputs=${parts.length}:normalize=0,apad,atrim=duration=${total},loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000[aout]`);
  audio = 'aout';
}

mkdirSync(join(p.root, 'out'), { recursive: true });
const srt = join(p.root, 'out', 'captions.srt');
const tc = (s) => { const ms = Math.round(s * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const texts = [...doc.text].sort((a, b) => a.t - b.t);
writeFileSync(srt, texts.map((x, i) => `${i + 1}\n${tc(x.t)} --> ${tc(Math.min(total, x.t + x.d))}\n${x.text}\n`).join('\n'));

const canBurn = execFileSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' }).includes(' subtitles ');
const burn = flags.includes('--burn') && texts.length;
if (burn && !canBurn) console.warn('this ffmpeg has no subtitles filter (libass); the text goes in as a subtitle track instead');
let vout = 'vout';
if (burn && canBurn) {
  graph.push(`[vout]subtitles=${srt.replace(/([\\:'])/g, '\\$1')}:force_style='FontName=Pretendard,FontSize=22,PrimaryColour=&H00F7FAFA,OutlineColour=&H00090A0A,Outline=2,Shadow=0,MarginV=48'[vsub]`);
  vout = 'vsub';
}
const subIn = texts.length && !(burn && canBurn) ? ['-i', srt] : [];
const subIndex = cuts.length + doc.audio.length;
const out = join(p.root, 'out', 'final.mp4');
execFileSync('ffmpeg', [
  '-v', 'error', '-y', ...inputs, ...subIn,
  '-filter_complex', graph.join(';'),
  '-map', `[${vout}]`, '-map', `[${audio}]`, ...(subIn.length ? ['-map', `${subIndex}:s`, '-c:s', 'mov_text', '-metadata:s:s:0', 'language=und'] : []),
  '-frames:v', String(frames), '-r', String(F), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
  '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out,
], { stdio: 'inherit' });
console.log(`built ${out}: ${frames} frames at ${F} fps, ${cuts.length} cuts, ${doc.audio.length} audio items, ${texts.length} text items${burn && canBurn ? ' (burned in)' : texts.length ? ' (subtitle track + out/captions.srt)' : ''}`);
console.log(`next: python3 "$SKILL_ROOT/harness/gate.py" final "${p.root}"`);
