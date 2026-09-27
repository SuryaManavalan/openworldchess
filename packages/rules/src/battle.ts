// Battle rules: assembling two partial sets into a chess position, playing it
// with clocks, and tracking which world piece is on which square (battle.md).
import { Chess, type Square } from 'chess.js';
import { CLOCK_BASE_MS, CLOCK_INC_MS, SET_COUNTS, isLight, type PieceKind } from '@owc/shared';

export interface SetPiece {
  id: number;
  kind: PieceKind;
  /** World square, for bishop color and "nearest first" picking. */
  x: number;
  y: number;
}

/**
 * Pick one battle set from candidates (battle.md §4): the king, then for each
 * type up to its standard count, the candidates nearest the arena.
 */
export function pickSet(kingId: number, candidates: SetPiece[], cx: number, cy: number): { set: SetPiece[]; reserves: SetPiece[] } {
  const byDist = [...candidates].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy) || a.id - b.id);
  const count: Record<PieceKind, number> = { K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0 };
  const set: SetPiece[] = [], reserves: SetPiece[] = [];
  const king = candidates.find((p) => p.id === kingId);
  if (king) { set.push(king); count.K = 1; }
  for (const p of byDist) {
    if (p.id === kingId) continue;
    if (p.kind !== 'K' && count[p.kind] < SET_COUNTS[p.kind]) { set.push(p); count[p.kind]++; } else reserves.push(p);
  }
  return { set, reserves };
}

const FILES = 'abcdefgh';
const PAWN_FILES = ['d', 'e', 'c', 'f', 'b', 'g', 'a', 'h'];

/** Starting squares for one side. Bishops keep their world square color. */
function placeSide(set: SetPiece[], white: boolean): Map<string, SetPiece> {
  const back = white ? '1' : '8', pawn = white ? '2' : '7';
  const out = new Map<string, SetPiece>();
  const of = (k: PieceKind) => set.filter((p) => p.kind === k);
  const king = of('K')[0];
  if (king) out.set('e' + back, king);
  const queen = of('Q')[0];
  if (queen) out.set('d' + back, queen);
  // One rook or knight takes the king-side square.
  of('R').forEach((p, i) => out.set((i === 0 ? 'h' : 'a') + back, p));
  of('N').forEach((p, i) => out.set((i === 0 ? 'g' : 'b') + back, p));
  // Light-square bishop: f1 (white) / c8 (black); dark: c1 / f8.
  const lightSq = white ? 'f' + back : 'c' + back, darkSq = white ? 'c' + back : 'f' + back;
  for (const b of of('B')) {
    const want = isLight(b.x, b.y) ? lightSq : darkSq;
    const other = want === lightSq ? darkSq : lightSq;
    out.set(out.has(want) ? other : want, b);
  }
  of('P').slice(0, 8).forEach((p, i) => out.set(PAWN_FILES[i] + pawn, p));
  return out;
}

export interface Assembled {
  fen: string;
  /** square → world piece id */
  pieceMap: Record<string, number>;
}

/** Build the starting FEN: the attacker is white and moves first (battle.md §4). */
export function assemble(white: SetPiece[], black: SetPiece[]): Assembled {
  const w = placeSide(white, true), b = placeSide(black, false);
  const board: string[][] = Array.from({ length: 8 }, () => Array(8).fill(''));
  const pieceMap: Record<string, number> = {};
  const put = (sq: string, p: SetPiece, isWhite: boolean) => {
    const file = FILES.indexOf(sq[0]), rank = Number(sq[1]);
    board[8 - rank][file] = isWhite ? p.kind : p.kind.toLowerCase();
    pieceMap[sq] = p.id;
  };
  w.forEach((p, sq) => put(sq, p, true));
  b.forEach((p, sq) => put(sq, p, false));
  const rows = board.map((row) => {
    let s = '', empty = 0;
    for (const c of row) { if (!c) empty++; else { if (empty) s += empty; empty = 0; s += c; } }
    return s + (empty ? empty : '');
  });
  let castle = '';
  if (w.get('e1')?.kind === 'K') { if (w.get('h1')?.kind === 'R') castle += 'K'; if (w.get('a1')?.kind === 'R') castle += 'Q'; }
  if (b.get('e8')?.kind === 'K') { if (b.get('h8')?.kind === 'R') castle += 'k'; if (b.get('a8')?.kind === 'R') castle += 'q'; }
  return { fen: `${rows.join('/')} w ${castle || '-'} - 0 1`, pieceMap };
}

export type Color = 'white' | 'black';

export interface MoveOutcome {
  ok: boolean;
  error?: string;
  san?: string;
  captured?: number;
  promoted?: { id: number; to: PieceKind };
  over?: { result: Color | 'draw'; termination: string };
}

/**
 * A live battle game: chess.js for the rules, plus clocks and world piece
 * tracking. Time is passed in explicitly so it stays deterministic.
 */
