# Wilds Spec: Hordes and Herds

**Decided:** the land between cities isn't empty. Camps of creatures live there: goblin warbands by rock deposits, wolf packs in the pines, stag herds in the meadows, a dragon's brood asleep on a hoard in the ashlands. They give players real chess battles long before anyone is ready to fight another player, and they make the map worth exploring.

Built in `packages/shared/src/wilds.ts` (the faction catalog), `apps/server/src/wilds.ts` (camps), `art/assets/creatures.mjs` + `creature-heads-{a,b}.mjs` (pieces), `art/assets/camps.mjs` (camps) and `apps/client/src/ui/Inspect.tsx` (names).

## 1. Principles

1. **Same rules as everyone.** A camp is an NPC owner with one king, a camp structure and a handful of pieces. Kings lead, the reach is 10, a battle is a real chess game with at most one set, and the AI plays the camp at the camp's rating. Nothing about chess changes.
2. **Every piece keeps its chess role, visibly.** A Goblin Boss is a king and wears the king's cross-topped crown. A Wolf Rider is a knight and is drawn as a knight's profile. You never have to guess how a creature moves.
3. **You can always tell exactly what it is.** Hover (desktop) shows a name tag: "Goblin Boss · Goblin Warband". Tap (phone) or click opens a card: the name, its chess role, the faction, its temper, the camp's pieces, a line of lore. On the battle board, every creature is named on hover.
4. **The wilds never take anything that's yours for good.** Creatures never join a player, and camps never take land.

## 2. Factions

There are 32 factions, drawn from fantasy and D&D-style bestiaries (names kept generic or from the open SRD). Each maps the six chess roles to creatures, lives in some biomes (world.md §2b), camps near a resource kind, and has a rarity:

| Rarity | Weight | Examples |
|---|---|---|
| common | 1 | Goblin Warband, Wolf Pack, Kobold Warren, Orc Warhost, Bandit Company, Stag Herd, Boar Sounder, Gnoll Pack, Lizardfolk Tribe, Frogfolk Bog, Lion Pride, Ape Troop, Scorpion Swarm, Mammoth Herd, Sporefolk Circle |
| uncommon | 0.45 | Spider Nest, Owlbear Brood, Harpy Roost, Troll Band, Sahuagin Raiders, Serpent Cult, Frost Clan, Centaur Tribe, Restless Dead, Fey Court, Earthen Court, Fire Clan |
| rare | 0.15 | Tomb Guard, Kitsune Shrine, Griffon Aerie, Hag Coven |
| legendary | 0.05 | Dragon Brood |

A faction also has a **minimum area rating** (the Orc Warhost needs 900, the Dragon Brood 1700), so the cooler, stranger creatures live in richer, stronger land. Many of those are also rare biomes, so they're doubly rare.

**Example: the Goblin Warband.** King: Goblin Boss; queen: Hobgoblin Captain; rook: Bugbear Brute; bishop: Goblin Hexer; knight: Wolf Rider; pawn: Goblin. It lives in highlands, meadows and badlands and camps by rock.

**Tempers:**
- **Herd** (deer, boars, mammoths, sporefolk, fey): never attacks. It fights only when you challenge its leader.
- **Lair** (wolves, kobolds, owlbears, dragons...): guards its home and attacks troops that come within 8 squares.
- **Horde** (goblins, orcs, bandits, trolls, the dead...): raiders that roam wider and attack troops within 13 squares.

## 3. Camps: where, when, how big

- **Sites** are deterministic: one potential camp per 56×56 cell, jittered like resource clusters.
  - The site's biome and area rating choose the faction, weighted by rarity and preferring the faction's first biome.
  - The camp stands 3–9 squares from a node of the kind it lives on: goblins by rock, wolves by trees, kobolds by ore, lizardfolk and frogfolk by water. A site with no such node has no camp.
