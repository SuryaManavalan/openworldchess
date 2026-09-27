// Creatures of the wilds (docs/specs/wilds.md): the six chess roles, dressed as
// a faction's creatures. Each role keeps its chess cue so a player can always
// tell what a piece does: the king's cross-topped crown, the queen's spiked
// tiara, the bishop's slit mitre, the rook's battlement helm on a wide brute,
// the knight's profile, the small plain pawn. The creature shows in the head,
// the palette and the mount. Face left, like the player pieces.
//
// Heads and mounts live in creature-heads-a.mjs / creature-heads-b.mjs:
//   HEADS[head](ctx)  ctx = { cx, cy, r, pal, role }: a front-facing head centered
//                     at (cx, cy), mass radius about r (ears/horns may reach 0.8r
//                     further). No headgear: this file draws it.
//   MOUNTS[mount](pal) a knight-style profile (head and neck, facing left) in about
//                     x 18-75, y 8-78, without the base.
//   pal = { skin, dark, accent, eye, ink }
import { INK, MAT, part, line, circ, rr, groundShadow } from '../lib/style.mjs';
import * as A from './creature-heads-a.mjs';
import * as B from './creature-heads-b.mjs';

const HEADS = { ...A.HEADS, ...B.HEADS };
const MOUNTS = { ...A.MOUNTS, ...B.MOUNTS };

export const CREATURE_KINDS = ['K', 'Q', 'R', 'B', 'N', 'P'];

/** Mix a hex color toward black (f < 0) or white (f > 0). */
export function tint(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}

const palette = (art) => ({ skin: art.skin, dark: art.dark, accent: art.accent, eye: art.eye, ink: INK });

// ---------- fallbacks ----------

function genericHead({ cx, cy, r, pal }) {
  return part(circ(cx, cy, r), pal.skin, tint(pal.skin, -0.18), { shadeX: cx + r * 0.4 }) +
    `<ellipse cx="${cx - r * 0.35}" cy="${cy}" rx="${r * 0.13}" ry="${r * 0.18}" fill="${INK}"/>` +
    `<ellipse cx="${cx + r * 0.35}" cy="${cy}" rx="${r * 0.13}" ry="${r * 0.18}" fill="${INK}"/>`;
}

function genericMount(pal) {
  const head = 'M30 77 C30 64 40 58 44 52 C38 54 30 57 24 53 C19 50 18 44 22 41 C28 34 34 26 40 21 L41 12 L47 19 C58 18 71 26 72 42 C74 56 70 68 70 77 Z';
  return part(head, pal.skin, tint(pal.skin, -0.18), { shadeX: 58 }) +
    `<ellipse cx="38" cy="32" rx="1.8" ry="2.4" fill="${INK}"/>`;
}

// ---------- shared parts ----------

const base = (pal, w = 22) =>
  part(`M${50 - w} 88 Q${50 - w} 79 ${50 - w + 8} 77 H${50 + w - 8} Q${50 + w} 79 ${50 + w} 88 Z`, pal.dark, tint(pal.dark, -0.25));

const head = (pal, cx, cy, r, role, art) => (HEADS[art.head] ?? genericHead)({ cx, cy, r, pal, role });

// Gold crown with a cross on top (the king's mark). Sits with its band bottom at y.
function kingCrown(y, w = 10.5) {
  const top = y - 9;
  return part(`M${50 - w} ${y} V${top + 2} Q50 ${top - 2.5} ${50 + w} ${top + 2} V${y} Z`, MAT.gold, MAT.goldShade, { shadeX: 54 }) +
    part(`M47.5 ${top + 0.5} V${top - 10} H52.5 V${top + 0.5} Z`, MAT.gold, null) +
    part(`M43.5 ${top - 7.5} H56.5 V${top - 3} H43.5 Z`, MAT.gold, null) +
    part(circ(50, y - 4.2, 1.9), '#c8423a', null);
}

// Spiked tiara with orbs (the queen's mark).
function queenTiara(y, w = 11) {
  const t = y - 12;
  return part(`M${50 - w} ${y} L${50 - w - 2} ${t + 3} L${50 - w / 2} ${t + 9} L50 ${t - 2} L${50 + w / 2} ${t + 9} L${50 + w + 2} ${t + 3} L${50 + w} ${y} Z`, MAT.gold, MAT.goldShade, { shadeX: 55 }) +
    part(circ(50 - w - 2, t + 1, 2.8), MAT.gold, null) +
    part(circ(50, t - 4, 2.8), MAT.gold, null) +
    part(circ(50 + w + 2, t + 1, 2.8), MAT.gold, null);
}

