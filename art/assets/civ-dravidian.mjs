// Dravidian civilization (cosmetic, docs/specs/cosmetics.md). The same chess
// silhouettes, dressed in Tamil temple culture: gopuram gateways and the
// Brihadeeswarar vimana, Chettinad courtyard houses with terracotta roofs and
// thinnai verandas, kolam at the thresholds, war elephants in gold nettipattam,
// Chola kireedam crowns, temple jewelry, the vel spear.
// Palette: warm granite, terracotta, temple gold, deep maroon, turmeric.
import { SIDES, TEAMS, INK, MAT, part, line, circ, ell, rr, eye, eyes, groundShadow } from '../lib/style.mjs';

const C = {
  granite: '#dcbd8e', graniteShade: '#b9956a', graniteDark: '#9c7a52',
  terra: '#c8623f', terraShade: '#a54d30',
  wall: '#f4ead4', wallShade: '#dccaa6',
  maroon: '#8a2f3a', turmeric: '#e8b83a',
  wood: '#7a4a2a', woodShade: '#5e3820',
  jasmine: '#fffdf4', teal: '#3f9a8c',
};

const base = (pal, w = 22) =>
  part(`M${50 - w} 88 Q${50 - w} 79 ${50 - w + 8} 77 H${50 + w - 8} Q${50 + w} 79 ${50 + w} 88 Z`, pal.body, pal.shade);

// A gold band with little bosses: temple jewelry, used on crowns, collars, caparisons.
const jewelBand = (x0, x1, y, h = 4) => {
  let s = part(rr(x0, y, x1 - x0, h, h / 2), MAT.gold, null);
  for (let x = x0 + 3; x < x1 - 1; x += 5) s += `<circle cx="${x}" cy="${y + h / 2}" r="1.1" fill="#fff6c9"/>`;
  return s;
};

// Kalasam: the pot-and-spire finial that crowns every temple tower.
const kalasam = (x, y, s = 1) =>
  part(`M${x - 3.2 * s} ${y} Q${x - 4 * s} ${y - 4 * s} ${x} ${y - 5 * s} Q${x + 4 * s} ${y - 4 * s} ${x + 3.2 * s} ${y} Z`, MAT.gold, null) +
  part(`M${x - 1.2 * s} ${y - 4.6 * s} L${x} ${y - 10 * s} L${x + 1.2 * s} ${y - 4.6 * s} Z`, MAT.gold, null);

// ---------- pieces ----------

