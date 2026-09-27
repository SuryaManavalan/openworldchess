# Build Status

What's built, measured against the specs. **Deviations** are deliberate changes from a spec, each with its reason. **Not yet** means planned but not built.

## How to run

```bash
pnpm install
pnpm dev                 # server :8787 + Vite client :5173 + 8 bots (SPEED=5 economy)
# or, as production does it:
pnpm build && node apps/server/src/main.ts    # serves the built client on :8787
pnpm bots                # bots against a running server (BOTS=12)
pnpm test                # rule tests + an end-to-end game (server, 2 clients, a full battle)
pnpm typecheck
node packages/worldgen/sim/balance.ts 250 3   # resource balance checks
```

Server environment variables:

| Variable | Meaning |
|---|---|
| `SPEED` | economy speed multiplier |
| `SEED` | world seed |
| `SHIELD_MS` | new-player shield length |
| `TURN_MS` | world turn length (testing) |
| `COUNTDOWN_SCALE` | countdown length multiplier (testing) |
| `DATA` | snapshot path |

## Architecture as built

```
packages/shared       constants (every number traced to a spec), entity types, zod protocol, grid geometry
packages/worldgen     terrain, elo field, resource clusters, balance simulator, previews
packages/rules        gaits, A*, group movement (formation, lead point, waiting rule), battle wrapper (chess.js), economy formulas, Glicko-2
packages/client-core  protocol connection (reconnect/backoff) and the Mirror (a client's world view), shared by the web client, bots and tests
packages/engine       Stockfish pool (child processes speaking UCI), shared by the server's AI stand-in and bots
apps/server           authoritative game: world state, 600ms world turns, economy tick, battles, idle routines, persistence, WebSocket
apps/client           PixiJS world + React HUD + Tone.js audio; PWA
apps/bots             bot runner: personas, utility AI, human-like chess
art                   code-generated SVG art (used by the client at runtime)
```

## Specs

