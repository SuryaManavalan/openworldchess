// March benchmark (movement.md): troops ordered across real terrain (woods,
// lakes, rivers). Measures how long they take and how many pieces get left
// behind, so movement changes can be judged by numbers.
//
//   node apps/server/bench/march.ts [trials=24] [seed=7]
import { cheb, type Piece, type PieceKind } from '@owc/shared';
import { Game } from '../src/game.ts';
import { findPathLong } from '@owc/rules';

const TRIALS = Number(process.argv[2] ?? 24);
const SEED = Number(process.argv[3] ?? 7);
let rs = 12345 + SEED;
Math.random = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; };

const game = new Game({ seed: SEED, speed: 1, wilds: false });
// Like the live server with a player watching every march: real time budgets for route planning.
if (!process.env.OFFLINE) game.viewed = () => ({ has: () => true, size: 1 }) as unknown as Set<string>;
const w = game.world;
let now = 1_800_000_000_000;

// A mixed troop: king, 8 pawns, 2 knights, 2 bishops, 2 elephants (rooks), a queen.
const KIT: PieceKind[] = ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'N', 'N', 'B', 'B', 'R', 'R', 'Q'];

type Result = { dist: number; turns: number; kingTurns: number; arrived: boolean; left: number; size: number; felled: number };
const results: Result[] = [];
const t0 = performance.now();
let turnMs = 0;
for (let trial = 0; trial < TRIALS; trial++) {
  const p = game.join(undefined, `March${trial}`) as Exclude<ReturnType<Game['join']>, { error: string }>;
  const king = game.kingsOf(p.id).find((k) => !k.emperor) ?? game.kingsOf(p.id)[0];
  // Give the king a full troop around it.
  for (const kind of KIT) {
    const at = w.nearestFree(king.x, king.y + 2, 4);
    if (at) game.addPiece({ id: w.id(), owner: p.id, kind, x: at[0], y: at[1], facing: 0, state: 'idle' } as Piece);
  }
  const troop = w.piecesNear(king.x, king.y, 6).filter((q) => q.owner === p.id && (q.kind !== 'K' || q.id === king.id));
  // A destination 40–70 squares away, on walkable ground.
  let dest: [number, number] | null = null;
  for (let i = 0; i < 50 && !dest; i++) {
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 30;
    const tx = Math.round(king.x + Math.cos(a) * d), ty = Math.round(king.y + Math.sin(a) * d);
    dest = w.nearestFree(tx, ty, 4);
    // Only destinations a walker can actually reach (not an island or a lake-locked spit).
    if (dest) { const e = findPathLong(king.x, king.y, dest[0], dest[1], (x, y) => w.walkable(x, y), 40000, 5000).at(-1); if (!e || cheb(e[0], e[1], dest[0], dest[1]) > 2) dest = null; }
  }
  if (!dest) continue;
  const trees0 = w.nodesNear(king.x, king.y, 1, 90).filter((n) => n.kind === 'tree' && n.remaining > 0).length;
  const d0 = cheb(king.x, king.y, dest[0], dest[1]);
  const king0: [number, number] = [king.x, king.y];
  game.orderMove(p.id, troop.map((q) => q.id), dest);
  let turns = 0, kingTurns = -1;
  for (; turns < 1500; turns++) {
    now += 600; game.now = now;
    { const a = performance.now(); game.worldTurn(now); turnMs += performance.now() - a; }
    if (kingTurns < 0) { const kk = w.pieces.get(king.id)!; if (cheb(kk.x, kk.y, dest[0], dest[1]) <= 3) kingTurns = turns; }
    if (!troop.some((q) => w.pieces.get(q.id)?.groupId)) break;
    // TRACE=1: every 40 turns, why is the lead waiting?
    if (process.env.TRACE && (process.env.TRACE_TRIAL == null || Number(process.env.TRACE_TRIAL) === trial) && turns % 40 === 0) {
      const gid = w.pieces.get(king.id)?.groupId, g = gid != null ? game.groups.get(gid) : undefined;
      if (g) {
        const st = g.state;
        const mine = troop.map((q) => w.pieces.get(q.id)!).filter((q) => q.groupId === gid);
        const far = mine.filter((q) => (st.along?.[q.id] ?? -1) < st.pathIdx - 1 - Math.ceil(mine.length / 3) - 3).map((q) => ({ k: q.kind, along: st.along?.[q.id], stuck: st.stuck[q.id] ?? 0, route: st.routes?.[q.id] ? `${st.routes[q.id].i}/${st.routes[q.id].pts.length}` : '-' }));
        console.log(`t${turns} path ${st.pathIdx}/${st.path.length} treeWait ${st.treeWait ?? 0} avoid ${!!st.avoidTrees} far: ${JSON.stringify(far)}`);
      }
    }
  }
  const k = w.pieces.get(king.id)!;
  const arrived = cheb(k.x, k.y, dest[0], dest[1]) <= 3;
  // Left behind: troop pieces not within 6 squares of the king when the march ends.
  const left = troop.filter((q) => { const c = w.pieces.get(q.id); return c && cheb(c.x, c.y, k.x, k.y) > 6; }).length;
  const trees1 = w.nodesNear(king.x, king.y, 1, 90).filter((n) => n.kind === 'tree' && n.remaining > 0).length;
  if (process.env.TRACE) console.log(`trial ${trial}: ${arrived ? 'arrived' : 'NOT arrived'} in ${kingTurns} turns over ${d0} squares, left ${left}`);
  if (process.env.TRACE && !arrived) {
    const full = findPathLong(king0[0], king0[1], dest[0], dest[1], (x, y) => w.walkable(x, y), 200000, 60000);
    const e = full.at(-1);
    console.log(`  reachable on foot? path ${full.length} squares, ends ${e ? cheb(e[0], e[1], dest[0], dest[1]) : '?'} from the destination; king ended ${cheb(k.x, k.y, dest[0], dest[1])} away`);
  }
  results.push({ dist: d0, turns, kingTurns: kingTurns < 0 ? turns : kingTurns, arrived, left, size: troop.length, felled: Math.max(0, trees0 - trees1) });
}
const ms = performance.now() - t0;
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const perSquare = results.map((r) => r.kingTurns / r.dist);
const settle = results.map((r) => r.turns / r.dist);
console.log(`trials ${results.length}, troop size ${results[0]?.size}`);
console.log(`arrived: ${results.filter((r) => r.arrived).length}/${results.length}`);
console.log(`king's turns per square to arrive: median ${med(perSquare).toFixed(2)}, worst ${Math.max(...perSquare).toFixed(2)}  (1.00 = a pawn walking straight)`);
console.log(`turns per square until the troop settles: median ${med(settle).toFixed(2)}`);
console.log(`left behind: ${results.reduce((a, r) => a + r.left, 0)} of ${results.reduce((a, r) => a + r.size, 0)} pieces; marches with any left behind: ${results.filter((r) => r.left).length}`);
console.log(`trees felled on the way: ${results.reduce((a, r) => a + r.felled, 0)}`);
console.log(`cpu: ${(turnMs / results.reduce((a, r) => a + r.turns, 0)).toFixed(2)} ms per troop-turn (world turns only)`); void ms;
game.battles.ai.stop();
process.exit(0);
