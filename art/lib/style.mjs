// Shared style tokens and drawing helpers. Every asset is drawn in a 100x100
// viewBox and shares one outline weight and one shading model, so the whole
// set reads as a single art style (chess.com-like: thick dark outline, flat
// fills, a soft shade band on the right).

export const INK = '#2b2622';
export const SW = 3.2; // outline width in viewBox units

// Piece body palettes. "light"/"dark" mirror white/black chess pieces.
export const SIDES = {
  light: { body: '#f8f4ec', shade: '#d9d0c2', eye: INK, glint: '#ffffff' },
  dark: { body: '#57514c', shade: '#3f3a36', eye: '#f3ede2', glint: '#57514c' },
};

// Player colors. Every player owns one; it shows on collars, manes, banners.
export const TEAMS = {
  red: '#d9534a',
  blue: '#4a7fd4',
  gold: '#e3b23c',
  violet: '#8e5bd1',
  teal: '#2fa59a',
};

export const MAT = {
  wall: '#efe6d2', wallShade: '#d4c7ab',
  stone: '#bdb7ab', stoneShade: '#9d9689',
  wood: '#a06e44', woodShade: '#825634',
  roofRed: '#c8623f', roofRedShade: '#a54d30',
  roofBlue: '#5b7fa8', roofBlueShade: '#48688c',
  gold: '#f0c24a', goldShade: '#cf9d2c',
  leaf: '#6fae4a', leafShade: '#548f36', leafDark: '#3f7a2e',
  glass: '#8fc6dc',
};

let n = 0;
export const uid = (p = 'c') => `${p}${++n}`;

// A filled part with a right-side shade band and an ink outline.
// `shadeX` is where the shade begins; pass null for no shade.
export function part(d, fill, shade, { shadeX = 60, stroke = true } = {}) {
  let s = `<path d="${d}" fill="${fill}"/>`;
  if (shade && shadeX != null) {
    const id = uid();
    s += `<clipPath id="${id}"><path d="${d}"/></clipPath>` +
      `<path d="M${shadeX} -10 Q${shadeX - 5} 50 ${shadeX} 110 L140 110 L140 -10 Z" fill="${shade}" clip-path="url(#${id})"/>`;
  }
  if (stroke) s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"/>`;
  return s;
}

export const line = (d, w = SW, color = INK) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

export const circ = (cx, cy, r) =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

export const ell = (cx, cy, rx, ry) =>
  `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;

export const rr = (x, y, w, h, r) =>
  `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;

export const groundShadow = (rx = 26, cy = 90) =>
  `<ellipse cx="50" cy="${cy}" rx="${rx}" ry="${rx * 0.16}" fill="#000" opacity="0.18"/>`;

// A stoic eye: a small solid oval under a straight brow. `inner` is the side
// facing the nose (-1 left, +1 right); the brow dips slightly toward it.
export function eye(x, y, pal, r = 1.9, inner = -1) {
  const by = y - r * 1.7, dip = r * 0.35;
  const bl = inner < 0 ? by + dip : by, br = inner < 0 ? by : by + dip;
  return `<ellipse cx="${x}" cy="${y}" rx="${r * 0.7}" ry="${r * 0.95}" fill="${pal.eye}"/>` +
    `<path d="M${x - r * 1.5} ${bl} L${x + r * 1.5} ${br}" stroke="${pal.eye}" stroke-width="${r * 0.7}" stroke-linecap="round"/>`;
}

export const eyes = (cx, y, gap, pal, r = 1.9) => eye(cx - gap / 2, y, pal, r, 1) + eye(cx + gap / 2, y, pal, r, -1);

// Wrap inner markup as a standalone SVG document.
export const svgDoc = (inner, size = 100, vb = '0 0 100 100') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${size}">${inner}</svg>`;

// Place 100x100 asset markup at (x, y) scaled to `s` units.
export const place = (inner, x, y, s = 100, flip = false) =>
  `<g transform="translate(${x + (flip ? s : 0)} ${y}) scale(${(flip ? -1 : 1) * s / 100} ${s / 100})">${inner}</g>`;
