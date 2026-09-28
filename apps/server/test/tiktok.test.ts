// TikTok (docs/specs/tiktok.md) against a stand-in for TikTok's API: sign-in
// saves guests and starts empires, posting uploads the clip with the player's
// choices, and webhooks are verified before they touch anything.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const calls: { path: string; body: string; headers: Record<string, unknown> }[] = [];
let mock: Server, app: Server, base = '';

beforeAll(async () => {
  mock = createServer((req, res) => {
    const parts: Buffer[] = [];
    req.on('data', (c) => parts.push(c));
    req.on('end', () => {
      const body = Buffer.concat(parts).toString();
      calls.push({ path: req.url ?? '', body: req.url?.startsWith('/upload') ? `<${body.length} bytes>` : body, headers: req.headers });
      res.setHeader('content-type', 'application/json');
      const u = req.url ?? '';
      if (u.startsWith('/v2/oauth/token/')) {
        const code = new URLSearchParams(body).get('code');
        res.end(JSON.stringify({ access_token: `at-${code}`, refresh_token: 'rt', open_id: `open-${code}`, expires_in: 86400, refresh_expires_in: 31536000, scope: 'user.info.basic,video.publish,video.upload' }));
      } else if (u.startsWith('/v2/user/info/')) res.end(JSON.stringify({ data: { user: { display_name: 'Clip Maker', avatar_url: 'https://example.com/a.png' } }, error: { code: 'ok' } }));
      else if (u.startsWith('/v2/post/publish/creator_info/query/')) res.end(JSON.stringify({ data: { creator_nickname: 'Clip Maker', creator_username: 'clipmaker', privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'], comment_disabled: false, duet_disabled: true, stitch_disabled: false, max_video_post_duration_sec: 600 }, error: { code: 'ok' } }));
      else if (u.startsWith('/v2/post/publish/video/init/') || u.startsWith('/v2/post/publish/inbox/video/init/')) res.end(JSON.stringify({ data: { publish_id: `pub-${calls.length}`, upload_url: `${mockBase}/upload/1` }, error: { code: 'ok' } }));
      else if (u.startsWith('/upload/')) { res.statusCode = 201; res.end('{}'); }
      else if (u.startsWith('/v2/post/publish/status/fetch/')) res.end(JSON.stringify({ data: { status: 'PUBLISH_COMPLETE' }, error: { code: 'ok' } }));
      else if (u.startsWith('/v2/oauth/revoke/')) res.end('{}');
      else { res.statusCode = 404; res.end('{}'); }
    });
  });
  await new Promise<void>((ok) => mock.listen(0, ok));
  mockBase = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
  process.env.TIKTOK_API = `${mockBase}/v2`;
  process.env.TIKTOK_AUTHORIZE = `${mockBase}/authorize`;
  process.env.TIKTOK_CLIENT_KEY = 'ck_test';
  process.env.TIKTOK_CLIENT_SECRET = 'cs_test';
  process.env.TIKTOK_NO_TRANSCODE = '1';
  const { Game } = await import('../src/game.ts');
  const { handleTikTok } = await import('../src/tiktok.ts');
  game = new Game({ seed: 11, speed: 1, wilds: false });
  app = createServer((req, res) => { handleTikTok(game, req, res).then((ok) => { if (!ok) { res.statusCode = 404; res.end(); } }); });
  await new Promise<void>((ok) => app.listen(0, ok));
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
});
afterAll(() => { mock.close(); app.close(); game.battles.ai.stop(); });

let mockBase = '';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let game: any;

/** Walk the sign-in: start (from an optional game token) → TikTok → callback with a code. */
async function signIn(code: string, token?: string) {
  const start = await fetch(`${base}/auth/tiktok/start${token ? `?token=${token}&then=share` : ''}`, { redirect: 'manual' });
  const loc = new URL(start.headers.get('location')!);
  expect(loc.origin + loc.pathname).toBe(`${mockBase}/authorize`);
  expect(loc.searchParams.get('scope')).toBe('user.info.basic,video.publish,video.upload');
  const cb = await fetch(`${base}/auth/tiktok/callback?code=${code}&state=${loc.searchParams.get('state')}`);
  return cb.text();
}

describe('tiktok', () => {
  it('starts a new empire for a new TikTok account, and continues it next time', async () => {
    const page = await signIn('new1');
    const p = [...game.players.values()].find((x: { tiktokId?: string }) => x.tiktokId === 'open-new1');
    expect(p?.name).toBe('Clip Maker');
    expect(game.isGuest(p)).toBe(false);
    expect(page).toContain(p.token);
    expect(await signIn('new1')).toContain('Welcome back');
    expect([...game.players.values()].filter((x: { tiktokId?: string }) => x.tiktokId === 'open-new1')).toHaveLength(1);
  });

  it('saves the guest empire that started sign-in, and lands back on the clip', async () => {
    const g = game.join(undefined, 'Guesty');
    expect(game.isGuest(g)).toBe(true);
    const page = await signIn('g1', g.token);
    expect(g.tiktokId).toBe('open-g1');
    expect(game.isGuest(g)).toBe(false);
    expect(page).toContain('/?then=share');
  });

  it('shows the creator, then posts the clip with the player’s choices', async () => {
    const p = [...game.players.values()].find((x: { tiktokId?: string }) => x.tiktokId === 'open-g1');
    const h = { 'x-owc-token': p.token };
    const me = await fetch(`${base}/tiktok/me`, { headers: h }).then((r) => r.json());
    expect(me).toMatchObject({ connected: true, name: 'Clip Maker', username: 'clipmaker', duetOff: true, privacy: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'] });
    const video = new Uint8Array(20_000);
    // No privacy chosen: refused (TikTok requires the player to pick).
    const bad = await fetch(`${base}/tiktok/post?mode=direct`, { method: 'POST', body: video, headers: { ...h, 'content-type': 'video/mp4' } });
    expect(bad.status).toBe(400);
    const meta = encodeURIComponent(JSON.stringify({ title: 'Checkmate!', privacy: 'SELF_ONLY', comment: true }));
    const ok = await fetch(`${base}/tiktok/post?mode=direct`, { method: 'POST', body: video, headers: { ...h, 'content-type': 'video/mp4', 'x-owc-meta': meta } }).then((r) => r.json());
    expect(ok.publishId).toMatch(/^pub-/);
    const init = calls.find((c) => c.path.startsWith('/v2/post/publish/video/init/'))!;
    expect(JSON.parse(init.body)).toMatchObject({ post_info: { title: 'Checkmate!', privacy_level: 'SELF_ONLY', disable_comment: false, disable_duet: true, disable_stitch: true }, source_info: { source: 'FILE_UPLOAD', video_size: 20_000, total_chunk_count: 1 } });
    expect(init.headers.authorization).toBe('Bearer at-g1');
    const up = calls.find((c) => c.path.startsWith('/upload/'))!;
    expect(up.headers['content-range']).toBe('bytes 0-19999/20000');
    const st = await fetch(`${base}/tiktok/status?id=${ok.publishId}`, { headers: h }).then((r) => r.json());
    expect(st.status).toBe('PUBLISH_COMPLETE');
    // Someone else can't read this player's post.
    const other = game.join(undefined, 'Nosy');
    expect((await fetch(`${base}/tiktok/status?id=${ok.publishId}`, { headers: { 'x-owc-token': other.token } })).status).toBe(404);
  });

  it('verifies webhooks, and forgets tokens when the user removes access', async () => {
    const { verifyWebhook } = await import('../src/tiktok.ts');
    const p = [...game.players.values()].find((x: { tiktokId?: string }) => x.tiktokId === 'open-new1');
    expect(p.tiktok).toBeTruthy();
    const body = JSON.stringify({ client_key: 'ck_test', event: 'authorization.removed', create_time: 1, user_openid: 'open-new1', content: '{"reason":1}' });
    const t = Math.floor(Date.now() / 1000);
    const sig = `t=${t},s=${createHmac('sha256', 'cs_test').update(`${t}.${body}`).digest('hex')}`;
    expect(verifyWebhook(sig, body, 'cs_test')).toBe(true);
    expect(verifyWebhook(sig, body + ' ', 'cs_test')).toBe(false);
    expect(verifyWebhook(`t=${t - 3600},s=x`, body, 'cs_test')).toBe(false);
    const forged = await fetch(`${base}/tiktok/webhook`, { method: 'POST', body, headers: { 'tiktok-signature': 't=1,s=00' } });
    expect(forged.status).toBe(200); // answered, but ignored:
    expect(p.tiktok).toBeTruthy();
    const real = await fetch(`${base}/tiktok/webhook`, { method: 'POST', body, headers: { 'tiktok-signature': sig } });
    expect(real.status).toBe(200);
    await new Promise((r) => setTimeout(r, 20));
    expect(p.tiktok).toBeUndefined();
    // Their TikTok-only empire keeps its login.
    expect(p.tiktokId).toBe('open-new1');
  });
});
