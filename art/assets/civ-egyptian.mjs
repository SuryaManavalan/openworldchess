// Cosmetic civilization: Egyptian (docs/specs/cosmetics.md). Same chess
// silhouettes and the same drawing rules as pieces.mjs / world.mjs, dressed in
// the Nile's forms. The sources:
// - Pylon gateways with battered walls, a cavetto cornice, flagpoles in their
//   niches and a winged sun disk over the door (Karnak, Edfu).
// - Obelisks with gold pyramidions; a pyramid behind a papyrus-column shrine.
// - Mudbrick houses with roof terraces and malqaf wind catchers.
// - Fortresses with rounded crenellations (Buhen).
// - The pharaoh's nemes and double crown (the pschent), with an ankh as the
//   king's cross; Nefertiti's blue cap crown; an Anubis-masked priest; plumed
//   chariot horses; khepresh-helmed soldiers.
// Colors: sandstone, lapis, gold, faience turquoise, carnelian, kohl.
import { SIDES, TEAMS, INK, MAT, part, line, circ, rr, eyes, groundShadow } from '../lib/style.mjs';

const SAND = '#e6c98f', SANDSH = '#c9a66a';
const MUD = '#c99c66', MUDSH = '#a97d4d';
const LAPIS = '#2f5aa8', LAPISSH = '#23468a';
const TURQ = '#3fb3a8', CARN = '#b5413a';
const GOLD = MAT.gold, GOLDSH = MAT.goldShade;
const DOOR = '#3d3530';
const PALM = '#6fae4a', PALMSH = '#548f36';

// ---------- shared piece parts ----------

// The chess base, banded with a thin gold fillet like a faience inlay.
const base = (pal, w = 22) =>
  part(`M${50 - w} 88 Q${50 - w} 79 ${50 - w + 8} 77 H${50 + w - 8} Q${50 + w} 79 ${50 + w} 88 Z`, pal.body, pal.shade) +
  line(`M${50 - w + 4} 83 H${50 + w - 4}`, 1.6, GOLD);

// Kohl: the painted wing that runs out from the corner of each eye.
const kohl = (cx, y, gap, r = 1.6) =>
  line(`M${cx - gap / 2 - r * 1.1} ${y + r * 0.2} L${cx - gap / 2 - r * 2.6} ${y + r * 0.9} M${cx + gap / 2 + r * 1.1} ${y + r * 0.2} L${cx + gap / 2 + r * 2.6} ${y + r * 0.9}`, 1.1, INK);

// The broad wesekh collar: concentric bands of beads.
function wesekh(cx, y, w, team) {
  const band = (dy, ww, fill) => part(`M${cx - ww} ${y + dy} Q${cx} ${y + dy + ww * 0.62} ${cx + ww} ${y + dy} L${cx + ww - 2.2} ${y + dy - 2.6} Q${cx} ${y + dy + ww * 0.62 - 3.4} ${cx - ww + 2.2} ${y + dy - 2.6} Z`, fill, null, { stroke: false });
  return part(`M${cx - w} ${y} Q${cx} ${y + w * 0.62 + 4} ${cx + w} ${y} L${cx + w - 3} ${y - 3} Q${cx} ${y + 2} ${cx - w + 3} ${y - 3} Z`, team, null) +
    band(1.5, w - 1.5, GOLD) + band(4, w - 1.2, TURQ) +
    line(`M${cx - w} ${y} Q${cx} ${y + w * 0.62 + 4} ${cx + w} ${y}`, 2.4);
}

// A small ankh, the sign of life (the Egyptian king's "cross"): drawn as strokes,
// ink under gold, so the loop stays open at any size.
function ankh(x, y, s, fill = GOLD) {
  const d = `M${x} ${y} V${y + s * 2.4} M${x - s * 1.3} ${y + s * 0.35} H${x + s * 1.3} M${x} ${y} C${x - s * 1.25} ${y - s * 0.6} ${x - s * 0.9} ${y - s * 2.1} ${x} ${y - s * 2.1} C${x + s * 0.9} ${y - s * 2.1} ${x + s * 1.25} ${y - s * 0.6} ${x} ${y}`;
  const w = Math.max(1.4, s * 0.62);
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 2.2}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// The uraeus: the rearing cobra on a royal brow.
const uraeus = (x, y) =>
  part(`M${x - 2} ${y + 3} C${x - 2.5} ${y - 1} ${x - 2} ${y - 4} ${x} ${y - 5} C${x + 2} ${y - 4} ${x + 2.5} ${y - 1} ${x + 2} ${y + 3} Z`, GOLD, null) +
  `<circle cx="${x}" cy="${y - 2.4}" r="0.8" fill="${CARN}"/>`;

// ---------- pieces ----------

