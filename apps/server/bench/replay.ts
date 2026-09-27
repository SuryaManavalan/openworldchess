// Replay a saved world headless and report where the time goes (performance.md §3).
//   node apps/server/bench/replay.ts <world.json> [turns=300] [--orders]
// Use a copy of production's world with personal data stripped (see the doc).
// --watch-all treats every chunk as viewed (worst case). --orders makes every bot march a king group somewhere new every 30s, like bots do.
import { perf } from '../src/perf.ts';
import { Game } from '../src/game.ts';
import { load } from '../src/persist.ts';

const [file, turnsArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const orders = process.argv.includes('--orders');
const TURNS = Number(turnsArg ?? 300);
perf.log = false;
const g = new Game({ seed: Number(process.env.SEED ?? 1), speed: 1 });
if (!load(g, file)) { console.error('could not load', file); process.exit(1); }
// Everyone human is "online"; nobody is looking (worst case for the wilds is covered by tests).
for (const p of g.players.values()) if (!p.wild) p.online = true;
// --watch-all: simulate as if people were looking everywhere (the worst case).
if (!process.argv.includes('--watch-all')) { g.wilds.viewed = () => new Set(); g.viewed = () => new Set(); }
let now = Date.now();
const t0 = performance.now();
let lastEco = 0;
for (let i = 0; i < TURNS; i++) {
  now += 600; g.now = now;
  perf.time('battles.tick', () => g.battles.tick(now));
  perf.time('turn', () => g.worldTurn(now));
  if (now - lastEco >= 1000) { lastEco = now; perf.time('economy', () => g.economy(now)); }
  if (orders && i % 50 === 0)
    for (const p of g.players.values()) {
      if (!p.isBot || p.wild) continue;
      const k = g.kingsOf(p.id).find((x) => !x.emperor) ?? g.kingsOf(p.id)[0];
      if (!k) continue;
      const ids = [...g.world.piecesNear(k.x, k.y, 10)].filter((q) => q.owner === p.id && (q.kind !== 'K' || q.id === k.id)).map((q) => q.id);
      const a = Math.random() * Math.PI * 2;
      perf.time('orders', () => g.orderMove(p.id, ids, [Math.round(k.x + Math.cos(a) * 30), Math.round(k.y + Math.sin(a) * 30)]));
    }
}
const wall = performance.now() - t0;
const s = perf.snapshot();
console.log(`${TURNS} turns in ${Math.round(wall)}ms = ${(wall / TURNS).toFixed(1)}ms/turn (budget 600) · pieces ${g.world.pieces.size} · groups ${g.groups.size}`);
for (const [k, v] of Object.entries(s.timings)) console.log(`  ${k.padEnd(20)} ${String(v.totalMs).padStart(7)}ms  avg ${String(v.avgMs).padStart(7)}  max ${String(v.maxMs).padStart(5)}  n ${v.n}`);
g.battles.ai.stop();
process.exit(0);
