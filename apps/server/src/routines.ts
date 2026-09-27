// Idle routines (visuals.md §2): pieces with nothing to do inside a settlement
// live their own lives. Real, cheap moves that stay inside the rules: they
// keep within a king's reach and give way to any order. They never change
// outcomes: idle pieces are only moved where they'd be free to stand anyway.
import { REACH, cheb, distToRect, type Piece, type PieceKind } from '@owc/shared';
import { bestGaitMove } from '@owc/rules';
import { hash01 } from '@owc/worldgen';
import type { Game } from './game.ts';

/** How often each kind acts, in world turns. */
const PERIOD: Record<PieceKind, number> = { P: 2, N: 3, B: 4, R: 5, Q: 7, K: 11 };
/** A knight's closed circuit of L-hops: it returns home after 8 hops. */
const KNIGHT_LOOP: [number, number][] = [[2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2], [1, -2], [2, -1]];
const DRILL: [number, number][] = [[0, 0], [3, 0], [3, 3], [0, 3]];

interface Life { home: [number, number]; step: number; since: number }

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
      let tx = hx, ty = hy, routine = 'rest';
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
      // Otherwise, idle life only happens inside a settlement.
      if (!inSettlement) continue;
      switch (p.kind) {
        case 'P': {
          // Pawns drill: a square circuit, turning together at each corner.
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
        w.free(x, y, p.id) && g.inReach(p.owner!, x, y) && cheb(x, y, hx, hy) <= 6 &&
        !w.buildingsNear(x, y, 0).some((b) => distToRect(x, y, b.x, b.y, b.size) === 0);
      const m = bestGaitMove(p, tx, ty, ok, 60, 7);
      if (p.routine !== routine) { p.routine = routine; w.touch(p); }
      if (!m) continue;
      const fx = p.x, fy = p.y;
      p.facing = m.facing;
      if (!m.turn) w.movePiece(p, m.x, m.y); else w.touch(p);
      record(p, fx, fy);
    }
  }
}
