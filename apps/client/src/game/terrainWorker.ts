// Generates chunk terrain off the main thread so panning never stutters
// (client.md §6). Same worldgen as the server: terrain never crosses the network.
import { BIOME_CODE, biomeAt, hash01, terrainAt } from '@owc/worldgen';

const CODES = { grass: 0, sand: 1, water: 2, forest: 3, mountain: 4 } as const;

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
  (self as unknown as Worker).postMessage({ cx, cy, codes: out, biomes }, [out.buffer, biomes.buffer]);
};
