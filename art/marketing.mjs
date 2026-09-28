// Marketing images (not used by the game). node art/marketing.mjs → art/out/marketing/
// tiktok-logo.png: a square profile image built to survive a circular crop.
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { place, TEAMS } from './lib/style.mjs';
import { PIECES } from './assets/pieces.mjs';

const OUT = new URL('./out/marketing/', import.meta.url);
mkdirSync(OUT, { recursive: true });

function logo({ size = 1080, variant = 'green' } = {}) {
  const S = 1080;
  const light = variant === 'green' ? '#eeeed2' : '#3a3632', dark = variant === 'green' ? '#769656' : '#2d2a27';
  // A tilted chessboard receding behind, the Emperor in front with a gold glow.
  let board = '';
  const cell = 135;
  for (let y = -6; y < 14; y++) for (let x = -6; x < 14; x++)
    board += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${(x + y) % 2 ? dark : light}"/>`;
  const king = PIECES.king({ side: 'light', team: TEAMS.red, emperor: true });
  const knight = PIECES.knight({ side: 'dark', team: TEAMS.blue });
  const elephant = PIECES.elephant({ side: 'light', team: TEAMS.red });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
    <defs>
      <radialGradient id="glow" cx="50%" cy="46%" r="42%"><stop offset="0" stop-color="#fff3c4" stop-opacity=".95"/><stop offset=".55" stop-color="#f3d27a" stop-opacity=".45"/><stop offset="1" stop-color="#f3d27a" stop-opacity="0"/></radialGradient>
      <radialGradient id="vig" cx="50%" cy="50%" r="72%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
    </defs>
    <g transform="translate(540 600) scale(1 0.55) rotate(45) translate(-540 -540)">${board}</g>
    <rect width="${S}" height="${S}" fill="url(#vig)"/>
    <circle cx="540" cy="500" r="430" fill="url(#glow)"/>
    ${place(elephant, 130, 520, 330)}
    ${place(knight, 640, 540, 300, true)}
    ${place(king, 250, 170, 580)}
  </svg>`;
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

for (const [name, opts] of [['tiktok-logo.png', {}], ['tiktok-logo-dark.png', { variant: 'dark' }], ['tiktok-logo-200.png', { size: 200 }], ['logo-1024.png', { size: 1024 }], ['logo-1024-dark.png', { size: 1024, variant: 'dark' }]]) {
  const file = new URL(name, OUT);
  writeFileSync(file, logo(opts));
  console.log(file.pathname, Math.round(statSync(file).size / 1024) + ' KB');
}
