// Hurry bubbles (docs/specs/economy.md §7): server-granted, owner-only, and they speed production.
import { afterAll, describe, expect, it } from 'vitest';
import { BUBBLE_MAX, bubbleEveryMs, bubbleWorth, type Building } from '@owc/shared';
import { Game, type PlayerRec } from '../src/game.ts';

let rs = 4242;
Math.random = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; };
const game = new Game({ seed: 11, speed: 1, wilds: false });
afterAll(() => game.battles.ai.stop());
let now = 1_800_000_000_000;
const tick = (ms = 1000) => { now += ms; game.now = now; game.economy(now); };
const join = (name: string) => { const p = game.join(undefined, name) as PlayerRec; p.online = true; return p; };
let nextB = 5_000_000;

/** A house beside wheat, near the player's king, already built. */
function house(p: PlayerRec): Building {
  const k = game.kingsOf(p.id)[0];
  const at = game.world.nearestFree(k.x + 3, k.y + 3, 8)!;
  const b: Building = { id: nextB++, owner: p.id, type: 'house', x: at[0], y: at[1], size: 1, hp: 100, built: 1, prod: 0 };
  game.world.addBuilding(b);
  game.world.addHoard(at[0] + 1, at[1], 'wheat', 5000);
  return b;
}

describe('hurry bubbles', () => {
  it('rise over a working building while its owner is online, up to the max', () => {
    const p = join('Popper');
    const b = house(p);
    tick();
    expect(b.blocked).toBeNull();
    expect(b.cycleMs).toBeGreaterThan(0);
    for (let t = 0; t < 12 && (b.bubbles?.length ?? 0) < BUBBLE_MAX; t++) tick(bubbleEveryMs(b.cycleMs!) * 1.3);
    expect(b.bubbles?.length).toBe(BUBBLE_MAX);
    tick(bubbleEveryMs(b.cycleMs!) * 2);
    expect(b.bubbles?.length).toBe(BUBBLE_MAX);
    // Offline: no new bubbles.
    const q = join('Away');
    const c = house(q);
    q.online = false;
    for (let t = 0; t < 5; t++) tick(bubbleEveryMs(c.cycleMs ?? 60_000) * 1.3);
    expect(c.bubbles).toBeUndefined();
  });

  it('popping one advances production; only the owner can pop', () => {
    const p = join('Tapper');
    const b = house(p);
    tick();
    while (!b.bubbles?.length) tick(2000);
    const before = b.prod, n = b.bubbles.length, gold = b.bubbles[0] === 1;
    const rival = join('Thief');
    expect(game.popBubble(rival.id, b.id, 0)).toBe(false);
    expect(b.bubbles.length).toBe(n);
    expect(game.popBubble(p.id, b.id, 0)).toBe(true);
    expect(b.bubbles?.length ?? 0).toBe(n - 1);
    const worth = bubbleWorth(b.cycleMs!, gold);
    // Either it moved ahead by the bubble's worth, or it finished a piece and started over.
    expect(b.prod === 0 || Math.abs(b.prod - (before + worth)) < 1e-9).toBe(true);
    // A bubble that isn't there does nothing.
    expect(game.popBubble(p.id, b.id, 5)).toBe(false);
  });

  it('a full pop raises the piece at once', () => {
    const p = join('Rush');
    const b = house(p);
    tick();
    const mine = () => [...game.world.pieces.values()].filter((q) => q.owner === p.id).length;
    b.prod = 0.99;
    b.bubbles = [1];
    const n = mine();
    expect(game.popBubble(p.id, b.id, 0)).toBe(true);
    expect(mine()).toBe(n + 1);
    expect(b.prod).toBe(0);
  });

  it('a building that stops working drops its bubbles', () => {
    const p = join('Idle');
    const b = house(p);
    tick();
    b.bubbles = [0, 0];
    game.setPaused(p.id, b.id, true);
    tick();
    expect(b.bubbles).toBeUndefined();
  });

  it('a building waiting for room keeps growing bubbles, and pops bank its next piece', () => {
    const p = join('Crowd');
    const b = house(p);
    tick();
    const k = game.kingsOf(p.id)[0];
    const pawns = () => [...game.world.pieces.values()].filter((q) => q.owner === p.id && q.kind === 'P').length;
    // Fill the pawns' room (and whatever the chapter still asks for) until the house pauses.
    for (let i = 0; i < 80 && b.blocked !== 'pop-cap'; i++) {
      const at = game.world.nearestFree(k.x - 6, k.y - 6, 14)!;
      game.addPiece({ id: game.world.id(), owner: p.id, kind: 'P', x: at[0], y: at[1], facing: 2, state: 'idle' });
      if (pawns() >= game.popCaps(p.id).P) { b.prod = 0; tick(); }
    }
    expect(b.blocked).toBe('pop-cap');
    for (let t = 0; t < 12 && !b.bubbles?.length; t++) tick(bubbleEveryMs(b.cycleMs!) * 1.3);
    expect(b.bubbles?.length).toBeGreaterThan(0);
    // Pops fill progress up to one whole piece, and nothing is raised while there's no room.
    const n = pawns();
    b.bubbles = [1, 1];
    game.popBubble(p.id, b.id, 0); game.popBubble(p.id, b.id, 0);
    expect(b.prod).toBe(1);
    expect(pawns()).toBe(n);
    // Room opens: the banked pawn appears on the next tick.
    const one = [...game.world.pieces.values()].find((q) => q.owner === p.id && q.kind === 'P' && !q.kit && q.id !== k.id)!;
    game.removePiece(one.id);
    tick();
    expect(pawns()).toBe(n);
  });

  it('popping every bubble about doubles production', () => {
    const cycle = 60_000;
    expect(bubbleWorth(cycle, false) * (cycle / bubbleEveryMs(cycle))).toBeCloseTo(1, 5);
    expect(bubbleWorth(cycle, true)).toBeCloseTo(0.8, 5);
  });
});
