# Roadmap

Milestones in build order. Each one ends with something playable that tests the riskiest assumption at that point.

**Definition of done for every milestone:**
- It works on a phone in portrait **and** on desktop ([specs/ux.md](specs/ux.md)).
- Bots can do everything the milestone adds ([specs/bots.md](specs/bots.md)).
- It follows the rule of emergence over features ([PRINCIPLES.md](PRINCIPLES.md)).
- Its visuals and sound follow the build orders in [visuals.md](specs/visuals.md) §8 and [audio.md](specs/audio.md) §10. Specs are in [specs/](specs/), and the reasoning behind technical choices is in [TECH.md](TECH.md).

## M0: Foundations
- A pnpm monorepo: `apps/client`, `apps/server`, `packages/shared`, `packages/rules`, `packages/worldgen` ([TECH.md](TECH.md) T2).
- TypeScript, ESLint, Prettier and Vitest; GitHub Actions CI.
- Art build: two layers (base and team mask), and atlas output into the client ([specs/art.md](specs/art.md) §4).
- A PWA shell, the gesture recognizer, the command layer, and a responsive layout skeleton (phone and desktop).
- **Done when:** `pnpm dev` starts the client and server; the client connects and renders one tinted piece from the atlas.

## M1: Battle prototype (the core of the game)
- A `Battle` wrapper: builds the FEN from partial sets and places missing pieces and bishop colors correctly ([battle.md](specs/battle.md) §4).
- Server battles: clocks, moves, resign/draw, the result.
- A battle client screen: board, clocks, move list, promotion picker, with our pieces.
- The Stockfish pool; AI takeover on disconnect; a practice battle against the AI.
- **Battle bot:** Maia with human-like timing, resignations and draws ([bots.md](specs/bots.md) §4).
- A phone battle layout like chess.com's app, with haptics.
- **Done when:** two browsers play a timed battle with uneven sets (for example K+Q+8P against K+2N+2B+4P), and a disconnect hands over to the AI.
- **Tests the assumption:** chess with uneven armies is fun and readable.

## M2: The world and roaming
- `worldgen`: terrain, rivers, mountains, resource nodes, the elo field ([world.md](specs/world.md)). **A first version is already built** in `packages/worldgen`, with a balance simulator ([resources.md](specs/resources.md)). Still to do: port it into the monorepo setup and add the path guarantee between chunks.
- Client: chunk-streamed terrain, camera (pan, zoom, 90° rotation), level of detail, minimap.
- Server: world turns, the spatial hash, chunk subscriptions, `turn` messages.
- Troops: the command rule, gaits, formations, the waiting rule, pathfinding ([movement.md](specs/movement.md)).
- Movement animation for every gait.
- Drag-to-command, lasso selection, and two-finger twist to rotate ([ux.md](specs/ux.md) §3).
- **Roaming bots** and the first load test.
- **Done when:** several players each move a troop across a generated world; knights hop rivers, pawns stop to turn, queens leap ahead and wait.
- **Tests the assumption:** watching the troops move is interesting on its own.

## M3: Engagement
- Attack orders, countdowns and alerts; the arena in the world; the dome; sealing the arena ([battle.md](specs/battle.md) §2–3).
- Auto-picking the set and animating the assembly.
- Aftermath: deaths, promotions, routed bands, conversions. Cooldowns.
- Spectating from the world.
- Bots decide attacks and defense; push notifications for attacks (web push).
- **Done when:** a troop attacks another in the field; the loser routs home; a passerby watches through the dome.

## M4: Economy and cities
- Founding cities, building, the anchor rule and decay, anchor swaps ([economy.md](specs/economy.md)).
- The one reach rule: buildings and pieces stay within 10 squares of a king. No city object ([PRINCIPLES.md](PRINCIPLES.md) audit).
- Production rate scales with node richness ([migration.md](specs/migration.md) §3).
- **Economy bots** and the offline sped-up simulation; the first emergence checks ([migration.md](specs/migration.md) §5).
- The adjacency economy: work areas, nodes drawn on directly, construction drawing from within 10 squares of the site, running out and regrowing, production, the population cap.
- Sieges: city battles and transferring cities.
- **Done when:** a player builds up a city from the starting kit, and another player takes it.

## M5: Progression and persistence
- Postgres through Drizzle, write-behind saving, transactional battle results ([networking.md](specs/networking.md) §8).
- Glicko-2 ratings; the Emperor; restarting after an Emperor kill; the spawn shield ([progression.md](specs/progression.md)).
- Placement by elo when spawning and respawning; the "While you were away" report.
- Bot personas, schedules, persistent accounts, rating calibration.
- **Done when:** the server restarts without losing progress; an Emperor kill plays out end to end.

## M6: Alpha
- Hosting ([TECH.md](TECH.md) T15), guest plus OAuth login, lichess rating import.
- A load test with bot clients (200 simulated players).
- Art pass: missing assets, UI art, audio.
- A 10-minute guided first session.
- Capacitor builds for iOS and Android (reliable push, haptics).
- The bot population manager, phasing out, detectability measurements, kill switches.
- The migration checks pass in a 30-day simulated world ([migration.md](specs/migration.md) §5).
- **Done when:** outside testers play for a week.

## Decisions waiting on you

Already decided: an Emperor kill takes only what's nearby (option b); the battle clock is 5+3.

Collected from all the docs. Each has a recommendation in its spec.

| # | Question | Where | Recommendation |
|---|---|---|---|
| 1 | Should every army outside a city need a king (the command rule)? | [movement.md](specs/movement.md) §4 | Yes (see the reasoning there) |
| 2 | No captures in the open world, only inside battles? | [movement.md](specs/movement.md) §3 | Yes |
| 3 | Is chaining battles with reserves right: the cooldown locks only the pieces that fought? | [battle.md](specs/battle.md) §8 | Yes |
| 5 | Attacker plays white | [battle.md](specs/battle.md) §4 | Yes |
| 6 | Promoted pawns stay promoted in the world | [battle.md](specs/battle.md) §5 | Yes |
| 8 | The adjacency economy: buildings draw from nodes in their work area; no gathering, no stockpile | [economy.md](specs/economy.md) §1, §3 | Yes (your idea) |
| 9 | Starting kit includes a second king | [economy.md](specs/economy.md) §5 | Yes |
| 10 | Pieces are light-bodied with team color in the world; attacker light and defender dark in battles | [art.md](specs/art.md) §2 | Yes |
| 11 | The stack: TypeScript, PixiJS, Node, Postgres | [TECH.md](TECH.md) | Yes |
| 12 | One reach rule (10 squares) for buildings and pieces; no city object | [PRINCIPLES.md](PRINCIPLES.md), [economy.md](specs/economy.md) §2 | Yes |
| 13 | Production rate scales with node richness (the pull toward high elo) | [migration.md](specs/migration.md) §3 | Yes |
| 14 | Tell players bots exist at the level of the game (FAQ / terms), but don't label individual bots | [bots.md](specs/bots.md) §2 | Yes |
| 15 | PWA now, Capacitor by the alpha | [TECH.md](TECH.md) T18 | Yes |
| 16 | Idle routines are real server moves (cheap, and they give way to orders), so everyone sees the same life | [visuals.md](specs/visuals.md) §2 | Yes |
| 17 | A cosmetic day/night cycle (40 minutes) and desire paths worn in by traffic | [visuals.md](specs/visuals.md) §4 | Yes |
| 18 | Use casino-level sensory craft but not its compulsion mechanics | [audio.md](specs/audio.md) §7 | Yes |
