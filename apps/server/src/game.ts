// The authoritative game: players, orders, world turns and the economy.
import {
  setWorth, ALTAR_BUILDINGS, ALTAR_RATE, ALTAR_REACH, ALTAR_TEND, ALTAR_TYPES, ALTARS_PER_PLAYER, BUILDINGS, PAVED, BUBBLE_GOLD_CHANCE, BUBBLE_MAX, bubbleEveryMs, bubbleWorth, BUILD_SPACING, CHUNK, CLAIM_RANGE, chunkKey, HOLD_MS, ENGAGE_RANGE, POP_HOUSES_COUNTED, POP_PAWNS_PER_HOUSE, POP_PAWNS_PER_KING, POP_PER_BUILDING, PLAYER_PIECE_CAP, PLAYER_KING_CAP, KING_TIME_PER_KING,
  BUILDINGS_PER_KING, PLAYER_BUILDING_CAP, RUIN_LIFETIME_MS, MASTERLESS_MS, REACH, SPAWN_SHIELD_MS, TEAM_COLORS,
  ANCHOR_GRACE_MS, DECAY_EVERY_MS, BUILDING_MAX_HP, WORK_AREA, cheb, distToRect, isDecor, isLight,
  type Building, type BuildingType, type Facing, type NodeKind, type Piece, type PieceKind, type PlayerPublic, type PlayerSelf, type Troop, type TurnMove,
} from '@owc/shared';
import { LAND_CELL, landKey, landUnkey } from '@owc/worldgen';
import { rdAfter, RD_PROVISIONAL, findPath, findPathLong, newGroup, stepGroup, bestGaitMove, productionMs, richness, type GroupState } from '@owc/rules';
import { randomBytes } from 'node:crypto';
import { World, SETTLED_R } from './world.ts';
import { Battles } from './battles.ts';
import { Routines } from './routines.ts';
import { Wilds, type CampInfo } from './wilds.ts';
import { perf } from './perf.ts';
import { Chronicle, type ChronState } from './chronicle.ts';
import { Works } from './works.ts';
import { Troops } from './troops.ts';
import { CityBuild } from './citybuild.ts';
import { stats } from './stats.ts';
import { shopOpen } from './shop.ts';
import type { TikTokLink } from './tiktok.ts';

/** How often the land's ratings are recomputed (elo.md §3). */
const LAND_EVERY_MS = 30_000;
/** A king's pull on the land fades over about this many squares (Gaussian sigma). */
const LAND_SIGMA = 96;
/** Cells within this many cells of a king are touched. */
const LAND_REACH = 3;
/** The generated map's own pull, as a king's weight (a single empire moves its land most of the way). */
const LAND_PRIOR_WEIGHT = 0.75;
/** Each recompute moves a cell this share of the way to its new value. */
const LAND_EASE = 0.35;

/** A player's population this economy tick: pieces by kind and room by kind (safeguards.md §1). */
type Pop = { count: number; by: Record<PieceKind, number>; caps: Record<PieceKind, number> };

/** How often an empire may start over. */
const RESET_EVERY = 60 * 60_000;

export interface PlayerRec {
  id: string;
  name: string;
  token: string;
  color: string;
  emblem: number;
  rating: number;
  rd: number;
  vol: number;
  emperorId: number | null;
  shieldUntil: number;
  home: [number, number];
  isBot: boolean;
  /** Google account id once signed in (then the empire never falls for being offline). */
  googleSub?: string;
  /** TikTok account id once signed in or connected (tiktok.ts), and the tokens we hold for it. */
  tiktokId?: string;
  tiktok?: TikTokLink;
  email?: string;
  /** When a guest's last session ended. */
  leftAt?: number;
  createdAt: number;
  lastSeen: number;
  online: boolean;
  /** A camp of the wilds (an NPC owner), not a person. */
  wild?: CampInfo;
  /** Their place in the campaign (campaign.md). */
  chron?: ChronState;
  /** Cosmetic civilizations bought (cosmetics.md), and the one in use. */
  civs?: string[];
  civ?: string;
  /** Crowns: the shop currency. */
  crowns?: number;
  /** When this player last played a rated battle (its rating deviation grows back while away). */
  ratedAt?: number;
  /** When the empire was last reset (a fresh start, at most once an hour). */
  resetAt?: number;
  /** Pieces out on excursions, holding where they were sent (movement.md §10). */
  troops?: Troop[];
  /** Stripe checkout sessions already credited (each pays out once). */
  receipts?: string[];
}

export interface GroupRec {
  /** A raid on the wilds led by a pawn commander (battle.md §9): it may march beyond your kings' reach. */
  raid?: boolean;
  state: GroupState;
  owner: string;
  kingId?: number;
  attack?: { targetKingId: number; lastRepath: number };
  /** When the group last re-planned around a blockage (in its own turns). */
  repathAt?: number;
  /** Where the group was ordered to (long routes are planned in legs). */
  target?: [number, number];
  /** Pieces that were outside every king's reach when ordered: they may walk home through open country. */
  /** A background walk home (not a player's order): it just ends if hopelessly stuck. */
  homeward?: boolean;
  /** Consecutive legs that didn't get closer (8 in a row: the target is unreachable). */
  legs?: number;
  legFrom?: number;
}

export interface GameOptions {
  seed: number;
  /** Multiplies economy speed (production, construction) for development. */
  speed: number;
  /** Camps of creatures in the wilds (on unless turned off, e.g. in tests). */
  wilds?: boolean;
}

/** How often settlements clear a tree, and each building's chance to fell one then. */
const CLEARING_EVERY_MS = 30_000;
const CLEARING_CHANCE = 0.1;

export type Alert = { kind: 'attacked' | 'battle-soon' | 'decay' | 'emperor-lost' | 'respawned' | 'info'; text: string; battleId?: number; at?: [number, number] };


export class Game {
  world: World;
  players = new Map<string, PlayerRec>();
  tokens = new Map<string, string>();
  groups = new Map<number, GroupRec>();
  kingsByOwner = new Map<string, Set<number>>();
  battles: Battles;
  routines: Routines;
  /** Knights paving and elephants clearing (movement.md §9). */
  works: Works;
  troops: Troops;
  city: CityBuild;
  wilds: Wilds;
  chronicle: Chronicle;
  turn = 0;
  speed: number;
  /** New-player shield length (progression.md §4). */
  shieldMs = SPAWN_SHIELD_MS;
  now = Date.now();
  /** Moves made in the current turn, for broadcasting. */
  turnMoves: TurnMove[] = [];
  onAlert: (playerId: string, a: Alert) => void = () => {};
  /** Recent events per player, for the "While you were away" report (progression.md §5). */
  events = new Map<string, { at: number; kind: string; text: string }[]>();
  logEvent(player: string, kind: string, text: string) {
    const list = this.events.get(player) ?? [];
    list.push({ at: this.now, kind, text });
    if (list.length > 40) list.splice(0, list.length - 40);
    this.events.set(player, list);
  }
  onPlayers: () => void = () => {};
  /** Send a player their own record again (after a purchase). */
  onSelf: (playerId: string) => void = () => {};
  /**
   * Chunks people (not bots) are looking at, set by the network layer. Detail that
   * only matters to the eye (idle life, tidy formations) is simulated only there
   * (performance.md §5). Unset (tests): everywhere counts as watched.
   */
  viewed: (() => Set<string>) | null = null;
  /** This turn's viewed set (null = everything). */
  watchedNow: Set<string> | null = null;
  watched(x: number, y: number) { return !this.watchedNow || this.watchedNow.has(chunkKey(Math.floor(x / CHUNK), Math.floor(y / CHUNK))); }
  private lastEconomy = Date.now();

  constructor(opts: GameOptions) {
    this.world = new World(opts.seed);
    this.speed = opts.speed;
    this.battles = new Battles(this);
    this.routines = new Routines(this);
    this.works = new Works(this);
    this.troops = new Troops(this);
    this.city = new CityBuild(this);
    this.wilds = new Wilds(this);
    this.chronicle = new Chronicle(this);
    this.wilds.enabled = opts.wilds ?? true;
  }

  // ---------- ownership indexes ----------

  private indexKing(p: Piece, add: boolean) {
    if (p.kind !== 'K' || !p.owner) return;
    let s = this.kingsByOwner.get(p.owner);
    if (!s) this.kingsByOwner.set(p.owner, (s = new Set()));
    if (add) s.add(p.id); else s.delete(p.id);
  }

