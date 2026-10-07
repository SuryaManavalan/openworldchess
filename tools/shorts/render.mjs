// Assemble a short from a timeline: footage underneath, the overlay (text, art,
// effects) drawn by scene.js on top, our own score, and voice lines.
//
//   node tools/shorts/render.mjs <timeline.json>
//
// timeline.json:
//   {
//     "out": "out/day01/day01.mp4",
//     "seconds": 21,
//     "base": { "video": "out/day01/world.mp4", "start": 0, "speed": 1 }   // or "background": "#23211f"
//     "layers": [ ...see scene.js... ],
//     "audio": { "bpm": 100, "musicGain": 0.55, "sfxGain": 0.8, "bright": false },
//     "voice": [ { "at": 0.3, "voice": "chronicler", "text": "The whole world is a chessboard.", "settings": {} } ],
//     "voiceContext": true   // send each line's neighbours as context (steadier, script-like delivery)
//   }
// Flowing narration (preferred, 2026-09-30): one or two long voice lines with "timed": true, and
// text layers with "cue": "a phrase from the line" instead of t0/t1. A cued card appears as the
// phrase is spoken (a little before: "lead", default 0.1 s) and stays until the next cued card
// (or its own "hold" seconds after the phrase ends).
// Paths are relative to the repo root.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { speak, duration, words } from './voice.mjs';

const tl = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const FPS = 30, W = 1080, H = 1920;
const out = resolve(tl.out);
const work = out.replace(/\.mp4$/, '.work');
mkdirSync(work, { recursive: true });
for (const l of tl.layers) if (l.type === 'image' && !/^(https?|data|file):/.test(l.src)) l.src = 'file://' + resolve(l.src);

// 1. Voice lines (cached), checked to fit before the next line starts.
const voices = [];
const lines = tl.voice ?? [];
for (const [i, v] of lines.entries()) {
  // "voiceContext": each line hears its neighbours (same voice), for a script's natural cadence.
  const near = (j) => (tl.voiceContext && lines[j]?.voice === v.voice ? lines[j].text : undefined);
  const file = await speak(v.voice, v.text, { settings: v.settings, prev: near(i - 1), next: near(i + 1), timed: v.timed });
  const d = duration(file);
  voices.push({ ...v, file, d, words: v.timed ? words(file) : null });
  console.log(`voice ${v.at.toFixed(1)}s +${d.toFixed(1)}s  ${v.voice}: ${v.text}`);
}
for (let i = 0; i + 1 < voices.length; i++) if (voices[i].at + voices[i].d > voices[i + 1].at) console.warn(`! voice line ${i} runs into line ${i + 1}`);
if (voices.length && voices.at(-1).at + voices.at(-1).d > tl.seconds) console.warn('! the last voice line runs past the end');

// Cards cued to the narration: find each phrase in the timed lines, in order.
{
  const norm = (s) => s.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  const spoken = voices.filter((v) => v.words).flatMap((v) => v.words.map((w) => ({ ...w, s: w.s + v.at, e: w.e + v.at })));
  let from = 0;
  const cued = tl.layers.filter((l) => l.cue);
  const prev = new Map();
  for (const l of cued) {
    // Several cards on the same words (a title and its subtitle) share one match.
    const same = prev.get(l.cue);
    if (same) { l.t0 = same.t0; l.cueEnd = same.cueEnd; continue; }
    const want = norm(l.cue);
    let hit = -1;
    for (let i = from; i + want.length <= spoken.length && hit < 0; i++) if (want.every((w, j) => spoken[i + j].w === w)) hit = i;
    if (hit < 0) throw new Error(`cue not found in the narration: "${l.cue}"`);
    from = hit + want.length;
    l.t0 = Math.max(0, spoken[hit].s - (l.lead ?? 0.1));
    l.cueEnd = spoken[hit + want.length - 1].e;
    prev.set(l.cue, l);
  }
  // A card holds until the next card on different words (cards sharing a cue end together).
  cued.forEach((l, i) => { if (l.t1 == null) { const next = cued.slice(i + 1).find((n) => n.cue !== l.cue); l.t1 = l.hold != null ? l.cueEnd + l.hold : (next ? next.t0 - 0.05 : tl.seconds); } });
  for (const l of cued) console.log(`cue ${l.t0.toFixed(2)}–${l.t1.toFixed(2)}  "${l.cue}"`);
}

