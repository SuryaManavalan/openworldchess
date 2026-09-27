// One bot: an ordinary player on the public protocol (bots.md §1). It only
// knows what its own client has been sent, and acts through the same commands
// a human uses. Behavior comes from utilities, not scripts (bots.md §4).
import WebSocket from 'ws';
import { Chess } from 'chess.js';
import { Connection } from '@owc/client-core';
import { BUILDINGS, PIECE_VALUE, REACH, WORK_AREA, cheb, distToRect, key, type BattlePublic, type BuildingType, type NodeKind, type Piece } from '@owc/shared';
import { expected } from '@owc/rules';
import { buildable, eloAt, terrainAt } from '@owc/worldgen';
import type { ChessAI } from '@owc/engine';

export type Style = 'builder' | 'raider' | 'expander' | 'turtle' | 'opportunist';

export interface Persona {
  name: string;
  strength: number; // true rating 600–2400
  style: Style;
  risk: number; // 0..1
  token?: string;
}

const W: Record<Style, { build: number; attack: number; expand: number }> = {
  builder: { build: 1.4, attack: 0.6, expand: 0.8 },
  raider: { build: 0.8, attack: 1.6, expand: 0.7 },
  expander: { build: 1, attack: 0.8, expand: 1.5 },
  turtle: { build: 1.5, attack: 0.3, expand: 0.6 },
  opportunist: { build: 1, attack: 1.1, expand: 1 },
};