  addPiece(p: Piece) { this.world.addPiece(p); this.indexKing(p, true); }
  removePiece(id: number) {
    const p = this.world.pieces.get(id);
    if (!p) return;
    this.indexKing(p, false);
    if (p.groupId) this.leaveGroup(p);
    this.world.removePiece(id);
    for (const pl of this.players.values()) if (pl.emperorId === id) pl.emperorId = null;
  }
  setOwner(p: Piece, owner: string | null) {
    this.indexKing(p, false);
    if (p.groupId) this.leaveGroup(p);
    p.owner = owner;
    if (owner) { p.state = 'idle'; p.expiresAt = undefined; }
    this.indexKing(p, true);
    this.world.touch(p);
  }
  setKind(p: Piece, kind: PieceKind) {
    this.indexKing(p, false);
    p.promotedFrom = p.kind;
    p.kind = kind;
    this.indexKing(p, true);
    this.world.touch(p);
  }

  kingsOf(owner: string): Piece[] {
    const s = this.kingsByOwner.get(owner);
    if (!s) return [];
    return [...s].map((id) => this.world.pieces.get(id)!).filter((p) => p && p.state !== 'battle');
  }

  /**
   * Population cap (safeguards.md §1): per king, 16 plus 6 for each house within
   * its reach (at most 3 count), and never above the per-player hard cap.
   */
  /** Pieces and room by kind, for the player's own view. */
  popView(owner: string): Partial<Record<PieceKind, [number, number]>> {
    const caps = this.popCaps(owner), have: Record<PieceKind, number> = { K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0 };
    for (const p of this.world.pieces.values()) if (p.owner === owner) have[p.kind]++;
    return { P: [have.P, caps.P], N: [have.N, caps.N], B: [have.B, caps.B], R: [have.R, caps.R], Q: [have.Q, caps.Q] };
  }

  popCap(owner: string): number {
    const c = this.popCaps(owner);
    return Math.min(PLAYER_PIECE_CAP, c.P + c.N + c.B + c.R + c.Q);
  }

  /**
   * Room for each kind of piece (safeguards.md §1): pawns from each king's houses, knights
   * from its stables, bishops from temples, elephants from barracks, queens from palaces,
   * all counted within that king's reach. Titles add pawn room per king (campaign.md §4.1).
   */
  popCaps(owner: string): Record<PieceKind, number> {
    const caps: Record<PieceKind, number> = { K: Infinity, Q: 0, R: 0, B: 0, N: 0, P: 0 };
    const pl = this.players.get(owner);
    const extra = pl && !pl.wild ? this.chronicle.popPerKing(pl) : 0;
    for (const k of this.kingsOf(owner)) {
      const near = this.world.buildingsNear(k.x, k.y, REACH).filter((b) => b.owner === owner && b.built >= 1 && distToRect(k.x, k.y, b.x, b.y, b.size) <= REACH);
      const n = (t: BuildingType) => near.filter((b) => b.type === t).length;
      caps.P += POP_PAWNS_PER_KING + POP_PAWNS_PER_HOUSE * Math.min(POP_HOUSES_COUNTED, n('house')) + extra;
      for (const [kind, per] of Object.entries(POP_PER_BUILDING) as [PieceKind, { type: BuildingType; n: number }][]) caps[kind] += per.n * n(per.type);
    }
    return caps;
  }

  /** The one reach rule (economy.md §2): is (x, y) within reach of one of owner's kings? */
  inReach(owner: string, x: number, y: number, slack = 0): boolean {
    // Hot path (every candidate step of every group): no allocation.
    const s = this.kingsByOwner.get(owner);
    if (!s) return false;
    for (const id of s) {
      const k = this.world.pieces.get(id);
      if (k && k.state !== 'battle' && cheb(k.x, k.y, x, y) <= REACH + slack) return true;
    }
    return false;
  }

  nearestKing(owner: string, x: number, y: number): Piece | undefined {
    let best: Piece | undefined, bd = Infinity;
    for (const k of this.kingsOf(owner)) { const d = cheb(k.x, k.y, x, y); if (d < bd) { bd = d; best = k; } }
    return best;
  }

  // ---------- players ----------

  publicPlayer(p: PlayerRec): PlayerPublic {
    const cap = p.chron ? this.chronicle.capitalOf(p) : undefined;
    return { id: p.id, name: p.name, color: p.color, emblem: p.emblem, rating: Math.round(p.rating), provisional: !p.wild && rdAfter(p.rd, p.ratedAt ? (this.now - p.ratedAt) / 86_400_000 : 0) > RD_PROVISIONAL ? true : undefined, online: p.online, wild: p.wild?.faction, civ: p.civ, title: p.chron?.title, relics: p.chron?.relics.length ? p.chron.relics : undefined, capital: cap ? [cap.cx, cap.cy] : undefined };
  }
  selfPlayer(p: PlayerRec): PlayerSelf {
    return { ...this.publicPlayer(p), guest: this.isGuest(p), guestGraceMs: this.guestGraceMs, email: p.email, popCap: this.popCap(p.id), pop: this.popView(p.id), emperorId: p.emperorId, shieldUntil: p.shieldUntil, resetAt: p.resetAt, daysPlayed: stats.daysOf(p.id), troops: p.troops?.length ? p.troops : undefined, home: p.home, civsOwned: p.civs ?? [], crowns: p.crowns ?? 0, shopOpen: shopOpen(), chronicle: p.wild ? undefined : perf.time('self.chronicle', () => this.chronicle.view(p)), tiktok: p.tiktok ? { name: p.tiktok.name } : undefined };
  }

  isGuest(p: PlayerRec) { return !p.googleSub && !p.tiktokId && !p.isBot; }

  /** Names are unique, ignoring case. Returns an error message or null. */
  checkName(name: string, except?: PlayerRec): string | null {
    if (!/^[\p{L}\p{N}_ .-]{2,20}$/u.test(name) || !/[\p{L}\p{N}]/u.test(name)) return 'Use 2–20 letters, numbers, spaces, dots, dashes or underscores';
    const lower = name.toLowerCase();
    for (const o of this.players.values()) if (o !== except && o.name.toLowerCase() === lower) return 'That name is taken';
    return null;
  }

  /** Guests' empires fall this long after they leave (overridable for tests). */
  guestGraceMs = 15 * 60_000;

  join(token: string | undefined, name: string | undefined, isBot = false): PlayerRec | { error: string; code: 'need-name' | 'name-taken' | 'bad-name' } {
    const existing = token ? this.tokens.get(token) : undefined;
    if (existing) {
      const p = this.players.get(existing)!;
      if (!this.kingsOf(p.id).length && p.emperorId == null) this.spawn(p);
      return p;
    }
    // New players choose their own unique name (bots bring theirs).
    name = name?.trim();
    if (!name) return { error: 'Pick a name to start', code: 'need-name' };
    if (isBot) { name = name.replace(/^bot:/, ''); while (this.checkName(name)) name = name.slice(0, 17) + Math.floor(Math.random() * 99); }
    const bad = this.checkName(name);
    if (bad) return { error: bad, code: bad.includes('taken') ? 'name-taken' : 'bad-name' };
    return this.create(name, isBot);
  }

  create(name: string, isBot = false, googleSub?: string, email?: string): PlayerRec {
    const id = randomBytes(6).toString('hex');
    const used = new Set([...this.players.values()].map((p) => p.color));
    const color = TEAM_COLORS.find((c) => !used.has(c)) ?? TEAM_COLORS[this.players.size % TEAM_COLORS.length];
    const p: PlayerRec = {
      id, token: randomBytes(16).toString('hex'),
      name: name.slice(0, 20), googleSub, email,
      color, emblem: Math.floor(Math.random() * 8), rating: 1000, rd: 350, vol: 0.06,
      emperorId: null, shieldUntil: 0, home: [0, 0], isBot, createdAt: this.now, lastSeen: this.now, online: false,
    };
    this.players.set(id, p);
    this.tokens.set(p.token, id);
    this.chronicle.begin(p, false);
    this.spawn(p);
    this.onPlayers();
    return p;
  }

  /**
   * Start over (the player asked, twice): the empire's pieces and buildings are
   * gone, the campaign begins again at chapter 1, and a new starting kit lands
   * somewhere fresh. The account stays: its name, sign-ins, Crowns and cosmetics.
   * `confirm` must be the empire's name.
   */
  resetEmpire(p: PlayerRec, confirm: string): string | null {
    if (p.isBot || p.wild) return 'Not available';
    if (confirm.trim().toLowerCase() !== p.name.toLowerCase()) return 'Type your empire’s name to confirm';
    if (p.resetAt && this.now - p.resetAt < RESET_EVERY) return `You can start over once an hour: again in ${Math.ceil((p.resetAt + RESET_EVERY - this.now) / 60_000)} min`;
    if ([...this.battles.recs.values()].some((r) => r.pub.phase !== 'over' && (r.white.player === p.id || r.black.player === p.id))) return 'Finish your battles first';
    for (const pc of [...this.world.pieces.values()]) if (pc.owner === p.id) this.removePiece(pc.id);
    for (const b of [...this.world.buildings.values()]) if (b.owner === p.id) this.world.removeBuilding(b.id);
    this.kingsByOwner.delete(p.id);
    this.events.delete(p.id);
    p.emperorId = null;
    p.rating = 1000; p.rd = 350; p.vol = 0.06;
    p.resetAt = this.now;
    p.chron = undefined;
    this.chronicle.begin(p, false);
    this.chronicle.forget(p.id);
    this.spawn(p);
    this.onPlayers();
    return null;
  }

