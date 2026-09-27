// The authoritative game: players, orders, world turns and the economy.
import {
  BUILDINGS, BUILD_SPACING, CLAIM_RANGE, ENGAGE_RANGE, HOUSE_POP, KING_POP, HOUSES_PER_KING, PLAYER_PIECE_CAP, PLAYER_KING_CAP, KING_TIME_PER_KING,
  BUILDINGS_PER_KING, PLAYER_BUILDING_CAP, RUIN_LIFETIME_MS, MASTERLESS_MS, REACH, SPAWN_SHIELD_MS, TEAM_COLORS,
  ANCHOR_GRACE_MS, DECAY_EVERY_MS, BUILDING_MAX_HP, WORK_AREA, cheb, distToRect, isLight,
  type Building, type BuildingType, type Facing, type NodeKind, type Piece, type PieceKind, type PlayerPublic, type PlayerSelf, type TurnMove,
} from '@owc/shared';
import { findPath, newGroup, stepGroup, bestGaitMove, productionMs, richness, type GroupState } from '@owc/rules';
import { randomBytes } from 'node:crypto';
import { World } from './world.ts';
import { Battles } from './battles.ts';
import { Routines } from './routines.ts';

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
  email?: string;
  /** When a guest's last session ended. */
  leftAt?: number;
  createdAt: number;
  lastSeen: number;
  online: boolean;
}

export interface GroupRec {
  state: GroupState;
  owner: string;
  kingId?: number;
  attack?: { targetKingId: number; lastRepath: number };
}

export interface GameOptions {
  seed: number;
  /** Multiplies economy speed (production, construction) for development. */
  speed: number;
}

export type Alert = { kind: 'attacked' | 'battle-soon' | 'decay' | 'emperor-lost' | 'respawned' | 'info'; text: string; battleId?: number; at?: [number, number] };


export class Game {
  world: World;
  players = new Map<string, PlayerRec>();
  tokens = new Map<string, string>();
  groups = new Map<number, GroupRec>();
  kingsByOwner = new Map<string, Set<number>>();
  battles: Battles;
  routines: Routines;
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
  private lastEconomy = Date.now();

  constructor(opts: GameOptions) {
    this.world = new World(opts.seed);
    this.speed = opts.speed;
    this.battles = new Battles(this);
    this.routines = new Routines(this);
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
  popCap(owner: string): number {
    let cap = 0;
    for (const k of this.kingsOf(owner)) {
      const houses = this.world.buildingsNear(k.x, k.y, REACH).filter((b) => b.owner === owner && b.type === 'house' && b.built >= 1 && distToRect(k.x, k.y, b.x, b.y, b.size) <= REACH).length;
      cap += KING_POP + HOUSE_POP * Math.min(HOUSES_PER_KING, houses);
    }
    return Math.min(PLAYER_PIECE_CAP, cap);
  }

  /** The one reach rule (economy.md §2): is (x, y) within reach of one of owner's kings? */
  inReach(owner: string, x: number, y: number, slack = 0): boolean {
    for (const k of this.kingsOf(owner)) if (cheb(k.x, k.y, x, y) <= REACH + slack) return true;
    return false;
  }

  nearestKing(owner: string, x: number, y: number): Piece | undefined {
    let best: Piece | undefined, bd = Infinity;
    for (const k of this.kingsOf(owner)) { const d = cheb(k.x, k.y, x, y); if (d < bd) { bd = d; best = k; } }
    return best;
  }

  // ---------- players ----------

  publicPlayer(p: PlayerRec): PlayerPublic {
    return { id: p.id, name: p.name, color: p.color, emblem: p.emblem, rating: Math.round(p.rating), online: p.online };
  }
  selfPlayer(p: PlayerRec): PlayerSelf {
    return { ...this.publicPlayer(p), guest: this.isGuest(p), guestGraceMs: this.guestGraceMs, email: p.email, popCap: this.popCap(p.id), emperorId: p.emperorId, shieldUntil: p.shieldUntil, home: p.home };
  }

  isGuest(p: PlayerRec) { return !p.googleSub && !p.isBot; }

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
    this.spawn(p);
    this.onPlayers();
    return p;
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
    for (let i = 0; i < 1500 && !site; i++) {
      const a = Math.random() * Math.PI * 2;
      // New players settle near each other so the world feels populated (and fights happen).
      const r = targetElo == null ? 60 + Math.random() * Math.min(2400, 140 + this.players.size * 20) : 3000 + Math.random() * 12000;
      const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r);
      if (awayFrom && cheb(x, y, awayFrom[0], awayFrom[1]) < 500) continue;
      const e = w.elo(x, y);
      if (targetElo == null ? e > 1050 : Math.abs(e - targetElo) > 200) continue;
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
  }

