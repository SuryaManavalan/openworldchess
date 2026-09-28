// Works (docs/specs/movement.md §9): knights pave roads, elephants clear land, as crews.
import { afterAll, describe, expect, it } from 'vitest';
import { ALTAR_RATE, BUILDINGS, cheb, type Piece, type PieceKind } from '@owc/shared';
import { Game, type PlayerRec } from '../src/game.ts';

let rs = 99173;
Math.random = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; };
const game = new Game({ seed: 12, speed: 1, wilds: false });
afterAll(() => game.battles.ai.stop());
let t = 1_800_000_000_000;
const turn = (n = 1) => { for (let i = 0; i < n; i++) { t += 600; game.now = t; game.worldTurn(t); } };
const join = (name: string) => { const p = game.join(undefined, name) as PlayerRec; p.online = true; return p; };
const add = (owner: string, kind: PieceKind, x: number, y: number): Piece => {
  const at = game.world.nearestFree(x, y, 8)!;
  const p: Piece = { id: game.world.id(), owner, kind, x: at[0], y: at[1], facing: 2, state: 'idle' };
  game.addPiece(p);
  return p;
};

/** A straight-ish stretch of open ground from (x, y) heading east, `len` squares long. */
function openRun(x: number, y: number, len: number): [number, number] | null {
  for (let dy = 0; dy < 200; dy += 3) {
    let ok = true;
    for (let i = 0; i <= len && ok; i++) for (let j = -1; j <= 1 && ok; j++) ok = game.world.walkable(x + i, y + dy + j);
    if (ok) return [x, y + dy];
  }
  return null;
}

/** Turns until a crew of `n` knights paves `len` squares east of (x, y). */
function paveTime(p: PlayerRec, n: number, x: number, y: number, len: number): number {
  const knights = Array.from({ length: n }, (_, i) => add(p.id, 'N', x, y + (i % 2)));
  expect(game.works.pave(p.id, knights.map((k) => k.id), [x + len, y])).toBeNull();
  let turns = 0;
  const done = () => knights.every((k) => !game.works.busy(k.id));
  while (!done() && turns < 600) { turn(); turns++; }
  for (let i = 0; i <= len; i++) expect(game.world.paved(x + i, y) || !game.world.walkable(x + i, y)).toBe(true);
  return turns;
}

