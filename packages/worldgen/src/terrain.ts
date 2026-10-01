// Terrain and the elo field. Pure functions of (seed, x, y).
import { fbm, hash01, valueNoise } from './random.ts';

export type Terrain = 'water' | 'mountain' | 'sand' | 'grass' | 'forest';

const SALT = { height: 1, moisture: 2, river: 3, eloBase: 4, pocket: 5, ford: 8 };

/** Raw fields that terrain and resource density are derived from. */
export function fields(seed: number, x: number, y: number) {
  return {
    height: fbm(seed, x, y, 420, SALT.height),
    moisture: fbm(seed, x, y, 260, SALT.moisture),
  };
}

/** Is (x, y) part of a river's bed (water or a shallow ford)? Bridges form here. */
export function riverBed(seed: number, x: number, y: number): boolean {
  const { height } = fields(seed, x, y);
  return height < 0.4 && height >= -0.3 && Math.abs(fbm(seed, x, y, 700, SALT.river, 3)) < 0.007;
}

function isWaterRaw(seed: number, x: number, y: number, height: number): boolean {
  if (height < -0.3) return true; // lakes
  // Rivers: a thin band where a large-scale noise field crosses zero.
  if (Math.abs(fbm(seed, x, y, 700, SALT.river, 3)) >= 0.007 || height >= 0.4) return false;
  // Fords: short stretches where the river is shallow enough to walk.
  return valueNoise(seed, x / 30, y / 30, SALT.ford) < 0.6;
}

// Terrain is looked up far more often than it changes, so memoize it
// (bounded, per seed). Coordinates are integers well below 2^26.
let cacheSeed = NaN;
const cache = new Map<number, Terrain>();

export function terrainAt(seed: number, x: number, y: number): Terrain {
  if (seed !== cacheSeed) { cache.clear(); cacheSeed = seed; }
  // Full: forget the oldest quarter (Maps keep insertion order), not everything at once.
  if (cache.size > 2_000_000) { let n = 500_000; for (const k of cache.keys()) { cache.delete(k); if (--n <= 0) break; } }
  const key = x * 134217728 + y;
  let t = cache.get(key);
  if (t === undefined) { t = computeTerrain(seed, x, y); cache.set(key, t); }
  return t;
}

function computeTerrain(seed: number, x: number, y: number): Terrain {
  const { height, moisture } = fields(seed, x, y);
  if (isWaterRaw(seed, x, y, height)) return 'water';
  if (height > 0.42) return 'mountain';
  // Sand: dry-ish land right next to water.
  if (
    isWaterRaw(seed, x + 1, y, fields(seed, x + 1, y).height) ||
    isWaterRaw(seed, x - 1, y, fields(seed, x - 1, y).height) ||
    isWaterRaw(seed, x, y + 1, fields(seed, x, y + 1).height) ||
    isWaterRaw(seed, x, y - 1, fields(seed, x, y - 1).height)
  )
    return 'sand';
  if (moisture > 0.18) return 'forest';
  return 'grass';
}

export const walkable = (t: Terrain) => t !== 'water' && t !== 'mountain';
/** Buildings go on any open ground, forest floor included; trees and rocks block their own squares. */
export const buildable = (t: Terrain) => t !== 'water' && t !== 'mountain';

// ---------- elo field ----------

const POCKET_CELL = 2000;
const POCKET_CHANCE = 0.35;
const NEWBIE_RADIUS = 3000;

/**
 * Area rating at (x, y): a broad base field plus sparse high-elo pockets,
 * held low near the origin where new players start. Range 400-2800.
 */
export function eloAt(seed: number, x: number, y: number): number {
  let elo = 1100 + 400 * fbm(seed, x, y, 5000, SALT.eloBase, 3);
  const ci = Math.floor(x / POCKET_CELL), cj = Math.floor(y / POCKET_CELL);
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj;
      if (hash01(seed, i, j, 50) >= POCKET_CHANCE) continue;
      const px = (i + 0.2 + 0.6 * hash01(seed, i, j, 51)) * POCKET_CELL;
      const py = (j + 0.2 + 0.6 * hash01(seed, i, j, 52)) * POCKET_CELL;
      const radius = 300 + 500 * hash01(seed, i, j, 53);
      const amp = 800 + 700 * hash01(seed, i, j, 54);
      // Warp the distance with noise so pockets have irregular edges.
      const wx = x + radius * 0.45 * fbm(seed, x, y, radius * 0.8, 6, 2);
      const wy = y + radius * 0.45 * fbm(seed, x, y, radius * 0.8, 7, 2);
      const d = Math.hypot(wx - px, wy - py) / radius;
      if (d < 1) elo += amp * (1 - d * d) ** 2;
    }
  // The new-player zone: capped at 1000 near the origin, fading out smoothly
  // between NEWBIE_RADIUS and twice that.
  const t = Math.max(0, Math.min(1, (Math.hypot(x, y) - NEWBIE_RADIUS) / NEWBIE_RADIUS));
  const fade = t * t * (3 - 2 * t);
  elo = Math.min(elo, 1000) + (elo - Math.min(elo, 1000)) * fade;
  return Math.max(400, Math.min(2800, elo));
}

const ROOT_A = ['Oak', 'Ash', 'Stone', 'Elm', 'Thorn', 'Wheat', 'Iron', 'Raven', 'Amber', 'Bright', 'Frost', 'Moss', 'Red', 'Wolf', 'King', 'Queen', 'Rook', 'Bishop'];
const ROOT_B = { water: ['ford', 'bridge', 'port', 'mere', 'brook'], forest: ['wood', 'glade', 'holt', 'grove'], mountain: ['crag', 'fell', 'tor', 'ridge'], plain: ['field', 'ton', 'stead', 'ham', 'bury', 'wick', 'gate'] };

/** A settlement's name (visuals.md §10), from its id and the land around its center: water, forest or mountain flavour it. */
export function townName(seed: number, id: number, cx: number, cy: number): string {
  let water = 0, forest = 0, mountain = 0;
  for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) {
    const t = terrainAt(seed, cx + dx, cy + dy);
    if (t === 'water') water++; else if (t === 'forest') forest++; else if (t === 'mountain') mountain++;
  }
  const kind = water > 2 ? 'water' : mountain > 2 ? 'mountain' : forest > 12 ? 'forest' : 'plain';
  const a = ROOT_A[Math.floor(hash01(seed, id, 0, 401) * ROOT_A.length)];
  const list = ROOT_B[kind];
  return a + list[Math.floor(hash01(seed, id, 1, 402) * list.length)];
}
