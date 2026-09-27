// Product images for Stripe Checkout (docs/specs/cosmetics.md §2): one per Crown pack.
// node art/stripe-images.mjs → art/out/stripe/crowns-<n>.png (1024×1024, well under 2 MB)
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { place } from './lib/style.mjs';
import { pile } from './assets/crowns.mjs';

const OUT = new URL('./out/stripe/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const PACKS = [[500, 5, null], [1100, 7, '+10% bonus'], [2400, 10, '+20% bonus']];
const font = `font-family="Nunito, 'Trebuchet MS', 'DejaVu Sans', sans-serif" font-weight="800"`;
for (const [n, coins, bonus] of PACKS) {
  const board = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) board.push(`<rect x="${x * 128}" y="${y * 128}" width="128" height="128" fill="${(x + y) % 2 ? '#2d2a27' : '#34302c'}"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <defs><radialGradient id="glow" cx="50%" cy="52%" r="50%"><stop offset="0" stop-color="#f3d27a" stop-opacity=".45"/><stop offset="1" stop-color="#f3d27a" stop-opacity="0"/></radialGradient></defs>
    ${board.join('')}
    <circle cx="512" cy="470" r="440" fill="url(#glow)"/>
    ${place(pile(coins), 62, 30, 900)}
    <text x="512" y="930" text-anchor="middle" ${font} font-size="112" fill="#f3d27a" stroke="#23211f" stroke-width="10" paint-order="stroke">${n.toLocaleString('en-US')} Crowns</text>
    ${bonus ? `<g><rect x="712" y="70" width="250" height="80" rx="40" fill="#95b957"/><text x="837" y="126" text-anchor="middle" ${font} font-size="44" fill="#23211f">${bonus}</text></g>` : ''}
  </svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 }, font: { loadSystemFonts: true } }).render().asPng();
  const file = new URL(`crowns-${n}.png`, OUT);
  writeFileSync(file, png);
  console.log(file.pathname, (statSync(file).size / 1024).toFixed(0) + ' KB');
}
