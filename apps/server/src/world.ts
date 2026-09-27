// The world's state: terrain (from worldgen), resource nodes (worldgen plus
// runtime changes), pieces, buildings, and the indexes that answer "what's
// here" and "what's near" quickly.
import { CHUNK, chunkKey, chunkOf, key, REACH, distToRect, type Building, type NodeState, type Piece } from '@owc/shared';
import { resourcesInRect, terrainAt, walkable as terrainWalkable, buildable as terrainBuildable, eloAt } from '@owc/worldgen';

const BLOCKING_NODE = { tree: true, rock: true, gold: true, wheat: false } as const;
const TREE_REGROW_MS = 30 * 60_000;
const WHEAT_REGROW_EVERY_MS = 6_000;

export interface NodeRec extends NodeState {
  /** For depleted trees: when the stump grows back. */
  regrowAt?: number;
  gone?: boolean;
  /** Wheat regrowth accumulator. */
  acc?: number;
}

export class World {
  readonly seed: number;
  pieces = new Map<number, Piece>();
  buildings = new Map<number, Building>();
  private pieceAt = new Map<number, number>();
  private buildingAt = new Map<number, number>();
  private piecesByChunk = new Map<string, Set<number>>();
  private buildingsByChunk = new Map<string, Set<number>>();
  /** Nodes of every chunk loaded so far (worldgen + changes). */
  private nodes = new Map<number, NodeRec>();
  private nodesByChunk = new Map<string, NodeRec[]>();
  /** Changes to nodes that must survive restarts, keyed by square. */
  nodeOverlay = new Map<number, NodeRec>();
  /** Squares sealed by a live battle arena → battle id. */
  sealed = new Map<number, number>();
  /** Walking traffic per square (desire paths, visuals.md §4). */
  traffic = new Map<number, number>();
  nextId = 1;

  /** Changes since the last broadcast. */
  dirtyPieces = new Set<number>();
  removedPieces = new Set<number>();
  dirtyBuildings = new Set<number>();
  removedBuildings = new Set<number>();
  dirtyNodes = new Set<number>();

  constructor(seed: number) { this.seed = seed; }

  id() { return this.nextId++; }

  // ---------- terrain and nodes ----------

  terrain(x: number, y: number) { return terrainAt(this.seed, x, y); }
  elo(x: number, y: number) { return eloAt(this.seed, x, y); }

  ensureChunkNodes(cx: number, cy: number): NodeRec[] {
    const ck = chunkKey(cx, cy);
    let list = this.nodesByChunk.get(ck);
    if (list) return list;
    list = [];
    for (const n of resourcesInRect(this.seed, cx * CHUNK, cy * CHUNK, cx * CHUNK + CHUNK - 1, cy * CHUNK + CHUNK - 1)) {
      const k = key(n.x, n.y);
      const rec: NodeRec = this.nodeOverlay.get(k) ?? { x: n.x, y: n.y, kind: n.kind, capacity: n.capacity, remaining: n.capacity };
      this.nodes.set(k, rec);
      list.push(rec);
    }
    this.nodesByChunk.set(ck, list);
    return list;
  }

  nodeAt(x: number, y: number): NodeRec | undefined {
    const [cx, cy] = chunkOf(x, y);
    this.ensureChunkNodes(cx, cy);
    const n = this.nodes.get(key(x, y));
    return n && !n.gone ? n : undefined;
  }

  nodesInChunk(cx: number, cy: number) { return this.ensureChunkNodes(cx, cy).filter((n) => !n.gone); }

  /** Nodes within Chebyshev distance `r` of a rectangle (x, y, size). */
  nodesNear(x: number, y: number, size: number, r: number): NodeRec[] {
    const out: NodeRec[] = [];
    const [c0x, c0y] = chunkOf(x - r, y - r), [c1x, c1y] = chunkOf(x + size - 1 + r, y + size - 1 + r);
    for (let cy = c0y; cy <= c1y; cy++)
      for (let cx = c0x; cx <= c1x; cx++)
        for (const n of this.ensureChunkNodes(cx, cy)) if (!n.gone && distToRect(n.x, n.y, x, y, size) <= r) out.push(n);
    return out;
  }

  /** Take up to `amount` from a node. Returns how much was taken. */
  drawNode(n: NodeRec, amount: number, now: number): number {
    const got = Math.min(amount, n.remaining);
    n.remaining -= got;
    if (n.remaining <= 0) {
      n.remaining = 0;
      if (n.kind === 'tree') n.regrowAt = now + TREE_REGROW_MS;
      else if (n.kind === 'rock' || n.kind === 'gold') n.gone = true;
    }
    const k = key(n.x, n.y);
    this.nodeOverlay.set(k, n);
    this.dirtyNodes.add(k);
    return got;
  }

