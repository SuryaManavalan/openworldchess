// City of the Day (docs/specs/discord.md): photograph one of the Board's finest cities from the live
// site (watching, no account) and post it to the Discord through the Herald's webhook.
//
//   HERALD_WEBHOOK=... node tools/herald/showcase.mjs [--dry]       (CI: .github/workflows/herald.yml)
//
// The city rotates daily through the server's showcase list (/api/showcase), so each gets its turn.
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';

const BASE = process.env.OWC_BASE ?? 'https://openworldchess.com';
const HOOK = process.env.HERALD_WEBHOOK ?? '';
const dry = process.argv.includes('--dry') || !HOOK;

const list = await (await fetch(`${BASE}/api/showcase`)).json();
if (!list.length) { console.log('no cities to show yet'); process.exit(0); }
const day = Math.floor(Date.now() / 86_400_000);
const city = list[day % Math.min(list.length, 20)];
console.log('city of the day:', city.name, 'of', city.owner, city.at);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 2 });
await page.goto(`${BASE}/?cinema&watch&time=noon`);
await page.waitForFunction(() => window.__owc?.scene && window.__owc.mirror.me === 'watcher', null, { timeout: 60_000 });
const zoom = city.tier >= 4 ? 0.42 : 0.55;
await page.evaluate(([x, y, z]) => { const s = window.__owc.scene; s.centerOn(x, y); s.cam.zoom = z; }, [city.at[0], city.at[1], zoom]);
await page.waitForTimeout(12_000);
const png = await page.screenshot({ type: 'png' });
await browser.close();
writeFileSync('city.png', png);

const tierName = ['', 'hamlet', 'village', 'town', 'city'][city.tier] ?? 'town';
const post = {
  username: 'The Herald',
  allowed_mentions: { parse: [] },
  embeds: [{
    title: `🏰 City of the Day: ${city.name}`,
    description: `The ${tierName} of **${city.owner}**: ${city.buildings} buildings${city.decor ? `, and ${city.decor} pieces of the builder's own design` : ''}.\nCome and see it: https://openworldchess.com/?city=${encodeURIComponent(city.name)}&at=${city.at.join(',')}`,
    color: 0xe3b23c,
    image: { url: 'attachment://city.png' },
    footer: { text: 'Open World Chess · a new city every day' },
  }],
};
if (dry) { console.log('dry run:', JSON.stringify(post).slice(0, 300)); process.exit(0); }
const form = new FormData();
form.append('payload_json', JSON.stringify(post));
form.append('files[0]', new Blob([readFileSync('city.png')], { type: 'image/png' }), 'city.png');
const r = await fetch(HOOK, { method: 'POST', body: form });
console.log('posted', r.status);
if (!r.ok) process.exit(1);