  // ---------- orders ----------

  private orderable(player: string, ids: number[]): Piece[] {
    return ids.map((id) => this.world.pieces.get(id)!).filter((p) =>
      p && p.owner === player && (p.state === 'idle' || p.state === 'moving') && !this.battles.frozen(p));
  }

  leaveGroup(p: Piece) {
    const g = p.groupId ? this.groups.get(p.groupId) : undefined;
    p.groupId = undefined;
    if (p.state === 'moving') p.state = 'idle';
    if (g && ![...this.world.pieces.values()].some((q) => q.groupId === g.state.id)) this.groups.delete(g.state.id);
  }

  /** Move a selection (movement.md §4, §7). Returns an error message or null. */
  orderMove(player: string, ids: number[], to: [number, number], attack?: number): string | null {
    const pieces = this.orderable(player, ids);
    if (!pieces.length) return 'Nothing to move';
    let [tx, ty] = to;
    const king = pieces.find((p) => p.kind === 'K');
    if (!king) {
      // Without a king, the group can only go where one of your kings reaches.
      if (!this.inReach(player, tx, ty)) {
        const k = this.nearestKing(player, tx, ty);
        if (!k) return 'No king to lead them';
        const d = cheb(k.x, k.y, tx, ty);
        tx = Math.round(k.x + ((tx - k.x) * REACH) / d);
        ty = Math.round(k.y + ((ty - k.y) * REACH) / d);
      }
    }
    for (const p of pieces) if (p.groupId) this.leaveGroup(p);
    const leader = king ?? pieces.reduce((a, b) => (cheb(a.x, a.y, tx, ty) <= cheb(b.x, b.y, tx, ty) ? a : b));
    const path = findPath(leader.x, leader.y, tx, ty, (x, y) => this.world.walkable(x, y));
    const gid = this.world.id();
    const state = newGroup(gid, pieces, path, [leader.x, leader.y]);
    this.groups.set(gid, { state, owner: player, kingId: king?.id, attack: attack != null ? { targetKingId: attack, lastRepath: this.turn } : undefined });
    for (const p of pieces) { p.groupId = gid; p.state = 'moving'; p.routine = undefined; this.world.touch(p); }
    return null;
  }

  orderStop(player: string, ids: number[]) {
    for (const p of this.orderable(player, ids)) this.leaveGroup(p);
  }

