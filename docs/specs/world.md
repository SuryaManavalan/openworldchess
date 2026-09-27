# World Spec

Covers the board, its terrain, resource placement, and the elo map. Networking and storage are in [networking.md](networking.md) and [TECH.md](../TECH.md) T8.

## 1. The board

- **Decided:** the world is a chessboard in every direction.
- **Coordinates:** squares at integer (x, y). +x is east and +y is south, in world terms; the camera can rotate (see [movement.md](movement.md) §6).
- **Square color:** `(x + y) % 2 === 0` is a light square and anything else is dark, everywhere and forever. Bishops depend on this (see movement.md).
- **One occupant per square:** a piece, or part of a building footprint, or a blocking resource node.
- **Chunks:** 32×32 squares, used for generation, storage and network subscriptions.

## 2. Terrain

Every terrain keeps the light and dark checker so the world still reads as a board ([art.md](art.md)).

| Terrain | Walkable | Build on | Notes |
|---|---|---|---|
| Grass | yes | yes | default |
| Sand | yes | yes | near water |
| Road | yes | yes | placed by players later; maybe faster movement (see open questions) |
| Plaza | yes | yes | city ground; appears automatically inside a city's radius (cosmetic) |
| Forest floor | yes | yes | holds tree nodes; a standing tree blocks its own square (decided after playtesting: an invisible "no building in forest" rule confused players once biomes recolored the ground) |
| Water | **no** | no | blocks sliding pieces; knights can jump a one-square gap (movement.md §3) |
| Mountain | **no** | no | large impassable areas that break up the map and form chokepoints |

### Generation (implemented in `packages/worldgen/src/terrain.ts`)

`terrainAt(seed, x, y)` is pure and deterministic, and runs on both client and server. It uses our own seeded value noise with fractal layers (`random.ts`), so there's no dependency.

1. **Height** `h` = fractal noise, 4 layers, wavelength ~420 squares.
2. **Moisture** `m` = a separate fractal field, wavelength ~260.
3. **Rivers:** where a third field (wavelength 700) is within ±0.007 of zero, the square is water. That gives winding rivers about 3–6 squares wide. **Fords:** about 40% of river length is shallow and walkable, driven by a noise field at wavelength 30. That gives troops crossings roughly every few dozen squares; knights can also hop narrow spots.
4. Classify each square:
   - water: `h < −0.3` (lakes) or a river square
   - mountain: `h > 0.42`
   - sand: next to water
   - forest: `m > 0.18`
   - grass: everywhere else

   Measured mix: grass ~56%, forest ~21%, water ~16%, mountain ~7%.
5. **Resource nodes:** clusters on jittered grids, balanced by simulation. See **[resources.md](resources.md)**.
6. **(To do) Guarantee:** every chunk has at least one walkable path across it. Carve a pass where mountains and lakes would seal an area.

Terrain lookups are memoized. For the simulator's whole sample, generation takes ~10ms per city site, so generating a chunk on demand is cheap.

## 2b. Biomes (Decided, built in `packages/worldgen/src/biomes.ts`)

A biome is how a place **looks** and **what lives there**. It never changes the rules: walkability, buildability and resource nodes still come from terrain and the resource layers exactly as before, so balance and existing cities are untouched. A biome only decides the ground colors, the marks on the squares, which tree, rock, ore and crop art the nodes use (visuals.md §11), and which creatures camp there ([wilds.md](wilds.md)).

- **12 common biomes** come from a new temperature field (wavelength 1600) plus the existing moisture and height:
  - Cold: pine forest (taiga) and tundra.
  - Temperate: meadow, highlands, swamp, and three kinds of wood (oak, birch, autumn), split by a patch field.
  - Hot: savanna, desert, badlands, jungle and swamp.

  Forests keep the same line as terrain (moisture > 0.18), so a desert is never forest-terrain.
