// A showcase world of hand-designed cities (Day 5a), one per terrain, built with every city-building
// piece: streets and squares, bridges and piers, walls with towers and gates, hedges, fences,
// flowerbeds, fields and orchards, lamps, statues, fountains, stalls, taverns.
//
//   node tools/shorts/towns.ts           → out/day05a/world.json + scenario.env.json (server running)
//
// env.towns: { name, at: [x, y] } for each city (shots film them by name).
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Game, type PlayerRec } from '../../apps/server/src/game.ts';
import { save } from '../../apps/server/src/persist.ts';
import { biomeAt } from '../../packages/worldgen/src/index.ts';
import { BUILDINGS, PAVED, key, type Building, type BuildingType, type PieceKind } from '../../packages/shared/src/index.ts';

const SEED = 3;
const dir = resolve('out', 'day05a');
mkdirSync(dir, { recursive: true });
const game = new Game({ seed: SEED, speed: 1, wilds: false });
const w = game.world;
let nextB = 60_000_000;

/** A site: open, buildable ground of `r` squares around, in one of `biomes`, meeting `extra`. */
function findSite(biomes: string[], r: number, extra: (x: number, y: number) => boolean, from: [number, number], used: [number, number][], wet = false): [number, number] {
  for (let R = 0; R < 9000; R += 9)
    for (let a = 0; a < Math.max(8, Math.round(R / 6)); a++) {
      const x = Math.round(from[0] + Math.cos((a / Math.max(8, Math.round(R / 6))) * Math.PI * 2) * R);
      const y = Math.round(from[1] + Math.sin((a / Math.max(8, Math.round(R / 6))) * Math.PI * 2) * R);
      if (used.some(([ux, uy]) => Math.max(Math.abs(ux - x), Math.abs(uy - y)) < 160)) continue;
      if (!biomes.includes(biomeAt(SEED, x, y))) continue;
      let ok = 0, n = 0;
      for (let dy = -r; dy <= r; dy += 2) for (let dx = -r; dx <= r; dx += 2) { n++; if (w.buildable(x + dx, y + dy)) ok++; }
      if (ok / n < 0.72) continue;
      if (!extra(x, y)) continue;
      // Dry towns: no water in them (river and lake towns say so in their own test).
      if (!wet) { let dry = true; for (let dy = -r - 4; dy <= r + 4 && dry; dy += 2) for (let dx = -r - 4; dx <= r + 4 && dry; dx += 2) if (w.terrain(x + dx, y + dy) === 'water') dry = false; if (!dry) continue; }
      return [x, y];
    }
  throw new Error('no site for ' + biomes.join('/'));
}

