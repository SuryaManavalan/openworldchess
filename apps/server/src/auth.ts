// Google sign-in (TECH.md T14): OAuth 2.0 authorization code flow, server side.
// Signing in links the current guest empire to a Google account so it never
// falls for being offline, and lets the player continue on other devices.
//
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, PUBLIC_URL (e.g. https://openworldchess.com)
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import type { Game } from './game.ts';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const PUBLIC_URL = (process.env.PUBLIC_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const REDIRECT = `${PUBLIC_URL}/auth/google/callback`;

/** state nonce → the guest token that started sign-in (if any). */
const pending = new Map<string, { token: string | null; at: number }>();

export const googleEnabled = () => !!(CLIENT_ID && CLIENT_SECRET);

function html(res: ServerResponse, body: string, status = 200) {
  res.statusCode = status;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(`<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#23211f;color:#ece6da;font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0">${body}</body>`);
}

/** Hand the account token to the page, then go back into the game. */
function finish(res: ServerResponse, token: string, note: string) {
  html(res, `<p>${note}</p><script>try{localStorage.setItem('owc.token',${JSON.stringify(token)});localStorage.setItem('owc.welcomed','1');localStorage.setItem('owc.signedin','1')}catch(e){}location.replace('/')</script>`);
}

export async function handleAuth(game: Game, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', PUBLIC_URL);
  if (url.pathname === '/auth/config') {
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({ google: googleEnabled() }));
    return true;
  }
  if (url.pathname === '/auth/google/start') {
    if (!googleEnabled()) { html(res, 'Google sign-in is not configured yet.', 503); return true; }
    const state = randomBytes(16).toString('hex');
    for (const [k, v] of pending) if (Date.now() - v.at > 10 * 60_000) pending.delete(k);
    pending.set(state, { token: url.searchParams.get('token'), at: Date.now() });
    const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
    res.statusCode = 302;
    res.setHeader('location', `https://accounts.google.com/o/oauth2/v2/auth?${q}`);
    res.end();
    return true;
  }
  if (url.pathname === '/auth/google/callback') {
    const state = url.searchParams.get('state') ?? '', code = url.searchParams.get('code') ?? '';
    const p = pending.get(state);
    pending.delete(state);
    if (!p || !code) { html(res, 'Sign-in expired. <a style="color:#95b957" href="/">Back to the game</a>', 400); return true; }
    // Exchange the code. The ID token comes straight from Google over TLS, so its
    // claims can be read without verifying the signature (Google's documented guidance).
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
    }).then((r) => r.json() as Promise<{ id_token?: string }>).catch(() => ({ id_token: undefined }));
    if (!tr.id_token) { html(res, 'Google sign-in failed. <a style="color:#95b957" href="/">Back to the game</a>', 502); return true; }
    const claims = JSON.parse(Buffer.from(tr.id_token.split('.')[1], 'base64url').toString()) as { sub: string; email?: string; given_name?: string; aud: string };
    if (claims.aud !== CLIENT_ID) { html(res, 'Sign-in was for a different app.', 400); return true; }
    // 1. This Google account already has an empire: continue it on this device.
    const owned = [...game.players.values()].find((pl) => pl.googleSub === claims.sub);
    if (owned) { finish(res, owned.token, `Welcome back, ${owned.name}.`); return true; }
    // 2. Link the guest empire that started the sign-in.
    const guestId = p.token ? game.tokens.get(p.token) : undefined;
    const guest = guestId ? game.players.get(guestId) : undefined;
    if (guest && !guest.googleSub && !guest.isBot) {
      guest.googleSub = claims.sub; guest.email = claims.email; guest.leftAt = undefined;
      game.onPlayers();
      finish(res, guest.token, `Your empire is safe, ${guest.name}.`);
      return true;
    }
    // 3. Otherwise start a new empire for this account.
    let name = (claims.given_name ?? claims.email?.split('@')[0] ?? 'Ruler').replace(/[^\p{L}\p{N}_ .-]/gu, '').slice(0, 16) || 'Ruler';
    while (game.checkName(name)) name = name.slice(0, 16) + Math.floor(Math.random() * 999);
    const pl = game.create(name, false, claims.sub, claims.email);
    finish(res, pl.token, `Welcome, ${pl.name}.`);
    return true;
  }
  return false;
}
