// The land's rating (docs/specs/elo.md §3): it takes on the ratings of the empires
// living on it, keeps the generated map where nobody lives, and drifts back when they go.
import { afterAll, describe, expect, it } from 'vitest';
import { eloAt } from '@owc/worldgen';
import { Game, type PlayerRec } from '../src/game.ts';

const game = new Game({ seed: 21, speed: 1, wilds: false });
afterAll(() => game.battles.ai.stop());

describe('land', () => {
  it('strong players make strong land, and far land keeps the generated map', () => {
    const p = game.join(undefined, 'Strong') as PlayerRec;
    p.rating = 2100;
    const k = game.kingsOf(p.id)[0];
    const before = game.world.elo(k.x, k.y);
    for (let i = 0; i < 12; i++) game.reshapeLand();
    const after = game.world.elo(k.x, k.y);
    expect(after).toBeGreaterThan(before + 300);
    expect(after).toBeGreaterThan(1600);
    expect(game.world.elo(k.x + 20000, k.y)).toBeCloseTo(eloAt(21, k.x + 20000, k.y), 5);
  });

  it('camps on strong land are rated to match', () => {
    const p = [...game.players.values()].find((x) => x.name === 'Strong')!;
    const k = game.kingsOf(p.id)[0];
    game.wilds.enabled = true;
    const rec = { id: 'wtest', wild: { faction: 'goblins', x: k.x + 30, y: k.y, areaElo: 0, roster: ['K', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'] }, rating: 0 } as unknown as PlayerRec;
    game.wilds.rerate(rec, 16);
    expect(rec.rating).toBeGreaterThan(1450); // a full common band on 1600+ land
    game.wilds.enabled = false;
  });

  it('when the empire leaves, the land drifts back to the map', () => {
    const p = [...game.players.values()].find((x) => x.name === 'Strong')!;
    const k = game.kingsOf(p.id)[0];
    const [x, y] = [k.x, k.y];
    for (const q of [...game.world.pieces.values()]) if (q.owner === p.id) game.removePiece(q.id);
    for (let i = 0; i < 25; i++) game.reshapeLand();
    expect(Math.abs(game.world.elo(x, y) - eloAt(21, x, y))).toBeLessThan(40);
  });
});
