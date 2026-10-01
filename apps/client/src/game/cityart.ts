// The atomic units of player-built towns (citybuilding.md §9): streets and squares, flowerbeds,
// bridges, walls, fences and hedges. Each is drawn in code at 128 px a square, from its
// neighbours (an 8-bit mask), so whatever a player draws joins up and looks intentional. One
// palette, one light (top-left), one outline weight, and soft shadows, so every unit sits well
// beside every other one and beside the rest of the art.
import { Texture } from 'pixi.js';

export const T = 128;
// Neighbour bits: orthogonal, then diagonal.
export const N = 1, E = 2, S = 4, W = 8, NE = 16, SE = 32, SW = 64, NW = 128;
const DIRS: [number, number, number][] = [[0, -1, N], [1, 0, E], [0, 1, S], [-1, 0, W], [1, -1, NE], [1, 1, SE], [-1, 1, SW], [-1, -1, NW]];
/** The mask of a square's neighbours that `same` says join it. */
export function maskAt(x: number, y: number, same: (x: number, y: number) => boolean): number {
  let m = 0;
  for (const [dx, dy, bit] of DIRS) if (same(x + dx, y + dy)) m |= bit;
  return m;
}

export const INK = '#2b2622';
const PAL = {
  stone: '#cfc6b4', stoneLight: '#e2dac9', stoneShade: '#b4aa96', mortar: '#8f8573',
  wood: '#a8794a', woodShade: '#7d5634', woodLight: '#c2925e',
  leaf: '#6f9a52', leafShade: '#5a8243', leafLight: '#86b266',
  soil: '#8a6a4a', soilShade: '#73563a',
  rose: '#f2a9c0', butter: '#f7e08a', lavender: '#b7a2e0', white: '#fbf7ee',
};
/** Paving styles: 0 knights' road, 1 cobble, 2 flagstone, 3 earth. */
const PAVE = [
  { base: '#b7ae9d', a: '#cbc3b3', b: '#a99f8c', kerb: '#8f8573' },
  { base: '#b9a888', a: '#d8c9ab', b: '#c6b593', kerb: '#8a7a60' },
  { base: '#d6c8aa', a: '#e6dac1', b: '#ddd0b5', kerb: '#9a8e78' },
  { base: '#c9a679', a: '#d4b48a', b: '#b8956a', kerb: '#a07e55' },
];

const cache = new Map<string, Texture>();
function make(key: string, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = T; c.height = T;
  const g = c.getContext('2d')!;
  draw(g);
  const t = Texture.from(c);
  cache.set(key, t);
  return t;
}

/** A small seeded random, so a variant always looks the same. */
function rng(seed: number) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

/**
 * The square's shape: the whole cell, with its corners rounded where it has no neighbours on
 * either side of that corner (convex corners), so paved areas read as soft shapes, not blocks.
 */
function shape(g: CanvasRenderingContext2D, mask: number, r = T * 0.32, inset = 0) {
  const has = (b: number) => (mask & b) !== 0;
  const tl = !has(N) && !has(W) ? r : 0, tr = !has(N) && !has(E) ? r : 0, br = !has(S) && !has(E) ? r : 0, bl = !has(S) && !has(W) ? r : 0;
  const x0 = has(W) ? 0 : inset, y0 = has(N) ? 0 : inset, x1 = has(E) ? T : T - inset, y1 = has(S) ? T : T - inset;
  g.beginPath();
  g.moveTo(x0 + tl, y0);
  g.lineTo(x1 - tr, y0); if (tr) g.arcTo(x1, y0, x1, y0 + tr, tr);
  g.lineTo(x1, y1 - br); if (br) g.arcTo(x1, y1, x1 - br, y1, br);
  g.lineTo(x0 + bl, y1); if (bl) g.arcTo(x0, y1, x0, y1 - bl, bl);
  g.lineTo(x0, y0 + tl); if (tl) g.arcTo(x0, y0, x0 + tl, y0, tl);
  g.closePath();
}

/**
 * The open edges of a square (where it has no neighbour), with their rounded corners, as one
 * path. Joined edges are left out entirely, so neighbours meet without a seam.
 */
