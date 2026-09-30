# Movement Spec (Open-World Roam)

How pieces move around the world, alone and in troops, and how that looks. Battle movement is plain chess and lives in [battle.md](battle.md).

## 1. Time: world turns

- The world advances in **world turns**, one every **600ms** (tunable; [TECH.md](../TECH.md) T7).
- In each world turn, every piece with orders makes **at most one move**, using its gait.
- The server resolves all moves for a turn in a fixed order: troops sorted by id, then pieces within each troop by slot priority. Each accepted move reserves its destination square, so two pieces can never land on the same square.
- The client animates each move over the turn's 600ms, so motion looks continuous with a steady beat, like a march.

## 2. Gaits (Decided in spirit; numbers Proposed)

Each piece moves in the world the way it moves in chess:

| Piece | One world-turn move | Blocked by | Average speed (squares/turn) |
|---|---|---|---|
| King | 1 square in any of 8 directions | the destination square | ~1.2 |
| Queen | slides up to **8** squares along a line or diagonal | anything on the path | up to 8 |
| Elephant (rook) | slides up to 8 squares along a line (not diagonal) | anything on the path | up to 8 |
| Bishop | slides up to 8 squares diagonally | anything on the path | up to 8 |
| Knight | one **L hop** | only the landing square: it **jumps over** pieces, water and rocks | ~2.2 |
| Pawn | **1 square forward** in its facing | the destination square | 1 |

**Pawn facing (Decided):** a pawn has a facing (N, E, S or W). It can only step forward. **Turning 90° takes a whole world turn** (a U-turn takes two). Pawns never move diagonally in the world, since in chess that's a capture move.

**Bishop color (Proposed):** a bishop stays on its square color forever, as in chess. The world keeps a global checker ([world.md](world.md) §1), so a bishop can only reach half the squares. Formations and building slots must respect this. It's a fun constraint and true to chess.

**Speed of a troop** is set by its slowest member. A troop with pawns moves at about 1 square per turn (≈1.7 squares/second). A troop of only queens and elephants can dash. That rewards fielding fast pieces and makes pawns the heavy infantry.

## 3. Terrain interaction

- Sliding pieces (queen, elephant, bishop) stop before any blocked square (world.md §5).
- The knight's jump lets it cross **one-square rivers and gaps**. It's the only piece that can cross water without a bridge. A troop with knights crosses; a troop without them walks around.
- Resource nodes and buildings block. Wheat fields do not.
- Pieces never capture in the world. Hostile pieces block each other like any occupied square. **(Proposed:** captures only ever happen inside a battle.)

## 4. Troops

### Command rule: pieces go anywhere; buildings stay near kings

- **Any selection can be sent anywhere**, with or without a king (as of 2026-09-28). Before that, pieces without a king were held within 10 squares of one of your kings. Troops without kings became useful when pawns could lead raids on the wilds ([battle.md](battle.md) §9).
- **Buildings** still need a king within 10 squares (Chebyshev distance) to keep working ([economy.md](economy.md) §2).
- A **troop** is the pieces moving together. With a king, it's led by the king. Without one, the piece nearest the destination leads.
- **Posted pieces:** pieces you send somewhere without a king are *posted* there. They stay where you sent them instead of drifting home.
- **Drifting home:** pieces that end up outside every king's reach without being sent there (left behind when their king walked off, or survivors of a lost raid) drift toward the nearest king.
- **Merchants** on a trade run travel as caravans between their owner's towns (visuals.md §10). They can't fight or be attacked.
- **Attacking** an empire still needs a king in the troop; raiding a wild camp needs a king or a pawn.
- **Posted troops can be attacked:** a pawn among them defends as its commander ([battle.md](battle.md) §9). Survivors who flee a lost battle are no longer posted, and head home.
- **Routing:** pieces that lose their king (the survivors who flee after a lost battle, [battle.md](battle.md) §7) become a **routed band**. It drifts toward the owner's nearest king on its own. It can't be given orders and can't be engaged. Once it's within reach of that king, it becomes normal pieces again.

### Formation

