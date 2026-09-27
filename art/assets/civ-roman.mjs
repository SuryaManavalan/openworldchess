// Cosmetic civilization: Rome (docs/specs/cosmetics.md).
// Same contract as pieces.mjs + world.mjs: PIECES and BUILDINGS with the same
// signatures, box and footprint, so they drop in anywhere. The chess cues stay
// (the king's cross finial, the queen's points, the bishop's slit, the rook's
// tower on an elephant), dressed in Roman things: laurel, toga and palla,
// galea and scutum, marble, terracotta, bronze and imperial purple.
import { SIDES, TEAMS, INK, MAT, part, line, circ, ell, rr, eye, eyes, groundShadow } from '../lib/style.mjs';

const R = {
  marble: '#f3eee2', marbleShade: '#d8d0bf', travertine: '#e6dcc3', travShade: '#c9bc9c',
  terra: '#c8623f', terraShade: '#a54d30', terraDark: '#8e3f26',
  bronze: '#c08a45', bronzeShade: '#9a6a30',
  purple: '#6e3f8f', purpleShade: '#55306f',
  laurel: '#6f9a3c', laurelDark: '#557a2c',
  gold: MAT.gold, goldShade: MAT.goldShade,
  shadow: '#3d3530',
};

/** A small filled shape with a thin outline (the house outline swamps tiny details). */
const fine = (d, fill, w = 1.4) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"/>`;

/** The Roman eagle (aquila), wings spread, centered at (x, y), about 2s wide. */
const aquila = (x, y, s = 8, fill = R.gold) =>
  fine(`M${x} ${y - s * 0.35} L${x - s} ${y - s * 0.75} L${x - s * 0.72} ${y - s * 0.1} L${x - s * 0.95} ${y + s * 0.05} L${x - s * 0.35} ${y + s * 0.35} L${x - s * 0.2} ${y + s * 0.75} L${x} ${y + s * 0.5} L${x + s * 0.2} ${y + s * 0.75} L${x + s * 0.35} ${y + s * 0.35} L${x + s * 0.95} ${y + s * 0.05} L${x + s * 0.72} ${y - s * 0.1} L${x + s} ${y - s * 0.75} Z`, fill) +
  fine(`M${x - s * 0.18} ${y - s * 0.35} Q${x} ${y - s * 0.75} ${x + s * 0.2} ${y - s * 0.45} L${x + s * 0.34} ${y - s * 0.4} L${x + s * 0.12} ${y - s * 0.28} Z`, fill, 1.2);

// ---------- shared piece parts ----------

const base = (pal, w = 22) =>
  part(`M${50 - w} 88 Q${50 - w} 79 ${50 - w + 8} 77 H${50 + w - 8} Q${50 + w} 79 ${50 + w} 88 Z`, pal.body, pal.shade) +
  // a carved plinth line, like a statue base
  line(`M${50 - w + 4} 83 H${50 + w - 4}`, 1.4, pal.shade);

/**
 * A laurel wreath arching over a head centered at (cx, cy) with radius r: leaves
 * along the arc, pointing up toward the crown, tied with ribbons at the back.
 */
