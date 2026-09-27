# Technical Decisions

Each section below is one decision. It lists the options considered, how they compare, and a recommendation. **Proposed** means the recommendation is waiting for your sign-off. **Decided** means you already chose it. For game rules, see [DESIGN.md](DESIGN.md) and the [specs](specs/).

| # | Decision | Recommendation | Status |
|---|---|---|---|
| T1 | Language | TypeScript on client and server, with shared packages | Proposed |
| T2 | Repo layout | pnpm workspace monorepo | Proposed |
| T3 | Client rendering | PixiJS v8 (WebGL 2D) | Proposed |
| T4 | Client UI | React for the HUD and menus, drawn over the game canvas | Proposed |
| T5 | Server runtime | Node.js with an authoritative game server | Proposed |
| T6 | Transport | WebSocket; JSON first, MessagePack later | Proposed |
| T7 | Simulation model | Fixed server tick plus discrete "world turns" | Proposed |
| T8 | World storage | Terrain generated from a seed; only changes are stored | Proposed |
| T9 | Chess rules | chess.js inside a thin wrapper of our own | Proposed |
| T10 | Chess AI | Stockfish as a server-side process | Proposed |
| T11 | Database | PostgreSQL; in-memory state with write-behind | Proposed |
| T12 | Scaling | One shard first; split by world region later | Proposed |
| T13 | Art pipeline | SVG from code, rasterized to texture atlases, with a team-color mask layer | Proposed |
| T14 | Auth | Guest accounts first, then OAuth | Proposed |
| T15 | Hosting | Static client on a CDN; server and database on one managed host | Proposed |
| T16 | Testing | Vitest, deterministic simulation tests, headless bot clients | Proposed |
| T17 | Bots | A separate bot-runner process on the public protocol; Maia + Stockfish for chess | Proposed |
| T18 | Mobile delivery | A PWA from day 0; Capacitor wrappers for iOS and Android by the alpha | Proposed |
| T19 | Audio engine | Tone.js, with its clock locked to the server's world turn | Proposed |

---

## T1. Language: TypeScript everywhere

| Option | For | Against |
|---|---|---|
| **TypeScript client + server** | One set of rule code (chess, movement, costs) runs on both sides. Client prediction is identical to the server. One language to hire for and one toolchain. | Node is slower than Go or Rust for heavy simulation. |
| TS client + Go server | Fast server with easy concurrency. | Every rule is written twice and the two copies drift. |
| TS client + Rust server | Fastest, and the rules could be shared through WASM. | High complexity for a solo or small team, and slow to iterate. |
| Unity / Godot | Full engine and editor. | The game is 2D and grid-based, so an engine buys little. Web delivery is heavier, and the art pipeline is already code. |

**Recommendation:** TypeScript everywhere. The simulation is cheap: integer grid moves a few times per second, nothing like physics. Sharing the rules is worth far more than raw speed. If one hot path (pathfinding, interest management) ever needs speed, it can move to Rust/WASM on its own later.

## T2. Repo layout: pnpm monorepo

```
openworldchess/
  apps/
    client/        PixiJS + React, built with Vite
    server/        Node game server
  packages/
    shared/        types, constants, protocol messages, math (no I/O)
    rules/         chess wrapper, movement gaits, pathfinding, economy formulas
    worldgen/      seeded terrain and elo field (runs on client and server)
  art/             code-generated SVG art, builds atlases for the client
  docs/
```

`rules` and `worldgen` must be **pure and deterministic**: no `Date.now()`, no `Math.random()`. Pass in time and a seeded RNG instead. That's what lets the client predict what the server will do and lets tests replay games exactly.

Tooling: pnpm workspaces, Vite (client), tsx (server dev), tsup (server build), Vitest, ESLint, Prettier. GitHub Actions runs typecheck, lint and tests on every PR.

## T3. Client rendering: PixiJS v8

