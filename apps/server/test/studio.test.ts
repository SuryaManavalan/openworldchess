// The studio (docs/specs/studio.md): closed without its key, a log the agent reads and appends to,
// and posting refused until a studio account is set.
import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.STUDIO_KEY = 'test-studio-key';
const { handleStudio, loadStudio } = await import('../src/studio.ts');
const { Game } = await import('../src/game.ts');

const game = new Game({ seed: 5, speed: 1, wilds: false });
let server: Server, base = '';
beforeAll(async () => {
  loadStudio(join(mkdtempSync(join(tmpdir(), 'owc-studio-')), 'studio.json'));
  server = createServer((req, res) => { handleStudio(game, req, res).then((ok) => { if (!ok) { res.statusCode = 404; res.end(); } }); });
  await new Promise<void>((ok) => server.listen(0, ok));
  base = `http://localhost:${(server.address() as { port: number }).port}`;
});
afterAll(() => { server.close(); game.battles.ai.stop(); });
const call = (path: string, init: RequestInit = {}, key = 'test-studio-key') => fetch(base + path, { ...init, headers: { 'x-studio-key': key, ...(init.headers as Record<string, string> ?? {}) } });

describe('the studio', () => {
  it('says nothing without the key', async () => {
    expect((await call('/studio/log', {}, 'wrong')).status).toBe(404);
    expect((await call('/studio/log', {}, '')).status).toBe(404);
  });

  it('keeps the log: entries are added, and the same day updates its entry', async () => {
    const add = (e: object) => call('/studio/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(e) });
    expect((await add({ day: '10', hook: 'Knights hop.', pillar: 'W', timeline: { seconds: 20 } })).status).toBe(200);
    expect((await add({ day: '11', hook: 'Protect the Emperor.', kind: 'community' })).status).toBe(200);
    expect((await add({ day: '10', hook: 'Knights hop.', status: 'PUBLISH_COMPLETE' })).status).toBe(200);
    expect((await add({ hook: 'no day' })).status).toBe(400);
    const { log } = await (await call('/studio/log')).json();
    expect(log.map((e: { day: string }) => e.day)).toEqual(['10', '11']);
    expect(log[0].status).toBe('PUBLISH_COMPLETE');
    expect(log[0].timeline).toBeUndefined();
    const full = await (await call('/studio/log?full=1')).json();
    expect(full.log[0].timeline).toEqual({ seconds: 20 });
  });

  it('refuses to post until a studio account is set, and to speak without a voice key', async () => {
    expect((await call('/studio/tiktok/me')).status).toBe(409);
    expect((await call('/studio/voice', { method: 'POST', body: JSON.stringify({ voice_id: 'JBFqnCBsd6RMkjVDRZzb', text: 'Hi' }) })).status).toBe(409);
  });
});