  /** Is (x, y) a good place to start? Wood and wheat in reach, no one else close (resources.md §6). */
  private viableSite(x: number, y: number): boolean {
    if (!this.world.buildable(x, y)) return false;
    const nodes = this.world.nodesNear(x, y, 1, REACH);
    const trees = nodes.filter((n) => n.kind === 'tree').length, wheat = nodes.filter((n) => n.kind === 'wheat').length;
    if (trees < 4 || wheat < 3) return false;
    if (this.world.buildingsNear(x, y, 40).length) return false;
    if (this.world.piecesNear(x, y, 14).length) return false;
    let open = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (this.world.free(x + dx, y + dy)) open++;
    return open >= 18;
  }

  /** Place a player's starting kit (economy.md §5) near a suitable site. */
  spawn(p: PlayerRec, targetElo?: number, awayFrom?: [number, number]) {
    const w = this.world;
    let site: [number, number] | null = null;
    // New players settle a short ride from an existing empire (70–220 squares): neighbors
    // to find and fight, never on top of anyone (viableSite keeps 40 from buildings,
    // 14 from pieces). Empires are people and bots; the wilds' camps don't count.
    const empires = [...this.players.values()].filter((o) => o !== p && !o.wild && this.kingsByOwner.get(o.id)?.size);
    const settled = empires.length;
    // Not beside camps grown to fight an old empire: a newcomer with six pieces can't beat a
    // full set. (Camps near a new empire are its own size: see the young band below.)
    const camps = this.wilds.camps().map((c) => ({ x: c.wild!.x, y: c.wild!.y, n: c.wild!.awake === false ? c.wild!.roster?.length ?? 2 : this.wilds.piecesOf(c).length }));
    const bigCampNear = (x: number, y: number) => camps.some((c) => c.n > 8 && cheb(c.x, c.y, x, y) <= 35);
    for (let i = 0; i < 1500 && !site; i++) {
      const a = Math.random() * Math.PI * 2;
      let ox = 0, oy = 0, r: number;
      if (targetElo != null) r = 3000 + Math.random() * 12000;
      else if (settled && i < 1000) {
        // Around a random empire's home (a fresh one each try, so we find open land).
        const e = empires[Math.floor(Math.random() * settled)];
        [ox, oy] = e.home; r = 70 + Math.random() * 150;
      } else r = 60 + Math.random() * Math.min(2400, 140 + settled * 20);
      const x = Math.round(ox + Math.cos(a) * r), y = Math.round(oy + Math.sin(a) * r);
      if (awayFrom && cheb(x, y, awayFrom[0], awayFrom[1]) < 500) continue;
      const e = w.elo(x, y);
      if (targetElo == null ? e > 1050 : Math.abs(e - targetElo) > 200) continue;
      // Neighbors, not roommates: no other empire's king within 60 squares.
      if (targetElo == null && i < 1200 && w.piecesNear(x, y, 60).some((q) => q.kind === 'K' && q.owner && q.owner !== p.id && !this.players.get(q.owner)?.wild)) continue;
      if (i < 1200 && bigCampNear(x, y)) continue;
      if (this.viableSite(x, y)) site = [x, y];
    }
    site ??= [Math.round((Math.random() - 0.5) * 400), Math.round((Math.random() - 0.5) * 400)];
    const [sx, sy] = site;
    const place = (kind: PieceKind, dx: number, dy: number, extra: Partial<Piece> = {}) => {
      const at = w.nearestFree(sx + dx, sy + dy, 8);
      if (!at) return null;
      const piece: Piece = { id: w.id(), owner: p.id, kind, x: at[0], y: at[1], facing: 2, state: 'idle', kit: true, ...extra };
      this.addPiece(piece);
      return piece;
    };
    const emp = place('K', 0, 0, { emperor: true });
    place('K', 2, 0);
    for (let i = 0; i < 4; i++) place('P', i - 1, 2);
    p.emperorId = emp?.id ?? null;
    p.home = [sx, sy];
    p.shieldUntil = this.now + this.shieldMs;
    // A young band of its own nearby (at most 80% of the kit's strength, and it never grows),
    // so a new empire's first hunt always has something it can beat (campaign.md §7).
    if (this.wilds.enabled && !p.isBot) this.wilds.quarry(p.id, [sx, sy], setWorth(['K', 'P', 'P', 'P', 'P']), this.now);
  }

  // ---------- orders ----------

  orderable(player: string, ids: number[]): Piece[] {
    return ids.map((id) => this.world.pieces.get(id)!).filter((p) =>
      // Routed pieces (outside every king's reach) can be ordered too: you can always bring them home.
      p && p.owner === player && (p.state === 'idle' || p.state === 'moving' || p.state === 'routed') && !this.battles.frozen(p));
  }

  leaveGroup(p: Piece) {
    const g = p.groupId ? this.groups.get(p.groupId) : undefined;
    p.groupId = undefined;
    if (p.state === 'moving') p.state = 'idle';
    if (g && ![...this.world.pieces.values()].some((q) => q.groupId === g.state.id)) this.groups.delete(g.state.id);
  }

  /** Move a selection (movement.md §4, §7). Returns an error message or null. */
  /**
   * `post`: the player sent these pieces there themselves. Any selection may go anywhere
   * (movement.md §4); pieces sent without a king are posted where they arrive and don't
   * drift home (background walks home don't post). `work`: a worker riding to its job
   * (movement.md §9); any other order takes pieces off their jobs.
   */
  orderMove(player: string, ids: number[], to: [number, number], attack?: number, planMs?: number, commander?: number, post = false, work = false, join = false): string | null {
    const pieces = this.orderable(player, ids);
    if (!pieces.length) return 'Nothing to move';
    if (!work) this.works.release(pieces.map((p) => p.id));
    const [tx, ty] = to;
    const king = pieces.find((p) => p.kind === 'K') ?? (commander != null ? pieces.find((p) => p.id === commander) : undefined);
    for (const p of pieces) p.posted = post && !king ? true : undefined;
    for (const p of pieces) if (p.groupId) this.leaveGroup(p);
    const leader = king ?? pieces.reduce((a, b) => (cheb(a.x, a.y, tx, ty) <= cheb(b.x, b.y, tx, ty) ? a : b));
    const endPath = perf.start('path.order');
    // Time limits keep a live server responsive; without one (tests) results mustn't depend on CPU speed.
    const live = !!this.viewed;
    // A troop with war elephants may go through woods: the elephants knock the trees down ahead of it.
    const clears = pieces.some((p) => p.kind === 'R');
    const path = findPathLong(leader.x, leader.y, tx, ty, this.marchFree(clears), 40000, !live ? 5000 : planMs ?? (this.players.get(player)?.isBot || this.players.get(player)?.wild ? 80 : 250), this.marchCost(clears));
    endPath();
    const gid = this.world.id();
    const state = newGroup(gid, pieces, path, [leader.x, leader.y]);
    this.groups.set(gid, { state, owner: player, kingId: king?.id, raid: commander != null || undefined, attack: attack != null ? { targetKingId: attack, lastRepath: this.turn } : undefined, target: [tx, ty], legs: 0, homeward: !king && !post ? true : undefined });
    for (const p of pieces) { p.groupId = gid; p.state = 'moving'; p.routine = undefined; this.world.touch(p); }
    // Troops (movement.md §10): what the player sends out of their cities holds there, together.
    // Workers and background walks leave their troops; a reinforcement is already counted.
    if (post) this.troops.assign(player, pieces, [tx, ty]);
    else if (!join) this.troops.release(player, pieces.map((p) => p.id), true);
    return null;
  }

  /** Where a troop's lead may walk: open ground, and standing trees if its elephants will clear them. */
  private marchFree(clears: boolean) { return clears ? (x: number, y: number) => this.world.walkCode(x, y) > 0 : (x: number, y: number) => this.world.walkable(x, y); }
  /** A tree on the road costs 8 steps: elephants cut short-cuts through tree lines, not lanes through deep forest. */
  private marchCost(clears: boolean) { return clears ? { cost: (x: number, y: number) => (this.world.walkCode(x, y) === 2 ? 8 : 0) } : {}; }
  /** Route plans for pieces that fell behind share a budget each turn (reset in worldTurn). */
  private routeBudget = 0;

