// City building (docs/specs/citybuilding.md): decorations, bridges, streets and gates,
// moving and demolishing, planting, and keeping decorations out of the economy.
import { afterAll, describe, expect, it } from 'vitest';
import { BUILDINGS, DECOR_BASE, PAVED, PLANT_TREE_MS, REACH, cheb, type Building } from '@owc/shared';
import { Game, type PlayerRec } from '../src/game.ts';

let rs = 5151;
Math.random = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; };
const game = new Game({ seed: 4, speed: 1, wilds: false });
afterAll(() => game.battles.ai.stop());
let t = 1_800_000_000_000;
const turn = (n = 1) => { for (let i = 0; i < n; i++) { t += 600; game.now = t; game.worldTurn(t); } };
const tick = (ms: number) => { t += ms; game.now = t; game.economy(t); };
const w = game.world;
let nextB = 8_100_000;
const house = (owner: string, x: number, y: number): Building => {
  const at = w.nearestFree(x, y, 6, (fx, fy) => w.buildable(fx, fy) && !w.nodeAt(fx, fy) && w.buildingIdAt(fx, fy) == null)!;
  const b: Building = { id: nextB++, owner, type: 'house', x: at[0], y: at[1], size: 1, hp: 100, built: 1, prod: 0 };
  w.addBuilding(b);
  return b;
};
/** Some empty land squares near (x, y) in a row. */
const emptyRow = (x: number, y: number, n: number): [number, number][] => {
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const row: [number, number][] = [];
    for (let i = 0; i < n; i++) { const sx = x + dx + i, sy = y + dy; if (w.buildable(sx, sy) && !w.nodeAt(sx, sy) && w.buildingIdAt(sx, sy) == null && w.pieceIdAt(sx, sy) == null) row.push([sx, sy]); }
    if (row.length === n) return row;
  }
  throw new Error('no empty row');
};
// Plenty of wood and stone close by, so costs never get in the way.
const supplies = (x: number, y: number) => { const a = w.nearestFree(x + 4, y - 4, 6)!; w.addHoard(a[0], a[1], 'tree', 2000); const b = w.nearestFree(x - 4, y - 4, 6)!; w.addHoard(b[0], b[1], 'rock', 2000); };