describe('works', () => {
  it('knights pave a road, and a bigger crew paves it faster', () => {
    const p = join('Paver');
    const k = game.kingsOf(p.id)[0];
    const a = openRun(k.x + 4, k.y + 6, 40)!;
    const b = openRun(a[0], a[1] + 8, 40)!;
    expect(a && b).toBeTruthy();
    const one = paveTime(p, 1, a[0], a[1], 40);
    const four = paveTime(p, 4, b[0], b[1], 40);
    expect(one).toBeGreaterThan(30);
    expect(four).toBeLessThan(one * 0.6);
  });

  it('troops march faster on a paved road', () => {
    const p = join('Roadie');
    const k = game.kingsOf(p.id)[0];
    const a = openRun(k.x + 4, k.y - 30, 30)!, b = openRun(a[0], a[1] + 10, 30)!;
    for (let i = 0; i <= 30; i++) game.world.pave(a[0] + i, a[1]);
    const march = (x: number, y: number) => {
      const pawn = add(p.id, 'N', x, y);
      game.orderMove(p.id, [pawn.id], [x + 30, y], undefined, undefined, undefined, true);
      let n = 0;
      while (cheb(pawn.x, pawn.y, x + 30, y) > 1 && n < 300) { turn(); n++; }
      return n;
    };
    const paved = march(a[0], a[1]), dirt = march(b[0], b[1]);
    expect(paved).toBeLessThan(dirt * 0.85);
  });

  it('a new order takes a knight off the road; what it paved stays', () => {
    const p = join('Quitter');
    const k = game.kingsOf(p.id)[0];
    const a = openRun(k.x + 4, k.y + 30, 30)!;
    const knight = add(p.id, 'N', a[0], a[1]);
    game.works.pave(p.id, [knight.id], [a[0] + 30, a[1]]);
    turn(8);
    const laid = Array.from({ length: 31 }, (_, i) => game.world.paved(a[0] + i, a[1])).filter(Boolean).length;
    expect(laid).toBeGreaterThan(2);
    game.orderStop(p.id, [knight.id]);
    expect(game.works.busy(knight.id)).toBe(false);
    turn(4);
    expect(Array.from({ length: 31 }, (_, i) => game.world.paved(a[0] + i, a[1])).filter(Boolean).length).toBe(laid);
  });

  it('elephants clear the trees in an area and leave rock and ore unless asked', () => {
    const p = join('Feller');
    const k = game.kingsOf(p.id)[0];
    // Find a wooded 10×10 patch near the king.
    let area: { a: [number, number]; b: [number, number] } | null = null;
    for (let r = 12; r < 120 && !area; r += 6)
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r]]) {
        const a: [number, number] = [k.x + dx, k.y + dy], b: [number, number] = [a[0] + 9, a[1] + 9];
        if (game.works.targets(p.id, { x0: a[0], y0: a[1], x1: b[0], y1: b[1], hard: false }).length >= 6) { area = { a, b }; break; }
      }
    expect(area).toBeTruthy();
    const box = { x0: area!.a[0], y0: area!.a[1], x1: area!.b[0], y1: area!.b[1] };
    const stone = game.works.targets(p.id, { ...box, hard: true }).filter((n) => n.kind !== 'tree').length;
    const crew = [0, 1, 2].map((i) => add(p.id, 'R', area!.a[0] - 2, area!.a[1] + i * 2));
    expect(game.works.clear(p.id, crew.map((e) => e.id), area!.a, area!.b, false)).toBeNull();
    let n = 0;
    while (crew.some((e) => game.works.busy(e.id)) && n < 1500) { turn(); n++; }
    expect(crew.some((e) => game.works.busy(e.id))).toBe(false);
    expect(game.works.targets(p.id, { ...box, hard: false }).length).toBe(0);
    expect(game.works.targets(p.id, { ...box, hard: true }).filter((q) => q.kind !== 'tree').length).toBe(stone);
  });

  it('only knights pave and only elephants clear', () => {
    const p = join('Wrongcrew');
    const k = game.kingsOf(p.id)[0];
    const pawn = add(p.id, 'P', k.x + 2, k.y + 2);
    expect(game.works.pave(p.id, [pawn.id], [k.x + 20, k.y])).toMatch(/knights/);
    expect(game.works.clear(p.id, [pawn.id], [k.x, k.y], [k.x + 5, k.y + 5], false)).toMatch(/elephants/);
  });
});

