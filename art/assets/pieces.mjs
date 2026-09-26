// Chess pieces as world beings. Silhouettes stay close to the classic
// Staunton shapes so players recognize them; eyes, helmets and a team collar
// make them feel like characters. All face left; flip with place(..., flip).
import { SIDES, TEAMS, INK, MAT, part, line, circ, rr, eye, eyes, groundShadow } from '../lib/style.mjs';

const base = (pal, w = 22) =>
  part(`M${50 - w} 88 Q${50 - w} 79 ${50 - w + 8} 77 H${50 + w - 8} Q${50 + w} 79 ${50 + w} 88 Z`, pal.body, pal.shade);

const collar = (y, w, team) => part(rr(50 - w, y, 2 * w, 6, 3), team, null);

export function pawn({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  return groundShadow(22) +
    base(p, 20) +
    part('M36 78 Q43 66 43 58 H57 Q57 66 64 78 Z', p.body, p.shade) +
    collar(54, 13, team) +
    part(circ(50, 40, 13), p.body, p.shade) +
    // kettle helmet with a brim
    part('M37 41 A13 13 0 0 1 63 41 Z', p.shade, null) +
    part(rr(33, 39, 34, 5, 2.5), p.body, p.shade) +
    eyes(50, 48, 8, p, 1.7);
}

export function knight({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  const head = 'M30 77 C30 64 40 58 44 52 C38 54 30 57 24 53 C19 50 18 44 22 41 C28 34 34 26 40 21 L41 12 L47 19 C58 18 71 26 72 42 C74 56 70 68 70 77 Z';
  const mane = 'M47 19 C58 18 71 26 72 42 C74 56 70 68 70 77 L63 77 C63 66 67 55 64 42 C62 31 56 25 46 23 Z';
  return groundShadow(24) +
    base(p, 24) +
    part(head, p.body, p.shade, { shadeX: 58 }) +
    part(mane, team, null) +
    // mane tufts
    line('M60 30 L66 28 M64 42 L70 41 M64 55 L70 56', 2.4) +
    eye(38, 32, p, 2.4) +
    `<ellipse cx="24.5" cy="46" rx="1.4" ry="1.8" fill="${p.eye}"/>`;
}

export function bishop({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  return groundShadow(22) +
    base(p, 21) +
    part('M34 78 Q41 66 42 60 H58 Q59 66 66 78 Z', p.body, p.shade) +
    collar(56, 13, team) +
    part(circ(50, 48, 10), p.body, p.shade) +
    // mitre with the classic slit
    part('M50 16 C61 24 65 33 63 43 H37 C35 33 39 24 50 16 Z', p.body, p.shade) +
    line('M55 25 L47 35', 2.6) +
    part(circ(50, 14, 3.6), p.body, null) +
    eyes(50, 50, 8, p, 1.6);
}

export function elephant({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  // Slightly tapered pillar legs with toenails.
  const leg = (x, fill) =>
    part(`M${x} 60 H${x + 10} L${x + 9.5} 88 H${x + 0.5} Z`, fill, null) +
    line(`M${x + 2.5} 86 v-2 M${x + 5} 86 v-2 M${x + 7.5} 86 v-2`, 1.4);
  return groundShadow(36, 90) +
    line('M86 44 Q90 52 88 62', 2.4) +
    leg(66, p.shade) + leg(77, p.shade) +
    leg(36, p.body) + leg(49, p.body) +
    // sloped back, high at the shoulders
    part('M34 44 C40 32 66 30 80 36 C88 40 89 56 85 68 Q60 73 36 68 C32 60 31 51 34 44 Z', p.body, p.shade, { shadeX: 72 }) +
    part('M44 38 C56 33 70 33 80 37 L80 52 Q62 56 46 52 Z', team, null) +
    // the rook tower on its back
    part('M50 40 V14 H55.5 V19 H61 V14 H66.5 V19 H72 V14 H77.5 V40 Z', p.body, p.shade, { shadeX: 71 }) +
    line('M58 28 V33 M70 28 V33', 2.4) +
    // head and hanging trunk as one mass
    part('M42 40 C37 30 24 29 18 36 C13 42 13 51 15 58 C17 66 16 75 13 83 C12 87 17 89 19 86 C22 78 24 70 27 64 C33 62 40 61 43 56 Z', p.body, null) +
    line('M16 66 h4 M15.5 72 h4 M15 78 h3.5', 1.6) +
    // long tusk
    part('M24 59 C18 63 11 62 7 55 C12 58 18 57 22 54 Z', '#f6efdf', null) +
    // big flat ear
    part('M30 37 C40 33 49 40 48 53 C47 61 40 65 34 63 C29 57 28 46 30 37 Z', p.shade, null) +
    line('M34 43 C39 45 41 51 39 57', 1.6) +
    eye(24, 44, p, 2.1);
}

export function queen({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  return groundShadow(24) +
    base(p, 23) +
    part('M30 78 Q40 64 42 56 H58 Q60 64 70 78 Z', p.body, p.shade) +
    collar(52, 13, team) +
    part(circ(50, 44, 10), p.body, p.shade) +
    part('M36 37 L33 18 L42 28 L50 13 L58 28 L67 18 L64 37 Z', p.body, p.shade) +
    part(circ(33, 17, 3.2), p.body, null) +
    part(circ(50, 12, 3.2), p.body, null) +
    part(circ(67, 17, 3.2), p.body, null) +
    eyes(50, 46, 8, p, 1.6);
}

export function king({ side = 'light', team = TEAMS.red, emperor = false } = {}) {
  const p = SIDES[side];
  const crown = emperor ? MAT.gold : p.body;
  const crownShade = emperor ? MAT.goldShade : p.shade;
  return groundShadow(25) +
    base(p, 24) +
    // cape
    part('M27 78 Q37 62 41 57 H59 Q63 62 73 78 Z', p.body, p.shade) +
    collar(53, 14, team) +
    part(circ(50, 45, 10), p.body, p.shade) +
    part('M42 50 Q50 62 58 50 Q50 55 42 50 Z', p.shade, null) +
    part('M37 39 V28 Q50 22 63 28 V39 Z', crown, crownShade) +
    part('M47 24 V9 H53 V24 Z', crown, null) +
    part('M42 13 H58 V19 H42 Z', crown, null) +
    (emperor ? part(circ(50, 33, 2.6), TEAMS.red, null) : '') +
    eyes(50, 45, 8, p, 1.6);
}

export const PIECES = { king, queen, elephant, bishop, knight, pawn };
