// The world's state: terrain (from worldgen), resource nodes (worldgen plus
// runtime changes), pieces, buildings, and the indexes that answer "what's
// here" and "what's near" quickly.
import { ALTAR_REACH, ALTAR_TEND, BUILDINGS, CHUNK, cheb, chunkKey, chunkOf, key, PAVED, REACH, distToRect, type Building, type NodeState, type Piece } from '@owc/shared';
import { resourcesInRect, terrainAt, walkable as terrainWalkable, buildable as terrainBuildable, LandField } from '@owc/worldgen';

/** Numeric chunk key (chunks within ±65536 of the origin, i.e. ±2M squares). */
const cnum = (cx: number, cy: number) => (cx + 65536) * 131072 + (cy + 65536);

const BLOCKING_NODE = { tree: true, rock: true, ore: true, wheat: false } as const;
const TREE_REGROW_MS = 30 * 60_000;
/** Trees this close to a settlement's buildings are cleared over time, and don't grow back. */
export const SETTLED_R = 2;
const WHEAT_REGROW_EVERY_MS = 6_000;

export interface NodeRec extends NodeState {
  /** For depleted trees: when the stump grows back. */
  regrowAt?: number;
  gone?: boolean;
  /** Wheat regrowth accumulator. */
  acc?: number;
  /** A tree felled to clear land (movement.md §9): its stump is dug out instead of regrowing. */
  dig?: boolean;
  /** A planted field filling in (citybuilding.md §5): it fills over this long, then regrows as wheat does. */
  growMs?: number;
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
  /** trafficInChunk results, until a piece walks in that chunk again. */
  private trafficCache = new Map<string, number[]>();
  nextId = 1;
  /**
   * Walkability per chunk, one byte per square (terrain, buildings, blocking nodes;
   * arenas are checked separately). The hottest question in the game: every step
   * of every search asks it, so it must be an array read, not four map lookups
   * and a string (performance.md §4).
   */
  private walkGrid = new Map<number, Uint8Array>();
  /** Chunks whose nodes are loaded, by numeric key. */
  private loaded = new Set<number>();

  /** Changes since the last broadcast. */
  dirtyPieces = new Set<number>();
  /** Pieces that only changed square (a move event usually tells clients; see Net.flushTurn). */
  movedPieces = new Set<number>();
  removedPieces = new Set<number>();
  dirtyBuildings = new Set<number>();
  removedBuildings = new Set<number>();
  dirtyNodes = new Set<number>();

  constructor(seed: number) {
    this.land = new LandField(seed); this.seed = seed; }

  id() { return this.nextId++; }

  // ---------- terrain and nodes ----------

  terrain(x: number, y: number) { return terrainAt(this.seed, x, y); }
  /** The land's rating: the generated map, reshaped by the empires living there (elo.md §3). */
  land: LandField;
  elo(x: number, y: number) { return this.land.at(x, y); }

  ensureChunkNodes(cx: number, cy: number): NodeRec[] {
    const ck = chunkKey(cx, cy);
    let list = this.nodesByChunk.get(ck);
    if (list) return list;
    this.loaded.add(cnum(cx, cy));
    list = [];
    for (const n of resourcesInRect(this.seed, cx * CHUNK, cy * CHUNK, cx * CHUNK + CHUNK - 1, cy * CHUNK + CHUNK - 1)) {
      const k = key(n.x, n.y);
      const rec: NodeRec = this.nodeOverlay.get(k) ?? { x: n.x, y: n.y, kind: n.kind, capacity: n.capacity, remaining: n.capacity };
      this.nodes.set(k, rec);
      list.push(rec);
    }
    // Hoards: runtime nodes, stored only in the overlay.
    for (const k of this.hoardKeys.get(ck) ?? []) {
      const rec = this.nodeOverlay.get(k);
      if (rec && !this.nodes.has(k)) { this.nodes.set(k, rec); list.push(rec); }
    }
    this.nodesByChunk.set(ck, list);
    return list;
  }

