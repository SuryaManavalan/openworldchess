// Idle routines (visuals.md §2): pieces with nothing to do inside a settlement
// live their own lives. Real, cheap moves that stay inside the rules: they
// keep within a king's reach and give way to any order. They never change
// outcomes: idle pieces are only moved where they'd be free to stand anyway.
import { REACH, cheb, distToRect, type Piece, type PieceKind } from '@owc/shared';
import { bestGaitMove, findPath } from '@owc/rules';
import { hash01 } from '@owc/worldgen';
import type { Game } from './game.ts';

/** How often each kind acts, in world turns. */
const PERIOD: Record<PieceKind, number> = { P: 2, N: 3, B: 4, R: 5, Q: 7, K: 11 };
/** A knight's closed circuit of L-hops: it returns home after 8 hops. */
const KNIGHT_LOOP: [number, number][] = [[2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2], [1, -2], [2, -1]];
const DRILL: [number, number][] = [[0, 0], [3, 0], [3, 3], [0, 3]];

interface Life {
  home: [number, number];
  step: number;
  since: number;
  /** Merchants: the two market squares they shuttle between, and their road. */
  trade?: { a: [number, number]; b: [number, number]; toB: boolean; path: [number, number][]; idx: number; stuck: number; wait: number };
}

/** Share of pawns that become merchants when their owner has towns to trade between. */
const MERCHANT_SHARE = 0.16;
/** Towns trade when their markets are this close (their kings' reach must connect the road). */
const TRADE_RANGE = 40;

export class Routines {
  game: Game;
  lives = new Map<number, Life>();
  constructor(game: Game) { this.game = game; }

  step(record: (p: Piece, fx: number, fy: number) => void) {
    const g = this.game, w = g.world, turn = g.turn;
    for (const p of w.pieces.values()) {
      if (p.state !== 'idle' || p.groupId || !p.owner) { this.lives.delete(p.id); continue; }
      if ((turn + p.id * 7) % PERIOD[p.kind]) continue;
      let life = this.lives.get(p.id);
      if (!life) { life = { home: [p.x, p.y], step: 0, since: turn }; this.lives.set(p.id, life); }
      if (turn - life.since < 4) continue; // settle for a moment first
      if (!g.inReach(p.owner, p.x, p.y)) continue;
      const inSettlement = w.buildingsNear(p.x, p.y, REACH).some((b) => b.owner === p.owner);
      const [hx, hy] = life.home;
      let tx = hx, ty = hy, routine = 'rest', haul = false;
      const phase = life.step++;
      // A battle nearby draws a crowd (visuals.md §9): walk to the dome's edge and watch.
      const arena = g.battles.active().find((b) => b.phase === 'live' && b.kind !== 'practice' && cheb(b.cx, b.cy, p.x, p.y) <= 16);
      if (arena) {
        const d = Math.max(1, Math.hypot(p.x - arena.cx, p.y - arena.cy));
        if (d > 8) {
          const m = bestGaitMove(p, Math.round(arena.cx + ((p.x - arena.cx) * 7.5) / d), Math.round(arena.cy + ((p.y - arena.cy) * 7.5) / d), (x, y) => w.free(x, y, p.id) && g.inReach(p.owner!, x, y), 60, 7);
          if (p.routine !== 'watch') { p.routine = 'watch'; w.touch(p); }
          if (m) { const fx = p.x, fy = p.y; p.facing = m.facing; if (!m.turn) w.movePiece(p, m.x, m.y); else w.touch(p); record(p, fx, fy); }
        }
        continue;
      }
      // Merchants carry goods between their owner's towns (visuals.md §10).
      if (p.kind === 'P' && hash01(w.seed, p.id, 3, 75) < MERCHANT_SHARE && this.trade(p, life, record)) continue;
      // Otherwise, idle life only happens inside a settlement.
      if (!inSettlement) continue;
      switch (p.kind) {
        case 'P': {
          // Most pawns haul: back and forth between a working building's door and the
          // node it draws from. Roads form along real supply lines (visuals.md §10).
          const work = w.buildingsNear(p.x, p.y, REACH).filter((b) => b.owner === p.owner && b.drawsFrom?.length && b.built >= 1);
          if (work.length && hash01(w.seed, p.id, 0, 72) < 0.75) {
            const b = work[Math.floor(hash01(w.seed, p.id, 1, 73) * work.length)];
            const [nx, ny] = b.drawsFrom![Math.floor(hash01(w.seed, p.id, 2, 74) * b.drawsFrom!.length)];
            const toNode = Math.floor(phase / 5) % 2 === 0;
            tx = toNode ? nx : b.x + (b.size >> 1); ty = toNode ? ny : b.y + b.size;
            // On the way back they carry what they gathered (the client draws the load).
            routine = toNode ? 'haul' : `haul:${w.nodeAt(nx, ny)?.kind ?? 'wheat'}`;
            haul = true;
            break;
          }
          // The rest drill: a square circuit, turning together at each corner.
          const [dx, dy] = DRILL[Math.floor(phase / 3) % 4];
          tx = hx + dx; ty = hy + dy; routine = 'drill';
          break;
        }
        case 'N': {
          let x = hx, y = hy;
          for (let i = 0; i <= phase % 8; i++) { x += KNIGHT_LOOP[i][0]; y += KNIGHT_LOOP[i][1]; }
          tx = x; ty = y; routine = 'circuit';
          break;
        }
        case 'B': {
          const d = [0, 2, 0, -2][phase % 4];
          tx = hx + d; ty = hy + (phase % 8 < 4 ? d : -d); routine = 'procession';
          break;
        }
        case 'R': { tx = hx + [0, 4, 0, -4][phase % 4]; routine = 'patrol'; break; }
        case 'Q': {
          const a = hash01(w.seed, p.id, Math.floor(phase / 2), 71) * Math.PI * 2;
          tx = phase % 2 ? hx : hx + Math.round(Math.cos(a) * 5); ty = phase % 2 ? hy : hy + Math.round(Math.sin(a) * 5);
          routine = 'survey';
          break;
        }
        case 'K': { tx = hx + (phase % 2 ? 0 : 1); routine = 'pace'; break; }
      }
      const ok = (x: number, y: number) =>
        w.free(x, y, p.id) && g.inReach(p.owner!, x, y) && (haul || cheb(x, y, hx, hy) <= 6) &&
        !w.buildingsNear(x, y, 0).some((b) => distToRect(x, y, b.x, b.y, b.size) === 0);
      const m = bestGaitMove(p, tx, ty, ok, haul ? 90 : 60, haul ? 10 : 7);
      if (p.routine !== routine) { p.routine = routine; w.touch(p); }
      if (!m) continue;
      const fx = p.x, fy = p.y;
      p.facing = m.facing;
      if (!m.turn) w.movePiece(p, m.x, m.y); else w.touch(p);
      record(p, fx, fy);
    }
  }

