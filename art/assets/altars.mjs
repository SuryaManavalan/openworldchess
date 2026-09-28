// Altars (docs/specs/economy.md §8): a bishop raises one far from any king, and it looks
// like the land it stands on. Six styles share the biomes, each tinted for its land; all
// carry the bishop's mitre and a cloth in the owner's color. Drawn in a 100x100 box.
import { TEAMS, MAT, part, line, circ, ell, rr, groundShadow } from '../lib/style.mjs';

/** The bishop's mitre, small, as a capstone or finial. */
const mitre = (x, y, s = 1, fill = MAT.gold, shade = MAT.goldShade) =>
  part(`M${x} ${y - 14 * s} C${x + 7 * s} ${y - 9 * s} ${x + 8 * s} ${y - 3 * s} ${x + 7 * s} ${y + 2 * s} H${x - 7 * s} C${x - 8 * s} ${y - 3 * s} ${x - 7 * s} ${y - 9 * s} ${x} ${y - 14 * s} Z`, fill, shade, { shadeX: x + 2 * s }) +
  line(`M${x + 3 * s} ${y - 9 * s} L${x - 2 * s} ${y - 2 * s}`, 1.8);

/** The altar cloth in the owner's color, hanging over the front of a slab. */
const cloth = (x0, x1, y, team, drop = 12) =>
  part(`M${x0} ${y} H${x1} V${y + drop} L${(x0 + x1) / 2} ${y + drop - 4} L${x0} ${y + drop} Z`, team, null);

const flame = (x, y) => part(`M${x} ${y - 9} C${x + 4} ${y - 4} ${x + 4} ${y} ${x} ${y + 1} C${x - 4} ${y} ${x - 4} ${y - 4} ${x} ${y - 9} Z`, '#ffcf5a', null) + part(ell(x, y - 2, 1.6, 2.6), '#fff4c2', null, { stroke: false });

// Standing stones around a slab: temperate lands.
function cairn(p, team) {
  const stone = (x, y0, w, h) => part(`M${x} 84 V${y0 + 4} Q${x} ${y0} ${x + w / 2} ${y0} Q${x + w} ${y0} ${x + w} ${y0 + 4} V84 Z`, p.stone, p.shade, { shadeX: x + w * 0.62 });
  return groundShadow(40, 88) +
    stone(10, 44, 16, 40) + stone(74, 40, 16, 44) +
    part(rr(26, 58, 48, 26, 3), p.stone, p.shade, { shadeX: 60 }) +
    part(rr(22, 52, 56, 9, 2), p.cap, null) + cloth(34, 66, 60, team) +
    mitre(50, 48, 1.1, p.metal ?? MAT.gold, p.metalShade ?? MAT.goldShade) +
    flame(30, 50) + flame(70, 50) + (p.moss ? part(ell(18, 45, 6, 3), p.moss, null, { stroke: false }) + part(ell(82, 41, 5, 2.6), p.moss, null, { stroke: false }) : '');
}

// A timber shrine with a steep roof: forests and the cold north.
function shrine(p, team) {
  return groundShadow(36, 88) +
    part('M24 86 V46 H76 V86 Z', p.wood, p.woodShade, { shadeX: 62 }) +
    part('M30 86 V58 H70 V86 Z', '#3a2f28', null) +
    part(rr(36, 66, 28, 12, 2), p.stone, p.shade, { shadeX: 56 }) + cloth(40, 60, 70, team, 9) + flame(50, 64) +
    part('M14 50 L50 18 L86 50 Z', p.roof, p.roofShade, { shadeX: 54 }) +
    (p.snow ? part('M22 44 L50 20 L78 44 L70 42 L50 27 L30 42 Z', '#f4f7fb', null, { stroke: false }) : '') +
    mitre(50, 16, 0.8);
}

// A sandstone obelisk and sun-disc: dry lands.
function obelisk(p, team) {
  return groundShadow(34, 88) +
    part(rr(22, 72, 56, 14, 2), p.stone, p.shade, { shadeX: 58 }) +
    part('M40 72 L43 20 L50 12 L57 20 L60 72 Z', p.cap, p.shade, { shadeX: 52 }) +
    part(circ(50, 34, 6), p.metal ?? MAT.gold, null) +
    cloth(28, 72, 74, team, 10) +
    line('M46 50 H54 M46 58 H54', 1.8) + flame(30, 70) + flame(70, 70);
}

// A mossy stone wrapped in vines: wet, green lands.
function totem(p, team) {
  return groundShadow(34, 88) +
    part('M30 86 V36 Q30 24 50 24 Q70 24 70 36 V86 Z', p.stone, p.shade, { shadeX: 58 }) +
    part(rr(22, 70, 56, 16, 3), p.cap, null) + cloth(32, 68, 72, team, 10) +
    line('M34 30 C44 40 30 52 42 62 C50 68 60 58 66 66', 3, p.vine) +
    part(ell(38, 44, 4, 2.4), p.vine, null) + part(ell(62, 56, 4, 2.4), p.vine, null) +
    mitre(50, 26, 0.9) + flame(50, 66);
}

