# The website (search and AI answer engines)

Status: built 2026-10-02. Provisional like everything in DESIGN.md.

The game lives at `/`, a canvas that a search engine can't read. Around it sits a small website.
Each page answers a question people actually ask, in text, from the game's own data.

## 1. Pages

| Path | What | Made by |
|---|---|---|
| `/` | The game. Its HTML has the title, description, social cards and structured data (`WebSite`, `Organization`, `VideoGame`). Until the game takes over, it shows a loading screen with a real heading, a paragraph and links. | `apps/client/index.html` |
| `/about` | What the game is: screenshots, how it works, FAQ (`FAQPage` data) | `apps/client/public/about.html` (hand-written) |
| `/guide` | The complete rulebook, every lesson in `lessons.ts`, plus a quick start and the buildings table | generated |
| `/wilds` | All monster factions: their camp, temper, lands, lore, and which creature plays each piece (art from `art/wilds-png.mjs`) | generated |
| `/chronicle` | The campaign: titles, then every chapter's intro, story, steps and unlock | generated |
| `/cities` | The largest player cities, live, each linking into the game (`?city=…&at=…`) | the server, re-rendered at most once a minute |
| `/privacy`, `/terms` | Legal | hand-written |
| `/robots.txt`, `/sitemap.xml` | Crawl rules (no `/api`, `/auth`, `/tiktok`, `/stats.html`) and the page list | static / generated |
| `/llms.txt`, `/llms-full.txt` | The game summarized for AI answer engines ([llmstxt.org](https://llmstxt.org)), and the guide, factions and campaign as plain text | generated |

**Generation.**
- `tools/site/build.ts` runs before every client build. It writes the generated pages into `apps/client/public/`, where they're git-ignored.
- The page builders live in `apps/server/src/site.ts`, which the server also uses for `/cities`.
- The text comes from the rules' own data, so a changed rule changes the website.

**Every page** has a title, a meta description, a canonical address, Open Graph and Twitter cards (`/img/site/og.jpg`, 1200×630), breadcrumbs and structured data. The pages also share a navigation bar and footer, so each page links to every other.

**One sentence everywhere.** `WHAT_IS` in `site.ts` is the answer to "what is Open World Chess?". The homepage, about page, guide and llms.txt all say it the same way, because answer engines quote consistent, self-contained definitions.

## 2. Serving (`apps/server/src/web.ts`)

**One address per page.**
- `www.` redirects (301) to the bare domain.
- `/about.html` redirects to `/about`, and a trailing slash is dropped.

**Real 404s.** An unknown path returns `404.html` with status 404 (it used to serve the game with a 200).

**Compression.** Text responses are sent with brotli or gzip. Copies are compressed once per file version, off the main thread, and warmed at startup. The game's bundle goes from 1.39 MB to about 395 KB with brotli.

**Caching.**

| Files | Cache |
|---|---|
| Hashed assets | a year |
| Images | a week |
| CSS, txt, xml | an hour |
| HTML | revalidated |
| `/cities` | a minute |

## 3. Telling search engines

**IndexNow.** After each deploy, CI runs `tools/site/indexnow.mjs`. It pings Bing and the other IndexNow engines, which feed ChatGPT search, Copilot and DuckDuckGo. The key file sits at the site root.

**Google.** Google doesn't take IndexNow, so the site owner has to set it up in **Search Console**:
1. Verify the domain property through a DNS TXT record.
2. Submit `https://openworldchess.com/sitemap.xml`.

The sitemap is also named in `robots.txt`.

## 4. Writing for it

- Put new rules in `lessons.ts`. They reach the guide and llms-full.txt by themselves.
- Facts on the site must be true of the game. The same rule applies to ads (`.claude/skills/owc-shorts/reference/truth.md`).
- Name things the way players search for them: "chess MMO", "chess strategy game", "play in your browser", "free".
