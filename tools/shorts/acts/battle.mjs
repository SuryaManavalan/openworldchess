// Acts: things staged players do while a shot is filming (tools/shorts/README.md).
// Each act gets the capture context: { browser, page (the camera), env (scenario.env.json), args }.
// Players play in their own browser tab, signed in with the scenario's tokens; their moves
// in battle come from our chess engine, so every game filmed is a real game.
import { ChessAI } from '../../../packages/engine/src/ai.ts';
import { Chess } from '../../../apps/server/node_modules/chess.js/dist/esm/chess.js';

const pages = new Map();
let ai = null;
const engine = () => (ai ??= new ChessAI(1));
export function stop() { ai?.stop(); ai = null; }

/** A tab signed in as one of the scenario's players. */
export async function player(ctx, name) {
  if (pages.has(name)) return pages.get(name);
  const c = await ctx.browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
  const p = await c.newPage();
  await p.goto(ctx.env.base + '/');
  await p.evaluate((t) => { localStorage.setItem('owc.token', t); localStorage.setItem('owc.onboarded', '1'); localStorage.setItem('owc.storySeen', '99'); }, ctx.env.tokens[name]);
  await p.goto(ctx.env.base + '/');
  await p.waitForFunction(() => window.__owc?.mirror?.self, null, { timeout: 30_000 });
  // Look at the staged spot (the Emperor is parked far away), so its pieces are loaded.
  await p.evaluate(([x, y]) => window.__owc.scene.centerOn(x, y), ctx.env.center);
  await p.waitForTimeout(3000);
  pages.set(name, p);
  return p;
}

/** `as`'s king (and its army) attacks `target`'s nearest king; confirms the sheet. */
export async function attack(ctx, { as, target }) {
  const p = await player(ctx, as);
  const ok = await p.evaluate((target) => {
    const o = window.__owc, m = o.mirror;
    const k = m.myKings().find((q) => !q.emperor) ?? m.myKings()[0];
    const foe = [...m.players.values()].find((x) => x.name === target);
    const tk = [...m.pieces.values()].filter((q) => q.owner === foe?.id && q.kind === 'K' && !q.emperor).sort((a, b) => Math.hypot(a.x - k.x, a.y - k.y) - Math.hypot(b.x - k.x, b.y - k.y))[0];
    if (!k || !tk) return false;
    o.ui.getState().select(o.input.armyOf(k));
    o.input.issue([tk.x, tk.y], tk);
    return true;
  }, target);
  if (!ok) throw new Error('attack: no kings found');
  await p.getByRole('button', { name: /Attack/ }).last().click();
}

async function battleOf(p) {
  return p.evaluate(() => { const m = window.__owc.mirror; const b = [...m.battles.values()].reverse().find((x) => x.phase !== 'over' && (x.white.playerId === m.me || x.black.playerId === m.me)); return b && { id: b.id, fen: b.fen, phase: b.phase, white: b.white.playerId === m.me }; });
}

async function click(p, uci, white) {
  const r = await p.locator('.battle .board').boundingBox();
  const at = (s) => { const f = s.charCodeAt(0) - 97, rk = Number(s[1]); return white ? [r.x + (f + 0.5) * r.width / 8, r.y + (8 - rk + 0.5) * r.height / 8] : [r.x + (7 - f + 0.5) * r.width / 8, r.y + (rk - 1 + 0.5) * r.height / 8]; };
  await p.mouse.click(...at(uci.slice(0, 2)));
  await p.waitForTimeout(150);
  await p.mouse.click(...at(uci.slice(2, 4)));
  if (uci.length > 4) { await p.waitForTimeout(250); await p.locator('.promo button').first().click(); }
}

/**
 * Wait for `as`'s battle to go live, open it, and play engine moves until the next move mates.
 * `by` (a piece letter, e.g. 'r'): stop as soon as that piece has a mate, so it delivers it.
 */