| Option | For | Against |
|---|---|---|
| **PixiJS** | Fast WebGL 2D sprite batching; tens of thousands of sprites without trouble. Small, focused, and we own the game loop. | You build your own scene structure (a feature, given this grid game). |
| Phaser | Full framework: scenes, input, tweens. | Heavier and opinionated. Its physics and tilemap systems don't suit an infinite procedural grid. |
| Canvas 2D | Nothing to learn. | Too slow once zoomed out over hundreds of chunks. |
| Three.js / 3D | Could rotate the camera freely. | We chose 2D art, so this is overkill. |

**Recommendation:** PixiJS. Terrain renders per chunk into a cached texture, and each chunk is redrawn only when it changes. Pieces, buildings and resources are sprites on a y-sorted layer. Tweens come from a small library (GSAP or `@tweenjs/tween.js`) or our own easing helpers.

## T4. Client UI: React over the canvas

The HUD (resources, troop panel, battle clocks, alerts like "City A is being attacked", menus) is ordinary DOM UI. React is well known and easy to hire for. The game canvas stays outside React: React never re-renders the world. The two talk through a small client store (Zustand), so the canvas can publish selection state and the HUD can send commands.

Alternative: Svelte or Solid would be lighter. React wins on familiarity; revisit only if bundle size becomes a problem.

## T5. Server runtime: authoritative Node server

- The server owns all state. Clients send **intents** ("move troop T to (x, y)", "play e2e4 in battle B"), and the server validates them and broadcasts results. That's the only real defense against cheating in an MMO.
- The server is a single process with an explicit game loop (see T7).
- WebSockets use `uWebSockets.js`, which is faster and lighter than `ws`. Keep it behind a small adapter so it can be swapped for `ws` if needed.
- **Colyseus** was considered. Its room model is a good fit for battles, but the open world isn't room-shaped, and we'd be fighting the framework at chunk boundaries. Its useful ideas (delta state sync, room lifecycles) are easy to borrow.

## T6. Transport: WebSocket, JSON first, MessagePack later

- One WebSocket per client. WebRTC and UDP aren't worth the trouble: movement happens in discrete turns and battles are turn-based, so nothing needs sub-100ms precision.
- Messages are a discriminated union in `packages/shared/protocol`, validated with **zod** on the server. Never trust the client's shape.
- Start with JSON, which is easy to debug. Switch to MessagePack once the protocol settles; it's a one-line change in the codec.
- See [specs/networking.md](specs/networking.md).

## T7. Simulation model: server tick plus world turns

| Option | For | Against |
|---|---|---|
| Continuous real time (per-frame positions) | Smooth, and familiar from RTS games. | Doesn't fit chess, since pieces sit on squares. Hard to sync and hard to make deterministic. |
| **Discrete world turns on a fixed tick** | Every piece acts at most once per world turn, like chess. Deterministic, cheap to sync (one move per piece per turn), and easy to test. | Needs client-side animation to feel smooth (which we want anyway). |

**Recommendation:**
- The server runs at **10 ticks/second**, for network I/O, battle clocks and timers.
- The world advances one **world turn every 600ms** (tunable). In a world turn, each moving piece takes its next gait step. The client animates each step over the 600ms, so motion looks continuous and rhythmic.
- Battles don't use world turns. They run on chess moves and clocks.

## T8. World storage: terrain from a seed, only changes stored

The world is unbounded, so it can't be stored whole.

- **Coordinates:** signed 32-bit integers (x, y), which gives ±2.1 billion squares, plenty.
- **Chunks:** 32×32 squares. Chunk key = `(floor(x/32), floor(y/32))`.
- **Terrain** (grass, sand, water, forest, rock) and **base resource nodes** come from `worldgen(seed, chunkX, chunkY)`, a pure function. Client and server both run it, so terrain never crosses the network.
- **Changes** are stored per chunk: buildings, depleted or regrown resources, placed roads. The server keeps a chunk overlay: `{ chunkKey → changes }`.
- **Entities** (pieces, troops, cities) live in a spatial hash keyed by chunk, for fast "what's near here" queries.
- Noise: our own seeded value noise with fractal layers (`packages/worldgen/src/random.ts`), so there's no dependency. See [specs/world.md](specs/world.md) and [specs/resources.md](specs/resources.md).