// 2. The overlay and the score, from scene.html.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('scene error:', e.message));
await page.goto('file://' + new URL('./scene.html', import.meta.url).pathname);
await page.evaluate((t) => window.setTimeline(t), tl);
const wav = await page.evaluate(() => window.renderAudio());
writeFileSync(`${work}/score.wav`, Buffer.from(wav, 'base64'));

// 3. ffmpeg: base video (or a color), overlay frames piped in, score + voices mixed.
const args = ['-v', process.env.FFV ?? 'error', '-y'];
if (tl.base?.video) args.push('-ss', String(tl.base.start ?? 0), '-i', resolve(tl.base.video));
else args.push('-f', 'lavfi', '-i', `color=c=${(tl.background ?? '#23211f').replace('#', '0x')}:s=${W}x${H}:r=${FPS}`);
// (-reinit_filter 0: an overlay that turns fully opaque, like a full-screen board, changes the
// PNGs' pixel format mid-stream; rebuilding the graph then threw the base video's timing off.)
args.push('-reinit_filter', '0', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-');
args.push('-i', `${work}/score.wav`);
for (const v of voices) args.push('-i', v.file);
const sp = tl.base?.speed ?? 1;
let fc = `[0:v]setpts=(PTS-STARTPTS)/${sp},fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},trim=duration=${tl.seconds}[b];[b][1:v]overlay=0:0:format=auto[v];`;
if (voices.length) {
  voices.forEach((v, i) => { const ms = Math.round(v.at * 1000); fc += `[${3 + i}:a]aresample=48000,adelay=${ms}|${ms},volume=${v.gain ?? 1.6}[v${i}];`; });
  fc += `${voices.map((_, i) => `[v${i}]`).join('')}amix=inputs=${voices.length}:normalize=0,apad,asplit=2[vo][vk];`; // apad: or the music ends with the last spoken word (the ducking stops at its shortest input)
  fc += `[2:a][vk]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350[md];[md][vo]amix=inputs=2:normalize=0[mix];`;
} else fc += `[2:a]anull[mix];`;
fc += `[mix]atrim=duration=${tl.seconds},loudnorm=I=-14:TP=-1.5:LRA=9[a]`;
args.push('-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', String(tl.seconds),
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out);
mkdirSync(dirname(out), { recursive: true });
const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
let ffDone = null;
ff.on('exit', (code, sig) => { ffDone = { code, sig }; });
ff.stdin.on('error', (e) => console.error('\nffmpeg input closed:', e.code, ffDone));
const frames = Math.round(tl.seconds * FPS);
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.draw(t), i / FPS);
  const png = await page.screenshot({ type: 'png', omitBackground: true });
  if (ffDone) { console.error(`\nffmpeg exited early at frame ${i}:`, ffDone); process.exit(1); }
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 30 === 0) process.stdout.write(`\rframe ${i}/${frames}`);
}
ff.stdin.end();
const code = await new Promise((r) => ff.on('close', r));
await browser.close();
if (code !== 0) { console.error(`\nffmpeg failed (${code})`); process.exit(1); }

// 4. A contact sheet for review: one frame every 2 seconds.
const sheet = out.replace(/\.mp4$/, '-sheet.jpg');
spawn('ffmpeg', ['-v', 'error', '-y', '-i', out, '-vf', `fps=1/2,scale=270:-1,tile=${Math.ceil(tl.seconds / 2 / 2)}x2`, '-frames:v', '1', sheet], { stdio: 'inherit' })
  .on('close', () => console.log(`\nwrote ${out}\nreview sheet ${sheet}`));