function edges(g: CanvasRenderingContext2D, mask: number, r = T * 0.32, inset = 0) {
  const has = (b: number) => (mask & b) !== 0;
  const x0 = has(W) ? 0 : inset, y0 = has(N) ? 0 : inset, x1 = has(E) ? T : T - inset, y1 = has(S) ? T : T - inset;
  const tl = !has(N) && !has(W) ? r : 0, tr = !has(N) && !has(E) ? r : 0, br = !has(S) && !has(E) ? r : 0, bl = !has(S) && !has(W) ? r : 0;
  g.beginPath();
  // Walk the outline clockwise; draw (lineTo/arc) only along open sides, move along joined ones.
  const side = (open: boolean, ax: number, ay: number, bx: number, by: number) => { if (open) { g.moveTo(ax, ay); g.lineTo(bx, by); } };
  side(!has(N), x0 + tl, y0, x1 - tr, y0);
  if (tr) { g.moveTo(x1 - tr, y0); g.arcTo(x1, y0, x1, y0 + tr, tr); }
  side(!has(E), x1, y0 + tr, x1, y1 - br);
  if (br) { g.moveTo(x1, y1 - br); g.arcTo(x1, y1, x1 - br, y1, br); }
  side(!has(S), x1 - br, y1, x0 + bl, y1);
  if (bl) { g.moveTo(x0 + bl, y1); g.arcTo(x0, y1, x0, y1 - bl, bl); }
  side(!has(W), x0, y1 - bl, x0, y0 + tl);
  if (tl) { g.moveTo(x0, y0 + tl); g.arcTo(x0, y0, x0 + tl, y0, tl); }
}

/** Streets and squares (citybuilding.md §9): a paved square in a style, joined to its neighbours. */
export function pavingTile(style: number, mask: number, variant: number): Texture {
  return make(`pave:${style}:${mask}:${variant}`, (g) => {
    const p = PAVE[style] ?? PAVE[1];
    const inset = style === 3 ? 6 : 4;
    // A soft shadow under the open edges, then the base.
    shape(g, mask, T * 0.32, inset); g.fillStyle = p.base; g.fill();
    g.save(); shape(g, mask, T * 0.32, inset); g.clip();
    const r = rng(variant * 31 + style * 7 + 1);
    if (style === 2) {
      // Flagstones in staggered courses: rows of 4, widths that tile seamlessly across squares.
      const rows = 4, h = T / rows;
      for (let row = 0; row < rows; row++) {
        const off = row % 2 ? T / 4 : 0;
        for (let x = -off; x < T; x += T / 2) {
          g.fillStyle = r() < 0.5 ? p.a : p.b;
          g.beginPath(); g.roundRect(x + 1.5, row * h + 1.5, T / 2 - 3, h - 3, 5); g.fill();
        }
      }
    } else if (style === 3) {
      // Earth: packed, with a few pebbles and a lighter worn middle.
      for (let i = 0; i < 9; i++) { g.fillStyle = r() < 0.5 ? p.b : 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(10 + r() * (T - 20), 10 + r() * (T - 20), 2 + r() * 2.5, 1.5 + r() * 1.5, r() * 3, 0, Math.PI * 2); g.fill(); }
    } else {
      // Cobbles (and knights' setts): a grid of rounded stones, jittered inside, seamless at the edges.
      const n = style === 0 ? 5 : 6, c = T / n;
      for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
        const jx = (r() - 0.5) * c * 0.18, jy = (r() - 0.5) * c * 0.18, w = c * (0.78 + r() * 0.14), h = c * (0.74 + r() * 0.14);
        g.fillStyle = r() < 0.5 ? p.a : p.b;
        g.beginPath(); g.roundRect(ix * c + (c - w) / 2 + jx, iy * c + (c - h) / 2 + jy, w, h, c * 0.32); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.beginPath(); g.roundRect(ix * c + (c - w) / 2 + jx + 2, iy * c + (c - h) / 2 + jy + 2, w * 0.5, 2.2, 1); g.fill();
      }
    }
    g.restore();
    // A kerb on the open edges (earth gets a soft trodden rim instead).
    g.lineCap = 'round';
    if (style === 3) { edges(g, mask, T * 0.32, inset); g.strokeStyle = 'rgba(120,90,55,0.35)'; g.lineWidth = 5; g.stroke(); }
    else { edges(g, mask, T * 0.32, inset); g.strokeStyle = p.kerb; g.lineWidth = 5; g.stroke(); edges(g, mask, T * 0.32, inset + 3.5); g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.6; g.stroke(); }
  });
}

