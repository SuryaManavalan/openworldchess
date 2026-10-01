// Settlement decorations: small props that appear as a settlement grows
// (visuals.md §10). Same style as everything else: ink outline, flat fills.
import { MAT, INK, part, line, circ, ell, rr, groundShadow } from '../lib/style.mjs';

export function well() {
  return groundShadow(22, 86) +
    part(rr(30, 56, 40, 28, 4), MAT.stone, MAT.stoneShade, { shadeX: 58 }) +
    line('M34 64 H66 M34 72 H66', 1.8, MAT.stoneShade) +
    part(ell(50, 56, 20, 5), '#5a8fb0', null) +
    line('M34 56 V30 M66 56 V30', 3.4) +
    part('M26 32 L50 16 L74 32 Z', MAT.roofRed, MAT.roofRedShade, { shadeX: 52 }) +
    line('M40 36 H60', 2.4) + part(rr(46, 36, 8, 10, 2), MAT.wood, null);
}

export function lamp() {
  return groundShadow(10, 88) +
    part(rr(46, 40, 8, 48, 2), '#4a4540', null) +
    part(rr(40, 84, 20, 5, 2), '#4a4540', null) +
    part('M38 40 L42 20 H58 L62 40 Z', '#f6d58a', '#e3b23c', { shadeX: 54 }) +
    part('M36 20 L50 10 L64 20 Z', '#4a4540', null);
}

export function stall({ awning = '#d9534a' } = {}) {
  return groundShadow(30, 88) +
    part(rr(22, 58, 56, 28, 3), MAT.wood, MAT.woodShade, { shadeX: 62 }) +
    line('M26 44 V86 M74 44 V86', 3) +
    part('M18 46 L26 30 H74 L82 46 Z', awning, null) +
    line('M30 46 L34 30 M46 46 L48 30 M62 46 L60 30', 2.2, '#fff8ea') +
    part(circ(36, 54, 5), '#e3b23c', null) + part(circ(50, 53, 5), '#6fae4a', null) + part(circ(63, 54, 5), '#d9534a', null);
}

export function haystack() {
  return groundShadow(26, 86) +
    part('M24 84 C22 62 36 44 50 44 C64 44 78 62 76 84 Z', '#e8c65a', '#cfa43a', { shadeX: 58 }) +
    line('M34 60 q8 -4 16 0 M42 70 q8 -4 16 0 M30 76 q8 -3 14 0', 2, '#a9822a');
}

export function dummy() {
  return groundShadow(14, 88) +
    line('M50 86 V34', 4, INK) + line('M50 86 V34', 2.2, MAT.wood) +
    part(rr(34, 44, 32, 8, 3), MAT.wood, null) +
    part(ell(50, 56, 12, 14), '#e2cd96', '#c9b27a', { shadeX: 54 }) +
    part(circ(50, 30, 9), '#e2cd96', null) +
    line('M44 52 L56 60 M56 52 L44 60', 2, '#9e3b30');
}

export function flowers() {
  const f = (x, y, c) => part(circ(x, y, 4.5), c, null) + `<circle cx="${x}" cy="${y}" r="1.6" fill="#f3e08a"/>`;
  return groundShadow(24, 84) +
    part(rr(26, 70, 48, 14, 6), '#8a6d4f', null) +
    line('M34 70 V60 M46 70 V56 M58 70 V60 M68 70 V58', 2, '#548f36') +
    f(34, 58, '#c7508f') + f(46, 54, '#e3b23c') + f(58, 58, '#8e5bd1') + f(68, 56, '#d9534a');
}

export function crates() {
  return groundShadow(24, 88) +
    part(rr(26, 60, 26, 26, 2), MAT.wood, MAT.woodShade, { shadeX: 44 }) + line('M26 60 L52 86 M52 60 L26 86', 1.8) +
    part(ell(64, 76, 11, 12), '#9a6a3f', '#7d5230', { shadeX: 67 }) + line('M53 72 H75 M53 80 H75', 1.8) +
    part(rr(34, 44, 18, 16, 2), MAT.wood, null);
}