  /** Muster (campaign.md §4.1, chapter 12): every piece of yours within 20 squares gathers to a king. */
  muster(player: string, kingId: number): string | null {
    const p = this.players.get(player);
    if (!p || !this.chronicle.has(p, 'muster')) return 'Muster opens in chapter 12';
    const k = this.world.pieces.get(kingId);
    if (!k || k.owner !== player || k.kind !== 'K') return 'Pick one of your kings';
    const ids = this.world.piecesNear(k.x, k.y, 20).filter((q) => q.owner === player && q.kind !== 'K' && q.state !== 'battle' && cheb(q.x, q.y, k.x, k.y) > 2).map((q) => q.id);
    if (!ids.length) return 'Everyone is already here';
    return this.orderMove(player, ids, [k.x, k.y]);
  }

  orderStop(player: string, ids: number[]) {
    this.works.release(ids);
    const stopped = this.orderable(player, ids);
    for (const p of stopped) this.leaveGroup(p);
    // They hold where they stopped: out of a city, that's a troop's post (movement.md §10).
    if (stopped.length) { const lead = stopped.find((p) => p.kind === 'K') ?? stopped[0]; this.troops.assign(player, stopped, [lead.x, lead.y]); }
  }

  orderAttack(player: string, ids: number[], targetId: number): string | null {
    const target = this.defenderOf(this.world.pieces.get(targetId));
    if (!target || !target.owner || target.owner === player) return 'Pick an enemy king or troop';
    const pieces = this.orderable(player, ids);
    let king = pieces.find((p) => p.kind === 'K');
    // Raiding the wilds (battle.md §9): any troop with a pawn may attack a camp without a king.
    // A pawn becomes its commander and fights as the king, for that battle only; if the raid
    // fails, only that pawn falls. Your real kings stay home.
    let raid = false;
    if (!king) {
      if (!this.wilds.campOf(target.owner)) return 'An attack on an empire needs a king';
      const pawns = pieces.filter((p) => p.kind === 'P' && (p.cooldownUntil ?? 0) <= this.now);
      if (!pawns.length) return 'A raid on the wilds needs at least one pawn to lead it';
      king = pawns.reduce((a, b) => (cheb(a.x, a.y, target.x, target.y) <= cheb(b.x, b.y, target.x, target.y) ? a : b));
      raid = true;
    }
    if ((king.cooldownUntil ?? 0) > this.now) return 'This king is recovering from battle';
    const err = this.battles.canTarget(target, player);
    if (err) return err;
    // Attacking an empire ends your own spawn shield (progression.md §4); raiding camps doesn't.
    const me = this.players.get(player);
    if (me && !raid) me.shieldUntil = 0;
    // Already in range? Engage now. Otherwise march there.
    if (this.engaged(king, target)) return this.battles.engage(king, target);
    return this.orderMove(player, pieces.map((p) => p.id), [target.x, target.y], target.id, undefined, raid ? king.id : undefined, true);
  }

  /**
   * Who answers an attack on this piece (battle.md §9): a king, or the king whose reach it's
   * in. A troop out on its own without a king is still fair game: its pawn nearest the
   * piece (or, with no pawn, the piece itself) takes command and defends as its king.
   */
  defenderOf(p: Piece | undefined): Piece | undefined {
    if (!p?.owner || p.state === 'battle' || p.state === 'masterless') return undefined;
    if (p.kind === 'K') return p;
    const near = this.world.piecesNear(p.x, p.y, REACH).filter((q) => q.owner === p.owner && q.state !== 'battle');
    const king = near.filter((q) => q.kind === 'K').sort((a, b) => cheb(a.x, a.y, p.x, p.y) - cheb(b.x, b.y, p.x, p.y))[0];
    if (king) return king;
    if (this.wilds.campOf(p.owner)) return undefined; // a camp is always answered by its king
    const pawns = near.filter((q) => q.kind === 'P' && cheb(q.x, q.y, p.x, p.y) <= 3);
    return pawns.length ? pawns.reduce((a, b) => (cheb(a.x, a.y, p.x, p.y) <= cheb(b.x, b.y, p.x, p.y) ? a : b)) : p;
  }

  /** Attack range (battle.md §2): near the target king, or any piece or building it holds. */
  engaged(att: Piece, target: Piece): boolean {
    if (cheb(att.x, att.y, target.x, target.y) <= ENGAGE_RANGE) return true;
    for (const p of this.world.piecesNear(att.x, att.y, ENGAGE_RANGE))
      if (p.owner === target.owner && cheb(p.x, p.y, target.x, target.y) <= REACH) return true;
    for (const b of this.world.buildingsNear(att.x, att.y, ENGAGE_RANGE))
      if (b.owner === target.owner && distToRect(target.x, target.y, b.x, b.y, b.size) <= REACH) return true;
    return false;
  }

  /** Place a building (economy.md §2). Construction draws from nodes within reach of the site. */
  build(player: string, type: BuildingType, at: [number, number]): string | null {
    if (isDecor(type)) return this.city.placeDecor(player, type, [at]).err;
    const spec = BUILDINGS[type];
    const [x, y] = at, w = this.world;
    const size = spec.size;
    // The Chronicle opens buildings chapter by chapter (campaign.md §3).
    const me = this.players.get(player);
    if (me && !me.wild) {
      const locked = this.chronicle.canBuild(me, type);
      if (locked) return locked;
      if (type === 'wonder') {
        // One per empire, in the capital (campaign.md §4.5).
        if ([...w.buildings.values()].some((b) => b.owner === player && b.type === 'wonder')) return 'An empire raises only one Wonder';
        const cap = this.chronicle.capitalOf(me);
        if (!cap) return 'Name a capital first (open one of your buildings)';
        if (cheb(cap.cx, cap.cy, x + 1, y + 1) > 12) return 'Raise your Wonder in your capital';
      }
    }
    const kings = this.kingsOf(player).filter((k) => distToRect(k.x, k.y, x, y, size) <= REACH);
    // Altars (economy.md §8): a bishop raises one anywhere; a tended altar holds a few small buildings.
    if (type === 'altar') {
      const bishop = w.piecesNear(x, y, ALTAR_TEND).find((p) => p.owner === player && p.kind === 'B' && p.state !== 'battle' && cheb(p.x, p.y, x, y) <= ALTAR_TEND);
      if (!bishop) return 'A bishop raises an altar: bring one of yours beside the spot';
      const mine = [...w.buildings.values()].filter((b) => b.owner === player && b.type === 'altar');
      if (mine.length >= ALTARS_PER_PLAYER) return `You can hold at most ${ALTARS_PER_PLAYER} altars`;
      if (mine.some((a) => cheb(a.x, a.y, x, y) <= 2 * ALTAR_REACH)) return 'Too close to another of your altars';
    } else if (!kings.length) {
      const altar = w.altarOver(x, y, size, player);
      if (!altar) return 'Buildings need a king within 10 squares, or a tended altar within 5';
      if (!ALTAR_TYPES.includes(type)) return 'By an altar you can build only houses, stables and temples';
      const held = w.buildingsNear(altar.x, altar.y, ALTAR_REACH + 3).filter((b) => b.owner === player && b.type !== 'ruin' && b.type !== 'altar' && distToRect(altar.x, altar.y, b.x, b.y, b.size) <= ALTAR_REACH);
      if (held.length >= ALTAR_BUILDINGS) return `An altar holds at most ${ALTAR_BUILDINGS} buildings`;
    }
    // Building caps (safeguards.md §3): per king in reach, and per player.
    let owned = 0;
    for (const bl of w.buildings.values()) if (bl.owner === player && bl.type !== 'ruin' && !isDecor(bl.type)) owned++;
    if (owned >= PLAYER_BUILDING_CAP) return `You have the maximum of ${PLAYER_BUILDING_CAP} buildings`;
    if (kings.length && kings.every((k) => w.buildingsNear(k.x, k.y, REACH).filter((bl) => bl.owner === player && bl.type !== 'ruin' && !isDecor(bl.type) && distToRect(k.x, k.y, bl.x, bl.y, bl.size) <= REACH).length >= BUILDINGS_PER_KING))
      return `A king can hold at most ${BUILDINGS_PER_KING} buildings: bring another king`;
    if (type === 'palace' && w.buildingsNear(x, y, REACH).some((b) => b.owner === player && b.type === 'palace' && kings.some((k) => distToRect(k.x, k.y, b.x, b.y, b.size) <= REACH)))
      return 'One palace per king';
    for (let dy = 0; dy < size; dy++)
      for (let dx = 0; dx < size; dx++) {
        const sx = x + dx, sy = y + dy;
        if (!w.buildable(sx, sy)) return w.terrain(sx, sy) === 'water' ? "Can't build on water" : "Can't build on mountains";
        if (w.buildingIdAt(sx, sy) != null || w.sealed.has(sx * 134217728 + sy)) return 'Something is already there';
        const n = w.nodeAt(sx, sy);
        if (n && n.remaining > 0 && n.kind !== 'wheat') return 'Clear the resources first';
        const pid = w.pieceIdAt(sx, sy);
        if (pid != null) {
          const pc = w.pieces.get(pid)!;
          if (pc.owner !== player || pc.state !== 'idle') return 'Someone is standing there';
        }
      }
    if (w.buildingsNear(x, y, BUILD_SPACING + size).some((b) => b.owner !== player && b.owner && distToRect(x, y, b.x, b.y, b.size) <= BUILD_SPACING + size - 1))
      return 'Too close to another player';
    // Pay: nearest nodes within reach of the site first.
    const pool = w.nodesNear(x, y, size, REACH).sort((a, b) => distToRect(a.x, a.y, x, y, size) - distToRect(b.x, b.y, x, y, size));
    for (const [kind, amt] of Object.entries(spec.cost) as [NodeKind, number][]) {
      const have = pool.filter((n) => n.kind === kind).reduce((s, n) => s + n.remaining, 0);
      if (have < amt) return `Needs ${amt} ${kind === 'tree' ? 'wood' : kind === 'rock' ? 'stone' : kind === 'wheat' ? 'crops' : kind} nearby (have ${have})`;
    }
    for (const [kind, amt] of Object.entries(spec.cost) as [NodeKind, number][]) {
      let need = amt;
      for (const n of pool) if (need > 0 && n.kind === kind) need -= w.drawNode(n, need, this.now);
    }
    // Move own idle pieces off the footprint.
    for (let dy = 0; dy < size; dy++)
      for (let dx = 0; dx < size; dx++) {
        const pid = w.pieceIdAt(x + dx, y + dy);
        if (pid != null) {
          const pc = w.pieces.get(pid)!;
          const spot = w.nearestFree(x + dx, y + size + 1, 8, (fx, fy) => distToRect(fx, fy, x, y, size) > 0);
          if (spot) w.movePiece(pc, spot[0], spot[1]);
        }
      }
    const b: Building = {
      id: w.id(), owner: player, type, x, y, size, hp: BUILDING_MAX_HP, built: 0, prod: 0, blocked: 'building',
      palaceMode: type === 'palace' ? 'alt' : undefined, palaceNext: type === 'palace' ? 'K' : undefined,
    };
    w.addBuilding(b);
    return null;
  }

