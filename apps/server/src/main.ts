// Server entry: the loop (TECH.md T7), persistence and networking.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CHUNK, TICK_HZ, TURN_MS } from '@owc/shared';
import { Game } from './game.ts';
import { Net } from './net.ts';
import { load, save } from './persist.ts';
import { handleAuth } from './auth.ts';
import { perf } from './perf.ts';
import { handleShop } from './shop.ts';
import { handleTikTok } from './tiktok.ts';
import { handleStats, stats } from './stats.ts';
import { serveWeb, warm } from './web.ts';
import { handleStudio, loadStudio } from './studio.ts';

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
if (process.env.THINK_SCALE) game.battles.thinkScale = Number(process.env.THINK_SCALE);
if (process.env.SHIELD_MS) game.shieldMs = Number(process.env.SHIELD_MS);
if (process.env.GUEST_GRACE_MS) game.guestGraceMs = Number(process.env.GUEST_GRACE_MS);
if (load(game, DATA)) console.log(`loaded ${game.world.pieces.size} pieces, ${game.players.size} players from ${DATA}`);
stats.load(join(dirname(DATA), 'stats.json'), game);
game.herald.load(join(dirname(DATA), 'herald.json'));
loadStudio(join(dirname(DATA), 'studio.json'));
// Shape the land from the empires already living on it (elo.md §3), settled before anyone connects.
for (let i = 0; i < 8; i++) game.reshapeLand();
// Once: cities' old automatic chessboards are now Arenas their rulers place (citybuilding.md §10).
if (!game.migrated.has('arenas')) { game.now = Date.now(); console.log(`arenas: told ${game.announceArenas()} city rulers`); game.migrated.add('arenas'); }

// Serve the built client and the site too (web.ts), so one process runs the whole game.
warm(STATIC);
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
  if (req.url?.startsWith('/api/find?')) {
    // Search rulers and cities (public names), a few requests a second per address at most.
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0];
    const t = Date.now(), last = findAt.get(ip) ?? 0;
    if (t - last < 250) { res.statusCode = 429; res.end(); return; }
    findAt.set(ip, t); if (findAt.size > 5000) findAt.clear();
    const q = new URL(req.url, 'http://x').searchParams.get('q') ?? '';
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(game.directory.find(q)));
    return;
  }
  if (req.url === '/api/showcase') { res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'max-age=300'); res.end(JSON.stringify(game.herald.showcase())); return; }
  if (req.url?.startsWith('/api/')) { handleStats(game, req, res, () => net.liveCounts()).then((ok) => { if (!ok) { res.statusCode = 404; res.end(); } }).catch(() => { if (!res.headersSent) { res.statusCode = 500; res.end(); } }); return; }
  if (req.url?.startsWith('/studio/')) { handleStudio(game, req, res).catch(() => { if (!res.headersSent) { res.statusCode = 500; res.end('studio error'); } }); return; }
  if (req.url?.startsWith('/tiktok/') || req.url?.startsWith('/auth/tiktok/')) { handleTikTok(game, req, res).then((ok) => { if (!ok) { res.statusCode = 404; res.end(); } }).catch(() => { if (!res.headersSent) { res.statusCode = 500; res.end('tiktok error'); } }); return; }
  if (req.url?.startsWith('/auth/')) { handleAuth(game, req, res).catch(() => { res.statusCode = 500; res.end('auth error'); }); return; }
  if (!serveWeb(req, res, STATIC, game)) { res.statusCode = 405; res.end(); }
});
const findAt = new Map<string, number>();
const net = new Net(game, server, TURN, originOk);
// Tabs opened before a deploy notice the new build on reconnect and reload (quest data, rules text).
try { net.build = createHash('sha1').update(readFileSync(join(STATIC, 'index.html'))).digest('hex').slice(0, 12); } catch { /* no client build (dev) */ }

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

setInterval(() => {
  const now = Date.now();
  game.now = now;
  perf.time('battles.tick', () => game.battles.tick(now));
  if (now - lastEconomy >= 1000) { lastEconomy = now; perf.time('economy', () => game.economy(now)); }
  if (now - lastMine >= MINE_EVERY_MS) { lastMine = now; perf.time('net.sendAllMine', () => net.sendAllMine()); }
  if (now - lastSelf >= 2500) { lastSelf = now; perf.time('net.sendAllSelf', () => net.sendAllSelf()); net.sendAllLand(); }
  if (now - lastFall >= Math.min(30_000, game.guestGraceMs / 2)) { lastFall = now; game.fallOfGuests(now); }
  if (now - lastRoll >= 60_000) { lastRoll = now; perf.roll(now); const humans = net.liveCounts().humans; stats.sample(humans); perf.time('herald', () => game.herald.tick(now, humans)); }
  if (now - lastMaintain >= 60_000) {
    lastMaintain = now;
    const fade = now - lastFade >= 3_600_000;
    if (fade) lastFade = now;
    perf.time('maintain', () => game.world.maintain(net.watchedChunks(), fade));
  }
  if (now - lastSave >= SAVE_EVERY_MS) { lastSave = now; perf.time('save', () => { save(game, DATA); stats.save(); game.herald.save(); }); }
}, Math.min(1000 / TICK_HZ, TURN / 2));

const shutdown = () => { save(game, DATA); stats.save(); game.herald.save(); game.battles.ai.stop(); console.log('saved'); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Warm up before opening the doors (performance.md): build the terrain, resources and
// walkability of every area with pieces or buildings, and run the first economy and wilds
// ticks, so the first seconds after a restart don't hitch with one-off world generation.
{
  const t0 = Date.now(), seen = new Set<string>();
  const warm = (x: number, y: number) => {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const k = `${cx},${cy}`;
    if (seen.has(k)) return;
    seen.add(k);
    game.world.walkable(cx * CHUNK, cy * CHUNK);
  };
  for (const p of game.world.pieces.values()) warm(p.x, p.y);
  for (const b of game.world.buildings.values()) warm(b.x, b.y);
  game.economy(Date.now());
  game.wilds.tick(Date.now());
  // Every player's own view once (quest markers, camps nearby): the first one after a start fills shared caches.
  for (const p of game.players.values()) if (!p.wild) game.selfPlayer(p);
  console.log(`warmed ${seen.size} chunks in ${Date.now() - t0}ms`);
  // The turn clock starts now, not before the warm-up (or the first turn counts as seconds late).
  nextTurnAt = Date.now() + TURN;
  setTimeout(runTurn, TURN);
}
server.listen(PORT, () => console.log(`openworldchess server on :${PORT} (seed ${SEED}, speed ×${SPEED})`));
