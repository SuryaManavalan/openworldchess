// Camps of the wilds (docs/specs/wilds.md). Same style as the buildings in
// world.mjs: a 100x100 box drawn over 2x2 squares, ink outlines, a shade band.
// Materials (stone, wood, hide) stay natural; the faction's colors show on
// banners, paint and trim, so a goblin camp and a bandit camp read apart.
import { MAT, INK, part, line, circ, ell, rr, groundShadow } from '../lib/style.mjs';

const HIDE = '#c9a77c', HIDE_SH = '#a8875e';
const EARTH = '#a88158', EARTH_SH = '#8a6644';
const BONE = '#efe6d2', BONE_SH = '#d4c7ab';
const HOLE = '#3d3530';
const STRAW = '#d4b86a', STRAW_SH = '#b39448';
const WATER = '#8fd0e3', WATER_SH = '#71bcd4';

// A bone: an ink stroke with a bone-colored core and knobbed ends.
const bone = (x1, y1, x2, y2) =>
  line(`M${x1} ${y1} L${x2} ${y2}`, 6) + line(`M${x1} ${y1} L${x2} ${y2}`, 3, BONE) +
  part(circ(x1, y1, 2.2), BONE, null) + part(circ(x2, y2, 2.2), BONE, null);

const skull = (x, y, s = 1) =>
  part(`M${x - 7 * s} ${y} C${x - 7 * s} ${y - 10 * s} ${x + 7 * s} ${y - 10 * s} ${x + 7 * s} ${y} V${y + 5 * s} H${x - 7 * s} Z`, BONE, BONE_SH, { shadeX: x + 3 * s }) +
  `<ellipse cx="${x - 3 * s}" cy="${y - 1 * s}" rx="${2 * s}" ry="${2.4 * s}" fill="${HOLE}"/>` +
  `<ellipse cx="${x + 3 * s}" cy="${y - 1 * s}" rx="${2 * s}" ry="${2.4 * s}" fill="${HOLE}"/>`;

const fire = (x, y) =>
  line(`M${x - 7} ${y} L${x + 7} ${y - 3} M${x - 7} ${y - 3} L${x + 7} ${y}`, 3.6, MAT.woodShade) +
  part(`M${x} ${y - 16} C${x + 6} ${y - 9} ${x + 6} ${y - 3} ${x} ${y - 3} C${x - 6} ${y - 3} ${x - 6} ${y - 10} ${x} ${y - 16} Z`, '#f0913a', null) +
  `<path d="M${x} ${y - 10} C${x + 3} ${y - 7} ${x + 3} ${y - 4} ${x} ${y - 4} C${x - 3} ${y - 4} ${x - 3} ${y - 7} ${x} ${y - 10} Z" fill="#ffd24a"/>`;

const tuft = (x, y, c = MAT.leafShade) => line(`M${x} ${y} l-2 -5 M${x + 3} ${y} l0 -7 M${x + 6} ${y} l2 -5`, 2.2, c);

const ragged = (x, y, w, h, fill) =>
  part(`M${x} ${y} H${x + w} L${x + w - 4} ${y + h * 0.35} L${x + w} ${y + h * 0.7} L${x + w - 3} ${y + h} L${x} ${y + h} Z`, fill, null);

// ---------- camps ----------

export function tents({ accent }) {
  return groundShadow(44, 88) +
    // big tent behind, with a banner on its ridge pole
    line('M64 30 V8', 2.6) +
    part('M64 9 L82 12 L77 16 L83 21 L64 22 Z', accent, null) +
    part('M38 87 L64 30 L92 87 Z', HIDE, HIDE_SH, { shadeX: 68 }) +
    line('M58 26 L70 38 M70 26 L58 38', 2.6) +
    line('M46 72 L82 72', 3, accent) +
    part('M56 87 L64 62 L72 87 Z', HOLE, null) +
    part(rr(78, 50, 6, 6, 1), HIDE_SH, null) +
    // small tent in front
    part('M6 87 L26 46 L46 87 Z', HIDE, HIDE_SH, { shadeX: 30 }) +
    line('M21 42 L31 52 M31 42 L21 52', 2.6) +
    part('M20 87 L26 70 L32 87 Z', HOLE, null) +
    part(rr(10, 70, 6, 5, 1), HIDE_SH, null) +
    fire(50, 91);
}