  setPaused(player: string, id: number, paused: boolean) {
    const b = this.world.buildings.get(id);
    if (b && b.owner === player && b.type !== 'ruin') { b.paused = paused; this.world.dirtyBuildings.add(id); }
  }

  setPalaceMode(player: string, id: number, mode: 'alt' | 'K' | 'Q') {
    const b = this.world.buildings.get(id);
    if (b && b.owner === player && b.type === 'palace') { b.palaceMode = mode; if (mode !== 'alt') b.palaceNext = mode; this.world.dirtyBuildings.add(id); }
  }

  // ---------- the loop ----------

  worldTurn(now: number) {
    this.now = now;
    this.turn++;
    this.turnMoves = [];
    const w = this.world;
    const record = (p: Piece, fx: number, fy: number) => this.turnMoves.push([p.id, fx, fy, p.x, p.y, p.facing]);

    // Groups, in id order (movement.md §1).
    this.watchedNow = this.viewed?.() ?? null;
    let endPhase = perf.start('turn.groups');
    // Long-route planning inside a turn shares one time budget; the rest waits a turn.
    let legMs = this.viewed ? 60 : Infinity;
    this.routeBudget = this.viewed ? 24 : Infinity;
    for (const [gid, g] of [...this.groups].sort((a, b) => a[0] - b[0])) {
      const pieces = [...w.pieces.values()].filter((p) => p.groupId === gid && p.state === 'moving');
      if (!pieces.length) { this.groups.delete(gid); continue; }
      const king = g.kingId != null ? w.pieces.get(g.kingId) : undefined;
      if (g.attack) {
        const target = w.pieces.get(g.attack.targetKingId);
        if (!target || target.state === 'battle' || !king || king.groupId !== gid) g.attack = undefined;
        else if (this.engaged(king, target)) {
          const err = this.battles.engage(king, target);
          if (err) this.onAlert(g.owner, { kind: 'info', text: err });
          for (const p of pieces) { p.groupId = undefined; p.state = p.state === 'moving' ? 'idle' : p.state; w.touch(p); }
          this.groups.delete(gid);
          continue;
        } else if (this.turn - g.attack.lastRepath >= 4) {
          const end = g.state.path.at(-1) ?? g.state.lead;
          if (cheb(end[0], end[1], target.x, target.y) > 2) {
            g.state.path = [...g.state.path.slice(0, g.state.pathIdx), ...findPath(g.state.lead[0], g.state.lead[1], target.x, target.y, (x, y) => w.walkable(x, y))];
          }
          g.attack.lastRepath = this.turn;
        }
      }
      // Idle pieces of the owner standing in the way step aside (swap places).
      const yields = (mover: Piece, x: number, y: number) => {
        const qid = w.pieceIdAt(x, y);
        if (qid == null || qid === mover.id || cheb(mover.x, mover.y, x, y) > 2) return null;
        const q = w.pieces.get(qid);
        if (!q || q.owner !== mover.owner || q.state === 'battle') return null;
        // Only idle, ungrouped pieces step aside. (Swapping groupmates made them
        // shuffle each other off their slots forever.)
        return !q.groupId && q.state === 'idle' ? q : null;
      };
      const lite = !pieces.some((p) => this.watched(p.x, p.y));
      const step = () => stepGroup(g.state, pieces, {
        free: (gp, x, y) => {
          const p = gp as unknown as Piece;
          return w.free(x, y, p.id) || (w.walkable(x, y) && !!yields(p, x, y));
        },
        walkable: (x, y) => w.walkable(x, y),
        lite,
        // A piece that fell behind plans its own way back (pawns and elephants without diagonal steps).
        route: (gp, tx, ty) => {
          if (this.routeBudget <= 0) return null;
          this.routeBudget--;
          const p = gp as unknown as Piece;
          return findPath(p.x, p.y, tx, ty, (x, y) => w.walkable(x, y), lite ? 1500 : 4000, { orth: p.kind === 'P' || p.kind === 'R' });
        },
        tree: (x, y) => w.treeAt(x, y),
        fell: (gp, x, y) => {
          const n = w.nodeAt(x, y);
          if (!n || n.kind !== 'tree' || n.remaining <= 0) return false;
          w.drawNode(n, n.remaining, this.now);
          return true;
        },
      }, (gp, m) => {
        const p = gp as unknown as Piece;
        const fx = p.x, fy = p.y;
        p.facing = m.facing;
        if (!m.turn) {
          const q = yields(p, m.x, m.y);
          w.movePiece(p, m.x, m.y);
          if (q) { const qx = q.x, qy = q.y; w.movePiece(q, fx, fy); record(q, qx, qy); }
        } else w.touch(p);
        record(p, fx, fy);
      });
      step();
      // Roads speed marches (campaign.md §4.4): on a street, a troop takes an extra step every other turn.
      const owner = this.players.get(g.owner);
      // Paved roads (movement.md §9) speed everyone the same way; with Roads, busy streets do too.
      const road = w.traffic.get(g.state.lead[0] * 134217728 + g.state.lead[1]) ?? 0;
      if (this.turn % 2 === 0 && !g.state.done && (road >= PAVED || (road >= 60 && owner && this.chronicle.has(owner, 'roads')))) step();
      // A stray's walk home that's hopelessly stuck just ends (it drifts, and may try again later).
      if (g.homeward && pieces.every((p) => (g.state.stuck[p.id] ?? 0) >= 8)) {
        for (const p of pieces) { p.groupId = undefined; p.state = 'idle'; w.touch(p); }
        this.groups.delete(gid);
        continue;
      }
      // A stalled group re-plans its route around whatever is blocking it.
      const stalled = pieces.filter((p) => (g.state.stuck[p.id] ?? 0) >= 2).length;
      if (stalled >= Math.max(1, pieces.length / 2) && g.state.pathIdx < g.state.path.length && g.state.turns - (g.repathAt ?? 0) > 8) {
        g.repathAt = g.state.turns;
        const end = g.state.path.at(-1)!;
        const around = findPath(g.state.lead[0], g.state.lead[1], end[0], end[1], (x, y) => {
          if (!w.walkable(x, y)) return false;
          const id = w.pieceIdAt(x, y);
          return id == null || w.pieces.get(id)?.groupId === gid || cheb(x, y, g.state.lead[0], g.state.lead[1]) > 20;
        });
        if (around.length) { g.state.path = [...g.state.path.slice(0, g.state.pathIdx), ...around]; }
      }
      // Long routes are planned in legs: at the end of a partial path, plan the next one.
      const goal = g.attack ? (() => { const t = w.pieces.get(g.attack!.targetKingId); return t ? [t.x, t.y] as [number, number] : g.target; })() : g.target;
      const left = goal ? cheb(g.state.lead[0], g.state.lead[1], goal[0], goal[1]) : 0;
      if (goal && g.state.pathIdx >= g.state.path.length && left > 2 && (g.legs ?? 0) < 8 && legMs > 5) {
        // A leg that got us closer resets the count; repeated dead ends give up.
        g.legs = g.legFrom != null && left < g.legFrom - 4 ? 0 : (g.legs ?? 0) + 1;
        g.legFrom = left;
        const t0 = performance.now();
        const clears = !g.state.avoidTrees && pieces.some((p) => p.kind === 'R');
        const leg = findPathLong(g.state.lead[0], g.state.lead[1], goal[0], goal[1], this.marchFree(clears), 40000, Math.min(this.viewed ? 60 : 5000, legMs), this.marchCost(clears));
        legMs -= performance.now() - t0;
        if (leg.length) { g.state.path = [...g.state.path, ...leg]; g.state.done = false; }
      }
      if (g.state.done) {
        for (const p of pieces) { p.groupId = undefined; p.state = 'idle'; w.touch(p); }
        this.groups.delete(gid);
      }
    }

    endPhase();
    endPhase = perf.start('turn.drift');
    // Pieces outside every king's reach drift toward the nearest king (movement.md §4).
    this.strayRoutes = 2;
    if (this.strayRoutedAt.size > 5000) this.strayRoutedAt.clear();
    if (this.turn % 2 === 0)
      for (const p of w.pieces.values()) {
        if (!p.owner || p.groupId || (p.state !== 'idle' && p.state !== 'routed')) continue;
        // Off-screen strays take their time (every 6th turn instead of every 2nd).
        if (p.state === 'routed' && this.turn % 6 !== 0 && !this.watched(p.x, p.y)) continue;
        // Merchants on a trade run travel as caravans between towns.
        if (p.routine === 'merchant' || p.routine === 'merchant:back' || p.routine === 'trade') continue;
        if (p.kind === 'K') { if (p.state === 'routed') { p.state = 'idle'; w.touch(p); } continue; }
        // Pieces their player posted out there stay where they were sent.
        if (p.posted && p.state === 'idle') continue;
        if (this.inReach(p.owner, p.x, p.y)) { if (p.state === 'routed') { p.state = 'idle'; w.touch(p); this.driftStuck.delete(p.id); } continue; }
        const k = this.nearestKing(p.owner, p.x, p.y);
        // Creatures without a king just melt back into the wild.
        if (!k) { if (p.wild) this.removePiece(p.id); else this.makeMasterless(p); continue; }
        if (p.state !== 'routed') { p.state = 'routed'; w.touch(p); }
        const m = bestGaitMove(p, k.x, k.y, (x, y) => w.free(x, y, p.id), 120, 10);
        const before = cheb(p.x, p.y, k.x, k.y);
        if (m) {
          const fx = p.x, fy = p.y;
          p.facing = m.facing;
          if (!m.turn) w.movePiece(p, m.x, m.y); else w.touch(p);
          record(p, fx, fy);
        }
        // A greedy step can't get around a wood or a lake: after a few turns without
        // getting closer, walk home along a real path instead.
        const stuck = cheb(p.x, p.y, k.x, k.y) >= before ? (this.driftStuck.get(p.id) ?? 0) + 1 : 0;
        this.driftStuck.set(p.id, stuck);
        // Route planning is costly: a few strays a turn, and each at most once a minute.
        if (stuck >= 3 && this.strayRoutes > 0 && this.turn - (this.strayRoutedAt.get(p.id) ?? -1e9) > 100) {
          this.strayRoutes--;
          this.driftStuck.delete(p.id);
          this.strayRoutedAt.set(p.id, this.turn);
          // A background walk home: a small planning budget (the rest is planned in legs as it goes).
          this.orderMove(p.owner, [p.id], [k.x, k.y], undefined, 40);
        }
      }

    endPhase();
    // Kings claim masterless pieces and buildings nearby (progression.md §3).
    if (this.turn % 5 === 0) perf.time('turn.claims', () => this.claims());

    // Idle life in settlements (visuals.md §2), and in the wilds' camps.
    perf.time('turn.works', () => this.works.step(record));
    if (this.turn % 2 === 0) perf.time('turn.troops', () => this.troops.step());
    if (this.turn % 97 === 0) perf.time('turn.decor', () => this.city.sweep());
    perf.time('turn.routines', () => this.routines.step(record));
    perf.time('turn.wilds', () => this.wilds.step(record));
  }

