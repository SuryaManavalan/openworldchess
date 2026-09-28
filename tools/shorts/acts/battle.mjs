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
  await p.evaluate((t) => { localStorage.setItem('owc.token', t); localStorage.setItem('owc.onboarded', '1'); }, ctx.env.tokens[name]);
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

/** Wait for `as`'s battle to go live, open it, and play engine moves until the next move mates. */
export async function playToMateIn1(ctx, { as, maxMs = 240_000 }) {
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
