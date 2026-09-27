// Cosmetic civilization: Chinese (Tang to Qing). Same contract, box and style as
// pieces.mjs / world.mjs, so every piece and building drops in anywhere.
// Research notes:
// - Palace: the Hall of Supreme Harmony. A double-eaved hip roof in glazed
//   imperial-yellow tile with upturned ends and ridge beasts, vermilion columns
//   and a three-tier white marble terrace.
// - Temple: a five-storey pagoda with flared jade eaves and a golden spire of rings.
// - House: a siheyuan gatehouse. Grey tiled gable, lacquered red door with studs, lanterns.
// - Stable: timber frame and grey tiles around a white wall with a moon gate.
// - Barracks: a Great Wall gate. Brick crenellations, an arched gate, a double-eave tower.
// - Pieces:
//   - King: mianguan crown (flat board, bead tassels, hairpin). The Emperor wears gold and a dragon robe.
//   - Queen: phoenix crown (fengguan) with pearl points.
//   - Rook: a war elephant carrying a pagoda-roofed howdah.
//   - Bishop: a Daoist sage's tall crown with the slit, and a scroll.
//   - Knight: a Tang horse with a three-tuft cropped mane and a red tassel.
//   - Pawn: a soldier in a round helmet with a red plume, holding a ji halberd.
import { SIDES, TEAMS, INK, MAT, part, line, circ, ell, rr, eye, eyes, groundShadow } from '../lib/style.mjs';

const C = {
  verm: '#c8372d', vermS: '#9f2a22',
  yel: '#efbd3f', yelS: '#cf9a2a',
  jade: '#4f9a78', jadeS: '#3a7a5d',
  lacq: '#3a302c',
  marble: '#f3efe5', marbleS: '#d8d1c1',
  tile: '#6f757a', tileS: '#585d62',
  brick: '#a39c8f', brickS: '#877f72',
  wood: '#8a5a36', woodS: '#6e4428',
  paper: '#f4ead2',
};

// ---------- shared shapes ----------

const base = (pal, w = 22) =>
  part(`M${50 - w} 88 Q${50 - w} 79 ${50 - w + 8} 77 H${50 + w - 8} Q${50 + w} 79 ${50 + w} 88 Z`, pal.body, pal.shade);

/** A curved Chinese roof: straight ridge, eaves sweeping up at both ends. */
function roof(x0, x1, top, bot, fill, shade, { lift = 6, ridge = true, ends = C.yel } = {}) {
  const w = x1 - x0;
  const d = `M${x0} ${bot - lift} Q${x0 + w * 0.12} ${bot + 1} ${x0 + w * 0.26} ${bot} H${x1 - w * 0.26} Q${x1 - w * 0.12} ${bot + 1} ${x1} ${bot - lift} ` +
    `L${x1 - w * 0.3} ${top} H${x0 + w * 0.3} Z`;
  let s = part(d, fill, shade, { shadeX: x0 + w * 0.62 });
  // tile rows
  let tl = '';
  for (let x = x0 + w * 0.3; x <= x1 - w * 0.28; x += Math.max(4, w / 11)) tl += `M${x.toFixed(1)} ${top + 2} L${(x0 + (x - x0) * 1.0).toFixed(1)} ${bot - 1.5} `;
  s += line(tl, 1.2, shade);
  if (ridge) {
    // ridge with upturned "chiwen" ends
    s += part(`M${x0 + w * 0.3 - 3} ${top + 1} Q${x0 + w * 0.3 - 5} ${top - 5} ${x0 + w * 0.3 - 1} ${top - 4.5} L${x0 + w * 0.3 + 1} ${top - 2} H${x1 - w * 0.3 - 1} L${x1 - w * 0.3 + 1} ${top - 4.5} Q${x1 - w * 0.3 + 5} ${top - 5} ${x1 - w * 0.3 + 3} ${top + 1} Z`, ends, null);
  }
  return s;
}

const column = (x, top, bot, w = 5) => part(rr(x, top, w, bot - top, 1), C.verm, null) + line(`M${x + w - 1.4} ${top + 2} V${bot - 2}`, 1.2, C.vermS);

