// The ground of player-built towns (citybuilding.md §9): streets and squares (and knights'
// roads), flowerbeds and bridges, drawn as full-resolution tiles that join their neighbours.
// It sits on the terrain, under every object. Cells are re-tiled only when they or a
// neighbour change.
import { Container, Sprite } from 'pixi.js';
import { CHUNK, PAVED, key } from '@owc/shared';
import { terrainAt } from '@owc/worldgen';
import type { Mirror } from '@owc/client-core';
import { E, N, S as SOUTH, W, bridgeTile, flowerbedTile, maskAt, pavingTile } from './cityart.ts';

const SQ = 64; // world pixels per square (scene.ts S)
const hash = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 3;

export class CityLayer {
  layer = new Container();
  private tiles = new Map<number, Sprite>();
  private dirty = new Map<number, [number, number]>();
  private m: Mirror;
  constructor(m: Mirror) { this.m = m; }

  /** A square (and its neighbours) changed. */
  mark(x: number, y: number) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.dirty.set(key(x + dx, y + dy), [x + dx, y + dy]); }

  /** A chunk arrived: everything paved or planted in it needs tiles. */
  markChunk(cx: number, cy: number) {
    for (const [k, v] of this.m.traffic) {
      if (v < PAVED) continue;
      const x = Math.round(k / 134217728), y = k - x * 134217728;
      if (Math.floor(x / CHUNK) === cx && Math.floor(y / CHUNK) === cy) this.mark(x, y);
    }
    for (const b of this.m.buildings.values()) if ((b.type === 'flowerbed' || b.type === 'bridge') && Math.floor(b.x / CHUNK) === cx && Math.floor(b.y / CHUNK) === cy) this.mark(b.x, b.y);
  }

  private decorAt(x: number, y: number) {
    const id = this.m.buildingAt.get(key(x, y));
    return id != null ? this.m.buildings.get(id) : undefined;
  }
  private paved(x: number, y: number) { return (this.m.traffic.get(key(x, y)) ?? 0) >= PAVED; }
  private water(x: number, y: number) { return terrainAt(this.m.seed, x, y) === 'water'; }

  /** Re-tile up to `budget` changed squares this frame. */
  update(budget = 300) {
    for (const [k, [x, y]] of this.dirty) {
      if (budget-- <= 0) break;
      this.dirty.delete(k);
      const d = this.decorAt(x, y);
      let tex = null;
      if (d?.type === 'bridge') {
        const isB = (ax: number, ay: number) => this.decorAt(ax, ay)?.type === 'bridge';
        const land = (ax: number, ay: number) => !this.water(ax, ay) && terrainAt(this.m.seed, ax, ay) !== 'mountain';
        const ew = isB(x + 1, y) || isB(x - 1, y) || land(x + 1, y) || land(x - 1, y);
        const ns = isB(x, y + 1) || isB(x, y - 1) || land(x, y + 1) || land(x, y - 1);
        // Along the crossing: the axis with bridge (or bank) on it; prefer a line of bridges.
        const along = (isB(x + 1, y) || isB(x - 1, y)) ? true : (isB(x, y + 1) || isB(x, y - 1)) ? false : ew || !ns;
        const rails = (along ? [[0, -1, N], [0, 1, SOUTH]] : [[1, 0, E], [-1, 0, W]]).reduce((m2, [dx, dy, bit]) => (!isB(x + dx, y + dy) && this.water(x + dx, y + dy) ? m2 | bit : m2), 0);
        const bank = [[0, -1, N], [1, 0, E], [0, 1, SOUTH], [-1, 0, W]].reduce((m2, [dx, dy, bit]) => (land(x + dx, y + dy) ? m2 | bit : m2), 0);
        tex = bridgeTile(along, rails, bank, hash(x, y));
      } else if (d?.type === 'flowerbed') {
        tex = flowerbedTile(maskAt(x, y, (ax, ay) => this.decorAt(ax, ay)?.type === 'flowerbed'), hash(x, y));
      } else if (this.paved(x, y)) {
        const style = Math.max(0, Math.min(3, (this.m.traffic.get(key(x, y)) ?? PAVED) - PAVED));
        tex = pavingTile(style, maskAt(x, y, (ax, ay) => this.paved(ax, ay)), hash(x, y));
      }
      let s = this.tiles.get(k);
      if (!tex) { if (s) { s.destroy(); this.tiles.delete(k); } continue; }
      if (!s) { s = new Sprite(); s.position.set(x * SQ, y * SQ); s.width = SQ; s.height = SQ; this.layer.addChild(s); this.tiles.set(k, s); }
      s.texture = tex; s.width = SQ; s.height = SQ;
    }
  }
}
