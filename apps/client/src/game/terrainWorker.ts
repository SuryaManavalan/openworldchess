// Generates chunk terrain off the main thread so panning never stutters
// (client.md §6). Same worldgen as the server: terrain never crosses the network.
import { BIOME_CODE, biomeAt, hash01, resourcesInRect, terrainAt } from '@owc/worldgen';

const CODES = { grass: 0, sand: 1, water: 2, forest: 3, mountain: 4 } as const;
const KIND: Record<string, number> = { tree: 0, rock: 1, ore: 2, wheat: 3 };
const RES_SIZE = 4 * 4 * 3;

self.onmessage = (e: MessageEvent<{ seed: number; cx: number; cy: number; size: number }>) => {
  const { seed, cx, cy, size } = e.data;
  const out = new Uint8Array(size * size);
  const biomes = new Uint8Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const wx = cx * size + x, wy = cy * size + y;
      out[y * size + x] = CODES[terrainAt(seed, wx, wy)];
      // Biome edges are ragged, not ruled: sample a slightly jittered square.
      const jx = Math.round((hash01(seed, wx, wy, 330) - 0.5) * 5), jy = Math.round((hash01(seed, wx, wy, 331) - 0.5) * 5);
      biomes[y * size + x] = BIOME_CODE[biomeAt(seed, wx + jx, wy + jy)];
    }
  // What grows and lies here, for the far view's resource icons (visuals.md §12): per 16×16
  // quarter of the chunk and per kind, [count, sum x, sum y], as the world generates it.
  const res = new Float32Array(RES_SIZE);
  for (const n of resourcesInRect(seed, cx * size, cy * size, cx * size + size - 1, cy * size + size - 1)) {
    const q = (n.y - cy * size >= size / 2 ? 2 : 0) + (n.x - cx * size >= size / 2 ? 1 : 0), k = KIND[n.kind];
    const i = (q * 4 + k) * 3;
    res[i]++; res[i + 1] += n.x; res[i + 2] += n.y;
  }
  (self as unknown as Worker).postMessage({ cx, cy, codes: out, biomes, res }, [out.buffer, biomes.buffer, res.buffer]);
};
