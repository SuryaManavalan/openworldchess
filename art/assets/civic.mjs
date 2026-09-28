// Civilized resources (docs/specs/visuals.md §13): inside a settlement, trees, rock, ore and
// wheat stay what they are, but are drawn tended, and grander as the settlement grows.
// Village, town and city each have a lone form and a clump form (3+ in a small area,
// drawn as one piece). The land sets the palette; the owner's color touches banners and
// sashes. Drawn in a 100x100 box, feet at about y = 88, like everything else.
import { MAT, part, line, circ, ell, rr, groundShadow } from '../lib/style.mjs';

// ---------- palettes by biome ----------

const LEAF = {
  meadow: ['#6fae4a', '#548f36'], woodland: ['#5e9e3f', '#467d2c'], birch: ['#8cc063', '#6fa24a'], autumn: ['#e08a3c', '#bf6a26'],
  taiga: ['#3f7a4c', '#2f5f3a'], tundra: ['#7fa38a', '#62866d'], highland: ['#6a9a4a', '#517d37'], savanna: ['#a5b04a', '#858f34'],
  desert: ['#8fa34a', '#728535'], badlands: ['#8a9448', '#6d7634'], jungle: ['#3f9a4a', '#2c7a36'], swamp: ['#6f8a44', '#566d33'],
  blossom: ['#f3a9c6', '#d987a8'], mushroom: ['#c9504a', '#a53d38'], blight: ['#8a7a9a', '#6c5e7c'], fey: ['#8fe0bf', '#6fc4a2'],
  crystal: ['#9fc9f5', '#7eaad8'], volcanic: ['#5c6a4a', '#465238'],
};
const STONE = {
  desert: ['#e3cc9a', '#c4ab76'], savanna: ['#d8c29a', '#b9a37a'], badlands: ['#cf9570', '#ae7552'], volcanic: ['#5a524e', '#433c39'],
  crystal: ['#cfdaf0', '#aebbd6'], tundra: ['#d6dbe0', '#b5bcc4'], blight: ['#7a7082', '#5f5667'], fey: ['#d8e6dc', '#b6c9bb'],
};
const leaf = (b) => LEAF[b] ?? LEAF.meadow;
const stone = (b) => STONE[b] ?? [MAT.stone, MAT.stoneShade];

// ---------- small parts ----------

const trunk = (x, y, h) => part(rr(x - 2.5, y - h, 5, h, 2), MAT.wood, null);
const crown = (x, y, r, [c, s]) => part(circ(x, y, r), c, s, { shadeX: x + r * 0.35 }) + part(circ(x - r * 0.35, y - r * 0.35, r * 0.28), 'rgba(255,255,255,0.18)', null, { stroke: false });
const fruit = (x, y) => part(circ(x, y, 2.2), '#e0503a', null, { stroke: false });
const flowerDots = (pts, cols = ['#f2a9c0', '#f7e08a', '#ffffff']) => pts.map(([x, y], i) => part(circ(x, y, 2.4), cols[i % cols.length], null, { stroke: false })).join('');
const sash = (x, y, w, team) => part(`M${x - w / 2} ${y} H${x + w / 2} L${x + w / 2 - 3} ${y + 5} H${x - w / 2 + 3} Z`, team, null);
const plinth = (x, y, w, h, [c, s]) => part(rr(x - w / 2, y, w, h, 2), c, s, { shadeX: x + w * 0.2 }) + part(rr(x - w / 2 - 3, y + h - 4, w + 6, 6, 2), c, s, { shadeX: x + w * 0.2 });

