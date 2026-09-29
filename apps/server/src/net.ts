// WebSocket layer (networking.md): sessions, validation, chunk subscriptions
// and per-client filtering of world events.
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import { stats } from './stats.ts';
import { LAND_CELL, landUnkey } from '@owc/worldgen';
import {
  CHUNK, ClientMsg, PROTOCOL_VERSION, TURN_MS, chunkKey, chunkOf,
  type BattlePublic, type BattleSummary, type Building, type NodeState, type Piece, type ServerMsg, type TurnMove,
  type PlayerSelf,
} from '@owc/shared';
import type { Alert, Game, PlayerRec } from './game.ts';
import { perf } from './perf.ts';
import { buyCiv, createCheckout } from './shop.ts';

interface Session {
  ws: WebSocket;
  ip: string;
  lastSub: number;
  pathBudget: number;
  lastPath: number;
  player?: PlayerRec;
  /** Watching without an empire (?watch, for filming): gets world updates, sends no orders. */
  watcher?: boolean;
  subs: Set<string>;
  watching: Set<number>;
  lastMsg: number;
  bucket: number;
}

const inSubs = (s: Session, x: number, y: number) => s.subs.has(chunkKey(...chunkOf(x, y)));

export class Net {
  game: Game;
  private lastType = '';
  sessions = new Set<Session>();
  private newAccounts = new Map<string, number[]>();
  private renamedAt = new Map<string, number>();
  nextTurnAt = 0;
  /** The client build being served (a hash of its index.html). */
  build = '';

  turnMs: number;