const lognormal = (median: number, sigma = 0.6) => median * Math.exp(sigma * Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random()));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Bot {
  conn: Connection;
  p: Persona;
  ai: ChessAI;
  private alive = true;
  private thinking = new Set<number>();
  private lastBuildTry = 0;
  private lastAttack = 0;
  private lastExpand = 0;
  onToken: (t: string) => void = () => {};

  constructor(url: string, p: Persona, ai: ChessAI) {
    this.p = p;
    this.ai = ai;
    this.conn = new Connection({ url, WebSocket: WebSocket as never, token: p.token, name: 'bot:' + p.name, onToken: (t) => { this.p.token = t; this.onToken(t); } });
    this.conn.mirror.onBattle = (b) => this.onBattle(b);
    this.loop();
  }

  stop() { this.alive = false; this.conn.close(); }
  log(s: string) { if (process.env.BOT_LOG) console.log(`[${this.p.name}] ${s}`); }
  get m() { return this.conn.mirror; }

  private async loop() {
    while (this.alive) {
      // Bursts and lulls, never a metronome (bots.md §4).
      await sleep(lognormal(6000, 0.5));
      if (!this.m.self) continue;
      try { this.think(); } catch (e) { console.error(this.p.name, e); }
    }
  }

  private think() {
    const m = this.m;
    const kings = m.myKings().filter((k) => k.state !== 'battle');
    if (!kings.length) return;
    // Watch the area around our holdings, like a human scrolling around home.
    const focus = kings[Math.floor(Math.random() * kings.length)];
    this.conn.watchArea(focus.x, focus.y, 56);
    if ([...m.battles.values()].some((b) => b.phase !== 'over' && (b.white.playerId === m.me || b.black.playerId === m.me))) return;

    const w = W[this.p.style];
    const options: { u: number; run: () => void }[] = [];
    const build = this.planBuild(kings);
    if (build) options.push({ u: build.u * w.build, run: build.run });
    const attack = this.planAttack(kings);
    if (attack) options.push({ u: attack.u * w.attack, run: attack.run });
    const expand = this.planExpand(kings);
    if (expand) options.push({ u: expand.u * w.expand, run: expand.run });
    this.tuneProduction(kings);
    const gather = this.planGather(kings);
    if (gather) options.push({ u: gather.u, run: gather.run });
    options.push({ u: 0.15, run: () => {} }); // idle baseline
    // Weighted random choice, not always the best: plausibly imperfect.
    const total = options.reduce((s, o) => s + Math.max(0, o.u), 0);
    let r = Math.random() * total;
    for (const o of options) { r -= Math.max(0, o.u); if (r <= 0) { o.run(); return; } }
  }

  // ---------- economy ----------

  private findSite(type: BuildingType, near: Piece, maxR = REACH): [number, number] | null {
    const m = this.m, spec = BUILDINGS[type], size = spec.size;
    const nodes = [...m.nodes.values()].filter((n) => n.remaining > 0);
    let best: [number, number] | null = null, bestScore = -Infinity;
    for (let tries = 0; tries < 160; tries++) {
      const x = near.x + Math.round((Math.random() * 2 - 1) * maxR), y = near.y + Math.round((Math.random() * 2 - 1) * maxR);
      if (distToRect(near.x, near.y, x, y, size) > REACH) continue;
      let ok = true;
      for (let dy = 0; dy < size && ok; dy++) for (let dx = 0; dx < size && ok; dx++) {
        const sx = x + dx, sy = y + dy;
        if (!buildable(terrainAt(m.seed, sx, sy))) ok = false;
        else if (m.pieceAt.has(key(sx, sy)) && m.pieces.get(m.pieceAt.get(key(sx, sy))!)?.owner !== m.me) ok = false;
        else if (nodes.some((n) => n.x === sx && n.y === sy && n.kind !== 'wheat')) ok = false;
        else if ([...m.buildings.values()].some((b) => distToRect(sx, sy, b.x, b.y, b.size) <= 1)) ok = false;
      }
      if (!ok) continue;
      if ([...m.buildings.values()].some((b) => b.owner && b.owner !== m.me && distToRect(x, y, b.x, b.y, b.size) <= 4 + size)) continue;
      const work = (k: NodeKind) => nodes.filter((n) => n.kind === k && distToRect(n.x, n.y, x, y, size) <= WORK_AREA);
      if (spec.needs.some((k) => !work(k).length)) continue;
      const funds = (k: NodeKind) => nodes.filter((n) => n.kind === k && distToRect(n.x, n.y, x, y, size) <= REACH).reduce((s, n) => s + n.remaining, 0);
      if (Object.entries(spec.cost).some(([k, v]) => funds(k as NodeKind) < v!)) continue;
      // Prefer rich nodes and staying close to the king.
      const score = spec.needs.reduce((s, k) => s + work(k).reduce((a, n) => a + n.remaining, 0), 0) / 100 - cheb(x, y, near.x, near.y) * 0.2;
      if (score > bestScore) { bestScore = score; best = [x, y]; }
    }
    return best;
  }

  private planBuild(kings: Piece[]) {
    const m = this.m;
    if (Date.now() - this.lastBuildTry < 20_000) return null;
    const have = (t: BuildingType) => m.myBuildings().filter((b) => b.type === t).length;
    const pieces = m.myPieces().length;
    const kingsN = Math.max(1, kings.length);
    // Diminishing returns: each extra building of a type is worth less, and
    // the ideal count scales with how many kings (settlements) we have.
    const want = (t: BuildingType, base: number, per: number) => base / (1 + Math.max(0, have(t) - per * kingsN + 1) * 2);
    const wishlist: [BuildingType, number][] = [
      ['house', want('house', 1.6, pieces > 20 ? 2 : 1.5)],
      ['stable', want('stable', 1, 1)],
      ['barracks', want('barracks', 0.9, 0.7)],
      ['temple', want('temple', 0.8, 0.7)],
      ['palace', want('palace', 1.1, 0.5)],
    ];
    wishlist.sort((a, b) => b[1] - a[1]);
    for (const [type, u] of wishlist) {
      if (u < 0.1) continue;
      for (const k of kings) {
        const site = this.findSite(type, k);
        if (site) return { u, run: () => { this.lastBuildTry = Date.now(); this.conn.request({ t: 'build', building: type, at: site }).then((e) => { if (!e) this.log(`built ${type}`); }); } };
      }
    }
    this.lastBuildTry = Date.now() - 10_000;
    return null;
  }

  /** Keep a sensible army mix: pause houses when pawn-heavy (economy.md §3). */
  private tuneProduction(kings: Piece[]) {
    const mine = this.m.myPieces();
    const pawns = mine.filter((p) => p.kind === 'P').length, others = mine.length - pawns;
    const tooMany = pawns > Math.max(8 * kings.length, others * 3);
    for (const b of this.m.myBuildings()) {
      if (b.type !== 'house' || b.built < 1) continue;
      if (tooMany && !b.paused) this.conn.send({ t: 'building.pause', buildingId: b.id, paused: true });
      else if (!tooMany && b.paused && pawns < 6 * kings.length) this.conn.send({ t: 'building.pause', buildingId: b.id, paused: false });
    }
  }

  /** Pull stray pieces back to the king's side, like a tidy player would. */
  private planGather(kings: Piece[]) {
    const m = this.m;
    const strays = m.myPieces().filter((p) => p.state === 'routed' && !p.groupId);
    if (!strays.length) return null;
    const k = kings[0];
    return { u: 0.3, run: () => this.conn.send({ t: 'order.move', pieceIds: strays.map((p) => p.id).slice(0, 40), to: [k.x, k.y + 2] }) };
  }

  // ---------- war ----------

  private strengthNear(owner: string, x: number, y: number) {
    return [...this.m.pieces.values()].filter((p) => p.owner === owner && p.state !== 'battle' && cheb(p.x, p.y, x, y) <= REACH).reduce((s, p) => s + PIECE_VALUE[p.kind], 0);
  }

  private planAttack(kings: Piece[]) {
    const m = this.m;
    if (Date.now() - this.lastAttack < 60_000) return null;
    const me = m.self!;
    // Use a non-Emperor king if possible; the Emperor only fights for high risk personas.
    const leaders = kings.filter((k) => (!k.emperor || this.p.risk > 0.85) && k.state === 'idle' && (k.cooldownUntil ?? 0) < m.serverNow());
    let best: { u: number; run: () => void } | null = null;
    for (const k of leaders) {
      const group = m.myPieces().filter((p) => p.state !== 'battle' && cheb(p.x, p.y, k.x, k.y) <= REACH && (p.kind !== 'K' || p.id === k.id));
      const mine = group.reduce((s, p) => s + PIECE_VALUE[p.kind], 0);
      if (mine < 8) continue;
      for (const t of m.pieces.values()) {
        if (t.kind !== 'K' || !t.owner || t.owner === m.me || t.state === 'battle') continue;
        if ((t.protectedUntil ?? 0) > m.serverNow()) continue;
        const d = cheb(t.x, t.y, k.x, k.y);
        if (d > 70) continue;
        const theirs = this.strengthNear(t.owner, t.x, t.y);
        const opp = m.players.get(t.owner);
        // P(win) from ratings, nudged by material (bots.md §4).
        const pWin = expected(me.rating + (mine - theirs) * 40, (opp?.rating ?? 1000));
        const stake = theirs + (t.emperor ? 30 : 8) + [...m.buildings.values()].filter((b) => b.owner === t.owner && cheb(b.x, b.y, t.x, t.y) <= REACH).length * 6;
        const u = (pWin * stake - (1 - pWin) * (mine + 8) * (1 - this.p.risk)) / 20 - d / 200;
        if (u > 0 && (!best || u > best.u)) {
          const ids = group.map((p) => p.id);
          best = { u, run: () => { this.lastAttack = Date.now(); this.log(`attacks ${opp?.name ?? '?'} (${mine} vs ${theirs})`); this.conn.request({ t: 'order.attack', pieceIds: ids, targetKingId: t.id }); } };
        }
      }
    }
    return best;
  }

  /**
   * Expansion: send a spare king (with a few pawns) toward richer land.
   * The pull toward high elo is not scripted; it's the utility of richer nodes
   * (migration.md §2).
   */
  private planExpand(kings: Piece[]) {
    const m = this.m;
    if (Date.now() - this.lastExpand < 90_000 || kings.length < 2) return null;
    // Only idle kings: never re-order a king that is marching (it may be on an attack).
    const spare = kings.find((k) => !k.emperor && !m.myBuildings().some((b) => distToRect(k.x, k.y, b.x, b.y, b.size) <= REACH) && k.state === 'idle');
    const busyAnchors = kings.filter((k) => m.myBuildings().some((b) => distToRect(k.x, k.y, b.x, b.y, b.size) <= REACH));
    const mover = spare ?? (busyAnchors.length >= 2 ? busyAnchors.find((k) => !k.emperor && k.state === 'idle') : undefined);
    if (!mover) return null;
    // Sample directions; prefer higher area elo within a day's march.
    let best: [number, number] | null = null, bestScore = -Infinity;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 40;
      const x = Math.round(mover.x + Math.cos(a) * d), y = Math.round(mover.y + Math.sin(a) * d);
      if (!buildable(terrainAt(m.seed, x, y))) continue;
      const score = eloAt(m.seed, x, y) / 100 - d / 30 + Math.random();
      if (score > bestScore) { bestScore = score; best = [x, y]; }
    }
    if (!best) return null;
    const escort = m.myPieces().filter((p) => p.kind === 'P' && p.state === 'idle' && cheb(p.x, p.y, mover.x, mover.y) <= REACH).slice(0, 3);
    const target = best;
    return { u: 0.5, run: () => { this.lastExpand = Date.now(); this.conn.send({ t: 'order.move', pieceIds: [mover.id, ...escort.map((p) => p.id)], to: target }); } };
  }

  // ---------- chess ----------

  private onBattle(b: BattlePublic) {
    const m = this.m;
    const side = b.white.playerId === m.me ? 'w' : b.black.playerId === m.me ? 'b' : null;
    if (!side || b.phase !== 'live' || this.thinking.has(b.id)) return;
    const chess = new Chess(b.fen);
    if (chess.turn() !== side || chess.isGameOver()) return;
    this.thinking.add(b.id);
    this.playMove(b, chess, side).finally(() => this.thinking.delete(b.id));
  }

  private async playMove(b: BattlePublic, chess: Chess, side: 'w' | 'b') {
    const color = side === 'w' ? 'white' : 'black';
    const myClock = b.clocks[color] - (b.clocks.turnStartedAt ? this.m.serverNow() - b.clocks.turnStartedAt : 0);
    // Humans resign lost positions (bots.md §4).
    const mat = (c: 'w' | 'b') => chess.board().flat().filter((s) => s && s.color === c).reduce((s, p) => s + ({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as Record<string, number>)[p!.type], 0);
    const deficit = mat(side === 'w' ? 'b' : 'w') - mat(side);
    if (deficit >= 9 && b.moves.length > 16 && Math.random() < 0.35) {
      await sleep(lognormal(2500));
      this.conn.send({ t: 'emote', battleId: b.id, id: 0 });
      this.conn.send({ t: 'battle.resign', battleId: b.id });
      return;
    }
    // Think time: lognormal, scaled by complexity, faster when low on time.
    const legal = chess.moves().length;
    const complexity = Math.min(2.2, 0.5 + legal / 25);
    const budget = Math.max(300, myClock / 30);
    const think = Math.min(budget * 1.5, lognormal(2200 * complexity, 0.7));
    const [uci] = await Promise.all([this.ai.bestMove(b.fen, this.p.strength, 300), sleep(think)]);
    const cur = this.m.battles.get(b.id);
    if (!cur || cur.fen !== b.fen || cur.phase !== 'live') return;
    const mv = uci ?? chess.moves({ verbose: true })[0]?.lan;
    if (mv) this.conn.send({ t: 'battle.move', battleId: b.id, uci: mv });
    if (Math.random() < 0.02) this.conn.send({ t: 'emote', battleId: b.id, id: [3, 4, 5][Math.floor(Math.random() * 3)] });
  }
}
