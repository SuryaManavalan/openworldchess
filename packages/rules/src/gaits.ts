// Piece gaits in the open world (movement.md §2): each piece moves once per
// world turn the way it moves in chess.
import type { Facing, PieceKind } from '@owc/shared';
import { FACING_DELTA } from '@owc/shared';

export interface GaitState {
  kind: PieceKind;
  x: number;
  y: number;
  facing: Facing;
}

export interface GaitMove {
  x: number;
  y: number;
  facing: Facing;
  /** A pawn turning in place: no square change. */
  turn?: boolean;
}

export type FreeFn = (x: number, y: number) => boolean;

const KING_DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT_JUMPS: [number, number][] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
export const SLIDE_MAX = 8;

/** The facing that best matches a movement delta (sprites flip by it). */
export function facingOf(dx: number, dy: number, prev: Facing): Facing {
  if (dx === 0 && dy === 0) return prev;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 1 : 3;
  return dy > 0 ? 2 : 0;
}

/** Every move a piece can make this turn from its current state. */
export function gaitMoves(p: GaitState, free: FreeFn): GaitMove[] {
  const out: GaitMove[] = [];
  const slide = (dirs: [number, number][]) => {
    for (const [dx, dy] of dirs)
      for (let s = 1; s <= SLIDE_MAX; s++) {
        const x = p.x + dx * s, y = p.y + dy * s;
        if (!free(x, y)) break;
        out.push({ x, y, facing: facingOf(dx, dy, p.facing) });
      }
  };
  switch (p.kind) {
    case 'K':
      for (const [dx, dy] of KING_DIRS) if (free(p.x + dx, p.y + dy)) out.push({ x: p.x + dx, y: p.y + dy, facing: facingOf(dx, dy, p.facing) });
      break;
    case 'Q': slide(KING_DIRS); break;
    case 'R': slide(ROOK_DIRS); break;
    case 'B': slide(BISHOP_DIRS); break;
    case 'N':
      // Knights jump: only the landing square matters (they cross 1-square rivers).
      for (const [dx, dy] of KNIGHT_JUMPS) if (free(p.x + dx, p.y + dy)) out.push({ x: p.x + dx, y: p.y + dy, facing: facingOf(dx, dy, p.facing) });
      break;
    case 'P': {
      const [dx, dy] = FACING_DELTA[p.facing];
      if (free(p.x + dx, p.y + dy)) out.push({ x: p.x + dx, y: p.y + dy, facing: p.facing });
      // Turning 90° costs a whole turn.
      out.push({ x: p.x, y: p.y, facing: ((p.facing + 1) % 4) as Facing, turn: true });
      out.push({ x: p.x, y: p.y, facing: ((p.facing + 3) % 4) as Facing, turn: true });
      break;
    }
  }
  return out;
}

/** A distance that prefers straight lines, used to rank moves. */
export const dist = (ax: number, ay: number, bx: number, by: number) => {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return Math.max(dx, dy) + 0.4 * Math.min(dx, dy);
};

/**
 * Best-first search over the piece's own gait graph, to find the one move that
 * gets it closest to (tx, ty). Returns null when no move improves on standing
 * still. Bounded by `budget` expansions and a window around the piece.
 */
export function bestGaitMove(p: GaitState, tx: number, ty: number, free: FreeFn, budget = 240, window = 14): GaitMove | null {
  const h0 = dist(p.x, p.y, tx, ty);
  if (h0 === 0) return null;
  type Node = { s: GaitState; first: GaitMove | null; g: number; h: number };
  const seen = new Set<string>();
  const sk = (s: GaitState) => `${s.x},${s.y},${p.kind === 'P' ? s.facing : 0}`;
  const open: Node[] = [{ s: p, first: null, g: 0, h: h0 }];
  seen.add(sk(p));
  let best: Node | null = null;
  const inWindow: FreeFn = (x, y) => Math.abs(x - p.x) <= window && Math.abs(y - p.y) <= window && free(x, y);
  for (let n = 0; n < budget && open.length; n++) {
    // pop lowest f = g*0.7 + h (slightly greedy)
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].g * 0.7 + open[i].h < open[bi].g * 0.7 + open[bi].h) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.first && (!best || cur.h < best.h - 1e-9 || (Math.abs(cur.h - best.h) < 1e-9 && cur.g < best.g))) best = cur;
    if (cur.h === 0) break;
    if (cur.g >= 6) continue;
    for (const m of gaitMoves(cur.s, inWindow)) {
      const s: GaitState = { kind: p.kind, x: m.x, y: m.y, facing: m.facing };
      const k = sk(s);
      if (seen.has(k)) continue;
      seen.add(k);
      open.push({ s, first: cur.first ?? m, g: cur.g + 1, h: dist(m.x, m.y, tx, ty) });
    }
  }
  if (!best || best.h >= h0 - 1e-9) {
    // A pawn may need to turn before it can make progress: allow the turn if
    // the search found that its best route starts with one.
    return best && best.first?.turn && best.h < h0 ? best.first : null;
  }
  return best.first;
}

/** Typical squares per turn, used to pace a group's lead point. */
export const KIND_SPEED: Record<PieceKind, number> = { P: 1, K: 1, N: 2, B: 3, R: 3, Q: 3 };
