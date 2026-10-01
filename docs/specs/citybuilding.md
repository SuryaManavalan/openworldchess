# City building (the "Tiny Glade" update)

Status: **Built** (2026-10-01), all but doors facing streets. Players want to make their towns their own:
lay streets and squares by hand, place walls, bridges, gardens and taverns, move and remove
buildings, and stop being chained to the nearest resource. They also told us towns got hard
to look at. This spec says what we add, what we deliberately don't, and why, and how it stays
balanced with the rest of the game (economy, war, the Chronicle).

## 1. The decision in one paragraph

**No inventory, no stockpiles.** "Resources stay where they grow" is the economy's first
rule. It's the first lesson the game teaches, and it's why land, ore and palace sites are
worth fighting over (economy.md §1). Stockpiles would flatten the map and add a management
layer nobody asked for. Every freedom players asked for can be given with things that already
live on the map:
- buildings may go anywhere in reach (they produce only beside their resource);
- buildings can be moved and demolished (demolishing leaves salvage piles, using our existing
  hoard piles);
- renewables can be planted (fields and saplings, using our existing regrowth);
- war elephants can haul rock and ore (one load on the elephant, no inventory screen);
- streets, squares, walls, bridges and decorations are drawn, Tiny Glade style: you draw
  roughly, and neighbour-aware art makes it look intentional.

## 2. Pillars

1. **Draw, don't fiddle.** You drag a line and get a street, a wall or a bridge. Pieces join
   up with their neighbours on their own (autotiling), so anything you draw looks deliberate.
2. **Beautiful atomic units.** Every tile, wall piece, bridge plank and decoration is designed
   to sit next to every other: one palette, one light direction (top-left), one outline weight,
   soft shadows, no noisy textures. A town should read as a composition, not clutter.
