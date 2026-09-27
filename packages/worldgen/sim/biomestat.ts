// Share of land per biome over a big sample (a quick balance check).
import { biomeAt, BIOMES } from '../src/biomes.ts';
import { terrainAt, eloAt } from '../src/terrain.ts';
const seed = Number(process.argv[2] ?? 1234);
const count: Record<string, number> = {}; let n = 0;
for (let y = -20000; y < 20000; y += 97) for (let x = -20000; x < 20000; x += 97) {
  if (terrainAt(seed, x, y) === 'water') continue;
  const b = biomeAt(seed, x, y); count[b] = (count[b] ?? 0) + 1; n++;
}
for (const b of BIOMES) console.log(b.padEnd(10), ((100 * (count[b] ?? 0)) / n).toFixed(2) + '%');
let near = 0, nn = 0;
for (let y = -3000; y < 3000; y += 37) for (let x = -3000; x < 3000; x += 37) { nn++; if (['blossom','mushroom','blight','fey','crystal','volcanic'].includes(biomeAt(seed,x,y))) near++; }
console.log('rare within 3000 of origin', (100*near/nn).toFixed(2)+'%', eloAt(seed,0,0));
