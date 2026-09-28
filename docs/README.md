# Open World Chess Docs

| Doc | What it covers |
|---|---|
| [STATUS.md](STATUS.md) | What's built against each spec, deviations and why, how to run. |
| [DESIGN.md](DESIGN.md) | The game vision in your own words, and the rules you've decided. |
| [PRINCIPLES.md](PRINCIPLES.md) | Emergence over features, one interaction model, mobile and desktop from day 0; an audit of the specs against these. |
| [TECH.md](TECH.md) | Every technical decision: the options, the tradeoffs, and a recommendation. |
| [ROADMAP.md](ROADMAP.md) | Milestones M0–M6, and the decisions still waiting on you. |
| [specs/world.md](specs/world.md) | The board, terrain generation, resource nodes, the elo map. |
| [specs/movement.md](specs/movement.md) | World turns, gaits, troops, formations, pathfinding, the camera. |
| [specs/battle.md](specs/battle.md) | Engagement, the arena, picking the set, play, aftermath, cooldowns, spectating. |
| [specs/resources.md](specs/resources.md) | Resource distribution: balance targets, the cluster algorithm, the math, simulation results, previews. |
| [specs/economy.md](specs/economy.md) | Resources (the adjacency model), cities, buildings, production. |
| [specs/migration.md](specs/migration.md) | Why empires drift toward high elo using only the basic rules, a gap found in the numbers, and how bots verify it. |
| [specs/progression.md](specs/progression.md) | Ratings, the Emperor, starting over, protection for new players. |
| [specs/networking.md](specs/networking.md) | The protocol, interest management, sync, server modules, persistence. |
| [specs/ux.md](specs/ux.md) | Mobile and desktop UX: gestures, layouts, alerts and push, mobile realities, accessibility. |
| [specs/bots.md](specs/bots.md) | AI players from day 0: architecture, human-like behavior, rating integrity, population and phasing out, detectability. |
| [specs/visuals.md](specs/visuals.md) | The living world: the 100 BPM heartbeat, idle routines, rare moments, nature that reacts, juice, camera, watch mode. |
| [specs/audio.md](specs/audio.md) | Sound: everything in key and on the beat, armies as rhythm sections, cascading rewards, adaptive music, ambience. |
| [specs/wilds.md](specs/wilds.md) | Hordes and herds: 32 creature factions, camps, growth, raiding, aftermath, art and names. |
| [specs/performance.md](specs/performance.md) | Budgets, observability (/metrics, ?perf, live profiling), the replay benchmark, and the optimizations in use. |
| [specs/cosmetics.md](specs/cosmetics.md) | Cosmetic civilizations (Dravidian, Roman, Chinese, Egyptian), Crowns, the Stripe purchase flow and its setup. |
| [specs/tiktok.md](specs/tiktok.md) | Sign in with TikTok, battle clips, posting to TikTok (direct and drafts), webhooks. |
| [specs/stats.md](specs/stats.md) | The private usage analytics page (/stats.html): what it counts, privacy, storage, access. |
| [specs/elo.md](specs/elo.md) | Ratings (Glicko-1 like chess.com: what a game is worth by experience), rated wild fights, the emergent land rating and everything that follows it, camp strength. |
| [specs/campaign.md](specs/campaign.md) | The Chronicle: a 15-hour campaign of chapters, titles, coronations and quests, with a new unlock every 30–60 minutes. (Proposed) |
| [specs/safeguards.md](specs/safeguards.md) | Runaway loops (piece spam, king breeding, alt farming, server load) and the caps that stop them. |
| [specs/client.md](specs/client.md) | Screens, rendering layers, HUD, input, performance. |
| [specs/art.md](specs/art.md) | Art direction, style rules, the asset list, the pipeline. |

**Labels:**
- **Decided:** you chose it.
- **Proposed:** a recommendation waiting for your sign-off.

Numbers marked as placeholders are there to tune in playtests.
