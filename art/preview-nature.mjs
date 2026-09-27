// Contact sheet for the biome nature art: one row per group, to out/png/nature.png.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { place } from './lib/style.mjs';
import { TREES, ROCKS, ORES, CROPS } from './assets/nature.mjs';

const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT + 'png', { recursive: true });
const BOARD = { light: '#eeeed2', dark: '#769656' };

const rows = [TREES, ROCKS, ORES, CROPS].map((g) => Object.values(g).map((f) => f()));
const cols = Math.max(...rows.map((r) => r.length)), cell = 100;
let s = '';
rows.forEach((row, y) => row.forEach((inner, x) => {
  s += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${(x + y) % 2 ? BOARD.dark : BOARD.light}"/>`;
  s += place(inner, x * cell, y * cell, cell);
}));
const w = cols * cell, h = rows.length * cell;
const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${s}</svg>`;
writeFileSync(OUT + 'png/nature.png', new Resvg(doc, { fitTo: { mode: 'zoom', value: 1.2 } }).render().asPng());
// A small-size check: how it reads at in-game size (~40px per square).
writeFileSync(OUT + 'png/nature-small.png', new Resvg(doc, { fitTo: { mode: 'zoom', value: 0.4 } }).render().asPng());
console.log('wrote nature.png', Object.keys(TREES).length, Object.keys(ROCKS).length, Object.keys(ORES).length, Object.keys(CROPS).length);
