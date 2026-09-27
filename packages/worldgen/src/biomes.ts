// Biomes (docs/specs/world.md §2b). A biome is the look and the wildlife of a
// place: which trees grow, what the rock and ore look like, what lives there.
// It never changes the rules: terrain (walkable, buildable) and resource nodes
// come from terrain.ts and resources.ts exactly as before, and a biome only
// decides how they're drawn. So the world's gameplay stays balanced no matter
// how strange it looks.
import { fbm, hash01 } from './random.ts';
import { eloAt, fields } from './terrain.ts';

export const BIOMES = [
  // common: from temperature, moisture and height
  'meadow', 'woodland', 'birch', 'autumn', 'taiga', 'tundra', 'highland',
  'savanna', 'desert', 'badlands', 'jungle', 'swamp',
  // rare: pockets, more likely in high-rated land
  'blossom', 'mushroom', 'blight', 'fey', 'crystal', 'volcanic',
] as const;
export type Biome = (typeof BIOMES)[number];
export const BIOME_CODE: Record<Biome, number> = Object.fromEntries(BIOMES.map((b, i) => [b, i])) as Record<Biome, number>;
export const RARE_BIOMES: Biome[] = ['blossom', 'mushroom', 'blight', 'fey', 'crystal', 'volcanic'];

export const BIOME_NAME: Record<Biome, string> = {
  meadow: 'Meadow', woodland: 'Oak Woods', birch: 'Birch Wood', autumn: 'Autumn Wood', taiga: 'Pine Forest',
  tundra: 'Tundra', highland: 'Highlands', savanna: 'Savanna', desert: 'Desert', badlands: 'Badlands',
  jungle: 'Jungle', swamp: 'Swamp', blossom: 'Blossom Vale', mushroom: 'Mushroom Forest', blight: 'Blighted Land',
  fey: 'Fey Wood', crystal: 'Crystal Fields', volcanic: 'Ashlands',
};

const SALT = { temp: 90, patch: 91, pocket: 92 };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Temperature, roughly [-0.6, 0.6]: cold below -0.21, hot above 0.2. */
export const temperature = (seed: number, x: number, y: number) => fbm(seed, x, y, 1600, SALT.temp, 3);

// Rare pockets: like the elo field's pockets, a jittered grid where some cells
// hold one blob of a rare biome. Stranger biomes need higher-rated land.
const POCKET_CELL = 900;
const RARE_WEIGHT: [Biome, (elo: number) => number][] = [
  ['blossom', () => 1],
  ['mushroom', () => 1],
  ['blight', (e) => 0.4 + clamp01((e - 1050) / 400)],
  ['fey', (e) => 0.1 + clamp01((e - 1050) / 400)],
  ['crystal', (e) => clamp01((e - 1100) / 400)],
  ['volcanic', (e) => clamp01((e - 1200) / 400)],
];

function pocket(seed: number, x: number, y: number): Biome | null {
  const ci = Math.floor(x / POCKET_CELL), cj = Math.floor(y / POCKET_CELL);
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj;
      const px = (i + 0.2 + 0.6 * hash01(seed, i, j, 93)) * POCKET_CELL;
      const py = (j + 0.2 + 0.6 * hash01(seed, i, j, 94)) * POCKET_CELL;
      const radius = 60 + 150 * hash01(seed, i, j, 95);
      if (Math.abs(x - px) > radius * 1.6 || Math.abs(y - py) > radius * 1.6) continue;
      const e = eloAt(seed, Math.round(px), Math.round(py));
      if (hash01(seed, i, j, 96) >= 0.4 + 0.3 * clamp01((e - 1000) / 800)) continue;
      // Warp the edge so pockets are irregular, not circles.
      const wx = x + radius * 0.5 * fbm(seed, x, y, radius * 0.7, 97, 2);
      const wy = y + radius * 0.5 * fbm(seed, x, y, radius * 0.7, 98, 2);
      if (Math.hypot(wx - px, wy - py) >= radius) continue;
      let total = 0;
      for (const [, w] of RARE_WEIGHT) total += w(e);
      let pick = hash01(seed, i, j, 99) * total;
      for (const [b, w] of RARE_WEIGHT) { pick -= w(e); if (pick < 0) return b; }
    }
  return null;
}

let cacheSeed = NaN;
const cache = new Map<number, Biome>();

export function biomeAt(seed: number, x: number, y: number): Biome {
  if (seed !== cacheSeed) { cache.clear(); cacheSeed = seed; }
  if (cache.size > 1_000_000) { let n = 250_000; for (const k of cache.keys()) { cache.delete(k); if (--n <= 0) break; } }
  const key = x * 134217728 + y;
  let b = cache.get(key);
  if (b === undefined) { b = computeBiome(seed, x, y); cache.set(key, b); }
  return b;
}

function computeBiome(seed: number, x: number, y: number): Biome {
  const rare = pocket(seed, x, y);
  if (rare) return rare;
  const { height: h, moisture: m } = fields(seed, x, y);
  const t = temperature(seed, x, y);
  const forest = m > 0.18; // same line terrain.ts uses for forest
  if (t < -0.21) return forest || m > 0.05 ? 'taiga' : 'tundra';
  if (t > 0.2) {
    if (h < -0.12 && m > 0.05) return 'swamp';
    if (forest) return 'jungle';
    if (h > 0.2) return 'badlands';
    if (m < -0.1 && t > 0.26) return 'desert';
    return 'savanna';
  }
  if (h < -0.16 && m > 0.08) return 'swamp';
  if (forest) {
    const v = fbm(seed, x, y, 220, SALT.patch, 2);
    return v > 0.16 ? 'birch' : v < -0.18 ? 'autumn' : 'woodland';
  }
  if (h > 0.24) return 'highland';
  return 'meadow';
}
