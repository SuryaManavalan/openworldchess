// A* on the grid over squares a king can walk (movement.md §5).
import type { FreeFn } from './gaits.ts';

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414],
];

const octile = (ax: number, ay: number, bx: number, by: number) => {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
};

/** Binary heap keyed by f. */
class Heap {
  private a: { f: number; k: number }[] = [];
  get size() { return this.a.length; }
  push(k: number, f: number) {
    const a = this.a; a.push({ f, k });
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop(): number {
    const a = this.a, top = a[0], last = a.pop()!;
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top.k;
  }
}

const K = 1 << 20;
const pk = (x: number, y: number) => (x + K / 2) * K + (y + K / 2);
const upk = (k: number): [number, number] => [Math.floor(k / K) - K / 2, (k % K) - K / 2];

export interface PathOptions {
  /** Only orthogonal steps (pawns and elephants can't step diagonally). */
  orth?: boolean;
  /** Extra cost of entering (x, y), e.g. a tree an elephant must knock down first. */
  cost?: (x: number, y: number) => number;
  /** Stop at this time (Date.now()) and return the best partial path: one big search mustn't blow a turn's budget. */
  deadline?: number;
}

/**
 * Shortest king-walk path from (sx, sy) to (tx, ty), or to the reachable
 * square closest to it. Returns the squares after the start, in order.
 * `free` should ignore pieces (they move); it's about terrain and buildings.
 */
export function findPath(sx: number, sy: number, tx: number, ty: number, free: FreeFn, maxExpand = 6000, opts: PathOptions = {}): [number, number][] {
  const dirs = opts.orth ? DIRS.slice(0, 4) : DIRS;
  const heur = opts.orth ? (ax: number, ay: number, bx: number, by: number) => Math.abs(ax - bx) + Math.abs(ay - by) : octile;
  if (sx === tx && sy === ty) return [];
  const start = pk(sx, sy);
  const g = new Map<number, number>([[start, 0]]);
  const from = new Map<number, number>();
  const heap = new Heap();
  heap.push(start, heur(sx, sy, tx, ty));
  let bestK = start, bestH = heur(sx, sy, tx, ty);
  const goal = pk(tx, ty);
  for (let n = 0; heap.size && n < maxExpand; n++) {
    // Checked often: a step into land nobody has loaded generates its chunk (several ms each),
    // so a search can overrun its budget badly between rare checks.
    if (opts.deadline && (n & 63) === 63 && Date.now() > opts.deadline) break;
    const k = heap.pop();
    if (k === goal) { bestK = k; break; }
    const [x, y] = upk(k);
    const h = heur(x, y, tx, ty);
    if (h < bestH) { bestH = h; bestK = k; }
    const gk = g.get(k)!;
    for (const [dx, dy, c] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (!free(nx, ny)) continue;
      // no cutting corners diagonally between two blocked squares
      if (dx && dy && !free(x + dx, y) && !free(x, y + dy)) continue;
      const nk = pk(nx, ny), ng = gk + c + (opts.cost ? opts.cost(nx, ny) : 0);
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng); from.set(nk, k);
        heap.push(nk, ng + heur(nx, ny, tx, ty) * 1.05);
      }
    }
  }
  const out: [number, number][] = [];
  for (let k = bestK; k !== start; k = from.get(k)!) out.push(upk(k));
  return out.reverse();
}

const CELL = 8;

/**
 * Long routes (movement.md §5): plan on a coarse grid of 8×8-square cells first,
 * which can see around lakes and mountain ranges far beyond a fine search, then
 * stitch fine paths between the coarse waypoints.
 */
export function findPathLong(sx: number, sy: number, tx: number, ty: number, free: FreeFn, maxCoarse = 40000, budgetMs = 250, opts: PathOptions = {}): [number, number][] {
  const deadline = Date.now() + budgetMs;
  opts = { ...opts, deadline };
  if (Math.max(Math.abs(tx - sx), Math.abs(ty - sy)) <= 48) return findPath(sx, sy, tx, ty, free, 20000, opts);
  // A cell is passable if a few of its squares can be walked.
  // Permissive on purpose: narrow fords and passes must still show up at this scale.
  // Each cell is looked at once. Looking can generate the land there (several ms a chunk),
  // so past the deadline an unseen cell counts as closed and the search winds down.
  const cells = new Map<number, boolean>();
  const cellOk = (cx: number, cy: number) => {
    const k = pk(cx, cy);
    const seen = cells.get(k);
    if (seen !== undefined) return seen;
    if (Date.now() > deadline) return false;
    let ok = false;
    for (const oy of [1, 4, 7]) for (const ox of [1, 4, 7]) if (!ok && free(cx * CELL + ox, cy * CELL + oy)) ok = true;
    cells.set(k, ok);
    return ok;
  };
  const ctx = Math.floor(tx / CELL), cty = Math.floor(ty / CELL);
  const blocked = new Set<string>();
  const out: [number, number][] = [];
  let [px, py] = [sx, sy];
  // Plan coarse, walk it leg by leg; a waypoint that can't be reached at the fine
  // level marks its cell blocked, and we re-plan from where we got to.
  // Past the time budget we return what we have; the caller plans the next leg later.
  for (let attempt = 0; attempt < 30 && Date.now() < deadline; attempt++) {
    const csx = Math.floor(px / CELL), csy = Math.floor(py / CELL);
    const coarse = findPath(csx, csy, ctx, cty, (x, y) => (x === csx && y === csy) || (x === ctx && y === cty) || (!blocked.has(`${x},${y}`) && cellOk(x, y)), maxCoarse, { deadline });
    // Waypoints are found as they're reached, not all up front: looking one up can generate
    // the land around it, and the whole route may be far longer than this budget walks.
    const waypoint = (i: number): [number, number, number, number] | null => {
      if (i >= coarse.length) return [tx, ty, ctx, cty];
      const [cx, cy] = coarse[i];
      for (let r = 0; r < 4; r++)
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
          if (free(cx * CELL + 4 + dx, cy * CELL + 4 + dy)) return [cx * CELL + 4 + dx, cy * CELL + 4 + dy, cx, cy];
      return null;
    };
    let failed = false;
    for (let i = 2; i < coarse.length + 2; i += 2) {
      if (Date.now() > deadline) break;
      const w = waypoint(Math.min(i, coarse.length));
      if (!w) continue;
      const [wx, wy, cx, cy] = w;
      const leg = findPath(px, py, wx, wy, free, 12000, opts);
      const end = leg.at(-1);
      if (!end || Math.max(Math.abs(end[0] - wx), Math.abs(end[1] - wy)) > 2) {
        if (leg.length) { out.push(...leg); [px, py] = leg[leg.length - 1]; }
        blocked.add(`${cx},${cy}`);
        failed = true;
        break;
      }
      out.push(...leg);
      [px, py] = end;
      if (i >= coarse.length) break;
    }
    if (!failed) break;
  }
  return out;
}
