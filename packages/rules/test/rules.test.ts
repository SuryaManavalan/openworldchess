import { describe, expect, it } from 'vitest';
import { assemble, BattleGame, bestGaitMove, findPath, gaitMoves, glicko1, glicko2, rdAfter, newGroup, pickSet, stepGroup, type GroupPiece } from '../src/index.ts';

const open = () => true;

describe('gaits', () => {
  it('knights jump over blocked squares but need a free landing', () => {
    const free = (x: number, y: number) => !(x === 0 && y === 1) && !(x === 1 && y === 2);
    const moves = gaitMoves({ kind: 'N', x: 0, y: 0, facing: 1 }, free);
    expect(moves.map((m) => `${m.x},${m.y}`)).not.toContain('1,2');
    expect(moves.map((m) => `${m.x},${m.y}`)).toContain('2,1');
  });

  it('sliders stop before obstacles and go at most 8', () => {
    const free = (x: number, y: number) => !(x === 3 && y === 0);
    const q = gaitMoves({ kind: 'R', x: 0, y: 0, facing: 1 }, free).filter((m) => m.y === 0 && m.x > 0);
    expect(q.map((m) => m.x)).toEqual([1, 2]);
    const far = gaitMoves({ kind: 'Q', x: 0, y: 0, facing: 1 }, open).filter((m) => m.y === 0 && m.x > 0);
    expect(Math.max(...far.map((m) => m.x))).toBe(8);
  });

  it('pawns only step forward, and turning costs a move', () => {
    const moves = gaitMoves({ kind: 'P', x: 0, y: 0, facing: 1 }, open);
    expect(moves.filter((m) => !m.turn).map((m) => [m.x, m.y])).toEqual([[1, 0]]);
    expect(moves.filter((m) => m.turn).map((m) => m.facing).sort()).toEqual([0, 2]);
    // To go north, a pawn facing east turns first.
    const m = bestGaitMove({ kind: 'P', x: 0, y: 0, facing: 1 }, 0, -5, open);
    expect(m?.turn).toBe(true);
    expect(m?.facing).toBe(0);
  });

  it('bishops never leave their square color', () => {
    for (const m of gaitMoves({ kind: 'B', x: 2, y: 2, facing: 0 }, open)) expect((m.x + m.y) & 1).toBe(0);
  });
});

describe('pathfinding', () => {
  it('walks around a wall', () => {
    const free = (x: number, y: number) => !(x === 5 && y > -5 && y < 5);
    const path = findPath(0, 0, 10, 0, free);
    expect(path.at(-1)).toEqual([10, 0]);
    expect(path.every(([x, y]) => free(x, y))).toBe(true);
  });
});

describe('ratings (Glicko-1, as chess.com rates)', () => {
  const settled = { rating: 1200, rd: 60 };
  it('a new player moves fast, a settled one slowly', () => {
    expect(Math.round(glicko1({ rating: 1200, rd: 350 }, settled, 1).rating - 1200)).toBe(175);
    expect(Math.round(glicko1({ rating: 1200, rd: 60 }, settled, 1).rating - 1200)).toBe(10);
    expect(Math.round(glicko1({ rating: 1200, rd: 60 }, settled, 0).rating - 1200)).toBe(-10);
  });
  it('the deviation shrinks with games and grows back with time away', () => {
    let me = { rating: 1200, rd: 350 };
    for (let i = 0; i < 10; i++) me = glicko1(me, settled, 0.5);
    expect(me.rd).toBeGreaterThan(95); expect(me.rd).toBeLessThan(120);
    expect(rdAfter(60, 0)).toBe(60);
    expect(rdAfter(60, 365)).toBeCloseTo(350, 0);
    expect(rdAfter(60, 30)).toBeGreaterThan(100);
  });
});

