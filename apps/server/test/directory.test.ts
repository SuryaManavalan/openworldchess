// The directory (docs/specs/social.md): rulers by name, best matches first, never bots;
// a ruler with no town yet is found where their kings are.
import { afterAll, describe, expect, it } from 'vitest';
import { Game, type PlayerRec } from '../src/game.ts';

const game = new Game({ seed: 3, speed: 1, wilds: false });
afterAll(() => game.battles.ai.stop());

describe('the directory', () => {
  it('finds rulers by part of their name, exact and starts-with first, bots never', () => {
    const a = game.join(undefined, 'Rookwell') as PlayerRec;
    game.join(undefined, 'Brook');
    game.join(undefined, 'Rook');
    const bot = game.join(undefined, 'Rookbot') as PlayerRec; bot.isBot = true;
    const r = game.directory.find('rook');
    expect(r.players.map((p) => p.name)).toEqual(['Rook', 'Rookwell', 'Brook']);
    const w = r.players.find((p) => p.id === a.id)!;
    const k = game.kingsOf(a.id)[0];
    expect(w.cities).toEqual([]);
    expect(Math.max(Math.abs(w.home[0] - k.x), Math.abs(w.home[1] - k.y))).toBeLessThan(20);
  });

  it('ignores searches shorter than two letters', () => {
    expect(game.directory.find(' r ')).toEqual({ players: [], cities: [] });
  });
});
