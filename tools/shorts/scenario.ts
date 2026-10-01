// Stage a small world for filming, and run it on a local server (never production).
//
//   node tools/shorts/scenario.ts <scenario.json>
//
// scenario.json:
//   {
//     "name": "day02",                 // writes out/<name>/world.json and out/<name>/scenario.env.json
//     "seed": 1,
//     "near": [0, 0],                  // look for open meadow near here
//     "turnMs": 3000,                  // world turn length: slower turns keep footage near real speed,
//                                      // because capture takes ~175 ms a frame (0.6 s turns look 5× fast)
//     "countdownScale": 0.1,           // battle countdowns (a siege's 60 s × this)
//     "needs": { "wheat": 6, "tree": 12 }, // resources within 12 squares of the spot (for building on camera)
//     "players": [
//       { "name": "Aurelian", "color": "#3d6fd1", "at": [0, 0],          // offset from the spot
//         "pieces": { "K": 1, "Q": 1, "R": 2, "P": 6 },                   // around their king
//         "buildings": ["house", "stable"],                               // around their king, built
//         "reserves": { "P": 3 } }                                         // extra pieces a little further out
//     ]
//   }
// Every player's own Emperor and starting pieces are sent far away (so a staged battle is
// a plain siege, not the fall of an empire). Staged players count as old accounts, not
// shielded, so conversions and captures work as they would for real players.
// The server keeps running in the background; scenario.env.json has its port, the
// spot, and each player's token (for acts that play as them).
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Game, type PlayerRec } from '../../apps/server/src/game.ts';
import { save } from '../../apps/server/src/persist.ts';
import type { Building, BuildingType, Piece, PieceKind } from '../../packages/shared/src/index.ts';

const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const dir = resolve('out', spec.name);
mkdirSync(dir, { recursive: true });
const game = new Game({ seed: spec.seed ?? 1, speed: 1, wilds: false });
const w = game.world;

// An open spot: 30×30 squares of buildable ground with little in the way.
const [nx, ny] = spec.near ?? [0, 0];
let spot: [number, number] | null = null;
for (let r = 0; r < 600 && !spot; r += 20)
  for (let a = 0; a < 16 && !spot; a++) {
    const x = Math.round(nx + Math.cos((a / 16) * Math.PI * 2) * r), y = Math.round(ny + Math.sin((a / 16) * Math.PI * 2) * r);
    let ok = 0;
    for (let dy = -15; dy <= 15; dy += 3) for (let dx = -15; dx <= 15; dx += 3) if (w.buildable(x + dx, y + dy) && !w.nodeAt(x + dx, y + dy)) ok++;
    // A town to grow on camera needs crops and trees close by (and so a little less open ground).
    const near = spec.needs ? w.nodesNear(x, y, 1, 12) : [];
    const has = Object.entries(spec.needs ?? {}).every(([k, n]) => near.filter((q) => q.kind === k && q.remaining > 0).length >= (n as number));
    if (ok >= (spec.needs ? 85 : 110) && has) spot = [x, y];
  }
if (!spot) throw new Error('no open ground found');
console.log('staging at', spot);

const tokens: Record<string, string> = {};
let nextB = 50_000_000;
for (const ps of spec.players) {
  const p = game.join(undefined, ps.name) as PlayerRec;
  if ('error' in p) throw new Error(`${ps.name}: ${(p as { error: string }).error}`);
  p.color = ps.color ?? p.color;
  p.createdAt = 0; p.shieldUntil = 0;
  tokens[ps.name] = p.token;
  // The starting kit goes far away: the Emperor stays home, everything else is removed.
  for (const q of game.holdings(p.id).pieces) {
    if (q.emperor) { const far = w.nearestFree(spot[0] + 300 + Object.keys(tokens).length * 40, spot[1] + 300, 30)!; w.movePiece(q, far[0], far[1]); }
    else game.removePiece(q.id);
  }
  const [cx, cy] = [spot[0] + (ps.at?.[0] ?? 0), spot[1] + (ps.at?.[1] ?? 0)];
  const add = (kind: PieceKind, x: number, y: number, r = 4) => {
    const at = w.nearestFree(x, y, r + 6)!;
    const piece: Piece = { id: w.id(), owner: p.id, kind, x: at[0], y: at[1], facing: (ps.facing ?? 2) as Piece['facing'], state: 'idle' };
    game.addPiece(piece);
  };
  // Buildings in a loose ring around the king, then pieces, then reserves further out.
  (ps.buildings ?? []).forEach((type: BuildingType, i: number) => {
    const ang = (i / (ps.buildings.length || 1)) * Math.PI * 2, rr = 5 + (i % 2) * 2;
    const size = type === 'palace' || type === 'stable' || type === 'temple' || type === 'barracks' ? 2 : 1;
    const at = w.nearestFree(Math.round(cx + Math.cos(ang) * rr), Math.round(cy + Math.sin(ang) * rr), 6, (x, y) => w.buildable(x, y) && w.buildable(x + size - 1, y + size - 1) && !w.nodeAt(x, y))!;
    const b: Building = { id: nextB++, owner: p.id, type, x: at[0], y: at[1], size, hp: 100, built: 1, prod: 0 };
    w.addBuilding(b);
  });
  for (const [kind, n] of Object.entries(ps.pieces ?? {}) as [PieceKind, number][]) for (let i = 0; i < n; i++) add(kind, cx + (i % 4) - 1, cy + Math.floor(i / 4) + (kind === 'K' ? 0 : 1), 3);
  for (const [kind, n] of Object.entries(ps.reserves ?? {}) as [PieceKind, number][]) for (let i = 0; i < n; i++) add(kind, cx - 4 + i * 2, cy - 5, 4);
}
game.chronicle.refreshSettlements(Date.now(), true);
const data = resolve(dir, 'world.json');
save(game, data);
game.battles.ai.stop();

// Run it.
const port = 20000 + Math.floor(Math.random() * 20000);
const log = openSync(resolve(dir, 'server.log'), 'w');
const server = spawn(process.execPath, [resolve('apps/server/src/main.ts')], {
  env: { ...process.env, PORT: String(port), DATA: data, TURN_MS: String(spec.turnMs ?? 600), COUNTDOWN_SCALE: String(spec.countdownScale ?? 1), WILDS: '0', SHIELD_MS: '0' },
  stdio: ['ignore', log, log], detached: true,
});
server.unref();
for (let i = 0; i < 120; i++) {
  if (readFileSync(resolve(dir, 'server.log'), 'utf8').includes('server on')) break;
  await new Promise((r) => setTimeout(r, 500));
}
const env = { port, base: `http://localhost:${port}`, pid: server.pid, center: spot, tokens };
writeFileSync(resolve(dir, 'scenario.env.json'), JSON.stringify(env, null, 1));
mkdirSync(dirname(data), { recursive: true });
console.log(`server on :${port} (pid ${server.pid}); env ${resolve(dir, 'scenario.env.json')}`);
process.exit(0);