export class BattleGame {
  chess: Chess;
  pieceMap: Record<string, number>;
  clocks: { white: number; black: number };
  turnStartedAt: number | null = null;
  moves: string[] = [];
  killed: number[] = [];
  promoted: { id: number; to: PieceKind }[] = [];
  result: Color | 'draw' | null = null;
  termination = '';

  constructor(fen: string, pieceMap: Record<string, number>, clocks = { white: CLOCK_BASE_MS, black: CLOCK_BASE_MS }) {
    this.chess = new Chess(fen);
    this.pieceMap = { ...pieceMap };
    this.clocks = { ...clocks };
  }

  get turn(): Color { return this.chess.turn() === 'w' ? 'white' : 'black'; }
  get fen() { return this.chess.fen(); }

  start(now: number) { this.turnStartedAt = now; }

  /** Remaining time for `color` at `now`. */
  timeLeft(color: Color, now: number) {
    const base = this.clocks[color];
    return this.turn === color && this.turnStartedAt != null && !this.result ? base - (now - this.turnStartedAt) : base;
  }

  move(uci: string, now: number): MoveOutcome {
    if (this.result) return { ok: false, error: 'game over' };
    const color = this.turn;
    if (this.timeLeft(color, now) <= 0) { this.flag(now); return { ok: false, error: 'flagged', over: this.over() }; }
    let mv;
    try {
      mv = this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] as 'q' | 'r' | 'b' | 'n') ?? undefined });
    } catch { return { ok: false, error: 'illegal move' }; }
    if (!mv) return { ok: false, error: 'illegal move' };
    // clocks
    if (this.turnStartedAt != null) this.clocks[color] = this.clocks[color] - (now - this.turnStartedAt) + CLOCK_INC_MS;
    this.turnStartedAt = now;
    this.moves.push(mv.san);
    // world piece tracking
    const out: MoveOutcome = { ok: true, san: mv.san };
    const moverId = this.pieceMap[mv.from];
    delete this.pieceMap[mv.from];
    if (mv.flags.includes('e')) {
      const capSq = mv.to[0] + mv.from[1];
      out.captured = this.pieceMap[capSq];
      delete this.pieceMap[capSq];
    } else if (mv.captured) {
      out.captured = this.pieceMap[mv.to];
    }
    if (out.captured != null) this.killed.push(out.captured);
    this.pieceMap[mv.to] = moverId;
    if (mv.flags.includes('k') || mv.flags.includes('q')) {
      const rank = mv.from[1];
      const [rf, rt] = mv.flags.includes('k') ? ['h', 'f'] : ['a', 'd'];
      this.pieceMap[rt + rank] = this.pieceMap[rf + rank];
      delete this.pieceMap[rf + rank];
    }
    if (mv.promotion) {
      const to = mv.promotion.toUpperCase() as PieceKind;
      out.promoted = { id: moverId, to };
      this.promoted.push(out.promoted);
    }
    this.checkOver();
    if (this.result) out.over = this.over();
    return out;
  }

  private checkOver() {
    const c = this.chess;
    if (c.isCheckmate()) { this.result = this.turn === 'white' ? 'black' : 'white'; this.termination = 'checkmate'; }
    else if (c.isStalemate()) { this.result = 'draw'; this.termination = 'stalemate'; }
    else if (c.isInsufficientMaterial()) { this.result = 'draw'; this.termination = 'insufficient material'; }
    else if (c.isThreefoldRepetition()) { this.result = 'draw'; this.termination = 'repetition'; }
    else if (c.isDrawByFiftyMoves()) { this.result = 'draw'; this.termination = 'fifty-move rule'; }
  }

  over() { return this.result ? { result: this.result, termination: this.termination } : undefined; }

  /** Whether `color` still has enough material to mate (for flag rules). */
  canMate(color: Color): boolean {
    const mine = this.chess.board().flat().filter((s) => s && s.color === (color === 'white' ? 'w' : 'b') && s.type !== 'k');
    if (mine.some((s) => s!.type === 'q' || s!.type === 'r' || s!.type === 'p')) return true;
    return mine.length >= 2;
  }

  /** Called when the side to move has run out of time. */
  flag(now: number) {
    if (this.result) return;
    const loser = this.turn;
    const winner: Color = loser === 'white' ? 'black' : 'white';
    this.clocks[loser] = 0;
    this.turnStartedAt = now;
    if (this.canMate(winner)) { this.result = winner; this.termination = 'time'; }
    else { this.result = 'draw'; this.termination = 'time vs insufficient material'; }
  }

  resign(color: Color) {
    if (this.result) return;
    this.result = color === 'white' ? 'black' : 'white';
    this.termination = 'resignation';
  }

  agreeDraw() {
    if (this.result) return;
    this.result = 'draw';
    this.termination = 'agreement';
  }

  legalMoves(): string[] {
    return this.chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
  }

  pieceOn(sq: string) { return this.chess.get(sq as Square); }
}
