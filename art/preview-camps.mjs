// Contact sheet of every camp: node art/preview-camps.mjs → art/out/png/camps.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { place } from './lib/style.mjs';
import { CAMPS } from './assets/camps.mjs';

const OUT = new URL('./out/png/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BOARD = { light: '#b5d175', dark: '#95b957' };
// Sample palettes from packages/shared/src/wilds.ts, cycled across the camps.
const PALS = [
  { skin: '#8fb35a', dark: '#5f7a3a', accent: '#b5543a' }, // goblins
  { skin: '#9a9a96', dark: '#5f5f5c', accent: '#dcdcd4' }, // wolves
  { skin: '#c8643a', dark: '#8a3f22', accent: '#e3b23c' }, // kobolds
  { skin: '#4a3f5c', dark: '#2e2640', accent: '#c7508f' }, // spiders
  { skin: '#e8dcc8', dark: '#a8998a', accent: '#b5543a' }, // sporefolk
];
const cell = 200, cols = 5;
const names = Object.keys(CAMPS);
const rows = Math.ceil(names.length / cols) * 2;
let svg = '';
names.forEach((name, i) => {
  const x = (i % cols) * cell, y = Math.floor(i / cols) * 2 * cell;
  for (let r = 0; r < 2; r++) {
    // Each camp twice: over 2x2 checker squares, with two palettes.
    for (let q = 0; q < 4; q++) svg += `<rect x="${x + (q % 2) * cell / 2}" y="${y + r * cell + Math.floor(q / 2) * cell / 2}" width="${cell / 2}" height="${cell / 2}" fill="${(q === 0 || q === 3) ? BOARD.light : BOARD.dark}"/>`;
    svg += place(CAMPS[name](PALS[(i + r * 2) % PALS.length]), x, y + r * cell, cell);
  }
  svg += `<text x="${x + 6}" y="${y + 16}" font-family="sans-serif" font-size="14" fill="#2b2622">${name}</text>`;
});
const W = cols * cell, H = rows * cell;
const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${svg}</svg>`;
writeFileSync(OUT + 'camps.png', new Resvg(doc, { fitTo: { mode: 'zoom', value: 1 } }).render().asPng());
// Small copy at play size, to check readability.
writeFileSync(OUT + 'camps-small.png', new Resvg(doc, { fitTo: { mode: 'zoom', value: 0.35 } }).render().asPng());
console.log('camps', names.length);
