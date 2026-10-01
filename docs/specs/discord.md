# The Discord: a living community (the Herald)

Status: **The Herald is built** (2026-10-01). The other ideas below are proposed.

## 1. The Herald (built)

A news crier for the community Discord. It posts through a channel webhook, so there's no bot account
and nothing to host: the game server posts news, and a daily GitHub Action posts the City of the Day.
- Server: `apps/server/src/herald.ts`, configured by `HERALD_WEBHOOK` in `/etc/owc/env`. Without it, the Herald
  only logs what it would post.
- City of the Day: `tools/herald/showcase.mjs` and `.github/workflows/herald.yml`, using the repository secret
  `HERALD_WEBHOOK`. It runs only when the repository variable `HERALD_ON` is `1`.

| Post | When | Rules |
|---|---|---|
| **Pulse**: "🟢 7 rulers are on the Board right now" | 3 or more people playing | Never below 3 (a low number makes the game feel empty). At most every 3 hours, unless the crowd has grown by 3 since the last pulse. Bots and watchers don't count. |
| **Moments**: a Wonder raised, a town grows into a city, a siege won, a dragon slain, chapter 10+ completed | as they happen | At most one every 30 minutes. The rest wait for the digest. |
| **Today on the Board** | 7 pm Pacific, once a day | Who finished which chapters (by name), side quests by kind, battles between empires and against the wilds, sieges, the moments that waited, and the day's peak (if 3 or more). Only posted if something happened. |
| **City of the Day** | 18:00 UTC | A photograph of one of the finest player cities (from `/api/showcase`: real players' settlements of 6+ buildings, ranked by size and decorations), rotating daily. |

- Posts use players' public in-game names. Names are cleaned (no markdown, no @), and every post sets
  `allowed_mentions: { parse: [] }`, so nobody can be pinged through the Herald.
- Nothing about bots.

## 2. Ideas for later (proposed)

**Needs a real bot** (a Discord application with slash commands, hosted with the server):
- `/city <name>`: the Herald photographs that city on request. `/whereis <player>`: their capital, as a link that opens the game there.
- **Link your account** (`/link`, a one-time code shown in the game): Discord roles from your title (Settler … High King), a colour role for your empire, and a "Ruler" role for anyone who's played this week.
- **Opt-in alerts by DM**: "your town is under siege", "a quest is waiting", "your caravan arrived".
- **Allies**: a private thread for an alliance once two players link and agree.

**Webhook-only (easy next steps):**
- Weekly leaderboard: most Renown, biggest city, most battles won, longest road paved.
- Battle of the Day: a short GIF of the day's best checkmate (the shorts kit's battle clips).
- Welcome: "a new ruler, X, founded Y today" (only once a day, as a list).
- Community challenges, announced Monday and judged Sunday: "the most beautiful bridge", "a walled city", "a town by the sea". Players post screenshots in a channel, and the Herald posts the winner's city as the City of the Day.
- World events: "the Dragon Brood stirs in the ash plains this weekend", tied to in-game events.
- Patch notes: post the deploy's commit summary when CI deploys (from the existing workflow).
