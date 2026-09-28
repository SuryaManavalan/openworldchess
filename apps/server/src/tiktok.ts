// TikTok (docs/specs/tiktok.md): Login Kit, the Content Posting API and webhooks.
//
// - Sign in with TikTok works like Google sign-in (auth.ts): it saves a guest
//   empire, continues an existing one, or starts a new one. A signed-in player
//   can also connect TikTok just to share clips.
// - Sharing: the browser renders a replay clip of a battle and sends the file
//   here; we upload it to the player's TikTok, either straight to their profile
//   (video.publish, with the privacy and interaction settings they chose) or to
//   their drafts (video.upload). Tokens never leave the server.
// - Webhooks: post.publish.* tells the player when their clip is live;
//   authorization.removed deletes the tokens we hold.
//
// Env: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, PUBLIC_URL
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Game, PlayerRec } from './game.ts';
import { finish, html } from './auth.ts';
import { stats } from './stats.ts';

const KEY = process.env.TIKTOK_CLIENT_KEY ?? '';
const SECRET = process.env.TIKTOK_CLIENT_SECRET ?? '';
/** Webhooks are signed with the secret of whichever app (Sandbox or Production) sent them. */
const WEBHOOK_SECRETS = [SECRET, ...(process.env.TIKTOK_WEBHOOK_SECRETS ?? '').split(',')].map((x) => x.trim()).filter(Boolean);
const PUBLIC_URL = (process.env.PUBLIC_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const REDIRECT = `${PUBLIC_URL}/auth/tiktok/callback`;
// Overridable so tests can stand in for TikTok.
const API = process.env.TIKTOK_API ?? 'https://open.tiktokapis.com/v2';
const AUTHORIZE = process.env.TIKTOK_AUTHORIZE ?? 'https://www.tiktok.com/v2/auth/authorize/';
const SCOPES = 'user.info.basic,video.publish,video.upload';
/** TikTok takes a single-chunk upload up to 64MB; our clips are far smaller. */
const MAX_VIDEO = 60 * 1024 * 1024;

export const tiktokEnabled = () => !!(KEY && SECRET);

/** What we hold for a connected TikTok account (deleted on disconnect). */
export interface TikTokLink {
  name: string;
  avatar?: string;
  access: string;
  refresh: string;
  expiresAt: number;
  refreshUntil: number;
  scope: string;
}

/** state nonce → the game token that started the flow, and where to land after. */
const pending = new Map<string, { token: string | null; then: string; at: number }>();
/** publish id → player, so webhooks and status checks reach the right empire. */
const posts = new Map<string, { player: string; at: number; mode: 'direct' | 'draft' }>();
const lastPost = new Map<string, number>();

type TokenReply = { access_token?: string; refresh_token?: string; open_id?: string; expires_in?: number; refresh_expires_in?: number; scope?: string; error?: string; error_description?: string };

async function tokenCall(body: Record<string, string>): Promise<TokenReply> {
  return fetch(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'cache-control': 'no-cache' },
    body: new URLSearchParams({ client_key: KEY, client_secret: SECRET, ...body }),
  }).then((r) => r.json() as Promise<TokenReply>).catch(() => ({ error: 'network' }));
}

function linkFrom(t: TokenReply, name: string, avatar?: string): TikTokLink {
  const now = Date.now();
  return {
    name, avatar, access: t.access_token!, refresh: t.refresh_token!, scope: t.scope ?? '',
    expiresAt: now + (t.expires_in ?? 86_400) * 1000 - 60_000, refreshUntil: now + (t.refresh_expires_in ?? 31_536_000) * 1000,
  };
}

/** A fresh access token for this player, refreshing it when it's about to lapse. */
async function access(p: PlayerRec): Promise<string | null> {
  const l = p.tiktok;
  if (!l) return null;
  if (Date.now() < l.expiresAt) return l.access;
  if (Date.now() > l.refreshUntil) { p.tiktok = undefined; return null; }
  const t = await tokenCall({ grant_type: 'refresh_token', refresh_token: l.refresh });
  if (!t.access_token) return null;
  p.tiktok = { ...linkFrom(t, l.name, l.avatar) };
  return p.tiktok.access;
}

