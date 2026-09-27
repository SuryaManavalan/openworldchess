# Performance Spec

**Decided:** this is a small 2D game on a $7 server, and it has to stay fast as the world grows. Work should scale with **what people are looking at**, not with the size of the world or the number of bots. Everything here is measured before and after (§2, §3).

## 1. Budgets

| What | Budget | Why |
|---|---|---|
| World turn (server, all phases) | **< 60 ms** on the production box (10% of the 600 ms beat) | The beat is the game's heartbeat: pieces, music and animations all hang on it. |
| Turn lateness | **< 5 ms** average | Players feel a wobbling beat. The turn has its own timer, aimed at the moment it's due. |
| Anything else in one go | **< 50 ms** | Anything longer blocks the network and the next turn. Big jobs are time-sliced (§4). |
| Server CPU at rest | **< 20%** of one core | Leaves room for battles' chess engines and the bots. |
| Client per-frame work (ours, not the GPU's) | **< 4 ms** | Keeps 60 fps on phones. |
| Network per client, watching a busy town | **< 10 KB/s** | Phones on cellular. |

## 2. Observability

- **Server:** `apps/server/src/perf.ts`.
  - Every phase is timed (count, total, average, max, share of wall time): `turn` (split into `turn.groups`, `turn.drift`, `turn.routines`, `turn.wilds`, `turn.claims`), `economy`, `wilds.tick`, `battles.tick`, `net.flushTurn`, `net.sendAllMine`, `net.sendAllSelf`, each client message type (`msg.<type>`, with `.bot` for bots), `path.order`, `save`, `maintain`. There is also `turn.late`.
  - It also records event-loop lag (p50, p99, max), memory, and gauges (pieces, buildings, groups, players, awake camps, sessions, battles, turn).
  - A summary line goes to the log every minute (`[perf] …`). Anything slower than 250 ms is logged on its own (`[perf] slow …`).
  - `GET /metrics` returns the last full minute and the live window as JSON. It's only answered from the machine itself: `ssh … curl -s localhost/metrics`.
- **Client:** add `?perf` to the URL for an overlay. It shows:
  - fps and our per-frame work in ms;
  - what's on the stage: node sprites on stage against loaded, pieces, buildings, chunk textures;
  - what the client knows about;
  - network KB/s and messages per second.
- **Profiling production** (when numbers look wrong):
  1. `sudo kill -USR1 <pid>` opens the V8 inspector on 127.0.0.1:9229.
  2. Open an SSH tunnel to it.
  3. Run `Profiler.start`/`stop` over the DevTools protocol for about 10 s, and add up self and inclusive time per function.

  Restarting the service closes the inspector again.

## 3. The benchmark

`node apps/server/bench/replay.ts <world.json> [turns] [--orders] [--watch-all]` replays a saved world headless and prints the phase table.
- `--orders` makes every bot march a troop somewhere new every 30 s.
- `--watch-all` treats the whole world as being watched (the worst case).

Use a copy of production's world with emails, Google ids and tokens stripped, and delete it afterwards.

**Results** on production's world (1,090 pieces, 715 buildings, 246 players including camps; laptop CPU, which is roughly 4–6× faster than production):

| Step | ms per turn |
|---|---|
| Before this pass | 54.5 |
| Walkability grids + gait fast path + heap search | 29.5 |
| Waiting instead of searching when boxed in; stuck pieces retry every 3rd turn | 19.6 |
| Watched-area level of detail (§5) | **13.7** (44.7 with `--watch-all` and every camp awake) |

## 4. Server techniques in use

1. **Walkability grids** (`World.walkable`): one byte per square per chunk, rebuilt only when something there changes (a building, a tree felled or regrown, rock mined out). It's the question every search asks at every step, so it's an array read, with no maps or strings.
2. **Gait search:** most turns take the best single move without searching. Only obstacles or a pawn that must turn trigger a real search (binary heap, numeric keys). A piece boxed in right next to its slot waits.
3. **Time-slicing:** anything big is spread out with a budget per turn or per tick. That covers:
   - long-route planning for marches (60 ms per turn);
   - idle routines (90 searched moves and 2 routes per turn, round-robin);
   - new camp sites (4 every 5 s);
   - camps waking (12 every 5 s) and roaming (8 routes every 5 s);
   - strays finding their way home (2 per turn).
4. **Rate limits on orders:** people get 2 pathfinding orders a second (bursts of 6); bots get one every 2 seconds. A bot's order searches for at most 80 ms, a person's 250 ms.
5. **Worldgen without the world's caches:** checking thousands of camp sites reads worldgen directly, so it can't churn the server's chunk memory. Terrain and biome caches forget their oldest quarter when full, rather than everything at once.
6. **No allocation in hot paths:** for example, `inReach` walks its king set directly.
7. **Smaller, rarer writes:**
   - saves once a minute;
   - trails walked fewer than 3 times aren't saved (single footprints were 80% of the file).

## 5. Simulate what's watched (level of detail)

The standard trick in big-world games: full detail where someone is looking, and a cheap approximation (or nothing) elsewhere. "Watched" means a chunk that a **person** is subscribed to; bots don't count.

| System | Watched | Not watched |
|---|---|---|
| Wild camps | Awake: pieces, roaming, raiding | Asleep: a record whose roster still grows (wilds.md §3) |
| Idle routines (drills, haulers, merchants) | Run | Don't run: they're only decoration |
| Marching troops | Full formation search | Lighter searches; stuck pieces retry less often |
| Strays drifting home | Every 2nd turn | Every 6th turn |
| Rules: battles, production, orders, reach | Always, identically | Always, identically |

Rules never depend on whether anyone is watching. Only the look of things does.

## 6. Network

- A turn sends each client only what changed in its chunks, plus its own things.
- **Moves and states are separate:** a piece that only walked goes out as a compact move event to people who already saw it. Its full state is sent only when something else changed, or when the client didn't know the piece yet.
- **Bots** get piece states and no move events (they don't draw).
- **Full holdings** (`mine`) are resent every 30 s, and right after a battle only to the two players involved. The small `self` update (population cap, shield) still goes out every 2.5 s, to people only.
- **Sleeping camps** aren't in the player list.

## 7. Client techniques in use

- **Culling:** only on-screen trees, rocks and crops are on the stage. Off-screen pieces and buildings aren't drawn. Depth sorting and drawing now scale with the view, not the loaded area.
- **Static transforms:** nodes only recompute position and depth when the camera turns.
- **No leaks:** a node's sprite is destroyed when its chunk is forgotten. They used to pile up as you panned, reaching 4,000 sprites for 900 nodes.
- **Far zoom:** a cheap chunk painter and dots (client.md).
- **Measured** with `?perf` on production's busiest town: our per-frame work went from 1.3 ms to 0.35 ms, and stage children from about 4,300 to 224.

## 8. Next, when the numbers ask for it

- **Pathfinding off the main thread** (worker threads) for orders and long legs, with results applied a turn later.
- **Flow fields** for big groups heading to the same place, and hierarchical pathfinding (HPA*) with cached region graphs instead of per-order coarse A*.
- **A binary protocol with delta compression** for turn messages (positions as varint deltas), and player-list deltas instead of full lists.
- **Incremental or off-thread saves** (write changed entities only).
- **Client:**
  - a texture atlas for nature and creature art (fewer texture switches);
  - pooled sprites;
  - per-chunk static containers baked for far zoom.
- **Bots:**
  - plan against a coarse summary of the world instead of full chunk subscriptions;
  - a separate process budget, with the bot count scaled to server load.
