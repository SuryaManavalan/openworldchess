// Group (troop) movement: formation, lead point and the waiting rule
// (movement.md §4). Pure: the caller supplies occupancy and applies moves.
import type { Facing, PieceKind } from '@owc/shared';
import { FACING_DELTA } from '@owc/shared';
import { bestGaitMove, dist, KIND_SPEED, type FreeFn, type GaitMove } from './gaits.ts';

export interface GroupPiece {
  id: number;
  kind: PieceKind;
  x: number;
  y: number;
  facing: Facing;
}

export interface GroupState {
  id: number;
  /** Squares the lead point walks, computed by findPath. */
  path: [number, number][];
  pathIdx: number;
  lead: [number, number];
  heading: Facing;
  /** Slot per piece in the heading frame: [forward, right]. */
  slots: Record<number, [number, number]>;
  /** Turns each piece has failed to get closer. */
  stuck: Record<number, number>;
  /**
   * Each piece's best distance to its slot since the lead last moved. Progress means
   * beating it: a piece hopping back and forth (a slot in a river) never does, so it
   * counts as stuck and the troop moves on.
   */
  best?: Record<number, number>;
  turns: number;
  done: boolean;
}

/** Back-rank order outward from the king, like a chess line (movement.md §4). */
const BACK_ORDER: [PieceKind, number][] = [['K', 0], ['Q', -1], ['B', 1], ['B', -2], ['N', 2], ['N', -3], ['R', 3], ['R', -4]];
const PAWN_ORDER = [0, -1, 1, -2, 2, -3, 3, -4];

/**
 * Chess-line formation: pieces on the back rank in chess order around the
 * king, pawns one rank ahead facing the heading, extras in reserve rows.
 */
export function formationSlots(pieces: GroupPiece[]): Record<number, [number, number]> {
  const slots: Record<number, [number, number]> = {};
  const pool = [...pieces].sort((a, b) => a.id - b.id);
  const take = (kind: PieceKind) => {
    const i = pool.findIndex((p) => p.kind === kind);
    return i < 0 ? null : pool.splice(i, 1)[0];
  };
  // With no king, the first non-pawn (or failing that, a pawn) takes the center.
  if (!pool.some((p) => p.kind === 'K')) {
    const center = pool.find((q) => q.kind !== 'P') ?? pool[0];
    if (center) { pool.splice(pool.indexOf(center), 1); slots[center.id] = [0, 0]; }
  }
  for (const [kind, r] of BACK_ORDER) {
    const p = take(kind);
    if (p) slots[p.id] = [0, r];
  }
  for (const r of PAWN_ORDER) {
    const p = take('P');
    if (p) slots[p.id] = [1, r];
  }
  // Reserves fill rows behind, centered.
  let row = -1, col = 0;
  for (const p of pool) {
    slots[p.id] = [row, PAWN_ORDER[col]];
    if (++col >= PAWN_ORDER.length) { col = 0; row--; }
  }
  return slots;
}

/** World square of a slot given the lead point and heading. */
export function slotWorld(lead: [number, number], heading: Facing, slot: [number, number]): [number, number] {
  const [fx, fy] = FACING_DELTA[heading];
  const rx = -fy, ry = fx; // right-hand vector
  return [lead[0] + slot[0] * fx + slot[1] * rx, lead[1] + slot[0] * fy + slot[1] * ry];
}

/** Heading of a path segment, snapped to N/E/S/W. */
export function headingOf(dx: number, dy: number, prev: Facing): Facing {
  if (dx === 0 && dy === 0) return prev;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : 3;
  if (Math.abs(dy) > Math.abs(dx)) return dy > 0 ? 2 : 0;
  return prev;
}

export function newGroup(id: number, pieces: GroupPiece[], path: [number, number][], lead: [number, number]): GroupState {
  const end = path.length ? path[path.length - 1] : lead;
  const heading = headingOf(end[0] - lead[0], end[1] - lead[1], pieces[0]?.facing ?? 2);
  return { id, path, pathIdx: 0, lead, heading, slots: formationSlots(pieces), stuck: {}, turns: 0, done: false };
}

