// Preview: promoted pawns (battle.md §5) for players and a couple of factions.
// node art/preview-ascended.mjs → art/out/png/ascended.png
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { place, TEAMS } from './lib/style.mjs';
import { PIECES } from './assets/pieces.mjs';
import { creature } from './assets/creatures.mjs';
import { ascended } from './assets/ascended.mjs';
import { FACTIONS } from '../packages/shared/src/wilds.ts';

const NAME = { Q: 'queen', R: 'elephant', B: 'bishop', N: 'knight' };
const rows = [
  ['light', TEAMS.red, null], ['dark', TEAMS.blue, null], ['light', TEAMS.red, 'goblins'], ['light', TEAMS.red, 'wolves'],
].map(([side, team, f]) => ['Q', 'R', 'B', 'N'].flatMap((k) => {
  const piece = (kind) => (f ? creature(FACTIONS[f], kind) : kind === 'P' ? PIECES.pawn({ side, team }) : PIECES[NAME[kind]]({ side, team }));
  return [piece(k), ascended(piece(k), piece('P'))];
}));
let s = '';
rows.forEach((row, y) => row.forEach((m, x) => { s += `<rect x="${x * 100}" y="${y * 100}" width="100" height="100" fill="${(x + y) % 2 ? '#769656' : '#eeeed2'}"/>` + place(m, x * 100, y * 100); }));
const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400">${s}</svg>`;
mkdirSync(new URL('./out/png/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/png/ascended.png', import.meta.url), new Resvg(doc, { fitTo: { mode: 'zoom', value: 1.5 } }).render().asPng());
console.log('ok');
