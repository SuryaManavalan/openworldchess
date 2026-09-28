// Runaway loops are capped (docs/specs/safeguards.md).
import { afterAll, describe, expect, it } from 'vitest';
import { cheb, BUILDINGS_PER_KING, PLAYER_PIECE_CAP, POP_HOUSES_COUNTED, POP_PAWNS_PER_HOUSE, POP_PAWNS_PER_KING, POP_PER_BUILDING, RUIN_LIFETIME_MS, type Building } from '@owc/shared';
import { Game, type PlayerRec } from '../src/game.ts';
import { findPath } from '@owc/rules';

// Spawn spots and routines use Math.random: seed it so these tests are reproducible.
let rs = 20260927;
Math.random = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; };
const game = new Game({ seed: 3, speed: 1 });
afterAll(() => game.battles.ai.stop());
const join = (name: string) => game.join(undefined, name) as PlayerRec;
let nextB = 1_000_000;
const house = (owner: string, x: number, y: number): Building => ({ id: nextB++, owner, type: 'house', x, y, size: 1, hp: 100, built: 1, prod: 0 });

describe('safeguards', () => {
  it('population is by piece: pawns from houses, capped per king; knights from stables', () => {
    const p = join('Capper');
    const k = game.kingsOf(p.id)[0];
    const kings = game.kingsOf(p.id).length;
    const base = game.popCaps(p.id);
    expect(base.P).toBe(kings * POP_PAWNS_PER_KING + kings * game.chronicle.popPerKing(p));
    for (let i = 0; i < 8; i++) game.world.addBuilding(house(p.id, k.x - 9 + i * 2, k.y - 9));
    // Each king counts at most POP_HOUSES_COUNTED houses.
    expect(game.popCaps(p.id).P - base.P).toBeLessThanOrEqual(kings * POP_PAWNS_PER_HOUSE * POP_HOUSES_COUNTED);
    expect(game.popCaps(p.id).P).toBeGreaterThan(base.P);
    // A stable makes room for knights, and only knights.
    const n0 = game.popCaps(p.id).N;
    game.world.addBuilding({ ...house(p.id, k.x + 5, k.y + 5), type: 'stable', size: 2 });
    const after = game.popCaps(p.id);
    expect(after.N).toBeGreaterThanOrEqual(n0 + POP_PER_BUILDING.N!.n);
    expect(after.B).toBe(base.B);
    expect(game.popCap(p.id)).toBeLessThanOrEqual(PLAYER_PIECE_CAP);
    expect(game.selfPlayer(p).pop?.N?.[1]).toBe(after.N);
  });

  it('a king can hold a limited number of buildings', () => {
    const p = join('Builder');
    for (const k of game.kingsOf(p.id)) for (let i = 0; i < BUILDINGS_PER_KING; i++) game.world.addBuilding(house(p.id, k.x - 10 + i, k.y + 10));
    const k = game.kingsOf(p.id)[0];
    expect(game.build(p.id, 'house', [k.x + 1, k.y + 1])).toMatch(/at most|maximum|Something/);
  });

  it('starting-kit pieces perish instead of going masterless', () => {
    const p = join('Kitty');
    const pawn = game.holdings(p.id).pieces.find((x) => x.kind === 'P')!;
    expect(pawn.kit).toBe(true);
    game.makeMasterless(pawn);
    expect(game.world.pieces.has(pawn.id)).toBe(false);
  });

  it('ruins crumble away', () => {
    const b: Building = { id: nextB++, owner: null, type: 'ruin', x: 5000, y: 5000, size: 2, hp: 0, built: 1, prod: 0, ruinedAt: Date.now() - RUIN_LIFETIME_MS - 1 };
    game.world.addBuilding(b);
    game.economy(Date.now());
    expect(game.world.buildings.has(b.id)).toBe(false);
  });

  it('names are unique regardless of case', () => {
    join('Unique');
    expect('error' in game.join(undefined, 'UNIQUE')).toBe(true);
  });
});

