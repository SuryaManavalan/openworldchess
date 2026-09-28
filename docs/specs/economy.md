# Economy Spec

Covers resources, cities, buildings, and piece production. All numbers are **placeholders** to tune in playtests. They exist so the systems can be built and balanced against something concrete.

## 1. Resources: the adjacency model (Proposed, your idea)

**There is no gathering and no stockpile.** Resources stay where they are in the world. What matters is **what a building is next to**.

- Every production building has a **work area**: all squares within **3 squares** of its footprint.
- A building can produce only if its required resource node is inside its work area. It **draws from that node directly**, one piece at a time.
- **Construction** draws from nodes within **10 squares of the site**, nearest first. You can watch trees being felled and rock being quarried as the building goes up, so the forest pulls back as a city grows.

| Resource | Node | Renews? |
|---|---|---|
| Wood | Tree, pine | Yes: a stump regrows in ~30 minutes |
| Food | Wheat field | Yes: fast harvest cycles |
| Stone | Rock | **No**, it runs out |
| Ore | Ore (rare) | **No**, it runs out |

**Why this model:**
- **Where you settle becomes the whole strategy.** An ore vein right next to rock is a palace site worth fighting over. This is what "players will want to set up villages and cities near resources" was asking for.
- **Nothing to micromanage, and it keeps working while you're offline.** That matters for an MMO where players are away most of the time.
- **Finite stone and ore drive conflict.** Mines run out, so players must expand, found new cities, or take someone else's.
- **Specialized cities come for free.** A horse town on the wheat plains, a temple town by the ore hills. That gives each city a reason to exist, and trade between them is optional.
- **Conquest takes something real.** A captured city comes with its good location, not just the buildings.

**What we give up:** pawns no longer have a peacetime job, and there's less busywork (which is fine). Pawns stay the backbone of every army, and houses now matter for the population cap.

## 2. Kings, buildings and settlements

There is no "city" object and no "found city" action ([PRINCIPLES.md](../PRINCIPLES.md) §1). Everything follows from one rule you decided: **buildings exist only near a king.**

### The anchor rule (Decided in spirit; numbers Proposed)

- **Reach: 10 squares** (Chebyshev distance). A king can place a building whose footprint is fully within 10 squares of it.
- **A building is anchored** while **any** king of its owner is within 10 squares of it. Which king doesn't matter.
- **A settlement** is simply a group of buildings anchored by the same king. It's a label for the UI and for battles ([battle.md](battle.md) §2), not a rule. The ground under a settlement shows the plaza checker (cosmetic).
- Minimum spacing: a new building can't go within 3 squares of another player's building. So you can't wall people in, but rival settlements can press right up against each other.

| State | Effect |
|---|---|
| Some own king within 10 squares | Normal. |
| No own king in reach, for the first 60 seconds | Grace period: nothing happens yet. |
| No own king in reach after that | **Production stops.** The building loses 1 HP every 30 seconds, from 100 HP. |
| A king returns | Decay stops. Damaged buildings produce at a slower rate until they're repaired, which draws from nearby nodes. |
| A building reaches 0 HP | **Ruins:** they block movement and can be cleared by any king (which frees the square). |
| The anchoring king is captured in battle | Its buildings go to the winner if the winner's king is in reach ([battle.md](battle.md) §7). Otherwise they start to decay. |

What this makes possible, without any extra actions:
- **Handing over:** walk a fresh king in and the veteran out; nothing breaks.
- **Moving an empire:** build deeper, walk kings forward. The buildings left behind decay unless a king stays with them.
- **The Emperor is a king:** it anchors whatever it stands near. Keeping it at home, at the front, or on the road is purely a choice of risk against reward ([migration.md](migration.md)).

### Placing buildings

