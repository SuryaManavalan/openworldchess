// Usage analytics (docs/specs/stats.md): visitors counted once a day, returning
// visitors, sources, bots never counted, and the report is key-protected.
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Game, type PlayerRec } from '../src/game.ts';
import { sourceOf, stats } from '../src/stats.ts';

const game = new Game({ seed: 13, speed: 1, wilds: false });
afterAll(() => { game.battles.ai.stop(); vi.useRealTimers(); });

describe('stats', () => {
  it('counts a visitor once a day, and again on a later day', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
    stats.visit('abcdef123456', 'tiktok');
    stats.visit('abcdef123456', 'tiktok');
    stats.visit('ffffff000000', 'direct');
    const r1 = stats.report(game, { humans: 0, watchers: 0, bots: 0 });
    expect(r1.today.visitors).toBe(2);
    expect(r1.today.newVisitors).toBe(2);
    expect(r1.totals.sources.tiktok).toBe(1);
    vi.setSystemTime(new Date('2026-10-02T09:00:00Z'));
    stats.visit('abcdef123456', 'direct');
    const r2 = stats.report(game, { humans: 0, watchers: 0, bots: 0 });
    expect(r2.today.visitors).toBe(1);
    expect(r2.today.newVisitors).toBe(0);
    expect(r2.totals.returned).toBe(1);
    expect(r2.retention.find((x) => x.days === 2)?.n).toBe(1);
  });

  it('counts people, never bots, and tracks the peak online', () => {
    const p = game.join(undefined, 'Counted') as PlayerRec;
    const b = game.join(undefined, 'bot:Robo', true) as PlayerRec;
    stats.player(p, true); stats.player(b, true);
    stats.sample(3); stats.sample(1);
    const r = stats.report(game, { humans: 1, watchers: 0, bots: 1 });
    expect(r.today.newPlayers).toBe(1);
    expect(r.today.peak).toBe(3);
  });

  it('tells where a visit came from', () => {
    expect(sourceOf('', '', 'Mozilla/5.0 ... BytedanceWebview/d8a21c6 musical_ly_2024')).toBe('tiktok');
    expect(sourceOf('https://www.tiktok.com/', '', '')).toBe('tiktok');
    expect(sourceOf('', 'tiktok-day01', '')).toBe('tiktok');
    expect(sourceOf('https://www.youtube.com/', '', '')).toBe('youtube');
    expect(sourceOf('', '', '')).toBe('direct');
    expect(sourceOf('https://openworldchess.com/', '', '')).toBe('direct');
  });

  it('hides the report without the key', async () => {
    vi.useRealTimers();
    const { handleStats } = await import('../src/stats.ts');
    const srv = createServer((req, res) => { handleStats(game, req, res, () => ({ humans: 0, watchers: 0, bots: 0 })); });
    await new Promise<void>((ok) => srv.listen(0, ok));
    const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    expect((await fetch(`${base}/api/stats`)).status).toBe(404);
    expect((await fetch(`${base}/api/visit`, { method: 'POST', body: JSON.stringify({ vid: 'zzzzzzzzzzzz' }) })).status).toBe(204);
    srv.close();
  });
});
