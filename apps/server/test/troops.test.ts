// Troops (docs/specs/movement.md §10): pieces sent out of your cities hold there together;
// part of a troop sent elsewhere splits off; reinforcements walk out and join; stragglers
// and troops called home go home. And the AI in a battle takes a person's time over a move.
import { afterAll, describe, expect, it } from 'vitest';
import { TROOP_JOIN_R, TROOP_LEASH, cheb, type Building, type Piece, type PieceKind } from '@owc/shared';
import { Game, type PlayerRec } from '../src/game.ts';

let rs = 4242;
Math.random = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; };
const game = new Game({ seed: 9, speed: 1, wilds: false });
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
let nextB = 7_000_000;
const house = (owner: string, x: number, y: number) => {
  const at = game.world.nearestFree(x, y, 6)!;
  const b: Building = { id: nextB++, owner, type: 'house', x: at[0], y: at[1], size: 1, hp: 100, built: 1, prod: 0 };
  game.world.addBuilding(b);
  return b;
};
/** Open ground about `d` squares east of (x, y). */
const out = (x: number, y: number, d: number): [number, number] => game.world.nearestFree(x + d, y, 10)!;
const troops = (p: PlayerRec) => p.troops ?? [];
const settle = (n = 80) => turn(n);

describe('troops', () => {
  const p = join('Marshal');
  const k = game.kingsOf(p.id).find((x) => !x.emperor)!;
  house(p.id, k.x, k.y + 2);
  const pawns = [0, 1, 2].map((i) => add(p.id, 'P', k.x + i, k.y + 3));

  it('pieces sent out of your cities form a troop and hold there', () => {
    const to = out(k.x, k.y, 30);
    expect(game.orderMove(p.id, pawns.map((q) => q.id), to, undefined, undefined, undefined, true)).toBeNull();
    expect(troops(p)).toHaveLength(1);
    expect(troops(p)[0].members.sort()).toEqual(pawns.map((q) => q.id).sort());
    settle();
    // Arrived, and they stay (no king near, yet they don't drift home).
    for (const q of pawns) expect(cheb(q.x, q.y, to[0], to[1])).toBeLessThanOrEqual(4);
    settle(40);
    for (const q of pawns) expect(cheb(q.x, q.y, to[0], to[1])).toBeLessThanOrEqual(4);
  });

  it('moving part of a troop splits it off; moving the whole troop moves it', () => {
    const t0 = troops(p)[0];
    const to = out(t0.at[0], t0.at[1], 12);
    game.orderMove(p.id, [pawns[0].id], to, undefined, undefined, undefined, true);
    expect(troops(p)).toHaveLength(2);
    expect(t0.members).not.toContain(pawns[0].id);
    const split = troops(p).find((x) => x !== t0)!;
    expect(split.members).toEqual([pawns[0].id]);
    // The rest move as the same troop.
    const to2 = out(t0.at[0], t0.at[1] + 6, 4);
    game.orderMove(p.id, t0.members, to2, undefined, undefined, undefined, true);
    expect(troops(p)).toContain(t0);
    expect(t0.at).toEqual(to2);
    settle();
  });

  it('a reinforcement walks out, shows as on its way, and joins when it gets there', () => {
    const t0 = troops(p).find((x) => x.members.length === 2)!;
    const knight = add(p.id, 'N', k.x - 1, k.y + 1);
    expect(game.troops.reinforce(p.id, t0.id, knight.id)).toBeNull();
    expect(t0.joining.map((j) => j.id)).toEqual([knight.id]);
    let n = 0;
    while (t0.joining.length && n++ < 400) turn();
    expect(t0.members).toContain(knight.id);
    expect(cheb(knight.x, knight.y, t0.at[0], t0.at[1])).toBeLessThanOrEqual(TROOP_JOIN_R);
  });

  it("a reinforcement that never arrives is dropped and walks home", () => {
    const t0 = troops(p).find((x) => x.members.length >= 3)!;
    const b = add(p.id, 'B', k.x - 2, k.y + 1);
    game.troops.reinforce(p.id, t0.id, b.id);
    game.orderStop(p.id, [b.id]); // it never goes (a stop takes it off the errand)
    expect(t0.joining.some((j) => j.id === b.id)).toBe(false);
    const n = add(p.id, 'N', k.x - 2, k.y + 2);
    game.troops.reinforce(p.id, t0.id, n.id);
    t0.joining[0].until = t - 1;
    turn(2);
    expect(t0.joining).toHaveLength(0);
    expect(t0.members).not.toContain(n.id);
  });

  it('a member stranded far from its post is dropped and sent home', () => {
    const t0 = troops(p).find((x) => x.members.length >= 3)!;
    const q = game.world.pieces.get(t0.members[0])!;
    const far = game.world.nearestFree(t0.at[0] + TROOP_LEASH + 8, t0.at[1], 10)!;
    game.world.movePiece(q, far[0], far[1]);
    turn(2);
    expect(t0.members).not.toContain(q.id);
    expect(q.posted).toBeFalsy();
  });

  it('called home, a troop marches to a city and disbands there', () => {
    const t0 = troops(p).find((x) => x.members.length >= 2)!;
    const ids = [...t0.members];
    expect(game.troops.callHome(p.id, t0.id)).toBeNull();
    expect(t0.home).toBe(true);
    settle(300);
    expect(troops(p).find((x) => x.id === t0.id)).toBeUndefined();
    for (const id of ids) expect(game.troops.inCity(p.id, game.world.pieces.get(id)!.x, game.world.pieces.get(id)!.y)).toBe(true);
  });

  it('moving pieces around inside a city makes no troop', () => {
    const before = troops(p).length;
    const q = add(p.id, 'P', k.x + 1, k.y + 1);
    game.orderMove(p.id, [q.id], [k.x + 2, k.y + 4], undefined, undefined, undefined, true);
    expect(troops(p).length).toBe(before);
  });

  it('the AI takes a varied, human time over its moves, and never more than its clock allows', () => {
    const b = game.battles as unknown as { thinkMs(gm: unknown, left: number, camp: boolean): number };
    const gm = (legal: number, moves: string[]) => ({ legalMoves: () => Array(legal).fill('e2e4'), moves });
    const middle = Array.from({ length: 40 }, () => b.thinkMs(gm(32, Array(20).fill('Nf3')), 240_000, false));
    expect(Math.min(...middle)).toBeGreaterThanOrEqual(250);
    expect(Math.max(...middle) - Math.min(...middle)).toBeGreaterThan(800); // it varies
    expect(middle.reduce((s, x) => s + x, 0) / middle.length).toBeGreaterThan(1500);
    const opening = Array.from({ length: 20 }, () => b.thinkMs(gm(20, ['e4']), 240_000, false));
    expect(Math.max(...opening)).toBeLessThan(Math.max(...middle));
    // Short on time: quick.
    for (let i = 0; i < 20; i++) expect(b.thinkMs(gm(32, Array(40).fill('Nf3')), 8_000, false)).toBeLessThanOrEqual(400);
  });
});
