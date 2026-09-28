// The land's rating (docs/specs/elo.md §3): the world starts from the generated
// elo map, and where empires live the land takes on their ratings. Strong players
// make strong land (richer, with rarer and tougher wilds); weak players make gentle
// land. Far from anyone, the generated map stands.
//
// Values are kept per 64×64-square cell and read with bilinear interpolation
// between cell centers, so the land changes smoothly. The server computes them;
// clients and bots receive the cells near them.
import { eloAt } from './terrain.ts';

export const LAND_CELL = 64;
const K = 1 << 16;
export const landKey = (cx: number, cy: number) => (cx + K / 2) * K + (cy + K / 2);
export const landUnkey = (k: number): [number, number] => [Math.floor(k / K) - K / 2, (k % K) - K / 2];

export class LandField {
  /** Cell → rating, only where empires have shaped the land. */
  cells = new Map<number, number>();
  seed: number;
  constructor(seed: number) { this.seed = seed; }

  /** The generated rating at a cell's center (where nobody has shaped it). */
  prior(cx: number, cy: number) { return eloAt(this.seed, cx * LAND_CELL + LAND_CELL / 2, cy * LAND_CELL + LAND_CELL / 2); }

  cell(cx: number, cy: number) { return this.cells.get(landKey(cx, cy)) ?? this.prior(cx, cy); }

  /** The land's rating at (x, y). */
  at(x: number, y: number): number {
    // Untouched regions read the generated map directly, at full detail.
    const fx = x / LAND_CELL - 0.5, fy = y / LAND_CELL - 0.5;
    const cx = Math.floor(fx), cy = Math.floor(fy), tx = fx - cx, ty = fy - cy;
    if (!this.cells.size || (!this.cells.has(landKey(cx, cy)) && !this.cells.has(landKey(cx + 1, cy)) && !this.cells.has(landKey(cx, cy + 1)) && !this.cells.has(landKey(cx + 1, cy + 1)))) return eloAt(this.seed, x, y);
    const a = this.cell(cx, cy), b = this.cell(cx + 1, cy), c = this.cell(cx, cy + 1), d = this.cell(cx + 1, cy + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  /** Replace cells from a flat [cx, cy, rating, ...] list (what the server sends). */
  apply(flat: number[]) {
    for (let i = 0; i + 2 < flat.length; i += 3) this.cells.set(landKey(flat[i], flat[i + 1]), flat[i + 2]);
  }
}
