// Battles (battle.md): engagement, countdown, arena, set picking, play with
// clocks, AI stand-ins, aftermath, cooldowns and ratings.
import {
  AI_TAKEOVER_MS, CANCEL_COOLDOWN_MS, CANCEL_PROTECT_MS, FRESH_ACCOUNT_MS, COUNTDOWN_FIELD_MS, COUNTDOWN_SIEGE_MS, MIN_BATTLE_COOLDOWN_MS, REACH, FACING_DELTA,
  RENOWN, cheb, distToRect, key, type BattlePublic, type BattleSummary, type BuildingType, type Facing, type Piece, type PieceKind,
} from '@owc/shared';
import { assemble, BattleGame, glicko1, headingOf, pickSet, rdAfter, regenMs, type Color } from '@owc/rules';
import type { Game } from './game.ts';
import { ChessAI } from '@owc/engine';

interface Side { player: string; kingId: number; ids: number[] }

/** A wild camp's rating deviation as an opponent: settled, like a calibrated bot. */
const CAMP_RD = 80;

export interface BattleRec {
  pub: BattlePublic;
  game?: BattleGame;
  white: Side;
  black: Side;
  origin: Map<number, [number, number]>;
  sealed: number[];
  moveBy: { white: { human: number; ai: number }; black: { human: number; ai: number } };
  aiThinking: boolean;
  /** Where the defending king stood (for building transfer). */
  defenderAt: [number, number];
  endedAt?: number;
}

/** Battles involving camps of the wilds at once (docs/specs/wilds.md §4). */
const MAX_WILD_BATTLES = 6;

export class Battles {
  game: Game;
  recs = new Map<number, BattleRec>();
  ai = new ChessAI(2);
  onUpdate: (b: BattlePublic) => void = () => {};
  onEnd: (b: BattlePublic, s: BattleSummary, involved: string[]) => void = () => {};
  /** When each player's connection dropped (for AI takeover). */
  offlineSince = new Map<string, number>();
  /** Scales countdowns (tests use a small value). */
  countdownScale = 1;

  constructor(game: Game) { this.game = game; }

  get w() { return this.game.world; }

  active() { return [...this.recs.values()].map((r) => r.pub); }

  /** Pieces near a king in a countdown or battle can't be ordered. */
  frozen(p: Piece): boolean {
    for (const r of this.recs.values()) {
      if (r.pub.phase !== 'countdown') continue;
      for (const s of [r.white, r.black]) {
        if (p.owner !== s.player) continue;
        const k = this.w.pieces.get(s.kingId);
        if (k && cheb(k.x, k.y, p.x, p.y) <= REACH) return true;
      }
    }
    return false;
  }

  kingBusy(id: number) {
    for (const r of this.recs.values()) if (r.pub.phase !== 'over' && (r.white.kingId === id || r.black.kingId === id)) return true;
    return false;
  }

  canTarget(target: Piece, attacker: string): string | null {
    const who = target.kind === 'K' ? 'That king' : 'That troop';
    if (this.kingBusy(target.id)) return `${who} is already in a battle`;
    if ((target.protectedUntil ?? 0) > this.game.now) return `${who} is protected after a recent battle`;
    const owner = target.owner ? this.game.players.get(target.owner) : undefined;
    if (owner && owner.shieldUntil > this.game.now && this.w.elo(target.x, target.y) <= 1050) return 'That player is new and shielded';
    if (target.owner === attacker) return 'That is your own king';
    // Camps of the wilds are played by the server's engines: only so many fights at once.
    if ((this.game.wilds.campOf(target.owner) || this.game.wilds.campOf(attacker)) && this.wildBattles() >= MAX_WILD_BATTLES) return 'The wilds are restless. Try again in a minute';
    return null;
  }

  wildBattles() {
    let n = 0;
    for (const r of this.recs.values()) if (r.pub.phase !== 'over' && (this.game.wilds.campOf(r.white.player) || this.game.wilds.campOf(r.black.player))) n++;
    return n;
  }

