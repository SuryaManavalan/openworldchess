// A client's view of the world, rebuilt from server messages. Used by the web
// client (to render), bots (to think) and tests. It only knows what the
// server has sent: no hidden information (bots.md §1).
import { LandField, landUnkey } from '@owc/worldgen';
import {
  CHUNK, chunkKey, chunkOf, key,
  type BattlePublic, type BattleSummary, type Building, type NodeState, type Piece, type PlayerPublic, type PlayerSelf, type ServerMsg, type TurnMove,
} from '@owc/shared';

export interface MoveEvent { id: number; from: [number, number]; to: [number, number]; facing: number; at: number; turn: boolean }

export class Mirror {
  self: PlayerSelf | null = null;
  seed = 0;
  /** The land's ratings (the generated map, reshaped by the empires on it; elo.md §3). */
  land = new LandField(0);
  turn = 0;
  turnMs = 600;
  /** serverTime − Date.now(), estimated. */
  clockOffset = 0;
  nextTurnAt = 0;
  pieces = new Map<number, Piece>();
  buildings = new Map<number, Building>();
  nodes = new Map<number, NodeState>();
  pieceAt = new Map<number, number>();
  traffic = new Map<number, number>();
  chunks = new Set<string>();
  players = new Map<string, PlayerPublic>();
  battles = new Map<number, BattlePublic>();
  /** Own entities, kept even outside subscribed chunks. */
  minePieces = new Set<number>();
  mineBuildings = new Set<number>();

  // Hooks for renderers and bots.
  onMoves: (moves: MoveEvent[]) => void = () => {};
  onPieceChange: (p: Piece, prev: Piece | undefined) => void = () => {};
  onPieceRemoved: (p: Piece) => void = () => {};
  onBuildingChange: (b: Building, prev: Building | undefined) => void = () => {};
  onBuildingRemoved: (id: number) => void = () => {};
  onNodeChange: (n: NodeState) => void = () => {};
  onChunk: (cx: number, cy: number) => void = () => {};
  /** A node forgotten because its chunk left the view (not depleted: no effects). */
  onNodeDropped: (k: number) => void = () => {};
  onBattle: (b: BattlePublic) => void = () => {};
  onBattleEnd: (id: number, s: BattleSummary, result: string, termination: string) => void = () => {};
  onAlert: (m: Extract<ServerMsg, { t: 'alert' }>) => void = () => {};
  onEmote: (m: Extract<ServerMsg, { t: 'emote' }>) => void = () => {};
  onError: (msg: string, rid?: number) => void = () => {};
  onAck: (rid: number) => void = () => {};
  /** A chapter of the Chronicle was completed (campaign.md): the unlock ceremony. */
  onChapter: (c: { n: number; name: string; opens: string; title?: string; coronation?: boolean }) => void = () => {};
  /** A Stripe checkout page is ready (cosmetics.md). */
  onShopUrl: (url: string) => void = () => {};
  onTurn: (n: number) => void = () => {};
  onSelf: () => void = () => {};
  onAway: (m: Extract<ServerMsg, { t: 'away' }>) => void = () => {};

  get me() { return this.self?.id ?? ''; }
  serverNow() { return Date.now() + this.clockOffset; }

  private setPiece(p: Piece) {
    const prev = this.pieces.get(p.id);
    if (prev) this.pieceAt.delete(key(prev.x, prev.y));
    this.pieces.set(p.id, p);
    if (p.state !== 'battle') this.pieceAt.set(key(p.x, p.y), p.id);
    if (p.owner === this.me) this.minePieces.add(p.id); else this.minePieces.delete(p.id);
    this.onPieceChange(p, prev);
  }

  private dropPiece(id: number) {
    const p = this.pieces.get(id);
    if (!p) return;
    if (this.pieceAt.get(key(p.x, p.y)) === id) this.pieceAt.delete(key(p.x, p.y));
    this.pieces.delete(id);
    this.minePieces.delete(id);
    this.onPieceRemoved(p);
  }

  private setBuilding(b: Building) {
    const prev = this.buildings.get(b.id);
    this.buildings.set(b.id, b);
    if (b.owner === this.me) this.mineBuildings.add(b.id); else this.mineBuildings.delete(b.id);
    this.onBuildingChange(b, prev);
  }

  private setNode(n: NodeState) {
    const k = key(n.x, n.y);
    if (n.remaining < 0) this.nodes.delete(k); else this.nodes.set(k, n);
    this.onNodeChange(n);
  }

