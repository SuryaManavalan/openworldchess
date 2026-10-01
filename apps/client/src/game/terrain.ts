// Chunk terrain textures. Every terrain keeps a light/dark checker so the world
// always reads as a board (art.md §2). Desire paths and settlement plazas are
// painted on top from live data (visuals.md §4).
import { CanvasSource, Texture } from 'pixi.js';
import { CHUNK, PAVED } from '@owc/shared';
import { hash01, riverBed } from '@owc/worldgen';
import { lookOf, palOf } from './biomeArt.ts';

export const TPX = 16; // canvas pixels per square in chunk textures
/** Far zoom paints each square as a couple of flat pixels. */
export const FAR_TPX = 2;

// Light / dark / detail colors come per terrain code (grass, sand, water, forest,
// mountain) and per biome (biomeArt.ts). Water is always this blue under bridges.
const WATER: [string, string] = ['#8fd0e3', '#71bcd4'];
// Settled ground by tier (visuals.md §10), for the far view: earth, earth, flagstones, and a
// city's chessboard in the classic walnut-and-cream (the near view paints them in paintPlazas).
const GROUND: Record<number, [string, string]> = {
  1: ['#dccb9f', '#d2c093'],
  2: ['#dccb9f', '#d2c093'],
  3: ['#e6dcc6', '#d8cbb0'],
  4: ['#efe0c0', '#b58863'],
};
export interface ChunkPaint {
  codes: Uint8Array;
  /** Biome code per square (worldgen BIOMES order). */
  biomes: Uint8Array;
  /** Settlement tier of a world square (0 = wild). */
  ground: (x: number, y: number) => number;
  /** A city's heart: the chessboard plaza (citybuilding.md §9). */
  heart?: (x: number, y: number) => boolean;
  /** Walking traffic at a world square. */
  traffic: (x: number, y: number) => number;
}