3. **A calm base, deliberate highlights.** Settlement ground is soft earth. Stone appears where
   someone chose to lay it (player streets and squares, knights' roads), plus one small plaza
   at a city's heart. Auto-decor thins out once a player starts decorating.
4. **The economy and war still matter.** Decorations cost a little wood or stone from nearby
   (the forest still pulls back as a town grows). They never count toward a town's tier, the
   building caps, production or population, so they can't be used to game the Chronicle or
   battles.
5. **Mobile native, desktop native.** Every capability on both. Neither interface is a squeezed
   copy of the other (§7).

## 3. Placement freedom

- **Producers can go anywhere in reach.** A building's production resource within 3 squares
  turns from a hard block into a warning: the ghost turns amber and says "Won't produce here:
  no wheat within 3 squares". It still counts for room, tier and the town's shape; it just makes
  no pieces until it has its resource (plant a field beside it).
- **Move** (a building's panel → Move, then tap or drag the new spot). The same placement rules
  apply. The building is rebuilt at the new spot for free, but it's out of action while it rises
  again (its build time). Its production progress resets. Not during a battle at that town.
- **Demolish** (a building's panel → Demolish, asked twice). It's removed, and half its cost is
  left as wood and stone piles (hoards) beside the spot, so rebuilding nearby draws on them.
  Altars and the Wonder can't be demolished. Not during a battle at that town.

## 4. Drawn things

All of these are "decor": a building type with no production, no anchor, no tier, no cap
except the decor budget (§6). Each is 1×1 unless noted, and is placed within reach of a king
like any building (an altar's reach doesn't count).

| Kind | Draw | Blocks walking | Cost | Joins neighbours |
|---|---|---|---|---|
| **Street / square** (paving) | brush: drag over squares | no (paved: 1.5× speed) | free, inside your settlement's ground | yes: lines read as streets, 2×2+ areas as squares |
| **Bridge** | drag across water | no: water becomes walkable | 10 wood | yes: one straight deck, rails on the outer edges |
| **Wall** | drag a line | yes | 8 stone | yes: posts and runs, towers at corners and ends |
| **Fence** | drag a line | yes | 3 wood | yes: rails between posts |
| **Hedge** | drag a line | yes | 2 wood | yes: one trimmed green run |
| **Flowerbed** | tap or drag | no | 2 wood | yes: beds merge into a bordered garden |
| **Lamp, bench, banner, planter** | tap | yes | 3–5 wood | no |
| **Well** | tap | yes | 12 stone | no |
| **Market stall** | tap | yes | 10 wood | no |
| **Statue, fountain** | tap | yes | 25 / 35 stone | no |
| **Tavern** (2×2) | tap | yes | 40 wood, 15 stone | no |

Bridges go only on water squares that touch land or another bridge; everything else goes only
on land. Bridges replace the old automatic plank bridges (they were per-square, faced different
ways, and looked like a pile of planks). Fords stay walkable as before.

**Erase.** Every drawing tool has an eraser: drag over your own streets or decorations to
remove them (free; no refund).

## 5. Plant

- **Field:** plant wheat on an empty square in reach (2 wood). It sprouts and fills over about
  5 minutes, then is ordinary wheat (houses and stables work it; it regrows as wheat does).
- **Sapling:** plant a tree (free). It grows into a full tree in about 8 minutes, then is
  ordinary wood (felled for building, regrows; inside a town a felled stump is dug out, as now).
- Rock and ore can't be planted: they're geography, and the reason to settle one place over
  another.
- Planted squares count toward the decor budget while they live.

## 6. Elephants haul stone and ore

- Select only war elephants, tap **Haul**, tap a rock or ore deposit, then tap where to drop it (built: `Works.haul`; the load shows on the elephant's back; side quest kind `haul`)
  (in reach of one of your kings). Each elephant lifts up to **60** from the deposit, walks to
  the spot and sets it down as a pile there (a hoard of that kind). Big deposits take several
  trips (more elephants: more at once).
- The load rides on the elephant (shown on its back). If the elephant is routed or captured on
  the way, the load is dropped where it stands, as a pile anyone nearby can use.
- Balance: it's slow, it ties up your army, and the piles are finite, so geography still matters.
  It lets a player bring stone into a quarry-less valley, or carry ore home for a palace.
- **Side quest "The moving stone"** (from chapter 6, when barracks are open): haul a load of
  stone into one of your towns. It teaches the mechanic.

## 7. Decor budget

A player may hold `20 + 4 × (their real buildings)` decorations (planted squares included),
and at most `DECOR_CAP` (400) in all. Streets and squares (paving) don't count: they're ground,
limited to your settlements' ground. This keeps towns lively without letting one player cover
the map, and keeps the server and clients fast.

## 8. Interfaces

**Phones.** The hammer button opens the Build sheet, with four tabs: **Build** (buildings),
**Streets**, **Adorn** and **Plant**.
- Picking a tool closes the sheet and enters that tool. The only chrome is a slim bar at the
  bottom: the tool's name and cost, an Erase toggle, and Done. No other buttons are added to the
  screen.
- In a tool, **one finger draws** (tap to place one; drag to draw a line or paint an area) and
  **two fingers pan and zoom**, so you never fight the map.
- A building's panel gets **Move** and **Demolish**.

**Desktop.** The side panel's Build section gets the same four tabs as a palette (hotkey B,
then 1–4 for the tabs).
- In a tool, **left-drag draws**, right-drag or Space-drag pans, the wheel zooms, **X** toggles
  Erase, and Esc leaves the tool.
- Hover shows the ghost with its cost and whether it's allowed.
- Buildings: click → panel with Move and Demolish; **M** and **Delete** work while one is
  selected.

## 9. The look (the atomic units)

- **One palette** for built things, warm and slightly desaturated so pieces and banners pop:
  - stone `#cfc6b4` / `#b9ae99`, mortar `#8f8573`;
  - wood `#a8794a` / `#7d5634`;
  - roof tones from each civilisation;
  - greenery `#6f9a52` / `#5a8243`;
  - flowers in three accents (rose, butter, lavender);
  - one soft shadow (30% black, offset down-right).
- **Streets:** rounded cobbles in two tones with a thin kerb on open edges. Where paving is at
  least 2 squares wide it becomes a square: larger flagstones in staggered courses, with a fine
  border.
- **Walls** are drawn as runs between posts with a darker cap; corners and free ends get a small
  tower. **Fences:** posts and two rails. **Hedges:** one continuous rounded green band.
- **Bridges:** one deck along the crossing, planks across it, rails only on the two outer edges,
  stone piers where it meets the banks.
- **Base ground:** settled ground is soft earth for every tier. Flagstones no longer flood towns.
  A city keeps a small framed chessboard plaza at its heart (radius 2). Auto-decor (lamps,
  benches, planters) thins out in a settlement once its owner has placed 8 or more decorations
  of their own there.

## 9b. Controls are always one tap away

The Controls guide (`Controls.tsx`) lists the controls for this device only: a phone never sees mouse buttons or keys, and a computer never sees pinch or long-press. It opens from:
- Settings (Controls and Rulebook buttons at the top);
- the top of the rulebook;
- the "?" on the drawing tool bar (it opens on the tools section);
- on desktop, the **?** key, or the Controls link in the side panel.

Lessons are written for touch; on a computer, "tap" reads "click".

## 10. What we don't copy from Tiny Glade

- Terrain sculpting and digging new water: our terrain is the board, shared by everyone, and
  water shapes movement and war.
- Free-form shapes off the grid: our world is squares. We get Tiny Glade's feel from
  neighbour-aware tiles on the grid instead.
- No-cost, no-limit building: we keep small costs and a budget, because it's a shared world with
  an economy.

## 11. Data

- **Decor** is a `Building` with a decor type (`bridge`, `wall`, `fence`, `hedge`, `flowerbed`,
  `lamp`, `bench`, `banner`, `planter`, `well`, `stall`, `statue`, `fountain`, `tavern`).
  `BUILDINGS[type].decor = true`. It's excluded from `clusterSettlements` (tier), from the
  building caps, from anchoring and decay, and from production. Decor whose owner falls, or with
  none of its owner's real buildings within 15 squares, is cleared.
- **Paving** is the existing `PAVED` traffic value. The brush sets or clears it on squares of the
  player's own settlement ground. Knights' paving tally (the Chronicle) counts only knight works.
- **Planted nodes** are world nodes kept like hoards (`planted: true`), growing from 0.
- **Haul:** a `Works` job type. The load is kept on the piece (`cargo: { kind, amount }`).
- Messages:
  - `build` (decor types included);
  - `building.move { buildingId, at }`;
  - `building.demolish { buildingId }`;
  - `paint.paving { cells, erase }`;
  - `decor.erase { cells }`;
  - `plant { kind, at }`;
  - `order.haul { pieceIds, from, to }`.
- **Lessons:** `citybuilding` (placement, move, demolish, decor and budget) and `hauling`, taught
  by the side quest and from chapter 3 on.