  handle(m: ServerMsg) {
    switch (m.t) {
      case 'welcome':
        this.self = m.self; this.seed = m.seed; this.turn = m.turn; this.turnMs = m.turnMs;
        if (this.land.seed !== m.seed) this.land = new LandField(m.seed);
        this.clockOffset = m.serverTime - Date.now(); this.nextTurnAt = m.nextTurnAt;
        this.onSelf();
        break;
      case 'self': this.self = m.self; this.onSelf(); break;
      case 'chunk': {
        this.chunks.add(chunkKey(m.cx, m.cy));
        for (const p of m.pieces) this.setPiece(p);
        for (const b of m.buildings) this.setBuilding(b);
        for (const n of m.nodes) this.setNode(n);
        for (let i = 0; i < m.traffic.length; i += 2) {
          const idx = m.traffic[i];
          this.traffic.set(key(m.cx * CHUNK + (idx % CHUNK), m.cy * CHUNK + Math.floor(idx / CHUNK)), m.traffic[i + 1]);
        }
        this.onChunk(m.cx, m.cy);
        break;
      }
      case 'turn': {
        this.turn = m.n;
        this.nextTurnAt = m.at + this.turnMs;
        const events: MoveEvent[] = [];
        for (const [id, fx, fy, tx, ty, facing] of m.moves as TurnMove[]) {
          events.push({ id, from: [fx, fy], to: [tx, ty], facing, at: m.at, turn: fx === tx && fy === ty });
          const p = this.pieces.get(id);
          if (p) {
            if (this.pieceAt.get(key(p.x, p.y)) === id) this.pieceAt.delete(key(p.x, p.y));
            p.x = tx; p.y = ty; p.facing = facing as Piece['facing'];
            this.pieceAt.set(key(tx, ty), id);
            const k = key(tx, ty);
            this.traffic.set(k, Math.min(255, (this.traffic.get(k) ?? 0) + 1));
          }
        }
        for (const p of m.pieces) this.setPiece(p);
        for (const id of m.removed) this.dropPiece(id);
        for (const b of m.buildings) this.setBuilding(b);
        for (const id of m.removedBuildings) { this.buildings.delete(id); this.mineBuildings.delete(id); this.onBuildingRemoved(id); }
        for (const n of m.nodes) this.setNode(n);
        this.onMoves(events);
        this.onTurn(m.n);
        break;
      }
      case 'mine':
        for (const p of m.pieces) if (!this.pieces.has(p.id) || this.pieces.get(p.id)!.owner !== p.owner || !this.inChunks(p.x, p.y)) this.setPiece(p);
        for (const id of [...this.minePieces]) if (!m.pieces.some((p) => p.id === id)) { const p = this.pieces.get(id); if (p && p.owner === this.me) { this.minePieces.delete(id); if (!this.inChunks(p.x, p.y)) this.dropPiece(id); } }
        for (const b of m.buildings) this.setBuilding(b);
        break;
      case 'players': this.players = new Map(m.players.map((p) => [p.id, p])); break;
      case 'battles': this.battles = new Map(m.battles.map((b) => [b.id, b])); for (const b of m.battles) this.onBattle(b); break;
      case 'battle': this.battles.set(m.battle.id, m.battle); this.onBattle(m.battle); break;
      case 'battle.end': this.onBattleEnd(m.battleId, m.summary, m.result, m.termination); break;
      case 'alert': this.onAlert(m); break;
      case 'emote': this.onEmote(m); break;
      case 'away': this.onAway(m); break;
      case 'land': {
        const [x0, y0, x1, y1] = m.box;
        for (const k of [...this.land.cells.keys()]) { const [cx, cy] = landUnkey(k); if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) this.land.cells.delete(k); }
        this.land.apply(m.cells);
        break;
      }
      case 'err': this.onError(m.msg, m.rid); break;
      case 'ack': this.onAck(m.rid); break;
      case 'chapter': this.onChapter(m); break;
      case 'shop.url': this.onShopUrl(m.url); if (m.rid != null) this.onAck(m.rid); break;
      case 'pong': this.clockOffset = m.serverTime - (m.at + Date.now()) / 2; break;
    }
  }

  inChunks(x: number, y: number) { return this.chunks.has(chunkKey(...chunkOf(x, y))); }

  /** Forget chunks no longer subscribed (keeps own entities). */
  prune(keep: Set<string>) {
    for (const ck of [...this.chunks]) if (!keep.has(ck)) this.chunks.delete(ck);
    for (const p of [...this.pieces.values()]) if (p.owner !== this.me && !this.inChunks(p.x, p.y)) this.dropPiece(p.id);
    for (const b of [...this.buildings.values()]) if (b.owner !== this.me && !this.inChunks(b.x, b.y)) { this.buildings.delete(b.id); this.onBuildingRemoved(b.id); }
    for (const [k, n] of [...this.nodes]) if (!this.inChunks(n.x, n.y)) { this.nodes.delete(k); this.onNodeDropped(k); }
  }

  myPieces() { return [...this.minePieces].map((id) => this.pieces.get(id)!).filter(Boolean); }
  myKings() { return this.myPieces().filter((p) => p.kind === 'K'); }
  myBuildings() { return [...this.mineBuildings].map((id) => this.buildings.get(id)!).filter(Boolean); }
}
