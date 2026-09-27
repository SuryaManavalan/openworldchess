// Battles (battle.md): engagement, countdown, arena, set picking, play with
// clocks, AI stand-ins, aftermath, cooldowns and ratings.
import {
  AI_TAKEOVER_MS, CANCEL_COOLDOWN_MS, COUNTDOWN_FIELD_MS, COUNTDOWN_SIEGE_MS, MIN_BATTLE_COOLDOWN_MS, REACH, FACING_DELTA,
  cheb, distToRect, key, type BattlePublic, type BattleSummary, type BuildingType, type Facing, type Piece, type PieceKind,
} from '@owc/shared';
import { assemble, BattleGame, glicko2, headingOf, pickSet, regenMs, type Color } from '@owc/rules';
import type { Game } from './game.ts';
import { ChessAI } from '@owc/engine';

interface Side { player: string; kingId: number; ids: number[] }

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
    if (this.kingBusy(target.id)) return 'That king is already in a battle';
    if ((target.protectedUntil ?? 0) > this.game.now) return 'That king is protected after a recent battle';
    const owner = target.owner ? this.game.players.get(target.owner) : undefined;
    if (owner && owner.shieldUntil > this.game.now && this.w.elo(target.x, target.y) <= 1050) return 'That player is new and shielded';
    if (target.owner === attacker) return 'That is your own king';
    return null;
  }

  /** Start the countdown (battle.md §2). */
  engage(att: Piece, target: Piece): string | null {
    const g = this.game;
    if (this.kingBusy(att.id)) return 'Your king is already in a battle';
    if ((att.cooldownUntil ?? 0) > g.now) return 'This king is recovering from battle';
    const err = this.canTarget(target, att.owner!);
    if (err) return err;
    const siege = this.w.buildingsNear(target.x, target.y, REACH).some((b) => b.owner === target.owner && distToRect(target.x, target.y, b.x, b.y, b.size) <= REACH);
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
      phase: 'live', startsAt: g.now, fen, moves: [], clocks: { white: 300_000, black: 300_000, turnStartedAt: g.now },
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
    const eligible = (p: Piece, owner: string, k: Piece) =>
      p.owner === owner && p.state !== 'battle' && cheb(p.x, p.y, k.x, k.y) <= REACH && (p.id === k.id || (p.cooldownUntil ?? 0) <= now) && !this.kingBusyOther(p.id, r);
    const wc = w.piecesNear(wk.x, wk.y, REACH).filter((p) => eligible(p, r.white.player, wk) && (p.kind !== 'K' || p.id === wk.id));
    const bc = w.piecesNear(bk.x, bk.y, REACH).filter((p) => eligible(p, r.black.player, bk) && (p.kind !== 'K' || p.id === bk.id));
    const ws = pickSet(wk.id, wc, r.pub.cx, r.pub.cy).set, bs = pickSet(bk.id, bc, r.pub.cx, r.pub.cy).set;
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
    r.game.start(now);
    r.pub.phase = 'live';
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
    const movetime = Math.max(100, Math.min(1200, left / 60));
    r.aiThinking = true;
    const fen = gm.fen, ply = gm.moves.length;
    this.ai.bestMove(fen, rating, movetime).then((uci) => {
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
    // Promotions are permanent (battle.md §5).
    for (const pr of gm.promoted) { const p = w.pieces.get(pr.id); if (p) g.setKind(p, pr.to); }
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
    if (winnerSide) {
      const win = winnerSide === 'white' ? r.white : r.black, lose = winnerSide === 'white' ? r.black : r.white;
      summary.winner = win.player; summary.loser = lose.player;
      const loserKing = w.pieces.get(lose.kingId);
      const winKing = w.pieces.get(win.kingId);
      const kingAt: [number, number] = loserKing ? [loserKing.x, loserKing.y] : r.defenderAt;
      const emperor = !!loserKing?.emperor;
      summary.emperorKilled = emperor;
      // The losing king falls.
      if (loserKing) { summary.killed.push(loserKing.id); g.removePiece(loserKing.id); }
      const loserSurvivors = lose.ids.filter((id) => survivors.has(id) && id !== lose.kingId);
      // Reserves: the loser's other pieces that were within the fallen king's reach.
      const reserves = w.piecesNear(kingAt[0], kingAt[1], REACH).filter((p) => p.owner === lose.player && p.state !== 'battle' && !loserSurvivors.includes(p.id));
      for (const p of reserves) { g.setOwner(p, win.player); summary.converted.push(p.id); }
      if (emperor) {
        for (const id of loserSurvivors) { const p = w.pieces.get(id); if (p) { g.setOwner(p, win.player); summary.converted.push(id); } }
      } else {
        for (const id of loserSurvivors) { const p = w.pieces.get(id); if (p) { p.state = 'routed'; w.touch(p); summary.routed.push(id); } }
      }
      // Buildings the fallen king anchored go to the winner if no other loser king still holds them.
      if (winKing) {
        for (const b of w.buildingsNear(kingAt[0], kingAt[1], REACH)) {
          if (b.owner !== lose.player || distToRect(kingAt[0], kingAt[1], b.x, b.y, b.size) > REACH) continue;
          if (!emperor && w.anchorsOf(b, lose.player).length) continue;
          b.owner = win.player; b.unanchoredSince = undefined; w.dirtyBuildings.add(b.id);
          summary.buildingsTransferred.push(b.id);
        }
      }
      if (emperor) this.fallOfEmperor(lose.player, kingAt);
      // Cooldown: time for the winner to regenerate what they lost.
      const counts: Partial<Record<BuildingType, number>> = {};
      for (const b of w.buildings.values()) if (b.owner === win.player && b.built >= 1 && b.type !== 'ruin') counts[b.type] = (counts[b.type] ?? 0) + 1;
      const lostKinds = win.ids.filter((id) => gm.killed.includes(id)).map((id) => kinds.get(id)!).filter(Boolean);
      summary.cooldownMs = Math.max(MIN_BATTLE_COOLDOWN_MS, lostKinds.reduce((s, k) => s + regenMs(k, counts, g.speed), 0));
      for (const id of win.ids) { const p = w.pieces.get(id); if (p) { p.cooldownUntil = now + summary.cooldownMs; w.touch(p); } }
      if (winKing) winKing.protectedUntil = now + summary.cooldownMs;
    } else {
      for (const s of [r.white, r.black]) {
        const lost = s.ids.filter((id) => gm.killed.includes(id)).map((id) => kinds.get(id)!);
        const cd = Math.max(MIN_BATTLE_COOLDOWN_MS, lost.reduce((a, k) => a + regenMs(k, {}, g.speed) / 2, 0));
        for (const id of s.ids) { const p = w.pieces.get(id); if (p) { p.cooldownUntil = now + cd; w.touch(p); } }
        const k = w.pieces.get(s.kingId); if (k) k.protectedUntil = now + cd;
        summary.cooldownMs = Math.max(summary.cooldownMs, cd);
      }
    }
    // Rating: only when humans (or bots, who are players) made most of the moves.
    const wm = r.moveBy.white, bm = r.moveBy.black;
    const humanShare = (m: { human: number; ai: number }) => (m.human + m.ai ? m.human / (m.human + m.ai) : 1);
    summary.rated = gm.moves.length >= 2 && humanShare(wm) >= 0.75 && humanShare(bm) >= 0.75;
    if (summary.rated) {
      const a = g.players.get(r.white.player), b = g.players.get(r.black.player);
      if (a && b) {
        const sa = result === 'white' ? 1 : result === 'black' ? 0 : 0.5;
        const na = glicko2(a, b, sa as 0 | 0.5 | 1), nb = glicko2(b, a, (1 - sa) as 0 | 0.5 | 1);
        summary.ratingChange = { [a.id]: Math.round(na.rating - a.rating), [b.id]: Math.round(nb.rating - b.rating) };
        Object.assign(a, na); Object.assign(b, nb);
        g.onPlayers();
      }
    }
    if (process.env.LOG_BATTLES) console.log(`battle ${r.pub.id} over: ${result} by ${gm.termination} after ${gm.moves.length} plies; converted ${summary.converted.length}`);
    this.sync(r);
    for (const [side, other] of [[r.white, r.black], [r.black, r.white]] as const) {
      const won = summary.winner === side.player, name = g.players.get(other.player)?.name ?? 'someone';
      g.logEvent(side.player, 'battle', `${won ? 'Won' : summary.winner ? 'Lost' : 'Drew'} a ${r.pub.kind} battle against ${name} (${gm.termination})${summary.converted.length ? `, ${summary.converted.length} pieces changed sides` : ''}`);
    }
    this.onEnd(r.pub, summary, [r.white.player, r.black.player]);
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
