// City building (docs/specs/citybuilding.md): decorations drawn by players (walls, fences,
// hedges, flowerbeds, bridges, lamps, statues, taverns...), streets and squares painted by
// hand, planting fields and saplings, and moving or demolishing buildings. Nothing here is
// an inventory: decorations cost a little wood or stone from nearby nodes, like buildings;
// demolishing leaves salvage piles (hoards); planting grows ordinary nodes.
import {
  BUILDING_MAX_HP, BUILDINGS, BUILD_SPACING, DECOR_BASE, DECOR_CAP, DECOR_CLEAR_R, DECOR_PER_BUILDING, PLANT_FIELD_COST, PLANT_FIELD_MS, PLANT_TREE_MS,
  PAVED, REACH, TROOP_CITY_R, cheb, distToRect, isDecor, key,
  type Building, type BuildingType, type DecorType, type NodeKind,
} from '@owc/shared';
import type { Game } from './game.ts';

/** Decorations draw on piles this far away (anywhere in a town). */
const PILE_REACH = 24;
/** Paving styles a player can lay (1 cobble, 2 flagstone, 3 earth); knights' roads are 0. */
export const PAVING_STYLES = [1, 2, 3];
/** Line decorations a street turns into a gate where it crosses. */
const GATEABLE: string[] = ['wall', 'fence', 'hedge'];
/** What a fresh planted node holds once grown (about a wild one's). */
const PLANT_CAPACITY = { wheat: 60, tree: 100 } as const;

const NAME: Record<string, string> = { tree: 'wood', rock: 'stone', wheat: 'crops', ore: 'ore' };

/** One undoable stroke: what it built, the paving it changed, and what it drew from (citybuilding.md §8). */
interface Act { sid: number; buildings: number[]; planted: number[]; paving: [number, number, number][]; draws: [number, number][] }
const UNDO_DEPTH = 20;

export class CityBuild {
  private game: Game;
  constructor(game: Game) { this.game = game; }
  /** Each player's recent strokes, newest last. */
  private history = new Map<string, Act[]>();
  /** The stroke being recorded (set around each request). */
  private act: Act | null = null;

  /** Record what a request does under stroke `sid` (requests of one stroke merge). */
  begin(owner: string, sid?: number) {
    const h = this.history.get(owner) ?? [];
    const last = h.at(-1);
    if (sid != null && last?.sid === sid) { this.act = last; return; }
    this.act = { sid: sid ?? -Math.random(), buildings: [], planted: [], paving: [], draws: [] };
    h.push(this.act);
    if (h.length > UNDO_DEPTH) h.shift();
    this.history.set(owner, h);
  }
  end(owner: string) {
    const h = this.history.get(owner);
    const a = this.act;
    this.act = null;
    if (h && a && !a.buildings.length && !a.planted.length && !a.paving.length && !a.draws.length && h.at(-1) === a) h.pop();
  }

  /** Undo the player's last stroke: remove what it built, restore the paving, give back what it cost. */
  undo(owner: string): string | null {
    const w = this.w, h = this.history.get(owner);
    const a = h?.pop();
    if (!a) return 'Nothing to undo';
    for (const id of a.buildings) { const b = w.buildings.get(id); if (b && b.owner === owner) w.removeBuilding(id); }
    for (const k of a.planted) { const n = w.nodeOverlay.get(k); if (n?.planted && !n.gone) { n.gone = true; w.dirtyNodes.add(k); w.dirtyWalk(n.x, n.y); } }
    for (const [x, y, prev] of a.paving.reverse()) {
      const k = key(x, y);
      if (prev) w.traffic.set(k, prev); else w.traffic.delete(k);
      w.pavedNow.push(x, y, prev >= PAVED ? prev : 0);
      const bid = w.buildingIdAt(x, y), b = bid != null ? w.buildings.get(bid) : undefined;
      if (b?.gate && prev < PAVED) { b.gate = undefined; w.dirtyBuildings.add(b.id); w.dirtyWalk(x, y); }
    }
    for (const [k, amt] of a.draws) {
      const n = w.nodeOverlay.get(k);
      if (!n) continue;
      n.remaining = Math.min(n.capacity, n.remaining + amt);
      if (n.remaining > 0) { n.gone = false; n.regrowAt = undefined; n.dig = undefined; }
      w.dirtyNodes.add(k); w.dirtyWalk(n.x, n.y);
    }
    return null;
  }
  private get w() { return this.game.world; }

