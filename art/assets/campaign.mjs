// Campaign art (docs/specs/campaign.md): Wonders (the capstone building, one
// style per civilization), Relics (trophies from rare camps, set in a town's
// plaza) and Hoards (the caches a scattered camp leaves behind).
// Same style as everything else: ink outline, flat fills, a right-side shade band.
import { TEAMS, MAT, INK, part, line, circ, ell, rr, groundShadow } from '../lib/style.mjs';

const GOLD = MAT.gold, GOLDS = MAT.goldShade;

const flag = (x, y, team, h = 16) =>
  line(`M${x} ${y} V${y - h}`, 2.2) +
  part(`M${x} ${y - h} L${x + 12} ${y - h + 4} L${x} ${y - h + 8} Z`, team, null);

const win = (x, y, w = 6, h = 8, fill = '#3d3530') => part(`M${x} ${y + h} V${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} V${y + h} Z`, fill, null);

// Merlon top (the rook silhouette).
function cren(x0, x1, top, bottom, n, depth = 4) {
  const w = (x1 - x0) / (2 * n - 1);
  let d = `M${x0} ${bottom} V${top}`;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * 2 * w;
    d += ` H${x + w}`;
    if (i < n - 1) d += ` V${top + depth} H${x + 2 * w} V${top}`;
  }
  return d + ` V${bottom} Z`;
}

const spark = (x, y, r, fill = '#fff6c9') =>
  `<path d="M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z" fill="${fill}"/>`;

// ---------- Wonders (3x3 footprint, like the palace) ----------

/** The classic style: a great crowned citadel. */
function classic({ team = TEAMS.red } = {}) {
  const tower = (x, w, top) =>
    part(`M${x} 88 V${top} H${x + w} V88 Z`, MAT.wall, MAT.wallShade, { shadeX: x + w * 0.68 }) +
    part(`M${x - 3} ${top + 2} L${x + w / 2} ${top - 20} L${x + w + 3} ${top + 2} Z`, MAT.roofBlue, MAT.roofBlueShade, { shadeX: x + w / 2 + 2 }) +
    win(x + w / 2 - 3, top + 10, 6, 9, MAT.glass) + win(x + w / 2 - 3, top + 28, 6, 9, MAT.glass) +
    flag(x + w / 2, top - 20, team, 12);
  return groundShadow(48, 90) +
    // outer curtain wall
    part(cren(4, 96, 62, 88, 12, 3), MAT.stone, MAT.stoneShade, { shadeX: 74 }) +
    tower(5, 17, 40) + tower(78, 17, 40) +
    // the keep
    part(cren(26, 74, 30, 88, 6, 4), MAT.wall, MAT.wallShade, { shadeX: 60 }) +
    part('M31 34 H69 V40 H31 Z', team, null) +
    // gold crown over the keep, with the king's cross
    part('M30 32 L27 16 L38 23 L50 11 L62 23 L73 16 L70 32 Z', GOLD, GOLDS, { shadeX: 58 }) +
    part(circ(27, 15, 2.6), GOLD, null) + part(circ(73, 15, 2.6), GOLD, null) +
    part('M48 12 V2 H52 V12 Z', GOLD, null) + part('M45 4.5 H55 V8 H45 Z', GOLD, null) +
    part(circ(50, 26, 2.6), TEAMS.red, null) +
    // rose window and great gate
    part(circ(50, 50, 6.5), MAT.glass, null) + line('M50 44 V56 M44 50 H56', 1.6) +
    part('M40 88 V70 Q50 58 60 70 V88 Z', MAT.wood, null) + line('M40 70 Q50 58 60 70', 2.6, GOLD) +
    win(33, 64, 5, 8, MAT.glass) + win(62, 64, 5, 8, MAT.glass) +
    part(rr(10, 70, 7, 16, 1), team, null) + part(rr(83, 70, 7, 16, 1), team, null) +
    spark(88, 20, 3) + spark(12, 26, 2.4);
}