  /** Start the countdown (battle.md §2). */
  engage(att: Piece, target: Piece): string | null {
    const g = this.game;
    if (this.kingBusy(att.id)) return 'Your king is already in a battle';
    if ((att.cooldownUntil ?? 0) > g.now) return 'This king is recovering from battle';
    const err = this.canTarget(target, att.owner!);
    if (err) return err;
    const held = this.w.buildingsNear(target.x, target.y, REACH).filter((b) => b.owner === target.owner && distToRect(target.x, target.y, b.x, b.y, b.size) <= REACH);
    const siege = held.length > 0;
    // Settlements remember being besieged: their walls rise with it (visuals.md §10).
    for (const b of held) { b.sieges = (b.sieges ?? 0) + 1; this.w.dirtyBuildings.add(b.id); }
    const cx = siege ? target.x : Math.round((att.x + target.x) / 2), cy = siege ? target.y : Math.round((att.y + target.y) / 2);
    const whiteFacing = headingOf(target.x - att.x, target.y - att.y, 0);
    const wp = g.players.get(att.owner!)!, bp = g.players.get(target.owner!)!;
    const id = this.w.id();
    const startsAt = g.now + (siege ? COUNTDOWN_SIEGE_MS : COUNTDOWN_FIELD_MS) * this.countdownScale;
    const pub: BattlePublic = {
      id, kind: siege ? 'siege' : 'field', cx, cy, whiteFacing,
      white: { playerId: wp.id, kingId: att.id, name: wp.name, rating: Math.round(wp.rating), color: wp.color },
      black: { playerId: bp.id, kingId: target.id, name: bp.name, rating: Math.round(bp.rating), color: bp.color },
      phase: 'countdown', startsAt, fen: '', moves: [], clocks: { white: 300_000, black: 300_000, turnStartedAt: null },
      result: null, pieceMap: {}, aiControlled: { white: false, black: false }, drawOfferBy: null,
    };
    this.recs.set(id, {
      pub, white: { player: wp.id, kingId: att.id, ids: [] }, black: { player: bp.id, kingId: target.id, ids: [] },
      origin: new Map(), sealed: [], moveBy: { white: { human: 0, ai: 0 }, black: { human: 0, ai: 0 } }, aiThinking: false,
      defenderAt: [target.x, target.y],
    });
    // Stop both sides where they stand.
    for (const p of this.w.piecesNear(att.x, att.y, REACH)) if (p.owner === wp.id && p.groupId) g.leaveGroup(p);
    for (const p of this.w.piecesNear(target.x, target.y, REACH)) if (p.owner === bp.id && p.groupId) g.leaveGroup(p);
    const secs = Math.round((startsAt - g.now) / 1000);
    g.onAlert(bp.id, { kind: 'attacked', text: `${wp.name} is attacking${siege ? ' your settlement' : ' your troop'}. Battle in ${secs}s`, battleId: id, at: [target.x, target.y] });
    g.onAlert(wp.id, { kind: 'battle-soon', text: `Attack declared on ${bp.name}. Battle in ${secs}s`, battleId: id, at: [cx, cy] });
    this.onUpdate(pub);
    if (process.env.LOG_BATTLES) console.log(`battle ${id}: ${wp.name} → ${bp.name} (${pub.kind})`);
    return null;
  }

  cancel(player: string, battleId: number) {
    const r = this.recs.get(battleId);
    if (!r || r.pub.phase !== 'countdown' || r.white.player !== player) return;
    const k = this.w.pieces.get(r.white.kingId);
    if (k) k.cooldownUntil = this.game.now + CANCEL_COOLDOWN_MS;
    // Calling off an attack protects the defender for a while (no freeze-and-cancel harassment).
    const dk = this.w.pieces.get(r.black.kingId);
    if (dk) dk.protectedUntil = Math.max(dk.protectedUntil ?? 0, this.game.now + CANCEL_PROTECT_MS);
    r.pub.phase = 'over'; r.pub.result = null; r.pub.termination = 'cancelled'; r.endedAt = this.game.now;
    this.onUpdate(r.pub);
    this.game.onAlert(r.black.player, { kind: 'info', text: `${r.pub.white.name} called off the attack` });
  }

