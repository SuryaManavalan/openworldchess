// WebSocket layer (networking.md): sessions, validation, chunk subscriptions
// and per-client filtering of world events.
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import {
  ClientMsg, PROTOCOL_VERSION, TURN_MS, chunkKey, chunkOf,
  type BattlePublic, type BattleSummary, type Building, type NodeState, type Piece, type ServerMsg, type TurnMove,
} from '@owc/shared';
import type { Alert, Game, PlayerRec } from './game.ts';

interface Session {
  ws: WebSocket;
  player?: PlayerRec;
  subs: Set<string>;
  watching: Set<number>;
  lastMsg: number;
  bucket: number;
}

const inSubs = (s: Session, x: number, y: number) => s.subs.has(chunkKey(...chunkOf(x, y)));

export class Net {
  game: Game;
  sessions = new Set<Session>();
  nextTurnAt = 0;

  turnMs: number;

  constructor(game: Game, server: Server, turnMs = TURN_MS) {
    this.game = game;
    this.turnMs = turnMs;
    const wss = new WebSocketServer({ server, path: '/play', maxPayload: 64 * 1024 });
    wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => this.connect(ws));
    game.onAlert = (pid, a) => { game.logEvent(pid, a.kind, a.text); this.alert(pid, a); };
    game.onPlayers = () => this.broadcastPlayers();
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

  private connect(ws: WebSocket) {
    const s: Session = { ws, subs: new Set(), watching: new Set(), lastMsg: Date.now(), bucket: 40 };
    this.sessions.add(s);
    ws.on('message', (data) => this.onMessage(s, data.toString()));
    ws.on('close', () => {
      this.sessions.delete(s);
      if (s.player && ![...this.sessions].some((o) => o.player === s.player)) {
        s.player.online = false;
        s.player.lastSeen = Date.now();
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
    if (msg.t === 'hello') {
      if (msg.v !== PROTOCOL_VERSION) { s.ws.close(4001, 'upgrade-required'); return; }
      const p = g.join(msg.token, msg.name, msg.name?.startsWith('bot:') ?? false);
      const lastSeen = p.lastSeen;
      if (p.isBot && p.name.startsWith('bot:')) p.name = p.name.slice(4);
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
      case 'sub': this.subscribe(s, msg.chunks); break;
      case 'order.move': reply(msg.rid, g.orderMove(p.id, msg.pieceIds, msg.to)); break;
      case 'order.stop': g.orderStop(p.id, msg.pieceIds); break;
      case 'order.attack': reply(msg.rid, g.orderAttack(p.id, msg.pieceIds, msg.targetKingId)); break;
      case 'order.cancelAttack': g.battles.cancel(p.id, msg.battleId); break;
      case 'build': reply(msg.rid, g.build(p.id, msg.building, msg.at)); break;
      case 'building.pause': g.setPaused(p.id, msg.buildingId, msg.paused); break;
      case 'palace.mode': g.setPalaceMode(p.id, msg.buildingId, msg.mode); break;
      case 'battle.move': { const e = g.battles.move(p.id, msg.battleId, msg.uci); if (e) this.send(s, { t: 'err', msg: e }); break; }
      case 'battle.resign': g.battles.resign(p.id, msg.battleId); break;
      case 'battle.draw': g.battles.draw(p.id, msg.battleId); break;
      case 'battle.watch': s.watching.add(msg.battleId); break;
      case 'battle.unwatch': s.watching.delete(msg.battleId); break;
      case 'profile': { const n = msg.name.trim().replace(/[^\p{L}\p{N}_ .-]/gu, ''); if (n.length >= 2 && ![...g.players.values()].some((o) => o !== p && o.name.toLowerCase() === n.toLowerCase())) { p.name = n; this.broadcastPlayers(); this.sendMine(s); } else this.send(s, { t: 'err', msg: 'That name is taken' }); break; }
      case 'practice': { const e = g.battles.practice(p.id); if (e) this.send(s, { t: 'err', msg: e }); break; }
      case 'emote': this.broadcast({ t: 'emote', battleId: msg.battleId, playerId: p.id, id: msg.id }); break;
    }
  }

  private subscribe(s: Session, chunks: [number, number][]) {
    const next = new Set(chunks.map(([x, y]) => chunkKey(x, y)));
    const w = this.game.world;
    for (const [cx, cy] of chunks) {
      const k = chunkKey(cx, cy);
      if (s.subs.has(k)) continue;
      this.send(s, {
        t: 'chunk', cx, cy,
        pieces: w.piecesInChunk(cx, cy),
        buildings: w.buildingsInChunk(cx, cy),
        nodes: w.nodesInChunk(cx, cy).map(({ x, y, kind, capacity, remaining }) => ({ x, y, kind, capacity, remaining })),
        traffic: w.trafficInChunk(cx, cy),
      });
    }
    s.subs = next;
  }

  /** After each world turn: send each client what changed in its chunks. */
  flushTurn(moves: TurnMove[]) {
    const w = this.game.world;
    const pieces: Piece[] = [...w.dirtyPieces].map((id) => w.pieces.get(id)!).filter(Boolean);
    const removed = [...w.removedPieces];
    const buildings: Building[] = [...w.dirtyBuildings].map((id) => w.buildings.get(id)!).filter(Boolean);
    const removedB = [...w.removedBuildings];
    const nodes: NodeState[] = [...w.dirtyNodes].map((k) => w.nodeRecByKey(k)!).filter(Boolean)
      .map(({ x, y, kind, capacity, remaining, gone }) => ({ x, y, kind, capacity, remaining: gone ? -1 : remaining }));
    w.dirtyPieces.clear(); w.removedPieces.clear(); w.dirtyBuildings.clear(); w.removedBuildings.clear(); w.dirtyNodes.clear();
    const at = this.nextTurnAt - this.turnMs;
    for (const s of this.sessions) {
      if (!s.player) continue;
      const mine = s.player.id;
      this.send(s, {
        t: 'turn', n: this.game.turn, at,
        moves: moves.filter((m) => inSubs(s, m[1], m[2]) || inSubs(s, m[3], m[4])),
        pieces: pieces.filter((p) => p.owner === mine || inSubs(s, p.x, p.y)),
        removed,
        buildings: buildings.filter((b) => b.owner === mine || inSubs(s, b.x, b.y)),
        removedBuildings: removedB,
        nodes: nodes.filter((n) => inSubs(s, n.x, n.y)),
      });
    }
  }

  sendMine(s: Session) {
    if (!s.player) return;
    const { pieces, buildings } = this.game.holdings(s.player.id);
    this.send(s, { t: 'mine', pieces, buildings });
    this.send(s, { t: 'self', self: this.game.selfPlayer(s.player) });
  }

  sendAllMine() { for (const s of this.sessions) this.sendMine(s); }

  private alert(pid: string, a: Alert) {
    for (const s of this.sessions) if (s.player?.id === pid) this.send(s, { t: 'alert', ...a });
  }

  private broadcastPlayers() {
    const players = [...this.game.players.values()].map((p) => this.game.publicPlayer(p));
    this.broadcast({ t: 'players', players });
  }

  private battleEnd(b: BattlePublic, summary: BattleSummary, _involved: string[]) {
    this.broadcast({ t: 'battle.end', battleId: b.id, result: b.result ?? 'draw', termination: b.termination ?? '', summary });
    this.sendAllMine();
  }
}