// A ring of spires or caps for the rare lands, each with its own glow.
function wonderland(p, team) {
  const spire = (x, h, w) => part(`M${x - w} 84 L${x} ${84 - h} L${x + w} 84 Z`, p.cap, p.shade, { shadeX: x + 1 });
  const body = p.form === 'cap'
    ? part('M44 84 V56 H56 V84 Z', p.stone, p.shade, { shadeX: 52 }) + part('M20 60 Q50 20 80 60 Q50 66 20 60 Z', p.cap, p.shade, { shadeX: 58 }) + part(circ(38, 48, 3.5), '#fff', null, { stroke: false }) + part(circ(60, 44, 2.6), '#fff', null, { stroke: false })
    : spire(20, 30, 7) + spire(80, 34, 7) + spire(34, 42, 6) + spire(66, 46, 6);
  return groundShadow(40, 88) +
    part(ell(50, 84, 38, 7), p.glow, null, { stroke: false }) +
    body +
    part(rr(34, 66, 32, 18, 3), p.stone, p.shade, { shadeX: 56 }) + cloth(38, 62, 68, team, 9) +
    mitre(50, p.form === 'cap' ? 62 : 60, 0.85, p.metal ?? MAT.gold, p.metalShade ?? MAT.goldShade) +
    part(circ(50, 76, 3), p.glow, null);
}

const P = {
  meadow: [cairn, { stone: '#c9c3b6', shade: '#a8a194', cap: '#e8e0cc', moss: '#86b85c' }],
  woodland: [cairn, { stone: '#b4ae9f', shade: '#958f81', cap: '#ddd5c1', moss: '#5f9a3e' }],
  birch: [shrine, { wood: '#e9e4d8', woodShade: '#cfc8b7', roof: '#7fa35a', roofShade: '#658744', stone: '#c9c3b6', shade: '#a8a194' }],
  autumn: [shrine, { wood: '#a06e44', woodShade: '#825634', roof: '#d0703a', roofShade: '#aa582c', stone: '#bdb7ab', shade: '#9d9689' }],
  taiga: [shrine, { wood: '#7c5a3c', woodShade: '#62462e', roof: '#4f6f58', roofShade: '#3e5946', stone: '#b4ae9f', shade: '#958f81', snow: true }],
  tundra: [shrine, { wood: '#9a8c7c', woodShade: '#7e7163', roof: '#8aa0b4', roofShade: '#6f8599', stone: '#d6dce2', shade: '#b4bcc4', snow: true }],
  highland: [cairn, { stone: '#a7a3a0', shade: '#86827f', cap: '#cfcac4', moss: '#7c9a5a' }],
  savanna: [obelisk, { stone: '#d7b98a', shade: '#b89a6c', cap: '#e6cc9c' }],
  desert: [obelisk, { stone: '#e8cf9a', shade: '#c9ae78', cap: '#f2dcaa' }],
  badlands: [obelisk, { stone: '#c98a5e', shade: '#a86e46', cap: '#dba077' }],
  jungle: [totem, { stone: '#9ea88c', shade: '#808a6e', cap: '#b8c1a4', vine: '#3f8a3a' }],
  swamp: [totem, { stone: '#8a8f7a', shade: '#6d725e', cap: '#a6ab94', vine: '#5a7a3a' }],
  blossom: [wonderland, { stone: '#efe2e6', shade: '#d4c2c8', cap: '#f5b8cf', glow: 'rgba(255,190,220,0.55)' }],
  mushroom: [wonderland, { form: 'cap', stone: '#e8dcc8', shade: '#c9bca6', cap: '#c9504a', glow: 'rgba(200,120,255,0.4)' }],
  blight: [wonderland, { stone: '#5a5360', shade: '#443e49', cap: '#6d6178', glow: 'rgba(150,230,120,0.4)', metal: '#b8c4a8', metalShade: '#95a086' }],
  fey: [wonderland, { stone: '#d9e6dc', shade: '#b8c8bb', cap: '#9fe0c4', glow: 'rgba(160,255,220,0.5)' }],
  crystal: [wonderland, { stone: '#c7d3e6', shade: '#a7b4c9', cap: '#9fc9f5', glow: 'rgba(170,210,255,0.55)', metal: '#e6f2ff', metalShade: '#bcd2ea' }],
  volcanic: [wonderland, { stone: '#4a4340', shade: '#352f2c', cap: '#5c524d', glow: 'rgba(255,120,60,0.55)' }],
};

/** An altar for a biome (falls back to the meadow's). */
export function altar({ biome = 'meadow', team = TEAMS.red } = {}) {
  const [draw, pal] = P[biome] ?? P.meadow;
  return draw(pal, team);
}

export const ALTAR_BIOMES = Object.keys(P);
