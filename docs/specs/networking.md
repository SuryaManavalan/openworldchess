# Networking and Server Spec

Covers the protocol between client and server, what each client gets sent, how state stays in sync, and how the server is organized. The reasoning behind these choices is in [TECH.md](../TECH.md) T5–T8 and T11–T12.

## 1. Connection

1. The client gets a session token over HTTPS (`POST /auth/guest`, or OAuth).
2. The client opens `wss://…/play?token=…`, and the server checks the token.
3. The server sends `hello`: player info, world seed, protocol version, server time, the current world turn number, and the client's home location.
4. The client subscribes to the chunks around its camera (§3).
5. Heartbeat: the client pings every 10 seconds, and the server drops the connection after 30 seconds of silence. A dropped player's troops stay in the world ([progression.md](progression.md) §5).

If the protocol versions don't match, the server closes the connection with code `4001 upgrade-required`, and the client reloads.

## 2. Messages

All messages are defined as zod schemas in `packages/shared/protocol`. The format is `{ t: <type>, ...fields }`. Messages that expect a reply carry `rid` (a request id).

### Client → server (intents)

| Type | Fields | Notes |
|---|---|---|
| `sub` | `chunks: [cx, cy][]` | Replaces the set of subscribed chunks. At most 64. |
| `order.move` | `pieceIds[], to: [x, y], formation?` | Moves the group. If it includes a king, the group moves as a troop; otherwise the move is limited to within reach of the owner's kings. |
| `order.attack` | `kingId, targetKingId` | Validated against [battle.md](battle.md) §2. |
| `order.cancel` | `troopId` | Stops the troop, or cancels an attack countdown. |
| `build` | `kingId, building, at: [x, y]` | The king must be within 10 squares of the footprint. |
| `palace.mode` | `buildingId, mode: 'alt' \| 'king' \| 'queen'` | |
| `battle.move` | `battleId, uci` | For example `e2e4` or `e7e8q`. |
| `battle.resign` / `battle.draw` | `battleId` | `draw` offers a draw, or accepts one on offer. |
| `battle.watch` / `battle.unwatch` | `battleId` | Spectating. |
| `emote` | `battleId?, id` | |

### Server → client (state)

| Type | Fields | Notes |
|---|---|---|
| `chunk.snap` | `cx, cy, overlay, entities[]` | Everything in a newly subscribed chunk. |
| `turn` | `n, moves[], spawns[], despawns[], changes[]` | One per world turn, **for subscribed chunks only**. `moves` are `[pieceId, from, to, gait]` so the client can animate. |
| `buildings.state` | production (progress, blocked reason), which nodes each building draws from, decay | Only sent to the city's owner. |
| `alert` | `kind, …` | For example `settlement.attacked` with the attacked `kingId` and a countdown. |
| `battle.start` | `battleId, fen, white, black, clocks, pieceMap` | Sent to both players, plus a short version to everyone subscribed to the arena's chunk. |
| `battle.move` | `battleId, uci, san, clocks, fen` | Sent to the players and spectators. |
| `battle.end` | `battleId, result, termination, aftermath` | `aftermath` lists pieces lost, converted and routed. |
| `ack` / `err` | `rid, code?, msg?` | The result of an intent. |

## 3. Interest management

- Clients subscribe to the chunks that cover their viewport, plus a one-chunk margin. That's at most 64 chunks (a 32×32-square chunk means up to 256 squares on each side of the camera).
- Zoomed all the way out, the client switches to a **low-detail feed**: it receives only troop summaries (position, owner and piece count) through `sub.summary`, not individual pieces.
- The server keeps `chunk → Set<connection>` and sends each client only the events for chunks it has subscribed to.
- Your own entities (cities, troops) are always sent to you, wherever they are, as low-detail summaries when they're outside your subscriptions. That's what powers the minimap and troop list.

## 4. Sync model

- **The server is authoritative.** Clients never change world state; they only animate what the server says happened.
- **Turn events are the source of truth.** A client that misses a turn (a gap in `n`) asks for a fresh `chunk.snap` of its subscribed chunks.
- **Prediction for your own troops:** when you issue `order.move`, the client runs the shared pathfinding and shows the planned route right away. It animates only the moves that arrive in `turn` messages. Any mismatch is corrected on the next turn.
- **Battle clocks:** the server keeps time. Every move carries both clocks. Between moves, the client counts down locally from the server's value plus a latency estimate.

## 5. Bandwidth budget (target)

- A typical view: about 200 visible pieces, 30 of them moving per turn. That's about 30 moves × ~16 bytes ≈ 500 bytes per turn, or ≈ **1 KB/s** at 600ms turns.
- A chunk snapshot: 0.5–5 KB (terrain isn't sent; [TECH.md](../TECH.md) T8).
- Budget: under 10 KB/s per client in busy areas. Switch to MessagePack and delta encoding if it's exceeded.

## 6. Security and abuse

- Every intent is validated: ownership, range, cooldown, resources, and the order's shape (with zod).
- Rate limits per connection: 20 intents/second on average, with bursts up to 40. Chunk subscriptions are limited to 2/second.
- Battle moves are rejected if it isn't your turn. Chess legality is checked with chess.js on the server.
- Positions and anything else not visible to a client are never sent to it. Fog of war can come later.

## 7. Server modules (`apps/server`)

```
net/          WebSocket adapter (uWS), sessions, codec, rate limits
sim/          world loop: 10Hz tick, world turns, order queue, move resolution
world/        chunk cache (worldgen + overlay), spatial hash, occupancy
troops/       troops, formations, pathfinding (uses packages/rules)
cities/       founding, building, production, anchoring and decay
battles/      engagement, countdowns, arena, Battle wrapper, clocks, aftermath
ai/           Stockfish process pool (UCI), strength mapping
persist/      Drizzle schema, write-behind flusher, transactional event writes
admin/        metrics (Prometheus), admin commands, replay export
```

The loop, per 100ms tick:
1. Drain the incoming intents.
2. Advance timers: countdowns, clocks, decay, production.
3. Every 6th tick, run a **world turn**: resolve gait moves, then send `turn` messages.
4. Queue changed entities for the flusher.

## 8. Persistence outline (Postgres, Drizzle)

```
players(id, name, color, rating, rd, vol, emperor_piece_id, created_at, …)
pieces(id, owner_id, type, x, y, facing, troop_id, city_id, state, promoted_from, …)
troops(id, owner_id, king_id, formation, path, cooldown_until, state)
buildings(id, owner_id, type, x, y, hp, progress, state, palace_mode, cooldown_until)   -- no cities table: settlements are derived
chunk_changes(cx, cy, data jsonb, updated_at)
battles(id, kind, …, pgn, result, …)            -- see battle.md §11
events(id, player_id, kind, data jsonb, at)     -- feeds "While you were away"
```

- Positions are written behind in batches.
- Everything in `battles` and anything that changes ownership (conversions, transfers, respawns) is written in a transaction when it happens.
