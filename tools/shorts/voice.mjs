// Voice lines through ElevenLabs, cached by (voice, text, settings): the same
// line is never paid for twice. The key lives in ~/.config/owc/elevenlabs.key
// (or ELEVENLABS_API_KEY), never in the repo.
//
//   import { speak } from './voice.mjs'; const file = await speak('chronicler', 'The whole world is a chessboard.');
//   node tools/shorts/voice.mjs chronicler "The whole world is a chessboard."   (writes and prints the file)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

/** The series' two voices (see the skill's copy.md). Stock ElevenLabs voices, not clones of anyone. */
export const VOICES = {
  chronicler: { id: 'JBFqnCBsd6RMkjVDRZzb', settings: { stability: 0.55, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } }, // George: warm storyteller
  // Charlie: deep, energetic. Steadier than first set (2026-09-28): at stability 0.35 / style 0.6
  // short lines ended on a rising, questioning note.
  caster: { id: 'IKne3meq5aSn9XLyUdCD', settings: { stability: 0.62, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true } },
};
const MODEL = 'eleven_multilingual_v2';
const CACHE = new URL('../../out/voice-cache/', import.meta.url).pathname;

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const f = join(homedir(), '.config/owc/elevenlabs.key');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  throw new Error('No ElevenLabs key: put it in ~/.config/owc/elevenlabs.key');
}

/**
 * An MP3 of `text` in `voice`; returns its path (cached).
 * opts.settings overrides the voice's settings for this line; opts.prev / opts.next are the
 * lines around it, sent as context (not spoken) so a short line lands as part of a script,
 * with a settled, falling ending instead of a lone line's rising one.
 */
export async function speak(voice, text, opts = {}) {
  const v = VOICES[voice];
  if (!v) throw new Error(`unknown voice ${voice}`);
  mkdirSync(CACHE, { recursive: true });
  const settings = { ...v.settings, ...(opts.settings ?? {}) };
  const ctx = opts.prev || opts.next ? [opts.prev ?? '', opts.next ?? ''] : null;
  const key = createHash('sha1').update(JSON.stringify(ctx ? [v.id, MODEL, settings, text, ctx] : [v.id, MODEL, settings, text])).digest('hex').slice(0, 16);
  const file = join(CACHE, `${voice}-${key}${opts.timed ? '-t' : ''}.mp3`);
  if (existsSync(file)) return file;
  if (opts.timed) {
    // The same speech, plus when each character is spoken (for cards that follow the words).
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.id}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey(), 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: settings, ...(ctx ? { previous_text: ctx[0] || undefined, next_text: ctx[1] || undefined } : {}) }),
    });
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    writeFileSync(file, Buffer.from(j.audio_base64, 'base64'));
    writeFileSync(file.replace(/\.mp3$/, '.json'), JSON.stringify(j.alignment));
    return file;
  }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.id}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey(), 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: settings, ...(ctx ? { previous_text: ctx[0] || undefined, next_text: ctx[1] || undefined } : {}) }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

/** The words of a timed line (speak with `timed`), each with when it starts and ends (seconds). */
export function words(file) {
  const a = JSON.parse(readFileSync(file.replace(/\.mp3$/, '.json'), 'utf8'));
  const out = [];
  let cur = null;
  a.characters.forEach((ch, i) => {
    if (/[\p{L}\p{N}']/u.test(ch)) {
      if (!cur) { cur = { w: '', s: a.character_start_times_seconds[i], e: 0 }; out.push(cur); }
      cur.w += ch.toLowerCase(); cur.e = a.character_end_times_seconds[i];
    } else cur = null;
  });
  return out;
}

/** Length of an audio file in seconds. */
export function duration(file) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const f = await speak(process.argv[2], process.argv.slice(3).join(' '));
  console.log(f, `${duration(f).toFixed(2)}s`);
}