  /** A real building (not a decoration, ruin or camp) of the owner's. */
  private real(b: Building, owner: string) { return b.owner === owner && b.type !== 'ruin' && b.type !== 'camp' && !isDecor(b.type); }

  /** Inside one of the owner's towns: near one of their real buildings. */
  ownGround(owner: string, x: number, y: number) {
    return this.w.buildingsNear(x, y, TROOP_CITY_R).some((b) => this.real(b, owner) && distToRect(x, y, b.x, b.y, b.size) <= TROOP_CITY_R);
  }

  /** In reach of one of the owner's kings (decorations, like buildings, go near a king). */
  private inReach(owner: string, x: number, y: number, size = 1) {
    return this.game.kingsOf(owner).some((k) => k.state !== 'battle' && distToRect(k.x, k.y, x, y, size) <= REACH);
  }

  decorCount(owner: string) {
    let n = 0;
    for (const b of this.w.buildings.values()) if (b.owner === owner && isDecor(b.type)) n++;
    for (const nd of this.planted(owner)) void nd, n++;
    return n;
  }

  /** How many decorations the owner may hold (citybuilding.md §7). */
  decorBudget(owner: string) {
    let real = 0;
    for (const b of this.w.buildings.values()) if (this.real(b, owner)) real++;
    return Math.min(DECOR_CAP, DECOR_BASE + DECOR_PER_BUILDING * real);
  }

  /** Planted nodes in the owner's towns (they count toward the decor budget while they live). */
  private planted(owner: string) {
    const out: { x: number; y: number }[] = [];
    for (const n of this.w.nodeOverlay.values()) if (n.planted && !n.gone && this.ownGround(owner, n.x, n.y)) out.push(n);
    return out;
  }

  /** Take a cost from nodes near (x, y), nearest first; an error if there isn't enough. */
  private pay(cost: Partial<Record<NodeKind, number>>, x: number, y: number, size = 1): string | null {
    const w = this.w;
    // Anything within reach, and piles (hauled stone, salvage, hoards) anywhere in town: one
    // pile in the middle can build a wall all the way around (citybuilding.md §6).
    const near = w.nodesNear(x, y, size, REACH);
    const piles = w.nodesNear(x, y, size, PILE_REACH).filter((n) => n.hoard && distToRect(n.x, n.y, x, y, size) > REACH);
    const pool = [...near, ...piles].sort((a, b) => distToRect(a.x, a.y, x, y, size) - distToRect(b.x, b.y, x, y, size));
    for (const [kind, amt] of Object.entries(cost) as [NodeKind, number][]) {
      const have = pool.filter((n) => n.kind === kind).reduce((s, n) => s + n.remaining, 0);
      if (have < amt) return kind === 'rock'
        ? `Needs ${amt} stone nearby: have your war elephants haul some into town (a pile anywhere in town will do)`
        : `Needs ${amt} ${NAME[kind]} nearby (or a pile of it anywhere in town)`;
    }
    for (const [kind, amt] of Object.entries(cost) as [NodeKind, number][]) {
      let need = amt;
      for (const n of pool) if (need > 0 && n.kind === kind) { const got = w.drawNode(n, need, this.game.now); need -= got; if (got) this.act?.draws.push([key(n.x, n.y), got]); }
    }
    return null;
  }