A troop has a **heading**: the direction of its path, snapped to N, E, S or W. Pieces take **slots** relative to the heading:

```
 heading →  (east)
  rank 2:  E  N  B  Q  K  B  N  E        (back rank, pieces)
  rank 1:  p  p  p  p  p  p  p  p        (front rank, pawns face the heading)
```

- The default formation is the **chess line**: two ranks, pawns in front, pieces behind, like a chess army marching. With fewer pieces the line shrinks, centered on the king.
- **Column** formation is 2 wide and long, for paths through forests and passes. The troop switches to it on its own when the path is narrow, then switches back.
- Bishop slots are assigned only to squares of that bishop's color. If a bishop's slot is the wrong color, swap it with the nearest same-rank slot.
- When the heading turns 90°, the pawns have to rotate. That costs them a turn, so the troop visibly pauses while its pawns turn to face the new direction. This is intentional and good to see.

### Waiting rule (Decided in spirit: "queens move a full 8 at a time, but wait for their troops")

- The troop tracks an **anchor**: how far its slowest piece has come along the troop path.
- No piece may move more than **4 squares ahead** of its slot's position relative to the anchor. Fast pieces make one big move, then **wait** while the pawns catch up. Queens and elephants leap ahead and hold; knights hop in L's around the formation.
- If the king falls behind the command radius, everyone ahead holds until it catches up.

### Keeping the troop together (as built, 2026-09-28)

- **The leash:** the troop's lead point keeps advancing while every piece is within 3.5 squares of its slot. (It used to wait for every piece to stand exactly in place, so every pawn turn and every obstacle cost the whole troop a few turns.)
- **Routes for stragglers:** a piece more than 5 squares from its slot, or stuck for 2 turns, plans its own route over the terrain. Pawns and elephants plan with no diagonal steps, since they can't make them.
  - It then chases a point 2–3 squares ahead on that route with its normal gait.
  - That point can be behind it, so a pawn can back out of a dead end or go around a lake.
  - Progress means getting further along the route, not straight-line distance, so going around doesn't count as stuck.
  - Route plans share a budget of 24 a turn while someone is watching.
- **Left behind only when hopeless:** the troop moves on without a piece only after 14 turns in which it made no progress, even on its route. It used to be 3 turns. Pieces left outside every king's reach drift home as before.

### War elephants clear the woods (as built, 2026-09-28)

