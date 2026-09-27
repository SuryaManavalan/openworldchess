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

### Command rule (Proposed): one reach rule for everything

- **Every piece must stay within 10 squares (Chebyshev distance) of one of its owner's kings.** This is the same reach that keeps buildings standing ([economy.md](economy.md) §2). There's one rule for pieces and buildings alike, and no city radius.
- **One exception:** merchants on a trade run travel as caravans between their owner's towns (visuals.md §10). They can't fight or be attacked.
- A **troop** is simply the pieces moving with a king. When you drag a group that includes a king, the group moves together. When you drag pieces that have no king, they can go anywhere within reach of any of your kings, but no farther. The path preview stops at the edge of reach.
- **Why:**
  - It matches the decided rule that an attacker must bring a king. Every army in the field can fight, and every fight is king against king.
  - It makes kings the true bottleneck. The palace produces them slowly, so the number of armies a player can field is limited.
  - It removes the edge case of a king-less troop that can't be battled.
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

## 5. Pathfinding (as built)

- **Troop path:**
  - Short routes (up to 48 squares): A* over squares a king can walk, in 8 directions.
  - Long routes: **two levels**. A coarse A* over 8×8-square cells finds the way around lakes and mountain ranges; cells are passable if any sampled square is, so narrow fords still count. Fine A* then connects waypoints along the coarse route.
  - If a waypoint turns out unreachable at the fine level, its cell is marked blocked and the coarse route is re-planned (within a 250ms budget).
  - **Legs:** a troop that reaches the end of a partial route plans the next leg. It only gives up after 8 legs in a row that don't get closer.
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

Selecting pieces without a king lets you move them only **within reach of your kings** (the command rule, §4), for example to guard a settlement or clear a building site.

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
