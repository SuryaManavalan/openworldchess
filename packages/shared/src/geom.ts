// Grid geometry helpers.

export const CHUNK = 32;

export const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export const key = (x: number, y: number) => x * 134217728 + y;
export const unkey = (k: number): [number, number] => {
  const x = Math.round(k / 134217728);
  return [x, k - x * 134217728];
};

export const chunkOf = (x: number, y: number): [number, number] => [Math.floor(x / CHUNK), Math.floor(y / CHUNK)];
export const chunkKey = (cx: number, cy: number) => `${cx},${cy}`;

/** Light square test: the world keeps one global checker (world.md §1). */
export const isLight = (x: number, y: number) => ((x + y) & 1) === 0;

/** Chebyshev distance from a point to a size×size footprint at (bx, by). */
export const distToRect = (x: number, y: number, bx: number, by: number, size: number) => {
  const dx = x < bx ? bx - x : x > bx + size - 1 ? x - (bx + size - 1) : 0;
  const dy = y < by ? by - y : y > by + size - 1 ? y - (by + size - 1) : 0;
  return Math.max(dx, dy);
};
