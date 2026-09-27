// Biome nature (docs/specs/world.md §2b): the trees, rocks, ore and crops each
// biome draws for the four resource kinds. Same style as world.mjs: 100x100 box,
// ink outline, flat fills with a right-side shade band. Silhouette and color
// both change per biome so a place reads at a glance.
import { MAT, INK, part, line, circ, ell, rr, groundShadow } from '../lib/style.mjs';

const trunk = (x = 45, w = 10, top = 58, fill = MAT.wood, shade = MAT.woodShade) =>
  part(rr(x, top, w, 88 - top, 2), fill, shade, { shadeX: x + w * 0.6 });

// ---------- trees ----------

function oak() {
  return groundShadow(22, 90) + trunk() +
    part(circ(36, 52, 15), MAT.leafShade, null) +
    part(circ(64, 52, 15), MAT.leafShade, null) +
    part(circ(50, 36, 20), MAT.leaf, MAT.leafShade, { shadeX: 58 }) +
    `<circle cx="42" cy="30" r="4" fill="#9cd06e"/>`;
}

function pine() {
  return groundShadow(18, 90) + trunk(45, 10, 70) +
    part('M20 76 L50 44 L80 76 Z', MAT.leafDark, '#325f25', { shadeX: 54 }) +
    part('M26 58 L50 28 L74 58 Z', MAT.leafDark, '#325f25', { shadeX: 54 }) +
    part('M33 40 L50 12 L67 40 Z', MAT.leafDark, '#325f25', { shadeX: 54 });
}

function birch() {
  const bark = '#f3efe6';
  return groundShadow(18, 90) +
    part(rr(46, 40, 8, 48, 2), bark, '#d8d2c4', { shadeX: 51 }) +
    line('M46 52 h4 M50 62 h4 M46 72 h3 M51 80 h3', 2.2) +
    part(ell(50, 34, 17, 23), '#a6cf5e', '#86b047', { shadeX: 57 }) +
    `<circle cx="44" cy="24" r="1.8" fill="#d6ef8e"/><circle cx="54" cy="38" r="1.6" fill="#d6ef8e"/><circle cx="43" cy="44" r="1.5" fill="#d6ef8e"/>`;
}

