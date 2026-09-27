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

/** Progress that counts as a full step for each kind: a greedy move this good needs no search. */
const FULL_STEP: Record<PieceKind, number> = { K: 1, P: 1, N: 2, B: 2, R: 3, Q: 3 };

/**
 * Best-first search over the piece's own gait graph, to find the one move that
 * gets it closest to (tx, ty). Returns null when no move improves on standing
 * still. Bounded by `budget` expansions and a window around the piece.
 *
 * This runs for every moving piece every turn, so it's the hottest code in the
 * game (performance.md §4). In the open, the best single move is almost always
 * the answer: take it without searching. Only when that makes less than a full
 * step of progress (an obstacle, a pawn that must turn) do we search, with a
 * binary heap and numeric keys.
 */
export function bestGaitMove(p: GaitState, tx: number, ty: number, free: FreeFn, budget = 240, window = 14): GaitMove | null {
  const h0 = dist(p.x, p.y, tx, ty);
  if (h0 === 0) return null;
  const inWindow: FreeFn = (x, y) => Math.abs(x - p.x) <= window && Math.abs(y - p.y) <= window && free(x, y);
  // Greedy fast path.
  const first = gaitMoves(p, inWindow);
  let greedy: GaitMove | null = null, gh = Infinity;
  for (const m of first) {
    if (m.turn) continue;
    const h = dist(m.x, m.y, tx, ty);
    if (h < gh) { gh = h; greedy = m; }
  }
  if (greedy && h0 - gh >= Math.min(h0, FULL_STEP[p.kind]) - 1e-9) return greedy;
  if (budget <= 0) return greedy && gh < h0 ? greedy : null;
  // Right next to the target and boxed in: waiting beats searching (pawns may still need to turn).
  if (h0 <= 1.5 && p.kind !== 'P') return greedy && gh < h0 ? greedy : null;

  // Search. Keys pack the offset from the start (and a pawn's facing) into a number.
  const pawn = p.kind === 'P';
  const sk = (x: number, y: number, f: number) => ((x - p.x + 1024) * 2048 + (y - p.y + 1024)) * 4 + (pawn ? f : 0);
  type Node = { x: number; y: number; facing: Facing; first: GaitMove | null; g: number; h: number; f: number };
  const seen = new Set<number>([sk(p.x, p.y, p.facing)]);
  const heap: Node[] = [];
  const push = (nd: Node) => {
    heap.push(nd);
    let i = heap.length - 1;
    while (i > 0) { const q = (i - 1) >> 1; if (heap[q].f <= nd.f) break; heap[i] = heap[q]; i = q; }
    heap[i] = nd;
  };
  const pop = (): Node => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i, mf = last.f;
        if (l < heap.length && heap[l].f < mf) { m = l; mf = heap[l].f; }
        if (r < heap.length && heap[r].f < mf) m = r;
        if (m === i) break;
        heap[i] = heap[m]; i = m;
      }
      heap[i] = last;
    }
    return top;
  };
  // Seed with the moves already generated.
  for (const m of first) {
    const k = sk(m.x, m.y, m.facing);
    if (seen.has(k)) continue;
    seen.add(k);
    const h = dist(m.x, m.y, tx, ty);
    push({ x: m.x, y: m.y, facing: m.facing, first: m, g: 1, h, f: 0.7 + h });
  }
  let best: Node | null = null;
  const st: GaitState = { kind: p.kind, x: 0, y: 0, facing: p.facing };
  for (let n = 0; n < budget && heap.length; n++) {
    const cur = pop();
    if (!best || cur.h < best.h - 1e-9 || (Math.abs(cur.h - best.h) < 1e-9 && cur.g < best.g)) best = cur;
    if (cur.h === 0) break;
    if (cur.g >= 6) continue;
    st.x = cur.x; st.y = cur.y; st.facing = cur.facing;
    for (const m of gaitMoves(st, inWindow)) {
      const k = sk(m.x, m.y, m.facing);
      if (seen.has(k)) continue;
      seen.add(k);
      const h = dist(m.x, m.y, tx, ty), g = cur.g + 1;
      push({ x: m.x, y: m.y, facing: m.facing, first: cur.first, g, h, f: g * 0.7 + h });
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