- **The wilds fill in over time.** When players first come within 220 squares of a cell, 45% of cells hold a camp. That share rises to 80% over the next 6 hours, so land people live near keeps getting wilder.
- **Camps appear only where players are,** never within 36 squares of a player's building or 18 of a player's piece. A camp is forgotten after 2 hours with no player king within 360 squares. A scattered camp's site stays empty for 3 hours.
- **Awake or asleep (only what someone views is simulated):**
  - A camp is **awake** only while a person (not a bot) is viewing its area, meaning a subscribed chunk within one chunk of it.
  - Awake, it has its structure and pieces in the world, and it roams, shuffles and raids.
  - A minute after the last viewer leaves, it goes to **sleep**. Its pieces and structure leave the world, and only a record remains: faction, spot, roster (its pieces' kinds) and rating.
  - A sleeping camp costs almost nothing, and **its roster keeps growing**.
  - When someone looks again, it wakes, and its pieces are placed around the camp. If something was built on its spot, it moves a few squares, or disappears if it can't.
  - A camp never sleeps mid-battle, while marching to attack, or while it's under attack.
  - Sleeping camps aren't sent to clients.
- **Growth: from a king and a pawn toward a full set.** A new piece joins every 4 minutes (sped up with the game's speed) in a fixed order: K, P, P, N, P, P, B, P, R, P, Q, N, B, R, P, P. It stops at the camp's size limit:

  `size limit = min(16, 3 + ⌊0.75 × player buildings within 110⌋ + ⌊age / 40 min⌋ + strength bonus)`

- **Stronger players meet bigger bands.** The strength bonus is one piece per 120 rating above 900 (up to 8), for the best-rated player with a king within 220 squares. A new camp also *starts* with that many extra pieces. A 1000-rated newcomer meets a king and a pawn; a 1500-rated player meets bands of 7 that grow to full sets.

  So the more you build near a camp, the fuller the hordes around you become, and an old camp in the deep wilds eventually fills out too.
- **Rating: starts below the area's rating and grows into it.** `rating = areaElo − 320 × (1 − size / 16)`. A two-piece camp in 1000 land plays at 740; a full set plays at the area's rating.

## 4. Behavior

- **Roaming:** now and then the whole camp wanders out as a group (herds and hordes farther, lairs close) and always comes home. Idle creatures shuffle around their king between walks.
- **Raiding:** hordes and lairs attack only **online** players' **field troops**. They never attack an Emperor, a king standing in its own settlement, or a shielded new player, and each camp attacks at most once every 4 minutes. Nobody is ambushed while away, and no city is ever sacked by goblins.
- **Server load:** the server's engines play the camps, so at most 6 battles involving camps run at once ("The wilds are restless"), and camps think for at most 0.35s a move.

## 5. Battle aftermath

- **You beat the camp's king:** the camp **scatters**. Its creatures leave, its structure comes down, and the site stays empty for 3 hours. You've cleared the land: the rock, trees or ore it sat on are yours to build by.
- **The camp beats you:** your king falls, and the pieces with it **flee** (they don't convert). Your reserves nearby become **masterless**, so your other kings can reclaim them. Creatures never take pieces or buildings.
- **Unrated:** the AI makes the camp's moves, so these games don't change your rating (battle.md: 75% human moves on both sides). Cooldowns work as usual.

## 6. Art and names

- **Pieces** (`creatures.mjs`): each role keeps its chess cue.
  - King: robe, mantle and a gold cross-topped crown.
  - Queen: an accent robe and a spiked gold tiara.
  - Bishop: a slit mitre in the faction's accent color.
  - Rook: a wide, heavy brute in a crenellated battlement helm.
  - Knight: the mount's profile, like the classic knight.
  - Pawn: small and plain.

  The creature comes through in the head (32 kinds), the palette and the knight's mount (27 kinds). Every faction's pieces use its own palette, never light or dark, so creatures stand apart from player armies on any board.
- **Camps** (`camps.mjs`): 20 structures, tinted with the faction's colors. They include tents, dens, burrows, glades, wallows, bone totems, stilt huts, webs, nests, standing stones, a serpent ziggurat, a sand pyramid, an ice cave, tipis, barrows, fairy rings, a fox shrine, a magma forge, a dragon's hoard and a hut on chicken legs.
- **Names:** the camp's owner is named after the faction ("Goblin Warband"). Its king's banner shows that name, and the Inspect card and hover tag show each creature's own name.

## 7. Numbers to tune in playtests

Cell size and chance, the spawn and fade distances, 4-minute growth, the size-limit formula, the rating curve, aggro ranges, the 4-minute raid cooldown and the 3-hour cleared time are placeholders.