const lantern = (x, y, fill) =>
  line(`M${x} ${y - 7} V${y - 4}`, 1.6) +
  part(ell(x, y, 4.6, 5.4), fill, null) +
  line(`M${x - 4.4} ${y} H${x + 4.4} M${x} ${y - 5.2} V${y + 5.2}`, 1.1, 'rgba(0,0,0,0.25)') +
  part(rr(x - 2.4, y + 4.6, 4.8, 2, 0.8), C.yel, null) +
  line(`M${x} ${y + 6.6} V${y + 10}`, 1.4, C.yelS);

const pennant = (x, y, team, h = 18) =>
  line(`M${x} ${y} V${y - h}`, 2.4) +
  part(`M${x} ${y - h} H${x + 12} L${x + 9} ${y - h + 4} L${x + 12} ${y - h + 8} H${x} Z`, team, null);

const terrace = (x0, x1, y, h = 5, tiers = 3) => {
  let s = '';
  for (let i = 0; i < tiers; i++) {
    const inset = i * 4, yy = y - i * h;
    s += part(rr(x0 + inset, yy - h, x1 - x0 - inset * 2, h, 1), C.marble, C.marbleS, { shadeX: x1 - inset - 10 });
    s += line(`M${x0 + inset + 3} ${yy - h / 2} H${x1 - inset - 3}`, 0.9, C.marbleS);
  }
  return s;
};

// ---------- pieces ----------

/** Wide-sleeved hanfu robe with a crossed collar (y-collar) in team color. */
function robe(p, team, top, w, { gold = false } = {}) {
  const fill = gold ? MAT.gold : p.body, shade = gold ? MAT.goldShade : p.shade;
  return part(`M${50 - w} 78 Q${50 - w + 2} ${top + 10} ${43} ${top} H57 Q${50 + w - 2} ${top + 10} ${50 + w} 78 Z`, fill, shade) +
    // sleeves
    part(`M${50 - w + 2} 66 Q${50 - w - 3} 72 ${50 - w + 4} 76 L${43} 74 Z`, fill, shade, { shadeX: null }) +
    part(`M${50 + w - 2} 66 Q${50 + w + 3} 72 ${50 + w - 4} 76 L${57} 74 Z`, fill, shade, { shadeX: 100 }) +
    // crossed collar
    part(`M43 ${top} L54 ${top + 12} L50 ${top + 14} L43 ${top + 4} Z`, team, null) +
    part(`M57 ${top} L46 ${top + 12} L50 ${top + 14} L57 ${top + 4} Z`, team, null) +
    // sash
    part(rr(50 - w + 7, top + 16, 2 * w - 14, 4.5, 2), team, null);
}

export function king({ side = 'light', team = TEAMS.red, emperor = false } = {}) {
  const p = SIDES[side];
  const board = emperor ? MAT.gold : side === 'light' ? C.lacq : '#231f1c';
  let s = groundShadow(25) + base(p, 24) + robe(p, team, 55, 24, { gold: emperor });
  if (emperor) {
    // five-clawed dragon coiling on the golden robe
    s += line('M36 74 Q40 66 47 69 Q53 72 57 66 Q60 61 64 64', 2.4, C.verm) +
      part(circ(64.5, 63.5, 2.4), C.verm, null) + line('M40 74 l-2 3 M46 70 l-1 3 M56 67 l1 3', 1.4, C.verm);
  }
  s += part(circ(50, 45, 10), p.body, p.shade) +
    // cap under the board, with the hairpin through it
    part('M40 38 Q40 30 50 30 Q60 30 60 38 Z', board, null) +
    line('M33 34 H67', 2.6, emperor ? MAT.goldShade : C.yelS) +
    part(circ(33, 34, 1.9), emperor ? MAT.gold : C.yel, null) + part(circ(67, 34, 1.9), emperor ? MAT.gold : C.yel, null) +
    // the mianguan board, tilted a touch forward
    part('M29 27 L71 25 L72 30 L28 32 Z', board, null) +
    // the king's cross finial on the board: it still reads as a king
    part('M47.8 25 V13 H52.2 V25 Z', emperor ? MAT.gold : C.yel, null) +
    part('M44.5 16.5 H55.5 V20.5 H44.5 Z', emperor ? MAT.gold : C.yel, null);
  // bead tassels (liu) hanging from the board's front edge
  for (const x of [31, 36, 64, 69]) {
    const beads = emperor ? [MAT.gold, C.verm, C.jade] : [C.jade, C.verm, C.paper];
    s += line(`M${x} 30.5 V43`, 0.9, INK);
    beads.forEach((c, i) => { s += `<circle cx="${x}" cy="${34 + i * 3.6}" r="1.45" fill="${c}" stroke="${INK}" stroke-width="0.7"/>`; });
  }
  if (emperor) s += part(circ(50, 28.5, 2), C.verm, null);
  return s + eyes(50, 46, 8, p, 1.6) +
    // thin moustache
    line('M45.5 50.5 Q48 49.5 50 50.5 Q52 49.5 54.5 50.5', 1.1, p.eye);
}

