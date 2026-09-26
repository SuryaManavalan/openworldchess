// Renders every asset to out/svg/*.svg, contact sheets to out/png/*.png
// (for quick review), and a gallery page at out/gallery.html.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { TEAMS, svgDoc, place } from './lib/style.mjs';
import { PIECES } from './assets/pieces.mjs';
import { BUILDINGS, RESOURCES, TERRAIN, tile } from './assets/world.mjs';

const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT + 'svg', { recursive: true });
mkdirSync(OUT + 'png', { recursive: true });

const BOARD = { light: '#eeeed2', dark: '#769656' };

// Lay assets out on a checkered strip, one per square.
function sheet(rows, cell = 100) {
  const cols = Math.max(...rows.map((r) => r.length));
  let s = '';
  rows.forEach((row, y) =>
    row.forEach((inner, x) => {
      s += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${(x + y) % 2 ? BOARD.dark : BOARD.light}"/>`;
      if (inner) s += place(inner, x * cell, y * cell, cell);
    }),
  );
  return { svg: s, w: cols * cell, h: rows.length * cell };
}

function writeSheet(name, { svg, w, h }, scale = 2) {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${svg}</svg>`;
  writeFileSync(`${OUT}svg/${name}.svg`, doc);
  const png = new Resvg(doc, { fitTo: { mode: 'zoom', value: scale } }).render().asPng();
  writeFileSync(`${OUT}png/${name}.png`, png);
  return doc;
}

const order = ['king', 'queen', 'elephant', 'bishop', 'knight', 'pawn'];
const pieceRows = [
  [...order.map((k) => PIECES[k]({ side: 'light', team: TEAMS.red })), PIECES.king({ side: 'light', team: TEAMS.red, emperor: true })],
  [...order.map((k) => PIECES[k]({ side: 'dark', team: TEAMS.blue })), PIECES.king({ side: 'dark', team: TEAMS.blue, emperor: true })],
];
const teamRow = Object.values(TEAMS).flatMap((team) => [PIECES.pawn({ team }), PIECES.knight({ team, side: 'dark' })]);

// A strip of terrain squares keeps its own checker.
function terrainSheet() {
  const kinds = Object.keys(TERRAIN);
  let s = '';
  kinds.forEach((k, y) => {
    for (let x = 0; x < 6; x++) s += place(tile(k, (x + y) % 2 ? 'dark' : 'light', x * 7 + y), x * 100, y * 100);
  });
  return { svg: s, w: 600, h: kinds.length * 100 };
}

export const sheets = {
  pieces: writeSheet('pieces', sheet(pieceRows)),
  teams: writeSheet('teams', sheet([teamRow])),
  buildings: writeSheet('buildings', sheet([Object.values(BUILDINGS).map((b) => b({ team: TEAMS.red }))], 200), 1),
  resources: writeSheet('resources', sheet([Object.values(RESOURCES).map((r) => r())])),
  terrain: writeSheet('terrain', terrainSheet(), 1),
  scene: writeSheet('scene', scene(), 1),
};

// Each piece on its own too, for use in the game later.
for (const k of order)
  for (const side of ['light', 'dark'])
    writeFileSync(`${OUT}svg/${k}-${side}.svg`, svgDoc(PIECES[k]({ side })));

export { scene };
console.log('built', Object.keys(sheets).join(', '));

// A small slice of the world: a red village by a river, a red troop heading
// out, and a blue army waiting on the far bank.
function scene() {
  const W = 14, H = 9;
  const water = (x, y) => x === 9 + (y > 4 ? 1 : 0) || x === 10 + (y > 4 ? 1 : 0);
  const sand = (x, y) => !water(x, y) && (water(x + 1, y) || water(x - 1, y));
  const village = (x, y) => x <= 6 && y >= 3;
  let ground = '';
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const kind = water(x, y) ? 'water' : sand(x, y) ? 'sand' : y === 5 && x <= 7 ? 'road' : village(x, y) ? 'plaza' : 'grass';
      ground += place(tile(kind, (x + y) % 2 ? 'dark' : 'light', x * 31 + y), x * 100, y * 100);
    }
  const R = TEAMS.red, B = TEAMS.blue;
  const things = [
    // [x, y, size, markup, flip]
    [0, 0, 1, RESOURCES.pine()], [1, 0, 1, RESOURCES.tree()], [3, 0, 1, RESOURCES.pine()],
    [0, 1, 1, RESOURCES.tree()], [2, 1, 1, RESOURCES.pine()], [0, 2, 1, RESOURCES.pine()],
    [12, 0, 1, RESOURCES.rock()], [13, 1, 1, RESOURCES.goldOre()], [12, 7, 1, RESOURCES.rock()], [13, 8, 1, RESOURCES.tree()],
    [0, 3, 2, BUILDINGS.barracks({ team: R })], [2, 3, 2, BUILDINGS.palace({ team: R })], [4, 3, 2, BUILDINGS.temple({ team: R })],
    [0, 6, 1, BUILDINGS.house({ team: R })], [1, 6, 1, BUILDINGS.house({ team: R })], [0, 7, 1, BUILDINGS.house({ team: R })],
    [4, 6, 2, BUILDINGS.stable({ team: R })], [6, 6, 1, RESOURCES.wheat()], [6, 7, 1, RESOURCES.wheat()], [6, 8, 1, RESOURCES.wheat()],
    [3, 6, 1, PIECES.king({ team: R, emperor: true })], [2, 6, 1, PIECES.pawn({ team: R })], [2, 8, 1, PIECES.pawn({ team: R })],
    [7, 1, 1, PIECES.queen({ team: R })], [8, 2, 1, PIECES.knight({ team: R }), true], [6, 2, 1, PIECES.pawn({ team: R })],
    [7, 3, 1, PIECES.pawn({ team: R })], [8, 3, 1, PIECES.bishop({ team: R })], [8, 1, 1, PIECES.king({ team: R })],
    [12, 3, 1, PIECES.knight({ side: 'dark', team: B })], [13, 4, 1, PIECES.king({ side: 'dark', team: B })],
    [12, 4, 1, PIECES.elephant({ side: 'dark', team: B })], [12, 5, 1, PIECES.pawn({ side: 'dark', team: B })],
    [13, 5, 1, PIECES.pawn({ side: 'dark', team: B })], [13, 3, 1, PIECES.bishop({ side: 'dark', team: B })],
  ];
  // Paint back to front so lower things overlap higher ones.
  things.sort((a, b) => a[1] + a[2] - (b[1] + b[2]));
  const objs = things.map(([x, y, s, m, f]) => place(m, x * 100, y * 100, s * 100, f)).join('');
  return { svg: ground + objs, w: W * 100, h: H * 100 };
}

// ---------- gallery page ----------
const inline = (doc) => doc.replace(/ width="\d+" height="\d+">/, ' role="img">');
const section = (title, note, doc, labels, wide = false) => `
<section>
  <header><h2>${title}</h2><p>${note}</p></header>
  <figure class="${wide ? 'wide' : ''}">${inline(doc)}</figure>
  ${labels ? `<ol class="labels" style="--n:${labels.length}">${labels.map((l) => `<li>${l}</li>`).join('')}</ol>` : ''}
</section>`;

const gallery = `<title>Open World Chess Art</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;700;900&family=JetBrains+Mono:wght@500&display=swap">
<style>
  :root { color-scheme: dark; --bg:#2b2926; --panel:#23211f; --line:#3d3a36; --ink:#ece6da; --dim:#a79f92; --accent:#95b957;
    --sans: Nunito, ui-rounded, "Segoe UI", system-ui, sans-serif; --mono: "JetBrains Mono", ui-monospace, Menlo, monospace; }
  body { background: var(--bg); color: var(--ink); font-family: var(--sans); font-size: 16px; line-height: 1.5; }
  main { max-width: 1120px; margin: 0 auto; padding: 40px 20px 72px; display: grid; gap: 56px; }
  .top h1 { font-size: clamp(30px, 5vw, 46px); font-weight: 900; line-height: 1.05; margin: 0 0 12px; text-wrap: balance; }
  .top p { color: var(--dim); max-width: 64ch; margin: 0; }
  .top .tag { font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
  section { display: grid; gap: 14px; }
  section header { display: grid; gap: 4px; }
  h2 { font-size: 22px; font-weight: 900; margin: 0; }
  section header p { color: var(--dim); margin: 0; max-width: 70ch; }
  figure { margin: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px; overflow-x: auto; }
  figure svg { display: block; width: 100%; height: auto; border-radius: 4px; }
  figure.wide svg { min-width: 560px; }
  .labels { list-style: none; margin: 0; padding: 0 14px; display: grid; grid-template-columns: repeat(var(--n), 1fr); gap: 4px;
    font-family: var(--mono); font-size: 12px; color: var(--dim); text-align: center; }
  .labels li { overflow-wrap: anywhere; }
  .ask { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 20px 22px; }
  .ask ul { margin: 8px 0 0; padding-left: 20px; display: grid; gap: 8px; color: var(--ink); }
  .ask b { color: var(--accent); }
  @media (max-width: 560px) { .labels { display: none; } main { gap: 40px; } }
</style>
<main>
  <div class="top">
    <div class="tag">Art direction · round 2</div>
    <h1>Open World Chess Art</h1>
    <p>First pass at the look. The pieces keep the classic Staunton shapes, thick dark outlines and flat shading that chess players already know. Stoic faces, helmets and a player-colored collar make them feel like soldiers living in the world. The ground is still a chessboard everywhere: every terrain type keeps a light and dark checker.</p>
  </div>
  ${section('A slice of the world', 'A red village by a river. The red Emperor (gold crown) stays home to keep the city standing, a red troop heads toward the ford, and a blue army waits on the far bank. City plazas use the classic board colors.', sheets.scene, null, true)}
  ${section('Pieces', 'Light and dark bodies, like white and black. The rook is a war elephant carrying the rook tower on its back. The last one is the Emperor, a king with a gold crown and a jewel.', sheets.pieces, ['king', 'queen', 'elephant', 'bishop', 'knight', 'pawn', 'emperor'])}
  ${section('Player colors', 'Each player gets a color that shows on collars, the knight’s mane, the elephant’s blanket and building flags. That lets many players share one world, not just white and black.', sheets.teams, ['red', '', 'blue', '', 'gold', '', 'violet', '', 'teal', ''])}
  ${section('Buildings', 'Each building borrows a shape from the piece it produces: the palace wears a crown and cross, the temple has a mitre spire, the barracks has rook towers, and the stable has a horseshoe. Each one covers 2×2 squares.', sheets.buildings, ['palace · king, queen', 'house · pawn', 'stable · knight', 'temple · bishop', 'barracks · elephant'])}
  ${section('Resources', 'A first guess at the resources: wood (two kinds of tree), stone, gold and food. None of these are decided yet.', sheets.resources, ['tree · wood', 'pine · wood', 'rock · stone', 'ore · gold', 'wheat · food'])}
  ${section('Terrain', 'Every terrain type keeps a light and dark checker so the world always reads as a board. From top to bottom: grass, sand, water, road, plaza.', sheets.terrain)}
  <div class="ask">
    <h2>Things to react to</h2>
    <ul>
      <li><b>Faces:</b> round 2 swapped the friendly eyes for stoic brows. Is this the right amount, or should it go further (sterner) or back off?</li>
      <li><b>Player identity:</b> is a colored collar enough, or should team color take up more of the body?</li>
      <li><b>The elephant:</b> is the tower on its back enough to say "rook"?</li>
      <li><b>Scale:</b> should buildings stay at 2×2 squares, or should the palace be bigger?</li>
      <li><b>Terrain:</b> keep the checker strong like now, or make it subtler outside cities?</li>
    </ul>
  </div>
</main>`;
writeFileSync(OUT + 'gallery.html', gallery);
