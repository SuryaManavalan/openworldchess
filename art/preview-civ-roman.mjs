// Preview: the Roman civilization (docs/specs/cosmetics.md).
// node art/preview-civ-roman.mjs → art/out/png/civ-roman.png and civ-roman-small.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { TEAMS, place } from './lib/style.mjs';
import { PIECES, BUILDINGS } from './assets/civ-roman.mjs';

const NAME = 'roman';
const OUT = new URL('./out/png/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BOARD = { light: '#eeeed2', dark: '#769656' };

const row = (side, team) => [
  PIECES.king({ side, team }), PIECES.king({ side, team, emperor: true }), PIECES.queen({ side, team }),
  PIECES.elephant({ side, team }), PIECES.bishop({ side, team }), PIECES.knight({ side, team }), PIECES.pawn({ side, team }),
];

function sheet(cell) {
  const rows = [row('light', TEAMS.red), row('dark', TEAMS.blue)];
  const W = 7 * cell, bcell = cell * 1.4;
  let s = '';
  rows.forEach((r, y) => r.forEach((m, x) => {
    s += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${(x + y) % 2 ? BOARD.dark : BOARD.light}"/>` + place(m, x * cell, y * cell, cell);
  }));
  const bs = Object.values(BUILDINGS);
  bs.forEach((b, x) => {
    const team = [TEAMS.red, TEAMS.blue, TEAMS.gold, TEAMS.violet, TEAMS.teal][x];
    s += `<rect x="${x * bcell}" y="${2 * cell}" width="${bcell}" height="${bcell}" fill="${x % 2 ? BOARD.dark : '#b5d175'}"/>` + place(b({ team }), x * bcell, 2 * cell, bcell);
  });
  const H = 2 * cell + bcell;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.max(W, 5 * bcell)} ${H}" width="${Math.max(W, 5 * bcell)}" height="${H}">${s}</svg>`;
}

writeFileSync(`${OUT}civ-${NAME}.png`, new Resvg(sheet(140)).render().asPng());
writeFileSync(`${OUT}civ-${NAME}-small.png`, new Resvg(sheet(40)).render().asPng());
console.log('ok');