  /**
   * A practice battle against the AI (ROADMAP M1): full sets, no world
   * consequences, unrated. The AI plays at the player's rating.
   */
  practice(player: string): string | null {
    const g = this.game;
    if ([...this.recs.values()].some((r) => r.pub.kind === 'practice' && r.white.player === player && r.pub.phase !== 'over')) return 'You already have a practice battle';
    // Engines are shared with real battles' AI stand-ins: cap practice games.
    if ([...this.recs.values()].filter((r) => r.pub.kind === 'practice' && r.pub.phase !== 'over').length >= 4) return 'The practice hall is full. Try again in a minute';
    const p = g.players.get(player);
    const emp = p?.emperorId ? this.w.pieces.get(p.emperorId) : undefined;
    if (!p) return 'Unknown player';
    const set = (base: number) => 'KQRRBBNNPPPPPPPP'.split('').map((k, i) => ({ id: -(base + i), kind: k as PieceKind, x: i % 2, y: 0 }));
    const { fen, pieceMap } = assemble(set(1000), set(2000));
    const id = this.w.id();
    const pub: BattlePublic = {
      id, kind: 'practice', cx: emp?.x ?? p.home[0], cy: (emp?.y ?? p.home[1]) - 12, whiteFacing: 0,
      white: { playerId: player, kingId: -1000, name: p.name, rating: Math.round(p.rating), color: p.color },
      black: { playerId: 'ai', kingId: -2000, name: 'Shadow of the Board', rating: Math.round(p.rating), color: '#8a8a8a' },
      phase: 'live', startsAt: g.now, fen, startFen: fen, moves: [], clocks: { white: 300_000, black: 300_000, turnStartedAt: g.now },
      result: null, pieceMap, aiControlled: { white: false, black: true }, drawOfferBy: null,
    };
    const rec: BattleRec = {
      pub, white: { player, kingId: -1000, ids: [] }, black: { player: 'ai', kingId: -2000, ids: [] },
      origin: new Map(), sealed: [], moveBy: { white: { human: 0, ai: 0 }, black: { human: 0, ai: 0 } }, aiThinking: false, defenderAt: [0, 0],
    };
    rec.game = new BattleGame(fen, pieceMap);
    rec.game.start(g.now);
    this.recs.set(id, rec);
    this.sync(rec);
    return null;
  }

  /** World square of a board square, given the arena's orientation. */
  boardToWorld(r: BattleRec, sq: string): [number, number] {
    const file = sq.charCodeAt(0) - 97, rank = Number(sq[1]) - 1;
    const [fx, fy] = FACING_DELTA[r.pub.whiteFacing as Facing];
    const rx = -fy, ry = fx;
    const a1x = r.pub.cx - 4 * rx - 3 * fx, a1y = r.pub.cy - 4 * ry - 3 * fy;
    return [a1x + file * rx + rank * fx, a1y + file * ry + rank * fy];
  }

