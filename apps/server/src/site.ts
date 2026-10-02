// The website's pages around the game (docs/specs/site.md): what a search engine or an AI answer
// engine reads about Open World Chess. The guide, the wilds and the Chronicle are written from the
// game's own data (the rulebook in lessons.ts, the factions, the campaign), so they never drift from
// the rules. tools/site/build.ts writes them at build time; the server renders /cities live.
import { BUILDINGS, CHAPTERS, FACTIONS, LESSONS, TITLES, type Faction } from '@owc/shared';

export const ORIGIN = 'https://openworldchess.com';
const DISCORD = 'https://discord.gg/B6kPjrakW';
const GITHUB = 'https://github.com/SuryaManavalan/openworldchess';

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The one-paragraph answer to "what is Open World Chess?" (said the same way everywhere). */
export const WHAT_IS = 'Open World Chess is a free multiplayer strategy game played in the web browser on phone and desktop. The whole world is one endless, shared chessboard: players build an empire, raise an army of chess pieces, and win land from other players and monster camps, and every battle is a real game of chess with a clock.';

const NAV: [string, string][] = [['/guide', 'Guide'], ['/wilds', 'The Wilds'], ['/chronicle', 'Campaign'], ['/cities', 'Cities'], ['/about', 'About']];

export interface Page { path: string; title: string; description: string; body: string; jsonld?: object[]; image?: string; noindex?: boolean; crumbs?: [string, string][] }

