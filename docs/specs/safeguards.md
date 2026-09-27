# Safeguards: Runaway Loops

Every loop that can grow without limit, whether it breaks balance or overloads the server, with the fix in place. The numbers are in `packages/shared/src/constants.ts`. Tests are in `apps/server/test/safeguards.test.ts`.

The principle ([PRINCIPLES.md](../PRINCIPLES.md)): prefer **general limits that come from existing rules** (kings are scarce, everything lives near a king) over special cases. Hard caps exist mainly to protect the server.

## 1. Piece spam (population)

- **Loop:** houses raised the cap by 6 each *and* produced pawns, with no limit on houses, so the cap could grow without end.
- **Fix:** each king supports **16 pieces plus 6 per house within its reach, counting at most 3 houses**. That's at most 34 per king, about two chess sets. There's also a **hard cap of 400 per player**.
- Army size now scales with kings, the scarce resource. The HUD shows `pieces/cap`.

## 2. Kings breeding kings

- **Loop:** kings raise the cap and allow more palaces (one per king), and palaces make kings. That's exponential growth, limited only by gold.
- **Fix:** each king crowned takes longer: the palace's king time × (1 + kings/4). There's a **hard cap of 20 kings**. At the cap, a palace makes queens instead.

## 3. Building spam

- **Loop:** unlimited buildings, and the economy tick's cost grows with each one.
- **Fix:** **12 buildings per king** (counted within its reach) and **160 per player**. Growing further means bringing another king, which is the intended decision.
- **Loop: stacking buildings on one resource** multiplied output from a single wheat field or vein.
  **Fix:** each node supplies one production at a time, and buildings drawing from the same node **split its rate** (economy.md §3). Crowding gains nothing; good towns spread across their land, and so do their roads. A building's details show its effective rate.
- **Loop: more buildings meant shorter post-battle cooldowns**, so battles could be chained faster.
  **Fix:** the cooldown counts only working buildings, **at most two per king per type**.

## 4. Things that never go away

| Loop | Fix |
|---|---|
| Ruins piled up forever, blocking squares | Ruins **crumble after 6 hours**, freeing the squares |
| Masterless pieces and buildings | Already expire after 2 hours unless claimed (progression.md §3) |
| Walking traffic stored for every square ever walked | Trails **fade by half every hour** (paths you stop using grow back) |
| Resource-node changes stored forever | Fully regrown nodes stop being stored (worldgen regenerates them) |
| Cached chunks of every place anyone visited | Chunks nobody is near are dropped once there are over 3,000 cached, and regenerate on demand |
| Guest accounts | Fall 15 minutes after the player leaves (progression.md §1) |
| Event logs | Capped at 40 per player |

## 5. Farming with alt accounts

- **Loop:** make guest accounts, walk their free starting kits into your main account, lose on purpose, and collect the converted pieces. Or let the guests fall and claim their masterless pieces. Either way, free pieces forever.
- **Fixes:**
  - **Starting-kit pieces never change hands.** When they would convert or go masterless, they perish instead (the `kit` flag).
  - **Accounts younger than 2 hours hand nothing over when they lose.** Their pieces perish.
  - **At most 5 new empires per IP address per hour** (read from CloudFront's `X-Forwarded-For`; local bots are exempt).
- Ratings can't be farmed cheaply: Glicko gives little for beating much weaker players, and battles mostly played by the AI stand-in are unrated.

## 6. Harassment and stalling

| Loop | Fix |
|---|---|
| Declare an attack (which freezes the defender), cancel, repeat | The attacker's king gets a 2-minute cooldown (already), **and the defender is protected for 2 minutes** |
| Attacking the same settlement repeatedly | Winner protection lasts as long as the regeneration cooldown (battle.md §8) |
| Stalling a lost battle | The clock (5+3). A disconnected player's AI stand-in plays after 20s |
| Renaming to dodge or impersonate | One rename every 10 minutes; names are unique |

## 7. Server load (denial of service)

| Loop | Fix |
|---|---|
| Subscribing to many chunks forces world generation | At most ~4 subscription changes a second, and 30 new chunks per request (the client re-asks for any still missing) |
| Move and attack orders run pathfinding | ~4 orders a second per connection, bursts of 8 |
| Message spam | 20 messages a second, bursts of 40 (already) |
| Practice battles starving the shared chess engines | At most 4 practice games at once, **and real battles' AI moves jump the engine queue** |
| Unbounded groups | A group ends after 2,000 turns (already) |

## 8. Considered, left alone

| Loop | Why it's fine |
|---|---|
| Renewable wood and wheat | Intended. They regrow slowly (trees take 30 minutes), and caps limit what they can turn into |
| Pieces gained by conversion going over the population cap | Allowed. Winning should pay. Production pauses until you're back under the cap, and the 400 hard cap still limits how much production can add |
| Chaining battles with reserves | Intended (battle.md §8). Reserves need their own king to lead a new battle, and kings are capped |
| Everyone crowding into high-elo pockets | Self-limiting: the players there are strong (migration.md §4) |
| A player never logging off | Signed-in empires defend themselves with the AI, and caps bound their growth |

## Tuning

All the numbers above are constants in `packages/shared/src/constants.ts`: `KING_POP`, `HOUSE_POP`, `HOUSES_PER_KING`, `PLAYER_PIECE_CAP`, `PLAYER_KING_CAP`, `KING_TIME_PER_KING`, `BUILDINGS_PER_KING`, `PLAYER_BUILDING_CAP`, `RUIN_LIFETIME_MS`, `CANCEL_PROTECT_MS`, `FRESH_ACCOUNT_MS`.