// Chess silhouettes for topiary and statues, centered on x, standing on y.
function chessShape(kind, x, y, s) {
  const P = (d) => d.replace(/(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)/g, (_, a, __, b) => `${(x + (+a) * s).toFixed(1)},${(y + (+b) * s).toFixed(1)}`);
  if (kind === 'knight') return P('M-12,0 L-10,-10 C-12,-18 -14,-26 -6,-34 C-2,-38 6,-38 10,-32 L14,-24 L8,-22 L4,-24 C2,-18 6,-12 10,-6 L12,0 Z');
  if (kind === 'rook') return P('M-11,0 L-9,-6 L-8,-26 L-11,-28 L-11,-36 L-6,-36 L-6,-32 L-2,-32 L-2,-36 L2,-36 L2,-32 L6,-32 L6,-36 L11,-36 L11,-28 L8,-26 L9,-6 L11,0 Z');
  if (kind === 'bishop') return P('M-10,0 L-8,-6 L-6,-18 C-10,-24 -8,-32 0,-38 C8,-32 10,-24 6,-18 L8,-6 L10,0 Z');
  return P('M-10,0 L-8,-6 L-5,-16 C-9,-18 -9,-26 0,-28 C9,-26 9,-18 5,-16 L8,-6 L10,0 Z'); // pawn
}
const PIECES = ['pawn', 'knight', 'bishop', 'rook'];

// ---------- trees ----------

function treeLone(tier, b, team, v) {
  const L = leaf(b);
  if (tier === 2) // a tended tree in a ring of stones
    return groundShadow(22, 88) + trunk(50, 86, 26) + crown(50, 46, 20, L) +
      [34, 42, 50, 58, 66].map((x, i) => part(ell(x, 86 - (i % 2) * 2, 5, 3.4), MAT.stone, null)).join('');
  if (tier === 3) // a young tree planted in a stone tub
    return groundShadow(18, 88) + part(rr(36, 70, 28, 16, 3), MAT.stone, MAT.stoneShade, { shadeX: 56 }) + trunk(50, 72, 20) + crown(50, 40, 17, L);
  // city: topiary clipped into a chess piece, in a tub with the owner's band
  const shape = PIECES[v % PIECES.length];
  return groundShadow(18, 88) + part(rr(34, 72, 32, 14, 3), MAT.stone, MAT.stoneShade, { shadeX: 58 }) + part(rr(34, 74, 32, 3, 1), team, null, { stroke: false }) +
    part(chessShape(shape, 50, 72, 1.25), L[0], L[1], { shadeX: 54 }) + line('M44 40 q6 -3 12 0 M42 56 q8 -3 16 0', 1.6, L[1]);
}

function treeClump(tier, b, team, v) {
  const L = leaf(b);
  if (tier === 2) { // a little orchard behind a low fence
    const t = (x, y, r) => trunk(x, y, 14) + crown(x, y - 18, r, L) + fruit(x - 4, y - 18) + fruit(x + 5, y - 22);
    return groundShadow(40, 90) + t(28, 74, 12) + t(72, 74, 12) + t(50, 66, 13) +
      line('M8 86 H92 M8 80 H92', 2.6, MAT.wood) + [10, 26, 42, 58, 74, 90].map((x) => part(rr(x - 2, 76, 4, 13, 1), MAT.wood, null)).join('');
  }
  if (tier === 3) // a green: trees on a lawn, with a bench
    return part(ell(50, 78, 44, 14), '#8fc063', null) + groundShadow(40, 90) +
      trunk(28, 76, 18) + crown(28, 50, 15, L) + trunk(72, 76, 18) + crown(72, 50, 15, L) +
      part(rr(40, 78, 20, 4, 1), MAT.wood, null) + line('M42 82 V87 M58 82 V87', 2.2, MAT.wood) + part(rr(40, 72, 20, 3, 1), MAT.wood, null);
  // city: a walled garden: hedges, flower beds, a gravel cross, a tree at the heart
  return groundShadow(46, 92) +
    part(rr(4, 58, 92, 32, 6), '#b9a883', null) +
    part(rr(4, 58, 92, 8, 4), L[0], L[1], { shadeX: 70 }) + part(rr(4, 82, 92, 8, 4), L[0], L[1], { shadeX: 70 }) +
    part(rr(8, 68, 36, 12, 3), '#6b8f3e', null) + part(rr(56, 68, 36, 12, 3), '#6b8f3e', null) +
    flowerDots([[14, 72], [22, 76], [30, 71], [38, 76], [62, 72], [70, 76], [78, 71], [86, 76]], v % 2 ? ['#f7e08a', '#ffffff', '#c7b4ff'] : ['#f2a9c0', '#f7e08a', '#ffffff']) +
    trunk(50, 76, 22) + crown(50, 46, 16, L) + part(rr(46, 26, 8, 6, 2), team, null, { stroke: false });
}

