// The wilds (docs/specs/wilds.md): camps of creatures between the cities.
//
// Each camp is an NPC "player" (isBot, with `wild` set). Camps use the same rules
// as everyone: kings lead, reach is 10, battles are real chess with the AI playing
// the camp at its rating. What's special lives here:
// - Sites are deterministic (a jittered grid, like resource clusters), and the
//   faction depends on the biome, the area rating and rarity. More of a cell's
//   sites fill in the longer players have been around it.
// - A camp is awake (a building and pieces in the world, roaming, raiding) only
//   while someone is viewing its area. Otherwise it sleeps: just a record of its
//   faction, its spot and its roster, which keeps growing. Nobody pays for the
//   movement of creatures nobody can see.
// - They grow from a king and a pawn toward a full set: faster the more players
//   build nearby, and bigger near stronger players. Their rating climbs to the
//   area's rating as they grow.
// - Hordes and lairs attack online players' troops in the field (never an
//   Emperor, never a settlement); herds never attack.
// - Beating a camp's king scatters the camp and clears the land for a while.
import { CHUNK, FACTIONS, GROWTH_ORDER, RARITY_WEIGHT, REACH, chunkKey, cheb, distToRect, type Faction, type Piece, type PieceKind } from '@owc/shared';
import { bestGaitMove } from '@owc/rules';
import { biomeAt, hash, hash01, resourcesInRect, rng, terrainAt, walkable as terrainWalkable } from '@owc/worldgen';
import { randomBytes } from 'node:crypto';
import type { Game, PlayerRec } from './game.ts';

/** One potential camp per cell of this many squares. */
export const CAMP_CELL = 56;
/** Share of cells with a camp when players first arrive, rising to the most after CELL_FILL_MS. */
const CELL_CHANCE = 0.45;
const CELL_CHANCE_MAX = 0.8;
const CELL_FILL_MS = 6 * 60 * 60_000;
/** Camps appear within this distance of a player's king... */
const SPAWN_NEAR = 220;
/** ...and are forgotten after this long with no player king within FADE_FAR. */
const FADE_FAR = 360;
const FADE_MS = 2 * 60 * 60_000;
/** A camp nobody has viewed for this long goes to sleep. */
const SLEEP_AFTER_MS = 60_000;
/** Never closer than this to a player's building, or this to a player's piece, when appearing. */
const CLEAR_OF_BUILDINGS = 36;
const CLEAR_OF_PIECES = 18;
/** A new piece joins a growing camp this often (divided by game speed). */
const GROW_MS = 4 * 60_000;
/** A scattered camp's site stays empty this long. */
const CLEARED_MS = 3 * 60 * 60_000;
const ATTACK_EVERY_MS = 4 * 60_000;
/** Sleeping camps cost almost nothing; this bounds memory. */
const MAX_CAMPS = 2000;

export interface CampInfo {
  faction: string;
  cell: string;
  /** Camp building's top-left square. */
  x: number;
  y: number;
  /** The camp's building while awake (0 while asleep). */
  buildingId: number;
  bornAt: number;
  grewAt: number;
  lastNear: number;
  lastAttack?: number;
  /** The area rating the camp grows toward. */
  areaElo: number;
  /** In the world (someone is viewing it) or only this record. */
  awake?: boolean;
  /** Its pieces while asleep (kinds; the king first). */
  roster?: PieceKind[];
  /** Last time someone was viewing its area. */
  lastViewed?: number;
}

export interface Site { faction: Faction; x: number; y: number; cell: string; biome: string; roll: number }

/** Where a camp's creatures wander from home (squares). */
const ROAM: Record<Faction['temper'], number> = { herd: 14, lair: 7, horde: 16 };
/** How close a king must come before a camp attacks it. */
const AGGRO: Record<Faction['temper'], number> = { herd: 0, lair: 8, horde: 13 };

/** The first n kinds of the growth order: a camp of that size. */
const rosterOf = (n: number): PieceKind[] => GROWTH_ORDER.slice(0, Math.max(2, Math.min(16, n)));