function maple() {
  return groundShadow(22, 90) + trunk(46, 9, 60, '#8a5a3a', '#6e452b') +
    part(circ(34, 50, 14), '#c8502f', null) +
    part(circ(66, 50, 14), '#b8432a', null) +
    part(circ(50, 34, 19), '#e8843a', '#d0662e', { shadeX: 58 }) +
    `<circle cx="43" cy="28" r="3.6" fill="#f6b25a"/>` +
    // a few falling leaves
    `<path d="M24 76 l3 -2 l1 3 z M74 70 l3 -2 l1 3 z" fill="#e8843a" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
}

function snowpine() {
  const snow = '#f5f8fb', tier = (d, cap) => part(d, '#3f6e4e', '#2f5840', { shadeX: 54 }) + part(cap, snow, null);
  return groundShadow(18, 90) + trunk(45, 10, 72, '#7a5638', null) +
    tier('M20 78 L50 46 L80 78 Z', 'M34 63 L50 46 L66 63 Q58 60 50 64 Q42 60 34 63 Z') +
    tier('M26 60 L50 30 L74 60 Z', 'M37 46 L50 30 L63 46 Q56 43 50 47 Q44 43 37 46 Z') +
    tier('M33 42 L50 12 L67 42 Z', 'M40 28 L50 12 L60 28 Q55 25 50 29 Q45 25 40 28 Z') +
    part(ell(50, 86, 20, 3.5), snow, null, { stroke: false });
}

function juniper() {
  const leaf = '#5e8a5a', dark = '#476e45';
  return groundShadow(24, 90) +
    part('M47 88 C46 78 40 70 34 64 L39 60 C45 66 49 70 51 74 C54 66 58 58 64 52 L68 56 C62 64 57 74 56 88 Z', '#8a6446', null) +
    part(ell(33, 56, 17, 10), dark, null) +
    part(ell(66, 44, 18, 11), leaf, dark, { shadeX: 72 }) +
    part(ell(45, 30, 15, 10), leaf, dark, { shadeX: 52 }) +
    `<circle cx="40" cy="27" r="2" fill="#8ab5d8"/><circle cx="62" cy="40" r="2" fill="#8ab5d8"/><circle cx="28" cy="54" r="1.8" fill="#8ab5d8"/>`;
}

function acacia() {
  return groundShadow(30, 90) +
    part('M47 88 V56 L34 40 L38 37 L50 50 L60 38 L64 41 L53 56 V88 Z', '#8a6446', '#6e4e36', { shadeX: 51 }) +
    part('M10 38 Q14 26 32 26 Q42 18 58 22 Q72 18 84 26 Q94 30 90 38 Q70 44 50 42 Q28 44 10 38 Z', '#9ab04a', '#7f9638', { shadeX: 64 }) +
    line('M22 34 Q40 38 58 36', 1.8, '#6e8230');
}

function cactus() {
  const g = '#6ea85a', s = '#558c46';
  return groundShadow(20, 90) +
    part('M24 58 Q24 46 30 46 Q36 46 36 58 V66 H44 V72 H30 Q24 72 24 64 Z', g, null) +
    part('M76 44 Q76 34 70 34 Q64 34 64 44 V56 H56 V62 H70 Q76 62 76 54 Z', g, s, { shadeX: 72 }) +
    part('M42 88 V26 Q42 16 50 16 Q58 16 58 26 V88 Z', g, s, { shadeX: 53 }) +
    line('M50 22 V84', 1.6, '#3f6e34') +
    part(circ(50, 17, 3), '#f2a9c4', null);
}

function joshua() {
  const leaf = '#a0b86a', dark = '#80984e', bark = '#8a7a62';
  // Spiky rosettes of blade leaves at each branch tip.
  const tuft = (x, y) => {
    let d = '';
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 1.1 + (i / 6) * Math.PI * 1.2, r = i % 2 ? 10 : 13;
      d += `${i ? 'L' : 'M'}${(x + Math.cos(a - 0.28) * 6).toFixed(1)} ${(y + Math.sin(a - 0.28) * 6).toFixed(1)} L${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)} L${(x + Math.cos(a + 0.28) * 6).toFixed(1)} ${(y + Math.sin(a + 0.28) * 6).toFixed(1)} `;
    }
    return part(d + `L${x + 5} ${y + 5} L${x - 5} ${y + 5} Z`, leaf, dark, { shadeX: x + 3 });
  };
  return groundShadow(26, 90) +
    part('M46 88 V58 C40 56 32 50 28 38 L34 36 C38 46 44 50 47 50 V40 H53 V50 C58 48 64 40 66 30 L72 32 C70 44 62 54 54 58 V88 Z', bark, '#6e604c', { shadeX: 52 }) +
    line('M49 64 h3 M49 72 h3 M49 80 h3', 1.6) +
    tuft(31, 36) + tuft(50, 38) + tuft(69, 29);
}

function palm() {
  const g = '#4f9a4a', d = '#3a7a38';
  const frond = (dpath) => part(dpath, g, null);
  return groundShadow(24, 90) +
    part('M46 88 C45 70 47 50 50 36 L55 37 C53 52 53 70 55 88 Z', '#9a7a50', null) +
    line('M46 80 h8 M46 70 h8 M47 60 h7 M48 50 h7', 1.8) +
    frond('M51 34 C40 22 24 22 12 32 C24 30 36 32 51 38 Z') +
    frond('M51 34 C60 22 76 20 90 30 C76 30 64 32 51 38 Z') +
    part('M51 36 C44 42 34 52 30 64 C38 54 46 46 53 39 Z', d, null) +
    part('M52 36 C60 42 70 50 74 62 C66 54 58 46 50 40 Z', d, null) +
    frond('M51 34 C48 24 50 14 58 8 C56 18 55 26 53 36 Z') +
    part(circ(47, 40, 3.2), '#8a5a2a', null) + part(circ(55, 41, 3.2), '#8a5a2a', null);
}

function willow() {
  const g = '#8ab860', d = '#6e9a48';
  let strands = '';
  for (const x of [22, 30, 38, 62, 70, 78]) strands += line(`M${x} 40 Q${x + (x < 50 ? -2 : 2)} 58 ${x} ${70 + (x % 3) * 3}`, 3, d);
  return groundShadow(28, 90) +
    part('M44 88 C45 76 44 62 42 52 L50 46 L58 52 C56 62 55 76 56 88 Z', '#7a6448', '#5e4c36', { shadeX: 52 }) +
    part('M14 52 Q12 26 50 18 Q88 26 86 52 Q70 46 50 50 Q30 46 14 52 Z', g, d, { shadeX: 60 }) +
    strands;
}

function cherry() {
  const p = '#f4b6c8', d = '#e08fa8';
  return groundShadow(24, 90) +
    part('M45 88 V64 C40 60 34 56 30 48 L35 46 C38 52 44 56 48 57 V52 H53 V58 C58 54 62 50 64 44 L69 46 C66 54 60 60 55 64 V88 Z', '#6e4a3e', null) +
    part(circ(30, 44, 14), d, null) +
    part(circ(70, 44, 14), d, null) +
    part(circ(50, 32, 19), p, d, { shadeX: 58 }) +
    `<circle cx="40" cy="26" r="2.4" fill="#fff"/><circle cx="58" cy="38" r="2" fill="#fff"/><circle cx="26" cy="42" r="1.8" fill="#fff"/><circle cx="72" cy="40" r="1.8" fill="#fff"/>` +
    `<ellipse cx="30" cy="84" rx="3" ry="1.6" fill="${p}"/><ellipse cx="68" cy="86" rx="3" ry="1.6" fill="${p}"/>`;
}

function bigshroom() {
  const cap = '#d9543a', capShade = '#b5402c';
  return groundShadow(26, 90) +
    part('M42 88 C43 74 42 62 44 50 H56 C58 62 57 74 58 88 Z', '#efe6d2', '#d4c7ab', { shadeX: 52 }) +
    part('M12 52 C12 28 30 14 50 14 C70 14 88 28 88 52 Q50 60 12 52 Z', cap, capShade, { shadeX: 64 }) +
    part(ell(32, 34, 5, 4), '#f8f4ec', null) + part(ell(56, 26, 6, 4.5), '#f8f4ec', null) +
    part(ell(72, 42, 4.5, 3.5), '#f8f4ec', null) + part(ell(46, 44, 3.5, 3), '#f8f4ec', null);
}

function deadtree() {
  const b = '#8a847c', s = '#6e6962';
  return groundShadow(20, 90) +
    part('M44 88 C46 74 44 62 38 52 L28 42 L24 30 L29 29 L32 40 L42 48 C44 40 42 30 46 18 L51 19 C48 30 50 42 51 50 C56 44 64 40 70 30 L75 32 C70 44 62 50 56 58 C55 70 55 80 57 88 Z', b, s, { shadeX: 52 }) +
    line('M66 36 L76 38 M34 44 L22 48', 3, INK) +
    line('M66 36 L76 38 M34 44 L22 48', 1.8, b) +
    line('M47 70 q3 -3 1 -8', 1.6);
}

function silverwood() {
  const bark = '#eef0f2', leaf = '#9fe0d8', dark = '#6fc2ba';
  return groundShadow(22, 90) +
    `<circle cx="50" cy="38" r="34" fill="#c8fff6" opacity=".25"/>` +
    part('M45 88 C46 76 45 64 42 56 L50 52 L58 56 C55 64 54 76 55 88 Z', bark, '#c9ccd2', { shadeX: 52 }) +
    line('M48 64 q3 4 0 8', 1.4, '#9aa0aa') +
    part(ell(34, 50, 14, 11), dark, null) +
    part(ell(66, 50, 14, 11), dark, null) +
    part(ell(50, 32, 20, 18), leaf, dark, { shadeX: 58 }) +
    `<circle cx="42" cy="26" r="2" fill="#fff"/><circle cx="58" cy="36" r="1.6" fill="#fff"/><circle cx="30" cy="48" r="1.5" fill="#fff"/><circle cx="68" cy="22" r="1.4" fill="#e8fffb"/><circle cx="24" cy="30" r="1.2" fill="#e8fffb"/>`;
}

function crystaltree() {
  const a = '#b8d8f8', b = '#9a8ae0', sh = '#7a6ac8';
  const shard = (d, f, s = null) => part(d, f, s, { shadeX: 55 });
  return groundShadow(22, 90) +
    `<circle cx="50" cy="40" r="30" fill="#d8e8ff" opacity=".3"/>` +
    shard('M44 88 L46 52 L50 44 L54 52 L56 88 Z', '#c8d4e8', '#a8b4cc') +
    shard('M46 56 L26 40 L22 28 L34 34 L48 50 Z', b) +
    shard('M54 54 L72 36 L80 26 L76 38 L56 58 Z', b) +
    shard('M40 46 L42 20 L50 6 L58 20 L60 46 L50 54 Z', a, '#90b4e0') +
    line('M50 8 L50 52 M42 22 L50 30 L58 22', 1.4, '#ffffff') +
    `<circle cx="30" cy="30" r="1.6" fill="#fff"/><circle cx="74" cy="30" r="1.6" fill="#fff"/>`;
}

function charred() {
  const b = '#3a3430', s = '#2a2522', ember = '#ff7a2a';
  return groundShadow(20, 90) +
    part(ell(50, 87, 22, 4), '#5a5450', null, { stroke: false }) +
    part('M44 88 C46 74 44 60 38 50 L30 42 L27 32 L32 31 L35 40 L43 46 C44 36 45 28 48 20 L53 21 C50 30 51 40 52 48 C57 42 63 38 68 30 L73 32 C68 42 62 48 57 56 C56 68 56 78 58 88 Z', b, s, { shadeX: 52 }) +
    line('M48 80 L50 72 L47 66 M53 58 L51 52 M40 48 L36 44', 2, ember) +
    `<circle cx="62" cy="22" r="1.6" fill="${ember}"/><circle cx="36" cy="18" r="1.3" fill="#ffb25a"/><circle cx="70" cy="12" r="1.1" fill="#ffb25a"/>`;
}

export const TREES = { oak, pine, birch, maple, snowpine, juniper, acacia, cactus, joshua, palm, willow, cherry, bigshroom, deadtree, silverwood, crystaltree, charred };

// ---------- rocks ----------

const BOULDER = 'M16 86 C13 72 22 56 36 54 C42 42 62 40 70 52 C82 56 88 72 86 86 Z';
const PEBBLE = 'M70 86 C70 78 76 72 84 74 C90 76 92 82 91 86 Z';

const stone = (fill, shade, extra = '') =>
  groundShadow(36, 88) + part(BOULDER, fill, shade, { shadeX: 62 }) + extra + part(PEBBLE, fill, shade, { shadeX: 84 });

function boulder() {
  return stone(MAT.stone, MAT.stoneShade, line('M40 62 L46 70 L44 78 M64 58 L60 66', 2.2));
}

function mossy() {
  return stone('#a8a89a', '#8c8c7e',
    part('M24 60 C30 52 40 50 44 46 C50 40 62 40 68 50 C60 50 52 54 46 56 C38 58 30 60 24 60 Z', '#6fa04a', null) +
    line('M40 70 L46 76', 2.2) + `<circle cx="30" cy="74" r="2" fill="#6fa04a"/><circle cx="62" cy="72" r="1.6" fill="#6fa04a"/>`);
}

function snowy() {
  return stone('#a4acb4', '#88909a',
    part('M20 64 C22 56 30 54 36 54 C42 42 62 40 70 52 C78 54 84 60 84 66 C76 60 70 62 64 58 C58 62 50 58 44 62 C36 58 28 62 20 64 Z', '#f5f8fb', null) +
    line('M44 70 L50 78', 2.2) +
    part('M72 78 C74 74 80 72 86 75 C88 77 90 79 90 80 C84 78 78 80 72 78 Z', '#f5f8fb', null));
}

function sandstone() {
  const d = 'M14 86 V68 C14 62 20 60 26 60 V52 C26 46 34 44 40 44 H64 C72 44 78 48 78 56 V62 C84 62 88 66 88 72 V86 Z';
  return groundShadow(38, 88) + part(d, '#e2b87a', '#c99a5c', { shadeX: 64 }) +
    line('M26 60 H78 M16 74 H86', 2, '#b0844a') + line('M40 52 H60 M30 80 H48', 1.6, '#b0844a');
}

function redrock() {
  const d = 'M22 86 L26 56 L22 48 L30 30 H70 L76 40 L72 52 L78 86 Z';
  return groundShadow(34, 88) + part(d, '#c8643a', '#a54d2c', { shadeX: 60 }) +
    part('M30 30 H70 L74 36 H26 Z', '#e08a58', null) +
    line('M26 56 H72 M24 70 H76', 2, '#8a3f22') + line('M44 40 L42 52 M58 60 L60 68', 1.8, '#8a3f22');
}

function basalt() {
  const lava = '#ff7a2a';
  return groundShadow(36, 88) +
    part('M16 86 L20 64 L30 58 L34 44 L48 40 L60 46 L68 42 L80 54 L86 86 Z', '#3a3634', '#2a2624', { shadeX: 62 }) +
    line('M34 50 L42 60 L38 72 L46 84 M66 50 L60 62 L66 72', 2.4, lava) +
    `<circle cx="46" cy="60" r="1.6" fill="#ffd05a"/>` +
    part('M72 86 L74 78 L82 74 L90 80 L90 86 Z', '#3a3634', '#2a2624', { shadeX: 84 });
}

function crystalRock() {
  const spire = (x, y, w, h, f, s) => part(`M${x - w} ${y} L${x - w} ${y - h + w} L${x} ${y - h} L${x + w} ${y - h + w} L${x + w} ${y} Z`, f, s, { shadeX: x });
  return groundShadow(36, 88) +
    spire(36, 70, 6, 34, '#b8a8f0', '#9a86dc') +
    spire(62, 66, 7, 42, '#a8d0f8', '#86b0e0') +
    spire(50, 72, 8, 56, '#c8e0ff', '#98bce8') +
    spire(74, 76, 5, 24, '#b8a8f0', '#9a86dc') +
    part('M16 86 C16 76 24 70 34 70 C44 66 58 66 66 72 C78 72 86 78 86 86 Z', MAT.stone, MAT.stoneShade, { shadeX: 62 }) +
    line('M50 18 V60', 1.4, '#ffffff') + `<circle cx="30" cy="40" r="1.6" fill="#fff"/><circle cx="74" cy="44" r="1.4" fill="#fff"/>`;
}

function runestone() {
  return groundShadow(22, 88) +
    part('M34 88 L32 30 C32 20 40 14 50 14 C60 14 68 20 67 30 L66 88 Z', '#9a9a90', '#80807a', { shadeX: 58 }) +
    part('M34 72 C40 68 46 70 50 74 C44 76 38 76 34 76 Z', '#6fa04a', null) +
    `<g opacity=".95">` + line('M50 26 V58 M50 34 L42 42 M50 34 L58 42 M44 52 L56 52', 3, '#6fd1c4') + `</g>` +
    part('M22 88 C22 82 26 80 30 80 C34 80 36 84 36 88 Z', '#9a9a90', null);
}

function grave() {
  return groundShadow(36, 88) +
    part(BOULDER, '#6e6a66', '#57534f', { shadeX: 62 }) +
    line('M44 60 L50 70 M64 58 L60 64', 2.2) +
    part(ell(30, 84, 9, 7), '#ece6d6', null) +
    `<ellipse cx="27" cy="83" rx="2" ry="2.4" fill="${INK}"/><ellipse cx="33.5" cy="83" rx="2" ry="2.4" fill="${INK}"/>` +
    part('M58 84 L80 78 L81 81 L59 87 Z', '#ece6d6', null) +
    part(circ(80, 78.5, 2.4), '#ece6d6', null) + part(circ(58, 85.5, 2.4), '#ece6d6', null);
}

export const ROCKS = { boulder, mossy, snowy, sandstone, redrock, basalt, crystal: crystalRock, runestone, grave };

// ---------- ore (every ore works like gold) ----------

const oreBase = (inner) =>
  groundShadow(36, 88) + part(BOULDER, '#8f8a82', '#77726b', { shadeX: 62 }) + inner;

const nuggets = (fill, glint) => {
  const nug = (x, y) => part(`M${x} ${y - 5} L${x + 6} ${y} L${x + 2} ${y + 5} L${x - 5} ${y + 3} L${x - 5} ${y - 3} Z`, fill, null);
  return oreBase(nug(38, 64) + nug(58, 56) + nug(62, 75) + nug(32, 79) +
    `<circle cx="47" cy="54" r="1.8" fill="${glint}"/><circle cx="70" cy="66" r="1.5" fill="${glint}"/>`);
};

// Faceted gems poking out of the rock: a hexagonal point with a light facet.
const gems = (fill, light, dark) => {
  const gem = (x, y, s) =>
    part(`M${x - s} ${y + s} L${x - s} ${y - s * 0.6} L${x} ${y - s * 1.6} L${x + s} ${y - s * 0.6} L${x + s} ${y + s} Z`, fill, null) +
    `<path d="M${x - s} ${y - s * 0.6} L${x} ${y - s * 1.6} L${x} ${y + s} L${x - s} ${y + s} Z" fill="${light}"/>` +
    `<path d="M${x - s} ${y + s} L${x - s} ${y - s * 0.6} L${x} ${y - s * 1.6} L${x + s} ${y - s * 0.6} L${x + s} ${y + s} Z" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
    line(`M${x} ${y - s * 1.6} V${y + s}`, 1.2, dark);
  return oreBase(gem(40, 66, 6) + gem(60, 58, 7.5) + gem(66, 78, 5) + gem(30, 80, 4.5) +
    `<circle cx="56" cy="50" r="1.6" fill="#fff"/>`);
};

