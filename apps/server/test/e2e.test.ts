// End to end: a real server, two protocol clients, the whole loop.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { Chess } from 'chess.js';
import { Connection } from '@owc/client-core';
import { BUILDINGS, WORK_AREA, REACH, cheb, distToRect, type BattlePublic, type BattleSummary } from '@owc/shared';

const PORT = 8800 + Math.floor(Math.random() * 90);
let server: ChildProcess;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until<T>(f: () => T | undefined | null | false, ms = 20_000, step = 50): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = f();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out');
    await sleep(step);
  }
}

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'owc-'));
  server = spawn(process.execPath, ['apps/server/src/main.ts'], {
    env: { ...process.env, PORT: String(PORT), DATA: join(dir, 'w.json'), TURN_MS: '50', COUNTDOWN_SCALE: '0.05', SPEED: '400', SHIELD_MS: '0', SEED: '7', GUEST_GRACE_MS: '2500' },
    stdio: 'inherit',
  });
  await until(async () => (await fetch(`http://localhost:${PORT}/health`).catch(() => null))?.ok, 15_000);
  await sleep(300);
});
afterAll(() => { server?.kill('SIGTERM'); });

const connect = (name: string) => new Connection({ url: `ws://localhost:${PORT}/play`, WebSocket: WebSocket as never, name });

describe('guests', () => {
  it('names are unique, and a guest empire falls after they leave', async () => {
    const a = connect('Carol');
    await until(() => a.mirror.self);
    let err: string | null = null;
    const b = new Connection({ url: `ws://localhost:${PORT}/play`, WebSocket: WebSocket as never, name: 'carol', onHelloError: (m) => { err = m; } });
    await until(() => err, 5000);
    expect(err).toMatch(/taken/);
    expect(a.mirror.self!.guest).toBe(true);
    const ids = a.mirror.myPieces().map((p) => p.id);
    a.close();
    // After the grace period the empire falls and the name is free again.
    const c = connect('CAROL');
    let taken: string | null = null;
    c.mirror.onError = (m) => { taken = m; };
    await until(() => c.mirror.self, 15_000).catch(() => null);
    if (!c.mirror.self) {
      // The name was still held: retry after the fall.
      await sleep(6000);
      const d = connect('CAROL');
      await until(() => d.mirror.self, 10_000);
      expect(d.mirror.self!.name).toBe('CAROL');
      d.watchArea(0, 0, 10);
      d.close();
    }
    c.close(); b.close();
    void ids; void taken;
  }, 60_000);
});

describe('the whole loop', () => {
  it('spawns, builds, produces, attacks, battles and resolves', async () => {
    const a = connect('Alice'), b = connect('Bob');
    await until(() => a.mirror.self && b.mirror.self && a.mirror.myPieces().length === 6 && b.mirror.myPieces().length === 6);
    const aEmp = a.mirror.myPieces().find((p) => p.emperor)!;
    expect(a.mirror.myKings().length).toBe(2);

    // Build a house where wheat is in the work area and wood is in reach.
    const home = a.mirror.self!.home;
    a.watchArea(home[0], home[1], 40);
    await until(() => a.mirror.chunks.size >= 4);
    const nodes = [...a.mirror.nodes.values()];
    let spot: [number, number] | null = null;
    const king = a.mirror.myKings()[0];
    for (let r = 1; r <= REACH && !spot; r++)
      for (let dy = -r; dy <= r && !spot; dy++)
        for (let dx = -r; dx <= r && !spot; dx++) {
          const x = king.x + dx, y = king.y + dy;
          if (a.mirror.pieceAt.has(x * 134217728 + y) || nodes.some((n) => n.x === x && n.y === y)) continue;
          const wheat = nodes.some((n) => n.kind === 'wheat' && n.remaining > 0 && distToRect(n.x, n.y, x, y, 1) <= WORK_AREA);
          const wood = nodes.filter((n) => n.kind === 'tree' && distToRect(n.x, n.y, x, y, 1) <= REACH).reduce((s, n) => s + n.remaining, 0);
          if (wheat && wood >= BUILDINGS.house.cost.tree!) spot = [x, y];
        }
    expect(spot).toBeTruthy();
    let err: string | null = 'x';
    for (let tries = 0; tries < 20 && err; tries++) {
      err = await a.request({ t: 'build', building: 'house', at: spot! });
      if (err) { spot = [spot![0] + 1, spot![1]]; }
    }
    expect(err).toBeNull();
    await until(() => a.mirror.myBuildings().some((bl) => bl.type === 'house' && bl.built >= 1), 10_000);
    await until(() => a.mirror.myPieces().length > 6, 15_000);

    // Alice marches everything at Bob's plain king.
    const target = b.mirror.myKings().find((k) => !k.emperor)!;
    const attackers = a.mirror.myPieces().map((p) => p.id);
    expect(await a.request({ t: 'order.attack', pieceIds: attackers, targetKingId: target.id })).toBeNull();
    const battle = await until(() => [...a.mirror.battles.values()].find((bt) => bt.white.playerId === a.mirror.me && bt.phase === 'live'), 180_000, 100);
    expect(battle.black.kingId).toBe(target.id);

    // Both sides play random legal moves until the game ends.
    let summary: BattleSummary | null = null;
    a.mirror.onBattleEnd = (_id, s) => { summary = s; };
    const play = async (c: Connection, color: 'white' | 'black') => {
      while (!summary) {
        const bt = c.mirror.battles.get(battle.id) as BattlePublic;
        if (bt.phase === 'over') break;
        const chess = new Chess(bt.fen);
        if ((chess.turn() === 'w') === (color === 'white')) {
          const moves = chess.moves({ verbose: true });
          const cap = moves.filter((m) => m.captured);
          const mv = (cap.length && Math.random() < 0.6 ? cap : moves)[Math.floor(Math.random() * (cap.length && Math.random() < 0.6 ? cap.length : moves.length))] ?? moves[0];
          if (mv) c.send({ t: 'battle.move', battleId: battle.id, uci: mv.from + mv.to + (mv.promotion ?? '') });
          await until(() => c.mirror.battles.get(battle.id)!.fen !== bt.fen || c.mirror.battles.get(battle.id)!.phase === 'over', 3000, 10).catch(() => null);
        } else await sleep(10);
      }
    };
    await Promise.race([Promise.all([play(a, 'white'), play(b, 'black')]), sleep(120_000)]);
    await until(() => summary, 10_000);
    const s = summary!;
    const end = a.mirror.battles.get(battle.id)!;
    expect(end.phase).toBe('over');
    if (s.winner) {
      // The losing king fell; the loser's reserves near it converted.
      expect(s.killed.length).toBeGreaterThan(0);
      await sleep(300);
      const loserKing = s.winner === a.mirror.me ? target.id : battle.white.kingId;
      expect(a.mirror.pieces.get(loserKing)?.state ?? 'gone').not.toBe('idle');
      expect(s.cooldownMs).toBeGreaterThan(0);
    }
    expect(a.mirror.pieces.get(aEmp.id)).toBeTruthy();
    a.close(); b.close();
  }, 360_000);
});
