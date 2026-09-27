// Deterministic hashing, RNG and noise. Everything in worldgen derives from
// (seed, coordinates, salt) through these functions, so any square or cell can
// be computed on its own, on the client or the server, and always agrees.

/** 32-bit hash of a seed, two integer coordinates and a salt. */
export function hash(seed: number, x: number, y: number, salt = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ (y | 0), 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16) ^ (salt | 0), 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x165667b1);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Hash mapped to [0, 1). */
export const hash01 = (seed: number, x: number, y: number, salt = 0): number =>
  hash(seed, x, y, salt) / 4294967296;

/** Small seeded RNG (mulberry32) for sequences within one cell. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample from two uniforms (Box-Muller). */
export function gaussian(r: () => number): number {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Value noise on an integer lattice, smoothly interpolated. Range [-1, 1]. */
export function valueNoise(seed: number, x: number, y: number, salt: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const v = (i: number, j: number) => hash01(seed, x0 + i, y0 + j, salt) * 2 - 1;
  const a = v(0, 0) + (v(1, 0) - v(0, 0)) * fx;
  const b = v(0, 1) + (v(1, 1) - v(0, 1)) * fx;
  return a + (b - a) * fy;
}

/**
 * Fractal noise: `octaves` layers of value noise, each at double the
 * frequency and half the amplitude. Normalized to roughly [-1, 1].
 */
export function fbm(seed: number, x: number, y: number, wavelength: number, salt: number, octaves = 4): number {
  let sum = 0, amp = 1, norm = 0, f = 1 / wavelength;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(seed, x * f, y * f, salt * 16 + o);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}