/** A full HTML page in the site's look, with its title, description, canonical URL, social cards and structured data. */
export function page(p: Page): string {
  const url = ORIGIN + p.path;
  const image = ORIGIN + (p.image ?? '/img/site/og.jpg');
  const crumbs = p.crumbs ?? [];
  const ld = [
    ...(p.jsonld ?? []),
    ...(crumbs.length ? [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['/', 'Open World Chess'], ...crumbs].map(([href, name], i) => ({ '@type': 'ListItem', position: i + 1, name, item: ORIGIN + href })) }] : []),
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
${p.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Open World Chess">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#23211f">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Nunito:wght@600;700;800;900&display=swap">
<link rel="stylesheet" href="/site.css">
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<nav class="top"><div class="wrap">
  <a class="brand" href="/about"><img src="/icon.svg" alt="" width="28" height="28"> Open World Chess</a>
  <div class="links">${NAV.map(([h, n]) => `<a href="${h}"${h === p.path ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</div>
  <a class="btn gold" href="/">Play free</a>
</div></nav>
<main class="wrap">
${crumbs.length ? `<div class="crumbs"><a href="/about">Open World Chess</a>${crumbs.map(([h, n]) => ` › <a href="${h}">${esc(n)}</a>`).join('')}</div>` : ''}
${p.body}
<section class="cta-band">
  <h2>The whole world is a chessboard.</h2>
  <p class="dim" style="margin-inline:auto">Free in your browser, on phone and desktop. No download, no account needed.</p>
  <a class="btn gold" href="/">Play Open World Chess</a>
</section>
</main>
${footer()}
</body>
</html>
`;
}

export function footer() {
  return `<footer class="site"><div class="wrap">
  <span>© ${new Date().getFullYear()} Open World Chess</span>
  <a href="/">Play</a><a href="/guide">Guide</a><a href="/wilds">The Wilds</a><a href="/chronicle">Campaign</a><a href="/cities">Cities</a><a href="/about">About</a>
  <a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="${DISCORD}">Discord</a><a href="${GITHUB}">GitHub</a>
</div></footer>`;
}

/** The game, as structured data (on the homepage and the about page). */
export const GAME_LD = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: 'Open World Chess',
  url: ORIGIN + '/',
  description: WHAT_IS,
  image: ORIGIN + '/img/site/og.jpg',
  genre: ['Strategy', 'Massively multiplayer online', 'Chess', 'City builder'],
  gamePlatform: ['Web browser', 'Mobile web', 'Desktop web'],
  applicationCategory: 'Game',
  operatingSystem: 'Any (web browser)',
  playMode: ['MultiPlayer', 'SinglePlayer'],
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
  inLanguage: 'en',
  isAccessibleForFree: true,
  sameAs: [DISCORD, GITHUB],
  publisher: { '@type': 'Organization', name: 'Open World Chess', url: ORIGIN, logo: ORIGIN + '/icon.svg', email: 'openworldchessgame@gmail.com' },
};

// ------------------------------------------------------------------ the guide (the rulebook)

/** The rulebook's sections, in its own order (the `// ===== name =====` headings in lessons.ts). */
export function lessonGroups(source: string): [string, string[]][] {
  const groups: [string, string[]][] = [];
  for (const line of source.split('\n')) {
    const g = line.match(/^\s*\/\/ =+ (.+?) =+\s*$/);
    if (g) { groups.push([g[1][0].toUpperCase() + g[1].slice(1), []]); continue; }
    const k = line.match(/^ {2}([a-z][a-zA-Z]*): \{$/);
    if (k && groups.length && LESSONS[k[1]]) groups.at(-1)![1].push(k[1]);
  }
  return groups;
}

const NODE_NAME: Record<string, string> = { tree: 'wood', rock: 'stone', ore: 'ore', wheat: 'crops', water: 'water' };
const PIECE_NAME: Record<string, string> = { K: 'king', Q: 'queen', R: 'war elephant (rook)', B: 'bishop', N: 'knight', P: 'pawn' };
const cost = (c: Partial<Record<string, number>>) => Object.entries(c).map(([k, n]) => `${n} ${NODE_NAME[k] ?? k}`).join(' + ') || 'free';
const mins = (ms: number) => (ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} s`);

export function guidePage(lessonsSource: string): string {
  const groups = lessonGroups(lessonsSource);
  const producing = Object.values(BUILDINGS).filter((b) => !b.decor && b.produces.length);
  const body = `
<div class="kicker">The complete guide</div>
<h1>How to play Open World Chess</h1>
<p class="lede">${esc(WHAT_IS)}</p>
<p>This guide is the game's own rulebook: every rule with every number, and tips on how to play it well. It's the same text players read in the game's Help, written from the rules themselves, so it is always up to date.</p>
<h2 id="quick-start">Quick start</h2>
<ol>
  <li><b>Open <a href="/">openworldchess.com</a> and choose a name.</b> You start as a guest with an Emperor (your gold-crowned king), a second king, four pawns and a field. No account or password is needed.</li>
  <li><b>Build a house beside your crops.</b> Houses raise pawns; stables raise knights; temples raise bishops; barracks raise war elephants (rooks); palaces raise kings and queens.</li>
  <li><b>Scout the wilds and raid a camp.</b> Monster camps live between the cities. Send a troop; the fight is a real game of chess.</li>
  <li><b>Grow towns, seize crowns, follow the Chronicle.</b> The 15-chapter <a href="/chronicle">campaign</a> takes you from Settler to High King.</li>
</ol>
<h2 id="buildings">Buildings and the pieces they raise</h2>
<div class="scroll"><table class="data">
<tr><th>Building</th><th>Raises</th><th>Costs</th><th>Needs nearby</th><th>Builds in</th></tr>
${producing.map((b) => `<tr><td>${b.type[0].toUpperCase() + b.type.slice(1)}</td><td>${b.produces.map((k) => PIECE_NAME[k]).join(', ')}</td><td>${cost(b.cost)}</td><td>${b.needs.map((n) => NODE_NAME[n]).join(' and ')}</td><td class="num">${mins(b.buildMs)}</td></tr>`).join('\n')}
</table></div>
<p class="dim small">Decorations (streets, walls, gates, bridges, gardens, lamps, wells and more) cost a little wood or stone and are drawn with a stroke; see <a href="#citybuilding">City building</a>.</p>
<nav class="toc" aria-label="Contents">
${groups.map(([g, ids]) => `<div class="grp">${esc(g)}</div>${ids.map((id) => `<a href="#${id}">${esc(LESSONS[id].title)}</a>`).join('')}`).join('\n')}
</nav>
${groups.map(([g, ids]) => `<h2 id="${slug(g)}">${esc(g)}</h2>\n${ids.map((id) => lessonHtml(id)).join('\n')}`).join('\n')}
`;
  return page({
    path: '/guide',
    title: 'How to Play Open World Chess: The Complete Guide and Rulebook',
    description: 'The complete rules of Open World Chess, the free chess strategy MMO: the Emperor and kings, buildings and resources, troops, battles as real chess games, sieges, the wilds, city building, titles and ratings, with tips.',
    crumbs: [['/guide', 'Guide']],
    body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: 'How to play Open World Chess: the complete guide', description: 'Every rule of Open World Chess with every number, and tips on how to play it well.', about: { '@type': 'VideoGame', name: 'Open World Chess', url: ORIGIN + '/' }, author: { '@type': 'Organization', name: 'Open World Chess', url: ORIGIN }, mainEntityOfPage: ORIGIN + '/guide', image: ORIGIN + '/img/site/og.jpg', dateModified: new Date().toISOString().slice(0, 10) }],
  });
}

function lessonHtml(id: string) {
  const l = LESSONS[id];
  return `<section class="lesson" id="${id}">
<h3>${esc(l.title)}</h3>
<p class="rule">${esc(l.text)}</p>
<ul>${l.fine.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
${l.tips?.length ? `<div class="tips"><b>Tips.</b> ${l.tips.map(esc).join(' ')}</div>` : ''}
</section>`;
}

// ------------------------------------------------------------------ the wilds

const TEMPER: Record<string, string> = {
  herd: 'Herd: grazing animals. They never attack, and fight only when attacked.',
  lair: 'Lair: guards its den, and attacks kings that come close to its camp.',
  horde: 'Horde: raiders. They attack kings that come close, and roam wider.',
};
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'legendary'];

export function wildsPage(): string {
  const all = Object.values(FACTIONS).sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name));
  const by = (r: string) => all.filter((f) => f.rarity === r);
  const body = `
<div class="kicker">Bestiary</div>
<h1>The Wilds: all ${all.length} monster factions</h1>
<p class="lede">Between the players' cities, the board belongs to the wilds: ${all.length} factions of creature camps, from goblin warbands and wolf packs to a Dragon Brood. Each faction maps the six chess pieces to its own creatures, so a Goblin Boss is a king and moves and fights exactly like one.</p>
<p>Camps grow over time. Beat a camp's king in a game of chess and the camp scatters, leaving a hoard of resources behind. Rare factions live in rare lands (ash plains, frozen wastes, fey glades, deserts), and the greatest of them leave relics. Creatures never join you: they are monsters, not recruits. The rules are in the guide's <a href="/guide#wilds">Wilds</a>, <a href="/guide#raids">Raids</a> and <a href="/guide#hoards">Hoards</a> sections.</p>
<h2 id="tempers">How they behave</h2>
<ul>${Object.values(TEMPER).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
<nav class="toc" aria-label="Factions">
${RARITY_ORDER.map((r) => `<div class="grp">${r}</div>${by(r).map((f) => `<a href="#${f.id}">${esc(f.name)}</a>`).join('')}`).join('\n')}
</nav>
${RARITY_ORDER.map((r) => `<h2 id="${r}">${r[0].toUpperCase() + r.slice(1)} factions</h2>\n<div class="cards">${by(r).map(factionCard).join('\n')}</div>`).join('\n')}
`;
  return page({
    path: '/wilds',
    title: `The Wilds: All ${all.length} Monster Factions in Open World Chess`,
    description: `Every monster faction in Open World Chess: goblins, wolves, orcs, bandits, trolls, the Dragon Brood and more. Where each camp lives, how it behaves, and which creature plays each chess piece.`,
    crumbs: [['/wilds', 'The Wilds']],
    body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Monster factions of Open World Chess', numberOfItems: all.length, itemListElement: all.map((f, i) => ({ '@type': 'ListItem', position: i + 1, name: f.name, url: `${ORIGIN}/wilds#${f.id}` })) }],
  });
}

function factionCard(f: Faction) {
  const roles = (['K', 'Q', 'R', 'B', 'N', 'P'] as const).map((k) => `<dt>${{ K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' }[k]}</dt><dd>${esc(f.roles[k])}</dd>`).join('');
  return `<article class="card" id="${f.id}">
<div class="pics"><img src="/img/wilds/${f.id}-K.png" alt="${esc(f.roles.K)}, the ${esc(f.name)}'s king" width="64" height="64" loading="lazy"><img src="/img/wilds/${f.id}-N.png" alt="${esc(f.roles.N)}" width="64" height="64" loading="lazy"><img src="/img/wilds/${f.id}-P.png" alt="${esc(f.roles.P)}" width="64" height="64" loading="lazy"></div>
<h3>${esc(f.name)}</h3>
<p class="meta"><span class="tag ${f.rarity}">${f.rarity}</span>${esc(f.camp)} · ${f.temper}</p>
<p>${esc(f.lore)}</p>
<p class="small dim">Lives in: ${f.biomes.join(', ')} lands, near ${NODE_NAME[f.near] ?? f.near}.${f.minElo ? ` Only where the land is rated ${f.minElo} or more.` : ''}</p>
<dl>${roles}</dl>
</article>`;
}

// ------------------------------------------------------------------ the Chronicle (campaign)

export function chroniclePage(): string {
  const acts = [...new Set(CHAPTERS.map((c) => c.act))];
  const body = `
<div class="kicker">The campaign</div>
<h1>The Chronicle: a ${CHAPTERS.length}-chapter campaign</h1>
<p class="lede">The Chronicle is Open World Chess's story campaign: ${CHAPTERS.length} chapters in ${acts.length} acts, designed as a journey of about fifteen hours, that take you from a single house to High King. Each chapter is a quest; finishing it grants a title, new buildings or new abilities.</p>
<h2 id="titles">Titles</h2>
<p>Titles are the power ladder. Each one raises how many kings you may hold.</p>
<div class="scroll"><table class="data"><tr><th>#</th><th>Title</th><th>Kings you may hold</th></tr>
${TITLES.map((t, i) => `<tr><td class="num">${i + 1}</td><td>${t.name}</td><td class="num">${t.kingCap}</td></tr>`).join('\n')}
</table></div>
<nav class="toc" aria-label="Chapters">
${acts.map((a, i) => `<div class="grp">Act ${['I', 'II', 'III', 'IV', 'V', 'VI'][i]}: ${esc(a)}</div>${CHAPTERS.filter((c) => c.act === a).map((c) => `<a href="#chapter-${c.n}">${c.n}. ${esc(c.name)}</a>`).join('')}`).join('\n')}
</nav>
${acts.map((a, i) => `<h2 id="${slug(a)}">Act ${['I', 'II', 'III', 'IV', 'V', 'VI'][i]}: ${esc(a)}</h2>\n${CHAPTERS.filter((c) => c.act === a).map((c) => `<section class="chapter" id="chapter-${c.n}">
<h3>Chapter ${c.n}: ${esc(c.name)}</h3>
<p>${esc(c.intro)}</p>
${c.story ? `<p class="story">${esc(c.story)}</p>` : ''}
<ol>${c.steps.map((s) => `<li>${esc(s.line)}</li>`).join('')}</ol>
<p class="opens">Opens: ${esc(c.opens)}${c.reward.title != null ? ` · Title: ${TITLES[c.reward.title].name}` : ''}</p>
</section>`).join('\n')}`).join('\n')}
`;
  return page({
    path: '/chronicle',
    title: `The Chronicle: Open World Chess's ${CHAPTERS.length}-Chapter Campaign, Settler to High King`,
    description: `Every chapter of the Chronicle, the story campaign of Open World Chess: ${CHAPTERS.length} chapters in ${acts.length} acts, from your first house to High King, with each quest, its story and what it unlocks.`,
    crumbs: [['/chronicle', 'Campaign']],
    body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: 'The Chronicle: the campaign of Open World Chess', about: { '@type': 'VideoGame', name: 'Open World Chess', url: ORIGIN + '/' }, author: { '@type': 'Organization', name: 'Open World Chess', url: ORIGIN }, mainEntityOfPage: ORIGIN + '/chronicle', image: ORIGIN + '/img/site/og.jpg', dateModified: new Date().toISOString().slice(0, 10) }],
  });
}

