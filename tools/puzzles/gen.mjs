// Shrine puzzles (docs/specs/campaign.md §5.3): positions where the side to move mates in 1 or 2
// with exactly one first move. Stockfish plays weak games to find candidates; every puzzle is
// then proved by brute force with chess.js (no engine's word is taken for it).
//
//   node tools/puzzles/gen.mjs 80   → packages/shared/src/puzzles.json
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { Chess } from '../../apps/server/node_modules/chess.js/dist/esm/chess.js';

const require = createRequire(new URL('../../packages/engine/package.json', import.meta.url));
const ENGINE = join(dirname(require.resolve('stockfish/package.json')), 'bin', 'stockfish-19-lite-single.js');
const WANT = Number(process.argv[2] ?? 80);
const OUT = process.env.OUT ?? new URL('../../packages/shared/src/puzzles.json', import.meta.url).pathname;

const sf = spawn(process.execPath, [ENGINE], { stdio: ['pipe', 'pipe', 'ignore'] });
let buf = '', waiters = [];
sf.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); for (const w of [...waiters]) w(l); } });
const send = (c) => sf.stdin.write(c + '\n');
const until = (pred) => new Promise((ok) => { const lines = []; const w = (l) => { lines.push(l); if (pred(l)) { waiters = waiters.filter((x) => x !== w); ok(lines); } }; waiters.push(w); });
send('uci'); await until((l) => l === 'uciok');
send('setoption name MultiPV value 2'); send('isready'); await until((l) => l === 'readyok');

/** Engine analysis: [{ pv: 1|2, mate: n|null, move }] */
async function analyse(fen, ms) {
  send(`position fen ${fen}`); send(`go movetime ${ms}`);
  const lines = await until((l) => l.startsWith('bestmove'));
  const best = {};
  for (const l of lines) {
    const m = l.match(/multipv (\d+) .*score (cp|mate) (-?\d+).* pv (\S+)/);
    if (m) best[m[1]] = { mate: m[2] === 'mate' ? Number(m[3]) : null, move: m[4] };
  }
  return best;
}
async function move(fen, skill) {
  send('setoption name MultiPV value 1'); send(`setoption name Skill Level value ${skill}`);
  send(`position fen ${fen}`); send('go movetime 60');
  const l = (await until((x) => x.startsWith('bestmove'))).at(-1).split(' ')[1];
  send('setoption name MultiPV value 2'); send('setoption name Skill Level value 20');
  return l;
}

// ---- proofs by brute force ----
const uci = (m) => m.from + m.to + (m.promotion ?? '');
function matesIn1(c) { const out = []; for (const m of c.moves({ verbose: true })) { c.move(m); if (c.isCheckmate()) out.push(uci(m)); c.undo(); } return out; }
/** First moves that force mate in 2 (every reply allows a mate in 1). */
function matesIn2(c) {
  const out = [];
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    let forced = !c.isCheckmate() && !c.isGameOver();
    if (forced) for (const r of c.moves({ verbose: true })) { c.move(r); const ok = matesIn1(c).length > 0; c.undo(); if (!ok) { forced = false; break; } }
    c.undo();
    if (forced) out.push(uci(m));
  }
  return out;
}

const found = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const seen = new Set(found.map((p) => p.fen));
const OPEN = ['e2e4', 'd2d4', 'c2c4', 'g1f3', 'e2e3', 'b2b3', 'g2g3', 'f2f4'];
// GAMES_FROM: start the game counter elsewhere, so parallel runs play different games.
let games = Number(process.env.GAMES_FROM ?? 0);
while (found.length < WANT) {
  games++;
  const c = new Chess();
  c.move({ from: OPEN[games % OPEN.length].slice(0, 2), to: OPEN[games % OPEN.length].slice(2, 4) });
  for (let ply = 1; ply < 140 && !c.isGameOver(); ply++) {
    const fen = c.fen();
    if (ply >= 12 && !seen.has(fen)) {
      const a = await analyse(fen, 120);
      const n = a['1']?.mate;
      // One puzzle per game (a game's positions are near-copies), and mostly mates in 2.
      if ((n === 2 || (n === 1 && games % 3 === 0)) && !found.some((f) => f.game === games)) {
        const second = a['2']?.mate;
        // Unique by the engine, then proved: exactly one first move mates in n, and none mates faster.
        if (!(second != null && second > 0 && second <= n)) {
          const m1 = matesIn1(c), sols = n === 1 ? m1 : m1.length ? [] : matesIn2(c);
          if (sols.length === 1) {
            seen.add(fen);
            found.push({ fen, n, move: sols[0], rating: 600 + n * 300 + Math.round(ply * 4), game: games });
            console.log(`${found.length}/${WANT} mate in ${n}: ${sols[0]}  (${fen})`);
            writeFileSync(OUT, JSON.stringify(found, null, 0).replace(/},{/g, '},\n{'));
          }
        }
      }
    }
    // Weak, varied play (so blunders happen), with a stronger side now and then.
    const mv = await move(fen, games % 3 === 0 ? 6 : 2);
    if (!mv || mv === '(none)') break;
    try { c.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] }); } catch { break; }
  }
}
sf.kill();
console.log(`wrote ${found.length} puzzles to ${OUT} (${games} games)`);