export class Wilds {
  game: Game;
  enabled = true;
  /** Cell → time its site may hold a camp again. */
  cleared = new Map<string, number>();
  /** Cell → when players were first near it (camps fill in over time). */
  cellSeen = new Map<string, number>();
  /** Chunks someone is viewing (set by the network layer). Unset: everything counts as viewed (tests). */
  viewed: (() => Set<string>) | null = null;
  private sites = new Map<string, Site | null>();
  private lastTick = 0;
  /** Camps changed: tell clients (at most once per tick; the player list is big). */
  private dirty = false;
  private roamBudget = 0;
  constructor(game: Game) { this.game = game; }

  get w() { return this.game.world; }

  camps(): PlayerRec[] { return [...this.game.players.values()].filter((p) => p.wild); }
  awake(): PlayerRec[] { return this.camps().filter((c) => c.wild!.awake !== false); }
  campOf(owner: string | null | undefined): PlayerRec | undefined {
    const p = owner ? this.game.players.get(owner) : undefined;
    return p?.wild ? p : undefined;
  }

  /** Which faction would live at a grid cell's site, and where its camp stands. */
  site(i: number, j: number): Site | null {
    const cell = `${i},${j}`;
    if (this.sites.has(cell)) return this.sites.get(cell)!;
    const s = this.computeSite(i, j);
    if (this.sites.size > 50_000) this.sites.clear();
    this.sites.set(cell, s);
    return s;
  }

  private computeSite(i: number, j: number): Site | null {
    const w = this.w, seed = w.seed;
    const r = rng(hash(seed, i, j, 700));
    // How likely this cell is to hold a camp (compared with the cell's age, §3).
    const roll = r();
    const cx = Math.floor((i + 0.2 + 0.6 * r()) * CAMP_CELL), cy = Math.floor((j + 0.2 + 0.6 * r()) * CAMP_CELL);
    // Straight from worldgen, not the world's chunk caches: checking thousands of
    // sites must not load (and churn) the server's chunk memory.
    if (!terrainWalkable(terrainAt(seed, cx, cy))) return null;
    const biome = biomeAt(seed, cx, cy), elo = w.elo(cx, cy);
    const options = Object.values(FACTIONS).filter((f) => f.minElo <= elo && f.biomes.includes(biome));
    if (!options.length) return null;
    // Most at home in its first biome; rarer factions are picked less often.
    const weight = (f: Faction) => RARITY_WEIGHT[f.rarity] * (f.biomes[0] === biome ? 1.6 : 1);
    let pick = r() * options.reduce((s, f) => s + weight(f), 0);
    let faction = options[0];
    for (const f of options) { pick -= weight(f); if (pick < 0) { faction = f; break; } }
    // Camps sit by what they live on: a goblin camp by rock, wolves by trees.
    let anchor: [number, number] | null = null;
    if (faction.near === 'water') {
      for (let d = 1; d <= 16 && !anchor; d++)
        for (let k = 0; k < 16 && !anchor; k++) {
          const a = (k / 16) * Math.PI * 2, x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
          if (terrainAt(seed, x, y) === 'water') anchor = [x, y];
        }
    } else {
      const nodes = resourcesInRect(seed, cx - 16, cy - 16, cx + 16, cy + 16, [faction.near]);
      if (nodes.length) {
        const n = nodes.reduce((a, b) => (cheb(a.x, a.y, cx, cy) <= cheb(b.x, b.y, cx, cy) ? a : b));
        anchor = [n.x, n.y];
      }
    }
    if (!anchor) return null;
    // A 2x2 open spot a few squares from the anchor.
    // One worldgen pass over the area the spot can be in (anchor ± 10).
    const taken = new Set(resourcesInRect(seed, anchor[0] - 10, anchor[1] - 10, anchor[0] + 11, anchor[1] + 11).map((n) => `${n.x},${n.y}`));
    const ok = (x: number, y: number) => {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if (!terrainWalkable(terrainAt(seed, x + dx, y + dy)) || taken.has(`${x + dx},${y + dy}`)) return false;
      return true;
    };
    for (let d = 3; d <= 9; d++)
      for (let k = 0; k < 12; k++) {
        const a = (k / 12 + hash01(seed, i, j, 701)) * Math.PI * 2;
        const x = Math.round(anchor[0] + Math.cos(a) * d), y = Math.round(anchor[1] + Math.sin(a) * d);
        if (ok(x, y)) return { faction, x, y, cell: `${i},${j}`, biome, roll };
      }
    return null;
  }

