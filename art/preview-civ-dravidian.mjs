// Preview the Dravidian civilization: pieces (light and dark) and buildings.
// node art/preview-civ-dravidian.mjs → art/out/png/civ-dravidian.png, civ-dravidian-small.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { TEAMS, place } from './lib/style.mjs';
import { PIECES, BUILDINGS } from './assets/civ-dravidian.mjs';

const OUT = new URL('./out/png/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BOARD = { light: '#eeeed2', dark: '#769656' };
const grass = { light: '#b5d175', dark: '#95b957' };

function render(name, rows, cell, scale, bg = BOARD) {
  const cols = Math.max(...rows.map((r) => r.length));
  let s = '';
  rows.forEach((row, y) => row.forEach((inner, x) => {
    const c = typeof inner === 'object' ? inner : { m: inner, w: 1 };
    s += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${(x + y) % 2 ? bg.dark : bg.light}"/>`;
    if (c.m) s += place(c.m, x * cell, y * cell, cell);
  }));
  const w = cols * cell, h = rows.length * cell;
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${s}</svg>`;
  writeFileSync(OUT + name, new Resvg(doc, { fitTo: { mode: 'zoom', value: scale } }).render().asPng());
}

const order = ['king', 'queen', 'elephant', 'bishop', 'knight', 'pawn'];
const row = (side, team) => [PIECES.king({ side, team }), PIECES.king({ side, team, emperor: true }), ...order.slice(1).map((k) => PIECES[k]({ side, team }))];
const pieces = [row('light', TEAMS.red), row('dark', TEAMS.blue)];
const blds = Object.values(BUILDINGS).map((b) => b({ team: TEAMS.teal }));

render('civ-dravidian-pieces.png', pieces, 100, 1.5);
render('civ-dravidian-buildings.png', [blds], 200, 1, grass);
// Combined sheet: pieces rows at 100, buildings row scaled into the same width.
render('civ-dravidian.png', [...pieces.map((r) => r), blds.map((b) => b)], 100, 1.5);
// Small: roughly in-game size.
render('civ-dravidian-small.png', [...pieces, blds], 40, 1);
console.log('ok');
