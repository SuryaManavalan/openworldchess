# Usage analytics

A private page at **/stats.html** shows how the game is doing: players online,
new empires, visitors and where they come from, returning visitors, where
players are in the Chronicle, battles, sign-ins, revenue and server health.

Code: `apps/server/src/stats.ts` (counters, `/api/visit`, `/api/stats`) and
`apps/client/public/stats.html` (the page).

## Privacy

First-party only, with no third-party analytics:
- **Visitors** are a random ID that the browser makes (`owc.vid` in localStorage),
  plus where the visit came from (referrer, `utm_source`, or TikTok's in-app
  browser). Filming sessions (`?watch`) don't count.
- **Players** are game IDs. **Bots and camps never count.**
- No names, emails or IP addresses are stored in the stats.

The privacy policy describes this.

## Storage

`stats.json` sits next to the world save (`/var/lib/owc/stats.json` in
production), is saved with it every minute, and has these parts:
- one record per day, in Pacific time (PST/PDT);
- the last 72 hours of hourly counts;
- the first day, last day and number of days seen for each visitor ID and each player ID (capped at 250,000 IDs);
- all-time chapter completions and buyers.

On the first run it backfills players, chapters reached and buyers from the world.

## Access

`GET /api/stats` needs the header `x-stats-key: <STATS_KEY>` and returns 404
without it. `STATS_KEY` lives in `/etc/owc/env`. The page asks for the key
once, or takes it from the link's fragment (`/stats.html#key=…`, which is never
sent to the server), and then remembers it in that browser.

## Attribution

To see which post brought people in, link to the site with a source tag, for
example `openworldchess.com/?utm_source=tiktok-day01`. TikTok's in-app browser
is detected even without a tag.
