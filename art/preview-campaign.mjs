// Preview: campaign art (Wonders, Relics, Hoards).
// node art/preview-campaign.mjs → art/out/png/campaign.png, campaign-small.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { TEAMS, place } from './lib/style.mjs';
import { WONDERS, RELICS, HOARDS } from './assets/campaign.mjs';

const OUT = new URL('./out/png/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const BOARD = { light: '#eeeed2', dark: '#769656' };

function sheet(rows) {
  // rows: [{ cell, items: [markup] }]
  let y = 0, w = 0, s = '';
  for (const { cell, items } of rows) {
    items.forEach((m, x) => {
      s += `<rect x="${x * cell}" y="${y}" width="${cell}" height="${cell}" fill="${(x + y / cell) % 2 ? BOARD.dark : BOARD.light}"/>`;
      s += place(m, x * cell, y, cell);
    });
    w = Math.max(w, items.length * cell);
    y += cell;
  }
  return { svg: s, w, h: y };
}

function write(name, { svg, w, h }, zoom) {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${svg}</svg>`;
  writeFileSync(new URL(`${name}.png`, OUT), new Resvg(doc, { fitTo: { mode: 'zoom', value: zoom } }).render().asPng());
}

const teams = [TEAMS.red, TEAMS.blue, TEAMS.gold, TEAMS.violet, TEAMS.teal];
const wonders = Object.values(WONDERS).map((f, i) => f({ team: teams[i] }));
const relics = Object.values(RELICS).map((f) => f());
const hoards = Object.values(HOARDS).map((f) => f());

write('campaign', sheet([{ cell: 300, items: wonders }, { cell: 100, items: [...relics] }, { cell: 100, items: hoards }]), 1);
// At play size: wonders over 3 squares at ~40px, relics and hoards at 40px.
write('campaign-small', sheet([{ cell: 120, items: wonders }, { cell: 40, items: [...relics, ...hoards] }]), 1);
console.log('ok');
