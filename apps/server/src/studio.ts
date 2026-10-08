// The studio (docs/specs/studio.md): what the daily video agent needs from the server, behind one
// key (STUDIO_KEY, header x-studio-key). The agent holds no TikTok or voice credentials: the server
// posts as the studio's TikTok account, speaks through its own ElevenLabs key, and keeps the log of
// what was posted. Hard daily caps bound what a leaked key could do.
//
//   GET  /studio/tiktok/me            who we post as, and what TikTok allows
//   POST /studio/tiktok/post?mode=    body: the MP4; x-owc-meta: { title, privacy, comment, duet, stitch, yourBrand }
//   GET  /studio/tiktok/status?id=    a post's status
//   POST /studio/voice                { voice_id, text, model_id, voice_settings, previous_text?, next_text?, timed? } → ElevenLabs' reply
//   GET  /studio/log                  every video made so far
//   POST /studio/log                  append one entry (JSON)
//   GET  /studio/captions?v=          the owner's page: the latest captions, each with a Copy button (its own read-only key)
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname } from 'node:path';
import type { Game, PlayerRec } from './game.ts';
import { handleTikTok } from './tiktok.ts';

const KEY = process.env.STUDIO_KEY ?? '';
/** The player whose TikTok link is the studio's account (their in-game name, or their id). */
const WHO = process.env.STUDIO_PLAYER ?? '';
const VOICE_KEY = process.env.ELEVENLABS_API_KEY ?? '';
/** A read-only key for the owner's captions page (/studio/captions?v=…): it can't post or speak. */
const VIEW_KEY = process.env.STUDIO_VIEW_KEY ?? '';
/** A leaked key can do at most this in a day. */
const POSTS_A_DAY = 3, VOICE_CHARS_A_DAY = 8000, LOG_MAX = 400;

export interface StudioEntry { day: string; at: number; hook: string; pillar?: string; kind?: string; caption?: string; publishId?: string; status?: string; file?: string; notes?: string; timeline?: unknown; shots?: unknown }
interface State { log: StudioEntry[]; posts: number[]; voice: [number, number][] }

let file = '';
let state: State = { log: [], posts: [], voice: [] };
export function loadStudio(path: string) {
  file = path;
  try { if (existsSync(path)) state = { log: [], posts: [], voice: [], ...JSON.parse(readFileSync(path, 'utf8')) }; } catch { /* start empty */ }
}
function save() {
  if (!file) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file + '.tmp', JSON.stringify(state));
  renameSync(file + '.tmp', file);
}

const json = (res: ServerResponse, body: unknown, status = 200) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); };
const same = (a: string, b: string) => { const x = createHash('sha256').update(a).digest(), y = createHash('sha256').update(b).digest(); return timingSafeEqual(x, y); };
async function body(req: IncomingMessage, max: number): Promise<Buffer | null> {
  const parts: Buffer[] = []; let n = 0;
  for await (const c of req) { n += (c as Buffer).length; if (n > max) return null; parts.push(c as Buffer); }
  return Buffer.concat(parts);
}
const dayAgo = () => Date.now() - 24 * 3600_000;

export function studioPlayer(game: Game): PlayerRec | undefined {
  if (!WHO) return undefined;
  return game.players.get(WHO) ?? [...game.players.values()].find((p) => p.name === WHO && !p.isBot && !p.wild);
}

