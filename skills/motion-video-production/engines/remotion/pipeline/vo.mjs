// vo.mjs — generate one audio file per script line through the composio CLI (ElevenLabs / Fish Audio).
// Usage: node vo.mjs <voDir> [lineId …]        (no ids → generate every line whose mp3 is missing)
//   <voDir>/script.json : [{ "id": "n1", "who": "narrator", "text": "spoken form (스물다섯)", "caption": "shown form (25)" }]
//   <voDir>/voices.json : { "narrator": { "provider": "elevenlabs", "voice": "<voice_id>", "model": "eleven_v3" },
//                           "mascot":   { "provider": "fish",       "voice": "<model_id>", "temperature": 0.8 } }
//   env SEED=<n> changes the ElevenLabs seed for a retake.
// Accounts are not stored in the production: the single ACTIVE composio connection of the toolkit is used, or
// "account": "<word_id>" in voices.json / env COMPOSIO_ACCOUNT_ELEVENLABS, COMPOSIO_ACCOUNT_FISH when there are several.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [, , dir, ...only] = process.argv;
if (!dir) { console.error('usage: node vo.mjs <voDir> [ids…]'); process.exit(2); }
const lines = JSON.parse(readFileSync(join(dir, 'script.json'), 'utf8'));
const voices = JSON.parse(readFileSync(join(dir, 'voices.json'), 'utf8'));

const TOOLKIT = { elevenlabs: 'elevenlabs', fish: 'fish_audio' };
function accountFor(v) {
  const pinned = v.account ?? process.env[`COMPOSIO_ACCOUNT_${v.provider.toUpperCase()}`];
  if (pinned) return pinned;
  const list = JSON.parse(execFileSync('composio', ['link', TOOLKIT[v.provider], '--list'], { encoding: 'utf8' }));
  const active = list.items.filter((i) => i.status === 'ACTIVE' && !i.is_disabled);
  if (active.length !== 1) throw new Error(`${active.length} ACTIVE ${TOOLKIT[v.provider]} connections: set "account" or COMPOSIO_ACCOUNT_${v.provider.toUpperCase()} (composio link ${TOOLKIT[v.provider]} --list)`);
  return active[0].word_id;
}

function execute(slug, account, data) {
  const out = execFileSync('composio', ['execute', slug, '--account', account, '-d', JSON.stringify(data)], { encoding: 'utf8', maxBuffer: 64 << 20 });
  let json = JSON.parse(out);
  // large responses are spilled to a file
  if (json.outputFilePath) json = { ...json, data: JSON.parse(readFileSync(json.outputFilePath, 'utf8')) };
  if (json.successful === false) throw new Error(`${slug}: ${typeof json.error === 'string' ? json.error : JSON.stringify(json.error)}`);
  return json;
}
// the audio arrives as a (presigned) URL somewhere in the response
function findUrl(o) {
  if (typeof o === 'string' && /^https?:\/\//.test(o)) return o;
  if (o && typeof o === 'object') for (const k of Object.keys(o)) { const u = findUrl(o[k]); if (u) return u; }
  return null;
}

for (const line of lines) {
  if (only.length && !only.includes(line.id)) continue;
  const file = join(dir, `${line.id}.mp3`);
  if (!only.length && existsSync(file)) continue;
  const v = voices[line.who];
  if (!v) throw new Error(`no voice configured for "${line.who}"`);
  const res = v.provider === 'elevenlabs'
    ? execute('ELEVENLABS_TEXT_TO_SPEECH', accountFor(v), { voice_id: v.voice, model_id: v.model ?? 'eleven_v3', text: line.text, output_format: 'mp3_44100_128', seed: Number(process.env.SEED ?? 11) })
    : execute('FISH_AUDIO_SYNTHESIZE_SPEECH', accountFor(v), { voice_model_ids: [v.voice], text: line.text, format: 'mp3', temperature: v.temperature ?? 0.8 });
  const url = findUrl(res.data);
  if (!url) { writeFileSync(file + '.response.json', JSON.stringify(res, null, 2)); throw new Error(`${line.id}: no audio URL in response`); }
  execFileSync('curl', ['-sSfL', '-o', file, url]);
  console.log(line.id, line.who, 'ok');
}
