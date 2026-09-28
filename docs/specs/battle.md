# Battle Spec

A battle is one game of standard chess between two players, fought with the pieces they brought. It covers engagement, setup, play, outcome, and aftermath.

## 1. Rules you already decided

- Each side fields **at most one standard set**: 1 king, 1 queen, 2 Elephants (rooks), 2 bishops, 2 knights, 8 pawns. Fewer pieces are fine.
- The **attacker must bring a king** to start a battle.
- A settlement under attack **auto-picks** its defending set. The defender gets an alert ("City A is being attacked. Battle starting in 59 seconds.").
- When a settlement's king falls, the loser's survivors **flee**, and all other pieces in the settlement **convert** to the winner. If the fallen king was the **Emperor**, the winner gets **all** the pieces, and the loser restarts in a lower-elo area.
- If the attacker loses, their survivors flee, and their reserves convert to the defender.
- A **cooldown** follows every battle. It's at least as long as the winner needs to regenerate their losses, and it locks the winning army and the attacked settlement.
- Third players who come across a battle **can watch but can't interfere** (like Wizard101).

Everything else below is **Proposed**.

## 2. Engagement

**Target: always an enemy king**, and with it everything that king holds: its pieces within reach, and any buildings it anchors. There's no separate "city" target ([PRINCIPLES.md](../PRINCIPLES.md) §1). What we call a **siege** is a battle against a king that anchors buildings (a *settlement*). A **field battle** is a battle against a king that doesn't. In this spec, "city" and "settlement" mean the same thing.

An attack order is valid when all of these hold:
1. The attacking troop has a king and isn't on cooldown.
2. The target isn't already in a battle or on cooldown.
3. The attacking king is within **engagement range** of the target:
   - within 3 squares of the target king, or of any piece or building it holds.
4. The target doesn't belong to the attacker, or to a player the attacker has allied with (alliances are future work).

**Countdown:**

| Target | Countdown | During the countdown |
|---|---|---|
| Settlement (the target king anchors buildings) | **60s** (decided) | The defender is alerted; the settlement's roster **freezes** (nothing enters or leaves); the attacker may cancel. |
| Troop (no buildings) | **15s** | Both troops freeze in place. The defender is alerted and may **resign now** to flee early (their king is captured and survivors rout). The attacker may cancel. |

- **Cancelling** puts the attacking troop on a 2-minute cooldown, so it can't spam alerts.
- Freezing the defending troop is necessary. Otherwise fleeing would make field battles impossible, and pawns are slow enough that a chase would never end.

## 3. The arena

- The battle is fought on an **8×8 arena** at the engagement point:
  - a settlement: centered on the defending king;
  - a field battle: centered on the midpoint between the two kings.
- The arena is drawn as a raised chessboard over the world, in the classic board colors, inside a translucent **dome**. The world's own terrain doesn't affect the game: water, buildings and trees under the arena don't matter. **Every battle is plain chess.**
- While the battle runs, the arena's footprint plus a 1-square margin is **sealed**: nothing else can enter, and outside troops path around it.
- **Orientation:** each side's home rank faces the direction its army came from. Each player's camera snaps so their own side is at the bottom.

## 4. Picking the set

At the end of the countdown, each side's set is picked automatically:

1. **King:** the attacking king and the target king. Other kings nearby don't fight; they're reserves (and valuable if captured).
2. For each other type, up to its standard count, pick the pieces of that type **nearest the arena**. Queen: 1; Elephant, bishop, knight: 2 each; pawn: 8.
3. Everything left over is **reserves**: pieces that don't fight. A settlement's reserves are its garrison; a troop's are its spare pieces.

The chosen pieces **auto-assemble**: they walk (animated, about 2 seconds) to their standard starting squares:

- **Attacker plays white and moves first.** They took the initiative; the defender got the 60-second warning.
- Missing pieces leave their starting squares empty.
- If there's one bishop, it takes the starting square of the matching color. Bishops keep their square color from the world, so a light-square bishop starts on f1 (white) or c8 (black).
- If there's one Elephant or one knight, it takes the king-side starting square.
- **Castling** is allowed whenever the king and the relevant Elephant are both on their home squares. That's always true at the start, when both exist.

## 5. Play

- **Rules:** standard FIDE chess, including en passant, castling, promotion, and all draw rules (stalemate, threefold repetition, 50-move rule, insufficient material).
- **Clock (Decided):** **5 minutes + 3-second increment** per side. The whole battle lasts under ~13 minutes.
- **Promotion (Decided after playtesting):** the player chooses queen, Elephant, bishop or knight, and **it lasts this battle only**. The pawn walks out of the battle a pawn again.
  - **Why:** permanent promotions let one lucky battle mint queens that no palace paid for, which bypasses the economy.
  - **On the board:** a promoted pawn is drawn as the pawn inside a glowing, see-through spirit of its new piece, with a few sparkles, like a pawn holding a magic artifact that lasts one battle (`art/assets/ascended.mjs`). The spirit's shape shows how it moves, and hovering names it ("Pawn, fighting as a queen for this battle only").
- **En passant** works as in chess. The board marks the en passant square as a capture.
- **Resign** and **offer draw** are available.
- **Disconnects:** if a player is disconnected for 20 seconds, the **AI takes over** at that player's rating ([TECH.md](../TECH.md) T10) and hands control back when they reconnect. If the defender is offline at the start, the AI plays from move 1.
- **Chat:** emotes only, to avoid moderation load. Full chat can come later.

## 6. Outcomes