/** Flowerbeds: soil in a timber edging, packed with flowers; beds side by side make one garden. */
export function flowerbedTile(mask: number, variant: number): Texture {
  return make(`bed:${mask}:${variant}`, (g) => {
    g.lineCap = 'round';
    shape(g, mask, T * 0.22, 8); g.fillStyle = PAL.soil; g.fill();
    g.save(); shape(g, mask, T * 0.22, 8); g.clip();
    const r = rng(variant * 17 + 5);
    const hues = [[PAL.rose, PAL.butter], [PAL.lavender, PAL.white], [PAL.butter, PAL.rose, PAL.lavender]][variant % 3];
    // Leaves first, then blooms on top, in a loose grid so beds join without seams.
    for (let iy = 0; iy < 5; iy++) for (let ix = 0; ix < 5; ix++) {
      const x = ix * (T / 5) + T / 10 + (r() - 0.5) * 10, y = iy * (T / 5) + T / 10 + (r() - 0.5) * 10;
      g.fillStyle = r() < 0.5 ? PAL.leaf : PAL.leafShade; g.beginPath(); g.ellipse(x, y + 3, 9, 6, 0, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 16; i++) {
      const x = 8 + r() * (T - 16), y = 8 + r() * (T - 16), col = hues[Math.floor(r() * hues.length)];
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.fillStyle = col; g.beginPath(); g.arc(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.8, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#e3b23c'; g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    edges(g, mask, T * 0.22, 8); g.strokeStyle = PAL.woodShade; g.lineWidth = 7; g.stroke();
    edges(g, mask, T * 0.22, 8); g.strokeStyle = PAL.wood; g.lineWidth = 4; g.stroke();
  });
}

/**
 * Bridges: bridge squares that touch make one deck (citybuilding.md §9), in one direction
 * (`along`: east–west, else north–south). Planks run across it; `joined` says which sides
 * (N/E/S/W) carry on into more bridge, so the deck reaches the edge there and only its outer
 * edges get rails; a stone abutment stands where it meets a bank (`bank`).
 */
export function bridgeTile(along: boolean, joined: number, bank: number, variant: number): Texture {
  return make(`bridge:${along}:${joined}:${bank}:${variant}`, (g) => {
    g.save();
    if (!along) { g.translate(T / 2, T / 2); g.rotate(Math.PI / 2); g.translate(-T / 2, -T / 2); }
    // In the rotated frame the deck runs left–right: "top"/"bottom" are its sides, "left"/"right" its ends.
    const topJ = along ? joined & N : joined & E, botJ = along ? joined & S : joined & W;
    const leftBank = along ? bank & W : bank & N, rightBank = along ? bank & E : bank & S;
    const d0 = topJ ? 0 : T * 0.16, d1 = botJ ? T : T * 0.84;
    if (!botJ) { g.fillStyle = 'rgba(20,40,60,0.28)'; g.fillRect(0, d1 - 2, T, 10); } // shadow on the water
    g.fillStyle = PAL.woodShade; g.fillRect(0, d0, T, d1 - d0);
    const r = rng(variant + 3);
    // Planks across the deck, 16 to a square so they line up from one square to the next.
    for (let x = 0; x < T; x += 16) { g.fillStyle = r() < 0.5 ? PAL.wood : PAL.woodLight; g.fillRect(x + 1, d0 + (topJ ? 0 : 2), 14, d1 - d0 - (topJ ? 0 : 2) - (botJ ? 0 : 2)); }
    g.strokeStyle = 'rgba(60,38,20,0.4)'; g.lineWidth = 1;
    for (let x = 0; x <= T; x += 16) { g.beginPath(); g.moveTo(x + 0.5, d0); g.lineTo(x + 0.5, d1); g.stroke(); }
    // Stringers: two dark beams under a wide deck, every square, so a big bridge still reads as built.
    if (topJ || botJ) { g.fillStyle = 'rgba(70,45,25,0.18)'; g.fillRect(0, T * 0.3, T, 3); g.fillRect(0, T * 0.7, T, 3); }
    const rail = (y: number) => {
      g.fillStyle = PAL.woodShade; g.fillRect(0, y - 3, T, 6);
      g.fillStyle = PAL.woodLight; g.fillRect(0, y - 3, T, 2);
      for (const px of [T * 0.25, T * 0.75]) { g.fillStyle = PAL.woodShade; g.beginPath(); g.roundRect(px - 5, y - 7, 10, 14, 3); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); }
    };
    if (!topJ) rail(d0 + 2);
    if (!botJ) rail(d1 - 2);
    const abut = (x: number) => { g.fillStyle = PAL.stone; g.beginPath(); g.roundRect(x, d0 - (topJ ? 0 : 6), T * 0.22, d1 - d0 + (topJ ? 0 : 6) + (botJ ? 0 : 6), topJ || botJ ? 0 : 6); g.fill(); g.strokeStyle = PAL.mortar; g.lineWidth = 3; g.stroke(); };
    if (leftBank) abut(-T * 0.06);
    if (rightBank) abut(T * 0.84);
    g.restore();
  });
}

type LineKind = 'wall' | 'fence' | 'hedge';

/**
 * Walls, fences and hedges, drawn from their four-way connections (N/E/S/W bits, already turned
 * to the screen). Runs join up; corners, junctions and ends get a post (a tower, for walls).
 * A gate is an opening in the run. Drawn top-down with a little front face, like the rest of
 * the world's objects, on a square with room above for height.
 */
export function lineTile(kind: LineKind, mask: number, gate: boolean, team: string): Texture {
  return make(`line:${kind}:${mask}:${gate}:${team}`, (g) => {
    const c = T / 2, has = (b: number) => (mask & b) !== 0;
    const straightEW = (mask & 15) === (E | W), straightNS = (mask & 15) === (N | S);
    const post = !straightEW && !straightNS;
    if (kind === 'hedge') {
      const w = T * 0.36;
      g.lineCap = 'round';
      const arms = () => { g.beginPath(); for (const [dx, dy, bit] of DIRS.slice(0, 4)) if (has(bit)) { g.moveTo(c, c); g.lineTo(c + dx * c, c + dy * c); } g.stroke(); };
      g.strokeStyle = 'rgba(40,30,20,0.2)'; g.lineWidth = w; g.save(); g.translate(0, 5); arms(); g.restore();
      g.strokeStyle = PAL.leafShade; g.lineWidth = w + 6; arms();
      g.strokeStyle = PAL.leaf; g.lineWidth = w; arms();
      g.fillStyle = PAL.leafShade; g.beginPath(); g.arc(c, c + 3, w / 2 + 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = PAL.leaf; g.beginPath(); g.arc(c, c, w / 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = PAL.leafLight; for (const [dx, dy] of [[-8, -8], [6, -4], [-2, 6]]) { g.beginPath(); g.arc(c + dx, c + dy, 5, 0, Math.PI * 2); g.fill(); }
      if (gate) { g.fillStyle = PAL.soil; g.fillRect(c - 12, 0, 24, T); }
      return;
    }
    if (kind === 'fence') {
      // Two rails: stacked on an east-west run (seen from the front), side by side on a north-south one.
      const rail = (x0: number, y0: number, x1: number, y1: number) => {
        const ns = x0 === x1;
        for (const off of ns ? [-6, 6] : [-7, 4]) {
          const [ax, ay, bx2, by2] = ns ? [x0 + off, y0, x1 + off, y1] : [x0, y0 + off, x1, y1 + off];
          g.strokeStyle = PAL.woodShade; g.lineWidth = 5; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx2, by2); g.stroke();
          g.strokeStyle = PAL.woodLight; g.lineWidth = 2; g.beginPath(); g.moveTo(ax - (ns ? 1 : 0), ay - (ns ? 0 : 1)); g.lineTo(bx2 - (ns ? 1 : 0), by2 - (ns ? 0 : 1)); g.stroke();
        }
      };
      g.strokeStyle = 'rgba(40,30,20,0.18)'; g.lineWidth = 6;
      if (!gate) {
        if (has(E)) rail(c, c, T, c); if (has(W)) rail(0, c, c, c);
        if (has(N)) rail(c, c, c, 0); if (has(S)) rail(c, c, c, T);
      }
      const postAt = (x: number, y: number) => { g.fillStyle = 'rgba(40,30,20,0.2)'; g.beginPath(); g.ellipse(x + 2, y + 9, 7, 3, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = PAL.wood; g.beginPath(); g.roundRect(x - 5, y - 14, 10, 24, 3); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.2; g.stroke(); g.fillStyle = PAL.woodLight; g.fillRect(x - 3, y - 12, 3, 18); };
      if (gate) { postAt(T * 0.14, c); postAt(T * 0.86, c); g.strokeStyle = PAL.wood; g.lineWidth = 3; g.beginPath(); g.moveTo(T * 0.2, c - 6); g.lineTo(T * 0.45, c - 2); g.moveTo(T * 0.8, c - 6); g.lineTo(T * 0.55, c - 2); g.stroke(); }
      else postAt(c, c); // a post on every square: runs read the same both ways
      return;
    }
    // Walls: a stone run (light top, darker front face, crenellations), towers at posts.
    const wTop = T * 0.3, face = T * 0.14;
    const run = (dx: number, dy: number) => {
      if (dy === 0) {
        const x0 = dx > 0 ? c : 0, x1 = dx > 0 ? T : c;
        g.fillStyle = 'rgba(40,30,20,0.2)'; g.fillRect(x0, c + wTop / 2 + face, x1 - x0, 6);
        g.fillStyle = PAL.stoneShade; g.fillRect(x0, c + wTop / 2 - 2, x1 - x0, face);
        g.fillStyle = PAL.stone; g.fillRect(x0, c - wTop / 2, x1 - x0, wTop);
        g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x0, c - wTop / 2); g.lineTo(x1, c - wTop / 2); g.moveTo(x0, c + wTop / 2 + face - 2); g.lineTo(x1, c + wTop / 2 + face - 2); g.stroke();
        g.fillStyle = PAL.stoneLight; for (let x = x0 + 4; x < x1 - 4; x += 16) g.fillRect(x, c - wTop / 2 - 5, 9, 7);
        g.strokeStyle = PAL.mortar; g.lineWidth = 1.5; for (let x = x0; x < x1; x += 16) { g.beginPath(); g.moveTo(x + 8, c + wTop / 2); g.lineTo(x + 8, c + wTop / 2 + face - 2); g.stroke(); }
      } else {
        const y0 = dy > 0 ? c : 0, y1 = dy > 0 ? T : c;
        g.fillStyle = PAL.stoneShade; g.fillRect(c - wTop / 2 - 2, y0, wTop + 4, y1 - y0);
        g.fillStyle = PAL.stone; g.fillRect(c - wTop / 2, y0, wTop, y1 - y0);
        g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); g.moveTo(c - wTop / 2 - 2, y0); g.lineTo(c - wTop / 2 - 2, y1); g.moveTo(c + wTop / 2 + 2, y0); g.lineTo(c + wTop / 2 + 2, y1); g.stroke();
        g.fillStyle = PAL.stoneLight; for (let y = y0 + 4; y < y1 - 4; y += 16) g.fillRect(c - wTop / 2 + 3, y, 6, 9);
      }
    };
    if (!gate) { if (has(N)) run(0, -1); if (has(W)) run(-1, 0); if (has(E)) run(1, 0); if (has(S)) run(0, 1); }
    if (gate) {
      // An arched gateway through the run, pillars either side.
      const horiz = has(E) || has(W) || (!has(N) && !has(S));
      g.save(); if (!horiz) { g.translate(c, c); g.rotate(Math.PI / 2); g.translate(-c, -c); }
      for (const px of [T * 0.16, T * 0.84]) { g.fillStyle = PAL.stoneShade; g.fillRect(px - 12, c - wTop / 2 - 8, 24, wTop + face + 10); g.fillStyle = PAL.stone; g.fillRect(px - 12, c - wTop / 2 - 12, 24, wTop + 6); g.strokeStyle = INK; g.lineWidth = 2.4; g.strokeRect(px - 12, c - wTop / 2 - 12, 24, wTop + face + 14); }
      g.strokeStyle = PAL.stoneShade; g.lineWidth = 8; g.beginPath(); g.arc(c, c + 2, T * 0.3, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      g.restore();
    } else if (post) {
      // A round tower where the wall turns, branches or ends: stone drum, crenellated top, a pennant.
      const R = 30, top = c - 10, base = c + 22;
      g.fillStyle = 'rgba(40,30,20,0.22)'; g.beginPath(); g.ellipse(c + 3, base + 4, R + 2, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = PAL.stoneShade; g.beginPath(); g.moveTo(c - R, top); g.lineTo(c - R, base); g.ellipse(c, base, R, 10, 0, Math.PI, 0, true); g.lineTo(c + R, top); g.closePath(); g.fill();
      g.fillStyle = PAL.stone; g.fillRect(c - R, top, R * 0.9, base - top);
      g.strokeStyle = PAL.mortar; g.lineWidth = 1.5; for (const yy of [top + 10, top + 20]) { g.beginPath(); g.moveTo(c - R, yy); g.lineTo(c + R, yy); g.stroke(); }
      g.fillStyle = PAL.stone; g.beginPath(); g.ellipse(c, top, R, 13, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = PAL.stoneShade; g.beginPath(); g.ellipse(c, top, R - 8, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = PAL.stoneLight; for (let k = 0; k < 8; k++) { const a2 = (k / 8) * Math.PI * 2; g.beginPath(); g.roundRect(c + Math.cos(a2) * (R - 4) - 4, top + Math.sin(a2) * 9 - 7, 8, 8, 2); g.fill(); }
      g.strokeStyle = INK; g.lineWidth = 2.6;
      g.beginPath(); g.ellipse(c, top, R, 13, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(c - R, top); g.lineTo(c - R, base); g.ellipse(c, base, R, 10, 0, Math.PI, 0, true); g.lineTo(c + R, top); g.stroke();
      g.fillStyle = '#3d3530'; g.beginPath(); g.roundRect(c - 4, top + 12, 8, 12, 4); g.fill();
      g.strokeStyle = INK; g.lineWidth = 2.2; g.beginPath(); g.moveTo(c, top - 2); g.lineTo(c, top - 30); g.stroke();
      g.fillStyle = team; g.beginPath(); g.moveTo(c, top - 30); g.lineTo(c + 16, top - 25); g.lineTo(c, top - 20); g.closePath(); g.fill(); g.stroke();
    }
  });
}

/** A small picture of a unit for the palette: a few joined tiles drawn side by side. */
const previews = new Map<string, string>();
export function previewUrl(kind: string, team = '#d9534a'): string {
  const hit = previews.get(kind + team);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = T * 2; c.height = T;
  const g = c.getContext('2d')!;
  const put = (t: Texture, x: number) => { const src = t.source.resource as CanvasImageSource; g.drawImage(src, x, 0); };
  if (kind.startsWith('pave:')) { const st = Number(kind.slice(5)); put(pavingTile(st, E, 0), 0); put(pavingTile(st, W, 1), T); }
  else if (kind === 'flowerbed') { put(flowerbedTile(E, 0), 0); put(flowerbedTile(W, 2), T); }
  else if (kind === 'bridge') { g.fillStyle = '#7fb2d4'; g.fillRect(0, 0, T * 2, T); put(bridgeTile(true, N | S, W, 0), 0); put(bridgeTile(true, N | S, E, 1), T); }
  else if (kind === 'wall' || kind === 'fence' || kind === 'hedge') { put(lineTile(kind, E, false, team), 0); put(lineTile(kind, W, false, team), T); }
  const u = c.toDataURL();
  previews.set(kind + team, u);
  return u;
}