export async function playToMateIn1(ctx, { as, maxMs = 240_000, by }) {
  const p = await player(ctx, as);
  const until = Date.now() + maxMs;
  let b;
  while (Date.now() < until) { b = await battleOf(p); if (b?.phase === 'live') break; await p.waitForTimeout(400); }
  if (!b) throw new Error('no battle');
  await p.evaluate((id) => window.__owc.ui.getState().set({ battleFocus: id }), b.id);
  await p.waitForSelector('.battle .board');
  while (Date.now() < until) {
    b = await battleOf(p);
    if (!b || b.phase !== 'live') throw new Error('the battle ended before a mate in one');
    const mine = (b.fen.split(' ')[1] === 'w') === b.white;
    if (!mine) { await p.waitForTimeout(250); continue; }
    if (by) {
      const g = new Chess(b.fen);
      const m = g.moves({ verbose: true }).find((x) => x.piece === by && (() => { const t = new Chess(b.fen); t.move(x.san); return t.isCheckmate(); })());
      if (m) { ctx.mate = { uci: m.from + m.to + (m.promotion ?? ''), white: b.white }; return ctx.mate.uci; }
    }
    const uci = await engine().bestMove(b.fen, 3200, 400);
    const test = new Chess(b.fen);
    test.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (test.isCheckmate()) { ctx.mate = { uci, white: b.white }; return uci; }
    await click(p, uci, b.white);
    await p.waitForFunction((fen) => { const m = window.__owc.mirror; return ![...m.battles.values()].some((x) => x.fen === fen && x.phase === 'live'); }, b.fen, { timeout: 20_000 }).catch(() => {});
  }
  throw new Error('no mate in time');
}

/** Play the mate found by playToMateIn1. */
export async function mate(ctx, { as }) {
  const p = await player(ctx, as);
  if (!ctx.mate) throw new Error('no mate ready');
  await click(p, ctx.mate.uci, ctx.mate.white);
}

/** The live battle from `as`'s tab, opened on their screen (the board is clicked there). */
async function openBattle(p, maxMs = 240_000) {
  const until = Date.now() + maxMs;
  let b;
  while (Date.now() < until) { b = await battleOf(p); if (b?.phase === 'live') break; await p.waitForTimeout(400); }
  if (b?.phase !== 'live') throw new Error('no live battle');
  await p.evaluate((id) => window.__owc.ui.getState().set({ battleFocus: id }), b.id);
  await p.waitForSelector('.battle .board');
  return b;
}

/** Play one move from `as`'s tab and wait until the server has it. */
async function play(p, uci) {
  // Its turn in this tab too (the other side's move may not have arrived here yet).
  await p.waitForFunction(() => { const m = window.__owc.mirror; const b = [...m.battles.values()].reverse().find((x) => x.phase === 'live' && (x.white.playerId === m.me || x.black.playerId === m.me)); return b && (b.fen.split(' ')[1] === 'w') === (b.white.playerId === m.me); }, null, { timeout: 20_000 });
  const b = await battleOf(p);
  await click(p, uci, b.white);
  await p.waitForFunction((fen) => { const m = window.__owc.mirror; return ![...m.battles.values()].some((x) => x.fen === fen && x.phase === 'live'); }, b.fen, { timeout: 20_000 });
}

/**
 * A real en passant, set up from whatever position the battle starts in: `white` walks a pawn
 * to its fifth rank while `black` makes a quiet move; then `doubleStep` (black's pawn beside it
 * jumps two) and `passant` (white takes it in passing) are left for events to play on camera.
 * The line is checked with chess.js first, so it's a legal game on the real server.
 * `files`: the white pawn and the black pawn, in order of preference (e.g. ["ed", "de"]).
 */
export async function enPassantOpening(ctx, { white, black, files = ['ed', 'ef', 'de', 'dc', 'fe', 'cd'] }) {
  const wp = await player(ctx, white), bp = await player(ctx, black);
  const b = await openBattle(wp); await openBattle(bp);
  let plan = null;
  for (const [wf, bf] of files) {
    const g = new Chess(b.fen);
    const quiet = ['h7h6', 'a7a6', 'g8f6', 'b8c6', 'h7h5', 'a7a5'].filter((m) => m[0] !== bf && m[0] !== wf);
    const tryLine = (q) => {
      const t = new Chess(b.fen), line = [`${wf}2${wf}4`, q, `${wf}4${wf}5`, `${bf}7${bf}5`, `${wf}5${bf}6`];
      for (const u of line) { try { t.move({ from: u.slice(0, 2), to: u.slice(2, 4) }); } catch { return null; } }
      return t.history({ verbose: true }).at(-1).flags.includes('e') ? line : null;
    };
    for (const q of quiet) { plan = tryLine(q); if (plan) break; }
    if (plan) break;
  }
  if (!plan) throw new Error('no en passant line from ' + b.fen);
  console.log('en passant line:', plan.join(' '));
  await play(wp, plan[0]); await play(bp, plan[1]); await play(wp, plan[2]);
  ctx.passant = { doubleStep: plan[3], take: plan[4] };
}