| Result | How |
|---|---|
| Win / loss | Checkmate, flag (timeout), or resignation. Flag against a side with insufficient mating material is a draw (standard). |
| Draw | Stalemate, repetition, 50-move rule, insufficient material, or agreement. |

Pieces captured during the battle are **gone for good** (they die).

## 7. Aftermath

### Win or loss

| Case | Loser's surviving battle pieces | Loser's reserves | Buildings |
|---|---|---|---|
| Defender loses a settlement | flee as a routed band ([movement.md](movement.md) §4) | the whole garrison converts to the winner | **Transfer to the winner**, anchored by the winner's king, who must now stay in reach ([economy.md](economy.md) §2). If another of the loser's kings is also in reach, the buildings stay the loser's (shared anchors are a real defense) |
| Attacker loses at a settlement | flee home as a routed band | convert to the defender | unchanged |
| Loser of a field battle | flee as a routed band | convert to the winner | none involved |
| **The loser's king was their Emperor** | **convert to the winner** (nobody flees) | convert to the winner | the buildings (if any) transfer; see [progression.md](progression.md) §3 for the loser's other holdings |

- The winner's survivors return to their troop or garrison.
- Converted pieces keep their type. They're re-tinted to the winner's color, with a short banner-flip animation.
- There is no stockpile to loot ([economy.md](economy.md) §1). The prize is the settlement itself: its site, its buildings, and whatever its nodes have left.

### Seizing a crown (Decided after playtesting)

- **Defeating a player's Emperor seizes their crown:** the victor gets one new king at the battlefield, within their title's king cap (campaign.md §4.1). If they're at the cap, they get 300 Renown instead.
- Ordinary king battles give no king, so kings can't be farmed from skirmishes.
- As with conversions, accounts younger than 2 hours give no crown (anti-farming).
- The fallen Emperor's other crowned kings still go masterless with the rest of the empire, and any nearby king can claim them. The two starting kings never change hands.

### Draw

- No conversion. Both sides keep their survivors.
- The attacker's troop is pushed back to 6 squares from the target.
- Each side gets a cooldown based on its own losses.

### Rating

- A battle is **rated** (Glicko-2, [progression.md](progression.md) §2) when humans played at least 75% of each side's moves.
- Battles mostly played by the AI are unrated for the absent player. The present player gains or loses against the AI's set strength.

## 8. Cooldown

**Length:** `max(2 minutes, Σ over the winner's lost pieces of productionTime(piece, winner))`. `productionTime` uses the winner's current production capacity: more stables means knights come back faster. Formula details are in [economy.md](economy.md) §3.

**What it locks:**
- **The winning army's participants:** the pieces that actually fought can't start or be part of a new battle until it ends. They can still move.
- **The attacked settlement:** its buildings' anchoring kings can't be attacked by anyone (this protects the new owner after a conquest).
- **After a draw:** each side's participants, for a cooldown based on its own losses.

**Chaining battles with reserves (interpretation of "bring 3 kings and 3 queens and battle after battle"):** reserves didn't fight, so they aren't locked. A troop carrying spare kings and pieces can form a **new, unlocked set around a fresh king** and attack a different target right away. The spares pay for the tempo up front. *Confirm this interpretation.*

**What the attacked side sees:** cooldowns show as a shield icon with a timer over the settlement or troop.

## 9. Raids on the wilds: a pawn commands

As built on 2026-09-28. Code: `Game.orderAttack`, `Game.orderMove` (`commander`), `Battles.start` and `Battles.finish`.

Nobody should have to march a king out of its city to clear a camp. **Any troop with at least one pawn can attack a wild camp**, without a king:
- **The commander:** the troop's pawn nearest the camp (and not recovering from a battle) is named its **commander** and fights as the king, for this battle only. It is shown as a gold, ethereal king around the pawn, titled "Commander" (the same ghost-king art as a promoted pawn, in gold).
- **Beyond reach:** a raid may march past your kings' reach, since it's going to fight, not to settle.
- **The set** is picked around the commander exactly as around a king (§4).
- **Losing:** checkmating the commander wins the battle as usual. If the raid loses, the commander (a pawn) falls, and that's the only extra loss: the troop's reserves aren't converted, as they would be if a king fell, and they walk home.
- **Winning** pays like any camp victory (rating, renown, loot).
- **Rules that stay:** attacking another **empire** still needs a king in the troop, and a troop with a king is always led by its king.

## 10. Spectating (Wizard101 style)

- From the world, anyone sees the arena dome with the live game playing out: pieces move, with the capture animations.
- Clicking the dome opens a **spectator view**: the full board, both clocks, the move list and both players' names and ratings. Spectators can send emotes.
- Spectators can't enter the arena squares, can't join, and can't attack either side while the battle is running (both sides are "in battle" and not valid targets).
- Nearby pieces idle and gather slightly toward the dome, so a battle draws a crowd on its own.

## 11. Data

A battle record is stored at the end, transactionally:

```
battle { id, kind: 'siege'|'field', attacker: { playerId, kingId, set[] },
         defender: { playerId, kingId, buildingIds[], set[] }, startFen, pgn, result,
         termination, aiMoves: { white, black }, startedAt, endedAt, arena: { x, y, orientation } }
```

Piece ids in `set[]` map board squares back to world entities, so deaths, promotions and conversions can be applied to the world.

## Open questions

- **Attacking from inside your own settlement:** can a defender make a sortie (attack a besieging troop first)? The current rules allow it: it's an ordinary field attack.