describe('group movement', () => {
  function simulate(pieces: GroupPiece[], to: [number, number], blocked = (_x: number, _y: number) => false, turns = 200) {
    const occ = new Map(pieces.map((p) => [`${p.x},${p.y}`, p.id]));
    const king = pieces.find((p) => p.kind === 'K')!;
    const g = newGroup(1, pieces, findPath(king.x, king.y, to[0], to[1], (x, y) => !blocked(x, y)), [king.x, king.y]);
    let t = 0;
    for (; t < turns && !g.done; t++)
      stepGroup(g, pieces, {
        free: (p, x, y) => !blocked(x, y) && (!occ.has(`${x},${y}`) || occ.get(`${x},${y}`) === p.id),
      }, (p, m) => { occ.delete(`${p.x},${p.y}`); p.x = m.x; p.y = m.y; p.facing = m.facing; occ.set(`${p.x},${p.y}`, p.id); });
    return { g, t };
  }

  it('a mixed troop arrives in formation, paced by its pawns', () => {
    const pieces: GroupPiece[] = [
      { id: 1, kind: 'K', x: 0, y: 0, facing: 1 }, { id: 2, kind: 'Q', x: 0, y: 1, facing: 1 },
      { id: 3, kind: 'N', x: 1, y: 1, facing: 1 }, { id: 4, kind: 'P', x: 1, y: 0, facing: 1 }, { id: 5, kind: 'P', x: 1, y: -1, facing: 1 },
    ];
    const { g, t } = simulate(pieces, [30, 0]);
    expect(g.done).toBe(true);
    const king = pieces[0];
    expect(Math.abs(king.x - 30) + Math.abs(king.y)).toBeLessThanOrEqual(1);
    // pawns lead the line, facing the heading (east)
    for (const p of pieces.filter((p) => p.kind === 'P')) { expect(p.x).toBeGreaterThan(king.x - 1); expect(p.facing).toBe(1); }
    expect(t).toBeGreaterThan(25); // no faster than the pawns allow
  });

  it('a pawn trapped in a pocket backs out and rejoins the troop', () => {
    // A U-shaped wall around the pawn, open only to the west (away from where the troop is going).
    const wall = new Set<string>();
    for (let y = -3; y <= 3; y++) wall.add(`6,${y}`);
    for (let x = 2; x <= 6; x++) { wall.add(`${x},-3`); wall.add(`${x},3`); }
    const blocked = (x: number, y: number) => wall.has(`${x},${y}`);
    const pieces: GroupPiece[] = [
      { id: 1, kind: 'K', x: 0, y: 5, facing: 1 }, { id: 2, kind: 'P', x: 1, y: 5, facing: 1 },
      { id: 3, kind: 'P', x: 4, y: 0, facing: 1 }, // inside the pocket, facing the closed end
    ];
    const occ = new Map(pieces.map((p) => [`${p.x},${p.y}`, p.id]));
    const g = newGroup(1, pieces, findPath(0, 5, 24, 5, (x, y) => !blocked(x, y)), [0, 5]);
    for (let t = 0; t < 300 && !g.done; t++)
      stepGroup(g, pieces, {
        free: (p, x, y) => !blocked(x, y) && (!occ.has(`${x},${y}`) || occ.get(`${x},${y}`) === p.id),
        walkable: (x, y) => !blocked(x, y),
        route: (p, tx, ty) => findPath(p.x, p.y, tx, ty, (x, y) => !blocked(x, y), 4000, { orth: p.kind === 'P' }),
      }, (p, m) => { occ.delete(`${p.x},${p.y}`); p.x = m.x; p.y = m.y; p.facing = m.facing; occ.set(`${p.x},${p.y}`, p.id); });
    expect(g.done).toBe(true);
    const [king, , trapped] = pieces;
    expect(king.x).toBeGreaterThan(20);
    expect(Math.max(Math.abs(trapped.x - king.x), Math.abs(trapped.y - king.y))).toBeLessThanOrEqual(3);
  });

  it('war elephants knock down trees so the troop can march through a wood', () => {
    // A solid band of trees across the way: no path around it at all.
    const trees = new Set<string>();
    for (let x = 8; x <= 10; x++) for (let y = -30; y <= 30; y++) trees.add(`${x},${y}`);
    const blocked = (x: number, y: number) => trees.has(`${x},${y}`);
    const pieces: GroupPiece[] = [{ id: 1, kind: 'K', x: 0, y: 0, facing: 1 }, { id: 2, kind: 'R', x: 1, y: 1, facing: 1 }, { id: 3, kind: 'P', x: 1, y: 0, facing: 1 }];
    const occ = new Map(pieces.map((p) => [`${p.x},${p.y}`, p.id]));
    // The troop's road goes through the wood (the elephant will clear it), at a cost per tree.
    const g = newGroup(1, pieces, findPath(0, 0, 18, 0, () => true, 6000, { cost: (x, y) => (blocked(x, y) ? 8 : 0) }), [0, 0]);
    let felled = 0;
    for (let t = 0; t < 400 && !g.done; t++)
      stepGroup(g, pieces, {
        free: (p, x, y) => !blocked(x, y) && (!occ.has(`${x},${y}`) || occ.get(`${x},${y}`) === p.id),
        walkable: (x, y) => !blocked(x, y),
        tree: (x, y) => trees.has(`${x},${y}`),
        fell: (p, x, y) => { if (p.kind !== 'R' || !trees.delete(`${x},${y}`)) return false; felled++; return true; },
      }, (p, m) => { occ.delete(`${p.x},${p.y}`); p.x = m.x; p.y = m.y; p.facing = m.facing; occ.set(`${p.x},${p.y}`, p.id); });
    expect(g.done).toBe(true);
    expect(pieces[0].x).toBeGreaterThanOrEqual(16);
    expect(felled).toBeGreaterThanOrEqual(3);
    expect(pieces.every((p) => Math.abs(p.x - pieces[0].x) <= 3)).toBe(true);
  });

  it('a troop crosses a river at a ford', () => {
    const river = (x: number, y: number) => x >= 10 && x <= 12 && y !== 6;
    const pieces: GroupPiece[] = [{ id: 1, kind: 'K', x: 0, y: 0, facing: 1 }, { id: 2, kind: 'N', x: 0, y: 1, facing: 1 }, { id: 3, kind: 'R', x: 1, y: 1, facing: 1 }];
    const { g } = simulate(pieces, [20, 0], river);
    expect(g.done).toBe(true);
    expect(pieces[0].x).toBeGreaterThan(15);
  });
});

