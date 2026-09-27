// Chunk terrain textures. Every terrain keeps a light/dark checker so the world
// always reads as a board (art.md §2). Desire paths and settlement plazas are
// painted on top from live data (visuals.md §4).
import { Texture } from 'pixi.js';
import { CHUNK } from '@owc/shared';
import { hash01 } from '@owc/worldgen';

export const TPX = 16; // canvas pixels per square in chunk textures

// light / dark / detail colors per terrain code: grass, sand, water, forest, mountain
const PAL: [string, string, string][] = [
  ['#b5d175', '#95b957', '#7fa246'],
  ['#f1e2b5', '#e2cd96', '#c9b27a'],
  ['#8fd0e3', '#71bcd4', '#e6f6fb'],
  ['#8fb85a', '#76a447', '#5c8a38'],
  ['#a39a8c', '#8f8678', '#766e62'],
];
const PLAZA = ['#eeeed2', '#769656'];
const PATH = ['#d8c49a', '#c7b183'];

export interface ChunkPaint {
  codes: Uint8Array;
  plaza: Set<number>; // square index inside chunk
  traffic: Map<number, number>;
}

export function paintChunk(seed: number, cx: number, cy: number, d: ChunkPaint, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = CHUNK * TPX; c.height = CHUNK * TPX;
  const g = c.getContext('2d')!;
  for (let y = 0; y < CHUNK; y++)
    for (let x = 0; x < CHUNK; x++) {
      const i = y * CHUNK + x, wx = cx * CHUNK + x, wy = cy * CHUNK + y;
      const code = d.codes[i];
      const light = ((wx + wy) & 1) === 0;
      let [l, dk, mark] = PAL[code];
      let fill = light ? l : dk;
      const t = d.traffic.get(i) ?? 0;
      if (d.plaza.has(i)) fill = light ? PLAZA[0] : PLAZA[1];
      else if (t >= 12 && code !== 2) fill = light ? PATH[0] : PATH[1];
      g.fillStyle = fill;
      g.fillRect(x * TPX, y * TPX, TPX, TPX);
      if (d.plaza.has(i)) continue;
      if (t >= 4 && t < 12 && code !== 2) { g.fillStyle = 'rgba(160,130,80,0.25)'; g.fillRect(x * TPX + 2, y * TPX + 2, TPX - 4, TPX - 4); }
      const r = hash01(seed, wx, wy, 300);
      g.fillStyle = mark; g.strokeStyle = mark; g.lineWidth = 1;
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
  return c;
}

/** Terrain code per world square for chunks we've generated (used for sounds, birds, placement). */
export const terrainCodes = new Map<string, Uint8Array>();
export function codeAt(x: number, y: number): number {
  const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
  const c = terrainCodes.get(`${cx},${cy}`);
  return c ? c[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)] : 0;
}

export function textureFrom(canvas: HTMLCanvasElement) {
  const t = Texture.from(canvas);
  t.source.scaleMode = 'linear';
  return t;
}
