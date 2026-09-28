// Group (troop) movement (movement.md §4). Pure: the caller supplies occupancy
// and applies moves.
//
// Marching: pieces walk the lead's own path in a column three wide, each at its
// place in line, chasing a point a few steps ahead of where it has got to. The
// path is walkable (the lead planned it), so nobody needs its own route and
// nobody gets stranded behind a wood: if the lead got through, they can. The
// lead waits only when the column's tail falls too far behind.
//
// Arriving: the column fans out into the chess-line formation around the lead.
//
// War elephants go ahead and knock down trees on the path (movement.md §4.3).
import type { Facing, PieceKind } from '@owc/shared';
import { FACING_DELTA } from '@owc/shared';
import { bestGaitMove, dist, facingOf, KIND_SPEED, type GaitMove } from './gaits.ts';

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
  /** Where the lead started (the column's index -1). */
  origin: [number, number];
  heading: Facing;
  /** Slot per piece in the heading frame: [forward, right], taken on arrival. */
  slots: Record<number, [number, number]>;
  /** Each piece's place in the marching column: [row from the front, side (-1 left, 0, 1 right)]. */
  line: Record<number, [number, number]>;
  /** A pawn troop takes two turns over a diagonal step of the path (pawns can't step diagonally). */
  diagHold?: boolean;
  /** How far along the path each piece has got (path index; -1 = the start). */
  along: Record<number, number>;
  /** Turns each piece has failed to make any headway. */
  stuck: Record<number, number>;
  /** Each piece's best distance to its current aim (keyed piece:square), since the lead last moved. */
  best?: Record<string, number>;
  /** Routes for pieces cut off from the path (they start across a river, or got pushed aside). */
  routes?: Record<number, Route>;
  routeTried?: Record<number, number>;
  /** The turn the lead reached the end of its path (the troop settles for at most 20 turns after). */
  arrivedAt?: number;
  /** Turns the lead has waited for the column's tail since it last moved. */
  waitTurns?: number;
  /** Turns the lead has waited at a standing tree for the elephants to clear it. */
  treeWait?: number;
  /** The elephants couldn't clear the way: the caller should re-plan around the trees. */
  avoidTrees?: boolean;
  turns: number;
  done: boolean;
}

/** A piece's own walking route, over terrain (ignoring pieces). */
export interface Route { pts: [number, number][]; i: number; to: [number, number]; fails: number }

/** Pieces side by side in the marching column. */
const WIDTH = 3;
/** Turns a piece may go without any headway before the troop stops waiting for it. */
export const ABANDON = 14;
/** The lead waits at most this many turns in a row for the column's tail. */
export const MAX_WAIT = 6;
/** How far ahead along the path a piece aims: close for pawns (they can't cut corners), further for the rest. */
const LOOK: Record<PieceKind, number> = { P: 2, K: 2, N: 3, B: 3, R: 3, Q: 3 };
/** How far ahead on the lead's path elephants look for trees to clear. */
const CLEAR_AHEAD = 12;
/** Settling into formation on arrival takes at most this many turns. */
const SETTLE_TURNS = 20;

/** Back-rank order outward from the king, like a chess line (movement.md §4). */
const BACK_ORDER: [PieceKind, number][] = [['K', 0], ['Q', -1], ['B', 1], ['B', -2], ['N', 2], ['N', -3], ['R', 3], ['R', -4]];
const PAWN_ORDER = [0, -1, 1, -2, 2, -3, 3, -4];
const DIRS4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

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

/**
 * The marching column, built from the formation so arriving is just closing up:
 * the pawn rank in front, the back rank behind, reserves last; left stays left.
 */
function marchingLine(pieces: GroupPiece[], slots: Record<number, [number, number]>): Record<number, [number, number]> {
  const ranks = new Map<number, GroupPiece[]>();
  for (const p of pieces) {
    const f = slots[p.id]?.[0] ?? 0;
    if (!ranks.has(f)) ranks.set(f, []);
    ranks.get(f)!.push(p);
  }
  const line: Record<number, [number, number]> = {};
  let row = 0;
  for (const [, list] of [...ranks].sort((a, b) => b[0] - a[0])) {
    list.sort((a, b) => (slots[a.id]?.[1] ?? 0) - (slots[b.id]?.[1] ?? 0) || a.id - b.id);
    for (let i = 0; i < list.length; i += WIDTH) {
      const chunk = list.slice(i, i + WIDTH);
      const sides = chunk.length === 1 ? [0] : chunk.length === 2 ? [-1, 1] : [-1, 0, 1];
      chunk.forEach((p, j) => (line[p.id] = [row, sides[j]]));
      row++;
    }
  }
  return line;
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
  const along: Record<number, number> = {};
  for (const p of pieces) along[p.id] = -1;
  const slots = formationSlots(pieces);
  return { id, path, pathIdx: 0, lead, origin: lead, heading, slots, line: marchingLine(pieces, slots), along, stuck: {}, turns: 0, done: false };
}

