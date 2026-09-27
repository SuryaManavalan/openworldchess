// Preview: the Egyptian cosmetic civilization (docs/specs/cosmetics.md).
// node art/preview-civ-egyptian.mjs → art/out/png/civ-egyptian.png (+ -small)
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { TEAMS, place } from './lib/style.mjs';
import { PIECES, BUILDINGS } from './assets/civ-egyptian.mjs';

const OUT = new URL('./out/png/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const BOARD = ['#eeeed2', '#769656'];

const pieceRow = (side, team) => [
  PIECES.king({ side, team }), PIECES.king({ side, team, emperor: true }), PIECES.queen({ side, team }),
  PIECES.elephant({ side, team }), PIECES.bishop({ side, team }), PIECES.knight({ side, team }), PIECES.pawn({ side, team }),
];

function sheet(cell, bcell) {
  const rows = [pieceRow('light', TEAMS.red), pieceRow('dark', TEAMS.blue)];
  const blds = Object.values(BUILDINGS).map((b, i) => b({ team: [TEAMS.red, TEAMS.teal, TEAMS.violet, TEAMS.gold, TEAMS.blue][i] }));
  const w = Math.max(7 * cell, blds.length * bcell), h = 2 * cell + bcell;
  let s = `<rect width="${w}" height="${h}" fill="#b5d175"/>`;
  rows.forEach((row, y) => row.forEach((m, x) => {
    s += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${BOARD[(x + y) % 2]}"/>` + place(m, x * cell, y * cell, cell);
  }));
  blds.forEach((m, x) => { s += `<rect x="${x * bcell}" y="${2 * cell}" width="${bcell}" height="${bcell}" fill="${BOARD[x % 2]}"/>` + place(m, x * bcell, 2 * cell, bcell); });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${s}</svg>`;
}

writeFileSync(new URL('civ-egyptian.png', OUT), new Resvg(sheet(100, 200), { fitTo: { mode: 'zoom', value: 1 } }).render().asPng());
writeFileSync(new URL('civ-egyptian-small.png', OUT), new Resvg(sheet(40, 80), { fitTo: { mode: 'zoom', value: 1 } }).render().asPng());
console.log('ok');