export function den({ accent }) {
  return groundShadow(46, 88) +
    part('M6 87 C6 62 20 40 44 34 C52 30 62 32 70 38 C86 46 94 64 94 87 Z', MAT.stone, MAT.stoneShade, { shadeX: 68 }) +
    part('M28 87 C28 66 38 55 50 55 C62 55 72 66 72 87 Z', HOLE, null) +
    line('M20 58 L26 64 M78 56 L74 64 M58 40 L62 46', 2.2) +
    // claw marks in faction paint
    line('M14 70 L20 60 M18 72 L24 62 M22 74 L28 64', 2.4, accent) +
    part('M40 36 C44 30 52 30 54 35 Z', MAT.leaf, null) +
    bone(30, 88, 44, 84) + bone(58, 88, 70, 90) + skull(80, 84, 0.8);
}

export function burrow({ accent }) {
  const hole = (x, y, r) => part(`M${x - r - 3} ${y + 2} A${r + 3} ${r + 1} 0 0 1 ${x + r + 3} ${y + 2} Z`, '#c29a6e', null) + part(`M${x - r} ${y + 2} A${r} ${r * 0.8} 0 0 1 ${x + r} ${y + 2} Z`, HOLE, null);
  const stake = (x) => part(`M${x} 88 L${x + 3} 64 L${x + 6} 88 Z`, MAT.wood, null) + part(`M${x + 1.5} 76 L${x + 3} 64 L${x + 4.5} 76 Z`, accent, null);
  return groundShadow(46, 88) +
    part('M8 87 C12 64 30 50 52 50 C74 50 90 64 94 87 Z', EARTH, EARTH_SH, { shadeX: 70 }) +
    hole(40, 74, 10) + hole(70, 66, 8) +
    line('M30 64 l4 -2 M76 76 l4 1 M48 58 l3 -2', 2, EARTH_SH) +
    // a pick left at the entrance
    line('M74 88 L86 72', 3, MAT.wood) + line('M80 68 Q88 70 92 78', 3.4, '#8f8a82') +
    stake(4) + stake(12) + stake(20);
}

export function glade({ skin, accent }) {
  const flower = (x, y, c) => {
    let s = line(`M${x} ${y} v8`, 1.8, MAT.leafShade);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; s += `<circle cx="${(x + Math.cos(a) * 2.4).toFixed(1)}" cy="${(y + Math.sin(a) * 2.4).toFixed(1)}" r="2" fill="${c}" stroke="${INK}" stroke-width="0.8"/>`; }
    return s + `<circle cx="${x}" cy="${y}" r="1.4" fill="#f3d23a"/>`;
  };
  return groundShadow(44, 88) +
    part(ell(50, 84, 44, 6), MAT.leaf, null) +
    // salt-lick stone
    part('M60 84 C58 70 66 60 76 60 C86 60 92 70 90 84 Z', '#e8e2d6', '#cfc7b8', { shadeX: 80 }) +
    line('M70 66 L74 72 M80 64 L78 70', 2) +
    // fallen log
    part(rr(10, 62, 52, 18, 9), MAT.wood, MAT.woodShade, { shadeX: 40 }) +
    part(ell(19, 71, 7, 8.5), '#d9b88a', null) +
    line('M19 66 Q23 71 19 76 Q15 71 19 68', 1.6) +
    line('M30 66 H48 M34 75 H54', 1.8, MAT.woodShade) +
    part('M44 62 Q48 52 54 54 Q50 58 50 62 Z', MAT.leaf, null) +
    flower(12, 80, accent) + flower(28, 84, skin) + flower(52, 84, accent) + flower(94, 80, skin) +
    tuft(40, 90);
}

