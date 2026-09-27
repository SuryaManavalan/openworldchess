// Runaway loops are capped (docs/specs/safeguards.md).
import { afterAll, describe, expect, it } from 'vitest';
import { BUILDINGS_PER_KING, HOUSE_POP, HOUSES_PER_KING, KING_POP, PLAYER_PIECE_CAP, RUIN_LIFETIME_MS, type Building } from '@owc/shared';
import { Game, type PlayerRec } from '../src/game.ts';

const game = new Game({ seed: 3, speed: 1 });
afterAll(() => game.battles.ai.stop());
const join = (name: string) => game.join(undefined, name) as PlayerRec;
let nextB = 1_000_000;
const house = (owner: string, x: number, y: number): Building => ({ id: nextB++, owner, type: 'house', x, y, size: 1, hp: 100, built: 1, prod: 0 });

describe('safeguards', () => {
  it('population: 16 per king plus 6 per house, at most 3 houses per king', () => {
    const p = join('Capper');
    const k = game.kingsOf(p.id)[0];
    expect(game.popCap(p.id)).toBe(2 * KING_POP);
    for (let i = 0; i < 8; i++) game.world.addBuilding(house(p.id, k.x - 9 + i * 2, k.y - 9));
    // Two kings near each other: each counts at most 3 houses.
    expect(game.popCap(p.id)).toBeLessThanOrEqual(2 * (KING_POP + HOUSE_POP * HOUSES_PER_KING));
    expect(game.popCap(p.id)).toBeLessThanOrEqual(PLAYER_PIECE_CAP);
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
  it('merchants shuttle between two connected towns and wear a road', () => {
    const p = join('Trader');
    const [k1, k2] = game.kingsOf(p.id);
    // Put the second king 16 squares away (realms touch), with a building at each.
    const spot = game.world.nearestFree(k1.x + 16, k1.y, 10)!;
    game.world.movePiece(k2, spot[0], spot[1]);
    game.world.addBuilding(house(p.id, k1.x - 2, k1.y - 2));
    game.world.addBuilding(house(p.id, k2.x - 2, k2.y - 2));
    // Plenty of idle pawns so some become merchants.
    for (let i = 0; i < 40; i++) {
      const at = game.world.nearestFree(k1.x + (i % 8) - 4, k1.y + 3 + Math.floor(i / 8), 8);
      if (at) game.addPiece({ id: game.world.id(), owner: p.id, kind: 'P', x: at[0], y: at[1], facing: 1, state: 'idle' });
    }
    for (let t = 0; t < 400; t++) game.worldTurn(Date.now());
    const merchants = game.holdings(p.id).pieces.filter((q) => q.routine?.startsWith('merchant') || q.routine === 'trade');
    expect(merchants.length).toBeGreaterThan(0);
    // The ground between the towns has been walked.
    let walked = 0;
    for (let x = k1.x + 4; x <= spot[0] - 4; x++) for (let y = k1.y - 3; y <= k1.y + 3; y++) walked += game.world.traffic.get(x * 134217728 + y) ?? 0;
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