  /** Regrow trees and wheat (economy.md §1). */
  regrowNodes(now: number, dt: number) {
    for (const [k, n] of this.nodeOverlay) {
      if (n.gone) continue;
      if (n.kind === 'tree' && n.remaining === 0 && n.regrowAt && now >= n.regrowAt) {
        n.remaining = n.capacity; n.regrowAt = undefined; this.dirtyNodes.add(k);
      } else if (n.kind === 'wheat' && n.remaining < n.capacity) {
        n.acc = (n.acc ?? 0) + dt;
        if (n.acc >= WHEAT_REGROW_EVERY_MS) {
          const inc = Math.floor(n.acc / WHEAT_REGROW_EVERY_MS);
          n.acc -= inc * WHEAT_REGROW_EVERY_MS;
          n.remaining = Math.min(n.capacity, n.remaining + inc);
          this.dirtyNodes.add(k);
        }
      }
    }
  }

  nodeRecByKey(k: number) { return this.nodes.get(k); }

  // ---------- occupancy ----------

  /** Terrain, buildings, blocking nodes and sealed arenas (ignores pieces). */
  walkable(x: number, y: number): boolean {
    if (!terrainWalkable(this.terrain(x, y))) return false;
    const k = key(x, y);
    if (this.buildingAt.has(k) || this.sealed.has(k)) return false;
    const n = this.nodeAt(x, y);
    if (n && BLOCKING_NODE[n.kind] && n.remaining > 0) return false;
    return true;
  }

  buildable(x: number, y: number) { return terrainBuildable(this.terrain(x, y)); }

  pieceIdAt(x: number, y: number) { return this.pieceAt.get(key(x, y)); }
  buildingIdAt(x: number, y: number) { return this.buildingAt.get(key(x, y)); }

  free(x: number, y: number, self?: number): boolean {
    const p = this.pieceAt.get(key(x, y));
    return (p === undefined || p === self) && this.walkable(x, y);
  }

  // ---------- pieces ----------

  addPiece(p: Piece) {
    this.pieces.set(p.id, p);
    if (p.state !== 'battle') this.placeIndex(p);
    this.dirtyPieces.add(p.id);
    this.removedPieces.delete(p.id);
  }

  private placeIndex(p: Piece) {
    this.pieceAt.set(key(p.x, p.y), p.id);
    const ck = chunkKey(...chunkOf(p.x, p.y));
    let s = this.piecesByChunk.get(ck);
    if (!s) this.piecesByChunk.set(ck, (s = new Set()));
    s.add(p.id);
  }

  private unindex(p: Piece) {
    const k = key(p.x, p.y);
    if (this.pieceAt.get(k) === p.id) this.pieceAt.delete(k);
    this.piecesByChunk.get(chunkKey(...chunkOf(p.x, p.y)))?.delete(p.id);
  }

  movePiece(p: Piece, x: number, y: number) {
    this.unindex(p);
    p.x = x; p.y = y;
    this.placeIndex(p);
    const k = key(x, y);
    this.traffic.set(k, Math.min(255, (this.traffic.get(k) ?? 0) + 1));
    this.dirtyPieces.add(p.id);
  }

  /** Take a piece off the board (into a battle arena); it keeps its record. */
  liftPiece(p: Piece) { this.unindex(p); this.dirtyPieces.add(p.id); }
  /** Put a lifted piece back at (x, y). */
  dropPiece(p: Piece, x: number, y: number) { p.x = x; p.y = y; this.placeIndex(p); this.dirtyPieces.add(p.id); }

  removePiece(id: number) {
    const p = this.pieces.get(id);
    if (!p) return;
    this.unindex(p);
    this.pieces.delete(id);
    this.dirtyPieces.delete(id);
    this.removedPieces.add(id);
  }

  touch(p: Piece) { this.dirtyPieces.add(p.id); }

  piecesInChunk(cx: number, cy: number): Piece[] {
    const s = this.piecesByChunk.get(chunkKey(cx, cy));
    return s ? [...s].map((id) => this.pieces.get(id)!).filter(Boolean) : [];
  }

