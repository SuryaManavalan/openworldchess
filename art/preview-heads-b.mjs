// Preview for creature-heads-b.mjs: each head at r=10 (pawn) and r=14 (rook)
// on a plain body stub, then each mount on a base. Writes out/png/heads-b*.png.
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { part, place } from './lib/style.mjs';
import { HEADS, MOUNTS } from './assets/creature-heads-b.mjs';
import { FACTIONS } from '../packages/shared/src/wilds.ts';

const OUT = new URL('./out/png/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const palOf = (pick) => {
  const f = Object.values(FACTIONS).find(pick);
  const a = f?.art ?? { skin: '#999', dark: '#666', accent: '#c55', eye: '#fd3' };
  return { skin: a.skin, dark: a.dark, accent: a.accent, eye: a.eye, ink: '#2b2622' };
};
const base = (pal, w = 22) => part(`M${50 - w} 88 Q${50 - w} 79 ${50 - w + 8} 77 H${50 + w - 8} Q${50 + w} 79 ${50 + w} 88 Z`, pal.dark, null);
const body = (pal) => base(pal) + part('M34 78 Q42 64 43 56 H57 Q58 64 66 78 Z', pal.skin, pal.dark);

const cells = [];
for (const [name, fn] of Object.entries(HEADS)) {
  const pal = palOf((f) => f.art.head === name);
  cells.push(body(pal) + fn({ cx: 50, cy: 42, r: 10, pal, role: 'P' }));
  cells.push(body(pal) + fn({ cx: 50, cy: 40, r: 14, pal, role: 'R' }));
}
for (const [name, fn] of Object.entries(MOUNTS)) {
  const pal = palOf((f) => f.art.mount === name);
  cells.push(base(pal, 24) + fn(pal));
}
const COLS = 8, rows = Math.ceil(cells.length / COLS);
let svg = '';
cells.forEach((c, i) => {
  const x = (i % COLS) * 100, y = Math.floor(i / COLS) * 100;
  svg += `<rect x="${x}" y="${y}" width="100" height="100" fill="${(i % COLS + Math.floor(i / COLS)) % 2 ? '#769656' : '#eeeed2'}"/>` + place(c, x, y);
});
const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COLS * 100} ${rows * 100}">${svg}</svg>`;
for (const [file, z] of [['heads-b.png', 1.5], ['heads-b-small.png', 0.45]])
  writeFileSync(OUT + file, new Resvg(doc, { fitTo: { mode: 'zoom', value: z } }).render().asPng());
console.log('wrote', cells.length, 'cells');