  /**
   * A guest who left without signing in: their empire falls. Pieces and
   * buildings become masterless (nearby kings can claim them) and the name
   * is free again.
   */
  fallOfGuests(now: number) {
    for (const p of [...this.players.values()]) {
      if (!this.isGuest(p) || p.online || !p.leftAt || now - p.leftAt < this.guestGraceMs) continue;
      if ([...this.battles.recs.values()].some((r) => r.pub.phase !== 'over' && (r.white.player === p.id || r.black.player === p.id))) continue;
      for (const pc of [...this.world.pieces.values()]) if (pc.owner === p.id) this.makeMasterless(pc);
      for (const b of this.world.buildings.values()) if (b.owner === p.id) { b.owner = null; b.unanchoredSince = now; this.world.dirtyBuildings.add(b.id); }
      this.players.delete(p.id);
      this.tokens.delete(p.token);
      this.kingsByOwner.delete(p.id);
      this.events.delete(p.id);
      this.onPlayers();
    }
  }

  /**
   * An altar's defenders were beaten by an empire (economy.md §8): the altar falls to ruin,
   * and the buildings it held (those no king holds) are left masterless for anyone to claim.
   */
  fallOfAltar(owner: string, at: [number, number]) {
    const w = this.world;
    for (const a of w.buildingsNear(at[0], at[1], ALTAR_REACH).filter((b) => b.owner === owner && b.type === 'altar')) {
      for (const b of w.buildingsNear(a.x, a.y, ALTAR_REACH + 3))
        if (b !== a && b.owner === owner && b.type !== 'ruin' && distToRect(a.x, a.y, b.x, b.y, b.size) <= ALTAR_REACH && !w.anchorsOf(b, owner).length) {
          b.owner = null; b.outpost = undefined; b.unanchoredSince = this.now; w.dirtyBuildings.add(b.id);
        }
      const bishop = w.tenderOf(a);
      if (bishop?.routine === 'tend') { bishop.routine = undefined; w.touch(bishop); }
      a.type = 'ruin'; a.owner = null; a.hp = 0; a.blocked = null; a.ruinedAt = this.now; w.dirtyBuildings.add(a.id);
      this.onAlert(owner, { kind: 'info', text: 'Your altar has fallen', at: [a.x, a.y] });
    }
  }

  makeMasterless(p: Piece) {
    // Starting-kit pieces never change hands (anti-farming, safeguards.md §5), nor do creatures.
    if (p.kit || p.wild) { this.removePiece(p.id); return; }
    this.setOwner(p, null);
    p.state = 'masterless';
    p.expiresAt = this.now + MASTERLESS_MS;
  }

  private claims() {
    const w = this.world;
    for (const p of [...w.pieces.values()]) {
      if (p.owner) continue;
      if (p.expiresAt && this.now > p.expiresAt) { this.removePiece(p.id); continue; }
      const k = w.piecesNear(p.x, p.y, CLAIM_RANGE).find((q) => q.kind === 'K' && q.owner && q.state !== 'battle');
      if (k) this.setOwner(p, k.owner);
    }
    for (const b of w.buildings.values()) {
      if (b.owner || b.type === 'ruin') continue;
      const k = w.piecesNear(b.x, b.y, REACH + b.size).find((q) => q.kind === 'K' && q.owner && q.state !== 'battle' && distToRect(q.x, q.y, b.x, b.y, b.size) <= REACH);
      if (k) { b.owner = k.owner; b.unanchoredSince = undefined; b.expiresAt = undefined; w.dirtyBuildings.add(b.id); }
    }
  }

