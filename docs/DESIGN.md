# Open World Chess: Game Design

> Status: early vision (2026-09-26). Everything here may change once we start building.

## Concept

An online multiplayer "open world" chess game. The world is a chessboard that goes on in every direction. Players collect resources, do a little city building, raise armies of chess pieces, and fight other players in real chess games.

## The Emperor

- Each player has an **Emperor**, their elite king.
- If the Emperor is lost, the player **starts over from scratch** in a new area, and gets pushed into a lower-elo area.

## Buildings and piece production

(The numbers are placeholders.)

| Building | Produces | Notes |
|---|---|---|
| Palace | Kings and Queens | Same rate for both, the slowest of all buildings |
| Houses / Taverns / ordinary buildings | Pawns | |
| Stables | Knights | |
| Temples | Bishops | |
| Barracks | Rooks (called **Elephants** in this game) | |

- Buildings cost **resources**, and there are several resource types.
- A building can only go up **within the vicinity of a king**.
- That king has to **stay in the vicinity**. If the king leaves, the buildings break down.
- Because of this, players will want to set up villages and cities near resources.

## Conquest

- Players can bring armies to attack other players' cities.
- A city falls when its **king** falls in the battle, which is a chess game.
- When a city falls:
  - The losing player can **flee** with whatever pieces they have left from the battle.
  - All the other pieces they had in the city **convert** to the winner.
- If the loser's **Emperor** was killed, the winner gets **all** of their pieces, and the loser starts from scratch in a new, lower-elo area.

## Elo map

- The map is also an **elo map**: every region has an elo level.
- It is **not** a single gradient along one axis. There are **pockets** of high elo scattered around.

## Direction and camera

- The world has no fixed "up". When the player rotates the camera, whatever direction they now face becomes "up".
- Directional movement needs careful thought, especially for pawns, since their forward direction matters.

## Game states

### 1. Open-world roam

- The player can select several pieces and send them to a location.
- Pieces move **on their own, as a troop**, and the way they move should look interesting and true to each piece:
  - **Knights** hop in L shapes.
  - **Queens** cover up to 8 squares in one move, but wait for the rest of their troop.
  - **Pawns** move one square at a time and have to spend time turning to change orientation.
  - (Rooks, Elephants, bishops, and kings: to be defined in the same spirit.)

### 2. Battle mode

- Two players play a chess game with **whatever pieces they brought**.
- Pieces **auto-assemble** onto their correct starting squares.
- After that it's normal chess, possibly with **timed turns**.

#### Battle rules (decided)

- **Each side fields at most one standard chess set:** 1 king, 1 queen, 2 Elephants (rooks), 2 bishops, 2 knights, 8 pawns. A side can bring fewer pieces, but never more of any type. Uneven armies bigger than a set are not a thing.
- **The attacker must bring a king** to start a battle.
- **Cooldown after a battle:** at least as long as it would take the **winner** to regenerate the pieces they lost in that battle.
- **The game auto-picks the defending set** from the pieces in the city, up to one standard set. The city's king always fights.
  - When an attack begins, the defender gets an alert, for example: *"City A is being attacked. Battle starting in 59 seconds."* Then the defending set assembles on its own.
  - Example: a city holding 3 queens and 20 pawns fields its king, 1 queen, and 8 pawns.
- **The cooldown locks both the winning army and the attacked city,** so the same city can't be hit again right away.
- **Losing as the attacker works the same way as losing as the defender.** If the attacker's king falls, their surviving pieces flee, and their reserves (pieces they brought that weren't in the battle) convert to the defender.
- **Battle clock:** 5 minutes + 3 seconds per move.
- **An Emperor kill takes only what's nearby:** the winner takes the battle's pieces and that city. The loser's other holdings become **masterless**, and any king can claim them. (See [progression.md](specs/progression.md) §3.)
- **Reserves let you chain battles.** An army that travels with spare pieces (for example 3 kings and 3 queens) can start battle after battle, because the spares cover what was lost.

### 3. Spectating a battle from the open world

- If a third player comes across a battle in progress, it works like **Wizard101**: the battle is visible, but they can't really interact with it or do anything about it.

## Direction set later (your words, 2026-09-26)

- **High elo should draw players in.** Players should move deeper slowly, building villages and cities further in, and even moving their Emperor settlement to settlement toward the heart of their empire. That's dangerous. It must **not** be a railroaded feature. It works the same way as selecting a group of pieces and dragging them somewhere. *"We don't want to bake features in, we want gameplay to emerge from first principles."* See [PRINCIPLES.md](PRINCIPLES.md) and [migration.md](specs/migration.md).
- **Mobile-friendly and desktop-friendly from day 0.** Use intuitive native mobile gestures, interactions and placements for everything; don't just scale down the desktop version. See [ux.md](specs/ux.md).
- **AI players from day 0.** Bots that can't be told apart from real players, for testing and for early players before the player base is big. Phase them out slowly as more people join. See [bots.md](specs/bots.md).
- **A world that's alive.** Beautiful, eye-catching animation that's almost hypnotic to watch, *"brain rot style"*. Pieces in a city walk around and live their own lives. It's the small touches someone catches and thinks "wow, this world is alive." See [visuals.md](specs/visuals.md).
- **Sound as the cherry on top.** It adds to the living, breathing world; every interaction should feel satisfying, with *"almost casino-like noises"*. It should be immersive and match the world, so players feel they've entered it. See [audio.md](specs/audio.md).

## Open questions → proposals

Each of these now has a proposed answer in the specs. [ROADMAP.md](ROADMAP.md) lists the ones that need your sign-off.

| Question | Proposal | Where |
|---|---|---|
| Tick model | Discrete world turns (600ms); every piece moves at most once per turn | [TECH.md](TECH.md) T7, [movement.md](specs/movement.md) §1 |
| Battle trigger | An explicit attack order within 3 squares; the defender can't decline (except by resigning a field battle during its countdown) | [battle.md](specs/battle.md) §2 |
| Where the battle board is | An 8×8 arena drawn over the world at the engagement point and sealed under a dome; the terrain underneath is ignored | [battle.md](specs/battle.md) §3 |
| Pre-battle countdown | The city roster freezes; the attacker may cancel (and gets a 2-minute cooldown) | [battle.md](specs/battle.md) §2 |
| Resources | Your idea: buildings draw from resource nodes near them. There's no gathering and no stockpile | [economy.md](specs/economy.md) §1 |
| Reserves and cooldown | The cooldown locks only the pieces that fought, so spare pieces around a fresh king can attack again right away | [battle.md](specs/battle.md) §8 |
| Offline defense | Stockfish plays for you at your rating; spawn shield for new players | [battle.md](specs/battle.md) §5, [progression.md](specs/progression.md) §4 |
| Pawn promotion | Only in battles, and **only for that battle**: the pawn reverts afterward | [battle.md](specs/battle.md) §5 |
| Captures in the open world | None; captures happen only in battles | [movement.md](specs/movement.md) §3 |
| Elo zones | They set spawn and respawn location, AI strength and resource richness; they never block movement | [world.md](specs/world.md) §4 |
| Emperor vs. city kings | The Emperor is a king: it anchors whatever it stands near. There is no capital rule | [economy.md](specs/economy.md) §2, [progression.md](specs/progression.md) §3 |