export function paintChunk(seed: number, cx: number, cy: number, d: ChunkPaint, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = CHUNK * TPX; c.height = CHUNK * TPX;
  const g = c.getContext('2d')!;
  const x0 = cx * CHUNK, y0 = cy * CHUNK;
  for (let y = 0; y < CHUNK; y++)
    for (let x = 0; x < CHUNK; x++) {
      const i = y * CHUNK + x, wx = x0 + x, wy = y0 + y;
      const code = d.codes[i], biome = d.biomes[i];
      const light = ((wx + wy) & 1) === 0;
      const tier = code === 2 || code === 4 ? 0 : d.ground(wx, wy);
      const [l, dk, mark] = palOf(code, biome);
      const look = lookOf(biome);
      // Fords: the river's dry, pebbled bed where it runs shallow (so rivers read as one).
      const ford = !tier && code !== 2 && code !== 4 && riverBed(seed, wx, wy);
      g.fillStyle = ford ? (light ? '#dcd2ad' : '#cfc39a') : light ? l : dk;
      g.fillRect(x * TPX, y * TPX, TPX, TPX);
      if (ford) {
        const q = hash01(seed, wx, wy, 301);
        g.fillStyle = 'rgba(120,108,84,0.5)';
        for (let k = 0; k < 3; k++) g.fillRect(x * TPX + 2 + hash01(seed, wx, wy, 304 + k) * 11, y * TPX + 2 + hash01(seed, wx, wy, 307 + k) * 11, 2, 2);
        if (q < 0.3) { g.fillStyle = 'rgba(143,208,227,0.8)'; g.beginPath(); g.ellipse(x * TPX + 8, y * TPX + 8, 4 + q * 8, 2.5, 0, 0, Math.PI * 2); g.fill(); }
        continue;
      }
      const r = hash01(seed, wx, wy, 300);
      // Settled ground is painted over the whole town at once (paintPlazas): no marks under it.
      if (tier) continue;
      g.fillStyle = mark; g.strokeStyle = mark; g.lineWidth = 1;
      const px = x * TPX, py = y * TPX;
      // Biome marks on open ground and forest floor (visuals.md §11).
      if ((code === 0 || code === 3) && look.mark && look.mark !== 'tuft') {
        if (r < (code === 3 ? 0.35 : 0.5)) biomeMark(g, look.mark, px, py, r, mark, look.accent ?? mark, hash01(seed, wx, wy, 302));
        continue;
      }
      if (code === 2 && look.lava) {
        // Lava: slow bright seams and a glow.
        if (r < 0.4) { g.strokeStyle = look.accent ?? '#ffd070'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px + 2, py + 4 + r * 8); g.quadraticCurveTo(px + 8, py + r * 12, px + 14, py + 6 + r * 6); g.stroke(); }
        if (r > 0.8) { g.fillStyle = '#ffd070'; g.beginPath(); g.arc(px + 8, py + 8, 1.8, 0, Math.PI * 2); g.fill(); }
        continue;
      }
      if (code === 0 && r < 0.35) {
        const ox = x * TPX + 3 + r * 20 % 9, oy = y * TPX + 11;
        g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + 1, oy - 3); g.moveTo(ox + 3, oy); g.lineTo(ox + 3.5, oy - 4); g.moveTo(ox + 6, oy); g.lineTo(ox + 5, oy - 3); g.stroke();
      } else if (code === 1 && r < 0.6) {
        g.fillRect(x * TPX + 3 + r * 40 % 10, y * TPX + 4 + r * 70 % 8, 1.5, 1.5);
      } else if (code === 2 && r < 0.25) {
        g.globalAlpha = 0.7;
        g.beginPath(); const ox = x * TPX + 3, oy = y * TPX + 6 + r * 20 % 6;
        g.moveTo(ox, oy); g.quadraticCurveTo(ox + 2.5, oy - 2, ox + 5, oy); g.quadraticCurveTo(ox + 7.5, oy + 2, ox + 10, oy); g.stroke();
        g.globalAlpha = 1;
      } else if (code === 3 && r < 0.5) {
        g.beginPath(); g.arc(x * TPX + 4 + r * 30 % 8, y * TPX + 5 + r * 50 % 7, 1.6, 0, Math.PI * 2); g.fill();
      } else if (code === 4) {
        g.beginPath(); g.moveTo(x * TPX + 3, y * TPX + 12); g.lineTo(x * TPX + 8, y * TPX + 4); g.lineTo(x * TPX + 13, y * TPX + 12); g.stroke();
      }
    }
  paintPaths(g, seed, x0, y0, d);
  paintPlazas(g, seed, x0, y0, d);
  // (Bridges are built by players now: citybuilding.md §4. Knights' roads and player streets
  // are drawn crisp by the city layer, citylayer.ts.)
  return c;
}

/** Cheap far-zoom painter: one flat color per square (terrain, settled ground, roads, riverbeds). */
export function paintChunkFar(seed: number, cx: number, cy: number, d: ChunkPaint, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = CHUNK * FAR_TPX; c.height = CHUNK * FAR_TPX;
  const g = c.getContext('2d')!;
  const x0 = cx * CHUNK, y0 = cy * CHUNK;
  for (let y = 0; y < CHUNK; y++)
    for (let x = 0; x < CHUNK; x++) {
      const wx = x0 + x, wy = y0 + y, code = d.codes[y * CHUNK + x];
      const light = ((wx + wy) & 1) === 0;
      const tier = code === 2 || code === 4 ? 0 : d.ground(wx, wy);
      const pal = palOf(code, d.biomes[y * CHUNK + x]);
      let col = light ? pal[0] : pal[1];
      if (tier) col = GROUND[tier][light ? 0 : 1];
      else if (code !== 2 && code !== 4 && d.traffic(wx, wy) >= 12) col = d.traffic(wx, wy) >= 60 ? '#aaa294' : '#c9ad7c';
      else if (code !== 2 && code !== 4 && riverBed(seed, wx, wy)) col = light ? '#dcd2ad' : '#cfc39a';
      g.fillStyle = col;
      g.fillRect(x * FAR_TPX, y * FAR_TPX, FAR_TPX, FAR_TPX);
    }
  return c;
}