  /** Can a decoration of `type` go at (x, y)? (Not checking its cost.) `pending`: squares being placed in this stroke. */
  private decorSpot(owner: string, type: DecorType, x: number, y: number, pending: Set<number>): string | null {
    const w = this.w, spec = BUILDINGS[type], size = spec.size;
    if (!this.inReach(owner, x, y, size)) return 'Decorations go within 10 squares of one of your kings';
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const sx = x + dx, sy = y + dy, t = w.terrain(sx, sy);
      if (spec.onWater) { if (t !== 'water') return 'Bridges go across water'; }
      else if (!w.buildable(sx, sy)) return t === 'water' ? 'Not on water (paint a street across it for a bridge)' : 'Not on mountains';
      if (w.buildingIdAt(sx, sy) != null) return 'Something is already there';
      const n = w.nodeAt(sx, sy);
      if (n && !n.gone && n.remaining > 0) return 'A tree or rock is in the way';
      const pid = w.pieceIdAt(sx, sy);
      if (pid != null && !spec.walk && w.pieces.get(pid)?.owner !== owner) return 'Someone is standing there';
    }
    // A bridge reaches out from land, or from another bridge.
    if (spec.onWater) {
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy, bid = w.buildingIdAt(nx, ny);
        return pending.has(key(nx, ny)) || (bid != null && w.buildings.get(bid)?.type === 'bridge') || (w.terrain(nx, ny) !== 'water' && w.terrain(nx, ny) !== 'mountain');
      });
      if (!touches) return 'A bridge starts from the bank, or from another bridge';
    }
    if (w.buildingsNear(x, y, BUILD_SPACING + size).some((b) => b.owner && b.owner !== owner && b.type !== 'ruin' && distToRect(x, y, b.x, b.y, b.size) <= BUILD_SPACING + size - 1))
      return 'Too close to another player';
    return null;
  }

  /**
   * Place decorations along a stroke (one square for a lamp, a line for a wall). Stops at the
   * first square that can't take one, keeping what was placed. Returns how many and why it stopped.
   */
  placeDecor(owner: string, type: DecorType, cells: [number, number][]): { placed: number; err: string | null } {
    const spec = BUILDINGS[type];
    if (!spec?.decor) return { placed: 0, err: 'Not a decoration' };
    const pending = new Set<number>();
    let placed = 0, have = this.decorCount(owner);
    const budget = this.decorBudget(owner);
    for (const [x, y] of cells) {
      if (have >= budget) return { placed, err: `You can place ${budget} decorations (more as your towns grow)` };
      const bad = this.decorSpot(owner, type, x, y, pending);
      if (bad) { if (cells.length === 1 || !placed) return { placed, err: bad }; continue; }
      const err = this.pay(spec.cost, x, y, spec.size);
      if (err) return { placed, err };
      // Drawn across a street, a wall (fence, hedge) is a gate there.
      const gate = GATEABLE.includes(type) && this.w.paved(x, y) ? true : undefined;
      const nb = { id: this.w.id(), owner, type, x, y, size: spec.size, hp: BUILDING_MAX_HP, built: 0, prod: 0, blocked: 'building' as const, gate };
      this.w.addBuilding(nb);
      this.act?.buildings.push(nb.id);
      pending.add(key(x, y));
      placed++; have++;
    }
    return { placed, err: null };
  }

  /** Remove the owner's decorations (and planted squares) on these squares. Free, no refund. */
  erase(owner: string, cells: [number, number][]): number {
    const w = this.w;
    let n = 0;
    for (const [x, y] of cells) {
      const bid = w.buildingIdAt(x, y), b = bid != null ? w.buildings.get(bid) : undefined;
      if (b && b.owner === owner && isDecor(b.type)) { w.removeBuilding(b.id); n++; continue; }
      const nd = w.nodeAt(x, y);
      if (nd?.planted && !nd.gone && this.ownGround(owner, x, y)) { nd.gone = true; w.nodeOverlay.set(key(x, y), nd); w.dirtyNodes.add(key(x, y)); w.dirtyWalk(x, y); n++; }
    }
    return n;
  }

  /**
   * Lay (or erase) streets and squares on the owner's own town ground. A street across a wall,
   * fence or hedge of theirs turns that square into a gate.
   */
  paintPaving(owner: string, cells: [number, number][], style: number | null): { done: number; err: string | null } {
    const w = this.w;
    if (style != null && !PAVING_STYLES.includes(style)) return { done: 0, err: 'Unknown paving' };
    let done = 0, err: string | null = null;
    for (const [x, y] of cells) {
      if (!this.ownGround(owner, x, y)) { err = 'Streets go inside your own towns'; continue; }
      const bid = w.buildingIdAt(x, y), b = bid != null ? w.buildings.get(bid) : undefined;
      if (b && !(b.owner === owner && GATEABLE.includes(b.type))) { if (style != null) continue; }
      if (style != null && !w.buildable(x, y)) continue;
      const prev = w.traffic.get(key(x, y)) ?? 0;
      if (w.setPaving(x, y, style)) { done++; this.act?.paving.push([x, y, prev]); }
      // A street through a wall is a gate (walkable); without the street it's a wall again.
      if (b && GATEABLE.includes(b.type) && b.owner === owner) {
        const gate = style != null || undefined;
        if (b.gate !== gate) { b.gate = gate; w.dirtyBuildings.add(b.id); w.dirtyWalk(x, y); }
      }
    }
    return { done, err: done ? null : err };
  }

  /** Plant wheat fields or saplings on empty land in the owner's towns (citybuilding.md §5). */
  plant(owner: string, kind: 'wheat' | 'tree', cells: [number, number][]): { placed: number; err: string | null } {
    const w = this.w;
    let placed = 0, have = this.decorCount(owner);
    const budget = this.decorBudget(owner);
    for (const [x, y] of cells) {
      if (have >= budget) return { placed, err: `You can place ${budget} decorations and plantings (more as your towns grow)` };
      if (!this.inReach(owner, x, y)) { if (!placed) return { placed, err: 'Plant within 10 squares of one of your kings' }; continue; }
      if (!w.buildable(x, y) || w.buildingIdAt(x, y) != null) continue;
      const n = w.nodeAt(x, y);
      if (n && !n.gone && (n.remaining > 0 || n.regrowAt)) continue;
      if (kind === 'wheat') { const e = this.pay({ tree: PLANT_FIELD_COST }, x, y); if (e) return { placed, err: e }; }
      w.addPlanted(x, y, kind, PLANT_CAPACITY[kind], this.game.now + (kind === 'tree' ? PLANT_TREE_MS : 0));
      this.act?.planted.push(key(x, y));
      if (kind === 'wheat') { const rec = w.nodeAt(x, y)!; rec.acc = 0; rec.growMs = PLANT_FIELD_MS; }
      placed++; have++;
    }
    return { placed, err: placed ? null : 'Nowhere to plant there (it needs empty land)' };
  }

  /** A battle is being fought at this town right now (no moving or demolishing then). */
  private underAttack(b: Building) {
    return [...this.game.battles.recs.values()].some((r) => r.pub.phase !== 'over' && cheb(r.defenderAt[0], r.defenderAt[1], b.x, b.y) <= 14);
  }

  /**
   * Move a building (citybuilding.md §3): same placement rules at the new spot; it's rebuilt
   * there for free, out of action while it rises again.
   */
  move(owner: string, id: number, at: [number, number]): string | null {
    const w = this.w, b = w.buildings.get(id);
    if (!b || b.owner !== owner || b.type === 'ruin' || b.type === 'camp') return 'Not your building';
    if (b.type === 'altar' || b.type === 'wonder') return b.type === 'altar' ? 'An altar stays where its bishop raised it' : 'The Wonder stands where it was raised';
    if (this.underAttack(b)) return 'Not while this town is under attack';
    const [x, y] = at, size = b.size;
    if (x === b.x && y === b.y) return null;
    // Check the new spot as if the building weren't where it is now.
    const old = { x: b.x, y: b.y };
    w.removeBuilding(b.id);
    const err = this.spotFor(owner, b.type, x, y, size);
    if (err) { w.addBuilding(b); w.removedBuildings.delete(b.id); return err; }
    Object.assign(b, { x, y });
    if (!isDecor(b.type)) { b.built = 0; b.prod = 0; b.blocked = 'building'; b.bubbles = undefined; }
    w.addBuilding(b);
    w.removedBuildings.delete(b.id);
    void old;
    return null;
  }

  /** Placement rules for moving a building (reach, ground, room; no cost). */
  private spotFor(owner: string, type: BuildingType, x: number, y: number, size: number): string | null {
    const w = this.w;
    if (isDecor(type)) return this.decorSpot(owner, type as DecorType, x, y, new Set());
    if (!this.inReach(owner, x, y, size) && !w.altarOver(x, y, size, owner)) return 'Buildings go within 10 squares of one of your kings';
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const sx = x + dx, sy = y + dy;
      if (!w.buildable(sx, sy)) return w.terrain(sx, sy) === 'water' ? "Can't build on water" : "Can't build on mountains";
      if (w.buildingIdAt(sx, sy) != null) return 'Something is already there';
      const n = w.nodeAt(sx, sy);
      if (n && !n.gone && n.remaining > 0 && n.kind !== 'wheat') return 'Clear the resources first';
    }
    if (w.buildingsNear(x, y, BUILD_SPACING + size).some((o) => o.owner && o.owner !== owner && o.type !== 'ruin' && distToRect(x, y, o.x, o.y, o.size) <= BUILD_SPACING + size - 1))
      return 'Too close to another player';
    return null;
  }

  /**
   * Demolish a building (citybuilding.md §3): it's gone, and half its cost is left beside the
   * spot as wood and stone piles, ready to build with nearby.
   */
  demolish(owner: string, id: number): string | null {
    const w = this.w, b = w.buildings.get(id);
    if (!b || b.owner !== owner || b.type === 'ruin' || b.type === 'camp') return 'Not your building';
    if (b.type === 'altar' || b.type === 'wonder') return b.type === 'altar' ? 'An altar falls only when its bishop leaves it' : 'The Wonder cannot be torn down';
    if (this.underAttack(b)) return 'Not while this town is under attack';
    const spec = BUILDINGS[b.type];
    w.removeBuilding(b.id);
    // Salvage: half the cost, in piles on the cleared footprint (or beside it).
    if (!isDecor(b.type)) for (const [kind, amt] of Object.entries(spec.cost) as [NodeKind, number][]) {
      const half = Math.floor(amt / 2);
      if (half < 5 || (kind !== 'tree' && kind !== 'rock')) continue;
      const at = w.nearestFree(b.x + (kind === 'tree' ? 0 : b.size - 1), b.y + b.size - 1, 4, (x, y) => !w.nodeAt(x, y) && w.buildingIdAt(x, y) == null && w.buildable(x, y));
      if (at) w.addHoard(at[0], at[1], kind, half);
    }
    return null;
  }

  /** Every so often: clear decorations whose owner fell or that no real building of theirs is near. */
  sweep() {
    const w = this.w;
    for (const b of [...w.buildings.values()]) {
      if (!isDecor(b.type)) continue;
      const lone = !b.owner || !this.game.players.has(b.owner)
        || !w.buildingsNear(b.x, b.y, DECOR_CLEAR_R).some((o) => this.real(o, b.owner!) && distToRect(b.x, b.y, o.x, o.y, o.size) <= DECOR_CLEAR_R);
      if (lone) w.removeBuilding(b.id);
    }
  }
}