describe('living towns', () => {
  it('merchants caravan between two distant towns and wear a road', () => {
    const p = join('Trader');
    const [k1, k2] = game.kingsOf(p.id);
    // Put the second king 40 squares east (realms don't touch), somewhere a road can
    // reach (not across a river), with a building at each.
    let spot: [number, number] | null = null;
    for (let dy = -30; dy <= 30 && !spot; dy += 6) {
      const c = game.world.nearestFree(k1.x + 40, k1.y + dy, 6);
      if (!c) continue;
      const path = findPath(k1.x, k1.y, c[0], c[1], (x, y) => game.world.walkable(x, y), 12000);
      const end = path.at(-1);
      if (end && cheb(end[0], end[1], c[0], c[1]) <= 1) spot = c;
    }
    expect(spot).not.toBeNull();
    game.world.movePiece(k2, spot![0], spot![1]);
    game.world.addBuilding(house(p.id, k1.x - 2, k1.y - 2));
    game.world.addBuilding(house(p.id, k2.x - 2, k2.y - 2));
    // Plenty of idle pawns so some become merchants.
    for (let i = 0; i < 40; i++) {
      const at = game.world.nearestFree(k1.x + (i % 8) - 4, k1.y + 3 + Math.floor(i / 8), 8);
      if (at) game.addPiece({ id: game.world.id(), owner: p.id, kind: 'P', x: at[0], y: at[1], facing: 1, state: 'idle' });
    }
    for (let t = 0; t < 700; t++) game.worldTurn(Date.now());
    const merchants = game.holdings(p.id).pieces.filter((q) => q.routine?.startsWith('merchant') || q.routine === 'trade');
    expect(merchants.length).toBeGreaterThan(0);
    // The ground between the towns has been walked.
    let walked = 0;
    // ...including the open country between the two realms.
    // (The road between them, well outside both realms.)
    for (const [x, y] of findPath(k1.x, k1.y, spot![0], spot![1], (x, y) => game.world.walkable(x, y), 12000)) if (cheb(x, y, k1.x, k1.y) > 14 && cheb(x, y, spot![0], spot![1]) > 14) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) walked += game.world.traffic.get((x + dx) * 134217728 + y + dy) ?? 0;
    expect(walked).toBeGreaterThan(20);
  });

  it('sieges are remembered on the besieged buildings (walls rise with them)', () => {
    const a = join('Sieger'), d = join('Walled');
    const dk = game.kingsOf(d.id)[0];
    game.world.addBuilding(house(d.id, dk.x + 1, dk.y + 1));
    const ak = game.kingsOf(a.id)[0];
    const near = game.world.nearestFree(dk.x + 2, dk.y - 2, 6)!;
    game.world.movePiece(ak, near[0], near[1]);
    d.shieldUntil = 0;
    expect(game.battles.engage(ak, dk)).toBeNull();
    const b = [...game.world.buildings.values()].find((x) => x.owner === d.id)!;
    expect(b.sieges).toBe(1);
  });
});

describe('movement', () => {
  it('a troop marches through its own idle pieces (they step aside) and arrives', () => {
    const p = join('Marcher');
    const k = game.kingsOf(p.id)[0];
    const troop = game.holdings(p.id).pieces.filter((q) => q.kind === 'P' || q.id === k.id).map((q) => q.id);
    // A wall of the owner's idle pawns across the route.
    for (let dy = -4; dy <= 4; dy++) {
      const at = game.world.nearestFree(k.x + 8, k.y + dy, 2);
      if (at) game.addPiece({ id: game.world.id(), owner: p.id, kind: 'P', x: at[0], y: at[1], facing: 3, state: 'idle' });
    }
    const dest = game.world.nearestFree(k.x + 16, k.y, 6)!;
    expect(game.orderMove(p.id, troop, dest)).toBeNull();
    for (let t = 0; t < 260 && game.world.pieces.get(k.id)!.state === 'moving'; t++) game.worldTurn(Date.now());
    const king = game.world.pieces.get(k.id)!;
    expect(cheb(king.x, king.y, dest[0], dest[1])).toBeLessThanOrEqual(2);
    const near = troop.map((id) => game.world.pieces.get(id)!).filter((q) => cheb(q.x, q.y, dest[0], dest[1]) <= 5).length;
    expect(near).toBeGreaterThanOrEqual(troop.length - 1);
  });
});

