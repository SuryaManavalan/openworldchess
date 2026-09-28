// A short march for profiling: one troop, 120 turns.
import { type Piece, type PieceKind } from '@owc/shared';
import { Game } from '../src/game.ts';
let rs = 12352; Math.random = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; };
const game = new Game({ seed: 7, speed: 1, wilds: false });
const w = game.world;
let now = 1_800_000_000_000;
const KIT: PieceKind[] = ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'N', 'N', 'B', 'B', 'R', 'R', 'Q'];
const p = game.join(undefined, 'Prof') as Exclude<ReturnType<Game['join']>, { error: string }>;
const king = game.kingsOf(p.id).find((k) => !k.emperor)!;
for (const kind of KIT) { const at = w.nearestFree(king.x, king.y + 2, 4); if (at) game.addPiece({ id: w.id(), owner: p.id, kind, x: at[0], y: at[1], facing: 0, state: 'idle' } as Piece); }
const troop = w.piecesNear(king.x, king.y, 6).filter((q) => q.owner === p.id && (q.kind !== 'K' || q.id === king.id));
const dest = w.nearestFree(king.x + 45, king.y + 20, 4)!;
game.orderMove(p.id, troop.map((q) => q.id), dest);
const t0 = performance.now();
let worst = 0;
for (let t = 0; t < 120; t++) { now += 600; game.now = now; const a = performance.now(); game.worldTurn(now); worst = Math.max(worst, performance.now() - a); }
console.log(`120 turns: ${((performance.now() - t0) / 120).toFixed(1)} ms/turn avg, worst ${worst.toFixed(0)} ms`);
game.battles.ai.stop();
process.exit(0);