type ApiReply<T> = { data?: T; error?: { code: string; message?: string } };
async function api<T>(p: PlayerRec, path: string, body?: unknown): Promise<ApiReply<T>> {
  const tok = await access(p);
  if (!tok) return { error: { code: 'not_connected', message: 'Connect TikTok again' } };
  return fetch(`${API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json; charset=UTF-8' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => r.json() as Promise<ApiReply<T>>).catch(() => ({ error: { code: 'network', message: 'TikTok could not be reached' } }));
}

/**
 * Browsers record MP4 clips with H.264 video but often Opus audio, which TikTok
 * doesn't list. The video is copied as-is and only the audio becomes AAC: cheap
 * (no video re-encode on the game server). WebM (VP8/VP9 + Opus) is accepted as
 * it is. Falls back to the original if ffmpeg isn't there or fails.
 */
export async function normalize(video: Buffer, type: string): Promise<{ video: Buffer; type: string }> {
  if (!type.includes('mp4')) return { video, type };
  const dir = await mkdtemp(join(tmpdir(), 'owc-clip-'));
  try {
    const src = join(dir, 'in.mp4'), out = join(dir, 'out.mp4');
    await writeFile(src, video);
    const ok = await new Promise<boolean>((done) => {
      const p = spawn('nice', ['-n', '19', 'ffmpeg', '-v', 'error', '-y', '-threads', '1', '-i', src, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out], { stdio: 'ignore' });
      const t = setTimeout(() => p.kill('SIGKILL'), 60_000);
      p.on('error', () => { clearTimeout(t); done(false); });
      p.on('exit', (code) => { clearTimeout(t); done(code === 0); });
    });
    return ok ? { video: await readFile(out), type: 'video/mp4' } : { video, type };
  } catch { return { video, type }; } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

/** TikTok's error codes, in words a player can act on. */
function explain(code?: string): string | undefined {
  switch (code) {
    case 'unaudited_client_can_only_post_to_private_accounts': return 'For now, TikTok only lets this game post to private accounts. Set your TikTok account to private, or save the clip to your drafts instead.';
    case 'spam_risk_too_many_posts': case 'spam_risk_user_banned_from_posting': return 'TikTok is limiting posts from your account right now. Try again later.';
    case 'reached_active_user_cap': return 'TikTok has limited how many people can post from this game today. Try again tomorrow.';
    case 'privacy_level_option_mismatch': return 'That privacy option is not available for your account. Choose another.';
    case 'access_token_invalid': case 'scope_not_authorized': return 'Connect TikTok again to post.';
    default: return undefined;
  }
}

function json(res: ServerResponse, body: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const parts: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => { size += c.length; if (size > limit) { resolve(null); req.destroy(); } else parts.push(c); });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', () => resolve(null));
  });
}

const playerOf = (game: Game, req: IncomingMessage) => {
  const tok = req.headers['x-owc-token'];
  const id = typeof tok === 'string' ? game.tokens.get(tok) : undefined;
  return id ? game.players.get(id) : undefined;
};

/** Verify a webhook's TikTok-Signature header ("t=<unix>,s=<hex hmac of `${t}.${body}`>"). */
export function verifyWebhook(header: string | undefined, body: string, secret = SECRET, now = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const t = Number(parts.t), s = parts.s ?? '';
  if (!t || Math.abs(now / 1000 - t) > 600) return false;
  const want = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return want.length === s.length && timingSafeEqual(Buffer.from(want), Buffer.from(s));
}

export async function handleTikTok(game: Game, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', PUBLIC_URL);
  const path = url.pathname;

  // ---------- Login Kit ----------
  if (path === '/auth/tiktok/start') {
    if (!tiktokEnabled()) { html(res, 'TikTok sign-in is not configured yet.', 503); return true; }
    const state = randomBytes(16).toString('hex');
    for (const [k, v] of pending) if (Date.now() - v.at > 10 * 60_000) pending.delete(k);
    const then = url.searchParams.get('then') ?? '';
    pending.set(state, { token: url.searchParams.get('token'), then: /^[a-z0-9:-]{0,40}$/i.test(then) ? then : '', at: Date.now() });
    const q = new URLSearchParams({ client_key: KEY, scope: SCOPES, response_type: 'code', redirect_uri: REDIRECT, state });
    // Ask again even if the player already approved (shows TikTok's consent screen).
    if (url.searchParams.get('consent') === '1') q.set('disable_auto_auth', '1');
    res.statusCode = 302;
    res.setHeader('location', `${AUTHORIZE}?${q}`);
    res.end();
    return true;
  }
  if (path === '/auth/tiktok/callback') {
    const state = url.searchParams.get('state') ?? '', code = url.searchParams.get('code') ?? '';
    const p = pending.get(state);
    pending.delete(state);
    const back = '<a style="color:#95b957" href="/">Back to the game</a>';
    if (url.searchParams.get('error')) { html(res, `TikTok sign-in was cancelled. ${back}`); return true; }
    if (!p || !code) { html(res, `Sign-in expired. ${back}`, 400); return true; }
    const t = await tokenCall({ code, grant_type: 'authorization_code', redirect_uri: REDIRECT });
    if (!t.access_token || !t.open_id) { html(res, `TikTok sign-in failed. ${back}`, 502); return true; }
    const info = await fetch(`${API}/user/info/?fields=open_id,avatar_url,display_name`, { headers: { authorization: `Bearer ${t.access_token}` } })
      .then((r) => r.json() as Promise<ApiReply<{ user?: { display_name?: string; avatar_url?: string } }>>).catch(() => ({ data: undefined }));
    const name = info.data?.user?.display_name ?? 'TikTok';
    const link = linkFrom(t, name, info.data?.user?.avatar_url);
    const land = p.then ? `/?then=${encodeURIComponent(p.then)}` : '/';
    // 1. This TikTok account already has an empire: continue it here.
    const owned = [...game.players.values()].find((pl) => pl.tiktokId === t.open_id);
    if (owned) { owned.tiktok = link; finish(res, owned.token, `Welcome back, ${owned.name}.`, land); return true; }
    // 2. Link it to the empire that started the flow (a guest, or a Google account connecting TikTok to share).
    const curId = p.token ? game.tokens.get(p.token) : undefined;
    const cur = curId ? game.players.get(curId) : undefined;
    if (cur && !cur.isBot && !cur.wild && !cur.tiktokId) {
      const wasGuest = game.isGuest(cur);
      cur.tiktokId = t.open_id; cur.tiktok = link; cur.leftAt = undefined;
      if (wasGuest) stats.signIn('tiktok');
      game.onPlayers();
      finish(res, cur.token, wasGuest ? `Your empire is safe, ${cur.name}.` : 'TikTok connected.', land);
      return true;
    }
    // 3. Otherwise start a new empire for this account.
    let nm = name.replace(/[^\p{L}\p{N}_ .-]/gu, '').slice(0, 16) || 'Ruler';
    while (game.checkName(nm)) nm = nm.slice(0, 16) + Math.floor(Math.random() * 999);
    const pl = game.create(nm, false);
    pl.tiktokId = t.open_id; pl.tiktok = link;
    stats.signIn('tiktok');
    finish(res, pl.token, `Welcome, ${pl.name}.`, land);
    return true;
  }

  // ---------- Webhooks ----------
  if (path === '/tiktok/webhook') {
    if (req.method !== 'POST') { json(res, { ok: true }); return true; }
    const raw = (await readBody(req, 64 * 1024))?.toString() ?? '';
    const sig = req.headers['tiktok-signature'];
    // Always answer 200 (TikTok retries, and its test events come signed by whichever app
    // sent them); act only on events whose signature checks out.
    json(res, { ok: true });
    const header = typeof sig === 'string' ? sig : undefined;
    if (!WEBHOOK_SECRETS.some((sec) => verifyWebhook(header, raw, sec))) { console.log('tiktok: webhook ignored (signature did not verify)'); return true; }
    let ev: { event?: string; user_openid?: string; content?: string };
    try { ev = JSON.parse(raw); } catch { return true; }
    onWebhook(game, ev.event ?? '', ev.user_openid ?? '', (() => { try { return JSON.parse(ev.content ?? '{}'); } catch { return {}; } })());
    return true;
  }

  // ---------- The player's own TikTok (called from the game with the player's token) ----------
  if (!path.startsWith('/tiktok/')) return false;
  const pl = playerOf(game, req);
  if (!pl) { json(res, { error: 'Not signed in' }, 401); return true; }

  if (path === '/tiktok/me') {
    if (!tiktokEnabled()) { json(res, { enabled: false }); return true; }
    if (!pl.tiktok) { json(res, { enabled: true, connected: false }); return true; }
    // The creator's current settings: who we'll post as, and what they allow (Content Posting UX rules).
    const c = await api<{ creator_avatar_url?: string; creator_username?: string; creator_nickname?: string; privacy_level_options?: string[]; comment_disabled?: boolean; duet_disabled?: boolean; stitch_disabled?: boolean; max_video_post_duration_sec?: number }>(pl, '/post/publish/creator_info/query/', {});
    if (c.error && c.error.code !== 'ok') {
      if (c.error.code === 'not_connected' || c.error.code === 'access_token_invalid') { pl.tiktok = undefined; json(res, { enabled: true, connected: false }); return true; }
      json(res, { enabled: true, connected: true, name: pl.tiktok.name, avatar: pl.tiktok.avatar, blocked: c.error.code === 'spam_risk_too_many_posts' ? 'You have posted a lot today. Try again tomorrow.' : c.error.message || 'TikTok cannot take posts from this account right now.' });
      return true;
    }
    const d = c.data ?? {};
    json(res, {
      enabled: true, connected: true,
      name: d.creator_nickname ?? pl.tiktok.name, username: d.creator_username, avatar: d.creator_avatar_url ?? pl.tiktok.avatar,
      privacy: d.privacy_level_options ?? [], commentOff: !!d.comment_disabled, duetOff: !!d.duet_disabled, stitchOff: !!d.stitch_disabled,
      maxSec: d.max_video_post_duration_sec ?? 60,
    });
    return true;
  }

  if (path === '/tiktok/post' && req.method === 'POST') {
    if (!pl.tiktok) { json(res, { error: 'Connect TikTok first' }, 400); return true; }
    if (Date.now() - (lastPost.get(pl.id) ?? 0) < 30_000) { json(res, { error: 'One moment: your last clip is still on its way' }, 429); return true; }
    const mode = url.searchParams.get('mode') === 'draft' ? 'draft' : 'direct';
    const type = String(req.headers['content-type'] ?? '');
    if (!/^video\/(mp4|webm|quicktime)/.test(type)) { json(res, { error: 'Unsupported video type' }, 415); return true; }
    let meta: { title?: string; privacy?: string; comment?: boolean; duet?: boolean; stitch?: boolean; yourBrand?: boolean; branded?: boolean } = {};
    try { meta = JSON.parse(decodeURIComponent(String(req.headers['x-owc-meta'] ?? '%7B%7D'))); } catch { /* defaults */ }
    const raw = await readBody(req, MAX_VIDEO);
    if (!raw || raw.length < 1000) { json(res, { error: 'The clip is too large or empty' }, 413); return true; }
    if (mode === 'direct' && !meta.privacy) { json(res, { error: 'Choose who can see this post' }, 400); return true; }
    if (mode === 'direct' && meta.branded && meta.privacy === 'SELF_ONLY') { json(res, { error: 'Branded content cannot be private' }, 400); return true; }
    lastPost.set(pl.id, Date.now());
    const { video, type: vtype } = process.env.TIKTOK_NO_TRANSCODE ? { video: raw, type } : await normalize(raw, type);
    const source_info = { source: 'FILE_UPLOAD', video_size: video.length, chunk_size: video.length, total_chunk_count: 1 };
    let init: ApiReply<{ publish_id: string; upload_url: string }>;
    if (mode === 'direct') {
      init = await api(pl, '/post/publish/video/init/', {
        post_info: {
          title: (meta.title ?? '').slice(0, 2200), privacy_level: meta.privacy,
          disable_comment: !meta.comment, disable_duet: !meta.duet, disable_stitch: !meta.stitch,
          brand_organic_toggle: !!meta.yourBrand, brand_content_toggle: !!meta.branded,
          video_cover_timestamp_ms: 1000,
        },
        source_info,
      });
    } else init = await api(pl, '/post/publish/inbox/video/init/', { source_info });
    if (!init.data?.upload_url) {
      lastPost.delete(pl.id);
      console.log(`tiktok: ${mode} init refused: ${init.error?.code ?? 'no code'}`);
      json(res, { error: explain(init.error?.code) ?? init.error?.message ?? 'TikTok did not accept the clip' }, 502);
      return true;
    }
    const put = await fetch(init.data.upload_url, {
      method: 'PUT',
      headers: { 'content-type': vtype.split(';')[0], 'content-length': String(video.length), 'content-range': `bytes 0-${video.length - 1}/${video.length}` },
      body: new Uint8Array(video),
    }).catch(() => null);
    if (!put || !put.ok) { lastPost.delete(pl.id); json(res, { error: 'Uploading to TikTok failed' }, 502); return true; }
    for (const [k, v] of posts) if (Date.now() - v.at > 24 * 3600_000) posts.delete(k);
    posts.set(init.data.publish_id, { player: pl.id, at: Date.now(), mode });
    stats.share();
    json(res, { publishId: init.data.publish_id });
    return true;
  }

  if (path === '/tiktok/status') {
    const id = url.searchParams.get('id') ?? '';
    if (posts.get(id)?.player !== pl.id) { json(res, { error: 'Unknown post' }, 404); return true; }
    const s = await api<{ status?: string; fail_reason?: string }>(pl, '/post/publish/status/fetch/', { publish_id: id });
    if (s.data?.fail_reason) console.log(`tiktok: post failed: ${s.data.fail_reason}`);
    json(res, { status: s.data?.status ?? 'UNKNOWN', fail: s.data?.fail_reason });
    return true;
  }

  if (path === '/tiktok/disconnect' && req.method === 'POST') {
    const l = pl.tiktok;
    if (l) await fetch(`${API}/oauth/revoke/`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: KEY, client_secret: SECRET, token: l.access }) }).catch(() => {});
    pl.tiktok = undefined;
    // An empire that signs in only through TikTok keeps the account id as its login.
    if (pl.googleSub) pl.tiktokId = undefined;
    game.onPlayers();
    json(res, { ok: true });
    return true;
  }

  json(res, { error: 'not found' }, 404);
  return true;
}

function onWebhook(game: Game, event: string, openId: string, content: { publish_id?: string; reason?: string }) {
  console.log(`tiktok: webhook ${event}${content.reason ? ` (${content.reason})` : ''}`);
  const post = content.publish_id ? posts.get(content.publish_id) : undefined;
  const p = post ? game.players.get(post.player) : [...game.players.values()].find((x) => x.tiktokId === openId);
  if (!p) return;
  if (event === 'authorization.removed') {
    p.tiktok = undefined;
    if (p.googleSub) p.tiktokId = undefined;
    game.onPlayers();
    return;
  }
  if (event === 'post.publish.complete' || event === 'post.publish.publicly_available')
    game.onAlert(p.id, { kind: 'info', text: 'Your battle clip is live on TikTok.' });
  else if (event === 'post.publish.inbox_delivered')
    game.onAlert(p.id, { kind: 'info', text: 'Your battle clip is waiting in your TikTok drafts.' });
  else if (event === 'post.publish.failed')
    game.onAlert(p.id, { kind: 'info', text: 'TikTok could not post your battle clip. Try again from the battle.' });
}
