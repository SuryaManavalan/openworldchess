// The wilds' pieces as PNGs for the website's factions page (tools/site): each faction's king
// and pawn, 160 px, transparent. node art/wilds-png.mjs → apps/client/public/img/wilds/
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { creature } from './assets/creatures.mjs';
import { FACTIONS } from '../packages/shared/src/wilds.ts';

const OUT = new URL('../apps/client/public/img/wilds/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
for (const f of Object.values(FACTIONS)) for (const k of ['K', 'N', 'P']) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${creature(f, k)}</svg>`;
  writeFileSync(`${OUT}${f.id}-${k}.png`, new Resvg(svg, { fitTo: { mode: 'width', value: 160 } }).render().asPng());
}
console.log('wrote', Object.keys(FACTIONS).length * 3, 'pieces to', OUT);