/** One city's tools: everything placed directly (no costs), owned by `p`. */
function city(p: PlayerRec, cx: number, cy: number) {
  const own = p.id;
  const at = (dx: number, dy: number): [number, number] => [cx + dx, cy + dy];
  const clear = (x: number, y: number) => { const n = w.nodeAt(x, y); if (n && !n.gone) { n.gone = true; n.remaining = 0; w.nodeOverlay.set(key(x, y), n); w.dirtyWalk(x, y); } };
  const freeAt = (x: number, y: number, s = 1) => { for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) if (!w.buildable(x + i, y + j) || w.buildingIdAt(x + i, y + j) != null) return false; return true; };
  const put = (type: BuildingType, dx: number, dy: number, extra: Partial<Building> = {}) => {
    const size = BUILDINGS[type].size, [x, y] = at(dx, dy);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) clear(x + i, y + j);
    const water = BUILDINGS[type].onWater;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { const t = w.terrain(x + i, y + j); if (water ? t !== 'water' : !w.buildable(x + i, y + j)) return null; if (w.buildingIdAt(x + i, y + j) != null) return null; }
    const b: Building = { id: nextB++, owner: own, type, x, y, size, hp: 100, built: 1, prod: 0, ...extra };
    if (type === 'palace') { b.palaceMode = 'alt'; b.palaceNext = 'K'; }
    w.addBuilding(b);
    return b;
  };
  const pave = (dx: number, dy: number, style: number) => { const [x, y] = at(dx, dy); if (!w.buildable(x, y)) return; clear(x, y); w.setPaving(x, y, style); const bid = w.buildingIdAt(x, y), b = bid != null ? w.buildings.get(bid) : undefined; if (b && ['wall', 'fence', 'hedge'].includes(b.type)) b.gate = true; };
  const rectPave = (x0: number, y0: number, x1: number, y1: number, style: number) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pave(x, y, style); };
  const linePave = (x0: number, y0: number, x1: number, y1: number, style: number, width = 1) => {
    let x = x0, y = y0;
    const step = () => { for (let k = 0; k < width; k++) pave(x + (y0 === y1 ? 0 : k), y + (y0 === y1 ? k : 0), style); };
    step(); while (x !== x1 || y !== y1) { if (x !== x1) x += Math.sign(x1 - x); else y += Math.sign(y1 - y); step(); }
  };
  const line = (type: BuildingType, x0: number, y0: number, x1: number, y1: number) => {
    let x = x0, y = y0; put(type, x, y);
    while (x !== x1 || y !== y1) { if (x !== x1) x += Math.sign(x1 - x); else y += Math.sign(y1 - y); put(type, x, y); }
  };
  const ring = (type: BuildingType, x0: number, y0: number, x1: number, y1: number) => { line(type, x0, y0, x1, y0); line(type, x1, y0, x1, y1); line(type, x1, y1, x0, y1); line(type, x0, y1, x0, y0); };
  const field = (x0: number, y0: number, x1: number, y1: number, kind: 'wheat' | 'tree' = 'wheat') => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const [X, Y] = at(x, y); if (!freeAt(X, Y)) continue; clear(X, Y); const n = w.addPlanted(X, Y, kind, kind === 'wheat' ? 60 : 100, 0); n.remaining = n.capacity; n.regrowAt = undefined; }
  };
  const piece = (kind: PieceKind, dx: number, dy: number) => { const a = w.nearestFree(cx + dx, cy + dy, 4); if (a) game.addPiece({ id: w.id(), owner: own, kind, x: a[0], y: a[1], facing: 2, state: 'idle' }); };
  const water = (dx: number, dy: number) => w.terrain(cx + dx, cy + dy) === 'water';
  return { put, pave, rectPave, linePave, line, ring, field, piece, water, at, freeAt };
}

/** A player for each city: its own name and colour (banners, roofs' flags). */
function owner(name: string, color: string): PlayerRec {
  const p = game.join(undefined, name) as PlayerRec;
  p.color = color; p.createdAt = 0;
  // Its starting kit is moved off to the city (the king stays to hold it); the Emperor goes far away.
  return p;
}
function seat(p: PlayerRec, cx: number, cy: number) {
  for (const q of game.holdings(p.id).pieces) {
    if (q.emperor) { const far = w.nearestFree(cx + 400, cy + 400, 40) ?? w.nearestFree(cx - 400, cy - 400, 40)!; w.movePiece(q, far[0], far[1]); }
    else if (q.kind === 'K') { const a = w.nearestFree(cx, cy, 6)!; w.movePiece(q, a[0], a[1]); }
    else game.removePiece(q.id);
  }
}

const towns: { name: string; at: [number, number] }[] = [];
const used: [number, number][] = [];
const start: [number, number] = [0, 0];

