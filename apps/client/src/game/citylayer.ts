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

  /** Each bridge's direction, worked out once for its whole group (cleared when bridges change). */
  private axes = new Map<number, boolean>();
  private axisOf(x: number, y: number): boolean {
    const hit = this.axes.get(key(x, y));
    if (hit != null) return hit;
    const isB = (ax: number, ay: number) => this.decorAt(ax, ay)?.type === 'bridge';
    const land = (ax: number, ay: number) => !this.water(ax, ay) && terrainAt(this.m.seed, ax, ay) !== 'mountain';
    const seen = new Set<number>([key(x, y)]), todo: [number, number][] = [[x, y]], all: [number, number][] = [];
    while (todo.length && all.length < 400) {
      const [cx, cy] = todo.pop()!; all.push([cx, cy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key(cx + dx, cy + dy); if (!seen.has(k) && isB(cx + dx, cy + dy)) { seen.add(k); todo.push([cx + dx, cy + dy]); } }
    }
    const xs = all.map((c) => c[0]), ys = all.map((c) => c[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    let along = w > h;
    if (w === h) { const ew = all.filter(([ax, ay]) => land(ax + 1, ay) || land(ax - 1, ay)).length, ns = all.filter(([ax, ay]) => land(ax, ay + 1) || land(ax, ay - 1)).length; along = ew >= ns; }
    for (const [ax, ay] of all) this.axes.set(key(ax, ay), along);
    return along;
  }

  /** A square (and its neighbours) changed. */
  mark(x: number, y: number) {
    // A bridge changing can turn its whole group: re-tile all of it.
    if (this.decorAt(x, y)?.type === 'bridge' || this.axes.has(key(x, y))) {
      for (const k of [...this.axes.keys()]) { const bx = Math.round(k / 134217728), by = k - bx * 134217728; if (Math.max(Math.abs(bx - x), Math.abs(by - y)) <= 30) { this.axes.delete(k); this.dirty.set(k, [bx, by]); } }
    } for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.dirty.set(key(x + dx, y + dy), [x + dx, y + dy]); }

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
        // The whole bridge (every bridge square touching this one) runs one way: along its
        // longer side, or across the river (toward the banks) when it's square.
        const along = this.axisOf(x, y);
        const joined = [[0, -1, N], [1, 0, E], [0, 1, SOUTH], [-1, 0, W]].reduce((m2, [dx, dy, bit]) => (isB(x + dx, y + dy) ? m2 | bit : m2), 0);
        const bank = [[0, -1, N], [1, 0, E], [0, 1, SOUTH], [-1, 0, W]].reduce((m2, [dx, dy, bit]) => (land(x + dx, y + dy) ? m2 | bit : m2), 0);
        // Planks seeded by position along the deck, so side-by-side rows line up as one plank.
        tex = bridgeTile(along, joined, bank, along ? hash(x, 0) : hash(0, y));
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