  orderAttack(player: string, ids: number[], targetKingId: number): string | null {
    const target = this.world.pieces.get(targetKingId);
    if (!target || target.kind !== 'K' || !target.owner || target.owner === player) return 'Pick an enemy king';
    const pieces = this.orderable(player, ids);
    const king = pieces.find((p) => p.kind === 'K');
    if (!king) return 'An attack needs a king';
    if ((king.cooldownUntil ?? 0) > this.now) return 'This king is recovering from battle';
    const err = this.battles.canTarget(target, player);
    if (err) return err;
    // Attacking ends your own spawn shield (progression.md §4).
    const me = this.players.get(player);
    if (me) me.shieldUntil = 0;
    // Already in range? Engage now. Otherwise march there.
    if (this.engaged(king, target)) return this.battles.engage(king, target);
    return this.orderMove(player, pieces.map((p) => p.id), [target.x, target.y], target.id);
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
    const spec = BUILDINGS[type];
    const [x, y] = at, w = this.world;
    const size = spec.size;
    const kings = this.kingsOf(player).filter((k) => distToRect(k.x, k.y, x, y, size) <= REACH);
    if (!kings.length) return 'Buildings need a king within 10 squares';
    // Building caps (safeguards.md §3): per king in reach, and per player.
    let owned = 0;
    for (const bl of w.buildings.values()) if (bl.owner === player && bl.type !== 'ruin') owned++;
    if (owned >= PLAYER_BUILDING_CAP) return `You have the maximum of ${PLAYER_BUILDING_CAP} buildings`;
    if (kings.every((k) => w.buildingsNear(k.x, k.y, REACH).filter((bl) => bl.owner === player && bl.type !== 'ruin' && distToRect(k.x, k.y, bl.x, bl.y, bl.size) <= REACH).length >= BUILDINGS_PER_KING))
      return `A king can hold at most ${BUILDINGS_PER_KING} buildings: bring another king`;
    if (type === 'palace' && w.buildingsNear(x, y, REACH).some((b) => b.owner === player && b.type === 'palace' && kings.some((k) => distToRect(k.x, k.y, b.x, b.y, b.size) <= REACH)))
      return 'One palace per king';
    for (let dy = 0; dy < size; dy++)
      for (let dx = 0; dx < size; dx++) {
        const sx = x + dx, sy = y + dy;
        if (!w.buildable(sx, sy)) return 'Can only build on grass or sand';
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
      if (have < amt) return `Needs ${amt} ${kind === 'tree' ? 'wood' : kind === 'rock' ? 'stone' : kind} nearby (have ${have})`;
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
      stepGroup(g.state, pieces, {
        free: (p, x, y) => w.free(x, y, p.id) && (p.kind === 'K' || this.inReach(g.owner, x, y, 1)),
      }, (gp, m) => {
        const p = gp as unknown as Piece;
        const fx = p.x, fy = p.y;
        p.facing = m.facing;
        if (!m.turn) w.movePiece(p, m.x, m.y); else w.touch(p);
        record(p, fx, fy);
      });
      if (g.state.done) {
        for (const p of pieces) { p.groupId = undefined; p.state = 'idle'; w.touch(p); }
        this.groups.delete(gid);
      }
    }

    // Pieces outside every king's reach drift toward the nearest king (movement.md §4).
    if (this.turn % 2 === 0)
      for (const p of w.pieces.values()) {
        if (!p.owner || p.groupId || (p.state !== 'idle' && p.state !== 'routed')) continue;
        if (p.kind === 'K') { if (p.state === 'routed') { p.state = 'idle'; w.touch(p); } continue; }
        if (this.inReach(p.owner, p.x, p.y)) { if (p.state === 'routed') { p.state = 'idle'; w.touch(p); } continue; }
        const k = this.nearestKing(p.owner, p.x, p.y);
        if (!k) { this.makeMasterless(p); continue; }
        if (p.state !== 'routed') { p.state = 'routed'; w.touch(p); }
        const m = bestGaitMove(p, k.x, k.y, (x, y) => w.free(x, y, p.id), 120, 10);
        if (m) {
          const fx = p.x, fy = p.y;
          p.facing = m.facing;
          if (!m.turn) w.movePiece(p, m.x, m.y); else w.touch(p);
          record(p, fx, fy);
        }
      }

    // Kings claim masterless pieces and buildings nearby (progression.md §3).
    if (this.turn % 5 === 0) this.claims();

    // Idle life in settlements (visuals.md §2).
    this.routines.step(record);
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

  makeMasterless(p: Piece) {
    // Starting-kit pieces never change hands (anti-farming, safeguards.md §5).
    if (p.kit) { this.removePiece(p.id); return; }
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
    const w = this.world;
    w.regrowNodes(now, dt);
    // Each node supplies one production at a time: buildings drawing from the same
    // node split its rate, so crowding one field gains nothing (safeguards.md §3).
    this.nodeUsers = new Map();
    for (const b of w.buildings.values())
      if (b.owner && b.type !== 'ruin' && b.built >= 1 && !b.blocked && b.drawsFrom)
        for (const [nx, ny] of b.drawsFrom) { const k = nx * 134217728 + ny; this.nodeUsers.set(k, (this.nodeUsers.get(k) ?? 0) + 1); }
    const pop = new Map<string, { count: number; cap: number }>();
    const popOf = (owner: string) => {
      let v = pop.get(owner);
      if (!v) {
        let count = 0;
        for (const p of w.pieces.values()) if (p.owner === owner) count++;
        v = { count, cap: this.popCap(owner) };
        pop.set(owner, v);
      }
      return v;
    };

    for (const b of [...w.buildings.values()]) {
      if (b.type === 'ruin') {
        b.ruinedAt ??= now;
        if (now - b.ruinedAt > RUIN_LIFETIME_MS) w.removeBuilding(b.id);
        continue;
      }
      const before = JSON.stringify([b.hp, b.built, Math.round(b.prod * 50), b.blocked, b.owner]);
      const anchored = b.owner ? w.anchorsOf(b, b.owner).length > 0 : false;
      if (!anchored) {
        b.unanchoredSince ??= now;
        if (!b.owner) b.expiresAt ??= now + MASTERLESS_MS;
        const out = now - b.unanchoredSince;
        if (out > ANCHOR_GRACE_MS) {
          const decays = Math.floor((out - ANCHOR_GRACE_MS) / DECAY_EVERY_MS) - Math.floor((out - dt - ANCHOR_GRACE_MS) / DECAY_EVERY_MS);
          if (decays > 0) b.hp = Math.max(0, b.hp - decays);
          b.blocked = 'unanchored';
          if (b.hp <= 0 || (b.expiresAt && now > b.expiresAt)) {
            b.type = 'ruin'; b.owner = null; b.hp = 0; b.blocked = null; b.ruinedAt = now; w.dirtyBuildings.add(b.id);
            continue;
          }
        }
      } else if (b.unanchoredSince) b.unanchoredSince = undefined;

      if (b.built < 1) {
        if (anchored) b.built = Math.min(1, b.built + (dt * this.speed) / BUILDINGS[b.type].buildMs);
        b.blocked = b.built < 1 ? 'building' : null;
      } else if (anchored && b.owner) {
        this.produce(b, dt, popOf(b.owner));
      }
      if (JSON.stringify([b.hp, b.built, Math.round(b.prod * 50), b.blocked, b.owner]) !== before) w.dirtyBuildings.add(b.id);
    }
  }

  private nodeUsers = new Map<number, number>();

  private produce(b: Building, dt: number, pop: { count: number; cap: number }) {
    const spec = BUILDINGS[b.type as BuildingType];
    const w = this.world;
    if (b.paused) { b.blocked = 'paused'; return; }
    const work = w.nodesNear(b.x, b.y, b.size, WORK_AREA).filter((n) => n.remaining > 0);
    const chosen = spec.needs.map((k) => work.filter((n) => n.kind === k).sort((a, c) => c.remaining - a.remaining)[0]);
    if (chosen.some((n) => !n)) { b.blocked = 'no-node'; b.drawsFrom = []; return; }
    if (pop.count >= pop.cap) { b.blocked = 'pop-cap'; return; }
    b.blocked = null;
    b.drawsFrom = chosen.map((n) => [n!.x, n!.y]);
    // Production rate follows node richness (migration.md §3).
    const rich = Math.min(...chosen.map((n) => richness(w.elo(n!.x, n!.y))));
    b.rate = Math.round(rich * 100) / 100;
    // Each extra king takes longer to crown, and there's a hard cap (safeguards.md §2).
    let slow = 1;
    if (b.type === 'palace' && (b.palaceNext ?? 'K') === 'K') {
      const kings = this.kingsOf(b.owner!).length;
      if (kings >= PLAYER_KING_CAP) { b.palaceNext = 'Q'; if (b.palaceMode === 'K') { b.blocked = 'pop-cap'; return; } }
      else slow = 1 + kings * KING_TIME_PER_KING;
    }
    const sharing = Math.max(1, ...chosen.map((n) => this.nodeUsers.get(n!.x * 134217728 + n!.y) ?? 1));
    b.rate = Math.round((rich / sharing) * 100) / 100;
    b.prod += dt / (productionMs(b.type as BuildingType, rich, this.speed) * slow * sharing);
    if (b.prod < 1) return;
    b.prod = 0;
    for (const n of chosen) w.drawNode(n!, spec.draw[n!.kind] ?? 0, this.now);
    let kind: PieceKind = spec.produces[0];
    if (b.type === 'palace') {
      kind = b.palaceNext ?? 'K';
      if (b.palaceMode === 'alt') b.palaceNext = kind === 'K' ? 'Q' : 'K';
    }
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
    pop.count++;
  }

  /** Buildings and live pieces of a player, for the "mine" summary. */
  holdings(owner: string) {
    const pieces: Piece[] = [], buildings: Building[] = [];
    for (const p of this.world.pieces.values()) if (p.owner === owner) pieces.push(p);
    for (const b of this.world.buildings.values()) if (b.owner === owner) buildings.push(b);
    return { pieces, buildings };
  }
}