  /** Economy tick (economy.md §2–3). Runs about once a second. */
  economy(now: number) {
    const dt = now - this.lastEconomy;
    this.lastEconomy = now;
    this.now = now;
    if (now - this.lastLand >= LAND_EVERY_MS) { this.lastLand = now; perf.time('land', () => this.reshapeLand()); }
    const w = this.world;
    w.regrowNodes(now, dt);
    // Each node supplies one production at a time: buildings drawing from the same
    // node split its rate, so crowding one field gains nothing (safeguards.md §3).
    perf.time('wilds.tick', () => this.wilds.tick(now));
    this.chronicleAcc += dt;
    if (this.chronicleAcc >= 5000) { const d = this.chronicleAcc; this.chronicleAcc = 0; perf.time('chronicle', () => this.chronicle.tick(now, d)); }
    if (now - this.lastClearing >= CLEARING_EVERY_MS) { this.lastClearing = now; perf.time('clearing', () => this.clearing()); }
    this.nodeUsers = new Map();
    for (const b of w.buildings.values())
      if (b.owner && b.type !== 'ruin' && b.built >= 1 && !b.blocked && b.drawsFrom)
        for (const [nx, ny] of b.drawsFrom) { const k = nx * 134217728 + ny; this.nodeUsers.set(k, (this.nodeUsers.get(k) ?? 0) + 1); }
    const pop = new Map<string, Pop>();
    const popOf = (owner: string) => {
      let v = pop.get(owner);
      if (!v) pop.set(owner, (v = this.popNow(owner)));
      return v;
    };

    for (const b of [...w.buildings.values()]) {
      if (b.type === 'camp') continue;
      if (b.type === 'ruin') {
        b.ruinedAt ??= now;
        if (now - b.ruinedAt > RUIN_LIFETIME_MS) w.removeBuilding(b.id);
        continue;
      }
      // Decorations (citybuilding.md) just finish going up: no anchor, decay or production.
      if (isDecor(b.type)) {
        if (b.built < 1) { b.built = Math.min(1, b.built + (dt * this.speed) / BUILDINGS[b.type].buildMs); b.blocked = b.built < 1 ? 'building' : null; w.dirtyBuildings.add(b.id); }
        continue;
      }
      const before = JSON.stringify([b.hp, b.built, Math.round(b.prod * 50), b.blocked, b.owner, b.bubbles, b.outpost]);
      // Holding the realm (campaign.md §4.3): a king (or, with Regents, a queen) in reach
      // keeps a building going; without one, a settlement holds itself for a while by its
      // tier (a capital forever), and it only decays when none of its owner's pieces are home.
      const owner = b.owner ? this.players.get(b.owner) : undefined;
      let ruled = b.owner ? w.anchorsOf(b, b.owner).length > 0 : false;
      // Altars (economy.md §8): a bishop tending one holds it, and the little land around it.
      let outpost = false;
      if (!ruled && b.owner) {
        if (b.type === 'altar') {
          const bishop = w.tenderOf(b);
          if (bishop) {
            ruled = true;
            // The tending bishop stays put: posted, and out of idle routines.
            if (bishop.routine !== 'tend' || !bishop.posted) { bishop.routine = 'tend'; bishop.posted = true; w.touch(bishop); }
          }
        } else if (w.altarOver(b.x, b.y, b.size, b.owner)) { ruled = true; outpost = true; }
      }
      if (!!b.outpost !== outpost) b.outpost = outpost || undefined;
      if (!ruled && owner && this.chronicle.has(owner, 'regents'))
        ruled = w.piecesNear(b.x + (b.size >> 1), b.y + (b.size >> 1), REACH + b.size).some((q) => q.owner === b.owner && q.kind === 'Q' && q.state !== 'battle' && distToRect(q.x, q.y, b.x, b.y, b.size) <= REACH);
      let anchored = ruled;
      if (!ruled) {
        b.unanchoredSince ??= now;
        if (!b.owner) b.expiresAt ??= now + MASTERLESS_MS;
        const out = now - b.unanchoredSince;
        const s = owner ? this.chronicle.settlementOfBuilding(b.id) : undefined;
        const hold = !owner || owner.wild ? 0 : s && this.chronicle.capitalOf(owner)?.id === s.id ? Infinity : HOLD_MS[s?.tier ?? 1];
        if (out < hold) anchored = true;
        else if (out > ANCHOR_GRACE_MS) {
          b.blocked = 'unanchored';
          const home = !!b.owner && w.piecesNear(b.x + (b.size >> 1), b.y + (b.size >> 1), REACH + b.size).some((q) => q.owner === b.owner);
          if (!home) {
            const decays = Math.floor((out - ANCHOR_GRACE_MS) / DECAY_EVERY_MS) - Math.floor((out - dt - ANCHOR_GRACE_MS) / DECAY_EVERY_MS);
            if (decays > 0) b.hp = Math.max(0, b.hp - decays);
          }
          if (b.hp <= 0 || (b.expiresAt && now > b.expiresAt)) {
            b.type = 'ruin'; b.owner = null; b.hp = 0; b.blocked = null; b.ruinedAt = now; w.dirtyBuildings.add(b.id);
            continue;
          }
        }
      } else if (b.unanchoredSince) b.unanchoredSince = undefined;

      if (b.built < 1) {
        if (anchored) b.built = Math.min(1, b.built + (dt * this.speed) / BUILDINGS[b.type].buildMs);
        b.blocked = b.built < 1 ? 'building' : null;
      } else if (anchored && b.owner && b.type !== 'wonder' && b.type !== 'altar') {
        this.produce(b, dt, popOf(b.owner));
      }
      // A building waiting for room (pop-cap) keeps its bubbles: popping banks progress toward
      // the next piece, which is raised as soon as there's room (economy.md §7).
      if (b.blocked === 'pop-cap' && b.built >= 1) { b.cycleMs ??= productionMs(b.type as BuildingType, 1, this.speed); this.bubbleTick(b, now); }
      else if (b.blocked || b.built < 1) { b.cycleMs = undefined; b.bubbles = undefined; b.bubbleAt = undefined; }
      else this.bubbleTick(b, now);
      if (JSON.stringify([b.hp, b.built, Math.round(b.prod * 50), b.blocked, b.owner, b.bubbles, b.outpost]) !== before) w.dirtyBuildings.add(b.id);
    }
  }

  private nodeUsers = new Map<number, number>();
  private chronicleAcc = 0;
  /** Trade links (campaign.md §4.4): settlement id → partner settlement id → when a merchant last arrived. */
  private trade = new Map<number, Map<number, number>>();
  recordTrade(a: number, b: number) {
    for (const [x, y] of [[a, b], [b, a]]) { let m = this.trade.get(x); if (!m) this.trade.set(x, (m = new Map())); m.set(y, this.now); }
  }
  /** Partners a settlement traded with in the last 30 minutes. */
  tradeLinks(sid: number): number {
    const m = this.trade.get(sid);
    if (!m) return 0;
    let n = 0;
    for (const [, t] of m) if (this.now - t < 30 * 60_000) n++;
    return n;
  }
  private lastClearing = Date.now();

  /**
   * Settlements slowly clear the trees around them (visuals.md §10): now and then a
   * building fells the nearest tree right beside it. Its stump is dug out later
   * instead of regrowing (World.regrowNodes), so towns open into clearings while
   * the wild forest stays.
   */
  private clearing() {
    const w = this.world;
    let fells = 0;
    for (const b of w.buildings.values()) {
      if (fells >= 25) break;
      if (!b.owner || b.type === 'ruin' || b.type === 'camp' || b.built < 1) continue;
      if (Math.random() >= CLEARING_CHANCE) continue;
      const trees = w.nodesNear(b.x, b.y, b.size, SETTLED_R).filter((n) => n.kind === 'tree' && n.remaining > 0);
      if (!trees.length) continue;
      const n = trees.reduce((a, c) => (distToRect(a.x, a.y, b.x, b.y, b.size) <= distToRect(c.x, c.y, b.x, b.y, b.size) ? a : c));
      w.drawNode(n, n.remaining, this.now);
      fells++;
    }
  }
  private lastLand = 0;
  /**
   * The land takes on the ratings of the empires living on it (elo.md §3): every
   * king pulls the cells around it toward its owner's rating, weighted by distance,
   * against a light pull back to the generated map. Cells move part of the way each
   * time, so the land shifts gradually, and fade back to the map where nobody lives.
   */
  reshapeLand() {
    const land = this.world.land, C = LAND_CELL;
    const sum = new Map<number, [number, number]>(); // cell → [Σw, Σw·rating]
    for (const p of this.players.values()) {
      if (p.wild) continue;
      const kings = this.kingsByOwner.get(p.id);
      if (!kings?.size) continue;
      for (const kid of kings) {
        const k = this.world.pieces.get(kid);
        if (!k) continue;
        const kcx = Math.floor(k.x / C), kcy = Math.floor(k.y / C);
        for (let dy = -LAND_REACH; dy <= LAND_REACH; dy++) for (let dx = -LAND_REACH; dx <= LAND_REACH; dx++) {
          const cx = kcx + dx, cy = kcy + dy;
          const ddx = (cx + 0.5) * C - k.x, ddy = (cy + 0.5) * C - k.y;
          const wgt = Math.exp(-(ddx * ddx + ddy * ddy) / (2 * LAND_SIGMA * LAND_SIGMA));
          if (wgt < 0.02) continue;
          const key = landKey(cx, cy), cur = sum.get(key);
          if (cur) { cur[0] += wgt; cur[1] += wgt * p.rating; } else sum.set(key, [wgt, wgt * p.rating]);
        }
      }
    }
    const next = new Map<number, number>();
    for (const [key, [wsum, rsum]] of sum) {
      const [cx, cy] = landUnkey(key), prior = land.prior(cx, cy);
      const target = Math.max(400, Math.min(2800, (LAND_PRIOR_WEIGHT * prior + rsum) / (LAND_PRIOR_WEIGHT + wsum)));
      const old = land.cells.get(key) ?? prior;
      next.set(key, Math.round(old + (target - old) * LAND_EASE));
    }
    // Land nobody lives on any more drifts back toward the map, and is forgotten once it's close.
    for (const [key, v] of land.cells) {
      if (next.has(key)) continue;
      const [cx, cy] = landUnkey(key), prior = land.prior(cx, cy), back = v + (prior - v) * LAND_EASE;
      if (Math.abs(back - prior) > 10) next.set(key, Math.round(back));
    }
    land.cells = next;
    this.landVersion++;
  }
  /** Bumps whenever the land's ratings are recomputed (the network layer sends changes). */
  landVersion = 0;

