// Buildings, resources and terrain in the same style as the pieces.
// Buildings are drawn in a 100x100 box and usually placed over 2x2 squares.
import { TEAMS, MAT, INK, part, line, circ, ell, rr, groundShadow } from '../lib/style.mjs';

// Merlon-topped rectangle (the rook silhouette).
function cren(x0, x1, top, bottom, n, depth = 5) {
  const w = (x1 - x0) / (2 * n - 1);
  let d = `M${x0} ${bottom} V${top}`;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * 2 * w;
    d += ` H${x + w}`;
    if (i < n - 1) d += ` V${top + depth} H${x + 2 * w} V${top}`;
  }
  return d + ` V${bottom} Z`;
}

const flag = (x, y, team, h = 16) =>
  line(`M${x} ${y} V${y - h}`, 2.4) +
  part(`M${x} ${y - h} L${x + 13} ${y - h + 4} L${x} ${y - h + 8} Z`, team, null);

const win = (x, y, w = 9, h = 10) =>
  part(rr(x, y, w, h, 1.5), MAT.glass, null) + line(`M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}`, 1.8);

// ---------- buildings ----------

export function house({ team = TEAMS.red } = {}) {
  return groundShadow(34, 88) +
    part(rr(61, 24, 9, 20, 1), MAT.stone, null) +
    part('M24 87 V52 H76 V87 Z', MAT.wall, MAT.wallShade, { shadeX: 64 }) +
    part('M15 55 L50 24 L85 55 Z', MAT.roofRed, MAT.roofRedShade, { shadeX: 52 }) +
    part('M43 87 V73 Q43 66 50 66 Q57 66 57 73 V87 Z', MAT.wood, null) +
    win(29, 62) + win(62, 62) +
    flag(50, 26, team);
}

export function stable({ team = TEAMS.red } = {}) {
  return groundShadow(42, 88) +
    part('M12 87 V50 H88 V87 Z', MAT.wood, MAT.woodShade, { shadeX: 70 }) +
    part('M6 53 L19 34 L50 21 L81 34 L94 53 Z', MAT.roofRed, MAT.roofRedShade, { shadeX: 55 }) +
    part(rr(35, 58, 30, 29, 2), MAT.woodShade, null) +
    line('M35 58 L65 87 M65 58 L35 87', 2.6) +
    // horseshoe sign
    line('M44 44 V38 A6 6 0 0 1 56 38 V44', 3.6, MAT.gold) +
    win(17, 62, 10, 9) + win(73, 62, 10, 9) +
    flag(50, 23, team);
}

export function temple({ team = TEAMS.red } = {}) {
  const col = (x) => part(rr(x, 52, 7, 35, 1), MAT.wall, null);
  return groundShadow(38, 88) +
    part('M18 87 V48 H82 V87 Z', MAT.stone, MAT.stoneShade, { shadeX: 66 }) +
    col(22) + col(32) + col(61) + col(71) +
    part('M44 87 V70 Q50 60 56 70 V87 Z', MAT.wood, null) +
    // mitre spire: the bishop on the roof
    part(rr(42, 24, 16, 10, 1.5), MAT.wall, null) +
    part('M50 2 C58 8 61 16 59 26 H41 C39 16 42 8 50 2 Z', MAT.gold, MAT.goldShade, { shadeX: 54 }) +
    line('M54 9 L47 19', 2.2) +
    part('M12 50 L50 30 L88 50 Z', MAT.wall, MAT.wallShade, { shadeX: 56 }) +
    part(circ(50, 42, 4.5), team, null);
}

export function barracks({ team = TEAMS.red } = {}) {
  return groundShadow(42, 88) +
    part(cren(22, 78, 40, 87, 5), MAT.stone, MAT.stoneShade, { shadeX: 64 }) +
    part(cren(8, 30, 24, 87, 3), MAT.stone, MAT.stoneShade, { shadeX: 24 }) +
    part(cren(70, 92, 24, 87, 3), MAT.stone, MAT.stoneShade, { shadeX: 86 }) +
    part('M40 87 V66 Q50 54 60 66 V87 Z', '#3d3530', null) +
    line('M44 87 V64 M50 87 V60 M56 87 V64', 1.8, MAT.stoneShade) +
    part(rr(15, 44, 8, 11, 4), '#3d3530', null) + part(rr(77, 44, 8, 11, 4), '#3d3530', null) +
    part('M28 48 H72 V58 L50 62 L28 58 Z', team, null) +
    flag(19, 24, team, 14) + flag(81, 24, team, 14);
}

export function palace({ team = TEAMS.red } = {}) {
  const tower = (x) =>
    part(`M${x} 87 V44 H${x + 18} V87 Z`, MAT.wall, MAT.wallShade, { shadeX: x + 13 }) +
    part(`M${x - 3} 46 L${x + 9} 22 L${x + 21} 46 Z`, MAT.roofBlue, MAT.roofBlueShade, { shadeX: x + 11 }) +
    win(x + 5, 56, 8, 10);
  return groundShadow(46, 88) +
    part('M14 87 V58 H86 V87 Z', MAT.wall, MAT.wallShade, { shadeX: 72 }) +
    tower(8) + tower(74) +
    part('M33 87 V36 H67 V87 Z', MAT.wall, MAT.wallShade, { shadeX: 58 }) +
    // crown roof with the king's cross
    part('M31 38 L29 20 L39 28 L50 16 L61 28 L71 20 L69 38 Z', MAT.gold, MAT.goldShade, { shadeX: 58 }) +
    part('M47.5 17 V5 H52.5 V17 Z', MAT.gold, null) + part('M44 8 H56 V12.5 H44 Z', MAT.gold, null) +
    part('M41 87 V69 Q50 58 59 69 V87 Z', MAT.wood, null) +
    line('M41 69 Q50 58 59 69', 3, MAT.gold) +
    win(45.5, 44, 9, 11) +
    part(rr(19, 64, 10, 20, 1), team, null) + part(rr(71, 64, 10, 20, 1), team, null) +
    part(rr(33, 36, 34, 4, 1), team, null);
}