## T9. Chess rules: chess.js wrapped

Battles are always standard chess with **at most** one standard set per side, and both kings are always present (the attacker must bring one, and the city king always fights). Standard FEN can express this, missing pieces included.

| Option | For | Against |
|---|---|---|
| **chess.js** (BSD-2) | Mature, fast enough, handles FEN, SAN, and every draw rule. | We must build the FEN ourselves and set castling rights correctly. |
| Our own move generator | Full control. | Weeks of work and a source of subtle bugs (en passant, pins). |
| chessops (GPL-3) | Excellent (it powers lichess). | GPL-3 on the client means the client must be GPL too. Avoid unless we want that. |

**Recommendation:** chess.js, behind our own `Battle` wrapper, which handles:
- building the starting FEN from each side's pieces;
- castling rights: only when the king and that rook ("Elephant") are both on their home squares;
- mapping battle squares back to piece identities, so the world knows which pieces died and which pawns promoted;
- clocks and the outcome.

## T10. Chess AI: Stockfish on the server

Needed for offline defenders, AFK takeover and practice battles.

- **Stockfish 17** runs as a pool of UCI processes on the server. It's GPL-3, but running it on our own server is not distribution, so our code stays unaffected. **Never ship Stockfish in the client bundle.**
- Strength comes from `UCI_LimitStrength` plus `UCI_Elo` (about 1320–3190), with a skill level below that. The AI plays at the **defending player's rating** (or the area's elo for a brand-new player), so being offline is neither much better nor much worse than playing yourself.
- Cost: short move times (100–500ms) keep one core able to serve many AI battles at once. Pool size scales with how many battles are AI-controlled.

## T11. Database: PostgreSQL with write-behind

- **PostgreSQL** holds accounts, players, ratings, pieces, troops, cities, buildings, chunk changes, battle records (full move lists in PGN) and events.
- The live world is **in memory** on the shard. Changed entities are flushed every ~5 seconds in batches.
- **Critical events are written transactionally and at once:** battle results, conversions, respawns, and anything that moves ownership. A crash can lose at most a few seconds of walking, never a battle outcome.
- Schema migrations: `node-pg-migrate` or Drizzle. **Drizzle** (a typed schema in TypeScript, shared with the code) is the recommendation.
- Redis isn't needed at first. Add it when there are several shards (for presence, pub/sub between shards, and rate limits).

## T12. Scaling: one shard, then regions

- **Phase 1:** one server process owns the whole world. Target: **200 concurrent players** and about 20,000 pieces on one machine. That's cheap: per world turn it's O(moving pieces) gait steps.
- **Phase 2:** split the world into regions (for example 64×64 chunks), each owned by one shard process, with a gateway routing clients. Crossing a region boundary hands the troop off between shards. Battles belong to the shard where they start.
- The elo map helps: most activity clusters in a few rating bands, which spreads load naturally.
- Design for Phase 2 now: every system addresses entities through chunk or region keys and never assumes one global list.

## T13. Art pipeline: SVG from code to atlases

The pipeline already exists in `art/`; see [specs/art.md](specs/art.md). The decisions are:

- Each asset is exported as two layers: **base** (everything) and **team mask** (collar, mane, blanket, flags). At runtime the mask sprite is tinted with the player's color, so **any** player color works without an image per color.
- Build step: resvg rasterizes each layer at 1x and 2x of a 64px square, and the results are packed into a texture atlas (for example with `free-tex-packer-core`) plus a JSON frame map for Pixi.
- Terrain is drawn as tiles per terrain type, light and dark, several variants each, then composited into chunk textures on the client.

## T14. Auth: guest first, then OAuth

- **Phase 1:** play as a guest immediately. A signed token is stored locally, and the account upgrades later without losing progress.
- **Phase 2:** OAuth with Google and Discord. **Lichess OAuth** is worth adding: we could seed a player's starting rating from their lichess rating, which improves where they spawn on the elo map.
- Sessions use short-lived JWTs on the WebSocket handshake plus a refresh token.

