# Visuals Spec: A Living World

**Decided:** the world should be beautiful, eye-catching and almost hypnotic to watch: something you get lost in. It should feel alive, like a little world. Pieces in a city walk around and live their own lives. It's the small touches that make someone stop and think "wow, this world is alive."

Art style and assets are in [art.md](art.md); how pieces move under orders is in [movement.md](movement.md) §8. This spec covers **life, feedback and atmosphere**. Sound is its twin ([audio.md](audio.md)).

## 1. Pillars

1. **One heartbeat.** The world turn is 600ms, which is **100 BPM**. Steps, idle breathing, flag flutters, waves in the wheat and the music all lock to this beat. A marching army, a working settlement and the soundtrack share one pulse. That shared rhythm is where the hypnotic feeling comes from.
2. **Life is routine, not gags.** The characters are stoic ([art.md](art.md) §1). They show life through dignified habits: drilling, working, keeping watch, paying respect. No cartoon slapstick.
3. **The world reacts.** Nature and bystanders respond to what players do. Birds scatter from an army, a crowd gathers around a battle, grass wears into paths. Reaction is what makes a world feel alive, more than ambient loops.
4. **Readability comes first.** Ambient life must never look like a gameplay signal. No ambient red, no ambient motion that resembles an attack. It all calms down when you zoom out or an alert fires.
5. **Life never changes outcomes.** Anything decorative or idle stays out of the rules. Idle movement follows the reach and occupancy rules and gives way immediately to any order ([PRINCIPLES.md](../PRINCIPLES.md) §1).
6. **Everyone sees the same life.** Decorative motion is seeded by `(piece id, world turn)`, so every player watching a settlement sees the same thing. That makes screenshots and streams shareable: "look at that knight."

## 2. Pieces living their lives

### Idle routines (on the server, low priority)

A piece with no orders, inside a settlement (within reach of an anchoring king), runs an **idle routine**. These are real, cheap gait moves on the server, at most one every 3–8 turns. The rules:
- routines stay within the anchoring king's reach;
- idle pieces give way (swap) to any ordered piece instantly;
- they never stand on a square the owner is placing a building on;
- they stop the moment an alert fires.

Routines are drawn from the piece's type and from **what's really happening in the settlement**, so the life reflects the economy:

| Piece | Routines |
|---|---|
| **Pawn** | **Drill:** idle pawns form a rank on the plaza and march a square circuit on the beat, turning together at each corner (the about-face stomp; [movement.md](movement.md) §2). **Work:** they tend the wheat their house is drawing from, with a sickle motion on the beat. **Rest:** they stand in pairs outside a house, facing each other. |
| **Knight** | **Training circuit:** it traces a **closed knight's tour** around its stable (a real mathematical L-hop loop). It's rhythmic and quietly impressive. **Grazing:** it stands at the edge of the wheat. |
| **Bishop** | **Procession:** it walks the diagonals between the temple and other buildings, staying on its own square color as the rules require. It pauses at a building and gives a short glow of blessing. |
| **Elephant** | **Patrol:** a slow straight-line beat along the settlement's edge. **Labor:** it hauls stone from the rock nodes the barracks draws from. At rivers, it sprays water. |
| **Queen** | **Survey:** a long glide to a vantage point, a long pause looking outward, a glide back. |
| **King** | It mostly stands at its post, pacing one square at a time. When a king passes, nearby pawns turn to face it and hold still for one beat (stoic respect). |
| **Emperor** | As a king, but idle pieces that notice it form a short **honor line** as it passes. |

**Social moments:** two idle pieces that end up next to each other face each other for a few beats. A faint chess glyph can appear between them (♞? ♝!) as their "conversation".

### Rare moments