/** Small marks that give each biome its ground texture. */
function biomeMark(g: CanvasRenderingContext2D, mark: string, px: number, py: number, r: number, color: string, accent: string, q: number) {
  const ox = px + 3 + (r * 37 % 9), oy = py + 3 + (q * 41 % 9);
  switch (mark) {
    case 'dot': g.fillStyle = color; g.beginPath(); g.arc(ox, oy, 1.4, 0, Math.PI * 2); g.arc(ox + 5, oy + 3, 1, 0, Math.PI * 2); g.fill(); break;
    case 'ripple': g.strokeStyle = color; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 2, oy); g.quadraticCurveTo(px + 8, oy - 3, px + 14, oy); g.stroke(); break;
    case 'crack': g.strokeStyle = color; g.lineWidth = 1; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + 3, oy + 2); g.lineTo(ox + 2, oy + 5); g.moveTo(ox + 3, oy + 2); g.lineTo(ox + 6, oy + 1); g.stroke(); break;
    case 'petal': g.fillStyle = accent; g.beginPath(); g.ellipse(ox, oy, 1.8, 1.1, q * 3, 0, Math.PI * 2); g.ellipse(ox + 5, oy + 4, 1.5, 1, q * 5, 0, Math.PI * 2); g.fill(); break;
    case 'sparkle': g.fillStyle = accent; g.globalAlpha = 0.85; g.fillRect(ox, oy - 1.5, 1, 4); g.fillRect(ox - 1.5, oy, 4, 1); g.globalAlpha = 1; break;
    case 'heather': g.fillStyle = accent; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(ox + k * 2.2, oy - (k % 2) * 1.6, 1.1, 0, Math.PI * 2); g.fill(); } g.strokeStyle = color; g.lineWidth = 1; g.beginPath(); g.moveTo(ox + 2, oy + 1); g.lineTo(ox + 2, oy + 4); g.stroke(); break;
    case 'cap': g.fillStyle = accent; g.beginPath(); g.arc(ox, oy, 1.8, Math.PI, 0); g.fill(); g.fillStyle = '#efe6d2'; g.fillRect(ox - 0.5, oy, 1, 2); break;
    case 'leaf': g.fillStyle = q < 0.5 ? accent : color; g.beginPath(); g.ellipse(ox, oy, 2, 1.1, q * 6, 0, Math.PI * 2); g.fill(); break;
  }
}

/** Terrain code per world square for chunks we've generated (used for sounds, birds, placement). */
export const terrainCodes = new Map<string, Uint8Array>();
/** Biome code per world square for generated chunks. */
export const biomeCodes = new Map<string, Uint8Array>();
export function codeAt(x: number, y: number): number {
  const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
  const c = terrainCodes.get(`${cx},${cy}`);
  return c ? c[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)] : 0;
}

/** A fresh (uncached) texture for a chunk canvas. */
export function textureFrom(canvas: HTMLCanvasElement) {
  return new Texture({ source: new CanvasSource({ resource: canvas, scaleMode: 'linear' }) });
}

// ---------- settled ground, paths and roads (visuals.md §10) ----------

const cen = (i: number) => i * TPX + TPX / 2;

/**
 * The outline of a set of squares as edge segments (a square's side with no neighbor in the
 * set), in chunk pixels. Corners are nudged a little by a seeded hash (shared corners move
 * together), so outlines read as laid out by hand rather than ruled.
 */