## T15. Hosting

- **Client:** a static build on Cloudflare Pages or Netlify.
- **Server + database:** Fly.io (the app near its users, plus managed Postgres) or a single VPS (Hetzner) running Docker Compose. Start on one VPS: it's cheap, simple and has predictable latency. Move when load requires it.
- Put the Stockfish pool on the same machine at first.

## T16. Testing strategy

- **`rules` and `worldgen`:** Vitest unit tests.
  - Gait moves for every piece.
  - Building a FEN from partial sets, including castling-rights edge cases.
  - Cooldown math.
  - Worldgen staying stable for a given seed. A snapshot test catches accidental changes to the world.
- **Deterministic simulation tests:** feed a scripted list of intents into the server simulation and assert the final state.
- **Bot clients:** headless scripts that connect over WebSocket, wander, attack and play random or engine moves. They double as load tests.
- **Visual:** the art build produces contact sheets; later, screenshot tests of the client with Playwright.

## T17. Bots: a separate runner on the public protocol

| Option | For | Against |
|---|---|---|
| **A separate bot-runner process using the WebSocket protocol** | Bots have exactly the powers players have; the runner doubles as a load test and a protocol completeness test; it scales separately | Some protocol overhead (negligible) |
| AI agents inside the game server | Cheaper; direct access to state | Tempting to cheat (reading hidden state); code paths bots use that humans don't; harder to trust |

**Recommendation:** a separate runner, with no database access. Chess uses **Maia** (a human-like engine that runs on lc0, GPL-3, server-side only) for ratings up to about 2000, mixed with Stockfish above that. An offline mode runs the server simulation and bots in one process at ×20 speed, for balance and emergence testing. See [specs/bots.md](specs/bots.md).

## T18. Mobile delivery: PWA first, then Capacitor

| Option | For | Against |
|---|---|---|
| **A PWA (installable web app)** | One codebase, instant updates, works in every browser | iOS push only when installed (16.4+) and unreliable; no haptics on iOS |
| **Capacitor wrapper (iOS + Android)** | Reliable push (critical for the 60-second attack warning), haptics, app stores; **the same web codebase** | App store review; build pipelines |
| React Native / native | The most native feel | A second codebase for the game view; loses the shared Pixi renderer |

**Recommendation:** a PWA from day 0, and Capacitor builds no later than M6. Everything is designed for touch from the start ([specs/ux.md](specs/ux.md)), so the wrapper is packaging, not a redesign. Gestures come from our own small recognizer on Pointer Events.

## T19. Audio engine: Tone.js locked to the world turn

| Option | For | Against |
|---|---|---|
| **Tone.js** | Musical timing (a transport, quantization), a sampler, synths, effects; everything is in the same key and on the same beat | About 150 KB; more API to learn |
| Howler.js | Simple sprites, sorts out mobile audio unlocking | No musical timing; beat sync would have to be built by hand |
| Raw Web Audio | Full control | Rebuilding what Tone already does |

**Recommendation:** Tone.js, with its clock locked to the server's world-turn clock. That way sound, animation ([visuals.md](specs/visuals.md) §1) and simulation share one beat. See [specs/audio.md](specs/audio.md).

## Cross-cutting risks

| Risk | Impact | Mitigation |
|---|---|---|
| Engine cheating in battles | Battles are the core of the game, and anyone can run Stockfish in another tab. | Accept it for now. Later: move-time statistics, engine-match heuristics, reports. Rating-banded zones limit the damage. |
| Offline players losing everything | Players quit. | AI defender at their own rating, a countdown alert, city cooldowns, and fleeing survivors. |
| Griefing new players | Bad retention. | Spawn by elo map; possibly spawn protection (see [specs/progression.md](specs/progression.md)). |
| Troop pathfinding cost on an unbounded grid | Server CPU. | Cap path search to a radius; plan long routes over chunks. See [specs/movement.md](specs/movement.md). |
| Too many rules for players to learn | Players bounce off. | Battles are plain chess, which players already know. Teach the world rules in a short, guided first session. |