describe('clearings', () => {
  it('settlements slowly clear the trees beside them, and the stumps are dug out', () => {
    const p = join('Woodsman');
    const k = game.kingsOf(p.id)[0];
    const w = game.world;
    // A real tree near the king, and a house on open ground right beside it.
    let spot: { n: ReturnType<typeof w.nodeAt>; hx: number; hy: number } | null = null;
    for (const n of w.nodesNear(k.x, k.y, 1, 30).filter((q) => q.kind === 'tree' && q.remaining > 0)) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const hx = n.x + dx, hy = n.y + dy;
        if (w.buildable(hx, hy) && w.free(hx, hy) && !w.nodeAt(hx, hy) && w.buildingIdAt(hx, hy) == null) { spot = { n, hx, hy }; break; }
      }
      if (spot) break;
    }
    expect(spot).not.toBeNull();
    const { n, hx, hy } = spot!;
    w.addBuilding(house(p.id, hx, hy));
    let t = Date.now();
    for (let i = 0; i < 400 && n!.remaining > 0; i++) { t += 30_001; game.economy(t); }
    expect(n!.remaining).toBe(0);
    // Its stump doesn't grow back beside the house: it's dug out.
    game.economy(t + 31 * 60_000);
    expect(w.nodeAt(n!.x, n!.y)).toBeUndefined();
  });
});

describe('strays', () => {
  it('a piece stranded outside reach behind a wall can be ordered, and finds its own way home', () => {
    const p = join('Stray');
    const k = game.kingsOf(p.id).find((x) => !x.emperor)!;
    const pawn = game.holdings(p.id).pieces.find((x) => x.kind === 'P')!;
    // Strand it 16 squares east, behind a wall that a greedy step can't get around.
    const at = game.world.nearestFree(k.x + 16, k.y, 4)!;
    game.world.movePiece(pawn, at[0], at[1]);
    for (let dy = -3; dy <= 3; dy++) game.world.addBuilding(house('nobody', at[0] - 1, at[1] + dy));
    let t = Date.now();
    for (let i = 0; i < 8; i++) game.worldTurn((t += 600));
    expect(pawn.state === 'routed' || pawn.state === 'moving').toBe(true);
    if (pawn.state === 'routed') expect(game.orderMove(p.id, [pawn.id], [k.x, k.y])).toBeNull();
    for (let i = 0; i < 200 && cheb(pawn.x, pawn.y, k.x, k.y) > 10; i++) game.worldTurn((t += 600));
    expect(cheb(pawn.x, pawn.y, k.x, k.y)).toBeLessThanOrEqual(10);
  });

  it('pieces without a king can be sent anywhere, and stay where they were sent (movement.md §4)', () => {
    const p = join('Scout');
    const k = game.kingsOf(p.id).find((x) => !x.emperor)!;
    const pawns = game.holdings(p.id).pieces.filter((x) => x.kind === 'P').slice(0, 2);
    const to = game.world.nearestFree(k.x + 30, k.y, 6)!;
    expect(game.orderMove(p.id, pawns.map((x) => x.id), to, undefined, undefined, undefined, true)).toBeNull();
    let t = Date.now();
    for (let i = 0; i < 200 && pawns.some((x) => cheb(x.x, x.y, to[0], to[1]) > 3); i++) game.worldTurn((t += 600));
    for (const x of pawns) expect(cheb(x.x, x.y, to[0], to[1])).toBeLessThanOrEqual(3);
    // Well outside every king's reach, and they don't drift home.
    for (let i = 0; i < 30; i++) game.worldTurn((t += 600));
    for (const x of pawns) { expect(cheb(x.x, x.y, to[0], to[1])).toBeLessThanOrEqual(3); expect(x.state).toBe('idle'); }
  });
});