| Spec | Built |
|---|---|
| world.md | Terrain from a seed (on client and server; terrain never crosses the network), rivers with fords, the elo field with pockets and the new-player fade |
| resources.md | The cluster algorithm; balance targets in CI |
| movement.md | World turns; all six gaits (knights jump, pawns turn in place, sliders cover up to 8); troops with chess-line formation, the lead point and the waiting rule; A*; drifting toward the nearest king when out of reach; the one reach rule |
| battle.md | Attack orders and engagement range; 60s siege / 15s field countdowns with frozen rosters; calling off an attack (with cooldown); surrendering during the countdown; the arena sealed in the world; set picking (nearest pieces, bishop square colors, castling rights); 5+3 clocks; AI takeover after 20s offline; promotion kept permanently; aftermath (deaths, fleeing, conversions, building transfer, Emperor fall); cooldowns from regeneration time; ratings when 75% or more of moves were made by humans; spectating |
| economy.md | Adjacency production; construction drawn from within 10 squares; production rate scaled by richness; the anchor rule with grace and decay to ruins; population cap; palace modes; alternating bishop colors; wheat and trees regrow, stone and ore run out |
| progression.md | Unique usernames; guest empires fall 15 minutes after the player leaves unsigned (name freed); Google sign-in links the empire and works across devices;  Glicko-2; Emperor fall with option (b) (masterless holdings claimed by nearby kings, vanishing after 2h); respawn at a lower-elo area; spawn shield; "While you were away" report |
| migration.md | Emergent. Bots expand toward higher elo using only richness utility |
| ux.md | Phone and desktop layouts; touch gestures (pan, pinch, two-finger twist rotate, long-press lasso, double-tap group, drag-to-command, two-step tap-and-Move); mouse and keyboard (box select, right-click command, wheel zoom, WASD, Q/E, H, S, B, Esc); bottom sheets; troop bar; attack confirmation; alerts with jump-to; placement preview with its work area and reasons; welcome; guide; PWA manifest and service worker; haptics where supported |
| visuals.md | 100 BPM heartbeat; gait animations (knight arc, queen glide, elephant stomp, pawn step and about-face); idle breathing; idle routines (pawn drill, knight's circuit, bishop procession, elephant patrol, queen survey, king pacing); births; construction; nodes shrinking; decay tint; wind field (trees and wheat sway in gusts); birds that scatter from troops; water glints; day and night with lit windows and lanterns; worn paths from traffic; plaza ground; selection pop; path preview; ripples; dust; conversion wave; checkmate flood; watch mode |
| audio.md | Tone.js clock locked to world turns; every piece kind a percussion voice on the beat; D Dorian UI plucks (rising runs when lasso-selecting); commit chord; attack horn; countdown heartbeat; chess clacks and captures; check sting; checkmate gong and choir; production bell ladder; conversion payout cascade; drone plus endless generative ornaments over a chord cycle; wind and bird ambience; volume categories |
| wilds.md | 32 creature factions (chess roles as creatures, 32 heads, 27 mounts, 20 camp structures); deterministic camp sites by biome, rating and rarity near matching resources; camps appear near players, fill in over time, and are simulated only while a person is viewing them (otherwise they sleep as a record whose roster keeps growing); bigger bands near stronger players; growth from K+P toward a full set, driven by nearby building; rating grows into the area's; roaming; hordes and lairs raid online field troops (never Emperors or settlements); scattering on defeat; creatures never convert; Inspect card and hover names |
| world.md §2b | 18 biomes (12 common from temperature, moisture and height; 6 rare pockets weighted by area rating); purely visual plus wildlife: terrain, resources and balance unchanged |
| bots.md | Ordinary accounts on the public protocol; personas (strength, style, risk); utility AI (build with diminishing returns, attack by P(win) × stake, expand toward richer land, gather strays, pause houses when pawn-heavy); human-like chess timing, resignations and emotes; persistent identities |

Additions not in the original specs:
- **Practice battles vs AI.** Full sets, unrated, no world effect. Useful onboarding, and a battle-UI test bed.
- **Pause production on any building.** Found by the bot simulation: houses otherwise fill the population cap and starve stables and barracks.

## Production

Deployed on AWS: Lightsail ($7/mo) behind CloudFront, with DNS in Route 53. See [deploy/README.md](../deploy/README.md).

## Deviations

| Spec said | Built | Why |
|---|---|---|
| uWebSockets.js (T5) | `ws` | Simpler install. The adapter is one small file (`apps/server/src/net.ts`). |
| Postgres with write-behind (T11) | An atomic JSON snapshot every 15s and on shutdown, behind `save()`/`load()` | Zero setup for development. The interface is where Postgres slots in. |
| Atlas with a team-color mask (T13) | SVG rasterized at runtime per (asset, color), then cached | Lets any player color work with crisp art and no build step. Revisit if texture memory becomes a problem. |
| Maia for bot chess (bots.md §4) | Stockfish at the bot's rating, plus human timing | Maia needs lc0 and model weights. Stockfish is the placeholder, behind `ChessAI`. |
| Capacitor and push (T18) | PWA plus local notifications while the tab is hidden | Web push needs VAPID keys and a push service; native wrappers come at alpha. |
| Right-drag sets facing (ux.md §3) | Right-drag pans; formation facing follows the path | Panning with the mouse turned out to matter more on desktop. |
| Chunk graph for long paths | A*, capped at 6,000 expansions (then heads toward the closest reached square) | Enough for current distances. |

## Not yet

- The population manager's phase-out schedule and bot detectability measurements (bots.md §7–8).
- Rare moments, crowds drifting toward battle domes, weather (visuals.md).
- Recorded audio assets (all audio is synthesized, as planned for day 0).
- Sharding (T12); a guaranteed walkable path between chunks (world.md §2, step 6).
- Lichess OAuth and rating import. (Google sign-in is built.)