export const ORES = {
  gold: () => nuggets(MAT.gold, '#fff6c9'),
  silver: () => nuggets('#e4e8ee', '#ffffff'),
  copper: () => nuggets('#d98050', '#ffd2b0'),
  emerald: () => gems('#3fb56a', '#8ae0a8', '#257a48'),
  ruby: () => gems('#d9344a', '#f58a9a', '#8a1f2e'),
  amethyst: () => gems('#9a5ad9', '#c8a0f0', '#5a2a8a'),
  sapphire: () => gems('#3a6ad9', '#8ab0f5', '#1f3a8a'),
};

// ---------- crops (food) ----------

function wheat() {
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

function corn() {
  const plant = (x, h) =>
    line(`M${x} 88 V${88 - h}`, 5, INK) + line(`M${x} 88 V${88 - h}`, 2.6, '#7aa84a') +
    part(`M${x} ${80 - h * 0.35} C${x - 14} ${76 - h * 0.35} ${x - 18} ${66 - h * 0.35} ${x - 20} ${60 - h * 0.35} C${x - 10} ${66 - h * 0.35} ${x - 4} ${70 - h * 0.35} ${x} ${74 - h * 0.35} Z`, '#8ab85a', null) +
    part(`M${x} ${70 - h * 0.55} C${x + 12} ${66 - h * 0.55} ${x + 16} ${58 - h * 0.55} ${x + 18} ${52 - h * 0.55} C${x + 10} ${58 - h * 0.55} ${x + 4} ${62 - h * 0.55} ${x} ${64 - h * 0.55} Z`, '#8ab85a', null) +
    part(ell(x + 5, 76 - h * 0.6, 4, 9), '#f2c84a', null) +
    line(`M${x} ${88 - h} l-3 -6 M${x} ${88 - h} l3 -6`, 2, '#c8a050');
  return groundShadow(28, 88) + plant(30, 52) + plant(68, 58) + plant(49, 64);
}

function berries() {
  const b = (x, y) => part(circ(x, y, 3.4), '#c8304a', null) + `<circle cx="${x - 1}" cy="${y - 1.2}" r="1" fill="#f58a9a"/>`;
  return groundShadow(30, 88) +
    part('M16 86 C10 70 20 54 34 54 C38 42 62 40 68 52 C82 52 90 70 84 86 Z', '#4f8a4a', '#3f7038', { shadeX: 64 }) +
    part(ell(40, 58, 9, 6), '#6aa85a', null, { stroke: false }) +
    b(30, 66) + b(46, 58) + b(60, 70) + b(72, 62) + b(40, 78) + b(64, 52) + b(54, 80);
}

function pumpkins() {
  const pk = (x, y, r) =>
    part(ell(x, y, r * 1.25, r), '#e8843a', '#c8662a', { shadeX: x + r * 0.4 }) +
    line(`M${x} ${y - r} V${y + r} M${x - r * 0.6} ${y - r * 0.8} Q${x - r * 0.9} ${y} ${x - r * 0.6} ${y + r * 0.8} M${x + r * 0.6} ${y - r * 0.8} Q${x + r * 0.9} ${y} ${x + r * 0.6} ${y + r * 0.8}`, 1.6) +
    part(rr(x - 2, y - r - 5, 4, 6, 1), '#6e8a3a', null);
  return groundShadow(34, 88) +
    line('M16 80 Q30 70 44 76 Q60 84 84 72', 2.4, '#5a8a3a') +
    part(ell(24, 74, 7, 4), '#6aa84a', null) + part(ell(78, 68, 6, 3.5), '#6aa84a', null) +
    pk(36, 70, 16) + pk(68, 78, 11);
}

function rice() {
  const tuft = (x) => {
    let s = '';
    for (const [dx, h] of [[-5, 28], [0, 36], [5, 30]]) s += line(`M${x} 80 Q${x + dx} ${80 - h * 0.6} ${x + dx * 1.8} ${80 - h}`, 2.4, '#7ab84a');
    return s + part(ell(x + 6, 80 - 32, 2.5, 5), '#e8d890', null);
  };
  return groundShadow(34, 88) +
    part('M12 86 C12 78 22 74 50 74 C78 74 88 78 88 86 Z', '#8fc8d8', '#78b4c8', { shadeX: 70 }) +
    line('M22 82 q4 -2 8 0 M58 84 q4 -2 8 0', 1.6, '#e6f6fb') +
    tuft(26) + tuft(50) + tuft(72);
}

function glowcaps() {
  const glow = '#8ff0e0';
  const cap = (x, y, r, c) =>
    `<circle cx="${x}" cy="${y - r * 0.3}" r="${r * 1.9}" fill="${glow}" opacity=".25"/>` +
    part(`M${x - 2} 88 V${y} H${x + 2} V88 Z`, '#efe6d2', null) +
    part(`M${x - r} ${y + 1} C${x - r} ${y - r * 1.2} ${x + r} ${y - r * 1.2} ${x + r} ${y + 1} Z`, c, null) +
    `<circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.2}" fill="#fff"/>`;
  return groundShadow(30, 88) + cap(28, 64, 12, '#4fd0c0') + cap(66, 54, 16, '#4fb8d9') + cap(46, 76, 9, '#7ae0b0') + cap(82, 78, 7, '#4fd0c0');
}

function cactusfruit() {
  const g = '#6ea85a', s = '#558c46';
  const pad = (cx, cy, rx, ry, rot) => `<g transform="rotate(${rot} ${cx} ${cy})">` + part(ell(cx, cy, rx, ry), g, s, { shadeX: cx + rx * 0.3 }) + `</g>`;
  const fruit = (x, y) => part(ell(x, y, 3.4, 4.2), '#d9344a', null);
  return groundShadow(28, 88) +
    pad(50, 72, 14, 16, 0) + pad(34, 50, 11, 13, -25) + pad(66, 46, 11, 13, 25) +
    fruit(28, 38) + fruit(38, 36) + fruit(64, 33) + fruit(74, 36) +
    `<circle cx="46" cy="66" r="1" fill="${INK}"/><circle cx="54" cy="76" r="1" fill="${INK}"/><circle cx="34" cy="52" r="1" fill="${INK}"/><circle cx="66" cy="48" r="1" fill="${INK}"/>`;
}

function firebloom() {
  const flower = (x, y, r) => {
    let s = line(`M${x} 88 V${y}`, 2.4, '#4a3a2a');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      s += part(ell(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.7, r * 0.7), i % 2 ? '#f36a2a' : '#e8402a', null);
    }
    return s + part(circ(x, y, r * 0.6), '#ffd05a', null);
  };
  return groundShadow(30, 88) +
    part('M14 88 C18 82 30 80 50 80 C70 80 82 82 86 88 Z', '#5a5450', null) +
    `<circle cx="50" cy="56" r="30" fill="#ff8a3a" opacity=".15"/>` +
    flower(32, 58, 6) + flower(64, 50, 7) + flower(48, 70, 5);
}

export const CROPS = { wheat, corn, berries, pumpkins, rice, glowcaps, cactusfruit, firebloom };
