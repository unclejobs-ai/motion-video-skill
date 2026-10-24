// vo-assemble.mjs — trim, loudness-normalize and place every VO line at its cue on one track.
// Usage: node vo-assemble.mjs <voDir> <durationSeconds> <cues.json>
//   cues.json: [["n1", 0.6], ["n2", 3.6], …]   (line id, start second — snap starts to beats)
// Uses <voDir>/<id>.wav if present (a hand-fixed take), otherwise <voDir>/<id>.mp3.
// Writes <voDir>/trim/*.wav, <voDir>/norm/*.wav, <voDir>/vo_track.wav and prints each line's length and end time.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [, , dir, durArg, cuesPath] = process.argv;
if (!dir || !durArg || !cuesPath) { console.error('usage: node vo-assemble.mjs <voDir> <seconds> <cues.json>'); process.exit(2); }
const duration = Number(durArg);
const cues = JSON.parse(readFileSync(cuesPath, 'utf8'));
mkdirSync(join(dir, 'trim'), { recursive: true }); mkdirSync(join(dir, 'norm'), { recursive: true });
const ff = args => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const dur = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim());

cues.forEach(([id, start], i) => {
  const src = existsSync(join(dir, `${id}.wav`)) ? join(dir, `${id}.wav`) : join(dir, `${id}.mp3`);
  ff(['-i', src, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse', '-ar', '48000', '-ac', '2', join(dir, 'trim', `${id}.wav`)]);
  ff(['-i', join(dir, 'trim', `${id}.wav`), '-af', 'loudnorm=I=-16:TP=-2:LRA=7', '-ar', '48000', '-ac', '2', join(dir, 'norm', `${id}.wav`)]);
  const len = dur(join(dir, 'norm', `${id}.wav`)), end = start + len;
  const next = cues[i + 1]?.[1];
  console.log(`${id.padEnd(4)} start ${start.toFixed(3)}  len ${len.toFixed(3)}  end ${end.toFixed(3)}${next != null && end > next ? `  ⚠ overlaps next cue at ${next}` : ''}`);
});

const args = [];
cues.forEach(([id]) => args.push('-i', join(dir, 'norm', `${id}.wav`)));
const delays = cues.map(([, t], i) => { const ms = Math.round(t * 1000); return `[${i}]adelay=${ms}|${ms}[d${i}]`; }).join(';');
const inputs = cues.map((_, i) => `[d${i}]`).join('');
ff([...args, '-filter_complex', `${delays};${inputs}amix=inputs=${cues.length}:normalize=0:dropout_transition=0,apad=whole_dur=${duration},atrim=0:${duration}[o]`,
  '-map', '[o]', '-ar', '48000', '-ac', '2', join(dir, 'vo_track.wav')]);
console.log(`wrote ${join(dir, 'vo_track.wav')} (${dur(join(dir, 'vo_track.wav')).toFixed(3)} s)`);