// ---------- 1. Blossomford: a river town in the blossom groves ----------
{
  const riverEast = (x: number, y: number) => { let a = 6; while (a <= 9 && w.terrain(x + a, y) !== 'water') a++; if (a > 9) return false; let wd = 0; while (wd < 6 && w.terrain(x + a + wd, y) === 'water') wd++; return wd >= 2 && wd <= 5 && w.buildable(x + a + wd, y) && w.buildable(x + a + wd + 4, y); };
  let at: [number, number];
  try { at = findSite(['blossom'], 9, riverEast, start, used, true); } catch { at = findSite(['meadow', 'birch', 'woodland'], 9, riverEast, start, used, true); }
  used.push(at);
  const p = owner('Blossomford', '#d9608c'); seat(p, ...at);
  const c = city(p, ...at);
  let ra = 6; while (!c.water(ra, 0)) ra++; let rw = 0; while (c.water(ra + rw, 0)) rw++;
  // The avenue: three rows wide, cobbles, out over a three-row bridge to the far bank.
  c.linePave(-14, -1, ra - 1, -1, 1, 3);
  for (let dy = -1; dy <= 1; dy++) for (let x = ra; x < ra + rw; x++) c.put('bridge', x, dy);
  c.linePave(ra + rw, -1, ra + rw + 5, -1, 1, 3);
  // The square: flagstones, a fountain, statues and lamps at its corners, stalls along one side.
  c.rectPave(-7, -7, -1, -3, 2);
  c.put('fountain', -4, -5); c.put('statue', -7, -7); c.put('statue', -1, -7);
  for (const [x, y] of [[-8, -3], [0, -3], [-8, -8], [0, -8]]) c.put('lamp', x, y);
  c.put('stall', -6, -3); c.put('stall', -2, -3);
  // Houses along the avenue, a palace on the square, a temple and the tavern by the bridge.
  for (const x of [-13, -10, -7, -4, -1, 2]) { c.put('house', x, 3); if (x < 0) c.put('house', x, -11); }
  c.put('palace', -11, -8); c.put('temple', 2, -7); c.put('tavern', ra - 3, 2);
  for (const x of [-12, -6, 0]) c.put('lamp', x, 2);
  // Riverside gardens: a line of flowerbeds and hedges along the bank, banners at the bridgehead.
  for (let y = -9; y <= -3; y++) { c.put('flowerbed', ra - 1, y); c.put('flowerbed', ra - 2, y); }
  for (let y = 4; y <= 8; y++) c.put('flowerbed', ra - 1, y);
  c.line('hedge', -14, 5, 1, 5);
  c.put('banner', ra - 1, -2); c.put('banner', ra - 1, 2);
  c.field(-14, 7, -2, 9);
  for (const k of ['P', 'P', 'P', 'N', 'B'] as PieceKind[]) c.piece(k, -4, -1);
  towns.push({ name: 'Blossomford', at: [at[0] - 2, at[1]] });
}

// ---------- 2. Sunwall: a walled citadel in the desert ----------
{
  const at = findSite(['desert', 'savanna', 'badlands'], 14, () => true, start, used); used.push(at);
  const p = owner('Sunwall', '#e0a03a'); seat(p, ...at);
  const c = city(p, ...at);
  // The wall: a square ring with towers at the corners, gates where the cross streets run through.
  c.ring('wall', -12, -12, 12, 12);
  c.linePave(-14, 0, 14, 0, 3, 2); c.linePave(0, -14, 0, 14, 3, 2);
  // The heart: a flagstone plaza, a well at its centre ringed with planters, statues at its corners.
  c.rectPave(-4, -4, 5, 5, 2);
  c.put('well', 0, 0); for (const [x, y] of [[-2, -2], [3, -2], [-2, 3], [3, 3]]) c.put('planter', x, y);
  for (const [x, y] of [[-4, -4], [5, -4], [-4, 5], [5, 5]]) c.put('statue', x, y);
  // Quarters: houses in rows, a temple and barracks, a palace, stalls along the streets.
  for (const [x, y] of [[-10, -9], [-7, -9], [-10, -6], [-7, -6], [8, 8], [8, 5], [5, 9], [-10, 6], [-7, 9], [-10, 9]]) c.put('house', x, y);
  c.put('palace', 6, -10); c.put('temple', -10, 2); c.put('barracks', 7, 2);
  for (const [x, y] of [[-6, -2], [-9, -2], [7, -2], [10, -2], [-2, -8], [2, 8]]) c.put('stall', x, y);
  for (const [x, y] of [[-12, -2], [-12, 3], [12, -2], [12, 3], [-2, -12], [3, -12], [-2, 12], [3, 12]]) c.put('banner', x, y);
  for (const [x, y] of [[-6, 1], [6, 1], [1, -6], [1, 7]]) c.put('lamp', x, y);
  for (const k of ['P', 'P', 'P', 'R', 'N', 'N'] as PieceKind[]) c.piece(k, 2, 1);
  towns.push({ name: 'Sunwall', at });
}