export function queen({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  let s = groundShadow(24) + base(p, 23) + robe(p, team, 53, 22) +
    part(circ(50, 44, 10), p.body, p.shade) +
    // hair buns
    part(ell(50, 34, 11, 5), side === 'light' ? C.lacq : '#231f1c', null);
  // phoenix crown: a domed crown with five pearl-tipped points (the queen's points)
  s += part('M37 37 L34 20 L42 28 L50 13 L58 28 L66 20 L63 37 Z', MAT.gold, MAT.goldShade, { shadeX: 58 });
  // phoenix wings sweeping out from the crown's sides
  s += part('M37 33 Q27 30 24 22 Q30 26 36 26 Z', MAT.gold, null) + part('M63 33 Q73 30 76 22 Q70 26 64 26 Z', MAT.gold, null);
  for (const [x, y] of [[34, 19], [50, 12], [66, 19]]) s += part(circ(x, y, 3), C.paper, null);
  s += part(circ(42, 27.5, 1.8), C.jade, null) + part(circ(58, 27.5, 1.8), C.jade, null) + part(circ(50, 30, 2.2), C.verm, null);
  // pearl strands falling to the shoulders
  s += line('M36 36 Q34 44 36 50 M64 36 Q66 44 64 50', 1, INK);
  for (const [x, y] of [[35.2, 41], [35.3, 46], [64.8, 41], [64.7, 46]]) s += `<circle cx="${x}" cy="${y}" r="1.3" fill="${C.paper}" stroke="${INK}" stroke-width="0.7"/>`;
  return s + eyes(50, 46, 8, p, 1.6) + part(ell(50, 51, 1.6, 1), C.verm, null);
}

export function bishop({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  const hat = side === 'light' ? C.lacq : '#231f1c';
  return groundShadow(22) + base(p, 21) +
    part('M34 78 Q40 66 42 60 H58 Q60 66 66 78 Z', p.body, p.shade) +
    part('M42 60 L54 70 L50 72 L42 64 Z', team, null) + part('M58 60 L46 70 L50 72 L58 64 Z', team, null) +
    // scroll held in front
    part(rr(38, 68, 24, 5, 2.5), C.paper, null) + part(circ(38.5, 70.5, 3), C.wood, null) + part(circ(61.5, 70.5, 3), C.wood, null) +
    part(circ(50, 48, 10), p.body, p.shade) +
    // the sage's tall crown, mitre-shaped with the slit, over a futou cap with wings
    part('M36 41 H64 V37 H36 Z', hat, null) +
    line('M36 39 L24 36 M64 39 L76 36', 2.8, hat) +
    part('M50 14 C60 21 63 29 62 38 H38 C37 29 40 21 50 14 Z', p.body, p.shade) +
    line('M55 23 L47 33', 2.6) +
    part(rr(40, 34, 20, 4, 1.5), team, null) +
    part(circ(50, 12.5, 3.4), C.jade, null) +
    eyes(50, 50, 8, p, 1.6) +
    // long sage's beard
    part('M46 53 Q50 64 54 53 Q50 56 46 53 Z', p.shade, null);
}

export function knight({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  const head = 'M30 77 C30 64 40 58 44 52 C38 54 30 57 24 53 C19 50 18 44 22 41 C28 34 34 26 40 21 L41 12 L47 19 C58 18 71 26 72 42 C74 56 70 68 70 77 Z';
  return groundShadow(24) + base(p, 24) +
    part(head, p.body, p.shade, { shadeX: 58 }) +
    // Tang horses wore the mane cropped in three tufts (san hua)
    part('M49 20 Q55 13 58 21 Q62 15 65 25 Q70 21 70 32 L64 36 Q60 26 50 24 Z', team, null) +
    // cropped mane down the neck
    part('M64 36 C66 48 67 60 66 77 H62 C63 62 62 50 60 38 Z', team, null) +
    // bridle and the red tassel beneath the jaw
    line('M28 38 L44 32 M40 21 C38 32 40 44 44 52 M22 46 L40 44', 1.8, C.lacq) +
    part(circ(44, 32, 2), MAT.gold, null) +
    line('M34 55 V59', 1.6) +
    part('M30 59 Q34 57 38 59 L37 67 Q34 69 31 67 Z', C.verm, C.vermS, { shadeX: 35 }) +
    part(rr(31, 58, 6, 2.4, 1), MAT.gold, null) +
    eye(38, 32, p, 2.4) +
    `<ellipse cx="24.5" cy="46" rx="1.4" ry="1.8" fill="${p.eye}"/>`;
}

export function elephant({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  const leg = (x, fill) =>
    part(`M${x} 60 H${x + 10} L${x + 9.5} 88 H${x + 0.5} Z`, fill, null) +
    line(`M${x + 2.5} 86 v-2 M${x + 5} 86 v-2 M${x + 7.5} 86 v-2`, 1.4);
  return groundShadow(36, 90) +
    line('M86 44 Q90 52 88 62', 2.4) +
    leg(66, p.shade) + leg(77, p.shade) + leg(36, p.body) + leg(49, p.body) +
    part('M34 44 C40 32 66 30 80 36 C88 40 89 56 85 68 Q60 73 36 68 C32 60 31 51 34 44 Z', p.body, p.shade, { shadeX: 72 }) +
    // brocade saddle cloth with a gold fringe
    part('M44 38 C56 33 70 33 80 37 L80 53 Q62 57 46 53 Z', team, null) +
    line('M46 50 Q62 54 80 50', 2, MAT.gold) +
    // the howdah: a little pavilion tower with red columns and a curved roof
    part(rr(49, 29, 30, 11, 1), C.marble, C.marbleS, { shadeX: 72 }) +
    column(51, 20, 30, 3.4) + column(62.3, 20, 30, 3.4) + column(73.6, 20, 30, 3.4) +
    part('M50 20 H79 V16 H50 Z', C.lacq, null) +
    roof(45, 84, 8, 18, C.yel, C.yelS, { lift: 5, ends: C.verm }) +
    // head and trunk
    part('M42 40 C37 30 24 29 18 36 C13 42 13 51 15 58 C17 66 16 75 13 83 C12 87 17 89 19 86 C22 78 24 70 27 64 C33 62 40 61 43 56 Z', p.body, null) +
    line('M16 66 h4 M15.5 72 h4 M15 78 h3.5', 1.6) +
    part('M24 59 C18 63 11 62 7 55 C12 58 18 57 22 54 Z', '#f6efdf', null) +
    // gold tusk cap
    part('M8 54.5 L11.5 55.5 L10 58.5 L6.5 57 Z', MAT.gold, null) +
    part('M30 37 C40 33 49 40 48 53 C47 61 40 65 34 63 C29 57 28 46 30 37 Z', p.shade, null) +
    // a jade medallion on the forehead
    part(circ(21, 38, 2.4), C.jade, null) +
    eye(24, 44, p, 2.1);
}

export function pawn({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  return groundShadow(22) + base(p, 20) +
    // the ji halberd behind the soldier
    line('M68 86 V22', 2.4, C.wood) +
    part('M68 16 L71 26 L65 26 Z', MAT.stone, null) +
    part('M68 27 Q76 26 76 32 Q72 30 68 31 Z', MAT.stone, null) +
    part('M65.5 33 H70.5 V35 H65.5 Z', C.verm, null) +
    // lamellar armour body
    part('M36 78 Q43 66 43 58 H57 Q57 66 64 78 Z', p.body, p.shade) +
    line('M40 70 H60 M38.5 74.5 H61.5 M42 65.5 H58', 1.1, p.shade) +
    part(rr(37, 54, 26, 6, 3), team, null) +
    part(circ(50, 42, 12.5), p.body, p.shade) +
    // round helmet with a raised rim, a point and a red plume
    part('M37 42 Q37 28 50 27 Q63 28 63 42 Z', side === 'light' ? MAT.stone : '#6b6560', side === 'light' ? MAT.stoneShade : '#57514c', { shadeX: 56 }) +
    part(rr(34.5, 40, 31, 4.5, 2), side === 'light' ? MAT.stone : '#6b6560', null) +
    part('M48.5 27.5 L50 21 L51.5 27.5 Z', MAT.gold, null) +
    part('M50 21 Q44 14 47 9 Q51 14 53 11 Q55 17 50 21 Z', C.verm, null) +
    eyes(50, 48, 8, p, 1.7);
}

export const PIECES = { king, queen, elephant, bishop, knight, pawn };

// ---------- buildings ----------

export function house({ team = TEAMS.red } = {}) {
  return groundShadow(34, 88) +
    // grey brick walls with a white plaster band
    part('M20 87 V52 H80 V87 Z', C.brick, C.brickS, { shadeX: 66 }) +
    part('M20 52 H80 V58 H20 Z', C.marble, null) +
    // gabled roof in grey tile, eaves turned up
    roof(12, 88, 30, 54, C.tile, C.tileS, { lift: 5, ends: C.tileS }) +
    // the lacquered red door with gold studs, under a small door roof
    part('M40 87 V62 H60 V87 Z', C.verm, C.vermS, { shadeX: 55 }) +
    line('M50 62 V87', 1.6) +
    [66, 71, 76, 81].map((y) => `<circle cx="45" cy="${y}" r="1.1" fill="${MAT.gold}"/><circle cx="55" cy="${y}" r="1.1" fill="${MAT.gold}"/>`).join('') +
    part('M36 62 Q50 55 64 62 L62 59 H38 Z', C.tile, null) +
    // lanterns in team color either side of the gate
    // couplet banners in team color beside the door, red lanterns at the eaves
    part(rr(34.5, 63, 4.5, 19, 0.8), team, null) + part(rr(61, 63, 4.5, 19, 0.8), team, null) +
    line('M36.75 66 V79 M63.25 66 V79', 1, MAT.gold) +
    lantern(28, 64, C.verm) + lantern(72, 64, C.verm) +
    // lattice windows
    part(rr(23, 74, 9, 9, 1), C.paper, null) + line('M27.5 74 V83 M23 78.5 H32', 1.2, C.woodS) +
    part(rr(68, 74, 9, 9, 1), C.paper, null) + line('M72.5 74 V83 M68 78.5 H77', 1.2, C.woodS);
}

export function stable({ team = TEAMS.red } = {}) {
  return groundShadow(42, 88) +
    // timber frame with white walls
    part('M10 87 V52 H90 V87 Z', C.marble, C.marbleS, { shadeX: 74 }) +
    column(10, 52, 87, 5) + column(85, 52, 87, 5) + column(47.5, 52, 60, 5) +
    part('M10 52 H90 V57 H10 Z', C.wood, null) +
    roof(4, 96, 30, 54, C.tile, C.tileS, { lift: 6, ends: C.tileS }) +
    // the moon gate, with a horse looking out
    part(circ(50, 73, 13.5), C.lacq, null) +
    part('M44 87 C44 76 47 70 51 66 C49 67 46 68 44 66 C43 64 44 62 46 61 L50 58 L51 55 L53 58 C58 59 61 64 60 72 C59 78 58 83 58 87 Z', '#c89a6a', '#a87a4c', { shadeX: 56 }) +
    part('M53 58 C58 59 61 64 60 72 L57 73 C57 66 56 62 52 60 Z', team, null) +
    `<circle cx="49" cy="62" r="1.3" fill="${INK}"/>` +
    part('M36.5 87 A13.5 13.5 0 0 1 63.5 87', 'none', null) +
    line(`M${50 - 13.5} 73 A13.5 13.5 0 0 1 ${50 + 13.5} 73`, 3.2, C.brickS) +
    // horseshoe-less sign: a jade plaque, and hay
    part(rr(18, 60, 14, 9, 1.5), C.jade, C.jadeS, { shadeX: 28 }) + line('M21 64.5 H29', 1.4, MAT.gold) +
    part('M70 87 Q72 78 78 76 Q84 78 86 87 Z', MAT.gold, MAT.goldShade, { shadeX: 80 }) +
    pennant(50, 32, team, 16);
}

export function temple({ team = TEAMS.red } = {}) {
  // A five-storey pagoda: each storey narrower, with flared jade eaves.
  let s = groundShadow(30, 88) + terrace(24, 76, 88, 4, 2);
  // [left, right, bottom of the wall, top of the wall]
  const storeys = [[31, 69, 81, 66], [34, 66, 67, 54], [37, 63, 55, 43], [40, 60, 44, 33], [43, 57, 34, 24]];
  storeys.forEach(([x0, x1, bot, top], i) => {
    s += part(`M${x0} ${bot} V${top} H${x1} V${bot} Z`, i % 2 ? C.marble : C.verm, i % 2 ? C.marbleS : C.vermS, { shadeX: x1 - 6 });
    const h = bot - top - 6;
    if (i === 0) s += part('M46 81 V73 Q50 68 54 73 V81 Z', C.lacq, null);
    // lit lattice windows on the upper storeys
    else s += part(`M47.5 ${bot - 1} V${bot - h + 2} Q50 ${bot - h - 0.8} 52.5 ${bot - h + 2} V${bot - 1} Z`, C.yel, null) + line(`M50 ${bot - h + 1} V${bot - 1.5}`, 1, C.woodS);
    s += roof(x0 - 8, x1 + 8, top - 2, top + 4, C.jade, C.jadeS, { lift: 5, ridge: false });
  });
  // the golden spire with rings, and the bishop's jewel at its tip
  s += line('M50 22 V7', 3, MAT.goldShade) +
    [19, 15.5, 12].map((y, i) => `<ellipse cx="50" cy="${y}" rx="${4.4 - i}" ry="1.3" fill="${MAT.gold}" stroke="${INK}" stroke-width="1.2"/>`).join('') +
    part(circ(50, 6, 2.8), MAT.gold, null) +
    // team color banners hanging from the lowest eaves
    part('M22 68 H27 V82 L24.5 79 L22 82 Z', team, null) + part('M73 68 H78 V82 L75.5 79 L73 82 Z', team, null) +
    // wind bells at the eave tips
    part(circ(23, 64, 1.5), MAT.gold, null) + part(circ(77, 64, 1.5), MAT.gold, null);
  return s;
}

export function barracks({ team = TEAMS.red } = {}) {
  // A Great Wall gate: brick wall with crenellations, arched gate, tower on top.
  const cren = (x0, x1, y, n) => {
    const w = (x1 - x0) / (2 * n - 1);
    let d = `M${x0} ${y + 6} V${y}`;
    for (let i = 0; i < n; i++) { const x = x0 + i * 2 * w; d += ` H${x + w}`; if (i < n - 1) d += ` V${y + 5} H${x + 2 * w} V${y}`; }
    return d + ` V${y + 6} Z`;
  };
  return groundShadow(44, 88) +
    part('M6 87 V50 H94 V87 Z', C.brick, C.brickS, { shadeX: 76 }) +
    line('M6 60 H94 M6 70 H94 M6 80 H94 M20 50 V60 M40 60 V70 M60 50 V60 M80 60 V70 M30 70 V80 M70 70 V80', 1, C.brickS) +
    part(cren(6, 30, 44, 3), C.brick, C.brickS, { shadeX: 24 }) +
    part(cren(70, 94, 44, 3), C.brick, C.brickS, { shadeX: 88 }) +
    // the arched gate with studded doors
    part('M37 87 V68 Q50 54 63 68 V87 Z', C.lacq, null) +
    part('M40 87 V69 Q50 58 60 69 V87 Z', C.verm, C.vermS, { shadeX: 55 }) +
    line('M50 60 V87', 1.4) +
    [70, 76, 82].map((y) => `<circle cx="45" cy="${y}" r="1" fill="${MAT.gold}"/><circle cx="55" cy="${y}" r="1" fill="${MAT.gold}"/>`).join('') +
    // gate tower: red columns under a double eave
    part('M28 50 V36 H72 V50 Z', C.marble, C.marbleS, { shadeX: 62 }) +
    column(30, 36, 50, 4.5) + column(47.7, 36, 50, 4.5) + column(65.5, 36, 50, 4.5) +
    part(rr(38, 40, 7, 7, 1), C.lacq, null) + part(rr(55, 40, 7, 7, 1), C.lacq, null) +
    roof(20, 80, 30, 38, C.tile, C.tileS, { lift: 5, ridge: false }) +
    roof(28, 72, 14, 28, C.tile, C.tileS, { lift: 5, ends: C.yel }) +
    // a plaque over the gate in team color
    part(rr(43, 58.5, 14, 6, 1), team, null) + line('M46 61.5 H54', 1.2, MAT.gold) +
    pennant(12, 44, team, 20) + pennant(88, 44, team, 20);
}

export function palace({ team = TEAMS.red } = {}) {
  // The Hall of Supreme Harmony: a marble terrace, red columns, a double-eaved yellow roof.
  let s = groundShadow(47, 89) + terrace(4, 96, 89, 5, 3);
  // central stair
  s += part('M42 89 L45 74 H55 L58 89 Z', C.marble, C.marbleS, { shadeX: 54 }) + line('M43.5 84 H56.5 M44.5 79 H55.5', 1, C.marbleS);
  // the hall
  s += part('M14 74 V50 H86 V74 Z', C.verm, C.vermS, { shadeX: 76 });
  for (const x of [15, 26, 37, 58, 69, 80]) s += column(x, 50, 74, 5);
  // lattice doors
  for (const x of [20, 31, 63, 74]) s += part(rr(x + 0.5, 56, 5.5, 18, 0.5), C.yelS, null) + line(`M${x + 1} 60 H${x + 5.5} M${x + 1} 65 H${x + 5.5} M${x + 1} 70 H${x + 5.5}`, 0.9, C.woodS);
  s += part('M43 74 V58 H57 V74 Z', C.lacq, null);
  // the lower eave, dougong bracket band, then the upper roof
  s += roof(4, 96, 40, 52, C.yel, C.yelS, { lift: 6, ridge: false });
  s += part('M20 40 H80 V35 H20 Z', C.jade, C.jadeS, { shadeX: 70 }) + line('M24 37.5 H76', 1.6, MAT.gold);
  s += part('M24 35 V28 H76 V35 Z', C.verm, C.vermS, { shadeX: 68 });
  s += roof(10, 90, 12, 30, C.yel, C.yelS, { lift: 7, ends: MAT.gold });
  // ridge guardian beasts marching along the hip
  for (const [x, y] of [[20, 25], [24, 22], [80, 25], [76, 22]]) s += part(ell(x, y, 1.8, 1.4), C.jadeS, null);
  // the name plaque in team color, framed in gold, under the upper eave
  s += part(rr(42, 29, 16, 7, 1), MAT.gold, null) + part(rr(43.5, 30.2, 13, 4.6, 0.8), team, null);
  // the king's crown: a golden pearl on the ridge
  s += part(circ(50, 8.5, 3.4), MAT.gold, MAT.goldShade, { shadeX: 51 }) + line('M50 5 V2', 2, MAT.goldShade);
  // team banners on the terrace
  s += pennant(8, 76, team, 16) + pennant(92, 76, team, 16);
  return s;
}

export const BUILDINGS = { palace, house, stable, temple, barracks };
