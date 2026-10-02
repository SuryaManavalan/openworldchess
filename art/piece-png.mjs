// One piece as a big transparent PNG (for video cards and posts).
//   node art/piece-png.mjs <set> <piece> <side> <px> <out.png> [team]
//   e.g. node art/piece-png.mjs civ-dravidian elephant light 900 out/day06/haathi.png red
// <set>: pieces (the standard set) or a civilization (civ-dravidian, civ-roman, …).
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { TEAMS } from './lib/style.mjs';

const [set, piece, side = 'light', px = '800', out, team = 'red'] = process.argv.slice(2);
const mod = await import(`./assets/${set}.mjs`);
const fn = mod.PIECES?.[piece] ?? mod[piece];
if (!fn) throw new Error(`no ${piece} in ${set}`);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${fn({ side, team: TEAMS[team] ?? team })}</svg>`;
writeFileSync(out, new Resvg(svg, { fitTo: { mode: 'width', value: Number(px) } }).render().asPng());
console.log('wrote', out);
