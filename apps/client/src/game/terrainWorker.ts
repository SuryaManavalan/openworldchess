// Generates chunk terrain off the main thread so panning never stutters
// (client.md §6). Same worldgen as the server: terrain never crosses the network.
import { terrainAt } from '@owc/worldgen';

const CODES = { grass: 0, sand: 1, water: 2, forest: 3, mountain: 4 } as const;

self.onmessage = (e: MessageEvent<{ seed: number; cx: number; cy: number; size: number }>) => {
  const { seed, cx, cy, size } = e.data;
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) out[y * size + x] = CODES[terrainAt(seed, cx * size + x, cy * size + y)];
  (self as unknown as Worker).postMessage({ cx, cy, codes: out }, [out.buffer]);
};