export interface StepContext {
  /** Is (x, y) free for this piece to enter right now? (terrain, buildings, pieces, reach) */
  free: (piece: GroupPiece, x: number, y: number) => boolean;
  walkable?: (x: number, y: number) => boolean;
  /** Off-screen groups search less (performance.md §5): nobody sees a slightly less tidy march. */
  lite?: boolean;
}

/**
 * Advance a group by one world turn. Returns the moves to apply, in order.
 * The caller must apply each move before the next piece's `free` check
 * (so the context sees updated occupancy); `apply` does that.
 */
export function stepGroup(g: GroupState, pieces: GroupPiece[], ctx: StepContext, apply: (p: GroupPiece, m: GaitMove) => void): GaitMove[] {
  g.turns++;
  const target = (p: GroupPiece) => slotWorld(g.lead, g.heading, g.slots[p.id] ?? [0, 0]);

  // 1. Has everyone caught up with their slot (or given up trying)? Then the lead advances.
  const caughtUp = pieces.every((p) => {
    const [tx, ty] = target(p);
    return dist(p.x, p.y, tx, ty) <= 2.5 || (g.stuck[p.id] ?? 0) >= 3;
  });
  if (caughtUp && g.pathIdx < g.path.length) {
    const speed = Math.min(...pieces.map((p) => KIND_SPEED[p.kind]));
    const next = Math.min(g.path.length, g.pathIdx + speed);
    const [nx, ny] = g.path[next - 1];
    // Heading follows the path a few squares ahead, so turns happen once, not per wiggle.
    const look = g.path[Math.min(g.path.length - 1, next + 3)];
    g.heading = headingOf(look[0] - g.lead[0], look[1] - g.lead[1], g.heading);
    g.lead = [nx, ny];
    g.pathIdx = next;
    g.best = {};
  }

  // 2. Each piece makes its best gait move toward its slot. Front pieces go first.
  const [fx, fy] = FACING_DELTA[g.heading];
  const order = [...pieces].sort((a, b) => (b.x * fx + b.y * fy) - (a.x * fx + a.y * fy) || a.id - b.id);
  const moves: GaitMove[] = [];
  let anyProgress = false;
  const best = (g.best ??= {});
  for (const p of order) {
    const [tx, ty] = target(p);
    const before = dist(p.x, p.y, tx, ty);
    best[p.id] ??= before;
    // A piece stuck for a while looks a little further for a way around.
    // (Every third turn: a boxed-in piece rarely finds a new way out every turn, and searching is the costliest thing we do.)
    const stuck = g.stuck[p.id] ?? 0;
    const m = stuck >= 3 ? (g.turns % (ctx.lite ? 6 : 3) === 0 ? bestGaitMove(p, tx, ty, (x, y) => ctx.free(p, x, y), ctx.lite ? 240 : 500, ctx.lite ? 12 : 16) : null) : bestGaitMove(p, tx, ty, (x, y) => ctx.free(p, x, y), ctx.lite ? 60 : 240, ctx.lite ? 8 : 14);
    if (m) {
      apply(p, m);
      moves.push(m);
      const after = dist(p.x, p.y, tx, ty);
      if (after < best[p.id] - 1e-9) { best[p.id] = after; g.stuck[p.id] = 0; anyProgress = true; }
      else if (m.turn && after < before + 1e-9) { anyProgress = true; g.stuck[p.id] = (g.stuck[p.id] ?? 0) + (p.kind === 'P' ? 0 : 1); }
      else g.stuck[p.id] = (g.stuck[p.id] ?? 0) + 1;
    } else if (before > 0) g.stuck[p.id] = (g.stuck[p.id] ?? 0) + 1;
    else g.stuck[p.id] = 0;
  }

  // 3. Done when the lead has arrived and nobody can get any closer.
  if (g.pathIdx >= g.path.length && !anyProgress) {
    const settled = pieces.every((p) => {
      const [tx, ty] = target(p);
      return dist(p.x, p.y, tx, ty) === 0 || (g.stuck[p.id] ?? 0) >= 2;
    });
    if (settled) g.done = true;
  }
  if (g.turns > 8000) g.done = true;
  return moves;
}