// ------------------------------------------------------------------ cities (live)

export interface CityRow { name: string; owner: string; tier: number; buildings: number; at: [number, number] }
const TIER = ['', 'hamlet', 'village', 'town', 'city'];

/** The greatest player cities on the board right now (rendered by the server, refreshed each minute). */
export function citiesPage(cities: CityRow[], players: number): string {
  const top = cities.slice(0, 60);
  const body = `
<div class="kicker">Live from the board</div>
<h1>The greatest cities in Open World Chess</h1>
<p class="lede">Every city in Open World Chess is built by a player, square by square, on one shared chessboard. These are the largest right now${players ? `, out of ${cities.length} player cities` : ''}. Open any of them to fly there and look around: no account needed.</p>
<div class="scroll"><table class="data">
<tr><th>#</th><th>City</th><th>Ruler</th><th>Size</th><th>Buildings</th></tr>
${top.length ? '' : '<tr><td colspan="5" class="dim">The first towns are still being raised. Be the first: <a href="/">play free</a>.</td></tr>'}
${top.map((c, i) => `<tr><td class="num">${i + 1}</td><td><a href="/?city=${encodeURIComponent(c.name)}&amp;at=${c.at.join(',')}">${esc(c.name)}</a></td><td>${esc(c.owner)}</td><td>${TIER[c.tier] ?? 'town'}</td><td class="num">${c.buildings}</td></tr>`).join('\n')}
</table></div>
<p class="dim small">Updated every minute. Sizes: a hamlet grows into a village at 3 buildings close together, then a town, then a city. See <a href="/guide#settlements">Settlements</a> in the guide.</p>
`;
  return page({
    path: '/cities',
    title: 'The Greatest Player Cities in Open World Chess (Live)',
    description: 'The largest player-built cities on the Open World Chess board right now, with their rulers and sizes. Open any city to fly there and look around, free in your browser.',
    crumbs: [['/cities', 'Cities']],
    body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Largest player cities in Open World Chess', numberOfItems: top.length, itemListElement: top.slice(0, 20).map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: `${c.name}, the ${TIER[c.tier] ?? 'town'} of ${c.owner}`, url: `${ORIGIN}/?city=${encodeURIComponent(c.name)}&at=${c.at.join(',')}` })) }],
  });
}