  /** Hoard keys by chunk (they're not in worldgen, so the overlay is their only record). */
  private hoardKeys = new Map<string, Set<number>>();
  indexHoard(n: NodeRec) {
    const ck = chunkKey(...chunkOf(n.x, n.y));
    let s = this.hoardKeys.get(ck);
    if (!s) this.hoardKeys.set(ck, (s = new Set()));
    s.add(key(n.x, n.y));
  }

  /**
   * Plant wheat or a tree (citybuilding.md §5): a node that starts empty and grows in (a tree
   * all at once after `growMs`, wheat a little at a time, as wheat regrows).
   */
  addPlanted(x: number, y: number, kind: 'wheat' | 'tree', capacity: number, growAt: number): NodeRec {
    const k = key(x, y);
    const rec: NodeRec = { x, y, kind, capacity, remaining: 0, planted: true, regrowAt: kind === 'tree' ? growAt : undefined };
    this.nodeOverlay.set(k, rec);
    this.indexHoard(rec);
    const ck = chunkKey(...chunkOf(x, y));
    const list = this.nodesByChunk.get(ck);
    if (list) { list.push(rec); this.nodes.set(k, rec); }
    this.dirtyNodes.add(k);
    this.dirtyWalk(x, y);
    return rec;
  }

  /** Leave a hoard (campaign.md §4.2): a rich resource cache at (x, y). */
  addHoard(x: number, y: number, kind: NodeRec['kind'], capacity: number): NodeRec {
    const k = key(x, y);
    const rec: NodeRec = { x, y, kind, capacity, remaining: capacity, hoard: true };
    // It replaces whatever node was there.
    const old = this.nodes.get(k);
    if (old) { old.gone = true; }
    this.nodeOverlay.set(k, rec);
    this.indexHoard(rec);
    const ck = chunkKey(...chunkOf(x, y));
    const list = this.nodesByChunk.get(ck);
    if (list) { const i = list.indexOf(old!); if (i >= 0) list.splice(i, 1); list.push(rec); this.nodes.set(k, rec); }
    this.dirtyNodes.add(k);
    this.dirtyWalk(x, y);
    return rec;
  }

