// The website (docs/specs/site.md): pages written from the game's own data, each with a title,
// a description, a canonical address and valid structured data; the sitemap and llms.txt list them.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHAPTERS, FACTIONS, LESSONS } from '@owc/shared';
import { chroniclePage, citiesPage, guidePage, lessonGroups, llmsTxt, notFoundPage, PAGES, sitemap, wildsPage } from '../src/site.ts';

const lessons = readFileSync(new URL('../../../packages/shared/src/lessons.ts', import.meta.url), 'utf8');
const ld = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));

describe('the site', () => {
  it('the guide carries every lesson of the rulebook, in its sections', () => {
    const ids = lessonGroups(lessons).flatMap(([, i]) => i);
    expect(new Set(ids)).toEqual(new Set(Object.keys(LESSONS)));
    const html = guidePage(lessons);
    for (const l of Object.values(LESSONS)) expect(html).toContain(l.title.replace(/&/g, '&amp;'));
  });

  it('every page has a title, description, canonical address and parseable structured data', () => {
    for (const [html, path] of [[guidePage(lessons), '/guide'], [wildsPage(), '/wilds'], [chroniclePage(), '/chronicle'], [citiesPage([{ name: 'Rook<b>', owner: 'A', tier: 4, buildings: 9, at: [1, 2] }], 1), '/cities']] as const) {
      expect(html).toMatch(/<title>[^<]{20,}<\/title>/);
      expect(html).toMatch(/<meta name="description" content="[^"]{60,}">/);
      expect(html).toContain(`<link rel="canonical" href="https://openworldchess.com${path}">`);
      expect(ld(html).length).toBeGreaterThan(0);
    }
    expect(citiesPage([{ name: 'Rook<b>', owner: 'A', tier: 4, buildings: 9, at: [1, 2] }], 1)).toContain('Rook&lt;b&gt;');
    expect(notFoundPage()).toContain('noindex');
  });

  it('the wilds and the Chronicle list every faction and chapter', () => {
    const w = wildsPage(), c = chroniclePage();
    for (const f of Object.values(FACTIONS)) expect(w).toContain(`id="${f.id}"`);
    for (const ch of CHAPTERS) expect(c).toContain(`id="chapter-${ch.n}"`);
  });

  it('the sitemap and llms.txt name every page', () => {
    const sm = sitemap(), l = llmsTxt();
    for (const [p] of PAGES) expect(sm).toContain(`<loc>https://openworldchess.com${p}</loc>`);
    for (const p of ['/guide', '/wilds', '/chronicle', '/cities', '/about']) expect(l).toContain(`https://openworldchess.com${p}`);
  });
});