  constructor(game: Game, server: Server, turnMs = TURN_MS, allow: (req: IncomingMessage) => boolean = () => true) {
    this.game = game;
    this.turnMs = turnMs;
    const wss = new WebSocketServer({ server, path: '/play', maxPayload: 64 * 1024, verifyClient: ({ req }: { req: IncomingMessage }) => allow(req) });
    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => this.connect(ws, req));
    game.onAlert = (pid, a) => { game.logEvent(pid, a.kind, a.text); this.alert(pid, a); };
    game.onPlayers = () => this.broadcastPlayers();
    game.chronicle.onChapter = (pid, info) => {
      const who = game.players.get(pid); if (who && !who.isBot) stats.chapter(info.n);
      for (const s of this.sessions) if (s.player?.id === pid) { this.send(s, { t: 'chapter', ...info }); this.send(s, { t: 'self', self: game.selfPlayer(s.player) }); }
    };
    game.onSelf = (pid) => { for (const s of this.sessions) if (s.player?.id === pid) this.send(s, { t: 'self', self: game.selfPlayer(s.player) }); };
    // Camps of the wilds are only simulated where people are looking (bots don't count).
    game.wilds.viewed = () => this.viewedChunks();
    game.viewed = () => this.viewedChunks();
    game.battles.onUpdate = (b) => this.broadcast({ t: 'battle', battle: b });
    game.battles.onEnd = (b, s, involved) => this.battleEnd(b, s, involved);
  }

  private send(s: Session, m: ServerMsg) {
    if (s.ws.readyState === s.ws.OPEN) s.ws.send(JSON.stringify(m));
  }

  broadcast(m: ServerMsg) {
    const data = JSON.stringify(m);
    for (const s of this.sessions) if ((s.player || s.watcher) && s.ws.readyState === s.ws.OPEN) s.ws.send(data);
  }

  private connect(ws: WebSocket, req: IncomingMessage) {
    // CloudFront passes the viewer's address in X-Forwarded-For.
    const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
    const ip = fwd || req.socket.remoteAddress || '?';
    const s: Session = { ws, ip, subs: new Set(), watching: new Set(), lastMsg: Date.now(), bucket: 40, lastSub: 0, pathBudget: 8, lastPath: Date.now() };
    this.sessions.add(s);
    ws.on('message', (data) => { const end = perf.start('msg'); this.lastType = ''; this.onMessage(s, data.toString()); const t = this.lastType; const ms = end(); perf.add(`msg.${t ?? '?'}${s.player?.isBot ? '.bot' : ''}`, ms); });
    ws.on('close', () => {
      this.sessions.delete(s);
      if (s.player && ![...this.sessions].some((o) => o.player === s.player)) {
        s.player.online = false;
        s.player.lastSeen = Date.now();
        s.player.leftAt = Date.now();
        this.game.battles.offlineSince.set(s.player.id, Date.now());
        this.broadcastPlayers();
      }
    });
  }

  private onMessage(s: Session, raw: string) {
    // Rate limit: 20 msgs/s average, bursts to 40 (networking.md §6).
    const now = Date.now();
    s.bucket = Math.min(40, s.bucket + ((now - s.lastMsg) / 1000) * 20);
    s.lastMsg = now;
    if (s.bucket < 1) return this.send(s, { t: 'err', msg: 'Slow down' });
    s.bucket--;
    let msg: ClientMsg;
    try {
      const parsed = ClientMsg.safeParse(JSON.parse(raw));
      if (!parsed.success) return this.send(s, { t: 'err', msg: 'Bad message' });
      msg = parsed.data;
    } catch { return this.send(s, { t: 'err', msg: 'Bad JSON' }); }

    const g = this.game;
    this.lastType = msg.t;
    if (msg.t === 'hello') {
      if (msg.v !== PROTOCOL_VERSION) { s.ws.close(4001, 'upgrade-required'); return; }
      if (msg.watch) {
        // Watchers: no empire, a few at a time.
        if ([...this.sessions].filter((o) => o.watcher).length >= 10) return this.send(s, { t: 'err', msg: 'Too many watchers right now', code: 'bad-name' });
        s.watcher = true;
        const self = { id: 'watcher', name: 'Watcher', color: '#8a8a8a', emblem: 0, rating: 0, online: true, guest: false, guestGraceMs: 0, popCap: 0, emperorId: null, shieldUntil: 0, home: [0, 0] } as unknown as PlayerSelf;
        this.send(s, { t: 'welcome', v: PROTOCOL_VERSION, token: '', self, seed: g.world.seed, turn: g.turn, turnMs: this.turnMs, serverTime: now, nextTurnAt: this.nextTurnAt, build: this.build });
        this.send(s, { t: 'battles', battles: g.battles.active() });
        this.send(s, { t: 'players', players: [...g.players.values()].filter((x) => !x.wild || x.wild.awake !== false).map((x) => g.publicPlayer(x)) });
        return;
      }
      // New accounts per address are limited (safeguards.md §5); local bots are exempt.
      const isNew = !(msg.token && g.tokens.has(msg.token));
      const local = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(s.ip);
      if (isNew && msg.name && !local) {
        const recent = (this.newAccounts.get(s.ip) ?? []).filter((t) => now - t < 3_600_000);
        if (recent.length >= 5) return this.send(s, { t: 'err', msg: 'Too many new empires from here. Try again later', code: 'bad-name' });
        this.newAccounts.set(s.ip, recent);
      }
      const joined = perf.time('hello.join', () => g.join(msg.token, msg.name, msg.name?.startsWith('bot:') ?? false));
      if (isNew && !('error' in joined) && !local) this.newAccounts.get(s.ip)?.push(now);
      if ('error' in joined) return this.send(s, { t: 'err', msg: joined.error, code: joined.code });
      const p = joined;
      stats.player(p, isNew);
      const lastSeen = p.lastSeen;
      p.leftAt = undefined;
      s.player = p;
      p.online = true; p.lastSeen = now;
      g.battles.offlineSince.delete(p.id);
      const self = perf.time('hello.self', () => g.selfPlayer(p));
      this.send(s, { t: 'welcome', v: PROTOCOL_VERSION, token: p.token, self, seed: g.world.seed, turn: g.turn, turnMs: this.turnMs, serverTime: now, nextTurnAt: this.nextTurnAt, build: this.build });
      this.send(s, { t: 'battles', battles: g.battles.active() });
      perf.time('hello.mine', () => this.sendMine(s));
      perf.time('hello.land', () => this.sendLand(s));
      perf.time('hello.players', () => this.broadcastPlayers());
      const away = (g.events.get(p.id) ?? []).filter((e) => e.at > lastSeen);
      if (!p.isBot && now - lastSeen > 60_000 && away.length) this.send(s, { t: 'away', since: lastSeen, events: away });
      return;
    }
    if (msg.t === 'ping') return this.send(s, { t: 'pong', at: msg.at, serverTime: now });
    if (s.watcher) {
      if (msg.t === 'sub' && now - s.lastSub >= 250) { s.lastSub = now; this.subscribe(s, msg.chunks.slice(0, 81)); }
      return;
    }
    const p = s.player;
    if (!p) return this.send(s, { t: 'err', msg: 'Say hello first' });
    const reply = (rid: number | undefined, err: string | null) => {
      if (err) this.send(s, { t: 'err', rid, msg: err });
      else if (rid != null) this.send(s, { t: 'ack', rid });
    };
    switch (msg.t) {
      case 'sub':
        // At most ~4 subscription changes a second, 30 new chunks each (world generation is CPU).
        if (now - s.lastSub < 250) break;
        s.lastSub = now; this.subscribe(s, msg.chunks.slice(0, 81)); break;
      case 'order.move': if (!this.spendPath(s, now)) { reply(msg.rid, 'Too many orders at once'); break; } reply(msg.rid, g.orderMove(p.id, msg.pieceIds, msg.to, undefined, undefined, undefined, true)); break;
      case 'order.pave': if (!this.spendPath(s, now)) { reply(msg.rid, 'Too many orders at once'); break; } reply(msg.rid, g.works.pave(p.id, msg.pieceIds, msg.to)); break;
      case 'order.clear': reply(msg.rid, g.works.clear(p.id, msg.pieceIds, msg.a, msg.b, msg.hard)); break;
      case 'order.stop': g.orderStop(p.id, msg.pieceIds); break;
      case 'order.attack': if (!this.spendPath(s, now)) { reply(msg.rid, 'Too many orders at once'); break; } reply(msg.rid, g.orderAttack(p.id, msg.pieceIds, msg.targetKingId)); break;
      case 'order.cancelAttack': g.battles.cancel(p.id, msg.battleId); break;
      case 'build': reply(msg.rid, g.build(p.id, msg.building, msg.at)); break;
      case 'building.pause': g.setPaused(p.id, msg.buildingId, msg.paused); break;
      case 'bubble.pop': g.popBubble(p.id, msg.buildingId, msg.i); break;
      case 'palace.mode': g.setPalaceMode(p.id, msg.buildingId, msg.mode); break;
      case 'battle.move': { const e = g.battles.move(p.id, msg.battleId, msg.uci); if (e) this.send(s, { t: 'err', msg: e }); break; }
      case 'battle.resign': g.battles.resign(p.id, msg.battleId); break;
      case 'battle.draw': g.battles.draw(p.id, msg.battleId); break;
      case 'battle.watch': s.watching.add(msg.battleId); break;
      case 'battle.unwatch': s.watching.delete(msg.battleId); break;
      case 'profile': { if (now - (this.renamedAt.get(p.id) ?? 0) < 600_000) { this.send(s, { t: 'err', msg: 'You can rename once every 10 minutes' }); break; } const n = msg.name.trim(); const bad = g.checkName(n, p); if (!bad) this.renamedAt.set(p.id, now); if (!bad) { p.name = n; this.broadcastPlayers(); this.sendMine(s); } else this.send(s, { t: 'err', msg: bad }); break; }
      case 'practice': { const e = g.battles.practice(p.id); if (e) this.send(s, { t: 'err', msg: e }); break; }
      case 'shop.checkout': {
        const rid = msg.rid;
        createCheckout(p, msg.pack).then((r) => { if ('url' in r) this.send(s, { t: 'shop.url', rid, url: r.url }); else this.send(s, { t: 'err', rid, msg: r.error }); });
        break;
      }
      case 'civ.buy': reply(msg.rid, buyCiv(g, p, msg.civ)); break;
      case 'empire.reset': {
        const e = g.resetEmpire(p, msg.name);
        reply(msg.rid, e);
        if (!e) this.send(s, { t: 'self', self: g.selfPlayer(p) });
        break;
      }
      case 'capital.set': reply(msg.rid, g.chronicle.setCapital(p, msg.buildingId)); this.send(s, { t: 'self', self: g.selfPlayer(p) }); break;
      case 'quest.accept': reply(msg.rid, g.chronicle.accept(p, msg.id)); this.send(s, { t: 'self', self: g.selfPlayer(p) }); break;
      case 'quest.solve': reply(msg.rid, g.chronicle.solve(p, msg.id, msg.uci)); this.send(s, { t: 'self', self: g.selfPlayer(p) }); break;
      case 'quest.decline': g.chronicle.decline(p, msg.id); this.send(s, { t: 'self', self: g.selfPlayer(p) }); break;
      case 'muster': if (!this.spendPath(s, now)) { reply(msg.rid, 'Too many orders at once'); break; } reply(msg.rid, g.muster(p.id, msg.kingId)); break;
      case 'civ.equip': {
        // Only one you own (or null for the classic look).
        if (msg.civ === null || p.civs?.includes(msg.civ)) { p.civ = msg.civ ?? undefined; this.broadcastPlayers(); this.send(s, { t: 'self', self: g.selfPlayer(p) }); }
        else this.send(s, { t: 'err', msg: 'You do not own that civilization' });
        break;
      }
      case 'emote': this.broadcast({ t: 'emote', battleId: msg.battleId, playerId: p.id, id: msg.id }); break;
    }
  }

  /** Pathfinding costs CPU: each session gets ~2 orders a second, bursts of 6. */
  private spendPath(s: Session, now: number) {
    // Bots get less: they're many, and never in a hurry.
    const rate = s.player?.isBot ? 0.5 : 2, burst = s.player?.isBot ? 2 : 6;
    s.pathBudget = Math.min(burst, s.pathBudget + ((now - s.lastPath) / 1000) * rate);
    s.lastPath = now;
    if (s.pathBudget < 1) return false;
    s.pathBudget--;
    return true;
  }

  private subscribe(s: Session, chunks: [number, number][]) {
    const next = new Set(chunks.map(([x, y]) => chunkKey(x, y)));
    const w = this.game.world;
    let fresh = 0;
    const kept: string[] = [];
    for (const [cx, cy] of chunks) {
      const k = chunkKey(cx, cy);
      if (s.subs.has(k)) { kept.push(k); continue; }
      if (++fresh > 30) continue; // the client asks again next frame
      kept.push(k);
      this.send(s, {
        t: 'chunk', cx, cy,
        pieces: w.piecesInChunk(cx, cy),
        buildings: w.buildingsInChunk(cx, cy),
        nodes: w.nodesInChunk(cx, cy).map(({ x, y, kind, capacity, remaining, hoard }) => ({ x, y, kind, capacity, remaining, hoard })),
        traffic: w.trafficInChunk(cx, cy),
      });
    }
    s.subs = new Set(kept);
    void next;
  }

  /** After each world turn: send each client what changed in its chunks. */
  flushTurn(moves: TurnMove[]) {
    const w = this.game.world;
    const pieces: Piece[] = [...w.dirtyPieces].map((id) => w.pieces.get(id)!).filter(Boolean);
    // Pieces that only walked: a move event is enough for people who see the move;
    // bots, and anyone who didn't get the event, get the piece itself (performance.md §6).
    const walked: Piece[] = [...w.movedPieces].filter((id) => !w.dirtyPieces.has(id)).map((id) => w.pieces.get(id)!).filter(Boolean);
    const moveOf = new Map(moves.map((m) => [m[0], m]));
    const removed = [...w.removedPieces];
    const buildings: Building[] = [...w.dirtyBuildings].map((id) => w.buildings.get(id)!).filter(Boolean);
    const removedB = [...w.removedBuildings];
    const nodes: NodeState[] = [...w.dirtyNodes].map((k) => w.nodeRecByKey(k)!).filter(Boolean)
      .map(({ x, y, kind, capacity, remaining, gone, hoard }) => ({ x, y, kind, capacity, remaining: gone ? -1 : remaining, hoard }));
    const paved = w.pavedNow;
    w.pavedNow = [];
    w.dirtyPieces.clear(); w.movedPieces.clear(); w.removedPieces.clear(); w.dirtyBuildings.clear(); w.removedBuildings.clear(); w.dirtyNodes.clear();
    const at = this.nextTurnAt - this.turnMs;
    for (const s of this.sessions) {
      if (!s.player && !s.watcher) continue;
      const mine = s.player?.id ?? '', bot = !!s.player?.isBot;
      const seen = (p: Piece) => p.owner === mine || inSubs(s, p.x, p.y);
      // The client already knew the piece (it started in view) and gets this move: nothing else to send.
      const gotMove = (p: Piece) => { const m = moveOf.get(p.id); return !!m && m[3] === p.x && m[4] === p.y && inSubs(s, m[1], m[2]); };
      const out = pieces.filter(seen);
      const pavedIn = (s: Session) => { if (bot || !paved.length) return undefined; const v: number[] = []; for (let i = 0; i < paved.length; i += 2) if (inSubs(s, paved[i], paved[i + 1])) v.push(paved[i], paved[i + 1]); return v.length ? v : undefined; };
      for (const p of walked) if (seen(p) && (bot || !gotMove(p))) out.push(p);
      this.send(s, {
        t: 'turn', n: this.game.turn, at,
        // Bots don't draw: they get piece states, not the per-turn moves for animation.
        moves: bot ? [] : moves.filter((m) => inSubs(s, m[1], m[2]) || inSubs(s, m[3], m[4])),
        pieces: out,
        removed,
        buildings: buildings.filter((b) => b.owner === mine || inSubs(s, b.x, b.y)),
        removedBuildings: removedB,
        nodes: nodes.filter((n) => inSubs(s, n.x, n.y)),
        paved: pavedIn(s),
      });
    }
  }

  /** Chunks people (not bots) are looking at. */
  /** People, watchers and bots connected right now. */
  liveCounts() {
    let humans = 0, watchers = 0, bots = 0;
    for (const s of this.sessions) { if (s.watcher) watchers++; else if (s.player?.isBot) bots++; else if (s.player) humans++; }
    return { humans, watchers, bots };
  }

  viewedChunks() { const out = new Set<string>(); for (const s of this.sessions) if ((s.player && !s.player.isBot) || s.watcher) for (const k of s.subs) out.add(k); return out; }

  /** Chunks someone is looking at (kept in memory). */
  watchedChunks() { const out = new Set<string>(); for (const s of this.sessions) for (const k of s.subs) out.add(k); return out; }

  sendMine(s: Session) {
    if (!s.player) return;
    const { pieces, buildings } = this.game.holdings(s.player.id);
    this.send(s, { t: 'mine', pieces, buildings });
    this.send(s, { t: 'self', self: this.game.selfPlayer(s.player) });
  }

  sendAllMine() { for (const s of this.sessions) this.sendMine(s); }

  /** The small, often-changing part (population cap, shield): people only, bots read it from resyncs. */
  /** The shaped land around a session's empire (or where it's looking), as a box to replace (elo.md §3). */
  sendLand(s: Session) {
    const land = this.game.world.land, R = 10;
    const p = s.player;
    const at = p ? (this.game.kingsOf(p.id)[0] ?? { x: p.home[0], y: p.home[1] }) : null;
    let cx = 0, cy = 0;
    if (at) { cx = Math.floor(at.x / LAND_CELL); cy = Math.floor(at.y / LAND_CELL); }
    else if (s.subs.size) { const [x, y] = [...s.subs][0].split(',').map(Number); cx = Math.floor((x * CHUNK) / LAND_CELL); cy = Math.floor((y * CHUNK) / LAND_CELL); }
    const cells: number[] = [];
    for (const [k, v] of land.cells) { const [x, y] = landUnkey(k); if (Math.abs(x - cx) <= R && Math.abs(y - cy) <= R) cells.push(x, y, v); }
    this.send(s, { t: 'land', box: [cx - R, cy - R, cx + R, cy + R], cells });
  }
  private landSent = -1;
  /** After the land is recomputed, everyone gets the cells around them. */
  sendAllLand() {
    if (this.landSent === this.game.landVersion) return;
    this.landSent = this.game.landVersion;
    for (const s of this.sessions) if (s.player || s.watcher) this.sendLand(s);
  }

  sendAllSelf() { for (const s of this.sessions) if (s.player && !s.player.isBot) this.send(s, { t: 'self', self: this.game.selfPlayer(s.player) }); }

  private alert(pid: string, a: Alert) {
    for (const s of this.sessions) if (s.player?.id === pid) this.send(s, { t: 'alert', ...a });
  }

  private broadcastPlayers() {
    // Sleeping camps are only a record on the server: clients don't need them.
    const players = [...this.game.players.values()].filter((p) => !p.wild || p.wild.awake !== false).map((p) => this.game.publicPlayer(p));
    this.broadcast({ t: 'players', players });
  }

  private battleEnd(b: BattlePublic, summary: BattleSummary, _involved: string[]) {
    // Analytics: battles a person fought in (bot-vs-bot and bot-vs-camp don't count).
    const side = (id: string) => this.game.players.get(id);
    const w = side(b.white.playerId), k = side(b.black.playerId);
    const human = [w, k].some((x) => x && !x.isBot && !x.wild);
    if (b.kind === 'practice') { if (human) stats.battle('practice'); }
    else if (human) stats.battle(w?.wild || k?.wild ? 'wild' : 'pvp');
    this.broadcast({ t: 'battle.end', battleId: b.id, result: b.result ?? 'draw', termination: b.termination ?? '', summary });
    // Only the people involved need a fresh copy of their holdings.
    for (const s of this.sessions) if (s.player && _involved.includes(s.player.id)) this.sendMine(s);
  }
}