export function wallow({ skin }) {
  const reed = (x, h, lean) =>
    line(`M${x} 84 Q${x + lean * 0.4} ${84 - h * 0.6} ${x + lean} ${84 - h}`, 2.4, MAT.leafShade) +
    part(rr(x + lean - 2.5, 84 - h - 4, 5, 11, 2.5), '#8a5e36', null);
  return groundShadow(46, 88) +
    part(ell(50, 76, 42, 14), '#7a5a3e', '#654a32', { shadeX: 70 }) +
    part(ell(46, 74, 26, 7), '#8f6c4c', null) +
    `<ellipse cx="38" cy="72" rx="7" ry="2" fill="#b39478" opacity=".8"/>` +
    part(circ(56, 76, 2.4), '#9a7a5a', null) + part(circ(62, 72, 1.6), '#9a7a5a', null) +
    // a tuft of fur caught on a reed, in the herd's coat
    reed(10, 30, -3) + reed(16, 38, 2) + reed(22, 26, 4) +
    reed(82, 34, 3) + reed(88, 26, -2) +
    part('M84 58 q4 -3 7 1 q-3 3 -7 -1 Z', skin, null) +
    // hoofprints
    part(ell(30, 92, 2, 1.4), '#654a32', null) + part(ell(34, 94, 2, 1.4), '#654a32', null) +
    part(ell(66, 93, 2, 1.4), '#654a32', null) + part(ell(70, 91, 2, 1.4), '#654a32', null);
}

export function totem({ accent, dark }) {
  return groundShadow(44, 88) +
    // hide lean-to
    line('M52 87 L66 40 M66 40 L94 87', 2.6) +
    part('M50 87 L64 44 L92 87 Z', HIDE, HIDE_SH, { shadeX: 72 }) +
    line('M60 60 L72 72 M58 70 L66 78', 1.8, HIDE_SH) +
    part('M62 87 L68 70 L76 87 Z', HOLE, null) +
    // the totem pole
    part(rr(20, 34, 12, 54, 2), MAT.wood, MAT.woodShade, { shadeX: 28 }) +
    part(rr(20, 50, 12, 5, 1), accent, null) + part(rr(20, 64, 12, 5, 1), dark, null) + part(rr(20, 76, 12, 5, 1), accent, null) +
    // horned skull on top
    line('M16 22 Q10 18 10 10', 4, INK) + line('M16 22 Q10 18 10 10', 2.2, BONE) +
    line('M36 22 Q42 18 42 10', 4, INK) + line('M36 22 Q42 18 42 10', 2.2, BONE) +
    skull(26, 30, 1.25) +
    // hanging feathers and bones
    line('M32 44 L40 50', 1.6) + part('M38 48 L44 58 L40 58 Z', accent, null) +
    bone(8, 88, 18, 84) + bone(38, 90, 46, 86);
}

export function huts({ accent }) {
  const hut = (x, w, floor) =>
    line(`M${x + 4} ${floor} V88 M${x + w - 4} ${floor} V88 M${x + w / 2} ${floor} V88`, 3, MAT.woodShade) +
    part(rr(x - 2, floor - 3, w + 4, 5, 1), MAT.wood, null) +
    part(`M${x + 2} ${floor - 3} V${floor - 20} H${x + w - 2} V${floor - 3} Z`, '#c9aa72', '#a88c58', { shadeX: x + w * 0.65 }) +
    part(`M${x + w / 2 - 4} ${floor - 3} V${floor - 13} H${x + w / 2 + 4} V${floor - 3} Z`, accent, null) +
    part(`M${x - 5} ${floor - 18} L${x + w / 2} ${floor - 44} L${x + w + 5} ${floor - 18} Z`, STRAW, STRAW_SH, { shadeX: x + w * 0.62 }) +
    line(`M${x + 2} ${floor - 24} L${x + w / 2} ${floor - 26} M${x + w - 2} ${floor - 24} L${x + w / 2} ${floor - 26}`, 1.6, STRAW_SH);
  return groundShadow(46, 90) +
    part(ell(50, 86, 46, 8), WATER, WATER_SH, { shadeX: 70 }) +
    line('M14 86 q5 -3 10 0 M62 88 q5 -3 10 0', 1.8, '#e6f6fb') +
    hut(8, 30, 66) + hut(52, 38, 60) +
    // ladder down to the water
    line('M44 60 L40 86 M49 60 L45 86 M43 67 H48 M42 74 H47 M41 81 H46', 1.8, MAT.woodShade);
}