/** Black's pawn jumps two squares, right beside white's (set up by enPassantOpening). */
export async function doubleStep(ctx, { black }) { await play(await player(ctx, black), ctx.passant.doubleStep); }

/** White takes it in passing. */
export async function passant(ctx, { white }) { await play(await player(ctx, white), ctx.passant.take); }

/**
 * A real hung queen (Day 7): from the battle's starting position, finds a short quiet opening and a
 * black queen move after which white can take the queen for nothing (no recapture). The opening
 * is played here; `hangQueen` (black's blunder) and `takeQueen` (white's capture) are left
 * for events to play on camera. Every move is checked with chess.js, so it's a legal game.
 */
export async function queenBlunderSetup(ctx, { white, black }) {
  const wp = await player(ctx, white), bp = await player(ctx, black);
  const b = await openBattle(wp); await openBattle(bp);
  const uciOf = (m) => m.from + m.to + (m.promotion ?? '');
  let plan = null;
  const quiet = (g, pieces) => g.moves({ verbose: true }).filter((m) => !m.captured && !m.san.includes('+') && pieces.includes(m.piece));
  // The blunder itself, from a position with black to move: the best-looking hung queen, if any.
  const blunderFrom = (fen) => {
    let best = null;
    const g1 = new Chess(fen);
    for (const q of quiet(g1, 'q')) {
      const g2 = new Chess(fen); g2.move(q.san);
      for (const x of g2.moves({ verbose: true }).filter((m) => m.captured === 'q' && m.piece !== 'k')) {
        const g3 = new Chess(g2.fen()); g3.move(x.san);
        // Free: black can't take back on that square, and isn't mated or stalemated by it.
        if (g3.isGameOver() || g3.moves({ verbose: true }).some((m) => m.to === x.to && m.captured)) continue;
        // The queen travels (a long slide reads on camera), and a knight or an elephant takes it if one can.
        const score = (Math.abs(q.from.charCodeAt(0) - q.to.charCodeAt(0)) + Math.abs(Number(q.from[1]) - Number(q.to[1]))) + (x.piece === 'n' || x.piece === 'r' ? 4 : 0);
        if (!best || score > best.score) best = { score, hang: uciOf(q), take: uciOf(x), by: x.piece };
      }
    }
    return best;
  };
  // Straight away if the position allows; else after a short, natural opening played off camera:
  // white develops (a knight or a pawn), black pushes a pawn (opening the queen's way), white develops again.
  const g0 = new Chess(b.fen);
  search: for (const w1 of quiet(g0, 'np')) {
    const a = new Chess(b.fen); a.move(w1.san);
    const direct = blunderFrom(a.fen());
    if (direct && (!plan || direct.score > plan.score)) plan = { ...direct, prep: [uciOf(w1)] };
    for (const b1 of quiet(a, 'p')) {
      const c = new Chess(a.fen()); c.move(b1.san);
      for (const w2 of quiet(c, 'np')) {
        const d = new Chess(c.fen()); d.move(w2.san);
        const found = blunderFrom(d.fen());
        if (found && (!plan || found.score > plan.score)) plan = { ...found, prep: [uciOf(w1), uciOf(b1), uciOf(w2)] };
        if (plan && plan.score >= 10) break search;
      }
    }
  }
  if (!plan) throw new Error('no queen blunder from ' + b.fen);
  console.log('queen blunder line:', plan.prep.join(' '), '|', plan.hang, plan.take, 'by', plan.by);
  for (const [i, u] of plan.prep.entries()) { await play(i % 2 ? bp : wp, u).catch(async (e) => { if (process.env.SHOT_DEBUG) await (i % 2 ? bp : wp).screenshot({ path: process.env.SHOT_DEBUG }); throw e; }); }
  ctx.blunder = plan;
}

/** Black's queen walks onto the square where it can be taken (set up by queenBlunderSetup). */
export async function hangQueen(ctx, { black }) { await play(await player(ctx, black), ctx.blunder.hang); }

/** White takes the queen. */
export async function takeQueen(ctx, { white }) { await play(await player(ctx, white), ctx.blunder.take); }