export function pawn({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  return groundShadow(22) +
    // the vel: a spear with a leaf-shaped blade, held upright behind
    line('M68 86 V20', 2.8) +
    part('M68 8 C73 14 73 20 68 24 C63 20 63 14 68 8 Z', MAT.gold, MAT.goldShade, { shadeX: 68 }) +
    base(p, 20) +
    part('M36 78 Q43 66 43 58 H57 Q57 66 64 78 Z', p.body, p.shade) +
    // waist sash in team color
    part(rr(38, 66, 24, 5, 2.5), team, null) +
    part(rr(37, 54, 26, 6, 3), team, null) +
    part(circ(50, 41, 12.5), p.body, p.shade) +
    // tight warrior turban with a gold band
    part('M37.5 40 C37 28 45 25 50 25 C55 25 63 28 62.5 40 Z', side === 'light' ? C.maroon : C.turmeric, null) +
    part(rr(37, 36, 26, 4.5, 2.2), MAT.gold, null) +
    eyes(50, 46, 8, p, 1.7) +
    // small round shield
    part(circ(36, 68, 8), team, null) + part(circ(36, 68, 3), MAT.gold, null);
}

export function knight({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  const head = 'M30 77 C30 64 40 58 44 52 C38 54 30 57 24 53 C19 50 18 44 22 41 C28 34 34 26 40 21 L41 12 L47 19 C58 18 71 26 72 42 C74 56 70 68 70 77 Z';
  const mane = 'M47 19 C58 18 71 26 72 42 C74 56 70 68 70 77 L63 77 C63 66 67 55 64 42 C62 31 56 25 46 23 Z';
  return groundShadow(24) +
    base(p, 24) +
    part(head, p.body, p.shade, { shadeX: 58 }) +
    part(mane, team, null) +
    // gold forehead plate and bridle
    part('M31 30 L39 22 L44 27 L36 35 Z', MAT.gold, null) +
    line('M24 46 L42 40 L52 50', 2.2, MAT.goldShade) +
    // the plume: a tall chamara crest in team color with a gold holder
    part('M44 16 C42 6 48 0 55 2 C51 6 50 11 50 17 Z', team, null) +
    part(rr(43, 14, 8, 5, 2), MAT.gold, null) +
    // jingling bells on the neck band
    part(rr(30, 60, 36, 5, 2.5), C.maroon, null) +
    `<circle cx="36" cy="66" r="2" fill="${MAT.gold}"/><circle cx="46" cy="67" r="2" fill="${MAT.gold}"/><circle cx="56" cy="66" r="2" fill="${MAT.gold}"/>` +
    eye(38, 32, p, 2.4) +
    `<ellipse cx="24.5" cy="46" rx="1.4" ry="1.8" fill="${p.eye}"/>`;
}

export function bishop({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  return groundShadow(22) +
    base(p, 21) +
    part('M34 78 Q41 66 42 60 H58 Q59 66 66 78 Z', p.body, p.shade) +
    // saffron shawl across the chest, in team color
    part('M40 60 L60 60 L48 76 L42 76 Z', team, null) +
    // rudraksha beads
    line('M43 58 Q50 70 57 58', 2.6, C.woodShade) +
    part(circ(50, 49, 10), p.body, p.shade) +
    // matted hair piled high (jata): the mitre silhouette, bound with gold
    part('M50 12 C60 21 63 31 60 41 H40 C37 31 40 21 50 12 Z', side === 'light' ? C.graniteDark : '#2f2a26', null) +
    line('M54 22 L47 32', 2.4, side === 'light' ? '#6e5438' : '#1c1916') +
    part(rr(40, 38, 20, 4, 2), MAT.gold, null) +
    part(circ(50, 11, 3), MAT.gold, null) +
    // tripundra: three ash lines and a red dot on the brow
    line('M44.5 45 H55.5 M44.5 47 H55.5', 1.1, side === 'light' ? '#b8b0a4' : '#e8e2d6') +
    `<circle cx="50" cy="44" r="1.1" fill="#c8323a"/>` +
    eyes(50, 51, 8, p, 1.6);
}

export function elephant({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  const leg = (x, fill) =>
    part(`M${x} 60 H${x + 10} L${x + 9.5} 88 H${x + 0.5} Z`, fill, null) +
    // gold anklets
    part(rr(x - 0.5, 78, 11, 3.5, 1.5), MAT.gold, null);
  // the howdah is a little tiered vimana carried into battle
  const howdah =
    part('M49 40 V26 H79 V40 Z', C.granite, C.graniteShade, { shadeX: 72 }) +
    part('M52 26 L55 18 H73 L76 26 Z', C.granite, C.graniteShade, { shadeX: 70 }) +
    part('M57 18 Q64 8 71 18 Z', C.terra, C.terraShade, { shadeX: 66 }) +
    kalasam(64, 11, 0.8) +
    line('M49 32 H79', 1.8, C.graniteDark) +
    line('M58 32 V40 M64 32 V40 M70 32 V40', 1.6, C.graniteDark);
  return groundShadow(36, 90) +
    line('M86 44 Q90 52 88 62', 2.4) +
    leg(66, p.shade) + leg(77, p.shade) +
    leg(36, p.body) + leg(49, p.body) +
    part('M34 44 C40 32 66 30 80 36 C88 40 89 56 85 68 Q60 73 36 68 C32 60 31 51 34 44 Z', p.body, p.shade, { shadeX: 72 }) +
    // caparison: team cloth with a gold fringe and tassels
    part('M44 38 C56 33 70 33 80 37 L80 58 Q62 62 46 58 Z', team, null) +
    jewelBand(46, 80, 56, 3.5) +
    `<circle cx="52" cy="63" r="1.6" fill="${MAT.gold}"/><circle cx="62" cy="64" r="1.6" fill="${MAT.gold}"/><circle cx="72" cy="63" r="1.6" fill="${MAT.gold}"/>` +
    howdah +
    part('M42 40 C37 30 24 29 18 36 C13 42 13 51 15 58 C17 66 16 75 13 83 C12 87 17 89 19 86 C22 78 24 70 27 64 C33 62 40 61 43 56 Z', p.body, null) +
    line('M16 66 h4 M15.5 72 h4 M15 78 h3.5', 1.6) +
    part('M24 59 C18 63 11 62 7 55 C12 58 18 57 22 54 Z', '#f6efdf', null) +
    part('M30 37 C40 33 49 40 48 53 C47 61 40 65 34 63 C29 57 28 46 30 37 Z', p.shade, null) +
    // nettipattam: the golden forehead caparison, a shield of bosses down the trunk
    part('M18 32 C24 27 33 28 37 33 L33 50 C29 55 24 58 20 60 C18 52 16 42 18 32 Z', MAT.gold, MAT.goldShade, { shadeX: 30 }) +
    `<circle cx="25" cy="36" r="1.8" fill="#fff6c9"/><circle cx="31" cy="38" r="1.8" fill="#fff6c9"/><circle cx="24" cy="44" r="1.8" fill="#fff6c9"/><circle cx="29" cy="46" r="1.8" fill="#fff6c9"/><circle cx="23" cy="52" r="1.6" fill="#fff6c9"/>` +
    part('M18 32 C23 24 30 24 34 29 L30 33 C26 30 22 30 18 32 Z', C.maroon, null) +
    eye(24, 44, p, 2.1);
}

export function queen({ side = 'light', team = TEAMS.red } = {}) {
  const p = SIDES[side];
  const crown = side === 'light' ? MAT.gold : C.turmeric;
  return groundShadow(24) +
    base(p, 23) +
    // silk sari drape: the robe with a pleated border in team color
    part('M30 78 Q40 64 42 56 H58 Q60 64 70 78 Z', p.body, p.shade) +
    part('M52 58 Q60 66 66 78 H58 Q55 68 50 60 Z', team, null) +
    line('M60 70 L62 78 M56 70 L58 78', 1.6) +
    // temple jewelry: a layered necklace
    jewelBand(39, 61, 53, 4) +
    line('M42 58 Q50 64 58 58', 2, MAT.gold) +
    part(circ(50, 44, 10), p.body, p.shade) +
    // a smaller kireedam with jasmine strung behind
    part('M38 37 C38 28 44 22 50 14 C56 22 62 28 62 37 Z', crown, MAT.goldShade, { shadeX: 55 }) +
    line('M40 32 H60 M42 27 H58', 1.6, MAT.goldShade) +
    kalasam(50, 16, 0.7) +
    part(circ(36, 34, 3), C.jasmine, null) + part(circ(33, 40, 3), C.jasmine, null) +
    part(circ(64, 34, 3), C.jasmine, null) + part(circ(67, 40, 3), C.jasmine, null) +
    // jhumka earrings
    `<circle cx="39.5" cy="50" r="1.8" fill="${MAT.gold}"/><circle cx="60.5" cy="50" r="1.8" fill="${MAT.gold}"/>` +
    eyes(50, 46, 8, p, 1.6);
}

export function king({ side = 'light', team = TEAMS.red, emperor = false } = {}) {
  const p = SIDES[side];
  const crown = emperor ? MAT.gold : p.body;
  const crownShade = emperor ? MAT.goldShade : p.shade;
  return groundShadow(25) +
    base(p, 24) +
    part('M27 78 Q37 62 41 57 H59 Q63 62 73 78 Z', p.body, p.shade) +
    // angavastram over one shoulder, in team color
    part('M41 58 L59 58 L66 70 L60 74 L48 62 Z', team, null) +
    jewelBand(36, 64, 53, 4.5) +
    part(circ(50, 45, 10), p.body, p.shade) +
    part('M42 50 Q50 61 58 50 Q50 55 42 50 Z', p.shade, null) +
    // the Chola kireedam: a tall tiered cone with a finial, like a small temple tower
    part('M37 39 C37 30 41 24 44 20 L47 9 H53 L56 20 C59 24 63 30 63 39 Z', crown, crownShade, { shadeX: 55 }) +
    line('M39 33 H61 M41 27 H59 M44 21 H56', 1.8, emperor ? MAT.goldShade : p.shade) +
    part(rr(36.5, 36, 27, 4.5, 2), emperor ? '#fff0b0' : MAT.gold, null) +
    kalasam(50, 10, 0.8) +
    (emperor ? part(circ(50, 30, 2.8), TEAMS.red, null) + part(circ(43, 31, 1.6), '#2f9a6a', null) + part(circ(57, 31, 1.6), '#2f9a6a', null) : '') +
    `<circle cx="39.5" cy="50" r="1.7" fill="${MAT.gold}"/><circle cx="60.5" cy="50" r="1.7" fill="${MAT.gold}"/>` +
    eyes(50, 45, 8, p, 1.6);
}

export const PIECES = { king, queen, elephant, bishop, knight, pawn };

// ---------- buildings ----------

// A kolam at a threshold: white rice-flour dots and loops.
const kolam = (cx, cy, r = 5) =>
  `<g opacity="0.95">` +
  line(`M${cx - r} ${cy} Q${cx} ${cy - r * 0.8} ${cx + r} ${cy} Q${cx} ${cy + r * 0.8} ${cx - r} ${cy} Z M${cx} ${cy - r * 0.8} Q${cx + r * 0.8} ${cy} ${cx} ${cy + r * 0.8} Q${cx - r * 0.8} ${cy} ${cx} ${cy - r * 0.8} Z`, 1.5, '#fffaf0') +
  `<circle cx="${cx}" cy="${cy}" r="1" fill="#fffaf0"/><circle cx="${cx - r * 0.6}" cy="${cy}" r="0.8" fill="#fffaf0"/><circle cx="${cx + r * 0.6}" cy="${cy}" r="0.8" fill="#fffaf0"/></g>`;

// Terracotta roof tiles: a sloped roof with rows of tile lines.
let roofN = 0;
function tiledRoof(d, x0, x1, y0, y1) {
  const id = `dravroof${++roofN}`;
  let lines = '';
  for (let x = x0 + 4; x < x1 - 2; x += 5) lines += `M${x} ${y0 + 2} L${x} ${y1 - 1} `;
  // Tile rows, clipped to the roof so they never poke past its slopes.
  return `<clipPath id="${id}"><path d="${d}"/></clipPath>` +
    `<path d="${d}" fill="${C.terra}"/>` +
    `<path d="${lines}" stroke="${C.terraShade}" stroke-width="1.3" clip-path="url(#${id})"/>` +
    `<path d="M${(x0 + x1) / 2 + 8} -10 Q${(x0 + x1) / 2 + 3} 50 ${(x0 + x1) / 2 + 8} 110 L140 110 L140 -10 Z" fill="${C.terraShade}" opacity="0.45" clip-path="url(#${id})"/>` +
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>`;
}

// A gopuram: stacked receding tiers, each with a cornice, crowned by a barrel
// vault (shala) and a row of kalasams.
function gopuram(cx, baseY, topY, w0, w1, tiers, { fill = C.granite, shade = C.graniteShade, paint = null, finials = 3 } = {}) {
  let s = '';
  const vaultH = (baseY - topY) * 0.17;
  const h = (baseY - topY - vaultH) / tiers;
  // The tiers, back to front: one outlined stepped mass, so the tower reads as a single form.
  let d = `M${cx - w0 / 2} ${baseY}`;
  for (let i = 0; i < tiers; i++) {
    const yt = baseY - (i + 1) * h;
    const wt = w0 + (w1 - w0) * ((i + 1) / tiers);
    const wb = w0 + (w1 - w0) * (i / tiers);
    d += ` L${cx - wt / 2 - 0.5} ${yt + 2.2} L${cx - wt / 2 - 1.8} ${yt + 2.2} L${cx - wt / 2 - 1.8} ${yt}`;
    void wb;
  }
  const wTop = w1;
  d += ` H${cx + wTop / 2 + 1.8}`;
  for (let i = tiers - 1; i >= 0; i--) {
    const yt = baseY - (i + 1) * h;
    const wt = w0 + (w1 - w0) * ((i + 1) / tiers);
    const wbNext = i === 0 ? w0 : w0 + (w1 - w0) * (i / tiers);
    d += ` L${cx + wt / 2 + 1.8} ${yt + 2.2} L${cx + wt / 2 + 0.5} ${yt + 2.2} L${cx + wbNext / 2} ${baseY - i * h}`;
  }
  d += ' Z';
  s += part(d, fill, shade, { shadeX: cx + w0 * 0.16 });
  // Cornices and niches, drawn light (no ink outlines: they're carving, not parts).
  for (let i = 0; i < tiers; i++) {
    const yb = baseY - i * h, yt = yb - h;
    const wb = w0 + (w1 - w0) * (i / tiers), wt = w0 + (w1 - w0) * ((i + 1) / tiers);
    s += `<path d="M${cx - wt / 2 - 1.8} ${yt + 2.2} H${cx + wt / 2 + 1.8}" stroke="${INK}" stroke-width="1.2" opacity="0.55"/>`;
    const n = Math.max(1, Math.round(((wb + wt) / 2) / 8));
    const ww = (wb + wt) / 2;
    for (let k = 0; k < n; k++) {
      const x = cx - ww / 2 + (ww / n) * (k + 0.5);
      const col = paint && (k + i) % 2 ? paint : C.graniteDark;
      s += `<rect x="${x - 1.6}" y="${yt + h * 0.42}" width="3.2" height="${Math.max(2, h * 0.42)}" rx="1.4" fill="${col}" opacity="0.8"/>`;
    }
  }
  const vt = topY, vb = topY + vaultH + 0.5, vw = w1 + 4;
  s += part(`M${cx - vw / 2} ${vb} V${vt + vaultH * 0.55} Q${cx - vw / 2} ${vt} ${cx} ${vt} Q${cx + vw / 2} ${vt} ${cx + vw / 2} ${vt + vaultH * 0.55} V${vb} Z`, C.terra, C.terraShade, { shadeX: cx + 2 });
  for (let k = 0; k < finials; k++) {
    const x = finials === 1 ? cx : cx - vw / 2 + 2.5 + ((vw - 5) / (finials - 1)) * k;
    s += kalasam(x, vt + (finials === 1 ? 0.5 : 2.5), finials > 3 ? 0.65 : 0.8);
  }
  return s;
}

const flag = (x, y, team, h = 16) =>
  line(`M${x} ${y} V${y - h}`, 2.4) +
  // a swallow-tailed pennant
  part(`M${x} ${y - h} L${x + 13} ${y - h + 2} L${x + 9} ${y - h + 5} L${x + 13} ${y - h + 8} L${x} ${y - h + 8} Z`, team, null);

export function house({ team = TEAMS.red } = {}) {
  // A Chettinad house: whitewashed walls, a terracotta roof, and a thinnai
  // veranda on wooden pillars where people sit in the evening.
  const pillar = (x) => part(rr(x, 60, 4.5, 20, 1), '#a0703f', null) + `<rect x="${x - 1.2}" y="58" width="7" height="3" rx="1" fill="${C.woodShade}"/>`;
  return groundShadow(36, 88) +
    part('M20 87 V50 H80 V87 Z', C.wall, C.wallShade, { shadeX: 66 }) +
    tiledRoof('M12 54 L28 32 H72 L88 54 Z', 14, 86, 34, 53) +
    part(rr(26, 26, 48, 7, 2), C.terraShade, null) +
    // thinnai: a raised plinth with a veranda under the roof eave
    part('M16 87 V80 H84 V87 Z', C.granite, C.graniteShade, { shadeX: 70 }) +
    pillar(22) + pillar(36) + pillar(60) + pillar(74) +
    part('M44 80 V66 Q50 60 56 66 V80 Z', C.woodShade, null) +
    line('M50 62 V80', 1.4, C.wood) +
    kolam(50, 84, 5) +
    part(rr(40, 55, 20, 4, 2), team, null) +
    flag(50, 30, team, 14);
}

export function stable({ team = TEAMS.red } = {}) {
  // A long pillared mandapam for the horses, carved horse heads on the corner pillars.
  const pillar = (x) => part(rr(x, 52, 6, 35, 1), C.granite, C.graniteShade, { shadeX: x + 4 }) + `<rect x="${x - 1.5}" y="50" width="9" height="3.5" rx="1" fill="${C.graniteShade}"/>` + `<rect x="${x + 1.5}" y="62" width="3" height="14" rx="1.2" fill="${C.graniteDark}" opacity="0.7"/>`;
  return groundShadow(44, 88) +
    part('M10 87 V52 H90 V87 Z', C.wallShade, null) +
    part('M18 87 V60 H82 V87 Z', '#4a3325', null) +
    tiledRoof('M4 54 L18 32 H82 L96 54 Z', 6, 94, 34, 53) +
    part(rr(16, 26, 68, 7, 2), C.terraShade, null) +
    pillar(10) + pillar(30) + pillar(47.5) + pillar(65) + pillar(85) +
    // horses looking out from the stalls
    part('M26 87 V74 C26 68 30 64 34 62 L36 58 L38 62 C41 64 42 70 40 76 L40 87 Z', '#8a5e3c', null) + `<circle cx="32.5" cy="67" r="1.1" fill="#f3ede2"/>` +
    part('M70 87 V74 C70 68 66 64 62 62 L60 58 L58 62 C55 64 54 70 56 76 L56 87 Z', '#d9c4a8', null) + `<circle cx="63.5" cy="67" r="1.1" fill="#2b2622"/>` +
    // a hanging brass bell and hay
    line('M50 34 V40', 1.6) + part('M46.5 44 Q46.5 40 50 40 Q53.5 40 53.5 44 Z', MAT.gold, null) +
    part('M40 87 Q48 80 56 87 Z', C.turmeric, null) +
    part(rr(38, 55, 24, 4, 2), team, null) +
    flag(20, 30, team, 12) + flag(80, 30, team, 12);
}

export function temple({ team = TEAMS.red } = {}) {
  // The vimana of Thanjavur: a granite pyramid of tiers over the shrine, a
  // mandapam in front, a gilded kalasam at the top.
  return groundShadow(40, 88) +
    gopuram(60, 66, 10, 46, 14, 4, { finials: 1, paint: C.terra }) +
    // mandapam: a pillared porch
    part('M12 87 V60 H50 V87 Z', C.granite, C.graniteShade, { shadeX: 42 }) +
    part(rr(9, 55, 44, 6, 2), C.graniteShade, null) +
    part('M20 87 V68 H24 V87 Z M30 87 V68 H34 V87 Z M40 87 V68 H44 V87 Z', C.graniteDark, null) +
    part('M52 87 V64 H86 V87 Z', C.granite, C.graniteShade, { shadeX: 76 }) +
    // the shrine door and a brass lamp
    part('M63 87 V73 Q69 66 75 73 V87 Z', '#3d2c20', null) +
    `<circle cx="69" cy="77" r="2" fill="#ffd27a"/>` +
    part(rr(24, 50, 18, 4, 2), team, null) +
    kolam(31, 84, 4) +
    line('M16 55 V40', 2.4) + part('M16 40 L28 42 L24 45 L28 48 L16 48 Z', team, null);
}

export function barracks({ team = TEAMS.red } = {}) {
  // A granite hill fort (after Gingee): rounded bastions, a gatehouse crowned
  // by a small gopuram, rows of rounded kumbha merlons.
  const merlons = (x0, x1, y) => {
    let s = '';
    for (let x = x0; x <= x1 - 5; x += 7) s += part(`M${x} ${y} V${y - 4} Q${x + 2.5} ${y - 8} ${x + 5} ${y - 4} V${y} Z`, C.granite, null);
    return s;
  };
  const bastion = (x) =>
    part(`M${x} 87 V40 Q${x + 11} 34 ${x + 22} 40 V87 Z`, C.granite, C.graniteShade, { shadeX: x + 15 }) +
    merlons(x + 1, x + 22, 40) +
    part(rr(x + 8, 52, 6, 9, 3), '#3d3530', null);
  return groundShadow(44, 88) +
    part('M18 87 V50 H82 V87 Z', C.granite, C.graniteShade, { shadeX: 66 }) +
    merlons(22, 80, 50) +
    line('M18 64 H82 M18 76 H82', 1.4, C.graniteDark) +
    bastion(4) + bastion(74) +
    gopuram(50, 60, 24, 28, 12, 2, { finials: 3 }) +
    part('M41 87 V70 Q50 60 59 70 V87 Z', '#3d3530', null) +
    line('M45 87 V68 M50 87 V64 M55 87 V68', 1.8, MAT.gold) +
    part(rr(32, 56, 36, 4, 2), team, null) +
    flag(15, 34, team, 14) + flag(85, 34, team, 14);
}

export function palace({ team = TEAMS.red } = {}) {
  // A royal gateway: a towering painted gopuram flanked by lower towers and
  // pillared halls, every tier topped with gold. The kings' tower of the city.
  return groundShadow(46, 88) +
    part('M6 87 V58 H94 V87 Z', C.wall, C.wallShade, { shadeX: 80 }) +
    part(rr(4, 54, 92, 6, 2), C.terraShade, null) +
    gopuram(17, 60, 30, 24, 11, 2, { finials: 1, paint: C.teal }) +
    gopuram(83, 60, 30, 24, 11, 2, { finials: 1, paint: C.teal }) +
    gopuram(50, 64, 7, 42, 18, 4, { finials: 5, paint: C.maroon }) +
    // pillared halls on either side of the gate
    part('M11 87 V67 H15 V87 Z M21 87 V67 H25 V87 Z M75 87 V67 H79 V87 Z M85 87 V67 H89 V87 Z', C.granite, null) +
    // the great door, gilded
    part('M40 87 V70 Q50 60 60 70 V87 Z', C.wood, null) +
    line('M40 70 Q50 60 60 70', 3, MAT.gold) +
    line('M50 64 V87', 1.4, C.woodShade) +
    `<circle cx="45" cy="78" r="1.2" fill="${MAT.gold}"/><circle cx="55" cy="78" r="1.2" fill="${MAT.gold}"/>` +
    part(rr(34, 62, 32, 3.5, 1.5), team, null) +
    part(rr(8, 62, 18, 3.5, 1.5), team, null) + part(rr(74, 62, 18, 3.5, 1.5), team, null) +
    kolam(50, 85, 6);
}

export const BUILDINGS = { palace, house, stable, temple, barracks };
