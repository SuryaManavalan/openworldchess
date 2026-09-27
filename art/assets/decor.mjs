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
  if (kind === 'gold') return part('M30 72 C24 56 34 40 50 40 C66 40 76 56 70 72 Z', '#b8894a', null) + line('M40 42 L50 34 L60 42', 3) + part(circ(50, 60, 7), MAT.gold, null);
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

export const DECOR = { well, lamp, stall, haystack, dummy, flowers, crates, bench, banner, cargo, gate, tower, belltower };
