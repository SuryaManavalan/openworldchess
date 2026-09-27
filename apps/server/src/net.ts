// WebSocket layer (networking.md): sessions, validation, chunk subscriptions
// and per-client filtering of world events.
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import {
  ClientMsg, PROTOCOL_VERSION, TURN_MS, chunkKey, chunkOf,
  type BattlePublic, type BattleSummary, type Building, type NodeState, type Piece, type ServerMsg, type TurnMove,
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

  turnMs: number;

  constructor(game: Game, server: Server, turnMs = TURN_MS, allow: (req: IncomingMessage) => boolean = () => true) {
    this.game = game;
    this.turnMs = turnMs;
    const wss = new WebSocketServer({ server, path: '/play', maxPayload: 64 * 1024, verifyClient: ({ req }: { req: IncomingMessage }) => allow(req) });
    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => this.connect(ws, req));
    game.onAlert = (pid, a) => { game.logEvent(pid, a.kind, a.text); this.alert(pid, a); };
    game.onPlayers = () => this.broadcastPlayers();
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
    for (const s of this.sessions) if (s.player && s.ws.readyState === s.ws.OPEN) s.ws.send(data);
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
      // New accounts per address are limited (safeguards.md §5); local bots are exempt.
      const isNew = !(msg.token && g.tokens.has(msg.token));
      const local = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(s.ip);
      if (isNew && msg.name && !local) {
        const recent = (this.newAccounts.get(s.ip) ?? []).filter((t) => now - t < 3_600_000);
        if (recent.length >= 5) return this.send(s, { t: 'err', msg: 'Too many new empires from here. Try again later', code: 'bad-name' });
        this.newAccounts.set(s.ip, recent);
      }
      const joined = g.join(msg.token, msg.name, msg.name?.startsWith('bot:') ?? false);
      if (isNew && !('error' in joined) && !local) this.newAccounts.get(s.ip)?.push(now);
      if ('error' in joined) return this.send(s, { t: 'err', msg: joined.error, code: joined.code });
      const p = joined;
      const lastSeen = p.lastSeen;
      p.leftAt = undefined;
      s.player = p;
      p.online = true; p.lastSeen = now;
      g.battles.offlineSince.delete(p.id);
      this.send(s, { t: 'welcome', v: PROTOCOL_VERSION, token: p.token, self: g.selfPlayer(p), seed: g.world.seed, turn: g.turn, turnMs: this.turnMs, serverTime: now, nextTurnAt: this.nextTurnAt });
      this.send(s, { t: 'battles', battles: g.battles.active() });
      this.sendMine(s);
      this.broadcastPlayers();
      const away = (g.events.get(p.id) ?? []).filter((e) => e.at > lastSeen);
      if (!p.isBot && now - lastSeen > 60_000 && away.length) this.send(s, { t: 'away', since: lastSeen, events: away });
      return;
    }
    if (msg.t === 'ping') return this.send(s, { t: 'pong', at: msg.at, serverTime: now });
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
      case 'order.move': if (!this.spendPath(s, now)) { reply(msg.rid, 'Too many orders at once'); break; } reply(msg.rid, g.orderMove(p.id, msg.pieceIds, msg.to)); break;
      case 'order.stop': g.orderStop(p.id, msg.pieceIds); break;
      case 'order.attack': if (!this.spendPath(s, now)) { reply(msg.rid, 'Too many orders at once'); break; } reply(msg.rid, g.orderAttack(p.id, msg.pieceIds, msg.targetKingId)); break;
      case 'order.cancelAttack': g.battles.cancel(p.id, msg.battleId); break;
      case 'build': reply(msg.rid, g.build(p.id, msg.building, msg.at)); break;
      case 'building.pause': g.setPaused(p.id, msg.buildingId, msg.paused); break;
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
        nodes: w.nodesInChunk(cx, cy).map(({ x, y, kind, capacity, remaining }) => ({ x, y, kind, capacity, remaining })),
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
      .map(({ x, y, kind, capacity, remaining, gone }) => ({ x, y, kind, capacity, remaining: gone ? -1 : remaining }));
    w.dirtyPieces.clear(); w.movedPieces.clear(); w.removedPieces.clear(); w.dirtyBuildings.clear(); w.removedBuildings.clear(); w.dirtyNodes.clear();
    const at = this.nextTurnAt - this.turnMs;
    for (const s of this.sessions) {
      if (!s.player) continue;
      const mine = s.player.id, bot = s.player.isBot;
      const seen = (p: Piece) => p.owner === mine || inSubs(s, p.x, p.y);
      // The client already knew the piece (it started in view) and gets this move: nothing else to send.
      const gotMove = (p: Piece) => { const m = moveOf.get(p.id); return !!m && m[3] === p.x && m[4] === p.y && inSubs(s, m[1], m[2]); };
      const out = pieces.filter(seen);
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
      });
    }
  }

  /** Chunks people (not bots) are looking at. */
  viewedChunks() { const out = new Set<string>(); for (const s of this.sessions) if (s.player && !s.player.isBot) for (const k of s.subs) out.add(k); return out; }

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
    this.broadcast({ t: 'battle.end', battleId: b.id, result: b.result ?? 'draw', termination: b.termination ?? '', summary });
    // Only the people involved need a fresh copy of their holdings.
    for (const s of this.sessions) if (s.player && _involved.includes(s.player.id)) this.sendMine(s);
  }
}