function outline(set: (x: number, y: number) => boolean, seed: number, x0: number, y0: number, from: number, to: number, wobble = 1.6) {
  const segs: [number, number, number, number][] = [];
  const vx = (x: number, y: number) => x * TPX + (hash01(seed, x0 + x, y0 + y, 360) - 0.5) * 2 * wobble;
  const vy = (x: number, y: number) => y * TPX + (hash01(seed, x0 + x, y0 + y, 361) - 0.5) * 2 * wobble;
  for (let y = from; y < to; y++) for (let x = from; x < to; x++) {
    if (!set(x, y)) continue;
    if (!set(x, y - 1)) segs.push([vx(x, y), vy(x, y), vx(x + 1, y), vy(x + 1, y)]);
    if (!set(x, y + 1)) segs.push([vx(x, y + 1), vy(x, y + 1), vx(x + 1, y + 1), vy(x + 1, y + 1)]);
    if (!set(x - 1, y)) segs.push([vx(x, y), vy(x, y), vx(x, y + 1), vy(x, y + 1)]);
    if (!set(x + 1, y)) segs.push([vx(x + 1, y), vy(x + 1, y), vx(x + 1, y + 1), vy(x + 1, y + 1)]);
  }
  return segs;
}

/**
 * Fill a set of squares as one soft shape: the squares themselves, grown by `grow` pixels
 * past the outline with rounded corners (a thick round-capped stroke along the outline).
 */
function fillSoft(g: CanvasRenderingContext2D, set: (x: number, y: number) => boolean, segs: [number, number, number, number][], from: number, to: number, color: string, grow: number) {
  g.fillStyle = color; g.strokeStyle = color;
  g.beginPath();
  for (let y = from; y < to; y++) for (let x = from; x < to; x++) if (set(x, y)) g.rect(x * TPX - 0.5, y * TPX - 0.5, TPX + 1, TPX + 1);
  g.fill();
  if (grow > 0) {
    g.lineWidth = grow * 2; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    for (const [ax, ay, bx, by] of segs) { g.moveTo(ax, ay); g.lineTo(bx, by); }
    g.stroke();
  }
}

/**
 * Worn roads where feet go (visuals.md §4). Marching columns and wandering pieces wear many
 * parallel lanes; drawn square by square they made a grid. Instead the traffic is blurred
 * heavily (a Gaussian about 2 squares wide), and a road is drawn along the crest of each
 * worn band: one road down the middle of the route, wider where it's busier, with forks
 * where routes part. Towns aren't drawn here: their plazas cover them.
 */