// ------------------------------------------------------------------ 404, sitemap, llms.txt

export function notFoundPage(): string {
  return page({ path: '/404', title: 'Page not found · Open World Chess', description: 'That page is not on the board.', noindex: true, body: `<h1 style="margin-top:48px">That square is empty.</h1><p class="lede">There's no page here. Try the <a href="/guide">guide</a>, the <a href="/wilds">wilds</a>, the <a href="/cities">greatest cities</a>, or just <a href="/">play</a>.</p>` });
}

/** The site's indexable pages, for the sitemap. */
export const PAGES: [string, string, number][] = [
  ['/', 'daily', 1.0], ['/about', 'weekly', 0.9], ['/guide', 'weekly', 0.8], ['/wilds', 'monthly', 0.7],
  ['/chronicle', 'monthly', 0.7], ['/cities', 'hourly', 0.6], ['/privacy', 'yearly', 0.2], ['/terms', 'yearly', 0.2],
];

export function sitemap(date = new Date().toISOString().slice(0, 10)): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(([p, f, pr]) => `  <url><loc>${ORIGIN}${p}</loc><lastmod>${date}</lastmod><changefreq>${f}</changefreq><priority>${pr.toFixed(1)}</priority></url>`).join('\n')}
</urlset>
`;
}

/** llms.txt (llmstxt.org): the site, summarized for AI answer engines. */
export function llmsTxt(): string {
  const n = Object.keys(FACTIONS).length;
  return `# Open World Chess