// ---------- 3. Pinehold: a ring village in the pine forest ----------
{
  const at = findSite(['taiga', 'birch', 'woodland'], 11, () => true, start, used); used.push(at);
  const p = owner('Pinehold', '#4a7fd4'); seat(p, ...at);
  const c = city(p, ...at);
  // A green at the centre, ringed by an earth road; flowerbeds and planters on the green, a statue.
  // (A band, not a thin circle: squares that only touch diagonally don't join.)
  for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) { const d = Math.hypot(x, y); if (d >= 5.4 && d <= 6.6) c.pave(x, y, 3); }
  c.put('statue', 0, 0);
  for (const [x, y] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) c.put('flowerbed', x, y);
  for (const [x, y] of [[0, -3], [0, 3], [-3, 0], [3, 0]]) c.put('planter', x, y);
  // Houses around the ring, facing in; a tavern and a stable; lamps on the road.
  for (let a = 0; a < 10; a++) { const x = Math.round(Math.cos((a / 10) * Math.PI * 2) * 9), y = Math.round(Math.sin((a / 10) * Math.PI * 2) * 9); c.put(a === 3 ? 'tavern' : a === 7 ? 'stable' : 'house', x, y); }
  for (let a = 0; a < 6; a++) c.put('lamp', Math.round(Math.cos((a / 6) * Math.PI * 2 + 0.4) * 7), Math.round(Math.sin((a / 6) * Math.PI * 2 + 0.4) * 7));
  // Fenced fields to the south, an orchard of saplings to the east, hedges between.
  c.ring('fence', -9, 12, -1, 16); c.field(-8, 13, -2, 15);
  c.ring('fence', 1, 12, 9, 16); c.field(2, 13, 8, 15);
  c.linePave(0, 7, 0, 17, 3);
  c.field(12, -5, 15, 4, 'tree');
  c.line('hedge', 11, -7, 11, 6);
  for (const k of ['P', 'P', 'P', 'P', 'N'] as PieceKind[]) c.piece(k, 0, 5);
  towns.push({ name: 'Pinehold', at: [at[0], at[1] + 3] });
}

// ---------- 4. Stillwater: a lakeshore harbour with piers ----------
{
  const lakeSouth = (x: number, y: number) => { for (let d = 5; d <= 8; d++) if (w.terrain(x, y + d) === 'water' && w.terrain(x - 6, y + d + 2) === 'water' && w.terrain(x + 6, y + d + 2) === 'water' && w.terrain(x, y + d + 7) === 'water') return true; return false; };
  const at = findSite(['meadow', 'woodland', 'birch', 'autumn', 'savanna', 'tundra'], 6, lakeSouth, start, used, true); used.push(at);
  const p = owner('Stillwater', '#2fa59a'); seat(p, ...at);
  const c = city(p, ...at);
  let shore = 1; while (!c.water(0, shore)) shore++;
  // A cobble promenade along the shore, lamps every few squares, benches facing the water.
  c.linePave(-12, shore - 1, 12, shore - 1, 1);
  for (let x = -12; x <= 12; x += 4) { c.put('lamp', x, shore - 2); }
  for (const x of [-10, -2, 6]) c.put('bench', x, shore - 2);
  // Three piers out into the lake, a long middle one with lamps at its end.
  for (const [px, len] of [[-8, 5], [0, 9], [8, 5]] as const) { let s = shore - 2; while (!c.water(px, s) && s < shore + 6) s++; for (let d = 0; d < len; d++) c.put('bridge', px, s + d); for (let y = shore - 1; y < s; y++) c.pave(px, y, 1); }
  // The harbour town behind: houses, a tavern, stalls (the fish market), flowerbeds along the lanes.
  for (const [x, y] of [[-11, shore - 6], [-8, shore - 6], [-5, shore - 6], [4, shore - 6], [7, shore - 6], [10, shore - 6], [-9, shore - 9], [8, shore - 9]]) c.put('house', x, y);
  c.put('tavern', -1, shore - 7); c.put('temple', -2, shore - 11);
  for (const x of [-6, -4, 3, 5]) c.put('stall', x, shore - 3);
  c.linePave(0, shore - 1, 0, shore - 12, 2);
  for (let y = shore - 10; y <= shore - 4; y += 2) { c.put('flowerbed', -1 - (y % 4 === 0 ? 1 : 0), y); }
  c.put('fountain', 2, shore - 4);
  for (const k of ['P', 'P', 'P', 'P'] as PieceKind[]) c.piece(k, 0, shore - 3);
  towns.push({ name: 'Stillwater', at: [at[0], at[1] + shore - 2] });
}