export interface StepContext {
  /** Is (x, y) free for this piece to enter right now? (terrain, buildings, pieces, reach) */
  free: (piece: GroupPiece, x: number, y: number) => boolean;
  walkable?: (x: number, y: number) => boolean;
  /** Off-screen groups search less (performance.md §5): nobody sees a slightly less tidy march. */
  lite?: boolean;
  /**
   * A walking route for this piece to (tx, ty) over terrain, ignoring pieces, or
   * null when none can be planned this turn (the caller keeps a budget).
   */
  route?: (piece: GroupPiece, tx: number, ty: number) => [number, number][] | null;
  /** A standing tree an elephant could knock down at (x, y)? */
  tree?: (x: number, y: number) => boolean;
  /** The elephant knocks down the tree at (x, y). True if it did. */
  fell?: (piece: GroupPiece, x: number, y: number) => boolean;
}

/**
 * Advance a group by one world turn. Returns the moves to apply, in order.
 * The caller must apply each move before the next piece's `free` check
 * (so the context sees updated occupancy); `apply` does that.
 */
export function stepGroup(g: GroupState, pieces: GroupPiece[], ctx: StepContext, apply: (p: GroupPiece, m: GaitMove) => void): GaitMove[] {
  g.turns++;
  // Old saves: groups from before the column march.
  g.origin ??= g.lead;
  if (!g.line || typeof Object.values(g.line)[0] === 'number') g.line = marchingLine(pieces, g.slots);
  g.along ??= Object.fromEntries(pieces.map((p) => [p.id, g.pathIdx - 1]));
  const pt = (i: number): [number, number] => (i < 0 ? g.origin : g.path[Math.min(i, g.path.length - 1)]);
  const walkable = (x: number, y: number) => ctx.walkable?.(x, y) ?? true;
  const canClear = !!(ctx.tree && ctx.fell) && pieces.some((p) => p.kind === 'R');
  const arriving = g.pathIdx >= g.path.length;

  // Where each piece has got to along the path: the furthest path square it has stood beside.
  const reach = (p: GroupPiece) => {
    let a = g.along[p.id] ?? -1;
    for (let j = a + 1; j <= Math.min(g.path.length - 1, a + 8); j++) {
      const [x, y] = g.path[j];
      if (Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) <= 1) a = j;
    }
    g.along[p.id] = a;
    return a;
  };
  for (const p of pieces) reach(p);

  // 1. The lead advances unless the column's tail has fallen too far behind (in path steps),
  // and then it waits only a few turns: stragglers follow the same path on their own.
  if (!arriving) {
    const depth = Math.max(0, ...pieces.map((p) => g.line[p.id]?.[0] ?? 0)) + 1;
    const tail = Math.min(...pieces.filter((p) => (g.stuck[p.id] ?? 0) < ABANDON).map((p) => g.along[p.id] ?? -1), g.pathIdx);
    const behind = g.pathIdx - 1 - tail > depth + 3;
    if (behind && (g.waitTurns ?? 0) < MAX_WAIT) g.waitTurns = (g.waitTurns ?? 0) + 1;
    else {
      const speed = Math.min(...pieces.map((p) => KIND_SPEED[p.kind]));
      let next = Math.min(g.path.length, g.pathIdx + speed);
      // Pawns can't step diagonally (a diagonal square costs them two moves and a turn):
      // a pawn troop takes two turns over a diagonal step, so it marches steadily instead of dashing and waiting.
      if (speed === 1 && next > g.pathIdx && pieces.some((p) => p.kind === 'P')) {
        const [ax, ay] = pt(g.pathIdx - 1), [bx, by] = g.path[g.pathIdx];
        if (ax !== bx && ay !== by) { g.diagHold = !g.diagHold; if (g.diagHold) next = g.pathIdx; }
      }
      // Elephants clear the road: the lead never steps onto a standing tree; it waits for them.
      if (canClear) for (let j = g.pathIdx; j < next; j++) if (ctx.tree!(g.path[j][0], g.path[j][1])) { next = j; break; }
      if (next > g.pathIdx) {
        const [nx, ny] = g.path[next - 1];
        const look = g.path[Math.min(g.path.length - 1, next + 3)];
        g.heading = headingOf(look[0] - g.lead[0], look[1] - g.lead[1], g.heading);
        g.lead = [nx, ny];
        g.pathIdx = next;
        g.treeWait = 0;
        g.waitTurns = 0;
        g.best = {};
      } else if (!g.diagHold && (g.treeWait = (g.treeWait ?? 0) + 1) > 30) {
        // The elephants can't get to the tree: drop the rest of the path and go around the woods.
        g.path = g.path.slice(0, g.pathIdx);
        g.avoidTrees = true;
        g.treeWait = 0;
      }
    }
  }

  // 2. Elephants go ahead to the standing trees on the road and knock them down, each its own tree.
  const clears = new Map<number, { tree: [number, number]; stand: [number, number] }>();
  if (canClear && !g.avoidTrees) {
    const idle = pieces.filter((p) => p.kind === 'R');
    for (let j = g.pathIdx; j < Math.min(g.path.length, g.pathIdx + CLEAR_AHEAD) && idle.length; j++) {
      const [x, y] = g.path[j];
      if (!ctx.tree!(x, y)) continue;
      const rook = idle.reduce((a, b) => (dist(a.x, a.y, x, y) <= dist(b.x, b.y, x, y) ? a : b));
      const sides = DIRS4.map(([dx, dy]) => [x + dx, y + dy] as [number, number]).filter(([sx, sy]) => (sx === rook.x && sy === rook.y) || walkable(sx, sy));
      if (!sides.length) continue;
      clears.set(rook.id, { tree: [x, y], stand: sides.reduce((a, b) => (dist(rook.x, rook.y, a[0], a[1]) <= dist(rook.x, rook.y, b[0], b[1]) ? a : b)) });
      idle.splice(idle.indexOf(rook), 1);
    }
  }

  // Where each piece is headed this turn.
  //  - Marching: its place in the column (a path square, or one to either side of it),
  //    reached by following the path from where it has got to.
  //  - Arriving: its formation slot around the lead (moved beside a blocked square).
  const aim = (p: GroupPiece): { goal: [number, number]; via: [number, number] } => {
    if (arriving) {
      const raw = slotWorld(g.lead, g.heading, g.slots[p.id] ?? [0, 0]);
      let goal = raw;
      if (!walkable(raw[0], raw[1]) && !(p.x === raw[0] && p.y === raw[1])) {
        let bd = Infinity, found: [number, number] | null = null;
        for (let rr = 1; rr <= 3 && !found; rr++)
          for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
            const x = raw[0] + dx, y = raw[1] + dy;
            if (!walkable(x, y)) continue;
            const d = dist(x, y, raw[0], raw[1]) + 0.5 * dist(x, y, g.lead[0], g.lead[1]);
            if (d < bd) { bd = d; found = [x, y]; }
          }
        goal = found ?? g.lead;
      }
      // Still far down the path: walk it first.
      const a = g.along[p.id] ?? -1;
      const via = a < g.path.length - 3 && dist(p.x, p.y, goal[0], goal[1]) > 4 ? pt(Math.min(g.path.length - 1, a + LOOK[p.kind])) : goal;
      return { goal, via };
    }
    const [row, side] = g.line[p.id] ?? [0, 0];
    const ti = g.pathIdx - 1 - row;
    let goal = pt(ti);
    if (side) {
      const [ax, ay] = pt(ti - 1), [bx, by] = pt(ti + 1);
      const h = headingOf(bx - ax, by - ay, g.heading), [fx, fy] = FACING_DELTA[h];
      const sx = goal[0] - fy * side, sy = goal[1] + fx * side;
      if (walkable(sx, sy)) goal = [sx, sy];
    }
    const a = g.along[p.id] ?? -1;
    const via = a < ti ? pt(Math.min(ti, a + LOOK[p.kind])) : goal;
    return { goal, via };
  };

  // 3. Each piece moves. Front pieces go first.
  const [fx, fy] = FACING_DELTA[g.heading];
  const order = [...pieces].sort((a, b) => (b.x * fx + b.y * fy) - (a.x * fx + a.y * fy) || a.id - b.id);
  const moves: GaitMove[] = [];
  let anyProgress = false;
  const best = (g.best ??= {});
  const routes = (g.routes ??= {});
  const tried = (g.routeTried ??= {});
  const free = (p: GroupPiece) => (x: number, y: number) => ctx.free(p, x, y);
  const fellBeside = (p: GroupPiece, tx: number, ty: number) => {
    if (p.kind !== 'R' || !ctx.tree || !ctx.fell) return false;
    const d = DIRS4.find(([dx, dy]) => dist(p.x + dx, p.y + dy, tx, ty) < dist(p.x, p.y, tx, ty) && ctx.tree!(p.x + dx, p.y + dy));
    if (!d || !ctx.fell(p, p.x + d[0], p.y + d[1])) return false;
    const m: GaitMove = { x: p.x, y: p.y, facing: facingOf(d[0], d[1], p.facing), turn: true };
    apply(p, m); moves.push(m);
    return true;
  };
  for (const p of order) {
    const before0 = g.along[p.id] ?? -1;
    // The clearing elephant: beside the tree, knock it down; otherwise go stand beside it.
    const clear = clears.get(p.id);
    let { goal, via } = aim(p);
    if (clear) {
      const [ax, ay] = clear.tree;
      if (Math.abs(ax - p.x) + Math.abs(ay - p.y) === 1 && ctx.fell!(p, ax, ay)) {
        const m: GaitMove = { x: p.x, y: p.y, facing: facingOf(ax - p.x, ay - p.y, p.facing), turn: true };
        apply(p, m); moves.push(m);
        g.stuck[p.id] = 0; anyProgress = true;
        continue;
      }
      goal = via = clear.stand;
    }
    const key = `${p.id}:${via[0]},${via[1]}`;
    const before = dist(p.x, p.y, via[0], via[1]);
    if (before === 0 && dist(p.x, p.y, goal[0], goal[1]) === 0) {
      // In place. A pawn in the line turns to face the way the troop is going.
      if (arriving && p.kind === 'P' && p.facing !== g.heading) {
        const m: GaitMove = { x: p.x, y: p.y, facing: ((p.facing + ((g.heading - p.facing + 4) % 4 === 3 ? 3 : 1)) % 4) as Facing, turn: true };
        apply(p, m); moves.push(m); anyProgress = true;
      }
      g.stuck[p.id] = 0;
      continue;
    }
    if (best[key] === undefined) best[key] = before;

    // Cut off from the path (it started across a river, or got shoved aside): its own route back.
    let r: Route | undefined = routes[p.id];
    if (r && (r.fails >= 3 || r.i >= r.pts.length || Math.max(Math.abs(r.to[0] - via[0]), Math.abs(r.to[1] - via[1])) > 6)) { delete routes[p.id]; r = undefined; }
    const stuck = g.stuck[p.id] ?? 0;
    if (!r && ctx.route && stuck >= 3 && before > 2 && g.turns - (tried[p.id] ?? -99) >= 6) {
      const pts = ctx.route(p, via[0], via[1]);
      if (pts) tried[p.id] = g.turns;
      if (pts && pts.length) r = routes[p.id] = { pts, i: 0, to: via, fails: 0 };
    }
    let target = via;
    if (r) {
      for (let j = r.i; j < Math.min(r.pts.length, r.i + 8); j++) if (Math.max(Math.abs(r.pts[j][0] - p.x), Math.abs(r.pts[j][1] - p.y)) <= 1) r.i = j + 1;
      target = r.pts[Math.min(r.pts.length - 1, r.i + LOOK[p.kind] - 1)] ?? via;
    }
    // Search only as far as the aim is (usually 2–3 squares), harder when stuck.
    // Marching, landing within a square of the aim is close enough; in formation it must be exact.
    const h = dist(p.x, p.y, target[0], target[1]);
    const m = stuck >= 3
      ? bestGaitMove(p, target[0], target[1], free(p), ctx.lite ? 60 : 160, 12)
      : bestGaitMove(p, target[0], target[1], free(p), Math.min(ctx.lite ? 60 : 160, 24 + Math.ceil(h) * 24), Math.min(8, Math.ceil(h) + 2), arriving && target === goal ? 0 : 1);
    if (m) {
      apply(p, m); moves.push(m);
      const after = dist(p.x, p.y, target[0], target[1]);
      const prev = best[key];
      const gained = reach(p) > before0 || after < prev - 1e-9;
      if (gained) { best[key] = Math.min(prev, after); g.stuck[p.id] = 0; anyProgress = true; }
      // A pawn turning toward its way counts once, not forever (it used to spin in place and hold the troop).
      else if (m.turn && after <= before) { anyProgress = true; g.stuck[p.id] = stuck + (p.kind === 'P' && stuck === 0 ? 0 : 1); }
      else g.stuck[p.id] = stuck + 1;
      if (r && !gained) r.fails++;
    } else if (fellBeside(p, target[0], target[1])) { g.stuck[p.id] = 0; anyProgress = true; }
    else { g.stuck[p.id] = stuck + 1; if (r) r.fails++; }
  }

  // 4. Done when the lead has arrived and everyone is in place or can't get closer,
  // or at most SETTLE_TURNS after arriving (nobody holds the troop forever).
  if (arriving) {
    g.arrivedAt ??= g.turns;
    const settled = pieces.every((p) => {
      const { goal } = aim(p);
      return (dist(p.x, p.y, goal[0], goal[1]) === 0 && (p.kind !== 'P' || p.facing === g.heading)) || (g.stuck[p.id] ?? 0) >= 2;
    });
    if ((settled && !anyProgress) || g.turns - g.arrivedAt > SETTLE_TURNS) g.done = true;
  } else g.arrivedAt = undefined;
  if (g.turns > 8000) g.done = true;
  return moves;
}