> ${WHAT_IS}

Key facts:
- Price: free to play (optional cosmetic purchases only: civilization styles bought with Crowns; they change looks, never strength).
- Platform: any modern web browser on phone, tablet or desktop. No download, no install. URL: ${ORIGIN}
- Accounts: optional. Play as a guest by choosing a name; sign in with Google or TikTok to keep your empire across devices.
- Battles: every fight is a real game of chess with a clock, using exactly the pieces the armies brought (at most one legal chess set per side). En passant and promotion are in; promotion lasts for that battle only.
- The world: one endless shared chessboard with forests, rivers, deserts, frozen lands and mountains; real players and AI empires; ${n} monster factions in the wilds.
- Pieces: kings hold land; houses raise pawns, stables knights, temples bishops, barracks war elephants (the rooks), palaces kings and queens. Your Emperor is your elite king: lose it and your empire falls.
- Progress: the Chronicle, a ${CHAPTERS.length}-chapter campaign (about 15 hours) with ${TITLES.length} titles from ${TITLES[0].name} to ${TITLES.at(-1)!.name}.
- City building: streets, squares, bridges, walls and gates, gardens and lamps, drawn with a stroke.
- Made by an independent solo developer; open source (${GITHUB}). Community: ${DISCORD}. Contact: openworldchessgame@gmail.com

