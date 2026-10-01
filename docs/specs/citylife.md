# City life: keeping big towns alive, not crowded

Status: **Built** (2026-10-01). As players play longer, their towns hold more and more pieces.
With every idle piece standing outdoors, a big town (Rookbridge, 188 pieces) became a solid crowd
that hid the town and blocked building. City life gives pieces somewhere to be. The code is in
`apps/server/src/citylife.ts`, driven from the idle routines (`routines.ts`).

## 1. Homes: pieces live in buildings

- Each building houses some of its owner's pieces (`HOMES` in constants.ts): a house 4 pawns, a stable 3
  knights, a temple 3 bishops, a barracks 3 elephants, a palace 4 kings and queens, and a tavern or the
  Wonder 8 of anything. At night they squeeze in two to a place.
- A piece indoors (`Piece.inside` = the building) is off the board: its square is free and it isn't
  drawn. It still counts as in town: `piecesNear` finds it, so it joins its king's army in battle.
- **Any order brings it straight out** (`orderable` steps it out of doors); so does a battle calling it up,
  and so does the building being demolished or changing hands. Kings never go indoors: players need to see them.
- The client shows a puff at the door as pieces go in and out. A building's panel says how many are home
  inside, and a selected piece says "Heading home" on its way.

## 2. Day and night

The world shares one 40-minute day (`DAY_MS`, `sunAt`).
- **Night** (the sun below −0.15): nearly every idle piece goes home.
- **Day:** pieces come out a few at a time, while the town has room outdoors. A town keeps
  `OUTDOORS_BASE + OUTDOORS_PER_BUILDING × buildings` idle pieces outdoors (Rookbridge: about 60).
- Past that, the surplus goes indoors. Pawns **on shift** stay out: a share of the town's pawns, enough for
  two per working building, keeps the supply runs going.

## 3. The outskirts

When the homes are full, surplus pieces walk out to the town's rim, each to its own spot around it, instead
of standing in the middle. They don't come back until there's room.

## 4. Pilgrimages: an automatic troop

A town still over-full by day sends pilgrims out, at most two bands from one town at a time:
- **Where:** to one of the player's altars, else to another of their towns, else to open countryside a walk
  beyond the town.
- **Who:** led by a bishop if one is free, up to `PILGRIMS_MAX` (8) pieces. Never kings, queens or pawns on shift.
- **Tracked as a troop:** they appear in the Troops list as "Pilgrims, on the way to an altar". You can
  follow them, recall them, or select them like any troop.
- **The visit:** they stay `PILGRIM_STAY_MS` (3 minutes) at the shrine, then walk home and disband.
- **The peace of the road:** pilgrims can't be attacked by other empires.

## 5. Merchants

Merchants keep trading between towns, as before.

## 6. Measured

Bench: the live Rookbridge, plus test towns in a line, a ring, a grid and a hamlet, run for 400 turns. "5+" is
outdoor pieces with five or more neighbours; "nb" the average neighbours of an outdoor piece.

| Town | Before (5+) | After, noon (5+ / nb) | After, midnight (5+ / nb) |
|---|---|---|---|
| Rookbridge (188 pieces) | 27 | 8 / 1.7 | 0 / 1.0 |
| Line of buildings | 56–63 | 0 / 0.6 | 0 / 0.8 |
| Ring | 66–77 | 0 / 1.1 | 0–3 / 1.6 |
| Grid | 60 | 0 / 1.0 | 0 / 0 |
| Hamlet (3 buildings, 24 pieces) | 11–17 | 1 / 1.4 | 0 / 0 |

Server cost: the Rookbridge bench (the whole live world) went from about 14.5 to 18–25 ms a turn, still
well inside the 600 ms turn. Idle life only runs where someone is watching.

## 7. Next ideas (not built)

- Bishops raising their own altars when a town has none (needs a cap and a cost decision).
- Festivals: on dawn bells, the outdoor crowd gathers in the main square for a moment.
- Visits between allied empires' towns.