- Footprints: house 1×1; stable, temple and barracks 2×2; palace 3×3 (bigger than round 1's art; see [art.md](art.md)).
- Buildings go on buildable terrain. Placement must leave a walkable path from the building's door to open ground.
- A building finishes after a build time and appears scaffolded while it's under construction.

### Population

Each kind of piece has its own room, set by the buildings within each king's reach: pawns from houses (8 per king, +6 per house, counting 4), knights from stables, bishops from temples, elephants from barracks (2 each), queens from palaces (1 each); hard cap 400 per player. See [safeguards.md](safeguards.md) §1. A building whose piece is at its room pauses production. Pieces count toward the king whose buildings produced them, until that king dies (then they're re-counted).

## 3. Production (Decided pairings; resources and timings Proposed)

Each building produces its piece type in a loop while all of these hold:
- the building is anchored;
- there's room under the population cap;
- its required node is in its work area and not used up.

New pieces appear at the building's door.

| Building | Construction (drawn from nodes within 10 squares of the site) | Needs in its work area | Produces | Base time | Draws per piece |
|---|---|---|---|---|---|
| House / tavern | 30 wood | Wheat | Pawn | 1 min | 5 wheat |
| Stable | 80 wood | Wheat | Knight | 4 min | 20 wheat |
| Temple | 60 wood, 40 stone | Ore | Bishop | 4 min | 15 ore |
| Barracks | 60 wood, 80 stone | Rock | Elephant (rook) | 5 min | 30 stone |
| Palace (1 per king, 3×3) | 120 wood, 150 stone | Ore **and** rock | **King and queen alternately, at the same rate** (the slowest) | 20 min | 40 ore, 40 stone |

- Several buildings of the same type stack their output. Two stables produce two knights every 4 minutes.
- **Sharing:** if two buildings draw from the same node, they take turns, so crowding buildings around one wheat field slows all of them.
- The palace alternates king, queen, king, queen. The owner can pin it to only kings or only queens.
- **Any building can be paused** by its owner. Without this, houses (the fastest producers) fill the population cap and starve every other building. Found by the bot simulation.
- **Temple bishops** alternate square color; the building's door is placed so both colors can leave.
- When a node runs out, the building shows an "exhausted" icon and waits. Renewable nodes regrow; for stone and ore, the player needs a new site.
- **Node size** scales with the area's elo ([world.md](world.md) §4). Mines in high-elo pockets last much longer.
- **Production rate** also scales with node richness: `time = baseTime / richness(node)` (Proposed; see [migration.md](migration.md) §3). The base times in the table are for richness 1 (elo 1000).
- **Placement preview:** while you place a building, its work area is highlighted and the nodes it would use are outlined. The preview is green if it can produce and red if it's missing its resource.

### `productionTime` (used for battle cooldowns)

```
productionTime(type, player) = baseTime(type) / max(1, count of the player's producing buildings of `type`)
If the player has no producing building for that type: baseTime(type) × 2
```

The battle cooldown ([battle.md](battle.md) §8) is the sum of this over the pieces the winner lost.

## 4. Worldgen requirements

These are implemented and verified by simulation in **[resources.md](resources.md)**. For this model to work, worldgen must place nodes so that:
- a typical king's reach (a 21×21 area) contains **wood and wheat** almost everywhere, so anyone can start;
- **rock** turns up in most areas, but not all;
- **ore** is rare and clustered, with ore next to rock rarer still. Those are the prime palace sites, and they're more common in high-elo pockets.

## 5. Starting kit (Proposed)

A new player (or one respawning after losing their Emperor) starts with **1 Emperor, 1 king and 4 pawns**. There are no starting resources: the land provides them. Every spawn point has wood and wheat within 10 squares, so a new player can build houses and a stable right away.

**Why a second king:** with only the Emperor, a new player can't leave their buildings without them decaying, and kings take 20 minutes to make.

## 6. The economy loop

```
put a king near good nodes → buildings draw from nodes → pieces → troops (led by kings) → battles
          ↑                                                                                  │
          └───────── mines run out: expand, resettle, or conquer a better site ◄─────────────┘
```

## 7. Hurry bubbles

As built on 2026-09-28. Code: `Game.bubbleTick` and `Game.popBubble` (server), `apps/client/src/game/bubbles.ts` (client). Numbers are in `constants.ts` (`BUBBLE_*`).