export const BUILDINGS = { palace, house, stable, temple, barracks };

// ---------- resources ----------

export function tree() {
  return groundShadow(22, 90) +
    part(rr(45, 58, 10, 30, 2), MAT.wood, MAT.woodShade, { shadeX: 51 }) +
    part(circ(36, 52, 15), MAT.leafShade, null) +
    part(circ(64, 52, 15), MAT.leafShade, null) +
    part(circ(50, 36, 20), MAT.leaf, MAT.leafShade, { shadeX: 58 }) +
    `<circle cx="42" cy="30" r="4" fill="#9cd06e"/>`;
}

export function pine() {
  return groundShadow(18, 90) +
    part(rr(45, 70, 10, 18, 2), MAT.wood, null) +
    part('M20 76 L50 44 L80 76 Z', MAT.leafDark, '#325f25', { shadeX: 54 }) +
    part('M26 58 L50 28 L74 58 Z', MAT.leafDark, '#325f25', { shadeX: 54 }) +
    part('M33 40 L50 12 L67 40 Z', MAT.leafDark, '#325f25', { shadeX: 54 });
}

const boulder = 'M16 86 C13 72 22 56 36 54 C42 42 62 40 70 52 C82 56 88 72 86 86 Z';

export function rock() {
  return groundShadow(36, 88) +
    part(boulder, MAT.stone, MAT.stoneShade, { shadeX: 62 }) +
    line('M40 62 L46 70 L44 78 M64 58 L60 66', 2.2) +
    part('M70 86 C70 78 76 72 84 74 C90 76 92 82 91 86 Z', MAT.stone, MAT.stoneShade, { shadeX: 84 });
}

export function goldOre() {
  const nug = (x, y) => part(`M${x} ${y - 5} L${x + 6} ${y} L${x + 2} ${y + 5} L${x - 5} ${y + 3} L${x - 5} ${y - 3} Z`, MAT.gold, null);
  return groundShadow(36, 88) +
    part(boulder, '#8f8a82', '#77726b', { shadeX: 62 }) +
    nug(38, 64) + nug(58, 56) + nug(62, 75) + nug(32, 79) +
    `<circle cx="47" cy="54" r="1.8" fill="#fff6c9"/><circle cx="70" cy="66" r="1.5" fill="#fff6c9"/>`;
}

export function wheat() {
  const stalk = (x, lean) => {
    const top = x + lean;
    let s = line(`M${x} 86 Q${x + lean * 0.3} 60 ${top} 36`, 2.4, INK);
    for (let i = 0; i < 4; i++) {
      const y = 38 + i * 7;
      s += part(ell(top - 4 - i * lean * 0.05, y, 3, 4.5), MAT.gold, null) +
        part(ell(top + 4 - i * lean * 0.05, y, 3, 4.5), MAT.gold, null);
    }
    return s + part(ell(top, 32, 3, 5), MAT.gold, null);
  };
  return groundShadow(24, 88) + stalk(34, -6) + stalk(66, 6) + stalk(50, 0) +
    part(rr(38, 66, 24, 6, 2), MAT.wood, null);
}

export const RESOURCES = { tree, pine, rock, goldOre, wheat };

// ---------- terrain (every terrain keeps the chessboard checker) ----------

export const TERRAIN = {
  grass: { light: '#b5d175', dark: '#95b957', mark: '#7fa246' },
  sand: { light: '#f1e2b5', dark: '#e2cd96', mark: '#c9b27a' },
  water: { light: '#8fd0e3', dark: '#71bcd4', mark: '#e6f6fb' },
  road: { light: '#d8d2c6', dark: '#bdb5a6', mark: '#a39a89' },
  plaza: { light: '#eeeed2', dark: '#769656', mark: null },
};

// One 100x100 square of terrain. `seed` varies the little details.
export function tile(kind, shade, seed = 0) {
  const t = TERRAIN[kind];
  let s = `<rect width="100" height="100" fill="${t[shade]}"/>`;
  const r = (i) => ((Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1 + 1) % 1;
  if (kind === 'grass')
    for (let i = 0; i < 3; i++) {
      const x = 12 + r(i) * 70, y = 14 + r(i + 5) * 70;
      s += line(`M${x} ${y} l3 -6 M${x + 5} ${y} l2 -8 M${x + 10} ${y} l-2 -6`, 2, t.mark);
    }
  if (kind === 'sand')
    for (let i = 0; i < 6; i++) s += `<circle cx="${10 + r(i) * 80}" cy="${10 + r(i + 9) * 80}" r="1.6" fill="${t.mark}"/>`;
  if (kind === 'water')
    for (let i = 0; i < 2; i++) {
      const x = 14 + r(i) * 50, y = 22 + i * 40 + r(i + 3) * 14;
      s += line(`M${x} ${y} q6 -6 12 0 t12 0`, 2.4, t.mark);
    }
  if (kind === 'road')
    for (const [x, y, w] of [[6, 6, 40], [52, 6, 42], [6, 52, 22], [34, 52, 60]])
      s += `<rect x="${x}" y="${y}" width="${w}" height="40" rx="6" fill="none" stroke="${t.mark}" stroke-width="2"/>`;
  return s;
}