describe('city building', () => {
  const p = game.join(undefined, 'Builder') as PlayerRec;
  p.online = true;
  const k = game.kingsOf(p.id).find((x) => !x.emperor)!;
  const h = house(p.id, k.x + 2, k.y + 2);
  supplies(k.x, k.y);

  it('a fence drawn as a line goes up square by square, costs wood, and blocks walking', () => {
    const row = emptyRow(k.x, k.y + 3, 4);
    const wood = () => [...w.nodesNear(k.x, k.y, 1, REACH)].filter((n) => n.kind === 'tree').reduce((s, n) => s + n.remaining, 0);
    const before = wood();
    const r = game.city.placeDecor(p.id, 'fence', row);
    expect(r).toEqual({ placed: 4, err: null });
    expect(before - wood()).toBe(4 * BUILDINGS.fence.cost.tree!);
    for (const [x, y] of row) expect(w.walkable(x, y)).toBe(false);
  });

  it('undo takes back the last stroke and refunds exactly what it cost', () => {
    const row = emptyRow(k.x - 1, k.y - 4, 3);
    const stone = () => [...w.nodesNear(k.x, k.y, 1, 30)].filter((n) => n.kind === 'rock').reduce((s, n) => s + n.remaining, 0);
    const before = stone();
    game.city.begin(p.id, 42);
    expect(game.city.placeDecor(p.id, 'wall', row).placed).toBe(3);
    game.city.end(p.id);
    expect(before - stone()).toBe(3 * BUILDINGS.wall.cost.rock!);
    expect(game.city.undo(p.id)).toBeNull();
    for (const [x, y] of row) expect(w.buildingIdAt(x, y)).toBeUndefined();
    expect(stone()).toBe(before);
    expect(game.city.undo(p.id)).toMatch(/Nothing to undo/);
  });

  it("decorations don't raise a town's tier or count toward the building caps", () => {
    const tierBefore = game.chronicle.settlementsOf(p.id).find((s) => s.buildings.some((b) => b.id === h.id))!.tier;
    game.city.placeDecor(p.id, 'lamp', emptyRow(k.x - 2, k.y - 2, 1));
    game.chronicle.refreshSettlements(t, true);
    const s = game.chronicle.settlementsOf(p.id).find((x) => x.buildings.some((b) => b.id === h.id))!;
    expect(s.tier).toBe(tierBefore);
    expect(s.buildings.every((b) => !BUILDINGS[b.type as keyof typeof BUILDINGS]?.decor)).toBe(true);
  });

  it('a street through your wall makes a gate you can walk through; streets only go in your own towns', () => {
    const [cell] = emptyRow(h.x - 1, h.y + 1, 1);
    expect(game.city.placeDecor(p.id, 'wall', [cell]).placed).toBe(1);
    expect(w.walkable(cell[0], cell[1])).toBe(false);
    expect(game.city.paintPaving(p.id, [cell], 1).done).toBe(1);
    expect(w.walkable(cell[0], cell[1])).toBe(true);
    expect(w.traffic.get(cell[0] * 134217728 + cell[1])).toBe(PAVED + 1);
    // Unpaved: a wall again.
    game.city.paintPaving(p.id, [cell], null);
    expect(w.walkable(cell[0], cell[1])).toBe(false);
    // Far from any building of yours: no.
    expect(game.city.paintPaving(p.id, [[h.x + 40, h.y + 40]], 1).done).toBe(0);
  });

  it('bridges go only across water, reach out from a bank, and make the water walkable', () => {
    // Find a bank: a land square beside water, then bring a king and a house there.
    let bank: [number, number] | null = null, water: [number, number] | null = null;
    for (let r = 0; r < 400 && !bank; r += 3) for (let a = 0; a < 24 && !bank; a++) {
      const x = Math.round(k.x + Math.cos(a / 3.82) * r), y = Math.round(k.y + Math.sin(a / 3.82) * r);
      if (w.terrain(x, y) === 'water' && w.terrain(x - 1, y) !== 'water' && w.buildable(x - 1, y) && w.terrain(x + 1, y) === 'water') { bank = [x - 1, y]; water = [x, y]; }
    }
    expect(bank).toBeTruthy();
    w.movePiece(k, ...w.nearestFree(bank![0] - 2, bank![1], 6)!);
    house(p.id, bank![0] - 3, bank![1] + 1);
    supplies(bank![0] - 3, bank![1]);
    expect(game.city.placeDecor(p.id, 'bridge', [[bank![0] - 2, bank![1]]]).placed).toBe(0); // not on land
    expect(w.walkable(water![0], water![1])).toBe(false);
    const r = game.city.placeDecor(p.id, 'bridge', [water!, [water![0] + 1, water![1]]]);
    expect(r.placed).toBe(2);
    expect(w.walkable(water![0], water![1])).toBe(true);
    expect(w.walkable(water![0] + 1, water![1])).toBe(true);
  });

  it('moving a building rebuilds it at the new spot for free; demolishing leaves salvage', () => {
    const b = house(p.id, k.x + 1, k.y - 3);
    const [to] = emptyRow(b.x + 2, b.y, 1);
    expect(game.city.move(p.id, b.id, to)).toBeNull();
    expect([b.x, b.y]).toEqual(to);
    expect(b.built).toBe(0);
    expect(w.buildingIdAt(to[0], to[1])).toBe(b.id);
    const piles = () => [...w.nodeOverlay.values()].filter((n) => n.hoard && !n.gone && cheb(n.x, n.y, to[0], to[1]) <= 4).length;
    const before = piles();
    expect(game.city.demolish(p.id, b.id)).toBeNull();
    expect(w.buildings.has(b.id)).toBe(false);
    expect(piles()).toBe(before + 1); // half of 30 wood
  });

  it('a planted sapling grows into a tree; a planted field fills with wheat', () => {
    const [a, b] = emptyRow(k.x - 3, k.y + 1, 2);
    expect(game.city.plant(p.id, 'tree', [a]).placed).toBe(1);
    expect(game.city.plant(p.id, 'wheat', [b]).placed).toBe(1);
    expect(w.nodeAt(a[0], a[1])!.remaining).toBe(0);
    for (let i = 0; i < 12; i++) tick(PLANT_TREE_MS / 10);
    expect(w.nodeAt(a[0], a[1])!.remaining).toBeGreaterThan(0);
    expect(w.nodeAt(b[0], b[1])!.remaining).toBe(w.nodeAt(b[0], b[1])!.capacity);
  });

  it('elephants haul stone from a deposit to a pile in town, a load at a time', () => {
    const rock = w.nearestFree(k.x + 8, k.y - 2, 6)!;
    const dep = w.addHoard(rock[0], rock[1], 'rock', 130);
    const [drop] = emptyRow(k.x - 2, k.y + 2, 1);
    const near = () => [...w.nodeOverlay.values()].filter((q) => q.hoard && !q.gone && q.kind === 'rock' && q !== dep && cheb(q.x, q.y, drop[0], drop[1]) <= 3).reduce((s, q) => s + q.remaining, 0);
    const before = near();
    const ele = [0, 1].map((i) => { const a = w.nearestFree(k.x + 5, k.y + i, 6)!; const q = { id: w.id(), owner: p.id, kind: 'R' as const, x: a[0], y: a[1], facing: 2 as const, state: 'idle' as const }; game.addPiece(q); return q; });
    expect(game.works.haul(p.id, ele.map((e) => e.id), [dep.x, dep.y], drop)).toBeNull();
    let n = 0;
    while (ele.some((e) => game.works.busy(e.id)) && n++ < 800) turn();
    expect(dep.remaining).toBe(0);
    expect(near() - before).toBe(130);
    // Rock only, and in reach of a king.
    expect(game.works.haul(p.id, ele.map((e) => e.id), [k.x + 300, k.y], drop)).toMatch(/rock or ore/);
  });

  it("pawns on supply runs keep moving (they aren't mistaken for elephants on a haul), and a clump spreads out", () => {
    const at = w.nearestFree(h.x, h.y + 2, 4)!;
    const pawns = Array.from({ length: 6 }, () => { const a = w.nearestFree(at[0], at[1], 4)!; const q = { id: w.id(), owner: p.id, kind: 'P' as const, x: a[0], y: a[1], facing: 2 as const, state: 'idle' as const, routine: 'haul:wheat' }; game.addPiece(q); return q; });
    const start = pawns.map((q) => [q.x, q.y].join());
    turn(60);
    const moved = pawns.filter((q, i) => [q.x, q.y].join() !== start[i]).length;
    expect(moved).toBeGreaterThanOrEqual(4);
  });

  it('the decor budget grows with real buildings; decorations far from any building are swept away', () => {
    expect(game.city.decorBudget(p.id)).toBeGreaterThanOrEqual(DECOR_BASE + 4);
    const stray: Building = { id: nextB++, owner: p.id, type: 'statue', x: k.x + 200, y: k.y + 200, size: 1, hp: 100, built: 1, prod: 0 };
    w.addBuilding(stray);
    game.city.sweep();
    expect(w.buildings.has(stray.id)).toBe(false);
    turn(1);
  });
});