export function bench() {
  return groundShadow(24, 86) +
    part(rr(26, 62, 48, 7, 2), MAT.wood, null) +
    part(rr(26, 50, 48, 6, 2), MAT.wood, null) +
    line('M30 69 V84 M70 69 V84', 3);
}

export function banner({ team = '#d9534a' } = {}) {
  return groundShadow(12, 88) +
    line('M44 88 V14', 3.2) +
    part('M44 16 H70 V46 L57 40 L44 46 Z', team, null) +
    part(circ(44, 13, 3), '#e3b23c', null);
}

/** What a hauling pawn carries home, or a merchant's pack (drawn small, above the piece). */
export function cargo({ team = 'wheat' } = {}) {
  const kind = team;
  if (kind === 'tree') return part(rr(22, 50, 56, 14, 7), MAT.wood, MAT.woodShade, { shadeX: 60 }) + part(rr(26, 38, 50, 14, 7), MAT.wood, null) + part(ell(26, 45, 5, 7), '#d9b88a', null) + part(ell(22, 57, 5, 7), '#d9b88a', null);
  if (kind === 'rock') return part('M24 70 L30 44 L56 38 L74 52 L70 72 Z', MAT.stone, MAT.stoneShade, { shadeX: 56 }) + line('M40 50 L46 60', 2);
  if (kind === 'ore' || kind === 'gold') return part('M30 72 C24 56 34 40 50 40 C66 40 76 56 70 72 Z', '#b8894a', null) + line('M40 42 L50 34 L60 42', 3) + part(circ(50, 60, 7), MAT.gold, null);
  if (kind === 'pack') return part(rr(26, 36, 48, 40, 8), '#9a6a3f', '#7d5230', { shadeX: 58 }) + part(rr(32, 28, 36, 12, 5), '#c7508f', null) + line('M34 48 H66 M34 60 H66', 2.2, '#5c3d22') + part(circ(50, 54, 5), MAT.gold, null);
  // wheat bundle
  return line('M34 76 L50 34 M50 76 L50 30 M66 76 L50 34', 3, INK) + part(rr(36, 54, 28, 7, 3), MAT.wood, null) +
    part(ell(42, 36, 5, 8), MAT.gold, null) + part(ell(50, 30, 5, 8), MAT.gold, null) + part(ell(58, 36, 5, 8), MAT.gold, null);
}

/** Wall gate: an arch through the wall; closes when the town is under attack. */
export function gate({ team = '#d9534a', awning = 'open' } = {}) {
  const closed = awning === 'closed';
  return groundShadow(34, 88) +
    part('M16 88 V34 H30 V26 H40 V34 H60 V26 H70 V34 H84 V88 Z', MAT.stone, MAT.stoneShade, { shadeX: 66 }) +
    part('M34 88 V60 Q50 42 66 60 V88 Z', closed ? MAT.wood : '#3d3530', null) +
    (closed ? line('M42 56 V88 M50 50 V88 M58 56 V88 M36 70 H64', 2.2, MAT.woodShade) : '') +
    part('M44 26 H56 L50 34 Z', team, null) + line('M50 26 V12', 2.4) + part('M50 12 L62 15 L50 19 Z', team, null);
}

/** A round tower at a wall corner. */
export function tower({ team = '#d9534a', awning = 'stone' } = {}) {
  const wood = awning === 'wood';
  const body = wood ? MAT.wood : MAT.stone, shade = wood ? MAT.woodShade : MAT.stoneShade;
  return groundShadow(22, 88) +
    part('M30 88 V34 H70 V88 Z', body, shade, { shadeX: 58 }) +
    part('M26 36 V22 H34 V28 H42 V22 H50 V28 H58 V22 H66 V28 H74 V36 Z', body, shade, { shadeX: 58 }) +
    part(rr(44, 48, 12, 16, 6), '#3d3530', null) +
    line('M50 22 V8', 2.4) + part('M50 8 L63 11 L50 15 Z', team, null);
}