  private start(r: BattleRec) {
    const g = this.game, w = this.w, now = g.now;
    const wk = w.pieces.get(r.white.kingId), bk = w.pieces.get(r.black.kingId);
    if (!wk || !bk || wk.owner !== r.white.player || bk.owner !== r.black.player) {
      r.pub.phase = 'over'; r.pub.termination = 'a king was lost before the battle'; r.endedAt = now; this.onUpdate(r.pub); return;
    }
    const eligible = (p: Piece, owner: string, k: Piece, reach = REACH) =>
      p.owner === owner && p.state !== 'battle' && cheb(p.x, p.y, k.x, k.y) <= reach && (p.id === k.id || (p.cooldownUntil ?? 0) <= now) && !this.kingBusyOther(p.id, r);
    // Walls muster (campaign.md §4.3): a walled town defends with pieces from 14 squares.
    const defender = g.players.get(r.black.player);
    const walled = r.pub.kind === 'siege' && !!defender && g.chronicle.has(defender, 'walls')
      && w.buildingsNear(bk.x, bk.y, REACH).some((b) => b.owner === r.black.player && (b.sieges ?? 0) >= 1);
    const dReach = walled ? 14 : REACH;
    const wc = w.piecesNear(wk.x, wk.y, REACH).filter((p) => eligible(p, r.white.player, wk) && (p.kind !== 'K' || p.id === wk.id));
    const bc = w.piecesNear(bk.x, bk.y, dReach).filter((p) => eligible(p, r.black.player, bk, dReach) && (p.kind !== 'K' || p.id === bk.id));
    // A raid's commander (battle.md §9) is a pawn that fights as the king, for this battle only.
    const asKing = (k: Piece) => (p: Piece) => (p.id === k.id && p.kind !== 'K' ? { ...p, kind: 'K' as const } : p);
    const ws = pickSet(wk.id, wc.map(asKing(wk)), r.pub.cx, r.pub.cy).set, bs = pickSet(bk.id, bc.map(asKing(bk)), r.pub.cx, r.pub.cy).set;
    const commanders = [wk, bk].filter((k) => k.kind !== 'K').map((k) => k.id);
    if (commanders.length) r.pub.commanders = commanders;
    const { fen, pieceMap } = assemble(ws, bs);
    r.white.ids = ws.map((p) => p.id);
    r.black.ids = bs.map((p) => p.id);
    for (const id of [...r.white.ids, ...r.black.ids]) {
      const p = w.pieces.get(id)!;
      r.origin.set(id, [p.x, p.y]);
      if (p.groupId) g.leaveGroup(p);
      p.state = 'battle';
      w.liftPiece(p);
    }
    // Seal the arena: its 64 squares plus a one-square margin.
    for (let f = -1; f <= 8; f++)
      for (let rk = -1; rk <= 8; rk++) {
        const [x, y] = this.boardToWorld(r, String.fromCharCode(97 + Math.max(0, Math.min(7, f))) + (Math.max(0, Math.min(7, rk)) + 1));
        const [fx, fy] = FACING_DELTA[r.pub.whiteFacing as Facing];
        const ox = (f < 0 ? -1 : f > 7 ? 1 : 0), oy = (rk < 0 ? -1 : rk > 7 ? 1 : 0);
        const sx = x + ox * -fy + oy * fx, sy = y + ox * fx + oy * fy;
        const k = key(sx, sy);
        if (!w.sealed.has(k)) { w.sealed.set(k, r.pub.id); r.sealed.push(k); }
      }
    r.game = new BattleGame(fen, pieceMap);
    r.pub.startFen = fen;
    r.game.start(now);
    r.pub.phase = 'live';
    if (process.env.LOG_BATTLES) console.log(`battle ${r.pub.id} starts: ${r.pub.white.name} (${ws.length}: ${ws.map((p) => p.kind).join('')}) vs ${r.pub.black.name} (${bs.length}: ${bs.map((p) => p.kind).join('')}) · ratings ${r.pub.white.rating}/${r.pub.black.rating}`);
    this.sync(r);
  }

  private kingBusyOther(id: number, r: BattleRec) {
    for (const o of this.recs.values()) if (o !== r && o.pub.phase === 'live' && (o.white.ids.includes(id) || o.black.ids.includes(id))) return true;
    return false;
  }

  private sync(r: BattleRec) {
    const gm = r.game!, now = this.game.now;
    r.pub.fen = gm.fen;
    r.pub.moves = [...gm.moves];
    r.pub.pieceMap = { ...gm.pieceMap };
    r.pub.promoted = gm.promoted.map((p) => p.id);
    r.pub.clocks = { white: gm.timeLeft('white', now), black: gm.timeLeft('black', now), turnStartedAt: gm.turnStartedAt };
    r.pub.aiControlled = { white: this.isAI(r.white.player), black: this.isAI(r.black.player) };
    this.onUpdate(r.pub);
  }

  isAI(player: string) {
    const p = this.game.players.get(player);
    if (!p) return true;
    if (p.online) return false;
    const since = this.offlineSince.get(player) ?? 0;
    return this.game.now - since >= AI_TAKEOVER_MS;
  }

  sideOf(r: BattleRec, player: string): Color | null {
    return r.white.player === player ? 'white' : r.black.player === player ? 'black' : null;
  }

  move(player: string, battleId: number, uci: string, byAI = false): string | null {
    const r = this.recs.get(battleId);
    if (!r?.game || r.pub.phase !== 'live') return 'No live battle';
    const side = byAI ? r.game.turn : this.sideOf(r, player);
    if (!side) return 'Not your battle';
    if (r.game.turn !== side) return 'Not your turn';
    const out = r.game.move(uci, this.game.now);
    if (!out.ok) { if (out.over) this.finish(r); return out.error ?? 'Illegal move'; }
    r.moveBy[side][byAI ? 'ai' : 'human']++;
    if (r.pub.drawOfferBy && r.pub.drawOfferBy !== side) r.pub.drawOfferBy = null;
    this.sync(r);
    if (out.over) this.finish(r);
    return null;
  }