// ---------- rocks ----------

function rockLone(tier, b, team, v) {
  const S = stone(b);
  if (tier === 2) // a cairn
    return groundShadow(20, 88) + part(ell(50, 80, 18, 8), S[0], S[1], { shadeX: 58 }) + part(ell(50, 66, 13, 7), S[0], S[1], { shadeX: 56 }) +
      part(ell(50, 54, 9, 5.5), S[0], S[1], { shadeX: 54 }) + part(ell(50, 45, 5, 4), S[0], S[1], { shadeX: 52 });
  if (tier === 3) // a carved standing stone with moss
    return groundShadow(18, 88) + part('M36 86 L38 36 Q50 22 62 36 L64 86 Z', S[0], S[1], { shadeX: 54 }) +
      line('M44 52 L56 52 M50 46 V60 M45 68 q5 4 10 0', 2, S[1]) + part('M36 86 q8 -12 16 -4 q6 -10 12 4 Z', '#7fa65a', null, { stroke: false });
  // city: a statue of a chess piece on a plinth, with the owner's sash
  const shape = PIECES[(v + 1) % PIECES.length];
  return groundShadow(22, 90) + plinth(50, 68, 34, 18, S) + part(chessShape(shape, 50, 68, 1.2), S[0], S[1], { shadeX: 53 }) + sash(50, 70, 30, team);
}

function rockClump(tier, b, team, v) {
  const S = stone(b);
  if (tier === 2) { // a stretch of dry-stone wall
    const r = (x, y, w) => part(ell(x, y, w, 5), S[0], S[1], { shadeX: x + 2 });
    return groundShadow(42, 90) + r(18, 84, 10) + r(38, 84, 11) + r(60, 84, 10) + r(81, 84, 10) + r(28, 75, 10) + r(50, 75, 11) + r(71, 75, 10) + r(40, 66, 9) + r(60, 66, 9);
  }
  if (tier === 3) // a rock garden: raked gravel and three stones
    return part(ell(50, 76, 44, 15), '#e3dccb', null) +
      [0, 1, 2].map((i) => line(`M${12 + i * 4} ${70 + i * 5} Q50 ${62 + i * 5} ${88 - i * 4} ${70 + i * 5}`, 1.4, '#c7bea9')).join('') +
      part(ell(30, 72, 10, 8), S[0], S[1], { shadeX: 32 }) + part('M52 80 L55 50 Q62 44 68 52 L70 80 Z', S[0], S[1], { shadeX: 62 }) + part(ell(80, 80, 7, 5), S[0], S[1], { shadeX: 82 });
  // city: a monument: an obelisk on steps with banners
  return groundShadow(34, 92) + part(rr(22, 80, 56, 10, 2), S[0], S[1], { shadeX: 60 }) + part(rr(30, 72, 40, 9, 2), S[0], S[1], { shadeX: 58 }) +
    part('M42 72 L45 14 L50 6 L55 14 L58 72 Z', S[0], S[1], { shadeX: 52 }) + part(circ(50, 30, 4), MAT.gold, null) +
    line('M28 72 V50', 2.2) + part('M28 50 L40 54 L28 58 Z', team, null) + line('M72 72 V50', 2.2) + part('M72 50 L60 54 L72 58 Z', team, null);
}

const DRAW = { tree: [treeLone, treeClump], rock: [rockLone, rockClump] };

/** A civilized resource: kind, settlement tier (2 village, 3 town, 4 city), lone or clump. */
export function civic({ kind = 'tree', tier = 2, clump = false, biome = 'meadow', team = '#d9534a', variant = 0 } = {}) {
  const d = DRAW[kind];
  if (!d) return '';
  return (clump ? d[1] : d[0])(Math.max(2, Math.min(4, tier)), biome, team, variant);
}
export const CIVIC_KINDS = Object.keys(DRAW);
