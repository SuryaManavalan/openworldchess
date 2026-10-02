// The Arena (docs/specs/citybuilding.md §10): opened by chapter 1, one to a town, a practice match
// played on its squares (sealed while it lasts), and the Chronicle's spar step counted from it.
import { afterAll, describe, expect, it } from 'vitest';
import { REACH, distToRect } from '@owc/shared';
import { Game, type PlayerRec } from '../src/game.ts';

const game = new Game({ seed: 4, speed: 1, wilds: false });
afterAll(() => game.battles.ai.stop());
const w = game.world;

/** Open ground 8×8 in reach of the king (nothing but crops in the way): its top-left corner. */
function site(k: { x: number; y: number }): [number, number] {
  for (let r = 0; r <= REACH; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x0 = k.x + dx - 4, y0 = k.y + dy - 4;
    if (distToRect(k.x, k.y, x0, y0, 8) > REACH) continue;
    let ok = true;
    for (let y = y0; y < y0 + 8 && ok; y++) for (let x = x0; x < x0 + 8 && ok; x++) {
      const n = w.nodeAt(x, y);
      if (!w.buildable(x, y) || w.buildingIdAt(x, y) != null || w.pieceIdAt(x, y) != null || (n && n.remaining > 0 && n.kind !== 'wheat')) ok = false;
    }
    if (ok) return [x0, y0];
  }
  throw new Error('no open ground for an arena');
}

describe('the Arena', () => {
  const p = game.join(undefined, 'Sparrer') as PlayerRec;
  p.online = true;
  const k = game.kingsOf(p.id).find((x) => !x.emperor)!;
  const t = w.nearestFree(k.x + 3, k.y - 3, 6)!;
  w.addHoard(t[0], t[1], 'tree', 500);
  const at = site(k);

  it('opens after chapter 1', () => {
    expect(game.build(p.id, 'arena', at)).toMatch(/chapter 1/);
    p.chron!.buildings.push('arena');
    expect(game.build(p.id, 'arena', at)).toBeNull();
  });

  it('is one to a town', () => {
    const near = w.nearestFree(at[0] + 10, at[1], 4)!;
    expect(game.build(p.id, 'arena', near)).toMatch(/already has an Arena/);
  });

  it('plays a practice match on its squares, keeps the town off them, and counts for the Chronicle', () => {
    const a = [...w.buildings.values()].find((b) => b.owner === p.id && b.type === 'arena')!;
    expect(game.battles.practice(p.id, a.id)).toMatch(/still being laid/);
    a.built = 1;
    expect(game.battles.practice(p.id, a.id)).toBeNull();
    const b = game.battles.active().find((x) => x.arena === a.id)!;
    expect([b.cx, b.cy]).toEqual([a.x + 4, a.y + 4]);
    expect(w.walkable(a.x + 3, a.y + 3)).toBe(false);
    expect(game.city.move(p.id, a.id, [a.x + 1, a.y])).toMatch(/match/);
    expect(game.battles.practice(p.id, a.id)).toMatch(/already/);
    // Ten plies played (the AI's replies given here), then white resigns: a match played, not dropped.
    for (const [i, uci] of ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5', 'c2c3', 'd7d6'].entries())
      expect(game.battles.move(i % 2 ? 'ai' : p.id, b.id, uci, i % 2 === 1)).toBeNull();
    game.battles.resign(p.id, b.id);
    expect(b.phase).toBe('over');
    expect(w.walkable(a.x + 3, a.y + 3)).toBe(true);
    expect(p.chron!.tallies.spar ?? 0).toBeGreaterThan(0);
  });

  it('is a plaza: pieces walk over it', () => {
    const a = [...w.buildings.values()].find((b) => b.owner === p.id && b.type === 'arena')!;
    expect(w.walkable(a.x + 2, a.y + 5)).toBe(true);
    expect(w.buildingIdAt(a.x + 2, a.y + 5)).toBe(a.id);
  });
});