// ---------- 5. Emberfort: a fortress in a rare land ----------
{
  let at: [number, number];
  try { at = findSite(['volcanic', 'crystal', 'fey', 'mushroom'], 10, () => true, start, used); } catch { at = findSite(['highland', 'tundra', 'badlands'], 10, () => true, start, used); }
  used.push(at);
  const p = owner('Emberfort', '#c8423a'); seat(p, ...at);
  const c = city(p, ...at);
  // A keep: an inner ring of wall around a palace and a cobble yard, an outer star of walls.
  c.ring('wall', -5, -5, 5, 5);
  c.rectPave(-4, -4, 4, 4, 1);
  c.put('palace', -1, -3);
  for (const [x, y] of [[-3, 2], [3, 2]]) c.put('statue', x, y);
  c.put('fountain', 0, 2);
  c.linePave(0, 5, 0, 14, 1, 2);
  c.line('wall', -12, -9, -12, 9); c.line('wall', 12, -9, 12, 9); c.line('wall', -9, -12, 9, -12); c.line('wall', -9, 12, 9, 12);
  c.pave(0, 12, 1); c.pave(1, 12, 1);
  for (const [x, y] of [[-9, -8], [8, -8], [-9, 7], [8, 7]]) c.put('barracks', x, y);
  for (const [x, y] of [[-8, -2], [-8, 2], [9, -2], [9, 2], [-2, -9], [2, -9]]) c.put('house', x, y);
  for (const [x, y] of [[-12, -10], [12, -10], [-12, 10], [12, 10], [-1, 13], [2, 13]]) c.put('banner', x, y);
  for (const [x, y] of [[-6, 6], [6, 6], [-6, -6], [6, -6]]) c.put('lamp', x, y);
  for (const k of ['R', 'R', 'N', 'B', 'P', 'P'] as PieceKind[]) c.piece(k, 0, 8);
  towns.push({ name: 'Emberfort', at });
}

game.chronicle.refreshSettlements(Date.now(), true);
const data = resolve(dir, 'world.json');
save(game, data);
game.battles.ai.stop();
console.log(JSON.stringify(towns.map((t) => [t.name, t.at, biomeAt(SEED, t.at[0], t.at[1])])));
const port = 20000 + Math.floor(Math.random() * 20000);
const log = openSync(resolve(dir, 'server.log'), 'w');
const server = spawn(process.execPath, [resolve('apps/server/src/main.ts')], { env: { ...process.env, PORT: String(port), DATA: data, SEED: String(SEED), WILDS: '0', SHIELD_MS: '0' }, stdio: ['ignore', log, log], detached: true });
server.unref();
for (let i = 0; i < 120; i++) { if (readFileSync(resolve(dir, 'server.log'), 'utf8').includes('server on')) break; await new Promise((r) => setTimeout(r, 500)); }
writeFileSync(resolve(dir, 'scenario.env.json'), JSON.stringify({ port, base: `http://localhost:${port}`, pid: server.pid, center: towns[0].at, towns, tokens: {} }, null, 1));
console.log(`server on :${port} (pid ${server.pid})`);
process.exit(0);
