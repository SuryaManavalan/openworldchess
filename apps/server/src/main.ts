// Server entry: the loop (TECH.md T7), persistence and networking.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { TICK_HZ, TURN_MS } from '@owc/shared';
import { Game } from './game.ts';
import { Net } from './net.ts';
import { load, save } from './persist.ts';
import { handleAuth } from './auth.ts';

const PORT = Number(process.env.PORT ?? 8787);
const SEED = Number(process.env.SEED ?? 1);
const SPEED = Number(process.env.SPEED ?? 1);
/** Test/dev overrides: faster world turns and countdowns. */
const TURN = Number(process.env.TURN_MS ?? TURN_MS);
const COUNTDOWN_SCALE = Number(process.env.COUNTDOWN_SCALE ?? 1);
const DATA = process.env.DATA ?? new URL('../../../data/world.json', import.meta.url).pathname;
const STATIC = process.env.STATIC ?? new URL('../../client/dist/', import.meta.url).pathname;

const game = new Game({ seed: SEED, speed: SPEED });
game.battles.countdownScale = COUNTDOWN_SCALE;
if (process.env.SHIELD_MS) game.shieldMs = Number(process.env.SHIELD_MS);
if (process.env.GUEST_GRACE_MS) game.guestGraceMs = Number(process.env.GUEST_GRACE_MS);
if (load(game, DATA)) console.log(`loaded ${game.world.pieces.size} pieces, ${game.players.size} players from ${DATA}`);

// Serve the built client too, so one process can run the whole game.
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
/** When set, only requests carrying this header (added by CloudFront) or from localhost are served. */
const ORIGIN_SECRET = process.env.ORIGIN_SECRET ?? '';
export const originOk = (req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }) =>
  !ORIGIN_SECRET || req.headers['x-origin-verify'] === ORIGIN_SECRET || /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress ?? '');

const server = createServer((req, res) => {
  if (!originOk(req)) { res.statusCode = 403; res.end('forbidden'); return; }
  if (req.url === '/health') { res.end(JSON.stringify({ ok: true, players: game.players.size, turn: game.turn })); return; }
  if (req.url?.startsWith('/auth/')) { handleAuth(game, req, res).catch(() => { res.statusCode = 500; res.end('auth error'); }); return; }
  let path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  if (path === '/' || !extname(path)) path = '/index.html';
  const file = join(STATIC, path);
  if (!file.startsWith(STATIC) || !existsSync(file) || !statSync(file).isFile()) { res.statusCode = 404; res.end('not found'); return; }
  res.setHeader('content-type', MIME[extname(file)] ?? 'application/octet-stream');
  res.setHeader('cache-control', path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.end(readFileSync(file));
});
const net = new Net(game, server, TURN, originOk);

let nextTurnAt = Date.now() + TURN;
let lastEconomy = 0, lastMine = 0, lastSave = Date.now(), lastFall = 0;
net.nextTurnAt = nextTurnAt;

setInterval(() => {
  const now = Date.now();
  game.now = now;
  game.battles.tick(now);
  if (now >= nextTurnAt) {
    nextTurnAt += TURN;
    if (nextTurnAt < now) nextTurnAt = now + TURN; // fell behind: don't spiral
    net.nextTurnAt = nextTurnAt;
    game.worldTurn(now);
    net.flushTurn(game.turnMoves);
  }
  if (now - lastEconomy >= 1000) { lastEconomy = now; game.economy(now); }
  if (now - lastMine >= 2500) { lastMine = now; net.sendAllMine(); }
  if (now - lastFall >= Math.min(30_000, game.guestGraceMs / 2)) { lastFall = now; game.fallOfGuests(now); }
  if (now - lastSave >= 15_000) { lastSave = now; save(game, DATA); }
}, Math.min(1000 / TICK_HZ, TURN / 2));

const shutdown = () => { save(game, DATA); game.battles.ai.stop(); console.log('saved'); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => console.log(`openworldchess server on :${PORT} (seed ${SEED}, speed ×${SPEED})`));
