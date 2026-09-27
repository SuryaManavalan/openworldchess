// Contact sheets of every wild faction: one row per faction (K Q R B N P),
// with the name on the left. `node art/preview-creatures.mjs [ids...]`
// → art/out/png/creatures-{1,2}.png (or creatures-pick.png for a subset).
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { place } from './lib/style.mjs';
import { creature, CREATURE_KINDS } from './assets/creatures.mjs';
import { FACTIONS } from '../packages/shared/src/wilds.ts';

const OUT = new URL('./out/png/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BOARD = { light: '#eeeed2', dark: '#769656' };
const LABEL = 150;

function render(ids, name, cell = 100, scale = 1) {
  let s = '';
  ids.forEach((id, y) => {
    const f = FACTIONS[id];
    s += `<text x="8" y="${y * cell + cell / 2 + 5}" font-family="sans-serif" font-size="15" fill="#2b2622">${f.name}</text>`;
    CREATURE_KINDS.forEach((k, x) => {
      s += `<rect x="${LABEL + x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${(x + y) % 2 ? BOARD.dark : BOARD.light}"/>`;
      s += place(creature(f, k), LABEL + x * cell, y * cell, cell);
    });
  });
  const w = LABEL + 6 * cell, h = ids.length * cell;
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fff"/>${s}</svg>`;
  writeFileSync(`${OUT}${name}.png`, new Resvg(doc, { fitTo: { mode: 'zoom', value: scale }, font: { loadSystemFonts: true } }).render().asPng());
}

const pick = process.argv.slice(2);
if (pick.length) render(pick, 'creatures-pick', 100, 1.5);
else {
  const ids = Object.keys(FACTIONS);
  render(ids.slice(0, 16), 'creatures-1');
  render(ids.slice(16), 'creatures-2');
  // small, to check readability at game size
  render(ids.slice(0, 16), 'creatures-small', 40, 1);
}
console.log('ok');
