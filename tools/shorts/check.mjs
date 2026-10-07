// The gate before a video is posted unattended (docs/specs/studio.md): what a machine can verify.
// Exits 1 with a list of failures; warnings don't fail.
//
//   node tools/shorts/check.mjs <timeline.json>
//
// File: 1080×1920, 30 fps, H.264 + AAC, under 50 MB, 8–60 s; the sound runs the whole length and
// isn't silent anywhere for more than 1.5 s. Timeline: a title on frame 1; every card at most 7 words
// and on screen long enough to read (0.3 s a word, at least 1 s); text inside the safe zone
// (y 150–1440); the name and openworldchess.com on screen; "free" in the end card or a card;
// sped-up or staged footage carries its label when the timeline says so (`claims`).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const tl = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = resolve(tl.out);
const fail = [], warn = [];
const need = (ok, msg) => { if (!ok) fail.push(msg); };
if (!existsSync(out)) { console.error(`FAIL: ${tl.out} doesn't exist (render it first)`); process.exit(1); }

// ---- the file
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', out]).toString());
const v = probe.streams.find((s) => s.codec_type === 'video'), a = probe.streams.find((s) => s.codec_type === 'audio');
need(v && v.width === 1080 && v.height === 1920, `video must be 1080×1920 (is ${v?.width}×${v?.height})`);
need(v?.codec_name === 'h264', `video must be H.264 (is ${v?.codec_name})`);
need(v && Math.abs(eval(v.r_frame_rate) - 30) < 0.01, `video must be 30 fps (is ${v?.r_frame_rate})`);
need(a?.codec_name === 'aac', `audio must be AAC (is ${a?.codec_name ?? 'missing'})`);
const dur = Number(probe.format.duration), vd = Number(v?.duration ?? dur), ad = Number(a?.duration ?? 0);
need(dur >= 8 && dur <= 60, `length must be 8–60 s (is ${dur.toFixed(1)})`);
need(Math.abs(vd - tl.seconds) < 0.2, `the video is ${vd.toFixed(1)} s but the timeline says ${tl.seconds}`);
need(ad >= vd - 0.15, `the sound ends at ${ad.toFixed(1)} s, before the picture (${vd.toFixed(1)} s)`);
need(statSync(out).size < 50e6, `file must be under 50 MB (is ${(statSync(out).size / 1e6).toFixed(1)})`);
// Silence: no gap over 1.5 s anywhere (the last half second may fade).
const silErr = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', out, '-vn', '-af', 'silencedetect=noise=-45dB:d=1.5', '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? '';
for (const m of silErr.matchAll(/silence_start: ([\d.]+)/g)) if (Number(m[1]) < vd - 0.6) fail.push(`the sound goes silent at ${Number(m[1]).toFixed(1)} s`);
// Frame 1 isn't black.
const y = execFileSync('ffmpeg', ['-v', 'error', '-i', out, '-frames:v', '1', '-vf', 'scale=16:16,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1e6 });
need([...y].reduce((s, b) => s + b, 0) / y.length > 16, 'frame 1 is black');

// ---- the timeline
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const texts = tl.layers.filter((l) => l.type === 'text');
const all = (l) => (l.lines ?? [l.text ?? '']).join(' ');
need(texts.some((l) => (l.t0 ?? 1) === 0 && (l.size ?? 120) >= 80), 'no big title on frame 1 (a text layer with t0 0, size 80 or more)');
for (const l of texts) {
  const n = words(all(l)), small = (l.size ?? 120) < 60;
  if (!small) need(n <= 7, `card over 7 words: "${all(l)}"`);
  if (l.t0 != null && l.t1 != null && !small) need(l.t1 - l.t0 >= Math.max(1, 0.3 * n) - 0.05, `card too brief to read (${(l.t1 - l.t0).toFixed(1)} s for ${n} words): "${all(l)}"`);
  const lines = (l.lines ?? ['']).length, top = (l.y ?? 400) - (l.size ?? 120) * 0.6, bottom = (l.y ?? 400) + (l.size ?? 120) * (lines - 0.4);
  need(top >= 140 && bottom <= 1460, `text outside the safe zone (y ${Math.round(top)}–${Math.round(bottom)}): "${all(l)}"`);
}
const end = tl.layers.find((l) => l.type === 'endcard');
const everything = [...texts.map(all), end?.sub ?? '', end?.url ?? '', end?.cta ?? '', ...(end ? ['open world chess'] : [])].join(' ').toLowerCase();
need(everything.includes('open world chess'), 'the name "Open World Chess" is never on screen');
need(everything.includes('openworldchess.com'), 'openworldchess.com is never on screen');
need(everything.includes('free'), '"free" is never on screen (free in your browser)');
if (!end) warn.push('no end card (fine for a mantra loop)');
// Labels the footage needs: "claims": { "spedUp": true, "staged": true } in the timeline.
const labels = tl.layers.filter((l) => l.type === 'label').map((l) => l.text.toLowerCase());
if (tl.claims?.spedUp) need(labels.some((t) => t.includes('sped')), 'sped-up footage needs a "Sped up" label');
if (tl.claims?.staged) need(labels.some((t) => t.includes('staged')), 'a staged battle needs a "Staged battle" label');
if (!tl.claims) warn.push('no "claims" in the timeline: say whether footage is sped up or staged');
for (const vo of tl.voice ?? []) if (vo.at != null && vo.at > tl.seconds) fail.push('a voice line starts after the end');

for (const w of warn) console.log('warn:', w);
if (fail.length) { for (const f of fail) console.error('FAIL:', f); process.exit(1); }
console.log(`ok: ${tl.out} (${dur.toFixed(1)} s, ${(statSync(out).size / 1e6).toFixed(1)} MB)`);