function paintPaths(g: CanvasRenderingContext2D, seed: number, x0: number, y0: number, d: ChunkPaint) {
  const M = 10, W = CHUNK + 2 * M;
  const raw = new Float32Array(W * W), tmp = new Float32Array(W * W), sm = new Float32Array(W * W);
  let any = false;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const wx = x0 + x - M, wy = y0 + y - M;
    const t = d.traffic(wx, wy);
    if (!t || t >= PAVED || d.ground(wx, wy)) continue;
    raw[y * W + x] = Math.min(t, 120);
    any = true;
  }
  if (!any) return;
  const K = [0.03, 0.07, 0.13, 0.19, 0.22, 0.19, 0.13, 0.07, 0.03]; // σ ≈ 2 squares
  for (let y = 0; y < W; y++) for (let x = 4; x < W - 4; x++) { let v = 0; for (let i = 0; i < 9; i++) v += K[i] * raw[y * W + x + i - 4]; tmp[y * W + x] = v; }
  for (let y = 4; y < W - 4; y++) for (let x = 0; x < W; x++) { let v = 0; for (let i = 0; i < 9; i++) v += K[i] * tmp[(y + i - 4) * W + x]; sm[y * W + x] = v; }
  const R = M - 5; // how far outside the chunk the crest is judged (the blur is only whole inside M - 4)
  const at = (x: number, y: number) => (x < -R - 1 || y < -R - 1 || x > CHUNK + R || y > CHUNK + R ? 0 : sm[(y + M) * W + (x + M)]);
  const water = (x: number, y: number) => { const c = x >= 0 && y >= 0 && x < CHUNK && y < CHUNK ? d.codes[y * CHUNK + x] : 0; return c === 2 || c === 4; };
  // The crest: a square at least as worn as both its neighbors across some direction.
  const MIN = 4;
  const crest = (x: number, y: number) => {
    const v = at(x, y);
    if (v < MIN || water(x, y) || d.ground(x0 + x, y0 + y)) return false;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const a = at(x + dx, y + dy), b = at(x - dx, y - dy);
      if (v >= a && v >= b && (v > a || v > b)) return true;
    }
    return false;
  };
  const cells: { x: number; y: number; v: number }[] = [];
  const on = new Set<number>();
  for (let y = -3; y < CHUNK + 3; y++) for (let x = -3; x < CHUNK + 3; x++) if (crest(x, y)) { cells.push({ x, y, v: at(x, y) }); on.add((y + 8) * 64 + x + 8); }
  if (!cells.length) return;
  const isOn = (x: number, y: number) => on.has((y + 8) * 64 + x + 8);
  const wid = (v: number) => TPX * (0.2 + 0.38 * Math.min(1, (v - MIN) / 30));
  // Each point sits on the true crest between squares (the peak of a parabola through the
  // square and its neighbors), so a diagonal route draws straight, not as a staircase, and
  // a crest two squares wide draws as one line.
  const peak = (a: number, v: number, b: number) => { const den = a - 2 * v + b; return den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - b)) / den)) : 0; };
  const off = new Map<number, [number, number]>();
  for (const c of cells) {
    const v = c.v;
    off.set((c.y + 8) * 64 + c.x + 8, [peak(at(c.x - 1, c.y), v, at(c.x + 1, c.y)) * TPX + (hash01(seed, x0 + c.x, y0 + c.y, 330) - 0.5) * 1.5, peak(at(c.x, c.y - 1), v, at(c.x, c.y + 1)) * TPX + (hash01(seed, x0 + c.x, y0 + c.y, 331) - 0.5) * 1.5]);
  }
  const px = (x: number, y: number) => cen(x) + (off.get((y + 8) * 64 + x + 8)?.[0] ?? 0);
  const py = (x: number, y: number) => cen(y) + (off.get((y + 8) * 64 + x + 8)?.[1] ?? 0);
  const links: [number, number, number, number, number][] = [];
  for (const c of cells)
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const nx = c.x + dx, ny = c.y + dy;
      if (!isOn(nx, ny)) continue;
      if (dx && dy && (isOn(c.x + dx, c.y) || isOn(c.x, c.y + dy))) continue;
      links.push([c.x, c.y, nx, ny, Math.min(c.v, at(nx, ny))]);
    }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [grow, color] of [[2.5, 'rgba(140,112,70,0.22)'], [0, '#d6bd8f']] as const) {
    g.fillStyle = color; g.strokeStyle = color;
    for (let w = 0; w < 5; w++) {
      const band = (v: number) => Math.min(4, Math.floor(Math.min(1, (v - MIN) / 30) * 4.99));
      g.lineWidth = wid(MIN + (w / 4) * 30) + grow * 2;
      g.beginPath();
      for (const [ax, ay, bx, by, v] of links) if (band(v) === w) { g.moveTo(px(ax, ay), py(ax, ay)); g.lineTo(px(bx, by), py(bx, by)); }
      g.stroke();
      g.beginPath();
      for (const c of cells) if (band(c.v) === w) { const r = wid(c.v) / 2 + grow; g.moveTo(px(c.x, c.y) + r, py(c.x, c.y)); g.arc(px(c.x, c.y), py(c.x, c.y), r, 0, Math.PI * 2); }
      g.fill();
    }
  }
  // Wheel ruts and pebbles on the busy roads.
  g.fillStyle = 'rgba(120,96,62,0.32)';
  for (const c of cells) if (c.v > 14 && c.x >= 0 && c.y >= 0 && c.x < CHUNK && c.y < CHUNK) {
    const r = hash01(seed, x0 + c.x, y0 + c.y, 332);
    if (r < 0.45) { g.beginPath(); g.ellipse(px(c.x, c.y) + (r - 0.25) * 10, py(c.x, c.y) + (hash01(seed, x0 + c.x, y0 + c.y, 333) - 0.5) * 5, 1.5, 1, r * 3, 0, Math.PI * 2); g.fill(); }
  }
}