  /** Every few seconds: camps appear, wake, sleep, grow, roam, attack and fade. */
  tick(now: number) {
    if (!this.enabled || now - this.lastTick < 5000) return;
    this.lastTick = now;
    const g = this.game;
    const kings: Piece[] = [];
    for (const [owner, set] of g.kingsByOwner) {
      const pl = g.players.get(owner);
      if (!pl || pl.wild) continue;
      for (const id of set) { const k = this.w.pieces.get(id); if (k) kings.push(k); }
    }
    const viewed = this.viewed?.() ?? null;
    const isViewed = (x: number, y: number) => {
      if (!viewed) return true;
      const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (viewed.has(chunkKey(cx + dx, cy + dy))) return true;
      return false;
    };
    const camps = this.camps();
    this.roamBudget = 8;
    let wakeBudget = 12;
    const active = new Set(camps.map((c) => c.wild!.cell));
    for (const c of camps) {
      const info = c.wild!;
      info.awake ??= true;
      if (kings.some((k) => cheb(k.x, k.y, info.x, info.y) <= FADE_FAR)) info.lastNear = now;
      else if (now - info.lastNear > FADE_MS && !this.inBattle(c.id)) { this.remove(c); continue; }
      if (isViewed(info.x, info.y)) {
        info.lastViewed = now;
        // Waking places pieces: a dozen camps per tick at most, the rest a moment later.
        if (!info.awake) { if (wakeBudget-- <= 0) continue; if (!this.wake(c)) { this.remove(c); continue; } }
      } else if (info.awake && now - (info.lastViewed ?? 0) > SLEEP_AFTER_MS) this.sleep(c);
      this.grow(c, now, kings);
      if (!info.awake) continue;
      this.roam(c, now);
      this.aggress(c, now, kings);
    }
    if (camps.length >= MAX_CAMPS) { this.flush(); return; }
    // New camps where players are. Cells fill in the longer players have been around.
    const seen = new Set<string>();
    let siteBudget = 4;
    for (const k of kings) {
      const i0 = Math.floor((k.x - SPAWN_NEAR) / CAMP_CELL), i1 = Math.floor((k.x + SPAWN_NEAR) / CAMP_CELL);
      const j0 = Math.floor((k.y - SPAWN_NEAR) / CAMP_CELL), j1 = Math.floor((k.y + SPAWN_NEAR) / CAMP_CELL);
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const cell = `${i},${j}`;
          if (seen.has(cell)) continue;
          seen.add(cell);
          if (!this.cellSeen.has(cell)) this.cellSeen.set(cell, now);
          if (active.has(cell) || (this.cleared.get(cell) ?? 0) > now) continue;
          // New sites cost CPU (worldgen): a few dozen per tick, the rest next time.
          if (!this.sites.has(cell) && siteBudget-- <= 0) continue;
          const s = this.site(i, j);
          if (!s) continue;
          const age = Math.min(1, (now - this.cellSeen.get(cell)!) / CELL_FILL_MS);
          if (s.roll >= CELL_CHANCE + (CELL_CHANCE_MAX - CELL_CHANCE) * age) continue;
          if (!this.clearOfPlayers(s)) continue;
          this.spawn(s, now, this.strengthNear(s.x, s.y, kings), isViewed(s.x, s.y));
          active.add(cell);
        }
    }
    for (const [cell, until] of this.cleared) if (until <= now) this.cleared.delete(cell);
    if (this.cellSeen.size > 200_000) this.cellSeen.clear();
    this.flush();
  }

  private flush() { if (this.dirty) { this.dirty = false; this.game.onPlayers(); } }

  /** The best rating among players with a king near (x, y): stronger players meet fuller camps. */
  private strengthNear(x: number, y: number, kings: Piece[]) {
    let best = 0;
    for (const k of kings) if (cheb(k.x, k.y, x, y) <= SPAWN_NEAR) best = Math.max(best, this.game.players.get(k.owner!)?.rating ?? 0);
    return best;
  }

  /** Extra pieces a camp gets for strong players nearby: one per 120 rating above 900, up to 8. */
  private strengthBonus(rating: number) { return Math.max(0, Math.min(8, Math.floor((rating - 900) / 120))); }

  private clearOfPlayers(s: { x: number; y: number }) {
    const w = this.w;
    if (w.buildingsNear(s.x, s.y, CLEAR_OF_BUILDINGS).some((b) => b.owner && !this.campOf(b.owner))) return false;
    if (w.piecesNear(s.x, s.y, CLEAR_OF_PIECES).some((p) => !p.wild)) return false;
    return this.spotFree(s.x, s.y);
  }

  private spotFree(x: number, y: number) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if (!this.w.free(x + dx, y + dy) || this.w.buildingIdAt(x + dx, y + dy) != null) return false;
    return true;
  }

  private inBattle(owner: string) {
    for (const r of this.game.battles.recs.values()) if (r.pub.phase !== 'over' && (r.white.player === owner || r.black.player === owner)) return true;
    return false;
  }

  /** A new camp: asleep (a record) unless someone is viewing the spot, then it wakes right away. */
  spawn(s: Site, now: number, strength = 0, viewed = true): PlayerRec | null {
    const g = this.game, w = this.w, f = s.faction;
    const id = 'w' + randomBytes(5).toString('hex');
    const areaElo = w.elo(s.x, s.y);
    const roster = rosterOf(2 + this.strengthBonus(strength));
    const rec: PlayerRec = {
      id, token: randomBytes(16).toString('hex'), name: f.name, color: f.art.accent, emblem: 0,
      rating: this.ratingFor(areaElo, roster.length), rd: 80, vol: 0.06, emperorId: null, shieldUntil: 0, home: [s.x, s.y],
      isBot: true, createdAt: now, lastSeen: now, online: false,
      wild: { faction: f.id, cell: s.cell, x: s.x, y: s.y, buildingId: 0, bornAt: now, grewAt: now, lastNear: now, areaElo, awake: false, roster, lastViewed: viewed ? now : 0 },
    };
    g.players.set(id, rec);
    g.tokens.set(rec.token, id);
    g.battles.offlineSince.set(id, 0);
    if (viewed && !this.wake(rec)) { this.remove(rec); return null; }
    return rec;
  }

  /** Someone is looking: put the camp's building and pieces into the world. */
  private wake(c: PlayerRec): boolean {
    const w = this.w, info = c.wild!, f = FACTIONS[info.faction];
    // The spot may have been built on while it slept: look a little way around, or give up.
    if (!this.spotFree(info.x, info.y)) {
      let moved = false;
      for (let r = 1; r <= 4 && !moved; r++)
        for (let dy = -r; dy <= r && !moved; dy++) for (let dx = -r; dx <= r && !moved; dx++)
          if (this.spotFree(info.x + dx, info.y + dy)) { info.x += dx; info.y += dy; moved = true; }
      if (!moved) return false;
    }
    const b = { id: w.id(), owner: c.id, type: 'camp' as const, x: info.x, y: info.y, size: 2, hp: 10, built: 1, prod: 0, blocked: null, camp: { faction: f.id, art: f.campArt, name: f.camp } };
    w.addBuilding(b);
    info.buildingId = b.id;
    info.awake = true;
    const roster = info.roster?.length ? info.roster : rosterOf(2);
    if (!this.addPiece(c, 'K')) { w.removeBuilding(b.id); info.awake = false; return false; }
    for (const k of roster.slice(1)) this.addPiece(c, k);
    info.roster = undefined;
    this.dirty = true;
    return true;
  }

  /** Nobody is looking: fold the camp back into a record. */
  private sleep(c: PlayerRec) {
    const g = this.game, w = this.w, info = c.wild!;
    if (this.inBattle(c.id)) return;
    const mine = [...w.pieces.values()].filter((p) => p.owner === c.id);
    if (mine.some((p) => p.state === 'battle')) return;
    const king = mine.find((p) => p.kind === 'K');
    if (!king) { this.remove(c); return; }
    // Not while it's marching on someone, or someone is marching on it.
    if (king.groupId && g.groups.get(king.groupId)?.attack) return;
    for (const gr of g.groups.values()) if (gr.attack?.targetKingId === king.id) return;
    info.roster = ['K', ...mine.filter((p) => p.kind !== 'K').map((p) => p.kind)];
    for (const p of mine) g.removePiece(p.id);
    if (info.buildingId) w.removeBuilding(info.buildingId);
    info.buildingId = 0;
    info.awake = false;
    this.dirty = true;
  }

  private addPiece(c: PlayerRec, kind: PieceKind): Piece | null {
    const w = this.w, info = c.wild!;
    const king = this.king(c);
    const [ox, oy] = king ? [king.x, king.y] : [info.x + 1, info.y + 3];
    const at = w.nearestFree(ox, oy + 1, 8, (x, y) => distToRect(x, y, info.x, info.y, 2) > 0);
    if (!at) return null;
    const p: Piece = { id: w.id(), owner: c.id, kind, x: at[0], y: at[1], facing: 2, state: 'idle', wild: info.faction };
    this.game.addPiece(p);
    return p;
  }

  king(c: PlayerRec): Piece | undefined {
    const s = this.game.kingsByOwner.get(c.id);
    if (!s) return undefined;
    for (const id of s) { const k = this.w.pieces.get(id); if (k) return k; }
    return undefined;
  }

  piecesOf(c: PlayerRec): Piece[] {
    const k = this.king(c);
    if (!k) return [];
    return this.w.piecesNear(k.x, k.y, REACH + 6).filter((p) => p.owner === c.id);
  }

  /** A camp starts below the area's rating and reaches it as it fills out. */
  ratingFor(areaElo: number, size: number) {
    return Math.max(400, Math.round(areaElo - 320 * (1 - Math.min(16, size) / 16)));
  }

  /** How big a camp may grow: players building nearby feed it, and strong players draw bigger bands (docs/specs/wilds.md §3). */
  maxSize(c: PlayerRec, now: number, kings: Piece[] = []) {
    const info = c.wild!;
    let dev = 0;
    for (const b of this.w.buildingsNear(info.x, info.y, 110)) if (b.owner && !this.campOf(b.owner) && b.type !== 'ruin' && b.built >= 1) dev++;
    const ageSteps = Math.floor((now - info.bornAt) / (40 * 60_000));
    return Math.min(16, 3 + Math.floor(dev * 0.75) + ageSteps + this.strengthBonus(this.strengthNear(info.x, info.y, kings)));
  }

  /** One more piece now and then, in the growth order. Asleep, only the roster grows. */
  private grow(c: PlayerRec, now: number, kings: Piece[]) {
    const info = c.wild!;
    if (now - info.grewAt < GROW_MS / this.game.speed || this.inBattle(c.id)) return;
    let kinds: PieceKind[];
    if (info.awake) {
      if (!this.king(c)) { this.remove(c); return; }
      kinds = this.piecesOf(c).map((p) => p.kind);
    } else kinds = info.roster ?? rosterOf(2);
    if (kinds.length >= this.maxSize(c, now, kings)) return;
    // The next kind in the growth order that the camp is short of.
    const have: Partial<Record<PieceKind, number>> = {};
    for (const k of kinds) have[k] = (have[k] ?? 0) + 1;
    const want: Partial<Record<PieceKind, number>> = {};
    let next: PieceKind | null = null;
    for (const k of GROWTH_ORDER) { want[k] = (want[k] ?? 0) + 1; if ((have[k] ?? 0) < want[k]!) { next = k; break; } }
    if (!next) return;
    info.grewAt = now;
    if (info.awake ? this.addPiece(c, next) : (info.roster = [...kinds, next])) {
      c.rating = this.ratingFor(info.areaElo, kinds.length + 1);
      if (info.awake) this.dirty = true;
    }
  }

  /** Now and then the camp wanders out as a group, and always comes home. */
  private roam(c: PlayerRec, now: number) {
    const g = this.game, info = c.wild!, f = FACTIONS[info.faction];
    const k = this.king(c);
    if (!k || k.state !== 'idle' || k.groupId || this.inBattle(c.id)) return;
    const home: [number, number] = [info.x + 1, info.y + 3];
    const away = cheb(k.x, k.y, home[0], home[1]);
    const seed = this.w.seed, t = Math.floor(now / 5000);
    let to: [number, number] | null = null;
    if (away > ROAM[f.temper]) to = home;
    else if (hash01(seed, t, info.x + info.y, 710) < (f.temper === 'horde' ? 0.12 : 0.06)) {
      const a = hash01(seed, t, info.x, 711) * Math.PI * 2, d = 3 + hash01(seed, t, info.y, 712) * ROAM[f.temper];
      to = [Math.round(home[0] + Math.cos(a) * d), Math.round(home[1] + Math.sin(a) * d)];
    }
    if (!to || (to !== home && !this.w.walkable(to[0], to[1]))) return;
    // Pathfinding costs CPU: only a few camps set out each tick.
    if (this.roamBudget-- <= 0) return;
    const ids = this.piecesOf(c).filter((p) => p.state === 'idle').map((p) => p.id);
    g.orderMove(c.id, ids, to);
  }

  /** Hordes and lairs attack online players' troops that come close. */
  private aggress(c: PlayerRec, now: number, kings: Piece[]) {
    const g = this.game, info = c.wild!, f = FACTIONS[info.faction];
    if (f.temper === 'herd' || now - (info.lastAttack ?? 0) < ATTACK_EVERY_MS) return;
    const k = this.king(c);
    if (!k || k.state !== 'idle' || (k.cooldownUntil ?? 0) > now || this.inBattle(c.id)) return;
    const pieces = this.piecesOf(c);
    if (pieces.length < 3) return;
    const range = AGGRO[f.temper];
    const target = kings.find((t) => {
      const pl = t.owner ? g.players.get(t.owner) : undefined;
      if (!pl || !pl.online || pl.isBot && !pl.name) return false;
      if (t.emperor || t.state === 'battle') return false;
      if (cheb(t.x, t.y, info.x + 1, info.y + 1) > range && cheb(t.x, t.y, k.x, k.y) > range) return false;
      // Only troops in the field: never a king holding its own settlement.
      if (this.w.buildingsNear(t.x, t.y, REACH).some((b) => b.owner === t.owner)) return false;
      return !g.battles.canTarget(t, c.id);
    });
    if (!target) return;
    info.lastAttack = now;
    g.orderAttack(c.id, pieces.map((p) => p.id), target.id);
  }

  /** The camp's king fell: the rest scatter into the wild and the site stays empty for a while. */
  scatter(c: PlayerRec, by?: string) {
    const g = this.game, info = c.wild!;
    this.cleared.set(info.cell, g.now + CLEARED_MS);
    if (by) {
      const f = FACTIONS[info.faction];
      g.onAlert(by, { kind: 'info', text: `You scattered the ${f.name} and cleared their ${f.camp}` });
    }
    this.remove(c);
  }

  /** Remove a camp entirely (pieces, building, record). */
  remove(c: PlayerRec) {
    const g = this.game, w = this.w;
    for (const p of [...w.pieces.values()]) if (p.owner === c.id && p.state !== 'battle') g.removePiece(p.id);
    if (c.wild?.buildingId) w.removeBuilding(c.wild.buildingId);
    for (const b of [...w.buildings.values()]) if (b.owner === c.id) w.removeBuilding(b.id);
    g.players.delete(c.id);
    g.tokens.delete(c.token);
    g.kingsByOwner.delete(c.id);
    g.battles.offlineSince.delete(c.id);
    this.dirty = true;
  }

  /** Each world turn: idle creatures shuffle about near their king (cheap, a few per turn). */
  step(record: (p: Piece, fx: number, fy: number) => void) {
    if (!this.enabled) return;
    const g = this.game, w = this.w, turn = g.turn;
    for (const c of this.awake()) {
      const k = this.king(c);
      if (!k) continue;
      for (const p of w.piecesNear(k.x, k.y, REACH)) {
        if (p.owner !== c.id || p.id === k.id || p.state !== 'idle' || p.groupId) continue;
        if ((turn + p.id * 5) % 6) continue;
        const a = hash01(w.seed, p.id, turn, 720) * Math.PI * 2, d = 1 + hash01(w.seed, p.id, turn, 721) * 4;
        const tx = Math.round(k.x + Math.cos(a) * d), ty = Math.round(k.y + Math.sin(a) * d);
        const m = bestGaitMove(p, tx, ty, (x, y) => w.free(x, y, p.id) && cheb(x, y, k.x, k.y) <= REACH - 2, 40, 5);
        if (!m) continue;
        const fx = p.x, fy = p.y;
        p.facing = m.facing;
        if (!m.turn) w.movePiece(p, m.x, m.y); else w.touch(p);
        record(p, fx, fy);
      }
    }
  }
}