export function pawn({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  // A soldier: kilted body, khepresh-like helmet, a round-topped hide shield.
  return groundShadow(22) +
    base(p, 20) +
    part('M36 78 Q43 66 43 58 H57 Q57 66 64 78 Z', p.body, p.shade) +
    // the shendyt kilt's front panel
    part('M46 66 H54 L55 78 H45 Z', SAND, SANDSH, { shadeX: 51 }) +
    part(rr(37, 54, 26, 6, 3), team, null) +
    part(circ(50, 41, 12), p.body, p.shade) +
    // blue war helmet, studded with gold, flaring a little at the back
    part('M37 42 C36 28 43 23 50 23 C58 23 64 28 63.5 42 C60 37 56 35.5 50 35.5 C44 35.5 40 37 37 42 Z', LAPIS, LAPISSH, { shadeX: 56 }) +
    `<circle cx="44" cy="30" r="1.1" fill="${GOLD}"/><circle cx="50" cy="28" r="1.1" fill="${GOLD}"/><circle cx="56" cy="30" r="1.1" fill="${GOLD}"/>` +
    line('M38.5 38.5 Q50 34 61.5 38.5', 1.8, GOLD) +
    eyes(50, 45, 8, p, 1.6) + kohl(50, 45, 8, 1.6) +
    // round-topped cowhide shield in the player's color
    part('M24 79 V63 Q24 55 30.5 55 Q37 55 37 63 V79 Z', team, null) +
    `<ellipse cx="28.5" cy="66" rx="2.2" ry="1.6" fill="#f8f4ec" opacity="0.85"/><ellipse cx="32.5" cy="72" rx="1.8" ry="1.3" fill="#f8f4ec" opacity="0.85"/>` +
    line('M30.5 57 V77', 1.4, INK);
}

export function knight({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  const head = 'M30 77 C30 64 40 58 44 52 C38 54 30 57 24 53 C19 50 18 44 22 41 C28 34 34 26 40 21 L41 12 L47 19 C58 18 71 26 72 42 C74 56 70 68 70 77 Z';
  const mane = 'M47 19 C58 18 71 26 72 42 C74 56 70 68 70 77 L63 77 C63 66 67 55 64 42 C62 31 56 25 46 23 Z';
  // A chariot horse: ostrich plumes on the poll, a beaded bridle, a striped trapper.
  return groundShadow(24) +
    base(p, 24) +
    part(head, p.body, p.shade, { shadeX: 58 }) +
    part(mane, team, null) +
    // a striped trapper over the neck, lapis and gold like a nemes
    part('M44 60 C50 56 60 55 66 58 L67 70 C60 67 50 67 42 70 Z', LAPIS, null) +
    line('M46 63.5 C52 60.5 60 60 66.5 62 M44 67.5 C51 64.5 60 64 66.8 66', 1.8, GOLD) +
    // bridle
    line('M26 45 L40 38 L46 21 M31 49 L39 39', 1.8, GOLD) +
    part(circ(40, 38.5, 2), TURQ, null) +
    // plumes (two, curling back)
    part('M45 20 C41 10 44 2 52 2 C49 6 48 12 48.5 20 Z', team, null) +
    part('M48 20 C47 11 52 5 58 6 C54 9 52 14 51.5 20.5 Z', SAND, SANDSH, { shadeX: 55 }) +
    line('M60 30 L66 28 M64 42 L70 41 M64 55 L70 56', 2.4) +
    `<ellipse cx="38" cy="32" rx="1.7" ry="2.3" fill="${p.eye}"/>` + line('M39.6 31.2 L42.6 30', 1.1, INK) +
    `<ellipse cx="24.5" cy="46" rx="1.4" ry="1.8" fill="${p.eye}"/>`;
}

export function bishop({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  // A priest of Anubis: the jackal mask's tall ears make the bishop's point,
  // a leopard skin across the robe, an ankh staff in hand.
  const mask = '#34302c', maskHi = '#4a4540';
  return groundShadow(22) +
    base(p, 21) +
    part('M34 78 Q41 66 42 60 H58 Q59 66 66 78 Z', p.body, p.shade) +
    // leopard skin sash
    part('M39.5 62 L63 78 H55.5 L37.5 66.5 Z', '#dba94a', null) +
    `<circle cx="44" cy="66" r="1.1" fill="${INK}"/><circle cx="49" cy="70" r="1.1" fill="${INK}"/><circle cx="54" cy="73.5" r="1.1" fill="${INK}"/><circle cx="47" cy="67.5" r="0.8" fill="${INK}"/>` +
    part(rr(37, 56, 26, 6, 3), team, null) +
    // jackal mask: ears, brow, long muzzle
    part('M39 52 C37 44 36.5 36 37.5 28 L36 14 L44.5 26 H55.5 L64 14 L62.5 28 C63.5 36 63 44 61 52 C57 58 43 58 39 52 Z', mask, maskHi, { shadeX: 56 }) +
    part('M39.5 20 L43 26.5 H40 Z', GOLD, null, { stroke: false }) + part('M60.5 20 L57 26.5 H60 Z', GOLD, null, { stroke: false }) +
    part('M44.5 44 L50 58 L55.5 44 Q50 41 44.5 44 Z', '#4a4540', null) +
    `<ellipse cx="50" cy="56" rx="1.8" ry="1.3" fill="${INK}"/>` +
    // gold collar lines and almond eyes
    line('M40 30 H60', 1.6, GOLD) +
    part('M41.5 38 Q45 35.5 48 38 Q45 39.5 41.5 38 Z', GOLD, null, { stroke: false }) +
    part('M52 38 Q55 35.5 58.5 38 Q55 39.5 52 38 Z', GOLD, null, { stroke: false }) +
    // ankh staff
    line('M71 86 V44', 2.6, INK) + line('M71 85 V45', 1.2, GOLD) + ankh(71, 37, 3.4);
}

export function elephant({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  const leg = (x, fill) =>
    part(`M${x} 60 H${x + 10} L${x + 9.5} 88 H${x + 0.5} Z`, fill, null) +
    line(`M${x + 2.5} 86 v-2 M${x + 5} 86 v-2 M${x + 7.5} 86 v-2`, 1.4) +
    line(`M${x + 1} 80 H${x + 9}`, 1.6, GOLD);
  // The rook: a war elephant carrying a small pylon tower, its battered walls
  // topped by a cavetto cornice and rounded crenellations (Buhen).
  const pylon = 'M50 40 L52.5 21 H75 L77.5 40 Z';
  const cornice = 'M50.5 21 L49 15 H78.5 L77 21 Z';
  let merlons = '';
  for (let i = 0; i < 4; i++) { const x = 51.5 + i * 7.2; merlons += `M${x} 15 V12.5 A2.9 2.9 0 0 1 ${x + 5.8} 12.5 V15 Z `; }
  return groundShadow(36, 90) +
    line('M86 44 Q90 52 88 62', 2.4) +
    leg(66, p.shade) + leg(77, p.shade) +
    leg(36, p.body) + leg(49, p.body) +
    part('M34 44 C40 32 66 30 80 36 C88 40 89 56 85 68 Q60 73 36 68 C32 60 31 51 34 44 Z', p.body, p.shade, { shadeX: 72 }) +
    // caparison: team cloth with a lotus border
    part('M44 38 C56 33 70 33 80 37 L80 53 Q62 57 46 53 Z', team, null) +
    line('M46 50 Q62 54 80 50', 2, GOLD) +
    `<path d="M50 50.5 l1.6 -3 l1.6 3 M57 51.4 l1.6 -3 l1.6 3 M64 51.6 l1.6 -3 l1.6 3 M71 51 l1.6 -3 l1.6 3" fill="none" stroke="${TURQ}" stroke-width="1.3"/>` +
    // the pylon tower
    part(pylon, SAND, SANDSH, { shadeX: 70 }) +
    part(cornice, SAND, SANDSH, { shadeX: 72 }) +
    line('M50 21 H77.5', 2, INK) +
    part(merlons, SAND, null) +
    line('M55 27 V33 M63.7 27 V33 M72.5 27 V33', 2.2) +
    part('M60.5 40 V33 Q63.7 29.5 67 33 V40 Z', DOOR, null) +
    part('M58 22.5 H69.5 V25 H58 Z', LAPIS, null, { stroke: false }) +
    // head and trunk
    part('M42 40 C37 30 24 29 18 36 C13 42 13 51 15 58 C17 66 16 75 13 83 C12 87 17 89 19 86 C22 78 24 70 27 64 C33 62 40 61 43 56 Z', p.body, null) +
    line('M16 66 h4 M15.5 72 h4 M15 78 h3.5', 1.6) +
    // gold browband with a turquoise boss
    part('M20.5 36.5 C26 32 34 32 39 35.5 L38 39.5 C33 36.5 26 36.5 21.5 40 Z', GOLD, null) +
    part(circ(29, 36, 2.3), TURQ, null) +
    part('M24 59 C18 63 11 62 7 55 C12 58 18 57 22 54 Z', '#f6efdf', null) +
    line('M11.5 58.2 l1.6 -1.6', 2.4, GOLD) +
    part('M30 37 C40 33 49 40 48 53 C47 61 40 65 34 63 C29 57 28 46 30 37 Z', p.shade, null) +
    line('M34 43 C39 45 41 51 39 57', 1.6) +
    `<ellipse cx="24" cy="44" rx="1.5" ry="2" fill="${p.eye}"/>` +
    line('M22.6 40.5 L25.8 41.3', 1.5, p.eye) + line('M25.6 44.2 L28.4 45.2', 1.1, INK);
}

export function queen({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  // Nefertiti's crown: the tall flat-topped blue cap, ringed with a gold diadem
  // with a rising cobra, over a broad bead collar.
  return groundShadow(24) +
    base(p, 23) +
    part('M30 78 Q40 64 42 56 H58 Q60 64 70 78 Z', p.body, p.shade) +
    // pleated linen lines
    line('M44 64 L40 77 M50 63 V77 M56 64 L60 77', 1.3, p.shade) +
    wesekh(50, 54, 13, team) +
    part(circ(50, 44, 10), p.body, p.shade) +
    part('M37.5 41 L35 17 Q35 11 42 11 H60 Q67 11 66 17 L62.5 41 Q50 35 37.5 41 Z', LAPIS, LAPISSH, { shadeX: 58 }) +
    // gold diadem band
    part('M37 38.5 Q50 32 63 38.5 L62.6 35.6 Q50 29.2 37.4 35.6 Z', GOLD, GOLDSH, { shadeX: 56 }) +
    line('M40 17 H62', 1.5, GOLD) +
    `<circle cx="42" cy="24" r="1.3" fill="${TURQ}"/><circle cx="50" cy="23" r="1.3" fill="${CARN}"/><circle cx="58" cy="24" r="1.3" fill="${TURQ}"/>` +
    uraeus(50, 32) +
    // earrings
    part(circ(39.5, 50.5, 1.9), GOLD, null) + part(circ(60.5, 50.5, 1.9), GOLD, null) +
    eyes(50, 45, 8, p, 1.6) + kohl(50, 45, 8, 1.6) +
    `<path d="M47.8 50.6 Q50 51.6 52.2 50.6" fill="none" stroke="#9a5a4a" stroke-width="1.1" stroke-linecap="round"/>`;
}

export function king({ side = 'light', team = TEAMS.red, emperor = false } = {}) {
  const p = SIDES[side];
  // The pharaoh: striped nemes headcloth, the double crown (red deshret around
  // the white hedjet), the ankh as the king's cross, and a braided false beard.
  // The Emperor wears it all in gold, with the crook and flail crossed on his chest.
  const nemes = emperor ? GOLD : p.body, nemesSh = emperor ? GOLDSH : p.shade, stripe = emperor ? LAPIS : team;
  const hedjet = emperor ? GOLD : p.body, hedjetSh = emperor ? GOLDSH : p.shade;
  const deshret = emperor ? GOLD : CARN, deshretSh = emperor ? GOLDSH : '#8f3029';
  return groundShadow(25) +
    base(p, 24) +
    part('M27 78 Q37 62 41 57 H59 Q63 62 73 78 Z', p.body, p.shade) +
    // nemes lappets falling over the shoulders, and the headcloth behind the face
    part('M36.5 36 Q50 30 63.5 36 L67 56 L61 60 L59 46 H41 L39 60 L33 56 Z', nemes, nemesSh, { shadeX: 58 }) +
    line('M35.2 44 L40.8 45.6 M35.8 49 L40.4 50.2 M36.4 54 L39.9 55 M64.8 44 L59.2 45.6 M64.2 49 L59.6 50.2 M63.6 54 L60.1 55', 2, stripe) +
    wesekh(50, 55, 13, team) +
    part(circ(50, 45, 10), p.body, p.shade) +
    // braided false beard
    part('M47.6 53 H52.4 L51.6 61 Q50 62.6 48.4 61 Z', emperor ? GOLD : '#4a4038', null) +
    line('M48 56 H52 M48.3 58.5 H51.7', 1, emperor ? GOLDSH : '#2b2622') +
    // the double crown: the tall white hedjet inside the red deshret
    part('M43.5 32 C43.5 22 46.5 14.5 50 11 C53.5 14.5 56.5 22 56.5 32 Z', hedjet, hedjetSh, { shadeX: 53 }) +
    part('M38 36 L39 27 H45 L45.5 30 H54.5 L55 27 H61 L62 36 Q50 32.5 38 36 Z', deshret, deshretSh, { shadeX: 56 }) +
    // the deshret's curled wire
    `<path d="M45 28 C42 23 38.5 23 39.5 19.5" fill="none" stroke="${emperor ? GOLDSH : GOLD}" stroke-width="1.8" stroke-linecap="round"/>` +
    uraeus(50, 33.5) +
    // the ankh: the Egyptian king's cross
    ankh(50, 6.5, 2.4) +
    eyes(50, 45, 8, p, 1.6) + kohl(50, 45, 8, 1.6) +
    (emperor
      // crook (heqa) and flail (nekhakha), crossed
      ? line('M40.5 76 L57 60', 2.6, INK) + line('M40.7 75.6 L56.8 60.2', 1.2, LAPIS) +
        `<path d="M57 60 C58.5 57 61.5 57.5 61 60.6" fill="none" stroke="${GOLD}" stroke-width="2.6" stroke-linecap="round"/>` +
        line('M59.5 76 L43 60', 2.6, INK) + line('M59.3 75.6 L43.2 60.2', 1.2, GOLD) +
        line('M43 60 L38.5 57.5 M43 60 L39.5 60.4 M43 60 L40.5 63', 1.6, GOLD)
      : '');
}

export const PIECES = { king, queen, elephant, bishop, knight, pawn };

// ---------- buildings ----------

// A pennant on a tall flagpole, as in a pylon's niches.
const pennant = (x, y, team, h = 18) =>
  line(`M${x} ${y} V${y - h}`, 2.2) +
  part(`M${x} ${y - h} C${x + 5} ${y - h - 1} ${x + 8} ${y - h + 3} ${x + 13} ${y - h + 2} C${x + 9} ${y - h + 5} ${x + 5} ${y - h + 7} ${x} ${y - h + 7} Z`, team, null);

// The winged sun disk over a doorway.
const wingedSun = (cx, y, w = 12) =>
  part(`M${cx - w} ${y} C${cx - w * 0.7} ${y - 3.4} ${cx - w * 0.35} ${y - 3} ${cx - 3} ${y - 1.4} L${cx - 3} ${y + 1.6} C${cx - w * 0.4} ${y + 2.4} ${cx - w * 0.75} ${y + 2.2} ${cx - w} ${y} Z`, LAPIS, null) +
  part(`M${cx + w} ${y} C${cx + w * 0.7} ${y - 3.4} ${cx + w * 0.35} ${y - 3} ${cx + 3} ${y - 1.4} L${cx + 3} ${y + 1.6} C${cx + w * 0.4} ${y + 2.4} ${cx + w * 0.75} ${y + 2.2} ${cx + w} ${y} Z`, LAPIS, null) +
  line(`M${cx - w + 2.5} ${y + 0.2} L${cx - 3.5} ${y + 0.2} M${cx + w - 2.5} ${y + 0.2} L${cx + 3.5} ${y + 0.2}`, 0.9, GOLD) +
  part(circ(cx, y, 3.2), GOLD, null);

// Obelisk with a gold pyramidion. Slender, so drawn with a lighter outline
// than the building (a full-weight outline would swallow it).
function obelisk(x, top, bottom = 87, w = 6) {
  const shaft = `M${x - w / 2} ${bottom} L${x - w * 0.34} ${top + 5} H${x + w * 0.34} L${x + w / 2} ${bottom} Z`;
  const tip = `M${x - w * 0.34} ${top + 5} L${x} ${top} L${x + w * 0.34} ${top + 5} Z`;
  return `<path d="${shaft}" fill="#f0dcae"/>` +
    `<path d="M${x + w * 0.08} ${bottom} L${x + w * 0.06} ${top + 5} H${x + w * 0.34} L${x + w / 2} ${bottom} Z" fill="${SAND}"/>` +
    `<path d="${tip}" fill="${GOLD}"/>` +
    line(`M${x - w * 0.1} ${top + 11} V${top + 13.5} M${x - w * 0.1} ${top + 17} V${top + 19.5} M${x - w * 0.1} ${top + 23} V${top + 25}`, 1.1, SANDSH) +
    `<path d="${shaft} ${tip}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
}

// Tiny hieroglyph rows (just marks: reeds, water, sun, pyramids), for texture.
function glyphs(x, y, n, color = SANDSH) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const gx = x + i * 5.2, k = i % 4;
    if (k === 0) d += `M${gx} ${y + 3} V${y - 1} M${gx - 1} ${y - 1} H${gx + 1} `;
    else if (k === 1) d += `M${gx - 1.6} ${y + 2.2} q0.8 -1.2 1.6 0 t1.6 0 `;
    else if (k === 2) d += `M${gx - 1.2} ${y + 2.6} A1.4 1.4 0 1 1 ${gx + 1.2} ${y + 2.6} `;
    else d += `M${gx - 1.4} ${y + 3} L${gx} ${y - 1} L${gx + 1.4} ${y + 3} `;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.1" stroke-linecap="round"/>`;
}

// Papyrus column with an open-flower capital.
const papyrus = (x, top, bottom, w = 6) =>
  part(`M${x - w / 2} ${bottom} V${top + 6} H${x + w / 2} V${bottom} Z`, SAND, SANDSH, { shadeX: x + 1 }) +
  part(`M${x - w / 2 - 3} ${top} Q${x} ${top + 3} ${x + w / 2 + 3} ${top} L${x + w / 2} ${top + 6} H${x - w / 2} Z`, SAND, SANDSH, { shadeX: x + 2 }) +
  line(`M${x - w / 2} ${top + 9} H${x + w / 2} M${x - w / 2} ${top + 11} H${x + w / 2}`, 1.2, LAPIS);

// Date palm.
function palm(x, ground, h = 38) {
  const top = ground - h;
  return line(`M${x} ${ground} C${x + 2} ${ground - h * 0.5} ${x - 1} ${ground - h * 0.8} ${x + 1} ${top}`, 4.6) +
    line(`M${x} ${ground} C${x + 2} ${ground - h * 0.5} ${x - 1} ${ground - h * 0.8} ${x + 1} ${top}`, 2.6, '#a06e44') +
    line(`M${x - 1} ${ground - 10} h3 M${x} ${ground - 18} h3 M${x} ${ground - 26} h3`, 1.1, '#6d4a2c') +
    part(`M${x + 1} ${top} C${x - 6} ${top - 6} ${x - 12} ${top - 4} ${x - 15} ${top + 3} C${x - 9} ${top} ${x - 5} ${top + 1} ${x + 1} ${top + 2} Z`, PALM, null) +
    part(`M${x + 1} ${top} C${x + 8} ${top - 6} ${x + 14} ${top - 4} ${x + 16} ${top + 3} C${x + 10} ${top} ${x + 6} ${top + 1} ${x + 1} ${top + 2} Z`, PALMSH, null) +
    part(`M${x + 1} ${top + 1} C${x - 3} ${top - 8} ${x + 1} ${top - 13} ${x + 7} ${top - 12} C${x + 3} ${top - 8} ${x + 3} ${top - 4} ${x + 2} ${top + 1} Z`, PALM, null) +
    part(`M${x + 1} ${top + 1} C${x - 6} ${top + 4} ${x - 9} ${top + 10} ${x - 8} ${top + 14} C${x - 5} ${top + 8} ${x - 2} ${top + 5} ${x + 1} ${top + 3} Z`, PALMSH, null) +
    `<circle cx="${x - 0.5}" cy="${top + 4}" r="1.4" fill="${CARN}"/><circle cx="${x + 2.2}" cy="${top + 4.5}" r="1.4" fill="${CARN}"/>`;
}

export function palace({ team = TEAMS.red } = {}) {
  // A pylon gateway (Karnak, Edfu): two battered towers under a cavetto cornice,
  // tall flagpoles standing in niches cut into their faces, the winged sun disk
  // over the gate, and a pair of gold-tipped obelisks before it (Luxor).
  const top = 30;
  const tower = (x0, x1, flip) => {
    const inset = 5;
    const body = flip ? `M${x0} 87 L${x0 + inset} ${top} H${x1} V87 Z` : `M${x0} 87 V${top} H${x1 - inset} L${x1} 87 Z`;
    const tl = flip ? x0 + inset : x0, tr = flip ? x1 : x1 - inset;
    const mid = (tl + tr) / 2;
    return part(body, SAND, SANDSH, { shadeX: flip ? x1 - 8 : x1 - 12 }) +
      // flagpole niches
      part(rr(mid - 11, top + 4, 4, 52, 1.5), SANDSH, null, { stroke: false }) +
      part(rr(mid + 7, top + 4, 4, 52, 1.5), SANDSH, null, { stroke: false }) +
      // cornice with its groove and the torus below it
      part(`M${tl - 2} ${top} L${tl - 3.5} ${top - 6} H${tr + 3.5} L${tr + 2} ${top} Z`, SAND, SANDSH, { shadeX: tr - 4 }) +
      line(`M${tl - 2.5} ${top - 3} H${tr + 2.5}`, 1.1, SANDSH) +
      line(`M${tl - 2} ${top} H${tr + 2}`, 2.2, INK) +
      // a painted relief band: the king's name in a cartouche between glyph rows
      part(rr(mid - 3.4, top + 3, 6.8, 11, 3.4), '#f3e2b8', null) +
      line(`M${mid - 1.5} ${top + 6.5} H${mid + 1.5} M${mid} ${top + 8.5} V${top + 11}`, 1.1, LAPIS) +
      glyphs(mid - 11.5, top + 22, 1) + glyphs(mid + 11.5, top + 22, 1) +
      part(rr(mid - 9, top + 44, 18, 3.4, 1), team, null, { stroke: false }) +
      part(rr(mid - 9, top + 48.5, 18, 2.2, 1), LAPIS, null, { stroke: false });
  };
  return groundShadow(46, 88) +
    // flagpoles rising from the niches
    pennant(11, 34, team, 30) + pennant(29, 34, team, 26) + pennant(71, 34, team, 26) + pennant(89, 34, team, 30) +
    tower(5, 40, false) + tower(60, 95, true) +
    // the gate between the towers, with its own cornice and the winged sun
    part('M37 87 V42 H63 V87 Z', SAND, SANDSH, { shadeX: 57 }) +
    part('M35.5 42 L34.5 36 H65.5 L64.5 42 Z', SAND, SANDSH, { shadeX: 58 }) +
    line('M35.5 42 H64.5', 2, INK) +
    wingedSun(50, 48.5, 12) +
    part('M43 87 V57 H57 V87 Z', DOOR, null) +
    line('M50 57 V87', 1.4, '#2a2420') +
    part(rr(42, 54.6, 16, 2.4, 0.6), GOLD, null, { stroke: false }) +
    // obelisks standing before the towers
    obelisk(20.5, 46, 88, 8.5) + obelisk(79.5, 46, 88, 8.5);
}

export function temple({ team = TEAMS.red } = {}) {
  // A pyramid with a gold pyramidion behind a papyrus-column shrine, an ankh over the door.
  return groundShadow(44, 88) +
    part('M9 72 L50 8 L91 72 Z', SAND, SANDSH, { shadeX: 50 }) +
    `<path d="M16 62 H84 M22.5 52 H77.5 M29 42 H71 M35.5 32 H64.5 M42 22 H58" fill="none" stroke="${SANDSH}" stroke-width="1.2"/>` +
    part('M44.2 17 L50 8 L55.8 17 Z', GOLD, GOLDSH, { shadeX: 51 }) +
    // the shrine in front
    part('M26 87 V52 H74 V87 Z', SAND, SANDSH, { shadeX: 64 }) +
    part('M24 52 L22.5 45 H77.5 L76 52 Z', SAND, SANDSH, { shadeX: 66 }) +
    line('M24 52 H76', 2.2, INK) +
    part(rr(26, 46.5, 48, 3, 1), team, null, { stroke: false }) +
    papyrus(31.5, 55, 87) + papyrus(68.5, 55, 87) +
    part('M42 87 V64 H58 V87 Z', DOOR, null) +
    part(rr(41, 61.5, 18, 2.6, 0.8), LAPIS, null, { stroke: false }) +
    ankh(50, 57.8, 2.2) +
    // offering flames on stands
    line('M19 87 V78 M81 87 V78', 2.2) +
    part('M16.5 78 H21.5 L20.5 75.5 H17.5 Z', GOLD, null) + part('M78.5 78 H83.5 L82.5 75.5 H79.5 Z', GOLD, null) +
    part('M19 75 C17.5 72.5 18.5 70.5 19 69 C20 70.5 21 72.5 19 75 Z', '#f3b23a', null, { stroke: false }) +
    part('M81 75 C79.5 72.5 80.5 70.5 81 69 C82 70.5 83 72.5 81 75 Z', '#f3b23a', null, { stroke: false });
}

export function house({ team = TEAMS.red } = {}) {
  // A mudbrick house with a roof terrace and a malqaf (wind catcher), a date palm beside it.
  return groundShadow(38, 88) +
    palm(80, 87, 42) +
    // main block, slightly battered walls
    part('M20 87 L21.5 46 H66.5 L68 87 Z', MUD, MUDSH, { shadeX: 58 }) +
    // roof parapet and the upper room
    part('M19.5 46 V42 H68.5 V46 Z', MUD, MUDSH, { shadeX: 60 }) +
    part('M22 42 V32 H40 V42 Z', MUD, MUDSH, { shadeX: 35 }) +
    part('M21 32 V29.5 H41 V32 Z', SAND, null) +
    // wind catcher: an angled hood facing the north wind
    part('M50 42 V26 L62 22 V42 Z', MUD, MUDSH, { shadeX: 58 }) +
    part('M52 28 L60 25.4 V33 H52 Z', DOOR, null) +
    // painted band and door with a lintel
    part(rr(21.5, 50, 45, 3.2, 1), team, null, { stroke: false }) +
    part('M38 87 V66 H50 V87 Z', '#a06e44', '#825634', { shadeX: 46 }) +
    part('M36 66 H52 V62.5 H36 Z', SAND, null) +
    // high small windows with lattice
    part(rr(26, 58, 7, 6, 1), DOOR, null) + part(rr(55, 58, 7, 6, 1), DOOR, null) +
    line('M29.5 58 V64 M58.5 58 V64', 1.2, SAND) +
    // brick courses
    line('M24 72 H34 M54 72 H64 M24 80 H34 M54 80 H64', 1, MUDSH) +
    // team pennant on the terrace
    pennant(31, 32, team, 14) +
    // a water jar by the door
    part('M55 87 C52 84 52.5 79 55.5 78 H58.5 C61.5 79 62 84 59 87 Z', '#b86b3e', null);
}

export function stable({ team = TEAMS.red } = {}) {
  // A mudbrick stable under a palm-rib awning, a spoked chariot wheel leaning at the door.
  return groundShadow(44, 88) +
    part('M10 87 V50 H90 V87 Z', MUD, MUDSH, { shadeX: 72 }) +
    part('M9 50 V46 H91 V50 Z', SAND, null) +
    // awning of palm ribs on posts
    part('M6 56 L10 44 H90 L94 56 Z', '#b58f55', '#96733f', { shadeX: 72 }) +
    `<path d="M15 45 L12 55.5 M22 45 L20 55.5 M29 45 L28 55.5 M36 45 L35.5 55.5 M43 45 L43 55.5 M50 45 V55.5 M57 45 L57 55.5 M64 45 L64.5 55.5 M71 45 L72 55.5 M78 45 L80 55.5 M85 45 L88 55.5" stroke="#7d5c30" stroke-width="1.1"/>` +
    line('M13 56 V87 M87 56 V87', 3) + line('M13 56.5 V86.5 M87 56.5 V86.5', 1.4, '#a06e44') +
    // wide doorway with a horse looking out
    part('M33 87 V60 H67 V87 Z', DOOR, null) +
    part('M44 87 C44 78 48 73 51 70 C49 71 45 71 43 69 C41.5 67 42 64.5 43.5 63.5 C46 61 48.5 59.5 51 58 L51.5 55 L54 58 C59 58 63 62 63 69 C63.5 76 62.5 82 62.5 87 Z', '#8a6446', '#6e4e36', { shadeX: 58 }) +
    part('M51.5 55 L50 49 C53 47 56 49 55 55 Z', team, null) +
    `<ellipse cx="49.5" cy="62.5" rx="1" ry="1.3" fill="#f3ede2"/>` +
    part('M33 76 H67 V79 H33 Z', '#a06e44', null) +
    // painted band
    part(rr(10.5, 57, 20, 3, 1), team, null, { stroke: false }) + part(rr(69.5, 57, 20, 3, 1), team, null, { stroke: false }) +
    // chariot wheel: six spokes, a team-painted rim
    part(circ(79, 76, 10), team, null) + part(circ(79, 76, 7), '#e8d4a8', null) +
    line('M79 69 V83 M72.9 72.5 L85.1 79.5 M72.9 79.5 L85.1 72.5', 1.6, '#6d4a2c') +
    part(circ(79, 76, 1.8), GOLD, null) +
    // a feed trough
    part('M16 87 L17.5 79 H30.5 L32 87 Z', '#a06e44', '#825634', { shadeX: 27 }) +
    line('M19 79 q1.5 -3 3 0 q1.5 -3 3 0 q1.5 -3 3 0', 1.4, '#9bbf4a');
}

export function barracks({ team = TEAMS.red } = {}) {
  // A fortress in the Buhen manner: battered walls, rounded crenellations,
  // projecting bastions, a gate under a team banner, spears at the ready.
  const merlons = (x0, x1, top, n) => {
    const w = (x1 - x0) / n;
    let d = `M${x0} ${top + 5}`;
    for (let i = 0; i < n; i++) { const x = x0 + i * w; d += ` L${x} ${top + 3.2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${top + 3.2}`; }
    return d + ` V${top + 5} Z`;
  };
  const bastion = (x0, x1, top) =>
    part(`M${x0} 87 L${x0 + 2.5} ${top + 5} H${x1 - 2.5} L${x1} 87 Z`, MUD, MUDSH, { shadeX: x1 - 7 }) +
    part(merlons(x0 + 2.5, x1 - 2.5, top, 3), MUD, MUDSH, { shadeX: x1 - 7 }) +
    part(rr((x0 + x1) / 2 - 1.5, top + 16, 3, 7, 1.5), DOOR, null) +
    line(`M${x0 + 3} ${top + 32} H${x1 - 3} M${x0 + 2} ${top + 44} H${x1 - 2}`, 1, MUDSH);
  return groundShadow(46, 88) +
    // main wall
    part('M18 87 L20 44 H80 L82 87 Z', MUD, MUDSH, { shadeX: 68 }) +
    part(merlons(20, 80, 39, 8), MUD, MUDSH, { shadeX: 68 }) +
    line('M22 60 H78 M21 74 H79', 1, MUDSH) +
    bastion(5, 27, 28) + bastion(73, 95, 28) +
    // the gate with a banner above
    part('M40 87 V64 Q50 54 60 64 V87 Z', DOOR, null) +
    line('M44 87 V64 M50 87 V60.5 M56 87 V64', 1.6, '#5a4a3a') +
    part('M38 50 H62 V58 L50 62 L38 58 Z', team, null) +
    part(circ(50, 55, 2.6), GOLD, null) +
    // rows of spears and round-topped shields on the wall
    line('M30 58 L27 44 M33.5 58 L31 44 M67 58 L69 44 M70.5 58 L73 44', 1.6) +
    `<path d="M27 44 l-0.8 -3 l1.8 1.6 Z M31 44 l-0.6 -3 l1.8 1.8 Z M69 44 l0.6 -3 l-1.8 1.8 Z M73 44 l0.8 -3 l-1.8 1.6 Z" fill="${GOLD}" stroke="${INK}" stroke-width="0.8"/>` +
    part('M23.5 72 V66 Q23.5 62.5 26.5 62.5 Q29.5 62.5 29.5 66 V72 Z', team, null) +
    part('M70.5 72 V66 Q70.5 62.5 73.5 62.5 Q76.5 62.5 76.5 66 V72 Z', team, null) +
    // pennants on the bastions
    pennant(16, 31, team, 16) + pennant(84, 31, team, 16);
}

export const BUILDINGS = { palace, house, stable, temple, barracks };