  /** Pieces within Chebyshev distance r of (x, y). */
  piecesNear(x: number, y: number, r: number): Piece[] {
    const out: Piece[] = [];
    const [c0x, c0y] = chunkOf(x - r, y - r), [c1x, c1y] = chunkOf(x + r, y + r);
    for (let cy = c0y; cy <= c1y; cy++)
      for (let cx = c0x; cx <= c1x; cx++)
        for (const p of this.piecesInChunk(cx, cy)) if (Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= r) out.push(p);
    return out;
  }

  /** Nearest free walkable square to (x, y), searching outward. */
  nearestFree(x: number, y: number, maxR = 12, pred?: (x: number, y: number) => boolean): [number, number] | null {
    for (let r = 0; r <= maxR; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = x + dx, ny = y + dy;
          if (this.free(nx, ny) && (!pred || pred(nx, ny))) return [nx, ny];
        }
    return null;
  }

  // ---------- buildings ----------

  addBuilding(b: Building) {
    this.buildings.set(b.id, b);
    for (let dy = 0; dy < b.size; dy++) for (let dx = 0; dx < b.size; dx++) this.buildingAt.set(key(b.x + dx, b.y + dy), b.id);
    const ck = chunkKey(...chunkOf(b.x, b.y));
    let s = this.buildingsByChunk.get(ck);
    if (!s) this.buildingsByChunk.set(ck, (s = new Set()));
    s.add(b.id);
    this.dirtyBuildings.add(b.id);
  }

  removeBuilding(id: number) {
    const b = this.buildings.get(id);
    if (!b) return;
    for (let dy = 0; dy < b.size; dy++) for (let dx = 0; dx < b.size; dx++) this.buildingAt.delete(key(b.x + dx, b.y + dy));
    this.buildingsByChunk.get(chunkKey(...chunkOf(b.x, b.y)))?.delete(id);
    this.buildings.delete(id);
    this.removedBuildings.add(id);
  }

  buildingsInChunk(cx: number, cy: number): Building[] {
    const s = this.buildingsByChunk.get(chunkKey(cx, cy));
    return s ? [...s].map((id) => this.buildings.get(id)!).filter(Boolean) : [];
  }

  buildingsNear(x: number, y: number, r: number): Building[] {
    const out: Building[] = [];
    const [c0x, c0y] = chunkOf(x - r - 3, y - r - 3), [c1x, c1y] = chunkOf(x + r, y + r);
    for (let cy = c0y; cy <= c1y; cy++)
      for (let cx = c0x; cx <= c1x; cx++)
        for (const b of this.buildingsInChunk(cx, cy)) if (distToRect(x, y, b.x, b.y, b.size) <= r) out.push(b);
    return out;
  }

  /** Kings of `owner` within reach of the rectangle. */
  anchorsOf(b: { x: number; y: number; size: number }, owner: string): Piece[] {
    return this.piecesNear(b.x + (b.size >> 1), b.y + (b.size >> 1), REACH + b.size).filter(
      (p) => p.owner === owner && p.kind === 'K' && p.state !== 'battle' && distToRect(p.x, p.y, b.x, b.y, b.size) <= REACH,
    );
  }

  /**
   * Memory upkeep (safeguards.md §6): trails fade, fully regrown nodes stop
   * being stored, and cached chunks nobody is near get dropped (they
   * regenerate from the seed plus the stored changes).
   */
  maintain(keep: Set<string>, fadeTrails: boolean) {
    if (fadeTrails) for (const [k, t] of this.traffic) { const n = t >> 1; if (n) this.traffic.set(k, n); else this.traffic.delete(k); }
    for (const [k, n] of this.nodeOverlay) if (!n.gone && n.remaining >= n.capacity && !n.regrowAt) this.nodeOverlay.delete(k);
    if (this.nodesByChunk.size > 3000) {
      for (const ck of [...this.nodesByChunk.keys()]) {
        if (keep.has(ck) || this.piecesByChunk.get(ck)?.size || this.buildingsByChunk.get(ck)?.size) continue;
        for (const n of this.nodesByChunk.get(ck)!) this.nodes.delete(key(n.x, n.y));
        this.nodesByChunk.delete(ck);
      }
    }
  }

  trafficInChunk(cx: number, cy: number): number[] {
    const out: number[] = [];
    for (let y = 0; y < CHUNK; y++)
      for (let x = 0; x < CHUNK; x++) {
        const t = this.traffic.get(key(cx * CHUNK + x, cy * CHUNK + y));
        if (t) out.push(y * CHUNK + x, t);
      }
    return out;
  }
}
