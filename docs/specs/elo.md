# Elo: ratings and the land

As built on 2026-09-28. Code:
- `packages/rules/src/glicko.ts` (ratings);
- `apps/server/src/battles.ts` (rating updates);
- `packages/worldgen/src/land.ts` and `Game.reshapeLand` (the land);
- `apps/server/src/wilds.ts` (camp strength).

## 1. Ratings: Glicko-1, the way chess.com rates games

Every player has a **rating** and a **rating deviation (RD)**: how unsure the
system is about that rating. This is the Glicko system chess.com uses. New players start
at **1000, RD 350**. How much a game moves your rating depends on your RD: it's
large while the system is unsure of you, and small once it isn't.

**What a win or a loss is worth**, against an equal, settled opponent (RD 60):

| You | Win | Loss |
|---|---|---|
| First game (RD 350) | +175 | −175 |
| After 2 games (RD ≈ 200) | +118 | −118 |
| After 5 games (RD ≈ 145) | +54 | −54 |
| After 10 games (RD ≈ 105) | +26 | −26 |
| After 20 games (RD ≈ 75) | +15 | −15 |
| Settled (RD 60, about 40 games) | +10 | −10 |
| Most settled (RD 45, the floor) | +6 | −6 |

As on chess.com, beating a stronger player is worth more, and losing to a weaker
one costs more. A settled player beating someone 200 points above them gains
about +15.

**Time away:** RD grows back when you don't play, from settled to brand new in
about a year (`RD_PER_DAY`). A player returning after months moves fast again
until the system is sure of them.

**Provisional:** while your RD is above 110 (roughly your first 10 games), your
rating shows with a "?" (`1000?`), as chess.com shows provisional ratings.

## 2. Which battles count

- **Rated:** battles against players, **bots** (they're players too) and **wild camps**.
- **Not rated:**
  - practice battles;
  - a battle whose side was mostly played by the AI stand-in (a player away for 75% or more of their moves);
  - battles with fewer than 2 moves (aborted, as on chess.com).
- **A camp is an opponent at its rating** (§4) with RD 80, like a calibrated bot.
  Its own rating isn't changed by results: it's set by its land.
- Each player's RD first grows back for the days since their last rated game (`ratedAt`), then the game is rated.

## 3. The land's rating is emergent

The world starts from the generated elo map (`eloAt`). **Where empires live, the
land takes on their ratings**:
- Every 30 seconds, each king pulls the 64×64-square cells around it toward its owner's rating, weighted by a Gaussian with sigma 96 squares.
- The generated map pulls too, with the weight of three-quarters of one king.
- Cells move 35% of the way to their new value each time, so the land shifts gradually.
- Where nobody lives any more, the land drifts back to the generated map, and is forgotten once it's within 10.

The rating at any point is interpolated smoothly between cell centers. Far from
everyone, the generated map stands at full detail.

**Everything the land's rating decides follows it**, because it all reads `World.elo()`:

| Decided by the land | What it means now |
|---|---|
| Production speed (`richness`) | Strong players' lands produce faster: worth fighting over |
| Which factions can live there (`minElo`) | Rare, tougher factions appear where strong players are |
| Camp strength (§4) | Camps near strong players play and grow stronger |
| Where new players settle (land ≤ 1050, near empires) | Newcomers settle near gentle empires, not strong ones |
| Where a fallen emperor restarts (land ≈ rating − 200) | They restart among players nearer their level |
| The newcomer shield (land ≤ 1050) | Protection holds in gentle land |
| Chapter 11 "settle in richer land" | Measured against the live land |
| The minimap's Elo layer, "Area elo here", bots choosing sites | Read the live land from the server |

**Spawning to match:** a camp site whose land rating has moved more than 100
since its faction was chosen chooses again. Strengthening land grows rarer,
tougher factions; gentler land grows calmer ones.

The server sends each player the shaped cells within 10 cells (640 squares) of their
empire when they connect and after each recompute (`land` message).

## 4. Wild camps scale to the players around them

A camp's rating is **its land's rating, plus a step for rarer factions, less while
the band is small**:

`rating = land + rarity − 320 × (1 − size/16)`, where rarity is −100 for common,
0 for uncommon, +150 for rare and +300 for legendary.

- It's refreshed whenever the camp wakes or grows.
- Its engine plays at that rating.
- Bands also grow bigger near stronger players (`strengthBonus`, wilds.md §3).

## 5. What emerges

- Strong players raise the land around them. Their production quickens, and rarer, stronger camps appear, which suits strong players.
- Weaker players prefer gentler land and settle there. New players settle near gentle empires.
- Losing an emperor restarts you on land nearer your rating.
- Over time, the map sorts itself into regions of players of similar strength, with frontiers between them. Nobody has to draw those regions: the players make them.