export function web({ accent }) {
  const trunk = (flip) => {
    const t = (d) => (flip ? d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${100 - x} ${y}`) : d);
    return part(t('M10 88 L13 44 L6 28 L10 26 L16 38 L20 24 L24 26 L19 48 L22 88 Z'), '#8a7a68', '#6e6152', { shadeX: flip ? 88 : 18 });
  };
  const cx = 50, cy = 44;
  const spokes = [[16, 30], [16, 60], [30, 86], [70, 86], [84, 60], [84, 30], [50, 14]];
  let strands = '', white = '';
  for (const [x, y] of spokes) { strands += `M${cx} ${cy} L${x} ${y} `; }
  for (const k of [0.3, 0.55, 0.8]) {
    const pts = spokes.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
    strands += 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') + ' Z ';
  }
  white = `<path d="${strands}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="${strands}" fill="none" stroke="#f4f1ea" stroke-width="1.5" stroke-linejoin="round"/>`;
  return groundShadow(44, 90) +
    trunk(false) + trunk(true) + white +
    // a wrapped cocoon hanging from the web
    line('M64 50 V58', 1.6, '#f4f1ea') +
    part(ell(64, 68, 6, 10), '#f4f1ea', '#d9d4c8', { shadeX: 66 }) +
    line('M58 64 L70 62 M58 70 L70 68 M59 75 L69 73', 1.4) +
    // egg sacs in the brood's color
    part(ell(32, 84, 6, 4.5), accent, null) + part(ell(42, 88, 5, 3.5), accent, null) +
    line('M28 82 q4 -2 8 0', 1.2, '#f4f1ea');
}

export function nest({ skin, dark, accent }) {
  const egg = (x, y) => part(ell(x, y, 6, 8), skin, null) + `<circle cx="${x - 2}" cy="${y - 2}" r="1.2" fill="${dark}"/><circle cx="${x + 2}" cy="${y + 3}" r="1" fill="${dark}"/>`;
  return groundShadow(42, 90) +
    part('M20 88 C18 74 30 64 50 64 C70 64 82 74 80 88 Z', MAT.stone, MAT.stoneShade, { shadeX: 64 }) +
    egg(38, 50) + egg(52, 47) + egg(64, 51) +
    part('M8 54 C10 76 90 76 92 54 C80 60 20 60 8 54 Z', '#9a7048', '#7a5634', { shadeX: 66 }) +
    line('M4 50 L22 62 M14 70 L34 56 M40 70 L58 60 M62 70 L80 58 M72 62 L96 52 M86 70 L70 60', 2.2, '#6b4a2e') +
    // a stray feather
    line('M84 50 L94 34', 1.6) + part('M86 48 Q84 38 94 34 Q94 44 86 48 Z', accent, null);
}

export function stones({ accent }) {
  const stone = (x, y, w, h) =>
    part(`M${x} ${y} L${x + 1} ${y - h + 4} L${x + w * 0.4} ${y - h} L${x + w} ${y - h + 3} L${x + w - 1} ${y} Z`, MAT.stone, MAT.stoneShade, { shadeX: x + w * 0.6 });
  return groundShadow(46, 88) +
    part('M4 88 C14 66 34 58 50 58 C66 58 86 66 96 88 Z', MAT.leaf, MAT.leafShade, { shadeX: 72 }) +
    stone(24, 62, 10, 22) + stone(44, 58, 11, 26) + stone(66, 62, 10, 22) +
    part(ell(50, 74, 14, 5), '#cfc9bc', null) +
    line('M44 74 q6 -4 12 0 q-6 3 -9 0', 1.8, accent) +
    stone(8, 86, 14, 28) + stone(80, 86, 14, 28) + stone(38, 90, 12, 18) + stone(58, 90, 12, 18);
}

export function temple({ accent }) {
  const ST = '#b8b08e', SS = '#9a9270';
  return groundShadow(44, 88) +
    part(rr(10, 70, 80, 18, 1), ST, SS, { shadeX: 66 }) +
    part(rr(22, 52, 56, 19, 1), ST, SS, { shadeX: 62 }) +
    part(rr(33, 35, 34, 18, 1), ST, SS, { shadeX: 58 }) +
    // the shrine on top with its dark door
    part(rr(40, 20, 20, 16, 1), ST, SS, { shadeX: 54 }) +
    part('M46 36 V28 Q50 24 54 28 V36 Z', HOLE, null) +
    part('M36 21 H64 L60 14 H40 Z', accent, null) +
    // stairs up the middle
    part('M42 88 V36 H58 V88 Z', '#cfc7a4', null) +
    line('M42 44 H58 M42 52 H58 M42 60 H58 M42 68 H58 M42 76 H58 M42 84 H58', 1.6, SS) +
    // a serpent carved along the tiers
    line('M14 79 q5 -5 10 0 t10 0 M66 79 q5 -5 10 0 t10 0 M25 61 q4 -4 8 0 M67 61 q4 -4 8 0', 2.4, accent) +
    line('M12 70 Q16 62 24 64 M84 52 Q86 44 78 40', 2.4, MAT.leafShade);
}

export function pyramid({ accent }) {
  const SA = '#e8cf8e', SAS = '#cdb06c';
  return groundShadow(46, 88) +
    part('M6 87 L50 20 L94 87 Z', SA, SAS, { shadeX: 50 }) +
    line('M20 66 H80 M30 51 H70 M39 37 H61', 1.8, SAS) +
    line('M28 76 V66 M44 76 V66 M60 76 V66 M72 76 V66 M36 61 V51 M52 61 V51 M64 61 V51', 1.4, SAS) +
    part('M44 20 L50 11 L56 20 L50 22 Z', accent, null) +
    part('M42 87 V72 H58 V87 Z', HOLE, null) +
    part(rr(40, 68, 20, 5, 1), accent, null) +
    // dune in front
    part('M0 90 C20 82 40 84 56 90 Z', SA, null);
}

export function icecave({ accent }) {
  const ICE = '#dff0f8', ICES = '#b8d8e8';
  const icicle = (x, len) => part(`M${x - 2.5} 55 L${x} ${55 + len} L${x + 2.5} 55 Z`, '#eef8fc', null);
  return groundShadow(46, 88) +
    part('M6 87 C8 60 24 38 50 34 C76 38 92 60 94 87 Z', ICE, ICES, { shadeX: 66 }) +
    part('M18 50 C28 34 44 30 50 31 C64 32 76 40 82 50 C70 44 60 46 50 42 C40 46 28 44 18 50 Z', '#ffffff', null) +
    part('M30 87 C30 66 40 55 50 55 C60 55 70 66 70 87 Z', '#2f4a5c', null) +
    icicle(36, 9) + icicle(43, 13) + icicle(50, 8) + icicle(57, 12) + icicle(64, 8) +
    line('M16 70 L22 64 M84 68 L78 62', 2, ICES) +
    // a frost crystal in the clan's color
    part('M84 88 L88 72 L92 88 Z', accent, null) + part('M8 88 L11 76 L14 88 Z', accent, null);
}

export function tipi({ accent, dark }) {
  const tp = (x, w, top) => {
    const m = x + w / 2, h = 87 - top;
    return line(`M${m - 6} ${top - 8} L${m + 3} ${top + 6} M${m + 6} ${top - 8} L${m - 3} ${top + 6}`, 2.4) +
      part(`M${x} 87 L${m} ${top} L${x + w} 87 Z`, '#e8d4b0', '#cbb48c', { shadeX: m + 4 }) +
      part(`M${x + w * 0.14} ${87 - h * 0.28} L${x + w * 0.86} ${87 - h * 0.28} L${x + w * 0.83} ${87 - h * 0.2} L${x + w * 0.17} ${87 - h * 0.2} Z`, accent, null) +
      line(`M${x + w * 0.3} ${87 - h * 0.45} l4 -5 l4 5 l4 -5 l4 5`, 2, dark) +
      part(`M${m - 5} 87 L${m} ${87 - h * 0.34} L${m + 5} 87 Z`, HOLE, null);
  };
  return groundShadow(46, 88) + tp(40, 52, 22) + tp(6, 38, 42) + fire(50, 92);
}

export function barrow({ accent }) {
  const grave = (x, y) => part(`M${x} ${y} V${y - 12} Q${x + 5} ${y - 18} ${x + 10} ${y - 12} V${y} Z`, MAT.stone, MAT.stoneShade, { shadeX: x + 7 }) + line(`M${x + 5} ${y - 11} V${y - 4} M${x + 2.5} ${y - 8.5} H${x + 7.5}`, 1.6);
  return groundShadow(48, 88) +
    part('M4 87 C12 58 34 42 54 42 C76 44 92 62 96 87 Z', MAT.leaf, MAT.leafShade, { shadeX: 70 }) +
    tuft(24, 60) + tuft(70, 52) +
    // the stone door
    part('M34 87 V58 H66 V87 Z', MAT.stone, MAT.stoneShade, { shadeX: 60 }) +
    part('M40 87 V64 H60 V87 Z', HOLE, null) +
    part(rr(30, 54, 40, 7, 1), MAT.stoneShade, null) +
    // something stirs inside
    `<circle cx="46" cy="72" r="1.8" fill="${accent}"/><circle cx="54" cy="72" r="1.8" fill="${accent}"/>` +
    grave(10, 88) + grave(80, 90) + grave(20, 70);
}

export function ring({ accent, skin }) {
  const shroom = (x, y, s) =>
    part(rr(x - 2 * s, y - 6 * s, 4 * s, 7 * s, 1.5 * s), skin, null) +
    part(`M${x - 7 * s} ${y - 5 * s} Q${x - 7 * s} ${y - 13 * s} ${x} ${y - 13 * s} Q${x + 7 * s} ${y - 13 * s} ${x + 7 * s} ${y - 5 * s} Z`, accent, null) +
    `<circle cx="${x - 3 * s}" cy="${y - 9 * s}" r="${1.3 * s}" fill="#fff6e6"/><circle cx="${x + 2.5 * s}" cy="${y - 10 * s}" r="${1 * s}" fill="#fff6e6"/>`;
  let s = groundShadow(44, 88) + part(ell(50, 74, 44, 16), MAT.leaf, null);
  // back half of the ring, the flat stone, then the front half
  const n = 11, back = [], front = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = 50 + Math.cos(a) * 36, y = 72 + Math.sin(a) * 12;
    (y < 72 ? back : front).push([x, y]);
  }
  for (const [x, y] of back) s += shroom(x, y, 0.8);
  s += part(ell(50, 72, 14, 5.5), '#cfc9bc', '#b3ab9c', { shadeX: 56 }) +
    `<circle cx="42" cy="60" r="1.6" fill="#fff6c9"/><circle cx="58" cy="56" r="1.3" fill="#fff6c9"/><circle cx="50" cy="52" r="1.1" fill="#fff6c9"/>`;
  for (const [x, y] of front) s += shroom(x, y, 1.05);
  return s;
}

export function shrine({ accent, skin }) {
  const RED = '#c8402f', REDS = '#a3321f';
  return groundShadow(44, 88) +
    // the small shrine behind
    part(rr(56, 50, 30, 30, 1), '#e8dcc0', '#cbbd9c', { shadeX: 76 }) +
    part('M50 52 L71 36 L92 52 Z', '#5a4a44', '#443832', { shadeX: 74 }) +
    part(rr(64, 62, 14, 18, 1), HOLE, null) +
    part(rr(52, 80, 38, 6, 1), MAT.stone, null) +
    // fox statues on either side
    part('M50 86 V76 L52 70 L54 74 L57 70 L58 76 V86 Z', skin, null) +
    // the torii gate
    part(rr(14, 36, 6, 52, 1), RED, REDS, { shadeX: 18 }) +
    part(rr(40, 36, 6, 52, 1), RED, REDS, { shadeX: 44 }) +
    part(rr(8, 42, 44, 5, 1), RED, null) +
    part('M4 26 Q30 32 56 26 L54 34 Q30 38 6 34 Z', RED, REDS, { shadeX: 44 }) +
    part(rr(8, 34, 44, 4, 1), '#2b2622', null) +
    part(rr(27, 38, 6, 8, 1), accent, null) +
    line('M16 50 Q30 56 44 50', 1.8, '#f4ead8');
}

export function forge({ accent }) {
  const R = '#4a4440', RS = '#35302c';
  return groundShadow(46, 88) +
    part('M8 80 C8 56 22 34 46 30 C70 30 90 52 92 80 Z', R, RS, { shadeX: 66 }) +
    // glowing cracks
    line('M24 56 L32 62 L30 70 M64 44 L70 52 L78 54', 2.4, accent) +
    part('M40 32 L44 16 H56 L58 32 Z', R, RS, { shadeX: 52 }) +
    part(ell(50, 16, 6, 2.5), '#f0913a', null) +
    `<circle cx="47" cy="8" r="3" fill="#8f8a82" opacity=".7"/><circle cx="53" cy="2" r="2.4" fill="#8f8a82" opacity=".5"/>` +
    // the magma pool
    part(ell(46, 82, 34, 9), '#f07a2a', null) +
    `<ellipse cx="46" cy="82" rx="20" ry="4.5" fill="#ffd24a"/>` +
    // anvil on a stump
    part(rr(74, 76, 12, 12, 1), MAT.wood, null) +
    part('M68 70 H92 L88 76 H72 Z', '#5a5a5e', null) +
    part('M64 66 H92 V70 H68 Z', '#6e6e72', null);
}

export function hoard({ accent }) {
  const coin = (x, y) => `<path d="${ell(x, y, 4, 2.2)}" fill="#f7d668" stroke="${MAT.goldShade}" stroke-width="1.4"/>`;
  return groundShadow(46, 88) +
    part('M6 80 C8 52 26 30 50 28 C74 30 92 52 94 80 Z', MAT.stoneShade, '#7f786d', { shadeX: 68 }) +
    part('M24 80 C24 54 36 42 50 42 C64 42 76 54 76 80 Z', HOLE, null) +
    // the coin pile
    part('M10 88 C16 70 34 60 52 62 C70 62 86 72 90 88 Z', MAT.gold, MAT.goldShade, { shadeX: 64 }) +
    coin(26, 78) + coin(40, 70) + coin(56, 72) + coin(70, 80) + coin(48, 82) + coin(34, 86) +
    // a chest with gems
    part(rr(56, 70, 26, 18, 2), MAT.wood, MAT.woodShade, { shadeX: 74 }) +
    part('M56 72 Q69 60 82 72 Z', MAT.woodShade, null) +
    line('M62 66 V88 M76 66 V88', 2.4, MAT.goldShade) +
    part(rr(66, 74, 6, 6, 1), MAT.gold, null) +
    part('M30 62 L34 56 L38 62 L34 66 Z', accent, null) + part('M48 58 L51 54 L54 58 L51 61 Z', accent, null) +
    `<circle cx="44" cy="66" r="1.6" fill="#fff6c9"/><circle cx="22" cy="80" r="1.4" fill="#fff6c9"/>`;
}

export function witchhut({ skin, accent }) {
  const leg = (x, dir) =>
    line(`M${x} 64 L${x + 6 * dir} 74 L${x} 84`, 5, INK) + line(`M${x} 64 L${x + 6 * dir} 74 L${x} 84`, 2.8, '#d9a44a') +
    line(`M${x} 84 l-6 4 M${x} 84 l0 5 M${x} 84 l6 4`, 2.4, INK);
  return groundShadow(40, 90) +
    leg(46, -1) + leg(66, 1) +
    // crooked hut
    part('M34 66 L38 36 L76 32 L80 64 Z', MAT.wood, MAT.woodShade, { shadeX: 66 }) +
    line('M36 46 L78 42 M35 56 L79 53', 1.6, MAT.woodShade) +
    part('M28 40 L58 10 L86 36 Z', '#5a4a44', '#443832', { shadeX: 62 }) +
    part(rr(68, 12, 7, 16, 1), MAT.stone, null) +
    `<circle cx="74" cy="8" r="3" fill="#8f8a82" opacity=".6"/><circle cx="80" cy="3" r="2.4" fill="#8f8a82" opacity=".45"/>` +
    part(rr(48, 42, 12, 11, 1.5), accent, null) + line('M54 42 V53 M48 47.5 H60', 1.6) +
    // cauldron
    part('M6 76 Q6 90 18 90 Q30 90 30 76 Z', '#3d3a3a', null) +
    part(ell(18, 76, 12, 3.5), skin, null) +
    part(circ(14, 71, 2.4), skin, null) + part(circ(22, 68, 1.8), skin, null) +
    line('M8 90 l-2 3 M28 90 l2 3', 2.2);
}

export const CAMPS = { tents, den, burrow, glade, wallow, totem, huts, web, nest, stones, temple, pyramid, icecave, tipi, barrow, ring, shrine, forge, hoard, witchhut };

/** A faction's camp: its camp art tinted with its colors. */
export function campArt(name, faction) {
  const { skin, dark, accent } = faction.art;
  return (CAMPS[name] ?? CAMPS.tents)({ skin, dark, accent });
}