/** Dravidian: a colossal temple complex under three gopurams. */
function dravidian({ team = TEAMS.red } = {}) {
  const C = { gr: '#dcbd8e', grS: '#b9956a', grD: '#9c7a52', terra: '#c8623f', maroon: '#8a2f3a', tur: '#e8b83a', teal: '#3f9a8c', wall: '#f4ead4', wallS: '#dccaa6' };
  const gopuram = (cx, base, top, wb, tiers) => {
    let s = '';
    const h = (base - top) / tiers;
    for (let i = 0; i < tiers; i++) {
      const y0 = base - i * h, y1 = y0 - h;
      const w0 = wb * (1 - i / (tiers + 1.2)), w1 = wb * (1 - (i + 1) / (tiers + 1.2));
      s += part(`M${cx - w0 / 2} ${y0} L${cx - w1 / 2} ${y1} H${cx + w1 / 2} L${cx + w0 / 2} ${y0} Z`, C.gr, C.grS, { shadeX: cx + w0 * 0.2 });
      // colorful sculpture niches
      const n = Math.max(1, Math.round(w1 / 7));
      for (let k = 0; k < n; k++) {
        const x = cx - w1 / 2 + (k + 0.5) * (w1 / n);
        s += `<rect x="${x - 1.2}" y="${y1 + h * 0.3}" width="2.4" height="${h * 0.42}" rx="1" fill="${[C.maroon, C.teal, C.tur][(k + i) % 3]}"/>`;
      }
      s += line(`M${cx - w1 / 2 - 1} ${y1} H${cx + w1 / 2 + 1}`, 1.8, C.grD);
    }
    const wt = wb * (1 - tiers / (tiers + 1.2));
    // barrel-vault crown with kalasam finials
    s += part(`M${cx - wt / 2 - 2} ${top} Q${cx} ${top - wt * 0.55} ${cx + wt / 2 + 2} ${top} Z`, C.terra, null);
    for (const dx of [-wt / 3, 0, wt / 3]) s += part(`M${cx + dx - 1.6} ${top - wt * 0.3} Q${cx + dx} ${top - wt * 0.3 - 7} ${cx + dx + 1.6} ${top - wt * 0.3} Z`, GOLD, null);
    return s;
  };
  return groundShadow(48, 90) +
    // the enclosure (prakaram) wall
    part('M3 88 V66 H97 V88 Z', C.wall, C.wallS, { shadeX: 74 }) +
    line('M3 70 H97', 2, C.maroon) +
    part('M8 88 V72 H14 V88 Z M86 88 V72 H92 V88 Z', C.gr, null) +
    gopuram(17, 70, 36, 24, 4) + gopuram(83, 70, 36, 24, 4) +
    // the great central gopuram
    gopuram(50, 76, 10, 46, 7) +
    // gate and threshold
    part('M43 88 V74 Q50 66 57 74 V88 Z', '#3d3530', null) + line('M43 74 Q50 66 57 74', 2.6, GOLD) +
    part(rr(34, 80, 6, 8, 1), team, null) + part(rr(60, 80, 6, 8, 1), team, null) +
    // pennants on the side gopurams
    flag(17, 26, team, 10) + flag(83, 26, team, 10) +
    // kolam at the threshold
    `<path d="M42 90 q8 -3 16 0" stroke="#fffdf4" stroke-width="1.6" fill="none"/>` +
    spark(66, 8, 2.6) + spark(30, 22, 2.2);
}