## Pages
- [Play](${ORIGIN}/): the game itself
- [About](${ORIGIN}/about): what the game is, screenshots, FAQ
- [Guide](${ORIGIN}/guide): the complete rulebook, every rule with every number, plus tips
- [The Wilds](${ORIGIN}/wilds): all ${n} monster factions
- [The Chronicle](${ORIGIN}/chronicle): the ${CHAPTERS.length}-chapter campaign and the titles
- [Cities](${ORIGIN}/cities): the largest player cities, live
- [Full text for language models](${ORIGIN}/llms-full.txt): the guide, the wilds and the campaign as plain text

## Optional
- [Privacy Policy](${ORIGIN}/privacy)
- [Terms of Service](${ORIGIN}/terms)
`;
}

/** llms-full.txt: the guide, the factions and the campaign as plain text. */
export function llmsFullTxt(lessonsSource: string): string {
  const out = [`# Open World Chess: the complete guide\n\n${WHAT_IS}\n\nSource: ${ORIGIN}/guide\n`];
  for (const [g, ids] of lessonGroups(lessonsSource)) {
    out.push(`\n## ${g}\n`);
    for (const id of ids) {
      const l = LESSONS[id];
      out.push(`\n### ${l.title}\n\n${l.text}\n\n${l.fine.map((f) => `- ${f}`).join('\n')}\n${l.tips?.length ? `\nTips: ${l.tips.join(' ')}\n` : ''}`);
    }
  }
  out.push(`\n## The wilds: ${Object.keys(FACTIONS).length} monster factions\n`);
  for (const f of Object.values(FACTIONS)) out.push(`\n### ${f.name} (${f.rarity}, ${f.temper})\n\n${f.lore} Camp: ${f.camp}. Lives in ${f.biomes.join(', ')} lands. Pieces: king ${f.roles.K}, queen ${f.roles.Q}, rook ${f.roles.R}, bishop ${f.roles.B}, knight ${f.roles.N}, pawn ${f.roles.P}.\n`);
  out.push(`\n## The Chronicle (campaign)\n\nTitles: ${TITLES.map((t) => t.name).join(', ')}.\n`);
  for (const c of CHAPTERS) out.push(`\n### Chapter ${c.n}: ${c.name} (Act: ${c.act})\n\n${c.intro}${c.story ? ` ${c.story}` : ''}\n\n${c.steps.map((s) => `- ${s.line}`).join('\n')}\n\nOpens: ${c.opens}\n`);
  return out.join('');
}
