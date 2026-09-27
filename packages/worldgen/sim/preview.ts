// Renders worldgen previews to PNG: a local map with resource nodes, and a
// zoomed-out elo map. Run: node sim/preview.ts [seed]
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { eloAt, terrainAt, type Terrain } from '../src/terrain.ts';
import { resourcesInRect, type Kind } from '../src/resources.ts';

const seed = Number(process.argv[2] ?? 1);
const OUT = new URL('./out/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// ---------- tiny PNG encoder ----------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));

// ---------- local map ----------
const TERRAIN_COLOR: Record<Terrain, string> = {
  grass: '#a3c56a', forest: '#6f9a4a', water: '#71bcd4', mountain: '#8a8176', sand: '#e6d39e',
};
const NODE_COLOR: Record<Kind, string> = { tree: '#2c5a1c', wheat: '#f3e08a', rock: '#f4f1ea', gold: '#ff9f1a' };

function localMap(cx: number, cy: number, size: number, px: number, name: string) {
  const w = size * px;
  const img = new Uint8Array(w * w * 3);
  const paint = (sx: number, sy: number, c: number[], inset = 0) => {
    for (let y = inset; y < px - inset; y++)
      for (let x = inset; x < px - inset; x++) img.set(c, ((sy * px + y) * w + sx * px + x) * 3);
  };
  const x0 = cx - size / 2, y0 = cy - size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const c = hex(TERRAIN_COLOR[terrainAt(seed, x0 + x, y0 + y)]);
      // keep the chessboard visible: darken alternate squares slightly
      paint(x, y, (x0 + x + y0 + y) % 2 ? c.map((v) => v * 0.93) : c);
    }
  for (const n of resourcesInRect(seed, x0, y0, x0 + size - 1, y0 + size - 1)) {
    if (n.kind === 'gold') paint(n.x - x0, n.y - y0, [60, 40, 10]);
    paint(n.x - x0, n.y - y0, hex(NODE_COLOR[n.kind]), n.kind === 'gold' ? 1 : 0);
  }
  writeFileSync(new URL(name, OUT), png(w, w, img));
}

// ---------- elo map ----------
function eloMap(span: number, pxSize: number, name: string) {
  const img = new Uint8Array(pxSize * pxSize * 3);
  const ramp = [[400, '#2b4a6f'], [1000, '#4f8fb0'], [1400, '#9cc28a'], [1800, '#e8c65a'], [2200, '#e07a3a'], [2800, '#b3243a']] as const;
  const color = (e: number) => {
    for (let i = 1; i < ramp.length; i++)
      if (e <= ramp[i][0]) {
        const t = (e - ramp[i - 1][0]) / (ramp[i][0] - ramp[i - 1][0]);
        const a = hex(ramp[i - 1][1]), b = hex(ramp[i][1]);
        return a.map((v, k) => v + (b[k] - v) * t);
      }
    return hex(ramp[ramp.length - 1][1]);
  };
  for (let y = 0; y < pxSize; y++)
    for (let x = 0; x < pxSize; x++) {
      const wx = (x / pxSize - 0.5) * span, wy = (y / pxSize - 0.5) * span;
      img.set(color(eloAt(seed, wx, wy)), (y * pxSize + x) * 3);
    }
  writeFileSync(new URL(name, OUT), png(pxSize, pxSize, img));
}

localMap(0, 0, 400, 2, `local-seed${seed}.png`);
localMap(0, 0, 100, 8, `closeup-seed${seed}.png`);
// A high-elo pocket, found by scanning for the richest nearby area.
let best = { x: 0, y: 0, e: 0 };
for (let y = -20000; y <= 20000; y += 250)
  for (let x = -20000; x <= 20000; x += 250) {
    const e = eloAt(seed, x, y);
    if (e > best.e) best = { x, y, e };
  }
localMap(best.x, best.y, 400, 2, `pocket-seed${seed}.png`);
eloMap(40000, 600, `elo-seed${seed}.png`);
console.log(`wrote previews for seed ${seed}; pocket at (${best.x}, ${best.y}) elo ${best.e.toFixed(0)}`);