/**
 * Settlement ground (visuals.md §10), painted over the whole settled area at once, as one
 * soft shape with rounded corners and a trodden rim instead of square-cut blocks. Villages
 * are packed earth; towns lay flagstones in staggered courses; a city's heart is a
 * walnut-and-cream chessboard in a bronze frame. The board's checker always shows through.
 */
function paintPlazas(g: CanvasRenderingContext2D, seed: number, x0: number, y0: number, d: ChunkPaint) {
  const F = -3, T = CHUNK + 3;
  const tierAt = new Map<number, number>();
  let any = 0;
  // (Water and mountains stay themselves inside a town: rivers run through, bridges cross them.)
  const open = (x: number, y: number) => { const c = x >= 0 && y >= 0 && x < CHUNK && y < CHUNK ? d.codes[y * CHUNK + x] : codeAt(x0 + x, y0 + y); return c !== 2 && c !== 4; };
  for (let y = F - 1; y <= T; y++) for (let x = F - 1; x <= T; x++) { const t = d.ground(x0 + x, y0 + y); if (t && open(x, y)) { tierAt.set((y + 8) * 64 + (x + 8), t); any = Math.max(any, t); } }
  if (!any) return;
  const tier = (x: number, y: number) => tierAt.get((y + 8) * 64 + (x + 8)) ?? 0;
  const dark = (x: number, y: number) => ((x0 + x + y0 + y) & 1) === 1;
  const region = (min: number) => (x: number, y: number) => tier(x, y) >= min;
  // Earth, with a soft trodden rim where it meets the grass.
  const all = region(1), aSegs = outline(all, seed, x0, y0, F, T);
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(118,94,58,0.2)'; g.lineWidth = 16; g.beginPath(); for (const [ax, ay, bx, by] of aSegs) { g.moveTo(ax, ay); g.lineTo(bx, by); } g.stroke();
  fillSoft(g, all, aSegs, F, T, '#dccb9f', 4);
  g.fillStyle = 'rgba(96,74,44,0.07)';
  for (let y = F; y < T; y++) for (let x = F; x < T; x++) if (all(x, y) && dark(x, y)) g.fillRect(x * TPX, y * TPX, TPX, TPX);
  g.fillStyle = 'rgba(120,98,64,0.3)';
  for (let y = F; y < T; y++) for (let x = F; x < T; x++) {
    if (!all(x, y)) continue;
    const r = hash01(seed, x0 + x, y0 + y, 341);
    if (r < 0.35) { g.beginPath(); g.ellipse(x * TPX + 3 + r * 26, y * TPX + 4 + (r * 97 % 8), 1.5, 1, r * 4, 0, Math.PI * 2); g.fill(); }
  }
  if (any < 4 || !d.heart) return;
  // A city's heart (citybuilding.md §9): the chessboard, walnut and cream, in a bronze frame,
  // only around its centre. Everything else is calm earth, for players to pave as they like.
  const city = (x: number, y: number) => tier(x, y) >= 4 && d.heart!(x0 + x, y0 + y);
  const cSegs = outline(city, seed, x0, y0, F, T, 0);
  for (let y = F; y < T; y++) for (let x = F; x < T; x++) {
    if (!city(x, y)) continue;
    g.fillStyle = dark(x, y) ? '#b58863' : '#efe0c0';
    g.fillRect(x * TPX, y * TPX, TPX, TPX);
    const r = hash01(seed, x0 + x, y0 + y, 344);
    g.fillStyle = dark(x, y) ? 'rgba(90,56,30,0.16)' : 'rgba(255,255,255,0.35)';
    g.fillRect(x * TPX + 2, y * TPX + 3 + r * 8, TPX - 4, 1);
  }
  g.lineCap = 'round';
  g.strokeStyle = '#7a5a32'; g.lineWidth = 5; g.beginPath(); for (const [ax, ay, bx, by] of cSegs) { g.moveTo(ax, ay); g.lineTo(bx, by); } g.stroke();
  g.strokeStyle = '#c9a15a'; g.lineWidth = 2; g.beginPath(); for (const [ax, ay, bx, by] of cSegs) { g.moveTo(ax, ay); g.lineTo(bx, by); } g.stroke();
}


