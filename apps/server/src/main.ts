// Server entry: the loop (TECH.md T7), persistence and networking.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { TICK_HZ, TURN_MS } from '@owc/shared';
import { Game } from './game.ts';
import { Net } from './net.ts';
import { load, save } from './persist.ts';
import { handleAuth } from './auth.ts';
import { perf } from './perf.ts';
import { handleShop } from './shop.ts';
import { handleTikTok } from './tiktok.ts';
import { handleStats, stats } from './stats.ts';

const PORT = Number(process.env.PORT ?? 8787);
const SEED = Number(process.env.SEED ?? 1);
const SPEED = Number(process.env.SPEED ?? 1);
/** Test/dev overrides: faster world turns and countdowns. */
const TURN = Number(process.env.TURN_MS ?? TURN_MS);
const COUNTDOWN_SCALE = Number(process.env.COUNTDOWN_SCALE ?? 1);
const DATA = process.env.DATA ?? new URL('../../../data/world.json', import.meta.url).pathname;
const STATIC = process.env.STATIC ?? new URL('../../client/dist/', import.meta.url).pathname;

// WILDS=0 turns the wilds off (the end-to-end test checks the core loop without raids).
const game = new Game({ seed: SEED, speed: SPEED, wilds: process.env.WILDS !== '0' });
/** Full holdings resync (turn deltas already carry your own pieces); saving is a big synchronous write. */
const MINE_EVERY_MS = 30_000;
const SAVE_EVERY_MS = 60_000;
game.battles.countdownScale = COUNTDOWN_SCALE;
if (process.env.SHIELD_MS) game.shieldMs = Number(process.env.SHIELD_MS);
if (process.env.GUEST_GRACE_MS) game.guestGraceMs = Number(process.env.GUEST_GRACE_MS);
if (load(game, DATA)) console.log(`loaded ${game.world.pieces.size} pieces, ${game.players.size} players from ${DATA}`);
stats.load(join(dirname(DATA), 'stats.json'), game);

// Serve the built client too, so one process can run the whole game.
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
/** When set, only requests carrying this header (added by CloudFront) or from localhost are served. */
const ORIGIN_SECRET = process.env.ORIGIN_SECRET ?? '';
export const originOk = (req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }) =>
  !ORIGIN_SECRET || req.headers['x-origin-verify'] === ORIGIN_SECRET || /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress ?? '');

const server = createServer((req, res) => {
  if (!originOk(req)) { res.statusCode = 403; res.end('forbidden'); return; }
  if (req.url === '/health') { res.end(JSON.stringify({ ok: true, players: game.players.size, turn: game.turn })); return; }
  // Observability (performance.md §2): only from the machine itself.
  if (req.url?.startsWith('/metrics')) {
    if (!/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress ?? '') || req.headers['x-origin-verify']) { res.statusCode = 404; res.end('not found'); return; }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ last: perf.last, live: perf.snapshot() }, null, 1));
    return;
  }
  if (req.url?.startsWith('/shop/') || req.url?.startsWith('/stripe/')) { handleShop(game, req, res).then((ok) => { if (!ok) { res.statusCode = 404; res.end(); } }).catch(() => { res.statusCode = 500; res.end('shop error'); }); return; }
  if (req.url?.startsWith('/api/')) { handleStats(game, req, res, () => net.liveCounts()).then((ok) => { if (!ok) { res.statusCode = 404; res.end(); } }).catch(() => { if (!res.headersSent) { res.statusCode = 500; res.end(); } }); return; }
  if (req.url?.startsWith('/tiktok/') || req.url?.startsWith('/auth/tiktok/')) { handleTikTok(game, req, res).then((ok) => { if (!ok) { res.statusCode = 404; res.end(); } }).catch(() => { if (!res.headersSent) { res.statusCode = 500; res.end('tiktok error'); } }); return; }
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
let lastEconomy = 0, lastMine = 0, lastSave = Date.now(), lastFall = 0, lastMaintain = Date.now(), lastFade = Date.now(), lastRoll = Date.now(), lastSelf = 0;
perf.gauge('pieces', () => game.world.pieces.size);
perf.gauge('buildings', () => game.world.buildings.size);
perf.gauge('groups', () => game.groups.size);
perf.gauge('players', () => game.players.size);
perf.gauge('campsAwake', () => game.wilds.awake().length);
perf.gauge('sessions', () => net.sessions.size);
perf.gauge('battles', () => game.battles.recs.size);
perf.gauge('turn', () => game.turn);
net.nextTurnAt = nextTurnAt;

// The world turn runs on its own timer, aimed at the exact moment it's due: the
// beat everything moves to (and the music plays on) shouldn't wobble by the
// housekeeping loop's tick (performance.md §1).
const runTurn = () => {
  const now = Date.now();
  game.now = now;
  // How late the turn runs is the number players feel.
  perf.add('turn.late', now - nextTurnAt);
  nextTurnAt += TURN;
  if (nextTurnAt < now) { perf.count('turn.skipped'); nextTurnAt = now + TURN; } // fell behind: don't spiral
  net.nextTurnAt = nextTurnAt;
  perf.time('turn', () => game.worldTurn(now));
  perf.time('net.flushTurn', () => net.flushTurn(game.turnMoves));
  setTimeout(runTurn, Math.max(0, nextTurnAt - Date.now()));
};
setTimeout(runTurn, Math.max(0, nextTurnAt - Date.now()));

setInterval(() => {
  const now = Date.now();
  game.now = now;
  perf.time('battles.tick', () => game.battles.tick(now));
  if (now - lastEconomy >= 1000) { lastEconomy = now; perf.time('economy', () => game.economy(now)); }
  if (now - lastMine >= MINE_EVERY_MS) { lastMine = now; perf.time('net.sendAllMine', () => net.sendAllMine()); }
  if (now - lastSelf >= 2500) { lastSelf = now; perf.time('net.sendAllSelf', () => net.sendAllSelf()); }
  if (now - lastFall >= Math.min(30_000, game.guestGraceMs / 2)) { lastFall = now; game.fallOfGuests(now); }
  if (now - lastRoll >= 60_000) { lastRoll = now; perf.roll(now); stats.sample(net.liveCounts().humans); }
  if (now - lastMaintain >= 60_000) {
    lastMaintain = now;
    const fade = now - lastFade >= 3_600_000;
    if (fade) lastFade = now;
    perf.time('maintain', () => game.world.maintain(net.watchedChunks(), fade));
  }
  if (now - lastSave >= SAVE_EVERY_MS) { lastSave = now; perf.time('save', () => { save(game, DATA); stats.save(); }); }
}, Math.min(1000 / TICK_HZ, TURN / 2));

const shutdown = () => { save(game, DATA); stats.save(); game.battles.ai.stop(); console.log('saved'); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => console.log(`openworldchess server on :${PORT} (seed ${SEED}, speed ×${SPEED})`));