  resign(player: string, battleId: number) {
    const r = this.recs.get(battleId);
    if (!r) return;
    const side = this.sideOf(r, player);
    if (!side) return;
    if (r.pub.phase === 'countdown' && side === 'black') {
      // A troop may resign during the countdown to flee early (battle.md §2).
      this.start(r);
    }
    if (!r.game || r.pub.phase !== 'live') return;
    r.game.resign(side);
    this.finish(r);
  }

  draw(player: string, battleId: number) {
    const r = this.recs.get(battleId);
    if (!r?.game || r.pub.phase !== 'live') return;
    const side = this.sideOf(r, player);
    if (!side) return;
    if (r.pub.drawOfferBy && r.pub.drawOfferBy !== side) { r.game.agreeDraw(); this.finish(r); return; }
    r.pub.drawOfferBy = side;
    this.onUpdate(r.pub);
  }

  tick(now: number) {
    for (const r of [...this.recs.values()]) {
      if (r.pub.phase === 'over') { if (now - (r.endedAt ?? now) > 12_000) this.recs.delete(r.pub.id); continue; }
      if (r.pub.phase === 'countdown') { if (now >= r.pub.startsAt) this.start(r); continue; }
      const gm = r.game!;
      if (gm.timeLeft(gm.turn, now) <= 0) { gm.flag(now); this.finish(r); continue; }
      const mover = gm.turn === 'white' ? r.white.player : r.black.player;
      const ai = this.isAI(mover);
      if (ai !== r.pub.aiControlled[gm.turn]) this.sync(r);
      if (ai && !r.aiThinking) this.aiMove(r, mover);
    }
  }

  private aiMove(r: BattleRec, player: string) {
    const gm = r.game!;
    const rating = this.game.players.get(player)?.rating ?? 1000;
    const left = gm.timeLeft(gm.turn, this.game.now);
    // Camps think quickly: they play below the area's rating anyway, and share the engines.
    const movetime = Math.max(100, Math.min(this.game.wilds.campOf(player) ? 350 : 1200, left / 60));
    r.aiThinking = true;
    const fen = gm.fen, ply = gm.moves.length;
    this.ai.bestMove(fen, rating, movetime, r.pub.kind === 'practice' ? 0 : 1).then((uci) => {
      r.aiThinking = false;
      if (!r.game || r.pub.phase !== 'live' || r.game.moves.length !== ply) return;
      const mv = uci ?? r.game.legalMoves()[0];
      if (mv) this.move(player, r.pub.id, mv, true);
    });
  }