  /** Drifting pieces that haven't gotten closer to their king, in drift steps. */
  private driftStuck = new Map<number, number>();
  private strayRoutedAt = new Map<number, number>();
  private strayRoutes = 0;

  /** Pieces now, by kind, and the room for each (safeguards.md §1). */
  popNow(owner: string): Pop {
    const by: Record<PieceKind, number> = { K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0 };
    let count = 0;
    for (const p of this.world.pieces.values()) if (p.owner === owner) { count++; by[p.kind]++; }
    return { count, by, caps: this.popCaps(owner) };
  }

  /**
   * Hurry bubbles (economy.md §7): while its owner is online, a working building grows a
   * bubble every so often, a little irregularly, up to BUBBLE_MAX. Bots don't get them.
   */
  private bubbleTick(b: Building, now: number) {
    const pl = b.owner ? this.players.get(b.owner) : undefined;
    if (!pl || pl.wild || pl.isBot || !b.cycleMs || !BUILDINGS[b.type as BuildingType]?.produces.length) return;
    if (!pl.online) { b.bubbleAt = undefined; return; }
    const every = bubbleEveryMs(b.cycleMs);
    if (b.bubbleAt == null) { b.bubbleAt = now + every * (0.3 + Math.random() * 0.7); return; }
    if (now < b.bubbleAt) return;
    b.bubbleAt = now + every * (0.7 + Math.random() * 0.6);
    if ((b.bubbles?.length ?? 0) >= BUBBLE_MAX) return;
    (b.bubbles ??= []).push(Math.random() < BUBBLE_GOLD_CHANCE ? 1 : 0);
  }

  /** The owner pops a bubble (economy.md §7): production jumps ahead, and a piece that's due now is raised at once. */
  popBubble(player: string, id: number, i: number): boolean {
    const b = this.world.buildings.get(id);
    if (!b || b.owner !== player || b.bubbles?.[i] == null) return false;
    const gold = b.bubbles[i] === 1;
    b.bubbles.splice(i, 1);
    if (!b.bubbles.length) b.bubbles = undefined;
    this.world.dirtyBuildings.add(b.id);
    if ((b.blocked && b.blocked !== 'pop-cap') || !b.cycleMs) return false;
    b.prod = Math.min(1, b.prod + bubbleWorth(b.cycleMs, gold));
    if (b.prod >= 1) this.produce(b, 0, this.popNow(player));
    return true;
  }

  private produce(b: Building, dt: number, pop: Pop) {
    const spec = BUILDINGS[b.type as BuildingType];
    const w = this.world;
    if (b.paused) { b.blocked = 'paused'; return; }
    const work = w.nodesNear(b.x, b.y, b.size, WORK_AREA).filter((n) => n.remaining > 0);
    const chosen = spec.needs.map((k) => work.filter((n) => n.kind === k).sort((a, c) => c.remaining - a.remaining)[0]);
    if (chosen.some((n) => !n)) { b.blocked = 'no-node'; b.drawsFrom = []; return; }
    // Room for this kind of piece (safeguards.md §1). A full room never blocks what the
    // Chronicle is asking for (campaign.md §12), up to the number it still needs.
    // A palace set to kings (or queens) always makes that; only 'alt' takes turns (palaceNext).
    let kind: PieceKind = b.type === 'palace' ? (b.palaceMode === 'K' || b.palaceMode === 'Q' ? b.palaceMode : b.palaceNext ?? 'K') : spec.produces[0];
    if (pop.count >= PLAYER_PIECE_CAP) { b.blocked = 'pop-cap'; return; }
    if (kind !== 'K' && pop.by[kind] >= pop.caps[kind]) {
      const pl = this.players.get(b.owner!);
      const want = pl?.chron ? this.chronicle.wants(pl) : null;
      if (!want || want.kind !== kind || pop.by[kind] >= pop.caps[kind] + want.left) { b.blocked = 'pop-cap'; return; }
    }
    b.blocked = null;
    b.drawsFrom = chosen.map((n) => [n!.x, n!.y]);
    // Production rate follows node richness (migration.md §3).
    const rich = Math.min(...chosen.map((n) => richness(w.elo(n!.x, n!.y))));
    b.rate = Math.round(rich * 100) / 100;
    // Each extra king takes longer to crown, and there's a hard cap (safeguards.md §2).
    let slow = 1;
    const pl = this.players.get(b.owner!);
    if (b.type === 'palace' && kind === 'K') {
      const kings = this.kingsOf(b.owner!).length;
      // The title sets how many kings you may hold (campaign.md §4.1).
      const cap = pl && !pl.wild ? Math.min(PLAYER_KING_CAP, this.chronicle.kingCap(pl)) : PLAYER_KING_CAP;
      if (kings >= cap) {
        // Kings only: wait for room (a higher title, or a king lost), and say why.
        if (b.palaceMode === 'K') { b.blocked = 'king-cap'; return; }
        b.palaceNext = 'Q';
        // At the king limit the palace makes a queen instead, if there's room for one.
        kind = 'Q';
        if (pop.by.Q >= pop.caps.Q) { b.blocked = 'pop-cap'; return; }
      }
      else slow = 1 + kings * KING_TIME_PER_KING;
      // Your first palace king comes quickly (campaign.md §7).
      if (pl?.chron && !pl.chron.firstKingDone) slow *= 0.5;
      // A capital crowns 25% faster.
      const s = this.chronicle.settlementOfBuilding(b.id);
      if (pl && s && this.chronicle.capitalOf(pl)?.id === s.id) slow *= 0.75;
    }
    // Relics, trade and a Wonder speed their towns (campaign.md §4).
    slow /= this.chronicle.bonus(b);
    // Held by an altar, not a king (economy.md §8): a bishop's hamlet works slower.
    if (b.outpost) slow /= ALTAR_RATE;
    const sharing = Math.max(1, ...chosen.map((n) => this.nodeUsers.get(n!.x * 134217728 + n!.y) ?? 1));
    b.rate = Math.round((rich / sharing) * 100) / 100;
    b.cycleMs = Math.round(productionMs(b.type as BuildingType, rich, this.speed) * slow * sharing);
    b.prod += dt / b.cycleMs;
    if (b.prod < 1) return;
    b.prod = 0;
    for (const n of chosen) w.drawNode(n!, spec.draw[n!.kind] ?? 0, this.now);
    // (The kind was settled above; a palace on 'alt' switches to the other one next time.)
    if (b.type === 'palace' && b.palaceMode === 'alt') b.palaceNext = kind === 'K' ? 'Q' : 'K';
    // Bishops alternate square color (economy.md §3): the spawn square decides.
    const doorX = b.x + (b.size >> 1), doorY = b.y + b.size;
    let wantLight: boolean | undefined;
    if (kind === 'B') {
      const lights = [...w.pieces.values()].filter((p) => p.owner === b.owner && p.kind === 'B' && isLight(p.x, p.y)).length;
      const darks = [...w.pieces.values()].filter((p) => p.owner === b.owner && p.kind === 'B' && !isLight(p.x, p.y)).length;
      wantLight = lights <= darks;
    }
    const at = w.nearestFree(doorX, doorY, 8, (x, y) => distToRect(x, y, b.x, b.y, b.size) > 0 && (wantLight == null || isLight(x, y) === wantLight));
    if (!at) return;
    const piece: Piece = { id: w.id(), owner: b.owner, kind, x: at[0], y: at[1], facing: 2 as Facing, state: 'idle', routine: 'born' };
    this.addPiece(piece);
    pop.count++; pop.by[kind]++;
    // Quests count what you raise (campaign.md §5.2).
    this.chronicle.note(b.owner, `raise:${kind}`);
    if (kind === 'K') { this.chronicle.note(b.owner, 'crown'); if (pl?.chron) pl.chron.firstKingDone = true; }
  }

  /** Buildings and live pieces of a player, for the "mine" summary. */
  holdings(owner: string) {
    const pieces: Piece[] = [], buildings: Building[] = [];
    for (const p of this.world.pieces.values()) if (p.owner === owner) pieces.push(p);
    for (const b of this.world.buildings.values()) if (b.owner === owner) buildings.push(b);
    return { pieces, buildings };
  }
}