Some events are deliberately rare (about 1 in 1,000 to 1 in 100,000 per piece per hour), so players catch them and share them:
- idle pieces on the plaza happen to line up into a famous mate pattern (Anastasia's, a back-rank mate) for a few beats;
- two knights on opposite colors mirror each other's hops;
- a bishop stops in a sunbeam, and its shade band glows;
- a pawn drill with exactly 8 pawns forms a perfect rank; the pawns salute on the downbeat, and the formation dissolves.

These are seeded and deterministic (§1.6): everyone watching sees the same moment.

## 3. Buildings and production

- **Every building shows its real state:**
  - a producing building has activity (forge smoke from the barracks, a lantern swinging at the temple, horses shifting in the stable);
  - an idle building is still;
  - a decaying building shows cracks and a drooping flag, and its colors fade as its HP drops;
  - a ruin gets overgrown over time.
- **A piece is born:** the door opens on the beat, the new piece steps out onto the square in front, the owner's banner flutters once, and a soft glow fades.
- **Construction:** scaffolding rises in stages. Trees fall and rock gets chipped at the nodes it draws from, and the material visibly moves to the site.
- **Resources run down visibly:** rock outcrops shrink as they're quarried, and ore veins lose their shine. Tree stumps regrow through sapling stages.

## 4. Nature and atmosphere

| System | What it does | Reacts to |
|---|---|---|
| **Wind field** | One noise field that moves over time. Flags, wheat, tree canopies and grass tufts all sway to the same wind, so gusts **ripple across the map**. | — (global) |
| **Wheat waves** | A shader makes waves roll through fields, synced to the wind. | Pieces walking through leave a parting wake. |
| **Water** | Shimmer, ripples, occasional fish jumps, reflections of nearby pieces. | Knights hopping a ford splash; elephants spray. |
| **Birds** | Flocking birds (boids) roost in forests and circle. | They scatter when a troop comes within 6 squares, and again when a battle starts. |
| **Wildlife** | Deer at forest edges, butterflies over wheat, fireflies at night. | Deer flee from troops. |
| **Day and night** | A cosmetic cycle: 40 real minutes per day, the same for everyone. Color grading shifts through dawn, day, dusk and night. At night windows light up, pawns on patrol carry lanterns, and settlements glow warmly in the dark. | — |
| **Weather** | Regional and cosmetic: rain (wet ground shading, puddles), mist in valleys at dawn, snow at high altitude. | — |
| **Desire paths** | Squares walked often wear from grass into dirt trails over hours. Settlements grow their own roads **from real traffic**. | Real movement (the server tracks walking traffic per chunk and sends it in the chunk data). |

## 5. Feedback and juice (the satisfying parts)

| Moment | Visual |
|---|---|
| Select | The piece pops (scale 1.08, back over 120ms), and a selection ring draws around it. A lasso selects pieces **one after another** along the loop, each with its own pop. |
| Path preview | Dashes flow toward the destination at the beat's tempo; ghost pieces show where they'll end up. |
| Commit a move | A ripple at the destination; the ghosts snap into place; the troop starts moving on the next downbeat. |
| Knight hop | An arc, dust as it lands, and its shadow shrinking at the top of the arc. |
| Queen glide | Faint afterimages along long moves. |
| Elephant move | A stomp, dust, and a slight camera shake at 8 squares (turned off with reduce-motion). |
| Attack declared | A banner-red line to the target, and a countdown ring around both kings. |
| Battle start | The camera flies to the arena on the beat; the dome rises; the pieces march to their squares one by one. |
| Capture (battle) | The captured piece tips over, its banner drops, and it dissolves into dust. The capturing piece lands with weight. |
| Check | The king's square pulses; the dome tints slightly. |
| Checkmate | The king topples in slow motion; a shockwave crosses the board; the winner's color floods the dome, then washes outward over the world. |
| **Conversion** | The captured side's banners flip to the winner's color **one by one, in a wave** from the arena outward. Each flip is a little burst. This is the big payoff moment (paired with a sound cascade, [audio.md](audio.md) §4). |
| Production done | A soft glow; a count ticks up on the king's chip. Several completions in a row get **brighter each time**. |

## 6. Camera

- Panning coasts with momentum; zoom stretches slightly at its limits and springs back; rotation eases in over two beats.
- **Follow mode:** the camera trails a moving troop slightly ahead of it.
- **Watch mode:** after 60 seconds without input, if the setting is on, the camera slowly drifts across your settlements. It lingers on activity (a drill, a birth, a construction site), like a living screensaver. Any touch hands control straight back. This is the "get lost watching" mode.

## 7. Technology

- **PixiJS v8:**
  - Mesh or displacement shaders for wind (trees, wheat, flags), water, and the dome.
  - A color-grading lookup table for time of day.
  - Additive light sprites at night.
  - Particles in a ParticleContainer.
- **Ambient systems only run on screen** and scale with zoom and device tier:

| Tier | Ambient budget |
|---|---|
| Low-end phone | wind + water + idle routines; up to 200 particles; no weather |
| Mid | everything; up to 800 particles |
| Desktop / high-end | everything; up to 2,000 particles; reflections |

- Each tier gets a frame-time budget: ambient work takes at most 3ms a frame on mid-range phones. It's measured continuously, and the tier drops automatically.
- **Reduce motion** ([ux.md](ux.md) §8) turns off camera shake, afterimages and watch mode, and softens flocking.

## 10. Growing a civilization (added after playtesting)

A settlement should visibly grow from a camp into a city, and the growth should come from what actually happens there.

- **Tiers from size:** hamlet (1–2 buildings), village (3–5), town (6–9), city (10+).
  - The settled ground spreads further with each tier and changes material (as redrawn on 2026-09-28):
    - hamlets and villages: packed earth;
    - towns: warm flagstones, laid in staggered courses that don't follow the square grid, with a kerb;
    - **cities: a real chessboard**, walnut and cream (the classic board), in a bronze frame. The more civilized the land, the more it looks like the board.
  - It's painted as **one soft shape** over the whole settlement: rounded corners, a slightly hand-laid edge, and a trodden rim where it meets the grass, instead of square-cut blocks. The light/dark checker always shows through, faintly on earth and stone.
- **Roads from real footsteps:**
  - Pawns **haul goods** between each working building and the resource it draws from, so roads trace real supply lines: farm to house, quarry to barracks, and between neighboring towns.
  - **Roads follow the crest of the traffic** (redrawn on 2026-09-28). Drawn square by square, the parallel lanes a marching column wears made a grid. Now:
    - Traffic is blurred heavily (a Gaussian about 2 squares wide).
    - A road is drawn along the crest of each worn band, placed between squares where the true crest lies, so a diagonal route draws straight.
    - The result is one worn road down the middle of each route, wider where it's busier, with forks where routes part, and pebbles on the busy stretches.
    - Inside a settlement, the plaza covers the roads.
  - **Paved roads** that knights lay (movement.md §9) are drawn apart from worn ones: a kerbed band of laid stones.
  - Unused roads fade by half every hour and grass returns.
- **Names:** every settlement gets a name drawn from its land (water gives "-ford"/"-bridge", mountains "-crag", forest "-wood"), shown with its tier as a label when zoomed out.
- **Props from state, seeded so everyone sees the same town:**
  - a village gets a well with benches (a city, a **fountain**);
  - shrubs, some flowering, along the rim of the settled ground, and young trees in stone tubs around a town's heart, so a settlement softens into the land;
  - stables get haystacks, barracks training dummies, temples and palaces flower beds, houses crates and barrels;
  - a town adds market stalls in the owner's colors, and **street lamps** along its roads that glow at night;
  - a city raises banners at its edges.
- **Chimney smoke** rises from buildings while they're producing, so a working town looks busy.
- Implementation: `apps/client/src/game/settlements.ts` (tiers, names, props), `terrain.ts` (ground and roads), `apps/server/src/routines.ts` (hauling).

### Built after the first pass

- **Walls that remember sieges:** every siege is recorded on the besieged settlement's buildings.
  - Once besieged: a timber palisade traces the edge of its settled ground, with the odd wooden watchtower.
  - 3 sieges: stone walls, with towers on some corners.
  - 6 or more: towers on every corner.
  - Where roads pass through, the wall opens into an arched **gate**. The gates **shut while the settlement is under attack** and open again after.
  - Walls are drawn, never simulated: they don't block anyone ([PRINCIPLES.md](../PRINCIPLES.md) §5).
- **Bridges:** where a road crosses a river's ford, the crossing gets a plank bridge with rails and posts. Once the road is a busy street, it becomes a stone bridge.
  - Fords now show as the river's dry, pebbled bed with puddles, so rivers read as one continuous course.
  - A bridge only forms where the road crosses the riverbed, not where a road runs along it.
- **Merchants and trade roads:** about one pawn in six in a realm with more than one town becomes a merchant, with a pack on its back.
  - A merchant shuttles along a real path between two of its owner's towns, pauses at each market, and heads back.
  - Merchants travel as **caravans**: on a trade run, they may cross open country between two of their owner's towns up to **80 squares apart**. This is the one exception to the reach rule. Caravans can't fight or be attacked (there's no king to challenge), so balance is unchanged. If either town's king leaves, the route ends and the merchant goes home.
  - Their footsteps wear a trade road between the towns.
  - Hauling pawns now visibly carry what they gathered on the way back: wheat bundles, logs, stone, ore.
- **The town bell:** towns and cities get a bell tower near their heart.
  - **At dawn** (the shared 40-minute day), every bell rings, once per strike for the settlement's tier, with rings of golden light rolling over the rooftops, a low bell voice in the soundtrack, and the birds taking off.
  - At dusk, one softer toll, and **street lamps light one by one**, each with a little spark.
  - The top bar shows the day number with a sun or moon.

Ideas for later:
- lit windows scaled to population;
- ferries or longer bridges over wide rivers;
- festivals when a city wins a siege;
- seasons.

### Clearings (added after playtesting)

Settlements slowly clear the trees around them. Every 30 seconds, each of a town's buildings has a 1-in-10 chance to fell the nearest standing tree within 2 squares. Felled trees beside buildings are dug out instead of growing back 30 minutes later, so towns open into clearings as they grow, while the wild forest keeps regrowing (`Game.clearing`, `World.regrowNodes`).

## 11. Biomes and the wilds (added after playtesting)

- **Every biome has its own ground:**
  - a palette per terrain (grass, sand, water, forest, mountain);
  - its own marks, such as dune ripples, cracked earth, heather, fallen petals, snow and fey sparkles, leaf litter and tiny mushroom caps;
  - biome water: icy, murky, and lava in the ashlands, with bright seams.

  The chessboard checker always stays.
- **Nodes take the biome's look** (art in `art/assets/nature.mjs`):
  - **Trees (17):** oak, pine, birch, maple, snow pine, juniper, acacia, saguaro, joshua tree, palm, willow, cherry blossom, giant mushroom, dead tree, silverwood, crystal tree, charred tree.
  - **Rocks (9):** boulder, mossy, snowy, sandstone, red mesa, basalt with lava cracks, crystal cluster, runestone, gravestone.
  - **Ores (7):** gold, silver, copper, emerald, ruby, amethyst, sapphire. They are all the same resource, **ore** (renamed from "gold" because it looks different in every biome).
  - **Crops (8):** wheat, corn, berries, pumpkins, rice, glowcaps, prickly pear, firebloom. Every crop is still "wheat".
- **Creatures and camps** of the wilds are drawn per faction ([wilds.md](wilds.md) §6). At night a camp glows like a campfire.

## 12. Resources from afar (as built 2026-09-28)

Zoomed out, single trees, rocks and fields are too small to draw, so the far view marks what each area holds instead (`apps/client/src/game/farIcons.ts`):
- **One icon per area, at most:** each 16×16 area (whole 32×32 chunks when zoomed very far out) shows the kind that stands out there, and only if there's a lot of it: 40+ trees, 6+ rocks, 2+ ore, 12+ fields. Rarer kinds win a tie, so an ore vein in a wood shows as ore.
- **The icons are the land's own art:** a stand of three trees in the biome's kind of tree, a pile of stones, sheaves of wheat. **Ore glows gold**, so it isn't mistaken for rock at a glance. They sit where the resource is centered, and keep the same size on screen at any zoom.
- **They show what's really there:** counts come from the world generator (in the terrain worker) and, where the area is loaded, from the live nodes, so felled woods and spent mines lose their icon.

## 13. Civilized resources (as built 2026-09-28: trees and rocks; ore and wheat next)

Inside a settlement, resources stay what they are (the same wood, stone, ore and wheat for production) but are drawn tended, and grander as the settlement grows (`civicResources` in `settlements.ts`, art in `art/assets/civic.mjs`). Hamlets stay wild.

- **Two forms:** a **lone** node, or a **clump**: 3+ of one kind in the same 3×3 block, drawn as one larger piece at their middle, so a city doesn't crowd with separate rocks and trees.
- **By tier:**

  | | Village | Town | City |
  |---|---|---|---|
  | Tree | tended tree in a ring of stones | young tree in a stone tub | topiary clipped into a chess piece |
  | Trees (clump) | orchard behind a low fence | a green with trees and a bench | walled garden: hedges, flower beds, a tree at the heart |
  | Rock | cairn | carved standing stone with moss | a chess-piece statue on a plinth |
  | Rocks (clump) | dry-stone wall | rock garden with raked gravel | an obelisk monument with banners |
  | Ore *(next)* | timber-framed seam with a cart | ore-inlaid waymarker | gilded statue |
  | Ore (clump) *(next)* | open mine with scaffolding | mosaic tiles in the ground | mosaic court with a fountain |
  | Wheat *(next)* | fenced plot with a scarecrow | vegetable allotment | flower bed |
  | Wheat (clump) *(next)* | fenced field | market garden rows | terraced garden |

- **Each town looks its own:** foliage and stone take the biome's palette; banners, sashes and bands take the owner's color; statue and topiary shapes (pawn, knight, bishop, rook) are seeded by place.
- **It follows the town:** when a resource is felled or mined, or the settlement changes tier, its form updates. Civilization cosmetics can later swap in their own set of these pieces.

## 8. Build order

| Milestone | Life and visuals |
|---|---|
| M2 | The beat clock; gait animations; wind field; water; birds that react to troops |
| M3 | Battle start, captures, checkmate, the conversion wave, a crowd around the dome |
| M4 | Idle routines tied to production; births; construction; nodes running down; decay |
| M5 | Day and night; desire paths; rare moments |
| M6 | Weather; watch mode; performance tiers tuned on real devices |