  /** Market squares: the center of each of the owner's settlements (kings with buildings near them). */
  private markets(owner: string): [number, number][] {
    const w = this.game.world;
    const out: [number, number][] = [];
    for (const k of this.game.kingsOf(owner)) {
      const bs = w.buildingsNear(k.x, k.y, REACH).filter((b) => b.owner === owner && b.type !== 'ruin');
      if (!bs.length) continue;
      const cx = Math.round(bs.reduce((s, b) => s + b.x + b.size / 2, 0) / bs.length), cy = Math.round(bs.reduce((s, b) => s + b.y + b.size / 2, 0) / bs.length);
      if (!out.some(([x, y]) => cheb(x, y, cx, cy) < 12)) out.push([cx, cy]);
    }
    return out;
  }

  /**
   * A merchant shuttles between two of its owner's towns along a real path.
   * It never leaves its owner's realm (every step stays within some king's
   * reach), so only towns whose territories connect can trade. Its steps wear
   * a trade road into the land between them.
   */
  private trade(p: Piece, life: Life, record: (p: Piece, fx: number, fy: number) => void): boolean {
    const g = this.game, w = g.world, owner = p.owner!;
    if (!life.trade) {
      const ms = this.markets(owner);
      if (ms.length < 2) return false;
      const here = ms.reduce((a, b) => (cheb(a[0], a[1], p.x, p.y) <= cheb(b[0], b[1], p.x, p.y) ? a : b));
      const others = ms.filter((m) => m !== here && cheb(m[0], m[1], here[0], here[1]) <= TRADE_RANGE);
      if (!others.length) return false;
      const there = others[Math.floor(hash01(w.seed, p.id, 4, 76) * others.length)];
      life.trade = { a: here, b: there, toB: true, path: [], idx: 0, stuck: 0, wait: 0 };
    }
    const t = life.trade;
    if (t.wait > 0) { t.wait--; if (p.routine !== 'trade') { p.routine = 'trade'; w.touch(p); } return true; }
    const dest = t.toB ? t.b : t.a;
    const walk = (x: number, y: number) => w.walkable(x, y) && g.inReach(owner, x, y);
    if (!t.path.length || t.idx >= t.path.length) {
      if (cheb(p.x, p.y, dest[0], dest[1]) <= 2) {
        // Arrived at market: trade for a little while, then head back with the other town's goods.
        t.toB = !t.toB; t.path = []; t.wait = 6 + Math.floor(hash01(w.seed, p.id, g.turn, 77) * 6);
        return true;
      }
      t.path = findPath(p.x, p.y, dest[0], dest[1], walk, 4000);
      t.idx = 0;
      if (!t.path.length) { life.trade = undefined; return false; }
    }
    // Follow the road a few squares ahead (a pawn turns before it walks).
    const [tx, ty] = t.path[Math.min(t.path.length - 1, t.idx + 3)];
    const m = bestGaitMove(p, tx, ty, (x, y) => w.free(x, y, p.id) && g.inReach(owner, x, y), 80, 8);
    const routine = t.toB ? 'merchant' : 'merchant:back';
    if (p.routine !== routine) { p.routine = routine; w.touch(p); }
    if (!m) { if (++t.stuck > 6) { t.path = []; t.stuck = 0; } return true; }
    const fx = p.x, fy = p.y;
    p.facing = m.facing;
    if (!m.turn) w.movePiece(p, m.x, m.y); else w.touch(p);
    record(p, fx, fy);
    t.stuck = 0;
    while (t.idx < t.path.length && cheb(p.x, p.y, t.path[t.idx][0], t.path[t.idx][1]) <= 1) t.idx++;
    return true;
  }
}
