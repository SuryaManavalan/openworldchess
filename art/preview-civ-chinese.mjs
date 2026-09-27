// Preview the Chinese civilization (cosmetic): pieces light and dark, buildings,
// and a small sheet at about play size. node art/preview-civ-chinese.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { TEAMS, place } from './lib/style.mjs';
import { PIECES, BUILDINGS } from './assets/civ-chinese.mjs';

const OUT = new URL('./out/png/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BOARD = { light: '#eeeed2', dark: '#769656' };

function sheet(rows, cell) {
  const cols = Math.max(...rows.map((r) => r.length));
  let s = '';
  rows.forEach((row, y) => row.forEach((inner, x) => {
    s += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${(x + y) % 2 ? BOARD.dark : BOARD.light}"/>`;
    if (inner) s += place(inner, x * cell, y * cell, cell);
  }));
  return { svg: s, w: cols * cell, h: rows.length * cell };
}
function write(name, { svg, w, h }, scale = 1) {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${svg}</svg>`;
  writeFileSync(`${OUT}${name}.png`, new Resvg(doc, { fitTo: { mode: 'zoom', value: scale } }).render().asPng());
}
const row = (side, team) => [PIECES.king({ side, team }), PIECES.king({ side, team, emperor: true }), PIECES.queen({ side, team }), PIECES.elephant({ side, team }), PIECES.bishop({ side, team }), PIECES.knight({ side, team }), PIECES.pawn({ side, team })];
const b = Object.values(BUILDINGS).map((f) => f({ team: TEAMS.blue }));
// pieces at 100, buildings at 200
const pieces = sheet([row('light', TEAMS.red), row('dark', TEAMS.blue)], 100);
const blds = sheet([b], 200);
write('civ-chinese', { svg: pieces.svg + `<g transform="translate(0 ${pieces.h})">${blds.svg}</g>`, w: Math.max(pieces.w, blds.w), h: pieces.h + blds.h }, 1.2);
const small = sheet([row('light', TEAMS.red), row('dark', TEAMS.blue), [...b, null, null]], 40);
write('civ-chinese-small', small, 2);
console.log('ok');