While you're online, **bubbles rise over your working buildings**. Tap one, or swipe across several, to pop it, and that building jumps ahead:

- **When they appear:** one every fifth of a piece's time, 8 to 90 seconds apart, a little irregularly, up to **3** waiting per building.
  - Only while the building is working: paused, blocked or unbuilt buildings drop theirs.
  - **Except when it's waiting for room** (its piece is at its population limit, safeguards.md §1): bubbles still rise, **greyer and duller**. Popping one banks progress, up to one whole piece, which is raised as soon as there's room. Its pop sounds a little off-key (a semitone rub; gold rings a diminished run) and says "no room".
  - Only while you're online: nothing piles up while you're away. Bots don't get them.
- **What a pop is worth:** production advances by the time the bubble took to appear, so popping every bubble **about doubles** a building's output.
  - About 1 in 12 bubbles is **gold** and worth 4 times as much (at most a whole piece).
  - A pop that completes a piece raises it at once.
- **The server grants every bubble.** Popping only spends a bubble it already gave you, so there's nothing to spam or script beyond what a diligent player gets.
- **How it feels** (audio.md §7):
  - **One bubble per building** (as of 2026-09-28), however many are waiting: gold if any is, with a count (×2, ×3) when there's more than one. Each tap pops one and it springs back smaller, until the last. They show only when zoomed in close enough to tap, so towns aren't covered in bubbles from afar.
  - Bubbles wobble, spring in, and hold the piece they're hurrying.
  - A pop bursts into droplets, squashes the building, and floats up the time saved ("−12s"; gold: "★ −48s").
  - Its sound is a quick falling blip that climbs the scale with each pop in a row.
  - Gold rings a run of bells, and every fifth pop in a combo lands a chord.
  - Only you see your bubbles.

## 8. Altars: a bishop's outpost

As built on 2026-09-28. Code: `Game.build`, `Game.economy`, `Game.fallOfAltar`, `World.tenderOf` and `World.altarOver`. Art: `art/assets/altars.mjs`. Numbers: `ALTAR_*` in `constants.ts`.

An altar is a small outpost far from any king, held by a bishop instead. It's meant as a forward farm or staging post, deliberately smaller than a city: kings stay the scarce resource.

- **Raising one:** a bishop of yours must stand within 2 squares of the spot. It costs nothing but the bishop's time (60 s to build) and can go anywhere a building can, with no king needed.
  - Altars open with temples, and you can hold at most 4, at least 11 squares apart.
  - An altar looks like its land: 18 biomes in six styles (standing stones, a timber shrine, a sandstone obelisk, a vine-wrapped stone, and a ring of spires or a giant mushroom in the rare lands). Each has a bishop's mitre and a cloth in your color.
- **Tending:** while a bishop of yours stands within 2 squares, the altar is **tended**.
  - The tending bishop stays put: it's posted (movement.md §4) and skips idle routines.
  - Untended, the altar starts the same hold-then-decay clock as a town without a king (§2).
- **The land it holds:** within 5 squares of a tended altar, up to **3 houses, stables or temples** can be built and keep working without a king.
  - They work at **60%** speed (`ALTAR_RATE`).
  - They add **no population room**: that stays with kings (safeguards.md §1). What they raise counts against the room your kings give.
  - No palaces, barracks or Wonders, so an altar can never make kings.
- **Attacking it:** it's a troop without a king (battle.md §9). Attack the altar or its bishop, and the bishop (or a pawn beside it) defends as commander.
  - If the defenders lose to an empire, the **altar falls to ruin**, and the buildings it held (those no king holds) become **masterless**, for any king to claim.

## Open questions

- Should pieces cost **upkeep** (food per minute)? It would stop hoarding, but it punishes players who are offline.
- Can players **plant** trees and wheat? Renewables could be farmed on purpose, which would make farming a light city-building activity.
- Can players build walls or towers that affect battles? Battles are plain chess on the arena, so walls could only slow attackers down in the world. That might still be worth it.
- Should a tavern differ from a house (for example, faster pawns but a lower population bonus)?