  /** Aftermath (battle.md §7), cooldowns (§8), ratings. */
  private finish(r: BattleRec) {
    const g = this.game, w = this.w, gm = r.game!, now = g.now;
    const result = gm.result ?? 'draw';
    r.pub.phase = 'over';
    r.pub.result = result;
    r.pub.termination = gm.termination;
    r.endedAt = now;
    if (r.pub.kind === 'practice') {
      this.sync(r);
      const empty: BattleSummary = { winner: result === 'white' ? r.white.player : null, loser: null, killed: [], converted: [], routed: [], promoted: [], buildingsTransferred: [], emperorKilled: false, cooldownMs: 0, rated: false, ratingChange: {} };
      this.onEnd(r.pub, empty, [r.white.player]);
      return;
    }
    for (const k of r.sealed) w.sealed.delete(k);
    const kinds = new Map<number, PieceKind>();
    for (const id of [...r.white.ids, ...r.black.ids]) { const p = w.pieces.get(id); if (p) kinds.set(id, p.kind); }

    const summary: BattleSummary = {
      winner: null, loser: null, killed: [...gm.killed], converted: [], routed: [], promoted: gm.promoted.map((p) => p.id),
      buildingsTransferred: [], emperorKilled: false, cooldownMs: 0, rated: false, ratingChange: {},
    };
    // Promotions last only the battle (battle.md §5): the pawn walks out a pawn again.
    for (const pr of gm.promoted) { const p = w.pieces.get(pr.id); g.chronicle.note(p?.owner, 'promote'); }
    // Survivors step back into the world near their board squares.
    const survivors = new Set<number>();
    for (const [sq, id] of Object.entries(gm.pieceMap)) {
      const p = w.pieces.get(id);
      if (!p) continue;
      const [x, y] = this.boardToWorld(r, sq);
      const at = w.nearestFree(x, y, 14) ?? r.origin.get(id)!;
      w.dropPiece(p, at[0], at[1]);
      p.state = 'idle';
      survivors.add(id);
    }
    for (const id of gm.killed) g.removePiece(id);

    const winnerSide: Color | null = result === 'draw' ? null : result;
    let scattered: { camp: NonNullable<ReturnType<Game['wilds']['campOf']>>; by: string; size: number } | null = null;
    if (winnerSide) {
      const win = winnerSide === 'white' ? r.white : r.black, lose = winnerSide === 'white' ? r.black : r.white;
      // The wilds (docs/specs/wilds.md §5): creatures never change sides, and camps never take land.
      const wildWin = g.wilds.campOf(win.player), wildLose = g.wilds.campOf(lose.player);
      summary.winner = win.player; summary.loser = lose.player;
      const loserKing = w.pieces.get(lose.kingId);
      const winKing = w.pieces.get(win.kingId);
      const kingAt: [number, number] = loserKing ? [loserKing.x, loserKing.y] : r.defenderAt;
      // Newcomers' grace (campaign.md §7): through chapter 3, a king beaten by the wilds isn't
      // killed. It retreats wounded with its army and can try again, so an early loss never
      // strands a new player with no king to hunt with.
      const loserP = g.players.get(lose.player);
      const spared = !!wildWin && !!loserP?.chron && loserP.chron.ch <= 3;
      const emperor = !spared && !!loserKing?.emperor;
      summary.emperorKilled = emperor;
      // The losing king falls (unless spared).
      if (loserKing && !spared) { summary.killed.push(loserKing.id); g.removePiece(loserKing.id); }
      if (loserKing && spared) {
        loserKing.cooldownUntil = now + 10 * 60_000; loserKing.protectedUntil = now + 10 * 60_000; w.touch(loserKing);
        g.onAlert(lose.player, { kind: 'info', text: `Your ${loserKing.kind === 'K' ? 'king' : 'commander'} retreats, wounded. Rest your army and try again`, at: kingAt });
      }
      // A commander is a pawn standing in for a king (battle.md §9): a raid or a kingless troop.
      const commanderLost = !!loserKing && loserKing.kind !== 'K';
      const loserSurvivors = lose.ids.filter((id) => survivors.has(id) && id !== lose.kingId);
      // Reserves: the loser's other pieces that were within the fallen king's reach.
      const reserves = w.piecesNear(kingAt[0], kingAt[1], REACH).filter((p) => p.owner === lose.player && p.state !== 'battle' && !loserSurvivors.includes(p.id));
      // Conversions (safeguards.md §5): kit pieces and fresh accounts' pieces perish instead.
      const loserRec = g.players.get(lose.player);
      const fresh = !!loserRec && !loserRec.isBot && now - loserRec.createdAt < FRESH_ACCOUNT_MS;
      const convert = (p: Piece) => {
        if (wildLose) return; // the camp scatters below
        if (wildWin) { g.makeMasterless(p); return; }
        if (p.kit || fresh) { summary.killed.push(p.id); g.removePiece(p.id); return; }
        g.setOwner(p, win.player); summary.converted.push(p.id);
      };
      // A kingless troop beaten by an empire changes hands like any other (its commander
      // stood in for a king); only a beaten raid on the wilds costs nothing but its pawn.
      const raidLost = commanderLost && !!wildWin;
      if (!spared && !raidLost) for (const p of reserves) convert(p);
      // A beaten raid's troop walks home (it was posted out there, movement.md §4).
      if (raidLost) for (const p of [...reserves, ...loserSurvivors.map((id) => w.pieces.get(id)).filter((p): p is Piece => !!p)]) if (p.posted) { p.posted = undefined; w.touch(p); }
      if (emperor) {
        for (const id of loserSurvivors) { const p = w.pieces.get(id); if (p) convert(p); }
      } else {
        for (const id of loserSurvivors) { const p = w.pieces.get(id); if (p) { p.state = 'routed'; p.posted = undefined; w.touch(p); summary.routed.push(id); } }
      }
      // Buildings the fallen king anchored go to the winner if no other loser king still holds them.
      if (winKing && !wildWin && !wildLose) {
        for (const b of w.buildingsNear(kingAt[0], kingAt[1], REACH)) {
          if (b.owner !== lose.player || distToRect(kingAt[0], kingAt[1], b.x, b.y, b.size) > REACH) continue;
          if (!emperor && w.anchorsOf(b, lose.player).length) continue;
          b.owner = win.player; b.unanchoredSince = undefined; w.dirtyBuildings.add(b.id);
          // Capturing a kind of building opens it for you (campaign.md §8).
          const wp = g.players.get(win.player);
          if (wp && !wp.wild && b.type !== 'ruin' && b.type !== 'camp') { const st = g.chronicle.of(wp); if (!st.buildings.includes(b.type)) st.buildings.push(b.type); }
          summary.buildingsTransferred.push(b.id);
        }
      }
      if (emperor) this.fallOfEmperor(lose.player, kingAt);
      // Defeating an Emperor seizes their crown (battle.md §7): one king for the victor, within
      // their title's king cap (otherwise Renown). Not from fresh accounts (anti-farming).
      if (emperor && !wildWin && !wildLose && !fresh) {
        const wp = g.players.get(win.player);
        if (wp) {
          const kings = g.kingsOf(wp.id).length;
          if (kings < g.chronicle.kingCap(wp) && g.chronicle.grantPiece(wp, 'K', winKing ? [winKing.x, winKing.y] : kingAt)) {
            g.onAlert(wp.id, { kind: 'info', text: `You seized ${loserRec?.name ?? 'their'}'s crown: a new king joins your court`, at: kingAt });
          } else {
            g.chronicle.addRenown(wp.id, 300);
            g.onAlert(wp.id, { kind: 'info', text: 'You seized a crown, but your title allows no more kings: +300 Renown' });
          }
        }
      }
      // Cooldown: time for the winner to regenerate what they lost.
      const counts: Partial<Record<BuildingType, number>> = {};
      // Only working buildings count, at most two per king per type (safeguards.md §3).
      for (const b of w.buildings.values()) if (b.owner === win.player && b.built >= 1 && b.type !== 'ruin' && b.type !== 'camp' && !b.blocked) counts[b.type] = (counts[b.type] ?? 0) + 1;
      const cap = 2 * Math.max(1, g.kingsOf(win.player).length);
      for (const t of Object.keys(counts) as BuildingType[]) counts[t] = Math.min(counts[t]!, cap);
      const lostKinds = win.ids.filter((id) => gm.killed.includes(id)).map((id) => kinds.get(id)!).filter(Boolean);
      summary.cooldownMs = Math.max(MIN_BATTLE_COOLDOWN_MS, lostKinds.reduce((s, k) => s + regenMs(k, counts, g.speed), 0));
      for (const id of win.ids) { const p = w.pieces.get(id); if (p) { p.cooldownUntil = now + summary.cooldownMs; w.touch(p); } }
      if (winKing) winKing.protectedUntil = now + summary.cooldownMs;
      if (wildLose) scattered = { camp: wildLose, by: win.player, size: lose.ids.length };
      // Quests: battles won against other empires (campaign.md §5.2).
      if (!wildWin && !wildLose) {
        g.chronicle.note(win.player, 'win:empire');
        g.chronicle.addRenown(win.player, r.pub.kind === 'siege' ? RENOWN.siegeWin : RENOWN.empireWin);
        if (r.pub.kind === 'siege' && win === r.white) g.chronicle.note(win.player, 'win:siege');
      }
    } else {
      for (const s of [r.white, r.black]) {
        const lost = s.ids.filter((id) => gm.killed.includes(id)).map((id) => kinds.get(id)!);
        const cd = Math.max(MIN_BATTLE_COOLDOWN_MS, lost.reduce((a, k) => a + regenMs(k, {}, g.speed) / 2, 0));
        for (const id of s.ids) { const p = w.pieces.get(id); if (p) { p.cooldownUntil = now + cd; w.touch(p); } }
        const k = w.pieces.get(s.kingId); if (k) k.protectedUntil = now + cd;
        summary.cooldownMs = Math.max(summary.cooldownMs, cd);
      }
    }
    // Ratings (elo.md §1): Glicko-1, as chess.com rates games. Every battle a person or a bot
    // mostly played themselves counts, against players, bots and the wilds alike. A camp is
    // an opponent at its rating (set by its land); the camp itself doesn't change.
    const wm = r.moveBy.white, bm = r.moveBy.black;
    const humanShare = (m: { human: number; ai: number }) => (m.human + m.ai ? m.human / (m.human + m.ai) : 1);
    const a = g.players.get(r.white.player), b = g.players.get(r.black.player);
    const counts = (pl: typeof a, m: { human: number; ai: number }) => !!pl && (!!pl.wild || humanShare(m) >= 0.75);
    summary.rated = gm.moves.length >= 2 && !!a && !!b && counts(a, wm) && counts(b, bm) && !(a.wild && b.wild);
    if (summary.rated && a && b) {
      const sa = (result === 'white' ? 1 : result === 'black' ? 0 : 0.5) as 0 | 0.5 | 1;
      const days = (pl: NonNullable<typeof a>) => (pl.ratedAt ? (now - pl.ratedAt) / 86_400_000 : 0);
      // Before the game, the deviation grows back for the time away (a return after months moves fast again).
      const before = (pl: NonNullable<typeof a>) => ({ rating: pl.rating, rd: pl.wild ? CAMP_RD : rdAfter(pl.rd, days(pl)) });
      const ra = before(a), rb = before(b);
      summary.ratingChange = {};
      for (const [pl, me, opp, s] of [[a, ra, rb, sa], [b, rb, ra, (1 - sa) as 0 | 0.5 | 1]] as const) {
        if (pl.wild) continue;
        const n = glicko1(me, opp, s);
        summary.ratingChange[pl.id] = Math.round(n.rating - pl.rating);
        pl.rating = n.rating; pl.rd = n.rd; pl.ratedAt = now;
      }
      g.onPlayers();
    }
    if (process.env.LOG_BATTLES) console.log(`battle ${r.pub.id} over: ${result} by ${gm.termination} after ${gm.moves.length} plies; converted ${summary.converted.length}`);
    this.sync(r);
    for (const [side, other] of [[r.white, r.black], [r.black, r.white]] as const) {
      if (g.wilds.campOf(side.player)) continue;
      const won = summary.winner === side.player, name = g.players.get(other.player)?.name ?? 'someone';
      g.logEvent(side.player, 'battle', `${won ? 'Won' : summary.winner ? 'Lost' : 'Drew'} a ${r.pub.kind} battle against ${name} (${gm.termination})${summary.converted.length ? `, ${summary.converted.length} pieces changed sides` : ''}`);
    }
    this.onEnd(r.pub, summary, [r.white.player, r.black.player]);
    if (scattered) g.wilds.scatter(scattered.camp, scattered.by, scattered.size);
  }

  /**
   * An Emperor has fallen (progression.md §3, option b): the loser's other
   * holdings become masterless, and the loser starts again lower down.
   */
  private fallOfEmperor(player: string, at: [number, number]) {
    const g = this.game, w = this.w;
    for (const p of [...w.pieces.values()]) if (p.owner === player && p.state !== 'battle') g.makeMasterless(p);
    for (const b of w.buildings.values()) if (b.owner === player) { b.owner = null; b.unanchoredSince = g.now; w.dirtyBuildings.add(b.id); }
    const pl = g.players.get(player);
    if (!pl) return;
    pl.emperorId = null;
    g.onAlert(player, { kind: 'emperor-lost', text: 'Your Emperor has fallen. A new one rises elsewhere.' });
    g.spawn(pl, Math.max(600, pl.rating - 200), at);
    g.onAlert(player, { kind: 'respawned', text: 'You begin again in a new land.', at: pl.home });
  }

  /** On restart, battles in progress are lost: put everyone back. */
  static restoreAfterRestart(g: Game) {
    for (const p of g.world.pieces.values()) if (p.state === 'battle') { p.state = 'idle'; g.world.touch(p); }
  }
}