/** Roman: the Colosseum. */
function roman({ team = TEAMS.red } = {}) {
  const trav = '#e6dcc3', travS = '#c9bc9c', dark = '#8c7863';
  // Facade: four tiers, the top one broken away on the right as it is today.
  let s = groundShadow(48, 90);
  s += part('M4 88 V26 Q50 14 96 26 V44 L84 40 L80 50 L70 46 V88 Z', trav, travS, { shadeX: 76 });
  s += part('M70 88 V46 L80 50 L84 40 L96 44 V88 Z', '#d8ccae', travS, { shadeX: 90 });
  // tier cornices
  for (const y of [40, 58, 74]) s += line(`M4 ${y} H96`, 2.2, travS);
  s += line('M4 28 Q50 16 96 28', 2, travS);
  // arcades: arches on three tiers, windows in the attic
  const arches = (y0, h, n, x0 = 7, x1 = 93) => {
    let a = '';
    const w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * w + w * 0.18, aw = w * 0.64;
      // Thin outlines: a whole facade of arches at full ink weight turns into a black wall.
      a += `<path d="M${x} ${y0 + h} V${y0 + aw / 2 + 1} A${aw / 2} ${aw / 2} 0 0 1 ${x + aw} ${y0 + aw / 2 + 1} V${y0 + h} Z" fill="${dark}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
    }
    return a;
  };
  s += arches(75, 13, 8) + arches(59, 14, 8) + arches(42, 15, 6, 7, 69);
  for (let i = 0; i < 7; i++) s += `<rect x="${10 + i * 8}" y="${29 + Math.abs(3 - i) * 0.5}" width="3" height="5" rx="1" fill="${dark}"/>`;
  // imperial banners along the rim
  for (const x of [14, 32, 50]) s += flag(x, 24 - (x === 50 ? 2 : 0), team, 14);
  s += part(rr(22, 34, 34, 5, 1), team, null);
  // the gold eagle over the main arch
  s += part('M42 80 Q46 75 50 78 Q54 75 58 80 Q54 82 50 82 Q46 82 42 80 Z', GOLD, null);
  return s + spark(88, 36, 2.6) + spark(20, 16, 2.2);
}

/** Chinese: the Temple of Heaven's Hall of Prayer, on its three marble terraces. */
function chinese({ team = TEAMS.red } = {}) {
  const verm = '#c8372d', vermS = '#9f2a22', roof = '#2f6f9a', roofS = '#24587c', marble = '#f3efe5', marbleS = '#d8d1c1', lacq = '#3a302c';
  const eave = (cx, y, w, h) =>
    part(`M${cx - w / 2 - 4} ${y + h} Q${cx - w / 2} ${y + h - 3} ${cx - w / 2 + 4} ${y + h - 4} L${cx - w * 0.18} ${y} H${cx + w * 0.18} L${cx + w / 2 - 4} ${y + h - 4} Q${cx + w / 2} ${y + h - 3} ${cx + w / 2 + 4} ${y + h} Z`, roof, roofS, { shadeX: cx + w * 0.15 }) +
    line(`M${cx - w / 2 - 4} ${y + h} H${cx + w / 2 + 4}`, 2.4, GOLD);
  const drum = (cx, y, w, h) =>
    part(`M${cx - w / 2} ${y + h} V${y} H${cx + w / 2} V${y + h} Z`, verm, vermS, { shadeX: cx + w * 0.25 }) +
    [...Array(Math.max(2, Math.round(w / 8)))].map((_, i, a) => line(`M${cx - w / 2 + (i + 0.5) * (w / a.length)} ${y + 1} V${y + h - 1}`, 1.4, lacq)).join('');
  let s = groundShadow(48, 90);
  // three marble terraces with balustrades
  for (const [y, w] of [[80, 92], [72, 76], [64, 60]]) {
    s += part(`M${50 - w / 2} ${y + 8} V${y} H${50 + w / 2} V${y + 8} Z`, marble, marbleS, { shadeX: 50 + w * 0.22 });
    s += line(`M${50 - w / 2 + 2} ${y + 2.5} H${50 + w / 2 - 2}`, 1.2, marbleS);
  }
  s += part('M45 88 V80 H55 V88 Z', marbleS, null);
  // the hall: three drums and three round blue roofs
  s += drum(50, 54, 40, 10) + eave(50, 44, 52, 12);
  s += drum(50, 36, 30, 8) + eave(50, 26, 40, 11);
  s += drum(50, 19, 20, 7) + eave(50, 10, 28, 10);
  // gilded finial
  s += part(circ(50, 7, 3.4), GOLD, null) + part('M48.6 4 L50 -5 L51.4 4 Z', GOLD, null);
  // banners on the terrace
  s += flag(8, 80, team, 18) + flag(92, 80, team, 18);
  s += part(rr(44, 56, 12, 6, 1), team, null);
  return s + spark(78, 18, 2.6) + spark(22, 30, 2.2);
}

/** Egyptian: the Great Pyramid behind a pylon gate and two obelisks. */
function egyptian({ team = TEAMS.red } = {}) {
  const SAND = '#e6c98f', SANDSH = '#c9a66a', LAPIS = '#2f5aa8', TURQ = '#3fb3a8', CARN = '#b5413a', DOOR = '#3d3530';
  const obelisk = (x) =>
    `<path d="M${x - 3.5} 88 L${x - 2.5} 30 L${x} 24 L${x + 2.5} 30 L${x + 3.5} 88 Z" fill="${SAND}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<path d="M${x - 2.5} 30 L${x} 24 L${x + 2.5} 30 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    line(`M${x} 38 V80`, 0.9, SANDSH);
  let s = groundShadow(48, 90);
  // the Great Pyramid, with its gold capstone and courses
  s += part('M6 80 L50 2 L94 80 Z', SAND, SANDSH, { shadeX: 50 });
  for (let i = 1; i < 7; i++) { const y = 2 + i * 11, hw = (y - 2) * (44 / 78); s += line(`M${50 - hw} ${y} H${50 + hw}`, 1.2, SANDSH); }
  s += part('M42.4 15.5 L50 2 L57.6 15.5 Z', GOLD, GOLDS, { shadeX: 50 });
  // the pylon gate in front
  s += part('M20 88 L23 52 H45 L47 88 Z', SAND, SANDSH, { shadeX: 40 }) + part('M53 88 L55 52 H77 L80 88 Z', SAND, SANDSH, { shadeX: 72 });
  s += part('M22 52 H46 V48 H22 Z M54 52 H78 V48 H54 Z', LAPIS, null);
  s += part('M45 88 V60 H55 V88 Z', DOOR, null);
  // winged sun over the gate
  s += part('M30 58 Q40 50 50 55 Q60 50 70 58 Q60 62 50 60 Q40 62 30 58 Z', GOLD, GOLDS, { shadeX: 56 }) + part(circ(50, 57, 3.6), CARN, null);
  // hieroglyph bands in lapis and turquoise
  for (const x of [28, 36, 62, 70]) s += `<rect x="${x}" y="62" width="4" height="18" rx="1" fill="${x % 3 ? LAPIS : TURQ}" opacity=".85"/>`;
  // pennants on the pylon masts
  s += line('M25 52 V36 M75 52 V36', 2, INK) + flag(25, 36, team, 8) + flag(75, 36, team, 8);
  s += obelisk(10) + obelisk(90);
  return s + spark(50, -2, 3) + spark(82, 20, 2.2);
}

export const WONDERS = { classic, dravidian, roman, chinese, egyptian };

// ---------- Relics (1x1 trophies for a town's plaza) ----------

/** The shared stone plinth. */
const plinth = (top = 70) =>
  groundShadow(22, 90) +
  part(`M30 88 V${top + 6} H70 V88 Z`, MAT.stone, MAT.stoneShade, { shadeX: 60 }) +
  part(`M27 ${top + 6} V${top} H73 V${top + 6} Z`, '#cfc9bd', MAT.stoneShade, { shadeX: 62 }) +
  line(`M36 ${top + 12} H64`, 1.4, MAT.stoneShade);

function dragon() {
  const bone = '#efe6cf', boneS = '#cbbf9f';
  return plinth() +
    // horns sweeping back
    part('M36 38 Q22 26 24 12 Q32 26 42 32 Z', bone, null) + part('M64 38 Q78 26 76 12 Q68 26 58 32 Z', bone, null) +
    // the skull, snout forward
    part('M32 46 Q32 30 50 28 Q68 30 68 46 L62 60 Q56 70 50 70 Q44 70 38 60 Z', bone, boneS, { shadeX: 58 }) +
    part(ell(42, 44, 5, 4), '#3d3530', null) + part(ell(58, 44, 5, 4), '#3d3530', null) +
    part(circ(42, 44, 1.6), '#e05a3a', null) + part(circ(58, 44, 1.6), '#e05a3a', null) +
    line('M46 62 L47 66 M50 62 V67 M54 62 L53 66', 1.6) + part(ell(46, 56, 1.6, 1.2), '#3d3530', null) + part(ell(54, 56, 1.6, 1.2), '#3d3530', null) +
    spark(74, 22, 3) + spark(26, 50, 2.2);
}

function sphinx() {
  const SAND = '#e6c98f', SANDSH = '#c9a66a', LAPIS = '#2f5aa8';
  return plinth() +
    // nemes headdress
    part('M30 70 L34 36 Q50 20 66 36 L70 70 Z', LAPIS, '#23468a', { shadeX: 58 }) +
    line('M33 46 H67 M32 54 H68 M31 62 H69', 2, GOLD) +
    // face
    part('M38 40 Q50 30 62 40 V58 Q50 68 38 58 Z', SAND, SANDSH, { shadeX: 56 }) +
    line('M42 46 H47 M53 46 H58', 2.4) + line('M47 56 H53', 1.8) +
    part('M47 60 H53 L52 68 H48 Z', '#b98a4a', null) +
    part('M47 28 Q50 24 53 28 L51 32 H49 Z', GOLD, null) +
    spark(72, 26, 2.8);
}

function kitsune() {
  const fox = '#f4ead8', foxS = '#d9c9ad', verm = '#c8372d';
  let tails = '';
  // A fan of broad plumed tails behind the fox, each tipped in red.
  for (const a of [-62, -34, 0, 34, 62]) {
    tails += `<g transform="translate(50 64) rotate(${a}) translate(0 -24)">` +
      part(ell(0, 0, 7, 20), fox, foxS, { shadeX: 3 }) + part(ell(0, -15, 4.2, 5.4), verm, null) + `</g>`;
  }
  return plinth() + tails +
    // seated fox with red markings
    part('M40 70 Q38 52 44 44 H56 Q62 52 60 70 Z', fox, foxS, { shadeX: 55 }) +
    part('M42 44 L40 30 L47 38 H53 L60 30 L58 44 Q50 52 42 44 Z', fox, foxS, { shadeX: 54 }) +
    line('M44 40 L47 42 M56 40 L53 42', 1.8, verm) + part(ell(50, 46, 1.6, 1.2), INK, null) +
    part(rr(44, 52, 12, 4, 2), verm, null) +
    spark(84, 16, 2.8) + spark(16, 20, 2.2);
}

function griffon() {
  const feather = '#e0b060', featherS = '#b98a3e', white = '#f4ead8';
  return plinth() +
    // a great griffon feather in a gold holder
    part('M50 72 Q38 50 42 26 Q46 12 52 10 Q60 22 58 44 Q56 62 50 72 Z', white, '#ddd1bb', { shadeX: 54 }) +
    part('M50 72 Q44 54 46 34 Q48 22 52 16 Q54 30 52 48 Q51 62 50 72 Z', feather, featherS, { shadeX: 51 }) +
    line('M50 70 Q49 40 52 14', 1.6) +
    line('M48 30 L42 26 M48 40 L41 36 M49 50 L42 47 M53 32 L58 28 M53 42 L59 38', 1.3, featherS) +
    part(rr(43, 64, 14, 7, 2), GOLD, GOLDS, { shadeX: 52 }) +
    spark(68, 18, 3) + spark(32, 34, 2.2);
}

function hag() {
  const glow = '#8fe07a';
  return plinth(74) +
    `<ellipse cx="50" cy="44" rx="22" ry="16" fill="${glow}" opacity=".28"/>` +
    // iron cauldron on stubby legs
    part('M30 50 Q30 74 50 74 Q70 74 70 50 Z', '#3d3530', '#2b2622', { shadeX: 60 }) +
    part(ell(50, 50, 21, 5), '#5a524a', null) + part(ell(50, 50, 17, 3.4), glow, null) +
    line('M38 74 L36 78 M62 74 L64 78', 3) +
    // bubbles and green vapor
    part(circ(44, 46, 2.4), glow, null) + part(circ(55, 42, 2), glow, null) + part(circ(50, 34, 1.6), glow, null) +
    `<path d="M46 40 Q42 30 48 24 Q54 18 50 10" stroke="${glow}" stroke-width="2.4" fill="none" opacity=".8" stroke-linecap="round"/>`;
}

function crystal() {
  const c1 = '#bfe8ff', c2 = '#8fc6dc', c3 = '#b08fe0';
  return plinth() +
    // a crown of crystal spires on a gold band
    part('M34 68 L32 42 L40 52 L44 26 L50 46 L56 22 L60 52 L68 40 L66 68 Z', c1, c2, { shadeX: 54 }) +
    line('M44 26 L46 60 M56 22 L55 60', 1.4, c2) +
    part('M40 52 L42 64 M60 52 L58 64', c3, null) +
    part(rr(32, 62, 36, 8, 2), GOLD, GOLDS, { shadeX: 56 }) +
    part(circ(50, 66, 2.4), c3, null) + part(circ(40, 66, 1.6), '#e05a3a', null) + part(circ(60, 66, 1.6), '#3fb3a8', null) +
    spark(56, 18, 3.2) + spark(30, 38, 2.2) + spark(72, 36, 2);
}

function frost() {
  const ice = '#d6f0fb', iceS = '#a9d6ea';
  return plinth() +
    // a block of ice...
    part('M32 72 L30 36 L50 30 L70 36 L68 72 Z', ice, iceS, { shadeX: 56 }) +
    line('M36 44 L44 40 M58 60 L64 56 M40 64 L46 62', 1.4, '#ffffff') +
    // ...holding a giant's axe
    `<g opacity=".92">` +
    line('M50 70 L50 20', 3.4, '#6b4a2e') +
    part('M50 24 Q62 18 68 30 Q62 36 50 34 Z', '#b9c6cf', '#95a4ae', { shadeX: 60 }) +
    part('M50 24 Q40 20 36 30 Q42 34 50 32 Z', '#b9c6cf', null) +
    `</g>` +
    spark(74, 26, 2.8) + spark(28, 30, 2.2);
}

function serpent() {
  return plinth() +
    // a coiled golden cobra idol
    part(ell(50, 64, 18, 6), GOLD, GOLDS, { shadeX: 56 }) +
    part(ell(50, 58, 14, 5), GOLD, GOLDS, { shadeX: 55 }) +
    part('M44 58 Q42 40 50 32 Q58 40 56 58 Z', GOLD, GOLDS, { shadeX: 53 }) +
    // the hood
    part('M38 36 Q40 20 50 18 Q60 20 62 36 Q56 42 50 40 Q44 42 38 36 Z', GOLD, GOLDS, { shadeX: 54 }) +
    part('M44 30 Q50 26 56 30 Q50 36 44 30 Z', '#6a9a4a', null) +
    part(circ(46, 24, 1.8), '#e05a3a', null) + part(circ(54, 24, 1.8), '#e05a3a', null) +
    line('M50 28 V31 M49 31 L50 33 L51 31', 1, '#b5413a') +
    spark(70, 18, 3) + spark(30, 44, 2);
}

export const RELICS = { dragon, sphinx, kitsune, griffon, hag, crystal, frost, serpent };

// ---------- Hoards (1x1 caches left where a camp stood) ----------

const coinStack = (x, y, n) => {
  let s = '';
  for (let i = 0; i < n; i++) s += part(ell(x, y - i * 3, 6, 2.2), GOLD, null);
  return s;
};

/** Ore: a spill of gold coins and an open chest of gems. */
function ore() {
  return groundShadow(30, 88) +
    // the chest
    part('M24 84 V60 H62 V84 Z', MAT.wood, MAT.woodShade, { shadeX: 52 }) +
    part('M22 60 L26 44 H60 L64 60 Z', '#8a5a36', MAT.woodShade, { shadeX: 52 }) +
    line('M24 68 H62 M43 60 V84', 2, GOLDS) +
    part(ell(43, 60, 18, 4), GOLD, null) +
    part(circ(36, 58, 2.6), '#3fb3a8', null) + part(circ(48, 57, 2.4), '#e05a3a', null) + part(circ(42, 55, 2), '#8e5bd1', null) +
    // coins spilling out
    part('M58 86 Q60 70 72 68 Q84 70 84 86 Z', GOLD, GOLDS, { shadeX: 76 }) +
    coinStack(76, 80, 4) + part(ell(66, 86, 5, 1.8), GOLD, null) +
    spark(70, 60, 3) + spark(30, 40, 2.4);
}

/** Wood: a stack of cut timber, roped. */
function tree() {
  const end = '#d9b88a', bark = '#8a5a36';
  let s = groundShadow(30, 88);
  const log = (x, y) =>
    part(`M${x - 22} ${y - 5} H${x + 14} A5 5 0 0 1 ${x + 14} ${y + 5} H${x - 22} Z`, bark, MAT.woodShade, { shadeX: x }) +
    part(circ(x + 14, y, 5), end, null) + line(`M${x + 14} ${y - 2} a2 2 0 1 0 0.1 0`, 1, '#a07a4a');
  for (const [x, y] of [[50, 80], [56, 80], [44, 80]].slice(0, 1)) s += log(x - 2, y);
  s += log(46, 80) + log(58, 80) + log(52, 70) + log(40, 70) + log(46, 60);
  return s + line('M30 56 V86 M60 56 V86', 2.4, '#c9a45a') + spark(72, 48, 2.6);
}

/** Wheat: full grain sacks and a basket. */
function wheat() {
  const sack = '#e0c89a', sackS = '#c4a877';
  const bag = (x, y, s = 1) =>
    part(`M${x - 11 * s} ${y} Q${x - 13 * s} ${y - 20 * s} ${x - 5 * s} ${y - 24 * s} H${x + 5 * s} Q${x + 13 * s} ${y - 20 * s} ${x + 11 * s} ${y} Z`, sack, sackS, { shadeX: x + 3 * s }) +
    line(`M${x - 5 * s} ${y - 22 * s} Q${x} ${y - 19 * s} ${x + 5 * s} ${y - 22 * s}`, 2, '#8a6d3f') +
    part(`M${x - 3 * s} ${y - 24 * s} L${x} ${y - 30 * s} L${x + 3 * s} ${y - 24 * s} Z`, MAT.gold, null);
  return groundShadow(30, 88) +
    bag(36, 86) + bag(60, 86, 1.1) +
    // a woven basket of grain
    part('M40 86 Q38 72 42 70 H58 Q62 72 60 86 Z', '#b98a4a', '#9a6f36', { shadeX: 54 }) +
    line('M41 76 H59 M40 81 H60', 1.4, '#8a5f2e') +
    part(ell(50, 70, 9, 3), MAT.gold, null) +
    spark(74, 46, 2.6);
}

/** Stone: cut blocks and a mason's mallet. */
function rock() {
  const blk = (x, y, w, h) => part(rr(x, y, w, h, 1.5), '#cfc9bd', MAT.stoneShade, { shadeX: x + w * 0.66 });
  return groundShadow(32, 88) +
    blk(20, 72, 22, 14) + blk(43, 72, 22, 14) + blk(66, 76, 14, 10) +
    blk(30, 58, 22, 14) + blk(53, 60, 18, 12) + blk(40, 46, 18, 12) +
    // mallet leaning on the stack
    line('M74 74 L84 50', 3, MAT.wood) + part(rr(78, 42, 14, 9, 2), MAT.wood, MAT.woodShade, { shadeX: 86 }) +
    spark(30, 42, 2.4);
}

export const HOARDS = { ore, tree, wheat, rock };
