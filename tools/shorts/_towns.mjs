import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = JSON.parse(readFileSync('out/day05a/scenario.env.json', 'utf8'));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('page error', e.message));
await p.goto(env.base + '/?cinema&watch&time=noon');
await p.waitForFunction(() => window.__owc?.scene && window.__owc.mirror.me === 'watcher', null, { timeout: 40000 });
for (const t of env.towns) {
  await p.evaluate(([x, y]) => { const s = window.__owc.scene; s.centerOn(x, y); s.cam.zoom = 0.42; }, t.at);
  await p.waitForTimeout(6000);
  await p.screenshot({ path: '/tmp/claude-1000/-home-surya-projects-openworldchess/58cb3f99-d192-4c51-8724-a450fd878b12/scratchpad/town-' + t.name + '.png' });
}
await b.close();
