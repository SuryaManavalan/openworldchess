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

/**
 * Shortest king-walk path from (sx, sy) to (tx, ty), or to the reachable
 * square closest to it. Returns the squares after the start, in order.
 * `free` should ignore pieces (they move); it's about terrain and buildings.
 */
export function findPath(sx: number, sy: number, tx: number, ty: number, free: FreeFn, maxExpand = 6000): [number, number][] {
  if (sx === tx && sy === ty) return [];
  const start = pk(sx, sy);
  const g = new Map<number, number>([[start, 0]]);
  const from = new Map<number, number>();
  const heap = new Heap();
  heap.push(start, octile(sx, sy, tx, ty));
  let bestK = start, bestH = octile(sx, sy, tx, ty);
  const goal = pk(tx, ty);
  for (let n = 0; heap.size && n < maxExpand; n++) {
    const k = heap.pop();
    if (k === goal) { bestK = k; break; }
    const [x, y] = upk(k);
    const h = octile(x, y, tx, ty);
    if (h < bestH) { bestH = h; bestK = k; }
    const gk = g.get(k)!;
    for (const [dx, dy, c] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!free(nx, ny)) continue;
      // no cutting corners diagonally between two blocked squares
      if (dx && dy && !free(x + dx, y) && !free(x, y + dy)) continue;
      const nk = pk(nx, ny), ng = gk + c;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng); from.set(nk, k);
        heap.push(nk, ng + octile(nx, ny, tx, ty) * 1.05);
      }
    }
  }
  const out: [number, number][] = [];
  for (let k = bestK; k !== start; k = from.get(k)!) out.push(upk(k));
  return out.reverse();
}