export async function handleStudio(game: Game, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://x'), path = url.pathname;
  if (!path.startsWith('/studio/')) return false;
  // The owner's captions page (a draft sent to TikTok can't carry its caption: TikTok's drafts API
  // takes only the file). Read-only, behind its own key, so the link can live in a phone's bookmarks.
  if (path === '/studio/captions') {
    if (!VIEW_KEY || !same(url.searchParams.get('v') ?? '', VIEW_KEY)) { json(res, { error: 'not found' }, 404); return true; }
    res.statusCode = 200; res.setHeader('content-type', 'text/html; charset=utf-8'); res.setHeader('cache-control', 'no-store'); res.setHeader('x-robots-tag', 'noindex');
    res.end(captionsPage(state.log.filter((e) => e.caption).slice(-10).reverse()));
    return true;
  }
  // Off unless a key is set; a wrong key learns nothing.
  if (!KEY || !same(String(req.headers['x-studio-key'] ?? ''), KEY)) { json(res, { error: 'not found' }, 404); return true; }

  if (path.startsWith('/studio/tiktok/')) {
    const pl = studioPlayer(game);
    if (!pl) { json(res, { error: 'No studio account is set (STUDIO_PLAYER)' }, 409); return true; }
    if (path === '/studio/tiktok/post') {
      state.posts = state.posts.filter((t) => t > dayAgo());
      if (state.posts.length >= POSTS_A_DAY) { json(res, { error: `The studio posts at most ${POSTS_A_DAY} videos a day` }, 429); return true; }
      state.posts.push(Date.now()); save();
    }
    // The same code that posts a player's battle clip, as the studio's player.
    req.url = req.url!.replace('/studio/tiktok/', '/tiktok/');
    req.headers['x-owc-token'] = pl.token;
    return handleTikTok(game, req, res);
  }

  if (path === '/studio/voice' && req.method === 'POST') {
    if (!VOICE_KEY) { json(res, { error: 'No voice key on the server' }, 409); return true; }
    const raw = await body(req, 64 * 1024);
    let q: { voice_id?: string; text?: string; model_id?: string; voice_settings?: unknown; previous_text?: string; next_text?: string; timed?: boolean } = {};
    try { q = JSON.parse(raw?.toString('utf8') ?? '{}'); } catch { /* empty */ }
    if (!q.voice_id || !/^[A-Za-z0-9]{10,40}$/.test(q.voice_id) || !q.text || q.text.length > 2500) { json(res, { error: 'voice_id and text (up to 2500 characters) are needed' }, 400); return true; }
    state.voice = state.voice.filter(([t]) => t > dayAgo());
    if (state.voice.reduce((s, [, n]) => s + n, 0) + q.text.length > VOICE_CHARS_A_DAY) { json(res, { error: 'The studio has spoken enough for today' }, 429); return true; }
    state.voice.push([Date.now(), q.text.length]); save();
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${q.voice_id}${q.timed ? '/with-timestamps' : ''}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': VOICE_KEY, 'content-type': 'application/json', ...(q.timed ? {} : { accept: 'audio/mpeg' }) },
      body: JSON.stringify({ text: q.text, model_id: q.model_id, voice_settings: q.voice_settings, previous_text: q.previous_text, next_text: q.next_text }),
    }).catch(() => null);
    if (!r) { json(res, { error: 'The voice service could not be reached' }, 502); return true; }
    res.statusCode = r.status;
    res.setHeader('content-type', r.headers.get('content-type') ?? 'application/octet-stream');
    res.setHeader('cache-control', 'no-store');
    res.end(Buffer.from(await r.arrayBuffer()));
    return true;
  }

  if (path === '/studio/log' && req.method === 'GET') {
    // The timelines are large: the list leaves them out unless asked (?full=1).
    const full = url.searchParams.has('full');
    json(res, { log: state.log.map((e) => (full ? e : { ...e, timeline: undefined, shots: undefined })), postsToday: state.posts.filter((t) => t > dayAgo()).length });
    return true;
  }
  if (path === '/studio/log' && req.method === 'POST') {
    const raw = await body(req, 512 * 1024);
    let e: Partial<StudioEntry> = {};
    try { e = JSON.parse(raw?.toString('utf8') ?? '{}'); } catch { /* empty */ }
    if (!e.day || !e.hook) { json(res, { error: 'An entry needs day and hook' }, 400); return true; }
    const entry: StudioEntry = { ...e, day: String(e.day).slice(0, 12), hook: String(e.hook).slice(0, 200), at: Date.now() } as StudioEntry;
    // The same day again replaces its entry (a status update after posting).
    const i = state.log.findIndex((x) => x.day === entry.day);
    if (i >= 0) state.log[i] = { ...state.log[i], ...entry }; else state.log.push(entry);
    if (state.log.length > LOG_MAX) state.log = state.log.slice(-LOG_MAX);
    save();
    json(res, { ok: true, entries: state.log.length });
    return true;
  }

  json(res, { error: 'not found' }, 404);
  return true;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const STATUS: Record<string, string> = { SEND_TO_USER_INBOX: 'In your TikTok drafts', PUBLISH_COMPLETE: 'Posted', skipped: 'Skipped' };

/** The captions page: newest first, one tap to copy. */
function captionsPage(log: StudioEntry[]): string {
  const when = (at: number) => new Date(at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const cards = log.map((e, i) => `<article${i === 0 ? ' class="latest"' : ''}>
<div class="meta">Day ${esc(e.day)} · ${esc(when(e.at))} PT · ${esc(STATUS[e.status ?? ''] ?? e.status ?? '')}</div>
<h2>${esc(e.hook)}</h2>
<p class="cap" id="c${i}">${esc(e.caption ?? '')}</p>
<button data-c="c${i}">Copy caption</button>
</article>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Studio captions · Open World Chess</title>
<style>
:root { color-scheme: dark; }
body { margin: 0; background: #23211f; color: #ece6da; font: 17px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 620px; margin: 0 auto; padding: 20px 16px 60px; }
h1 { font-size: 22px; margin: 6px 0 4px; }
.sub { color: #b8b0a2; font-size: 14.5px; margin: 0 0 18px; }
article { background: #2d2a27; border: 1px solid rgba(255,255,255,.1); border-radius: 14px; padding: 16px; margin: 0 0 14px; }
article.latest { border-color: rgba(243,210,122,.55); }
.meta { color: #b8b0a2; font-size: 13.5px; }
h2 { font-size: 18px; margin: 4px 0 8px; }
.cap { white-space: pre-wrap; background: #1c1a18; border-radius: 10px; padding: 12px; margin: 0 0 12px; user-select: all; -webkit-user-select: all; }
button { width: 100%; font: inherit; font-weight: 800; padding: 13px; border: 0; border-radius: 99px; background: linear-gradient(180deg, #f7d774, #e3b23c); color: #23211f; }
button.done { background: #95b957; }
.empty { color: #b8b0a2; }
</style></head><body><main>
<h1>Studio captions</h1>
<p class="sub">TikTok drafts arrive without a caption. Copy it here, paste it in TikTok, post.</p>
${cards || '<p class="empty">No captions yet.</p>'}
</main>
<script>
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-c]'); if (!b) return;
  const text = document.getElementById(b.dataset.c).textContent;
  const ok = () => { b.textContent = 'Copied'; b.classList.add('done'); setTimeout(() => { b.textContent = 'Copy caption'; b.classList.remove('done'); }, 1800); };
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(ok, () => { const r = document.createRange(); r.selectNodeContents(document.getElementById(b.dataset.c)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); try { document.execCommand('copy'); ok(); } catch { b.textContent = 'Select the text above and copy'; } });
});
</script></body></html>`;
}
