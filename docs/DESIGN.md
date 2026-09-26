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
- **Reserves let you chain battles.** An army that travels with spare pieces (for example 3 kings and 3 queens) can start battle after battle, because the spares cover what was lost.

### 3. Spectating a battle from the open world

- If a third player comes across a battle in progress, it works like **Wizard101**: the battle is visible, but they can't really interact with it or do anything about it.

## Open questions

- **Tick model.** Does the open world run in real time, or in discrete server ticks where every piece takes one step per tick? Ticks fit chess naturally and are much easier to keep in sync across players.
- **Battle trigger.** What starts a battle: moving onto an enemy square, getting within some radius, or an explicit "attack" command? Can a player decline?
- **Where the battle board is.** Is it a separate 8x8 instance, or a patch of the real world board that gets sealed off (which would fit the Wizard101 bubble)?
- **The pre-battle countdown.** During the ~60 second warning, can the defender move reinforcements into the city, or pull valuable pieces out? Can the attacker still back out?
- **Reserves and cooldown.** How exactly do the attacker's reserves cover their losses so they can skip the cooldown?
- **Offline defense.** What happens when a city is attacked while its owner is offline or AFK? Options: an AI (engine) defender, protection windows, or scheduled sieges. This matters a lot for an MMO.
- **Pawn promotion.** Where does promotion happen: only on the battle board, or also in the open world?
- **Captures in the open world.** Can pieces capture each other outside of a battle?
- **Elo zones.** Is a zone's elo just where a player spawns or respawns, or does it also restrict or reward being there?
- **Emperor vs. city kings.** Can the Emperor serve as a city's anchor king, or is it separate from city kings?
