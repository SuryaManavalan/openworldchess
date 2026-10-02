// Writes the website's static pages into the client's public folder before each build
// (docs/specs/site.md): the guide, the wilds, the Chronicle, the 404 page, the sitemap and llms.txt.
// They're generated (and git-ignored) so they always match the game's rules.
//   node tools/site/build.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { chroniclePage, guidePage, llmsFullTxt, llmsTxt, notFoundPage, sitemap, wildsPage } from '../../apps/server/src/site.ts';

const root = new URL('../../', import.meta.url).pathname;
const pub = root + 'apps/client/public/';
const lessons = readFileSync(root + 'packages/shared/src/lessons.ts', 'utf8');
const files: Record<string, string> = {
  'guide.html': guidePage(lessons),
  'wilds.html': wildsPage(),
  'chronicle.html': chroniclePage(),
  '404.html': notFoundPage(),
  'sitemap.xml': sitemap(),
  'llms.txt': llmsTxt(),
  'llms-full.txt': llmsFullTxt(lessons),
};
for (const [name, text] of Object.entries(files)) writeFileSync(pub + name, text);
console.log('site:', Object.entries(files).map(([n, t]) => `${n} ${(t.length / 1024).toFixed(0)}k`).join(', '));