// Pointed mitre-hood with the classic slit (the bishop's mark).
function bishopMitre(y, pal, w = 10) {
  const t = y - 21;
  return part(`M50 ${t} C${50 + w} ${t + 8} ${50 + w + 2} ${y - 9} ${50 + w} ${y} H${50 - w} C${50 - w - 2} ${y - 9} ${50 - w} ${t + 8} 50 ${t} Z`, pal.accent, tint(pal.accent, -0.22), { shadeX: 55 }) +
    line(`M${55} ${t + 9} L${47} ${t + 18}`, 2.6) +
    part(circ(50, t - 1.5, 3.2), pal.accent, null);
}

// Crenellated battlement helm (the rook's mark).
function rookHelm(y, pal, w = 15) {
  const top = y - 11, x0 = 50 - w, x1 = 50 + w, n = 3, cw = (x1 - x0) / (2 * n - 1);
  let d = `M${x0} ${y} V${top}`;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * 2 * cw;
    d += ` H${x + cw}`;
    if (i < n - 1) d += ` V${top + 5} H${x + 2 * cw} V${top}`;
  }
  d += ` V${y} Z`;
  return part(d, '#bdb7ab', '#9d9689', { shadeX: 60 }) + part(rr(x0 - 1, y - 4, 2 * w + 2, 5, 2), pal.accent, null);
}

// ---------- roles ----------

function kingPiece(pal, art) {
  return groundShadow(25) + base(pal, 24) +
    // robe with an accent mantle
    part('M27 78 Q36 60 41 55 H59 Q64 60 73 78 Z', pal.dark, tint(pal.dark, -0.2)) +
    part('M36 70 Q42 58 44 55 H56 Q58 58 64 70 Q50 64 36 70 Z', pal.accent, tint(pal.accent, -0.2)) +
    part(rr(38, 52, 24, 6, 3), MAT.gold, null) +
    head(pal, 50, 45, 12.5, 'K', art) +
    kingCrown(36);
}

function queenPiece(pal, art) {
  return groundShadow(24) + base(pal, 23) +
    part('M29 78 Q39 63 42 55 H58 Q61 63 71 78 Z', pal.accent, tint(pal.accent, -0.22)) +
    line('M40 70 Q50 66 60 70', 2.2) +
    part(rr(38, 51, 24, 6, 3), MAT.gold, null) +
    head(pal, 50, 45, 12, 'Q', art) +
    queenTiara(36.5);
}

function bishopPiece(pal, art) {
  return groundShadow(22) + base(pal, 21) +
    part('M33 78 Q40 66 42 58 H58 Q60 66 67 78 Z', pal.dark, tint(pal.dark, -0.2)) +
    // a stole down the front
    part('M46 58 H54 L55 77 H45 Z', pal.accent, null) +
    part(rr(38, 55, 24, 6, 3), pal.accent, null) +
    head(pal, 50, 48, 11, 'B', art) +
    bishopMitre(40.5, pal);
}

function rookPiece(pal, art) {
  // A squat, wide brute: the rook's block silhouette.
  return groundShadow(34, 90) +
    part('M16 88 Q16 80 22 78 H78 Q84 80 84 88 Z', pal.dark, tint(pal.dark, -0.25)) +
    // arms at the sides
    part('M20 78 C15 70 16 58 24 52 L30 56 C27 63 27 71 29 78 Z', pal.skin, tint(pal.skin, -0.2), { shadeX: 70 }) +
    part('M80 78 C85 70 84 58 76 52 L70 56 C73 63 73 71 71 78 Z', pal.skin, tint(pal.skin, -0.2), { shadeX: 70 }) +
    part('M24 79 Q24 58 32 51 H68 Q76 58 76 79 Z', pal.skin, tint(pal.skin, -0.2), { shadeX: 62 }) +
    // belt and a strap
    part(rr(25, 66, 50, 7, 2), pal.dark, null) +
    part(rr(46, 65, 8, 9, 1.5), MAT.gold, null) +
    head(pal, 50, 42, 15, 'R', art) +
    rookHelm(32, pal);
}

function knightPiece(pal, art) {
  return groundShadow(24) + base(pal, 24) + (MOUNTS[art.mount] ?? genericMount)(pal);
}

function pawnPiece(pal, art) {
  return groundShadow(22) + base(pal, 20) +
    part('M36 78 Q43 66 43 60 H57 Q57 66 64 78 Z', pal.dark, tint(pal.dark, -0.2)) +
    part(rr(39, 57, 22, 5, 2.5), pal.accent, null) +
    head(pal, 50, 46, 11.5, 'P', art);
}

const ROLE = { K: kingPiece, Q: queenPiece, R: rookPiece, B: bishopPiece, N: knightPiece, P: pawnPiece };

/** A wild piece: `faction` is a Faction (or anything with `.art`), kind is K/Q/R/B/N/P. */
export function creature(faction, kind) {
  const art = faction.art ?? faction;
  return ROLE[kind](palette(art), art);
}