- **6 rare biomes** are warped pockets on a 900-square grid, like the elo pockets: blossom vale, mushroom forest, blighted land, fey wood, crystal fields and ashlands (volcanic, where water is drawn as lava).
  - A pocket is more likely in higher-rated land.
  - The stranger kinds need it: crystal needs rating 1100+ and ashlands 1200+.
- **Measured mix of land** (seed 1234):
  - common: meadow 25%, tundra 14%, taiga 11%, highland 8%, savanna 7%, swamp 6%, badlands 5%, desert 5%, jungle 5%, oak/birch/autumn about 3.5% each;
  - rare: blossom 1.2%, mushroom 1.1%, blight 0.6%, fey 0.3%, crystal 0.16%, ashlands 0.08%.

  Rare biomes come to about 3.4% of land, concentrated in rich areas. Check with `node packages/worldgen/sim/biomestat.ts <seed>`.
- On screen, biome edges are ragged (each square samples a slightly jittered point), not ruled lines.

## 3. Resource nodes

| Node | Resource | Blocks movement | Capacity (placeholder) | Regrows |
|---|---|---|---|---|
| Tree / Pine | Wood | yes | 200 | yes, slowly (the stump regrows) |
| Rock | Stone | yes | 400 | no |
| Ore | Ore | yes | 150 | no |
| Wheat field | Food | no (you can walk through it) | 100 per harvest | yes, fast (harvest cycles) |

Capacity is multiplied by `richness(elo)` (0.7–1.9) and ±20% random variation; see [resources.md](resources.md) §2.

Depleted and regrowing states are stored as chunk changes. Buildings draw from nodes directly (no gathering); see [economy.md](economy.md) §1. Node placement must meet [economy.md](economy.md) §4.

## 4. Elo map

**Decided:** the map is also an elo map, with **pockets** of high elo and no single gradient.

### Field (Proposed)

`elo(x, y) = clamp(400, 2800, base(x, y) + pockets(x, y))`

- `base`: very low-frequency noise (wavelength ~5,000 squares) mapped to roughly 700–1500. This is the general rating of the area.
- `pockets`: sparse peaks. Each 2,000×2,000 cell has a 35% chance of a peak. Each peak adds a bump of +800 to +1,500 over a 300–800 square radius, with its edges warped by noise so pockets have irregular shapes. These are the high-elo pockets.
- **Origin rule:** within 3,000 squares of (0, 0), the elo is capped at 1000. The cap fades out smoothly over the next 3,000 squares. This is where new players start.
- Implemented as `eloAt` in `packages/worldgen/src/terrain.ts`. See the map in [resources.md](resources.md) §5.

The field is part of worldgen: pure and computed on the client, so the minimap can shade it with no server data.

### What the elo value does (Proposed)

1. **Spawning and respawning:** new players spawn where `elo` is close to their rating. A player who lost their Emperor respawns where `elo ≈ newRating − 200`; see [progression.md](progression.md).
2. **AI strength:** wild or neutral encounters (if we add them) and AI stand-ins for new players use the area's elo.
3. **Soft signal, not a wall:** anyone can walk anywhere. The minimap and a border overlay show the area's elo band, so walking into a 2,200 pocket is a deliberate choice.
4. **Reward:** resource nodes in higher-elo areas are richer (a multiplier of about `1 + (elo − 1000) / 2000`) and produce faster. That's the pull that makes empires drift deeper, with no migration feature. See [migration.md](migration.md).

## 5. Occupancy and blocking

A square is **blocked** if it holds:
- water or mountain terrain;
- a building footprint;
- a blocking resource node;
- a piece, of any owner (the same one-piece-per-square rule as chess);
- an active battle arena (the arena's 8×8 area is sealed while the battle runs; see [battle.md](battle.md)).

## Open questions

- Should roads speed up movement (for example, a pawn moves 2 squares on a road)? It's fun, but it complicates gaits. Recommend deciding after M2 playtests.
- Should the world have seasons or a day/night cycle? That would affect wheat regrowth and the look.
- Are there neutral NPC armies (bandits) guarding ore? They would give solo play something to do, and train new players against AI at the local elo.