/** A bell tower in the town square; the bell rings at dawn. */
export function belltower({ team = '#d9534a' } = {}) {
  return groundShadow(20, 88) +
    part('M36 88 V36 H64 V88 Z', MAT.stone, MAT.stoneShade, { shadeX: 56 }) +
    part('M30 38 L50 14 L70 38 Z', MAT.roofBlue, MAT.roofBlueShade, { shadeX: 52 }) +
    part('M42 46 Q50 38 58 46 V60 H42 Z', '#3d3530', null) +
    part('M44 50 Q50 44 56 50 L58 60 H42 Z', MAT.gold, MAT.goldShade, { shadeX: 52 }) +
    part(rr(44, 70, 12, 18, 6), MAT.wood, null) + part(circ(50, 14, 2.6), team, null);
}

// A city's fountain: a round stone basin, a tiered spout, and water catching the light.
export function fountain() {
  return groundShadow(34, 86) +
    part(ell(50, 74, 36, 13), MAT.stone, MAT.stoneShade, { shadeX: 66 }) +
    part(ell(50, 70, 30, 9), '#6fb3d2', null) +
    part(ell(42, 68, 8, 2), '#bfe6f5', null, { stroke: false }) +
    part(rr(45, 40, 10, 30, 3), MAT.stone, MAT.stoneShade, { shadeX: 52 }) +
    part(ell(50, 42, 14, 5), MAT.stone, MAT.stoneShade, { shadeX: 56 }) +
    part(ell(50, 40, 10, 3), '#6fb3d2', null) +
    line('M50 38 C50 26 44 22 40 30 M50 38 C50 26 56 22 60 30', 2.6, '#8fd0e8') +
    part(circ(50, 22, 3.5), '#bfe6f5', null);
}

// A rounded shrub, clipped: the green edge of a plaza.
export function shrub({ awning = 'a' } = {}) {
  const flowers = awning === 'b' ? part(circ(40, 60, 3), '#f2a9c0', null, { stroke: false }) + part(circ(58, 54, 3), '#f7e08a', null, { stroke: false }) + part(circ(52, 68, 2.6), '#f2a9c0', null, { stroke: false }) : '';
  return groundShadow(24, 86) +
    part('M24 82 C16 70 22 50 38 48 C42 36 60 36 64 48 C80 48 86 70 76 82 Z', MAT.leaf, MAT.leafShade, { shadeX: 60 }) +
    line('M36 62 q6 -4 10 0 M54 58 q6 -4 10 0', 1.8, MAT.leafDark) + flowers;
}

// A young tree planted in a stone tub: towns bring the green inside.
export function planter() {
  return groundShadow(18, 88) +
    part(rr(36, 70, 28, 16, 3), MAT.stone, MAT.stoneShade, { shadeX: 56 }) +
    line('M50 70 V48', 3.4, '#7a5230') +
    part(circ(50, 36, 17), MAT.leaf, MAT.leafShade, { shadeX: 56 }) +
    part(circ(43, 31, 5), '#86c262', null, { stroke: false });
}