describe('battles', () => {
  const set = (kinds: string, x0: number) => kinds.split('').map((k, i) => ({ id: x0 + i, kind: k as 'K', x: x0 + i, y: 0 }));

  it('assembles partial sets with castling rights only where legal', () => {
    const white = set('KQRRBBNNPPPPPPPP', 100);
    const black = set('KPPPP', 200);
    const a = assemble(white, black);
    expect(a.fen).toMatch(/ w KQ - 0 1$/);
    expect(a.pieceMap.e1).toBe(100);
    expect(a.pieceMap.e8).toBe(200);
    expect(Object.keys(a.pieceMap).filter((s) => s[1] === '7').sort()).toEqual(['c7', 'd7', 'e7', 'f7']);
    new BattleGame(a.fen, a.pieceMap); // valid FEN
  });

  it('keeps bishop square colors', () => {
    const w = [{ id: 1, kind: 'K' as const, x: 0, y: 0 }, { id: 2, kind: 'B' as const, x: 0, y: 0 }]; // light world square
    const b = [{ id: 3, kind: 'K' as const, x: 0, y: 0 }, { id: 4, kind: 'B' as const, x: 1, y: 0 }]; // dark
    const a = assemble(w, b);
    expect(a.pieceMap.f1).toBe(2);
    expect(a.pieceMap.f8).toBe(4);
  });

  it('picks the nearest pieces up to one set, the rest are reserves', () => {
    const cands = [{ id: 1, kind: 'K' as const, x: 0, y: 0 }, ...Array.from({ length: 12 }, (_, i) => ({ id: 10 + i, kind: 'P' as const, x: i, y: 0 })), { id: 30, kind: 'Q' as const, x: 1, y: 1 }, { id: 31, kind: 'Q' as const, x: 9, y: 9 }];
    const { set: s, reserves } = pickSet(1, cands, 0, 0);
    expect(s.filter((p) => p.kind === 'P').length).toBe(8);
    expect(s.find((p) => p.kind === 'Q')!.id).toBe(30);
    expect(reserves.length).toBe(5);
  });

  it('tracks world pieces through captures and promotion', () => {
    const g = new BattleGame('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', { e8: 9, a7: 5, e1: 1 });
    g.start(0);
    const r = g.move('a7a8q', 1000);
    expect(r.ok).toBe(true);
    expect(r.promoted).toEqual({ id: 5, to: 'Q' });
    expect(g.pieceMap.a8).toBe(5);
    expect(g.clocks.white).toBe(300_000 - 1000 + 3000);
  });

  it('en passant captures the right world piece', () => {
    // White pawn on e5; black plays d7-d5, and white takes en passant on d6.
    const g = new BattleGame('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1', { e8: 9, d7: 7, e5: 5, e1: 1 });
    g.start(0);
    expect(g.move('d7d5', 1000).ok).toBe(true);
    const r = g.move('e5d6', 2000);
    expect(r.ok).toBe(true);
    expect(r.captured).toBe(7);
    expect(g.killed).toContain(7);
    expect(g.pieceMap.d6).toBe(5);
    expect(g.pieceMap.d5).toBeUndefined();
  });

  it('flagging against a bare king is a draw', () => {
    const g = new BattleGame('4k3/8/8/8/8/8/8/4K2Q w - - 0 1', { e8: 2, e1: 1, h1: 3 });
    g.start(0);
    g.move('h1h2', 1000);
    g.flag(400_000); // black (bare king) runs out: white can mate → white wins
    expect(g.result).toBe('white');
    const g2 = new BattleGame('4k3/8/8/8/8/8/8/4K2Q b - - 0 1', { e8: 2, e1: 1, h1: 3 });
    g2.start(0);
    g2.flag(400_000); // black to move flags... black loses
    expect(g2.result).toBe('white');
  });
});

describe('glicko', () => {
  it('moves ratings the right way', () => {
    const a = glicko2({ rating: 1500, rd: 200, vol: 0.06 }, { rating: 1400, rd: 30, vol: 0.06 }, 1);
    expect(a.rating).toBeGreaterThan(1500);
    const b = glicko2({ rating: 1500, rd: 200, vol: 0.06 }, { rating: 1400, rd: 30, vol: 0.06 }, 0);
    expect(b.rating).toBeLessThan(1500);
  });
});