describe('altars (economy.md §8)', () => {
  const eco = (ms = 1000) => { t += ms; game.now = t; game.economy(t); };
  /** A far-off spot with open ground around it, with wood, stone and wheat to build from. */
  function wilds(p: PlayerRec, dx: number): [number, number] {
    const k = game.kingsOf(p.id)[0];
    const at = game.world.nearestFree(k.x + dx, k.y, 20)!;
    for (const [ox, oy, kind] of [[4, 4, 'tree'], [5, 4, 'rock'], [-4, 4, 'wheat'], [4, -4, 'wheat']] as const) {
      const n = game.world.nearestFree(at[0] + ox, at[1] + oy, 4)!;
      game.world.addHoard(n[0], n[1], kind, 5000);
    }
    return at;
  }
  const spot = (x: number, y: number) => game.world.nearestFree(x, y, 5, (fx, fy) => game.world.buildable(fx, fy) && !game.world.nodeAt(fx, fy) && game.world.buildingIdAt(fx, fy) == null)!;

  it('a bishop raises an altar anywhere, and it holds a few small buildings that work slower', () => {
    const p = join('Pilgrim');
    game.chronicle.of(p).buildings.push('house', 'stable', 'temple', 'barracks');
    const at = wilds(p, 70);
    for (const k of game.kingsOf(p.id)) expect(cheb(k.x, k.y, at[0], at[1])).toBeGreaterThan(20);
    const site = spot(at[0], at[1]);
    expect(game.build(p.id, 'altar', site)).toMatch(/bishop/);
    const bishop = add(p.id, 'B', site[0] + 1, site[1] + 1);
    expect(game.build(p.id, 'altar', site)).toBeNull();
    const altar = [...game.world.buildings.values()].find((b) => b.owner === p.id && b.type === 'altar')!;
    for (let i = 0; i < 70; i++) eco();
    expect(altar.built).toBe(1);
    expect(bishop.routine).toBe('tend');
    // Around it: houses, stables and temples only, and at most three.
    expect(game.build(p.id, 'barracks', spot(site[0] + 3, site[1]))).toMatch(/only houses/);
    const h1 = spot(site[0] - 3, site[1] + 2);
    expect(game.build(p.id, 'house', h1)).toBeNull();
    expect(game.build(p.id, 'house', spot(site[0] + 3, site[1] - 3))).toBeNull();
    expect(game.build(p.id, 'house', spot(site[0] - 3, site[1] - 3))).toBeNull();
    expect(game.build(p.id, 'house', spot(site[0] + 3, site[1] + 3))).toMatch(/at most 3/);
    const house = [...game.world.buildings.values()].find((b) => b.owner === p.id && b.x === h1[0] && b.y === h1[1])!;
    for (let i = 0; i < Math.ceil(BUILDINGS.house.buildMs / 1000) + 5; i++) eco();
    expect(house.built).toBe(1);
    expect(house.outpost).toBe(true);
    // It works, at the altar's rate: slower than a king's town would.
    expect(house.blocked).toBeNull();
    expect(house.cycleMs).toBeGreaterThan(0);
    const slow = house.cycleMs!;
    // Take the bishop away: the altar and its houses lose their hold.
    game.orderMove(p.id, [bishop.id], [bishop.x + 12, bishop.y], undefined, undefined, undefined, true);
    for (let i = 0; i < 20; i++) turn();
    eco();
    expect(altar.unanchoredSince).toBeDefined();
    expect(house.outpost).toBeUndefined();
    // The same house held by a king works at full speed.
    const k = game.kingsOf(p.id).find((q) => !q.emperor)!;
    const by = game.world.nearestFree(house.x + 2, house.y, 4)!;
    game.world.movePiece(k, by[0], by[1]);
    eco();
    expect(house.outpost).toBeUndefined();
    expect(house.cycleMs! / slow).toBeCloseTo(ALTAR_RATE, 1);
  });

  it("beaten by an empire, an altar's keeper loses it: the altar falls and its buildings are masterless", () => {
    const p = join('Keeper'), foe = join('Raider2');
    game.chronicle.of(p).buildings.push('house', 'temple');
    const at = wilds(p, -80);
    const site = spot(at[0], at[1]);
    const bishop = add(p.id, 'B', site[0] + 1, site[1]);
    expect(game.build(p.id, 'altar', site)).toBeNull();
    const altar = [...game.world.buildings.values()].find((b) => b.owner === p.id && b.type === 'altar')!;
    for (let i = 0; i < 70; i++) eco();
    const h = spot(site[0] - 3, site[1] + 2);
    expect(game.build(p.id, 'house', h)).toBeNull();
    const house = [...game.world.buildings.values()].find((b) => b.owner === p.id && b.x === h[0] && b.y === h[1])!;
    for (let i = 0; i < Math.ceil(BUILDINGS.house.buildMs / 1000) + 5; i++) eco();
    // A foreign king comes calling.
    game.shieldMs = 0; p.shieldUntil = 0;
    const fk = game.kingsOf(foe.id).find((k) => !k.emperor)!;
    const near = game.world.nearestFree(site[0] + 3, site[1] + 3, 6)!;
    game.world.movePiece(fk, near[0], near[1]);
    game.battles.countdownScale = 0;
    expect(game.orderAttack(foe.id, [fk.id], bishop.id)).toBeNull();
    t += 10; game.now = t; game.battles.tick(t);
    const rec = [...game.battles.recs.values()].find((r) => r.white.player === foe.id && r.pub.phase === 'live')!;
    expect(rec?.black.kingId).toBe(bishop.id);
    game.battles.resign(p.id, rec.pub.id);
    expect(altar.type).toBe('ruin');
    expect(house.owner).toBeNull();
  });
});