function laurel(cx, cy, r, fill = R.laurel, dark = R.laurelDark) {
  let s = '';
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (1.08 + (i / (n - 1)) * 0.84); // from left-side, over the top, to right-side
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    const deg = (a * 180) / Math.PI + (i < n / 2 ? -60 : 60);
    s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.9" ry="1.9" transform="rotate(${deg.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${i % 2 ? dark : fill}" stroke="${INK}" stroke-width="1.2"/>`;
  }
  return line(`M${cx - r * 0.95} ${cy + 2} q-3 6 -1 10 M${cx + r * 0.95} ${cy + 2} q3 6 1 10`, 1.8, dark) + s;
}

// ---------- pieces ----------

export function pawn({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  // A legionary: galea helmet with a crest, lorica segmentata, and a curved scutum.
  const body = 'M36 78 Q42 66 43 57 H57 Q58 66 64 78 Z';
  return groundShadow(22) +
    base(p, 20) +
    part(body, p.body, p.shade) +
    // lorica segmentata bands
    line('M40 66 H60 M38.5 71 H61.5 M42 61 H58', 1.6, p.shade) +
    part(rr(37, 53, 26, 5, 2.5), team, null) +
    part(circ(50, 40, 12.5), p.body, p.shade) +
    // galea bowl and neck guard
    part('M37 41 A13 13 0 0 1 63 41 L64 45 H60 V42 H40 V45 H36 Z', R.bronze, R.bronzeShade, { shadeX: 55 }) +
    // cheek guards
    part('M38 42 H42 V50 Q39 50 38 47 Z', R.bronze, null) + part('M58 42 H62 V47 Q61 50 58 50 Z', R.bronze, null) +
    // transverse crest in team color
    part('M35 31 Q50 13 65 31 L60 32 Q50 21 40 32 Z', team, null) +
    line('M41 26 L43 29 M46 22.5 L47 26.5 M50 21.5 V25.5 M54 22.5 L53 26.5 M59 26 L57 29', 1.1, 'rgba(0,0,0,0.3)') +
    eyes(50, 46, 8, p, 1.6) +
    // scutum: a curved tower shield held in front
    part('M29 58 Q28 70 30 82 H44 Q42 70 43 58 Z', team, null) +
    part(circ(36.5, 70, 3), R.bronze, null) +
    line('M31.5 61 V79 M41 61 V79', 1.1, 'rgba(0,0,0,0.25)');
}

export function knight({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  // Cavalry horse in a parade chamfron with a tall crest and phalerae on the breast strap.
  const head = 'M30 77 C30 64 40 58 44 52 C38 54 30 57 24 53 C19 50 18 44 22 41 C28 34 34 26 40 21 L41 12 L47 19 C58 18 71 26 72 42 C74 56 70 68 70 77 Z';
  const crest = 'M44 18 C52 8 66 10 72 22 C74 30 72 38 70 44 C68 34 64 26 56 22 C52 20 48 20 44 18 Z';
  return groundShadow(24) +
    base(p, 24) +
    part(head, p.body, p.shade, { shadeX: 58 }) +
    // bronze chamfron over the face
    part('M24 41 C29 35 34 28 39 24 L43 27 C40 33 36 40 30 46 C27 47 24 45 24 41 Z', R.bronze, R.bronzeShade, { shadeX: 36 }) +
    // eye guard (a pierced dome)
    part(circ(37, 31, 4.2), R.bronze, null) + part(circ(37, 31, 1.6), INK, null) +
    // crest plume in team color
    part(crest, team, null) +
    line('M52 16 L55 22 M60 15 L61 22 M67 18 L65 24', 1.6, 'rgba(0,0,0,0.25)') +
    // breast strap with phalerae
    part('M36 66 Q52 60 68 64 L68 69 Q52 65 37 71 Z', R.shadow, null) +
    part(circ(44, 66.5, 2.6), R.gold, null) + part(circ(53, 64.5, 2.6), R.gold, null) + part(circ(62, 65, 2.6), R.gold, null) +
    `<ellipse cx="24.5" cy="46" rx="1.4" ry="1.8" fill="${p.eye}"/>`;
}

export function bishop({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  // A pontifex, head veiled (capite velato): the veil rises into the bishop's mitre,
  // slit and all. He carries the augur's curled lituus.
  return groundShadow(22) +
    base(p, 21) +
    // lituus staff
    line('M70 86 V34', 2.6) + `<path d="M70 34 C70 26 78 24 79 30 C80 35 74 36 74 32" fill="none" stroke="${R.bronze}" stroke-width="3.2" stroke-linecap="round"/>` +
    part('M34 78 Q41 66 42 60 H58 Q59 66 66 78 Z', p.body, p.shade) +
    // toga fold with a purple-bordered edge (team shows as the sash)
    part('M40 76 Q46 66 58 60 L60 63 Q50 68 45 78 Z', team, null) +
    part(circ(50, 48, 10), p.body, p.shade) +
    // the veil: drapes over the head and rises to a point, with the mitre's slit
    part('M50 16 C62 24 66 34 63 46 Q62 52 60 56 H57 Q60 46 58 40 H42 Q40 46 43 56 H40 Q38 52 37 46 C34 34 38 24 50 16 Z', p.body, p.shade) +
    line('M55 25 L47 35', 2.6) +
    part(rr(40, 39, 20, 3.4, 1.7), R.purple, null) +
    part(circ(50, 14, 3.4), R.gold, null) +
    eyes(50, 50, 8, p, 1.6);
}

export function elephant({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  // A war elephant carrying a legionary turris hung with scuta.
  const leg = (x, fill) =>
    part(`M${x} 60 H${x + 10} L${x + 9.5} 88 H${x + 0.5} Z`, fill, null) +
    line(`M${x + 2.5} 86 v-2 M${x + 5} 86 v-2 M${x + 7.5} 86 v-2`, 1.4);
  const shield = (x) =>
    part(`M${x} 44 Q${x - 0.8} 51 ${x} 58 H${x + 8} Q${x + 7.2} 51 ${x + 8} 44 Z`, team, null) + fine(circ(x + 4, 51, 1.8), R.bronze, 1);
  return groundShadow(36, 90) +
    line('M86 44 Q90 52 88 62', 2.4) +
    leg(66, p.shade) + leg(77, p.shade) +
    leg(36, p.body) + leg(49, p.body) +
    part('M34 44 C40 32 66 30 80 36 C88 40 89 56 85 68 Q60 73 36 68 C32 60 31 51 34 44 Z', p.body, p.shade, { shadeX: 72 }) +
    // saddle cloth with a gold fringe
    part('M44 38 C56 33 70 33 80 37 L80 52 Q62 56 46 52 Z', team, null) +
    line('M46 52 Q62 56 80 52', 2, R.gold) +
    // the turris: timber tower with crenellations, shields on its face
    part('M50 40 V14 H55.5 V19 H61 V14 H66.5 V19 H72 V14 H77.5 V40 Z', R.travertine, R.travShade, { shadeX: 71 }) +
    line('M50 26 H77.5 M50 33 H77.5', 1.6, R.travShade) +
    line('M58 19 V26 M69 19 V26 M54 26 V33 M64 26 V33 M74 26 V33', 1.2, R.travShade) +
    shield(52) + shield(64) +
    // head, trunk, tusk, ear
    part('M42 40 C37 30 24 29 18 36 C13 42 13 51 15 58 C17 66 16 75 13 83 C12 87 17 89 19 86 C22 78 24 70 27 64 C33 62 40 61 43 56 Z', p.body, null) +
    line('M16 66 h4 M15.5 72 h4 M15 78 h3.5', 1.6) +
    // bronze forehead plate
    part('M20 36 C24 31 32 31 36 35 L33 42 C29 40 24 40 21 42 Z', R.bronze, R.bronzeShade, { shadeX: 30 }) +
    part('M24 59 C18 63 11 62 7 55 C12 58 18 57 22 54 Z', '#f6efdf', null) +
    part('M30 37 C40 33 49 40 48 53 C47 61 40 65 34 63 C29 57 28 46 30 37 Z', p.shade, null) +
    line('M34 43 C39 45 41 51 39 57', 1.6) +
    eye(24, 45, p, 2.1);
}

export function queen({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  // An empress: stola, a palla drawn over one shoulder in team color, and a
  // pointed diadem (the queen's five points) set with pearls.
  return groundShadow(24) +
    base(p, 23) +
    part('M30 78 Q40 64 42 56 H58 Q60 64 70 78 Z', p.body, p.shade) +
    // palla, draped across the body
    part('M33 76 Q42 64 58 56 L62 58 Q56 66 52 78 Z', team, null) +
    line('M40 70 Q46 64 54 60', 1.4, 'rgba(0,0,0,0.25)') +
    part(rr(42, 52, 16, 5, 2.5), R.gold, null) +
    part(circ(50, 44, 10), p.body, p.shade) +
    // hair gathered back (a nodus bun)
    part(ell(50, 37, 11, 5), p.shade, null) +
    part('M36 37 L33 18 L42 28 L50 13 L58 28 L67 18 L64 37 Z', R.gold, R.goldShade, { shadeX: 58 }) +
    part(circ(33, 17, 3.1), '#f6efdf', null) + part(circ(50, 12, 3.1), '#f6efdf', null) + part(circ(67, 17, 3.1), '#f6efdf', null) +
    part(circ(50, 30, 2.4), team, null) +
    eyes(50, 46, 8, p, 1.6);
}

export function king({ side = 'light', team = TEAMS.red, emperor = false } = {}) {
  const p = SIDES[side];
  // A consul in a toga with a purple band and a team-colored paludamentum; a laurel
  // wreath below a crown whose finial keeps the king's cross. The Emperor's is gold,
  // with the gold eagle.
  const crown = emperor ? R.gold : p.body, crownShade = emperor ? R.goldShade : p.shade;
  return groundShadow(25) +
    base(p, 24) +
    // paludamentum (cloak) in team color behind
    part('M26 80 Q34 62 41 56 H59 Q66 62 74 80 Z', team, null) +
    // toga body with the purple band of the praetexta
    part('M31 79 Q38 64 42 57 H58 Q62 64 69 79 Z', p.body, p.shade) +
    part('M36 76 Q44 64 58 58 L60 61 Q49 67 41 79 Z', R.purple, null) +
    // bronze fibula at the shoulder
    part(circ(57, 58, 3), R.bronze, null) +
    part(circ(50, 45, 10), p.body, p.shade) +
    part('M42 50 Q50 62 58 50 Q50 55 42 50 Z', p.shade, null) +
    // the king's cross rising from a small boss on top of the head
    part('M47.5 34 V12 H52.5 V34 Z', crown, crownShade, { shadeX: 51 }) +
    part('M43 15 H57 V20.5 H43 Z', crown, null) +
    // the laurel wreath arching over the head: green for a consul, gold for the Emperor
    laurel(50, 45, 12.5, emperor ? R.gold : R.laurel, emperor ? R.goldShade : R.laurelDark) +
    part(circ(50, 33, 3), emperor ? TEAMS.red : team, null) +
    (emperor ? aquila(50, 70, 6.5) : '') +
    eyes(50, 46, 8, p, 1.6);
}

export const PIECES = { king, queen, elephant, bishop, knight, pawn };

// ---------- buildings ----------

const flag = (x, y, team, h = 16) =>
  line(`M${x} ${y} V${y - h}`, 2.4) +
  part(`M${x} ${y - h} L${x + 13} ${y - h + 4} L${x} ${y - h + 8} Z`, team, null);

/** A vexillum: a square banner hung from a crossbar, topped by an eagle. */
const vexillum = (x, y, team, h = 30) =>
  line(`M${x} ${y} V${y - h}`, 2.4) + line(`M${x - 8} ${y - h + 6} H${x + 8}`, 2.2) +
  part(`M${x - 7} ${y - h + 7} H${x + 7} V${y - h + 20} L${x + 3.5} ${y - h + 17} L${x} ${y - h + 20} L${x - 3.5} ${y - h + 17} L${x - 7} ${y - h + 20} Z`, team, null) +
  line(`M${x - 4} ${y - h + 12} H${x + 4}`, 1.2, R.gold) +
  aquila(x, y - h - 2, 5.5);

/** Tiled roof: a slope with tile rows. */
const tiles = (d, x0, x1, y0, y1, n = 4) => {
  let s = part(d, R.terra, R.terraShade, { shadeX: (x0 + x1) / 2 + 6 });
  for (let i = 1; i < n; i++) s += line(`M${x0 + ((x1 - x0) * i) / n} ${y0} V${y1}`, 1.2, R.terraDark);
  return s;
};

const column = (x, top, bottom, w = 5, fill = R.marble, shade = R.marbleShade) =>
  part(rr(x, top + 3, w, bottom - top - 5, 0.8), fill, null) +
  line(`M${x + w * 0.35} ${top + 5} V${bottom - 3} M${x + w * 0.7} ${top + 5} V${bottom - 3}`, 0.9, shade) +
  // capital and base
  part(rr(x - 1.2, top, w + 2.4, 3.2, 1), fill, null) + part(rr(x - 1, bottom - 2.4, w + 2, 2.4, 0.6), fill, null);

const archDoor = (x, y, w, h, fill = R.shadow) =>
  part(`M${x} ${y + h} V${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} V${y + h} Z`, fill, null);

export function house({ team = TEAMS.red } = {}) {
  // A domus: white stucco, terracotta roof with an open atrium (compluvium), an arched
  // doorway flanked by pilasters, and a painted band in the owner's color.
  return groundShadow(36, 88) +
    part('M20 87 V50 H80 V87 Z', R.marble, R.marbleShade, { shadeX: 66 }) +
    // painted dado band
    part('M20 78 H80 V83 H20 Z', team, null) +
    tiles('M13 53 L50 30 L87 53 Z', 20, 80, 38, 52, 6) +
    // compluvium: the atrium's opening in the roof
    part('M43 42 L50 38 L57 42 L50 46 Z', R.shadow, null) +
    line('M13 53 H87', 2.2, R.terraDark) +
    // doorway with pilasters and a lintel arch
    part(rr(40, 58, 3, 29, 0.6), R.travertine, null) + part(rr(57, 58, 3, 29, 0.6), R.travertine, null) +
    archDoor(43, 60, 14, 27, R.bronzeShade) +
    line('M50 70 V87', 1.4) +
    // small high windows
    part(rr(26, 60, 7, 6, 1), R.shadow, null) + part(rr(67, 60, 7, 6, 1), R.shadow, null) +
    flag(78, 36, team, 14);
}

export function stable({ team = TEAMS.red } = {}) {
  // A mansio's stable: a long arcade of round arches under a tiled roof, a horse
  // head in relief over the middle, hay showing in the bays.
  const bay = (x) =>
    archDoor(x, 60, 16, 27, R.shadow) +
    part(`M${x + 2} 87 Q${x + 8} 78 ${x + 14} 87 Z`, '#d7b25a', null);
  return groundShadow(44, 88) +
    part('M8 87 V52 H92 V87 Z', R.travertine, R.travShade, { shadeX: 74 }) +
    bay(14) + bay(42) + bay(70) +
    line('M8 58 H92', 1.8, R.travShade) +
    tiles('M3 55 L16 38 H84 L97 55 Z', 16, 84, 38, 54, 8) +
    // relief medallion with a horse head
    part(circ(50, 46, 8), R.marble, null) +
    part('M46 52 C46 47 49 45 50 42 C48 43 46 44 44 42 C45 40 48 37 50 35 L52 37 C55 38 56 43 55 47 C55 50 54 52 54 52 Z', R.bronze, null) +
    flag(88, 38, team, 13) + flag(12, 38, team, 13);
}

export function temple({ team = TEAMS.red } = {}) {
  // Like the Maison Carrée: a high podium with a stair, a hexastyle portico of
  // Corinthian columns, and a pediment whose tympanum carries the owner's wreath.
  let cols = '';
  for (let i = 0; i < 6; i++) cols += column(17 + i * 12.6, 44, 74, 5);
  return groundShadow(42, 89) +
    // podium and stair
    part('M10 88 V74 H90 V88 Z', R.travertine, R.travShade, { shadeX: 74 }) +
    part('M34 88 V77 H66 V88 Z', R.marble, null) +
    line('M34 80.5 H66 M34 84 H66', 1.3, R.marbleShade) +
    // cella wall behind the columns
    part('M16 74 V44 H84 V74 Z', R.marbleShade, null) +
    archDoor(43, 54, 14, 20, R.bronzeShade) +
    cols +
    // entablature
    part('M12 44 V37 H88 V44 Z', R.marble, R.marbleShade, { shadeX: 70 }) +
    line('M12 40.5 H88', 1.2, R.marbleShade) +
    // pediment
    part('M9 37 L50 12 L91 37 Z', R.marble, R.marbleShade, { shadeX: 56 }) +
    part('M20 34 L50 17 L80 34 Z', R.marbleShade, null) +
    // the owner's wreath on the tympanum
    `<circle cx="50" cy="28" r="5" fill="none" stroke="${team}" stroke-width="3"/>` +
    part(circ(50, 28, 1.8), R.gold, null) +
    // acroteria
    part(circ(50, 11, 2.6), R.gold, null) + part(circ(10, 36, 2.2), R.gold, null) + part(circ(90, 36, 2.2), R.gold, null);
}

export function barracks({ team = TEAMS.red } = {}) {
  // A castrum gate in the manner of the Porta Nigra: two rounded towers with rows
  // of arched windows, a double gateway, and the legion's vexillum over the gate.
  const tower = (x, w) => {
    let s = part(`M${x} 87 V34 Q${x + w / 2} 26 ${x + w} 34 V87 Z`, R.travertine, R.travShade, { shadeX: x + w * 0.66 });
    for (const y of [42, 58]) for (let i = 0; i < 2; i++) s += archDoor(x + 3 + i * (w / 2 - 1), y, w / 2 - 5, 10, R.shadow);
    return s + line(`M${x} 52 H${x + w} M${x} 68 H${x + w}`, 1.4, R.travShade);
  };
  return groundShadow(46, 88) +
    // gate block between the towers
    part('M26 87 V44 H74 V87 Z', R.travertine, R.travShade, { shadeX: 62 }) +
    archDoor(31, 62, 16, 25, R.shadow) + archDoor(53, 62, 16, 25, R.shadow) +
    line('M26 56 H74', 1.6, R.travShade) +
    archDoor(34, 47, 8, 8, R.shadow) + archDoor(46, 47, 8, 8, R.shadow) + archDoor(58, 47, 8, 8, R.shadow) +
    // a band of the owner's color with an inscription line (SPQR)
    part('M26 57 H74 V61 H26 Z', team, null) +
    line('M36 59 h5 M44 59 h5 M52 59 h5 M60 59 h5', 1.1, R.gold) +
    tower(8, 22) + tower(70, 22) +
    // the vexillum over the gate
    vexillum(50, 44, team, 30);
}

export function palace({ team = TEAMS.red } = {}) {
  // The imperial palace: a great dome (the Pantheon's) with an oculus, a
  // columned portico and pediment in front, colonnaded wings, and a gold
  // quadriga-eagle on top. Banners in the owner's color.
  let cols = '';
  for (let i = 0; i < 4; i++) cols += column(33 + i * 9.4, 50, 80, 4.6);
  const wing = (x) => {
    let s = part(`M${x} 87 V56 H${x + 24} V87 Z`, R.marble, R.marbleShade, { shadeX: x + 18 });
    for (let i = 0; i < 3; i++) s += archDoor(x + 3 + i * 7.4, 66, 5, 13, R.shadow);
    return s + tiles(`M${x - 3} 58 L${x + 12} 49 L${x + 27} 58 Z`, x, x + 24, 50, 57, 3);
  };
  return groundShadow(47, 88) +
    wing(6) + wing(70) +
    // drum and dome
    part('M26 60 V38 H74 V60 Z', R.travertine, R.travShade, { shadeX: 62 }) +
    part('M24 40 Q24 12 50 12 Q76 12 76 40 Z', R.bronze, R.bronzeShade, { shadeX: 58 }) +
    line('M30 30 Q50 22 70 30 M27 36 Q50 28 73 36', 1.2, R.bronzeShade) +
    part(ell(50, 13.5, 5, 1.8), R.shadow, null) +
    // the gold eagle on the oculus rim
    aquila(50, 8, 8) +
    // portico: stair, columns, pediment
    part('M28 88 V80 H72 V88 Z', R.marble, null) + line('M28 84 H72', 1.2, R.marbleShade) +
    part('M31 80 V50 H69 V80 Z', R.shadow, null) +
    archDoor(44, 62, 12, 18, R.bronzeShade) +
    cols +
    part('M29 50 V45 H71 V50 Z', R.marble, R.marbleShade, { shadeX: 60 }) +
    part('M27 45 L50 32 L73 45 Z', R.marble, R.marbleShade, { shadeX: 54 }) +
    part('M36 43 L50 35.5 L64 43 Z', team, null) +
    part(circ(50, 40, 2), R.gold, null) +
    vexillum(14, 49, team, 20) + vexillum(86, 49, team, 20);
}

export const BUILDINGS = { palace, house, stable, temple, barracks };
