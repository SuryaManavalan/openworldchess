// Load test (performance.md): N simulated human players against a server.
// Each one views the area around home, pans around like someone browsing,
// orders a few pieces around, and now and then starts a practice battle and
// plays it (random legal moves), which exercises the chess engine.
//
//   node apps/server/bench/load.mjs ws://localhost:8898/play 100
import WebSocket from 'ws';
import { Chess } from 'chess.js';
import { Connection } from '@owc/client-core';

const url = process.argv[2] ?? 'ws://localhost:8898/play';
const N = Number(process.argv[3] ?? 100);
const RAMP_MS = Number(process.env.RAMP_MS ?? 60_000);
const rnd = (a, b) => a + Math.random() * (b - a);
let orders = 0, battles = 0, moves = 0, errors = 0;

function player(i) {
  const conn = new Connection({ url, WebSocket, name: `Load${i}${Math.floor(Math.random() * 999)}`, onHelloError: (m) => { errors++; console.log('hello error', m); } });
  const m = conn.mirror;
  let home = null;
  const view = () => { if (!home) return; conn.watchArea(Math.round(home[0] + rnd(-45, 45)), Math.round(home[1] + rnd(-45, 45)), 22); };
  const tick = setInterval(() => {
    if (conn.status !== 'open') return;
    home ??= m.self?.home ?? null;
    if (!home) return;
    const r = Math.random();
    if (r < 0.35) view();
    else if (r < 0.6) {
      const mine = m.myPieces().filter((p) => p.state === 'idle').slice(0, 6);
      if (mine.length) { conn.send({ t: 'order.move', pieceIds: mine.map((p) => p.id), to: [Math.round(mine[0].x + rnd(-8, 8)), Math.round(mine[0].y + rnd(-8, 8))] }); orders++; }
    } else if (r < 0.62) { conn.send({ t: 'practice' }); battles++; }
    // Play any practice battle we're in: a random legal move when it's our turn.
    for (const b of m.battles.values()) {
      if (b.kind !== 'practice' || b.white.playerId !== m.me || b.phase !== 'live' || !b.fen.includes(' w ')) continue;
      try { const g = new Chess(b.fen); const ms = g.moves({ verbose: true }); if (ms.length) { const mv = ms[Math.floor(Math.random() * ms.length)]; conn.send({ t: 'battle.move', battleId: b.id, uci: mv.from + mv.to + (mv.promotion ?? '') }); moves++; } } catch { /* odd fen */ }
    }
  }, rnd(4000, 9000));
  setTimeout(view, 3000);
  return () => { clearInterval(tick); conn.close?.(); };
}

const stops = [];
for (let i = 0; i < N; i++) setTimeout(() => stops.push(player(i)), (i / N) * RAMP_MS);
setInterval(() => console.log(`players ${stops.length} orders ${orders} practice ${battles} moves ${moves} errors ${errors}`), 30_000);
process.on('SIGINT', () => { for (const s of stops) s(); process.exit(0); });
