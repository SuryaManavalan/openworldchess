# What the game really does (the only things an ad may claim)

Checked against the code and `docs/` on 2026-09-27. When the game changes,
update this file first. If a claim isn't here, verify it in the code
(`packages/shared/src/`, `apps/server/src/`) before using it.

## The pitch in one line

**The whole world is one endless chessboard. Build an empire, raise an army of
chess pieces, and every battle is a real game of chess.** Free, in the browser,
on phone and desktop, no download.

## Core facts

| Claim | Where it lives |
|---|---|
| One shared, endless world; real players and AI empires in it | `docs/DESIGN.md`, `world.md` |
| Every battle is a real game of chess, with a clock | `battle.md`, `packages/rules` |
| Your army in a battle is the pieces you brought: at most one legal set (8 pawns, 2 knights, 2 bishops, 2 rooks, 1 queen) | `setWorth`, `pickSet` |
| Pieces walk the world in character: knights hop in L-shapes, pawns trudge | `movement.md` |
| **The rook is a war elephant** (our art) | `art.md` |
| **War elephants knock down trees** to clear a road through woods for the troop they march with | `movement.md` §4 (as built 2026-09-28) |
| **Elephants clear land on order**: select them, Clear land, drag an area; each tree takes an elephant 2 turns (rock and ore only if you tick it) | `movement.md` §9 Clearing land |
| Elephants **haul** stone and ore from a deposit to where you build | `citybuilding.md` |
| Troops march as a column along their road and fan out into a chess line when they arrive | `movement.md` §4 |
| Kings hold land: buildings only work near a king | `economy.md` |
| Buildings make pieces: houses → pawns, stables → knights, temples → bishops, barracks → elephants (rooks), palace → kings and queens | `constants.ts` |
| Resources: wood, stone, crops, ore | `resources.md` |
| Your **Emperor** is your elite king. Lose it and your empire scatters: you start over somewhere new | `DESIGN.md`, `battles.ts` fallOfEmperor |
| Beat an Emperor and you can **seize a crown** (a king of your own) | `battle.md` |
| Win a siege and the town's buildings are yours | `battle.md` |
| **Promotion is temporary**: a promoted pawn fights as a queen (ghostly armor) for that one battle, then it's a pawn again | `battle.md` |
| **En passant is in the game** | `packages/rules` |
| The land itself has a rating (Elo): richer land is stronger land, with stronger neighbors. The minimap has an Elo layer | `resources.md`, `progression.md`, minimap in `HUD.tsx` |
| **The wilds**: 32 factions of creature camps that grow over time, from goblins to a Dragon Brood | `wilds.md`, `packages/shared/src/wilds.ts` |
| Rare factions live in rare biomes (ash plains, frozen lands, fey glades, deserts) | `wilds.md` |
| Beat a camp's king and it scatters, leaving a **hoard** | `wilds.md` |
| Raider camps hold **captives** you can free | `campaign.md` |
| Creatures never join you: they're monsters, not recruits | `wilds.md` |
| **The Chronicle**: a 15-chapter campaign (designed as a ~15-hour journey) with titles from Settler to High King | `campaign.md`, `chronicle.ts` |
| Titles: Settler, Chieftain, Warden, Lord, Baron, Count, Duke, Prince, King, High King | `chronicle.ts` |
| **Relics** from rare beasts: Dragon's Skull, Sphinx's Head, Nine-Tail Idol, Griffon Totem, Hag's Cauldron, Crystal Crown, Jarl's Ice Axe, Serpent Idol | `chronicle.ts` |
| **Wonders**: one monument per empire, visible to the world | `campaign.md` |
| Capital; roads (worn by traffic, faster travel); walls (drawn once a town survives a siege; a walled town defends with its whole garrison); muster | `campaign.md`, `settlements.ts` |
| While you're away, the AI defends your battles | `safeguards.md` |
| Share a replay clip of your battle straight to TikTok | `tiktok.md` |
| Cosmetic civilizations: Dravidian, Roman, Chinese, Egyptian (paid, cosmetic only) | `cosmetics.md` |

## Chapter names (good for titles)

Hearth · First Hunt · Village · The Second Crown · Crown of Stone · Trade Winds ·
Roads Beyond · The Lairs · Strange Lands · Rivals · The Rich Lands · The Deep
Wilds · Siegecraft · The Dragon · Legacy.

## The 32 factions (good for "which one are you" hooks)

Goblin Warband, Wolf Pack, Kobold Warren, Orc Warhost, Bandit Company, Stag Herd,
Boar Sounder, Gnoll Pack, Lizardfolk Tribe, Frogfolk Bog, Spider Nest, Owlbear
Brood, Harpy Roost, Troll Band, Sahuagin Raiders, Lion Pride, Ape Troop, Serpent
Cult, Scorpion Swarm, Tomb Guard, Frost Clan, Mammoth Herd, Centaur Tribe,
Restless Dead, Sporefolk Circle, Fey Court, Earthen Court, Kitsune Shrine, Fire
Clan, Dragon Brood, Griffon Aerie, Hag Coven.

## Never claim

- Pay-to-win, or that paying helps you fight. (Cosmetics only.)
- A number of players we can't show. Say "real players", not "millions".
- Features on the roadmap but not shipped. Check `docs/STATUS.md`.
- That the rook *was* an elephant in chess history. (True story: in chaturanga the
  elephant became the bishop and the chariot became the rook. But in India the
  rook is still called *haathi*, "elephant". Say that, or just "our rooks are war
  elephants".)
- Anything about chess.com, Lichess, GothamChess or any real person as if they
  endorse us. We can reference memes; we don't imply endorsements.
