// Chunk terrain textures. Every terrain keeps a light/dark checker so the world
// always reads as a board (art.md §2). Desire paths and settlement plazas are
// painted on top from live data (visuals.md §4).
import { CanvasSource, Texture } from 'pixi.js';
import { CHUNK } from '@owc/shared';
import { hash01, riverBed } from '@owc/worldgen';
import { lookOf, palOf } from './biomeArt.ts';

export const TPX = 16; // canvas pixels per square in chunk textures
/** Far zoom paints each square as a couple of flat pixels. */
export const FAR_TPX = 2;

// Light / dark / detail colors come per terrain code (grass, sand, water, forest,
// mountain) and per biome (biomeArt.ts). Water is always this blue under bridges.
const WATER: [string, string] = ['#8fd0e3', '#71bcd4'];
// Settled ground by settlement tier (visuals.md §10): earth → pebbles → cobbles → a real chessboard.
const GROUND: Record<number, [string, string]> = {
  1: ['#dccb9f', '#cbb98c'],
  2: ['#d8c7a0', '#c6b38b'],
  3: ['#d6cfc1', '#bfb7a7'],
  4: ['#eeeed2', '#769656'],
};
// Roads by traffic (visuals.md §10): a dirt path, then a cobbled street.
const ROAD = [
  { min: 12, width: 7, edge: 'rgba(120,92,56,0.35)', body: '#cdb283' },
  { min: 60, width: 9, edge: 'rgba(90,84,74,0.45)', body: '#b3ab9c' },
];
export interface ChunkPaint {
  codes: Uint8Array;
  /** Biome code per square (worldgen BIOMES order). */
  biomes: Uint8Array;
  /** Settlement tier of a world square (0 = wild). */
  ground: (x: number, y: number) => number;
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
      g.fillStyle = ford ? (light ? '#dcd2ad' : '#cfc39a') : tier ? (light ? GROUND[tier][0] : GROUND[tier][1]) : light ? l : dk;
      g.fillRect(x * TPX, y * TPX, TPX, TPX);
      if (ford) {
        const q = hash01(seed, wx, wy, 301);
        g.fillStyle = 'rgba(120,108,84,0.5)';
        for (let k = 0; k < 3; k++) g.fillRect(x * TPX + 2 + hash01(seed, wx, wy, 304 + k) * 11, y * TPX + 2 + hash01(seed, wx, wy, 307 + k) * 11, 2, 2);
        if (q < 0.3) { g.fillStyle = 'rgba(143,208,227,0.8)'; g.beginPath(); g.ellipse(x * TPX + 8, y * TPX + 8, 4 + q * 8, 2.5, 0, 0, Math.PI * 2); g.fill(); }
        continue;
      }
      const r = hash01(seed, wx, wy, 300);
      if (tier) {
        // Ground texture per tier.
        if (tier === 2 && r < 0.5) { g.fillStyle = 'rgba(120,100,70,0.35)'; g.fillRect(x * TPX + 3 + (r * 31 % 9), y * TPX + 4 + (r * 53 % 8), 2, 2); }
        if (tier === 3) { g.strokeStyle = 'rgba(90,82,70,0.35)'; g.lineWidth = 1; g.strokeRect(x * TPX + 1.5, y * TPX + 1.5, 6, 6); g.strokeRect(x * TPX + 8.5, y * TPX + 8.5, 6, 6); }
        if (tier === 4) { g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x * TPX, y * TPX, TPX, 2); g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x * TPX, y * TPX + TPX - 2, TPX, 2); }
        continue;
      }
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
  // Roads: smoothed curves through trodden squares. Each square's point is
  // nudged a little (seeded), and turns are rounded, so paths read as worn by feet
  // rather than drawn on a grid.
  const pt = (wx: number, wy: number): [number, number] => [
    (wx - x0) * TPX + TPX / 2 + (hash01(seed, wx, wy, 320) - 0.5) * 5,
    (wy - y0) * TPX + TPX / 2 + (hash01(seed, wx, wy, 321) - 0.5) * 5,
  ];
  const links = (wx: number, wy: number, min: number) => {
    const out: [number, number][] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (d.traffic(wx + dx, wy + dy) >= min) out.push([wx + dx, wy + dy]);
    // Diagonals only where no straight neighbor already connects them.
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]])
      if (d.traffic(wx + dx, wy + dy) >= min && d.traffic(wx + dx, wy) < min && d.traffic(wx, wy + dy) < min) out.push([wx + dx, wy + dy]);
    return out;
  };
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const level of ROAD) {
    for (const pass of ['edge', 'body'] as const) {
      g.strokeStyle = pass === 'edge' ? level.edge : level.body;
      g.lineWidth = pass === 'edge' ? level.width + 3 : level.width;
      g.beginPath();
      for (let y = -1; y <= CHUNK; y++)
        for (let x = -1; x <= CHUNK; x++) {
          const wx = x0 + x, wy = y0 + y;
          if (d.traffic(wx, wy) < level.min) continue;
          const code = x >= 0 && y >= 0 && x < CHUNK && y < CHUNK ? d.codes[y * CHUNK + x] : 0;
          if (code === 2 || code === 4) continue;
          const nb = links(wx, wy, level.min);
          // A lone busy square is not a road.
          if (!nb.length) continue;
          const [px, py] = pt(wx, wy);
          for (const [nx, ny] of nb) {
            if (ny < wy || (ny === wy && nx < wx)) continue; // draw each link once
            const [qx, qy] = pt(nx, ny);
            // Curve through the midpoint, bowed slightly (seeded), for a natural line.
            const bow = (hash01(seed, wx + nx, wy + ny, 322) - 0.5) * 4;
            const mx = (px + qx) / 2 + (qy - py) / TPX * bow, my = (py + qy) / 2 - (qx - px) / TPX * bow;
            g.moveTo(px, py);
            g.quadraticCurveTo(mx, my, qx, qy);
          }
        }
      g.stroke();
    }
  }
  // Where streets surround a square it becomes a paved square, not a grass hole.
  for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) {
    const wx = x0 + x, wy = y0 + y;
    const code = d.codes[y * CHUNK + x];
    if (code === 2 || code === 4) continue;
    const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => d.traffic(wx + dx, wy + dy) >= 60).length;
    if (around >= 3 || (around >= 2 && d.traffic(wx, wy) >= 60)) { g.fillStyle = ((wx + wy) & 1) === 0 ? '#b9b2a4' : '#aca496'; g.fillRect(x * TPX, y * TPX, TPX, TPX); }
  }
  // Cobbles on the busiest streets.
  g.fillStyle = 'rgba(80,74,64,0.35)';
  for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) {
    const wx = x0 + x, wy = y0 + y;
    if (d.traffic(wx, wy) < 60) continue;
    for (let k = 0; k < 3; k++) { const r = hash01(seed, wx, wy, 310 + k); g.fillRect(x * TPX + 3 + r * 9, y * TPX + 3 + (r * 71 % 9), 2, 2); }
  }
  // Bridges (visuals.md §10): where a road crosses a river at a ford, the crossing
  // becomes a plank bridge, and a stone bridge once the road is a busy street.
  for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) {
    const wx = x0 + x, wy = y0 + y, t = d.traffic(wx, wy);
    const code = d.codes[y * CHUNK + x];
    if (t < 12 || code === 2 || code === 4 || !riverBed(seed, wx, wy)) continue;
    const px = x * TPX, py = y * TPX, stone = t >= 60;
    // The deck runs along the road...
    const vertical = d.traffic(wx, wy - 1) + d.traffic(wx, wy + 1) >= d.traffic(wx - 1, wy) + d.traffic(wx + 1, wy);
    // ...and only where it crosses the river: the riverbed must be short along the
    // road (about the river's width), not a road running down a long ford.
    let span = 1;
    for (const s of [-1, 1]) for (let i = 1; i <= 14; i++) { if (!riverBed(seed, wx + (vertical ? 0 : s * i), wy + (vertical ? s * i : 0))) break; span++; }
    if (span > 24) continue;
    const light = ((wx + wy) & 1) === 0;
    g.fillStyle = light ? WATER[0] : WATER[1];
    g.fillRect(px, py, TPX, TPX);
    const [dx0, dy0, dw, dh] = vertical ? [px + 2, py, TPX - 4, TPX] : [px, py + 2, TPX, TPX - 4];
    g.fillStyle = stone ? '#bdb6a8' : '#a3784a';
    g.fillRect(dx0, dy0, dw, dh);
    g.strokeStyle = stone ? 'rgba(80,74,64,0.45)' : 'rgba(70,45,25,0.55)';
    g.lineWidth = 1;
    for (let i = 2; i < TPX; i += stone ? 5 : 3) {
      g.beginPath();
      if (vertical) { g.moveTo(dx0, py + i); g.lineTo(dx0 + dw, py + i); } else { g.moveTo(px + i, dy0); g.lineTo(px + i, dy0 + dh); }
      g.stroke();
    }
    // Rails on both sides of the deck, with posts.
    g.strokeStyle = stone ? '#8f887b' : '#5c3d22';
    g.lineWidth = stone ? 2.5 : 1.8;
    g.beginPath();
    if (vertical) { g.moveTo(px + 2, py); g.lineTo(px + 2, py + TPX); g.moveTo(px + TPX - 2, py); g.lineTo(px + TPX - 2, py + TPX); }
    else { g.moveTo(px, py + 2); g.lineTo(px + TPX, py + 2); g.moveTo(px, py + TPX - 2); g.lineTo(px + TPX, py + TPX - 2); }
    g.stroke();
    g.fillStyle = stone ? '#8f887b' : '#5c3d22';
    for (const o of [3, TPX - 5]) vertical ? (g.fillRect(px + 1, py + o, 3, 2), g.fillRect(px + TPX - 4, py + o, 3, 2)) : (g.fillRect(px + o, py + 1, 2, 3), g.fillRect(px + o, py + TPX - 4, 2, 3));
  }
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