  nodeAt(x: number, y: number): NodeRec | undefined {
    const cx = x >> 5, cy = y >> 5;
    if (!this.loaded.has(cnum(cx, cy))) this.ensureChunkNodes(cx, cy);
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
      if (n.hoard) n.gone = true; // hoards are spent for good
      else if (n.kind === 'tree') n.regrowAt = now + TREE_REGROW_MS;
      else if (n.kind === 'rock' || n.kind === 'ore') n.gone = true;
      this.dirtyWalk(n.x, n.y);
    }
    const k = key(n.x, n.y);
    this.nodeOverlay.set(k, n);
    this.dirtyNodes.add(k);
    return got;
  }

  /** Is a settlement's building (a player's, not a camp or a ruin) within r squares? */
  settledNear(x: number, y: number, r: number) {
    return this.buildingsNear(x, y, r).some((b) => b.owner && b.type !== 'ruin' && b.type !== 'camp');
  }

  /** Regrow trees and wheat (economy.md §1). */
  regrowNodes(now: number, dt: number) {
    for (const [k, n] of this.nodeOverlay) {
      if (n.gone || n.hoard) continue;
      if (n.kind === 'tree' && n.remaining === 0 && n.regrowAt && now >= n.regrowAt) {
        // Inside a settlement the stump is dug out instead: towns open into clearings (visuals.md §10).
        if (!n.planted && (n.dig || this.settledNear(n.x, n.y, SETTLED_R))) { n.gone = true; this.dirtyNodes.add(k); this.dirtyWalk(n.x, n.y); continue; }
        n.remaining = n.capacity; n.regrowAt = undefined; this.dirtyNodes.add(k); this.dirtyWalk(n.x, n.y);
      } else if (n.kind === 'wheat' && n.remaining < n.capacity) {
        // A planted field fills in over its grow time, then regrows like any wheat.
        if (n.growMs) { n.remaining = Math.min(n.capacity, n.remaining + (n.capacity * dt) / n.growMs); if (n.remaining >= n.capacity) n.growMs = undefined; this.dirtyNodes.add(k); continue; }
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
    const cx = x >> 5, cy = y >> 5, c = cnum(cx, cy);
    let grid = this.walkGrid.get(c);
    if (!grid) grid = this.buildWalk(cx, cy, c);
    if (grid[((y & 31) << 5) | (x & 31)] !== 1) return false;
    return !(this.sealed.size && this.sealed.has(key(x, y)));
  }

  /**
   * 1: walkable; 2: a standing tree a war elephant could knock down; 0: blocked.
   * One grid lookup, so planning a troop's road through woods stays fast.
   */
  walkCode(x: number, y: number): number {
    const cx = x >> 5, cy = y >> 5, c = cnum(cx, cy);
    let grid = this.walkGrid.get(c);
    if (!grid) grid = this.buildWalk(cx, cy, c);
    const v = grid[((y & 31) << 5) | (x & 31)];
    return v && this.sealed.size && this.sealed.has(key(x, y)) ? 0 : v;
  }

  private buildWalk(cx: number, cy: number, c: number): Uint8Array {
    this.ensureChunkNodes(cx, cy);
    const grid = new Uint8Array(CHUNK * CHUNK);
    for (let ly = 0; ly < CHUNK; ly++)
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = cx * CHUNK + lx, y = cy * CHUNK + ly, k = key(x, y);
        // Buildings block, except decorations you walk over (bridges carry you over water).
        const bid = this.buildingAt.get(k);
        if (bid != null) { const b = this.buildings.get(bid); if (b && (b.gate || (BUILDINGS as Record<string, { walk?: true } | undefined>)[b.type]?.walk)) grid[(ly << 5) | lx] = 1; continue; }
        if (!terrainWalkable(this.terrain(x, y))) continue;
        const n = this.nodes.get(k);
        if (n && !n.gone && BLOCKING_NODE[n.kind] && n.remaining > 0) { if (n.kind === 'tree') grid[(ly << 5) | lx] = 2; continue; }
        grid[(ly << 5) | lx] = 1;
      }
    if (this.walkGrid.size > 20000) this.walkGrid.clear();
    this.walkGrid.set(c, grid);
    return grid;
  }

  /** A standing tree on open ground at (x, y): a war elephant can knock it down (movement.md §4.3). */
  treeAt(x: number, y: number): boolean { return this.walkCode(x, y) === 2; }

  /** Something that blocks walking changed at (x, y): rebuild that chunk's grid when next asked. */
  dirtyWalk(x: number, y: number) { this.walkGrid.delete(cnum(x >> 5, y >> 5)); }

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
    const t = this.traffic.get(k) ?? 0;
    if (t < PAVED) { this.traffic.set(k, Math.min(255, t + 1)); this.trafficCache.delete(chunkKey(...chunkOf(x, y))); }
    this.movedPieces.add(p.id);
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
    this.movedPieces.delete(id);
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
    for (let dy = 0; dy < b.size; dy++) for (let dx = 0; dx < b.size; dx++) { this.buildingAt.set(key(b.x + dx, b.y + dy), b.id); this.dirtyWalk(b.x + dx, b.y + dy); }
    const ck = chunkKey(...chunkOf(b.x, b.y));
    let s = this.buildingsByChunk.get(ck);
    if (!s) this.buildingsByChunk.set(ck, (s = new Set()));
    s.add(b.id);
    this.dirtyBuildings.add(b.id);
  }

  removeBuilding(id: number) {
    const b = this.buildings.get(id);
    if (!b) return;
    for (let dy = 0; dy < b.size; dy++) for (let dx = 0; dx < b.size; dx++) { this.buildingAt.delete(key(b.x + dx, b.y + dy)); this.dirtyWalk(b.x + dx, b.y + dy); }
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

  /** The bishop tending an altar (economy.md §8): one of its owner's, within ALTAR_TEND. */
  tenderOf(altar: Building): Piece | undefined {
    if (!altar.owner) return undefined;
    return this.piecesNear(altar.x, altar.y, ALTAR_TEND).find((p) => p.owner === altar.owner && p.kind === 'B' && p.state !== 'battle' && cheb(p.x, p.y, altar.x, altar.y) <= ALTAR_TEND);
  }

  /** A tended altar of `owner` whose land (ALTAR_REACH) covers this footprint. */
  altarOver(x: number, y: number, size: number, owner: string): Building | undefined {
    return this.buildingsNear(x, y, ALTAR_REACH + size).find((a) => a.type === 'altar' && a.owner === owner && a.built >= 1
      && distToRect(a.x, a.y, x, y, size) <= ALTAR_REACH && !!this.tenderOf(a));
  }

  /**
   * Memory upkeep (safeguards.md §6): trails fade, fully regrown nodes stop
   * being stored, and cached chunks nobody is near get dropped (they
   * regenerate from the seed plus the stored changes).
   */
  maintain(keep: Set<string>, fadeTrails: boolean) {
    if (fadeTrails) { for (const [k, t] of this.traffic) { if (t >= PAVED) continue; const n = t >> 1; if (n) this.traffic.set(k, n); else this.traffic.delete(k); } this.trafficCache.clear(); }
    if (this.trafficCache.size > 5000) this.trafficCache.clear();
    for (const [k, n] of this.nodeOverlay) if (!n.gone && !n.hoard && n.remaining >= n.capacity && !n.regrowAt) this.nodeOverlay.delete(k);
    if (this.nodesByChunk.size > 8000) {
      for (const ck of [...this.nodesByChunk.keys()]) {
        if (keep.has(ck) || this.piecesByChunk.get(ck)?.size || this.buildingsByChunk.get(ck)?.size) continue;
        for (const n of this.nodesByChunk.get(ck)!) this.nodes.delete(key(n.x, n.y));
        this.nodesByChunk.delete(ck);
        const [cx, cy] = ck.split(',').map(Number);
        this.loaded.delete(cnum(cx, cy));
        this.walkGrid.delete(cnum(cx, cy));
      }
    }
  }

  /** Squares paved (or unpaved) since the last turn went out, flat [x, y, value, ...] (0: unpaved). */
  pavedNow: number[] = [];
  paved(x: number, y: number) { return (this.traffic.get(key(x, y)) ?? 0) >= PAVED; }
  /** Pave a square (movement.md §9): a road that never wears off. */
  pave(x: number, y: number): boolean {
    if (this.paved(x, y) || !this.walkable(x, y)) return false;
    this.traffic.set(key(x, y), PAVED);
    this.trafficCache.delete(chunkKey(...chunkOf(x, y)));
    this.pavedNow.push(x, y, PAVED);
    return true;
  }

  /**
   * A player's street or square (citybuilding.md §4): paved in a style (1 cobble, 2 flagstone,
   * 3 earth; knights' roads are style 0), or unpaved with `null`.
   */
  setPaving(x: number, y: number, style: number | null) {
    const k = key(x, y), v = style == null ? 0 : PAVED + style;
    if ((this.traffic.get(k) ?? 0) === v) return false;
    if (v) this.traffic.set(k, v); else this.traffic.delete(k);
    this.trafficCache.delete(chunkKey(...chunkOf(x, y)));
    this.pavedNow.push(x, y, v);
    return true;
  }

  trafficInChunk(cx: number, cy: number): number[] {
    const ck = chunkKey(cx, cy);
    const hit = this.trafficCache.get(ck);
    if (hit) return hit;
    const out: number[] = [];
    for (let y = 0; y < CHUNK; y++)
      for (let x = 0; x < CHUNK; x++) {
        const t = this.traffic.get(key(cx * CHUNK + x, cy * CHUNK + y));
        if (t) out.push(y * CHUNK + x, t);
      }
    this.trafficCache.set(ck, out);
    return out;
  }
}