// A shrine of the old game (campaign.md §5.3): a weathered pedestal with a small board on
// top and a king of pale gold standing on it, glowing faintly.
export function shrine() {
  const sq = (x, y, dark) => part(rr(x, y, 7, 5, 0.5), dark ? '#8d7a5c' : '#e8dcc0', null, { stroke: false });
  let board = '';
  for (let r = 0; r < 3; r++) for (let f = 0; f < 4; f++) board += sq(36 + f * 7, 48 + r * 5, (r + f) % 2 === 1);
  return groundShadow(26, 88) +
    part(ell(50, 44, 30, 16), 'rgba(255,222,140,0.28)', null, { stroke: false }) +
    part('M34 86 L38 62 H62 L66 86 Z', MAT.stone, MAT.stoneShade, { shadeX: 56 }) +
    part(rr(30, 58, 40, 6, 2), MAT.stone, MAT.stoneShade, { shadeX: 56 }) +
    part(rr(33, 46, 34, 16, 2), '#6d5b43', null) + board +
    part('M46 46 L47 34 C44 32 44 27 50 26 C56 27 56 32 53 34 L54 46 Z', '#f3d27a', '#d9b04f', { shadeX: 52 }) +
    line('M50 26 V20 M47 22 H53', 2.2, '#8a6a2a') +
    line('M40 70 q5 3 10 0 M52 76 q4 2 8 0', 1.6, MAT.stoneShade) + part('M34 86 q6 -8 12 -2 q4 -6 8 2 Z', '#7fa65a', null, { stroke: false });
}

// A statue players raise in their squares (citybuilding.md §4): a chess knight in pale stone
// on a stepped plinth, the town's colour on a ribbon.
export function statue({ team = '#d9534a' } = {}) {
  return groundShadow(26, 90) +
    part(rr(26, 76, 48, 12, 3), MAT.stone, MAT.stoneShade, { shadeX: 62 }) +
    part(rr(32, 64, 36, 14, 3), MAT.stone, MAT.stoneShade, { shadeX: 60 }) +
    part(rr(34, 62, 32, 4, 2), team, null) +
    part('M38 64 C36 52 40 44 44 40 C38 38 36 30 42 22 C46 14 56 10 62 16 C68 20 70 30 66 38 L62 40 C64 48 64 56 62 64 Z', '#e6e0d4', '#c9c1b2', { shadeX: 56 }) +
    part(circ(56, 24, 2.2), INK, null, { stroke: false }) +
    line('M48 18 Q54 12 60 14', 2.2, '#c9c1b2');
}

// A tavern (2x2): timber-framed, a warm lit window, smoke, and a hanging sign with a tankard.
export function tavern({ team = '#d9534a' } = {}) {
  return groundShadow(42, 92) +
    part('M14 90 V48 H86 V90 Z', MAT.wall, MAT.wallShade, { shadeX: 66 }) +
    line('M14 62 H86 M30 48 V90 M70 48 V90 M30 62 L48 48 M70 62 L52 48', 2.4, '#6b4a2e') +
    part('M8 50 L50 18 L92 50 Z', MAT.roofRed, MAT.roofRedShade, { shadeX: 56 }) +
    line('M18 43 H82 M28 35 H72 M38 27 H62', 1.6, MAT.roofRedShade) +
    part(rr(66, 18, 9, 18, 2), MAT.stone, MAT.stoneShade, { shadeX: 72 }) +
    part(circ(71, 10, 5), '#e8e2d6', null, { stroke: false }) + part(circ(76, 4, 3.5), '#efe9de', null, { stroke: false }) +
    part(rr(42, 68, 16, 22, 7), MAT.wood, MAT.woodShade, { shadeX: 52 }) +
    part(rr(18, 66, 16, 14, 2), '#f6d58a', '#e3b23c', { shadeX: 28 }) + line('M26 66 V80 M18 73 H34', 1.8) +
    part(rr(66, 66, 16, 14, 2), '#f6d58a', '#e3b23c', { shadeX: 76 }) + line('M74 66 V80 M66 73 H82', 1.8) +
    line('M86 56 H96 M94 56 V60', 2.4) +
    part(rr(86, 60, 12, 12, 2), team, null) + part(rr(89, 63, 5, 6, 1), '#f6d58a', null);
}

export const DECOR = { shrine, well, lamp, stall, haystack, dummy, flowers, crates, bench, banner, cargo, gate, tower, belltower, fountain, shrub, planter, statue, tavern };
