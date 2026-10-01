// City life (docs/specs/citylife.md): pieces live in buildings, go home at night and come out by
// day, a town keeps only so many outdoors, and an over-full town sends pilgrims out.
import { afterAll, describe, expect, it } from 'vitest';
import { DAY_MS, cheb, type Building, type Piece, type PieceKind } from '@owc/shared';
import { Game, type PlayerRec } from '../src/game.ts';

let rs = 31337;
Math.random = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; };
const game = new Game({ seed: 7, speed: 1, wilds: false });
game.battles.countdownScale = 0;
game.battles.thinkScale = 0;
afterAll(() => game.battles.ai.stop());
const w = game.world;
const noon = (k: number) => Math.floor(1_800_000_000_000 / DAY_MS) * DAY_MS + k * DAY_MS + DAY_MS * 0.25;
let t = noon(0);
const turn = (n = 1) => { for (let i = 0; i < n; i++) { t += 600; game.now = t; game.worldTurn(t); game.battles.tick(t); } };
const join = (name: string) => { const p = game.join(undefined, name) as PlayerRec; p.online = true; return p; };
let nextB = 8_800_000;
const build = (owner: string, type: Building['type'], x: number, y: number, size = 1): Building => {
  const at = w.nearestFree(x, y, 6, (fx, fy) => { for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) if (!w.buildable(fx + dx, fy + dy) || w.buildingIdAt(fx + dx, fy + dy) != null) return false; return true; })!;
  const b: Building = { id: nextB++, owner, type, x: at[0], y: at[1], size, hp: 100, built: 1, prod: 0 };
  w.addBuilding(b);
  return b;
};
const add = (owner: string, kind: PieceKind, x: number, y: number): Piece => {
  const at = w.nearestFree(x, y, 10)!;
  const p: Piece = { id: w.id(), owner, kind, x: at[0], y: at[1], facing: 2, state: 'idle' };
  game.addPiece(p);
  return p;
};

describe('city life', () => {
  const p = join('Townsfolk');
  const k = game.kingsOf(p.id).find((x) => !x.emperor)!;
  const houses = [build(p.id, 'house', k.x + 2, k.y + 2), build(p.id, 'house', k.x - 2, k.y + 2), build(p.id, 'house', k.x + 3, k.y - 2)];
  const crowd = Array.from({ length: 30 }, () => add(p.id, 'P', k.x, k.y + 1));
  game.chronicle.refreshSettlements(t, true);

  it('a piece indoors keeps its place in town but frees its square, and an order brings it out', () => {
    const q = crowd[0], sq = [q.x, q.y];
    w.enter(q, houses[0]);
    expect(q.inside).toBe(houses[0].id);
    expect(w.pieceIdAt(sq[0], sq[1])).toBeUndefined();
    expect(w.piecesNear(houses[0].x, houses[0].y, 1).map((x) => x.id)).toContain(q.id);
    const to = w.nearestFree(k.x - 4, k.y - 4, 6)!;
    expect(game.orderMove(p.id, [q.id], to, undefined, undefined, undefined, true)).toBeNull();
    expect(q.inside).toBeUndefined();
    expect(w.pieceIdAt(q.x, q.y)).toBe(q.id);
    game.orderStop(p.id, [q.id]);
  });

  it('demolishing a building lets everyone inside out', () => {
    const b = build(p.id, 'house', k.x - 5, k.y - 3);
    const q = crowd[1];
    w.enter(q, b);
    game.city.demolish(p.id, b.id);
    expect(q.inside).toBeUndefined();
    expect(w.pieceIdAt(q.x, q.y)).toBe(q.id);
  });

  it('at night they go home; by day a town keeps only so many outdoors', () => {
    t = noon(1) + DAY_MS * 0.5; // midnight
    turn(250);
    const inside = crowd.filter((q) => q.inside != null).length;
    expect(inside).toBeGreaterThanOrEqual(20); // 3 houses × 4, doubled at night
    for (const q of crowd) if (q.inside != null) expect(w.buildings.get(q.inside)?.owner).toBe(p.id);
    t = noon(2); // the next noon
    turn(250);
    const out = crowd.filter((q) => q.inside == null).length;
    expect(out).toBeGreaterThan(5);
    // Kings never go indoors.
    expect(k.inside).toBeUndefined();
  });

  it('a battle calls everyone near out of doors to fight', () => {
    const foe = join('Raider');
    const fk = game.kingsOf(foe.id).find((x) => !x.emperor)!;
    w.movePiece(fk, ...w.nearestFree(k.x + 3, k.y, 4)!);
    for (let i = 0; i < 4; i++) add(foe.id, 'P', fk.x, fk.y);
    const q = crowd.find((x) => x.inside == null)!;
    w.enter(q, houses[1]);
    foe.shieldUntil = 0; p.shieldUntil = 0;
    expect(game.orderAttack(foe.id, game.world.piecesNear(fk.x, fk.y, 3).filter((x) => x.owner === foe.id).map((x) => x.id), k.id)).toBeNull();
    turn(3);
    const r = [...game.battles.recs.values()].find((x) => x.black.player === p.id && x.pub.phase !== 'over');
    expect(r).toBeTruthy();
    for (const id of r!.black.ids) expect(w.pieces.get(id)?.inside).toBeUndefined();
    game.battles.ai.stop();
  });

  it('an over-full town sends pilgrims out, who come home again; pilgrims are under the peace of the road', () => {
    const q = join('Pilgrimtown');
    const qk = game.kingsOf(q.id).find((x) => !x.emperor)!;
    build(q.id, 'house', qk.x + 2, qk.y + 2);
    const many = Array.from({ length: 40 }, () => add(q.id, 'P', qk.x, qk.y + 1));
    game.chronicle.refreshSettlements(t, true);
    t = noon(4);
    let tr: NonNullable<PlayerRec['troops']>[number] | undefined;
    for (let i = 0; i < 400 && !tr; i++) { turn(); tr = q.troops?.find((x) => x.auto === 'pilgrims'); }
    expect(tr).toBeTruthy();
    expect(tr!.members.length).toBeGreaterThanOrEqual(3);
    expect(cheb(tr!.at[0], tr!.at[1], qk.x, qk.y)).toBeGreaterThan(8);
    const raider = join('Bandit');
    const rk = game.kingsOf(raider.id).find((x) => !x.emperor)!;
    expect(game.orderAttack(raider.id, [rk.id], tr!.members[0])).toMatch(/peace of the road/);
    void many;
  });
});