- A troop with at least one elephant (rook) plans its road **through** trees, at an extra cost of 8 steps a tree (short cuts through tree lines and thin woods, not lanes through deep forest). Its elephants will clear them.
- The elephant nearest the next standing tree within 12 squares ahead goes to the side of the tree facing it, and knocks it down (a turn's work).
- The lead never steps onto a standing tree. It waits there for the elephants. If they can't reach the tree in 30 turns, the troop re-plans around the woods.
- On its own route, an elephant also knocks down a tree standing in its way.
- A felled tree becomes a stump and regrows later, like trees cleared near towns.

## 5. Pathfinding (as built)

- **Troop path:**
  - Short routes (up to 48 squares): A* over squares a king can walk, in 8 directions.
  - Long routes: **two levels**. A coarse A* over 8×8-square cells finds the way around lakes and mountain ranges; cells are passable if any sampled square is, so narrow fords still count. Fine A* then connects waypoints along the coarse route.
  - If a waypoint turns out unreachable at the fine level, its cell is marked blocked and the coarse route is re-planned (within a 250ms budget).
  - **Legs:** a troop that reaches the end of a partial route plans the next leg. It only gives up after 8 legs in a row that don't get closer.
  - **Budgets hold** (2026-09-28): a plan stops at its time budget (80 ms for bots, 250 ms for people), give or take one chunk. Planning into land nobody has loaded generates it, at several ms a chunk, so:
    - the search checks the clock every 64 steps;
    - the coarse search looks at each cell once, and treats cells it hasn't looked at yet as closed once the time is up;
    - waypoints are found as the route reaches them, not all up front.
    Before this, a bot's 80 ms order could take 290–515 ms. What isn't planned in time is planned in the next legs.
- **Per-piece move:** each world turn, each piece makes the gait move that best closes on its formation slot. A piece stuck for 3 turns searches a wider area for a way around.
- **Getting through:**
  - The owner's **idle pieces step aside**: they swap places with a marching piece.
  - Groupmates don't swap with each other (that made them shuffle each other off their slots).
  - A troop where half the pieces are stuck **re-plans its route around** whatever pieces are blocking it.
- **Pace:** the lead point moves on once everyone is within 2.5 squares of their slot, or has given up trying.
- **Measured:** 14 of 14 attack marches (up to 350 squares, random maps) reach their target. Marches of 650–1,000 squares around complex lakes can still give up.

## 6. Camera and direction (Decided: "rotate the camera, now that becomes up")

- The camera rotates in **90° steps** (Q/E, or buttons on touch), because the world is a square grid. It also zooms (4 levels) and pans (drag, WASD, edge scroll).
- **Screen-relative controls:** directional input (arrow keys, "advance" commands, formation facing) is read relative to the camera, so "up" on screen is always forward.
- **Sprites stay upright.** Only the board rotates under them. The knight's sprite flips to face its direction of travel on screen.
- **Pawn facing** is drawn as a small chevron on the ground in front of the pawn, in world space, so it rotates with the camera. That keeps a pawn's facing readable from any camera angle.
- In battle mode the camera snaps so the player's own side is at the bottom, like a normal chess board.

## 7. Selection and orders

| Input | Action |
|---|---|
| Click, or drag a box | Select pieces or troops |
| Shift + click | Add to the selection |
| Double-click | Select all visible pieces of that type |
| Ctrl + 1–9 / 1–9 | Save / recall a control group |
| Right-click a square | Move there (the selection forms or joins a troop if it includes a king) |
| Right-click an enemy troop or city | Attack (see [battle.md](battle.md) §2) |
| F | Cycle formation (line, column) |
| Touch | Tap to select; long-press a square for the order menu |

Pieces selected without a king can be sent anywhere (the command rule, §4): to guard a settlement, clear a building site, scout, or raid a wild camp.

## 8. Animation (per gait)

| Piece | Animation during its 600ms |
|---|---|
| King | Steady step with a small bob; a cape sway. |
| Queen | Smooth glide with ease-in-out and a slight lean forward; a faint trail on long moves. |
| Elephant | Heavy slide, with a dust puff when it starts and stops; a slight screen shake at 8 squares when zoomed in. |
| Bishop | Diagonal glide with a robe sway. |
| Knight | **Two-segment arcing hop** along the L: up, over, land, with the shadow shrinking at the top of the arc. |
| Pawn | Short march step. Rotating: the sprite flips and the chevron swings 90°, with a small "about-face" stomp. |
| Waiting pieces | Idle breathing (a 2% vertical scale), matching the stoic style. |

Animations are driven by server move events. The client never invents moves, but it may **predict** your own troop's next move from the shared rules, so input feels instant; the server corrects it if needed.

## 9. Works: knights pave, elephants clear

As built on 2026-09-28. Code: `apps/server/src/works.ts`; numbers in `constants.ts` (`PAVE_*`, `CLEAR_*`).

Knights and elephants have jobs outside battle. Both work as **crews**: select several, give one order, and the work is split between them. More hands finish sooner, less the time spent getting to their share, so returns diminish.
- **Workers:** they're ordinary idle pieces with a job. They're posted where they work (§4), and idle routines leave them alone.
- **Taken off the job:** any new order (move, stop, attack), or a battle, takes a piece off its job. What it finished stays done.
- **Restarts:** jobs don't survive a server restart. The workers just stand where they were.

### Paving (knights)

- **Only a crew:** **Pave**, **Clear land** and **Raise altar** show only when the whole selection is knights, elephants or bishops (as of 2026-09-28). A mixed troop marches; a crew of one kind works.
- **The order:** select knights (up to 8), tap **Pave**, then tap where the road should go. The road runs from the crew along open ground to that square, up to 400 squares long, and costs only the knights' time.
- **Splitting the work:**
  - The route is cut into one stretch per knight. A knight riding farther out gets a shorter stretch, since riding is about 4× as fast as paving (`PAVE_RIDE`), so the crew finishes together.
  - Whoever finishes first rides over and takes half of the longest stretch still left.
- **Paving:** a knight paves the next square of its stretch when it's within 2 squares of it, taking 2 turns per square (`PAVE_TURNS`), and keeps up with the road as it goes.
- **Measured** (40 squares): 1 knight takes 83 turns (about 50 s), 2 take 49, 4 take 34, and 8 take 26.
- **A paved square** has a traffic value of 1000 (`PAVED`). It never fades, and footsteps don't wear it down. It's drawn wider than a street, with a kerb and set stones. Turns carry newly paved squares to the clients (`turn.paved`).
- **Speed:** a troop whose lead square is paved takes an extra step every other turn (about 1.5×). With the chapter 7 *Roads* unlock, busy streets (traffic 60+) count too.

### Clearing land (elephants)

- **The order:** select elephants (up to 8), tap **Clear land**, then drag over the area (up to 40×40), or tap its middle for a 9×9 patch. A confirm sheet shows what's there and roughly how long it will take.
- **Working:** each elephant takes the nearest thing left in the area, walks beside it, works it down, and moves on. Two never work the same spot. Something it can't reach is left for later.
- **Time per spot, for one elephant** (`CLEAR_TURNS`): tree 2 turns, rock 8, ore 20.
- **What's left:** a felled tree's stump is dug out after a minute instead of regrowing. Rock and ore are gone for good.
- **Safeguards:**
  - Rock and ore are only broken when you tick *Also break rock and ore*. The sheet then says how many would be destroyed, and notes that palaces need ore.
  - Hoards are never cleared, and neither is anything within 10 squares of another empire's buildings.

## 10. Troops (as built, 2026-09-29)

Pieces you send out of your cities hold where you sent them, together, as a **troop**. The code is in `apps/server/src/troops.ts`, the constants are `TROOP_*` in `constants.ts`, and the lesson is `troops`.

- **Forming.** A move, an attack or a Stop whose destination is more than `TROOP_CITY_R` (8) squares from all of your buildings makes the moving pieces a troop, with its **post** at that spot. Members are posted, so they don't drift home, with or without a king.
- **Moving and splitting.** Moving exactly a troop's members (plus any of its reinforcements) moves the troop: the post follows, and the troop keeps its id. Any other selection leaves its old troops. Out of a city, that selection is a new troop; into a city, it is simply home. Troops left with no one in them are removed.
- **Reinforcing.** `troop.reinforce` sends one piece (the client picks the nearest of the kind; never the Emperor) walking to the post. It is listed in `joining` with a deadline of `max(TROOP_JOIN_MIN_MS, distance × 4 turns)`, and becomes a member within `TROOP_JOIN_R` (4) squares. Past the deadline it is dropped and walks to the nearest city.
- **Leash.** A member that is idle, not in a march and more than `TROOP_LEASH` (16) squares from the post is dropped and walks home. So is one that is routed after a lost battle, and the survivors of a lost raid.
- **Home.** `troop.home` (to a named city, or the nearest) and `troop.homeAll` march troops to a city. They disband there once everyone has stopped. A troop whose post becomes part of a city (a town it took) disbands the same way.
- **Crews aren't troops.** Pieces given a paving or clearing job leave their troops.
- **Data.** Troops live on the player record (`PlayerRec.troops`, saved with the world) and are sent to the owner in `PlayerSelf.troops`.
- **Interface** (ux.md §3):
  - A Troops chip next to the king chips on phones, and a Troops section in the desktop side panel. Each row shows the makeup, its status (Holding, Marching, In battle, Heading home) and where it is relative to the nearest city, with Go and Home buttons, plus Call all to [city].
  - Map pins at posts when zoomed out, and edge arrows when a post is off-screen.
  - The selection bar's + on a kind calls reinforcements when the selection is a troop. A selected troop shows its post and gold trails from the pieces on their way.

