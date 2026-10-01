// Lessons (docs/specs/campaign.md §5.7): every rule of the game, written for a player, in
// three layers:
//   text  : the one thing to know, said plainly ("Send your king, never your Emperor").
//   fine  : the fine print: the complete rule, every number and exception, so a player who
//           reads it all has no doubts. Nothing about the game should be a secret.
//   tips  : how to play it well: tactics and the strategy that emerges from the rules.
// Numbers are read from the rules' own constants, so a changed constant changes the lesson.
//
// To teach a new or changed rule: edit or add a lesson here, and name it in the `teach` of
// the step where a player first meets it (CHAPTERS). Every lesson is also in the rulebook
// (Help), whether or not a quest has taught it yet.
import {
  ALTAR_BUILDINGS, ALTAR_RATE, ALTAR_REACH, ALTAR_TEND, ALTARS_PER_PLAYER, AI_TAKEOVER_MS, ANCHOR_GRACE_MS, BUBBLE_GOLD_CHANCE, BUBBLE_GOLD_TIMES, BUBBLE_MAX,
  BUILD_SPACING, BUILDINGS, BUILDINGS_PER_KING, CANCEL_COOLDOWN_MS, CANCEL_PROTECT_MS, CLAIM_RANGE, CLEAR_CREW, CLEAR_MAX, CLEAR_TURNS, CLOCK_BASE_MS, CLOCK_INC_MS,
  COUNTDOWN_FIELD_MS, COUNTDOWN_SIEGE_MS, DECAY_EVERY_MS, ENGAGE_RANGE, FRESH_ACCOUNT_MS, KING_TIME_PER_KING, MASTERLESS_MS, MIN_BATTLE_COOLDOWN_MS, PAVE_CREW, PAVE_MAX,
  PAVE_TURNS, PLAYER_BUILDING_CAP, PLAYER_KING_CAP, PLAYER_PIECE_CAP, POP_HOUSES_COUNTED, POP_PAWNS_PER_HOUSE, POP_PAWNS_PER_KING, POP_PER_BUILDING, REACH, RUIN_LIFETIME_MS,
  SPAWN_SHIELD_MS, DECOR_BASE, DECOR_CAP, DECOR_CLEAR_R, DECOR_PER_BUILDING, HAUL_LOAD, PLANT_FIELD_COST, PLANT_FIELD_MS, PLANT_TREE_MS, TROOP_CITY_R, TROOP_JOIN_MIN_MS, TROOP_JOIN_R, TROOP_LEASH, TURN_MS, WORK_AREA, type BuildingType,
} from './constants.ts';
import { HOLD_MS, KING_OF_NEED_MIN, TITLES, RENOWN } from './chronicle.ts';

export interface Lesson {
  title: string;
  /** The one thing to know, plainly. */
  text: string;
  /** The fine print: the complete rule, every number and exception. */
  fine: string[];
  /** How to play it well. */
  tips?: string[];
}

const dur = (ms: number) => ms >= 7_200_000 ? `${Math.round(ms / 3_600_000)} hours` : ms >= 3_600_000 ? '1 hour' : ms >= 120_000 ? `${Math.round(ms / 60_000)} minutes` : `${Math.round(ms / 1000)} seconds`;
const cost = (t: BuildingType) => Object.entries(BUILDINGS[t].cost).map(([k, n]) => `${n} ${k === 'tree' ? 'wood' : k === 'rock' ? 'stone' : k}`).join(' + ') || 'free';
const works = (t: BuildingType) => BUILDINGS[t].needs.map((n) => (n === 'tree' ? 'trees' : n === 'rock' ? 'rock' : n === 'ore' ? 'ore' : 'crops')).join(' and ') || 'nothing';
const makes = (t: BuildingType) => ({ house: 'a pawn', stable: 'a knight', temple: 'a bishop', barracks: 'a war elephant', palace: 'a king or a queen' } as Partial<Record<BuildingType, string>>)[t] ?? 'nothing';
const bline = (t: BuildingType) => `${t[0].toUpperCase() + t.slice(1)} (${BUILDINGS[t].size}×${BUILDINGS[t].size}): costs ${cost(t)}; works ${works(t)}; makes ${makes(t)} every ${dur(BUILDINGS[t].baseMs)} on ordinary land.`;
const set = '8 pawns, 2 knights, 2 bishops, 2 war elephants, 1 queen and the king';

export const LESSONS: Record<string, Lesson> = {
  // ================= your crown =================
  emperor: {
    title: 'The Emperor',
    text: 'Your Emperor (the gold crown) is your empire itself. Keep it home; send kings to fight.',
    fine: [
      'You start with two kings: the Emperor (gold crown) and a plain king. Both hold land and lead armies the same way.',
      'If your Emperor is checkmated in a battle, your empire falls: every piece and building you own becomes masterless (no one\'s), and you start again with a new Emperor, a king and four pawns in a new land, rated near your own rating minus 200.',
      'The rival who beat your Emperor seizes a crown: they gain a king (or, if their title allows no more kings, Renown instead). Accounts under two hours old don\'t give up a crown.',
      'Your Emperor can\'t be replaced, bought or crowned again. Other kings can.',
      'Wild camps never raid an Emperor, but players can attack it like any king.',
    ],
    tips: [
      'Keep your Emperor in your best-built town, behind your walls, with pieces around it: an attack on it is a siege, and your defenders fight from the whole town.',
      'Never lead a hunt with your Emperor. Hunting is what plain kings are for.',
    ],
  },
  kings: {
    title: 'Kings',
    text: 'Kings are your commanders and your land-holders. Send your king, never your Emperor.',
    fine: [
      'A battle is always king against king: to attack another empire, the troop must include a king. (Raiding a wild camp is the one exception: see Raids.)',
      'A king holds the land around it (see Reach). Buildings with no king near stop working.',
      'If your king is checkmated, it dies. The pieces that fought beside it flee home; your other pieces standing near it (its reserves) join the winner. Buildings it alone held go to the winner too.',
      `If your Emperor is ever your only king and you have no palace to crown another, the Chronicle crowns a king beside your Emperor after ${KING_OF_NEED_MIN} minutes. Every empire needs a king it can send out.`,
      `You can hold only so many kings: your title sets the limit (${TITLES.map((t) => `${t.name} ${t.kingCap}`).join(', ')}), and never more than ${PLAYER_KING_CAP}.`,
    ],
    tips: ['A king alone is a target. Walk kings with their army, and keep a spare king at home to hold your town while another is away.'],
  },
  reach: {
    title: 'Reach',
    text: `Buildings work only while one of your kings stands within ${REACH} squares.`,
    fine: [
      `Reach is ${REACH} squares in every direction (a square ${REACH * 2 + 1} squares across), measured from the king to the nearest square of the building.`,
      'Your Emperor counts as a king for reach. With Regents (after chapter 5), a queen also holds buildings in her reach, though you can\'t start new ones beside her.',
      `You can only start a building within reach of a king (or near a tended altar), at least ${BUILD_SPACING} squares from another empire's buildings.`,
      'Buildings far from every king pause, and after a while start to decay (see Leading a king away).',
    ],
    tips: ['Plan towns as circles around where a king will stand. Two kings a little apart can hold a long town.'],
  },
  away: {
    title: 'Leading a king away',
    text: 'When a king leaves, its buildings rely on another king staying near. That\'s why your Emperor stays home.',
    fine: [
      'A building with no king in reach keeps going for a moment, then the settlement it belongs to holds itself for a while by its size, then it stops working and starts to decay.',
      `Grace: ${dur(ANCHOR_GRACE_MS)} before anything happens.`,
      `Then it holds by tier: a hamlet ${dur(HOLD_MS[1])}, a village ${dur(HOLD_MS[2])}, a town ${dur(HOLD_MS[3])}, a city ${dur(HOLD_MS[4])}. Your capital holds forever.`,
      `After that, it pauses; and if none of your pieces are within reach of it, it loses 1 of its 100 condition every ${dur(DECAY_EVERY_MS)}. At 0 it becomes a ruin (ruins vanish after ${dur(RUIN_LIFETIME_MS)}).`,
      'A king coming back within reach starts it working again at once. Lost condition never comes back, so don\'t let it decay.',
    ],
    tips: ['Before a long march, leave a king (or your Emperor) home. Bigger settlements forgive longer absences: grow your hearth into a village early.'],
  },
  // ================= land and buildings =================
  resources: {
    title: 'Resources stay where they grow',
    text: `Each building works the resource within ${WORK_AREA} squares of it. Build beside what it needs.`,
    fine: [
      'There is no stockpile and no carrying. Resources stay in the world as trees, crops, rock and ore, and each building works the ones around it.',
      `A building works the richest matching resource within ${WORK_AREA} squares of its footprint. If none is left, it pauses ("nothing to draw from").`,
      'Every piece it makes uses some of that resource: a house 5 crops, a stable 20 crops, a temple 15 ore, a barracks 30 rock, a palace 40 ore and 40 rock.',
      'Crops regrow steadily; a felled tree regrows in 30 minutes (inside a town its stump is dug out instead); rock and ore run out for good.',
      'Several buildings on the same resource share it: each works at its share of the rate, so crowding one field gains nothing.',
      'What a resource looks like depends on the land: crops are wheat in a meadow, berry bushes in a taiga, pumpkins in an autumn wood, corn on the savanna, and so on.',
    ],
    tips: ['Spread buildings over different fields and veins rather than stacking them on one. A rich ore vein beside rock is a palace site worth fighting for.'],
  },
  construction: {
    title: 'Building',
    text: 'A building\'s cost is taken from trees and rock near its site, and it rises on its own.',
    fine: [
      `The cost is taken from the nearest trees and rock within ${REACH} squares of the site. If there isn't enough there, you can't build.`,
      ...(['house', 'stable', 'temple', 'barracks', 'palace'] as BuildingType[]).map(bline),
      'A building rises by itself while a king is in reach (a house in 20 seconds, a palace in 90). It can\'t be placed on water, mountains, standing trees or rock, or on someone else\'s piece.',
      `Limits: ${BUILDINGS_PER_KING} buildings per king (counted within its reach), ${PLAYER_BUILDING_CAP} in all.`,
      'New kinds of building open as the Chronicle goes on: houses at the start, stables after chapter 1, temples after 3, barracks and palaces after 4, altars with temples, the Wonder after 14.',
    ],
    tips: ['Build your first house where crops, trees and your king all meet. Save rock for barracks and palaces: it never grows back.'],
  },
  production: {
    title: 'Production',
    text: 'Buildings make pieces on their own, one after another, while a king is near.',
    fine: [
      'Each working building fills a bar; when it\'s full, a new piece steps out beside it.',
      'Speed depends on the land: rich land (a high rating) works up to 1.9× as fast as ordinary land, poor land as slow as 0.7×. Sharing a resource with other buildings slows each of them.',
      'A palace alternates kings and queens (or makes only one, if you choose). Each king takes longer than the last; your first palace king comes twice as fast; a capital crowns 25% faster.',
      'Relics in your capital, trade links and a Wonder speed their towns further (up to +50%, +30% and +25%).',
      'You can pause any building from its details.',
    ],
    tips: ['Put production where it counts: pawns are cheap and quick, knights and elephants slow. A barracks on rich rock is worth two on poor land.'],
  },
  population: {
    title: 'Room for pieces',
    text: 'Each kind of piece has its own room, made by the buildings near your kings.',
    fine: [
      `Pawns: ${POP_PAWNS_PER_KING} per king, plus ${POP_PAWNS_PER_HOUSE} for each house within its reach (counting up to ${POP_HOUSES_COUNTED} houses per king), plus your title's bonus per king.`,
      `Knights: ${POP_PER_BUILDING.N?.n} per stable. Bishops: ${POP_PER_BUILDING.B?.n} per temple. War elephants: ${POP_PER_BUILDING.R?.n} per barracks. Queens: ${POP_PER_BUILDING.Q?.n} per palace. (Only buildings within a king's reach count.)`,
      'Kings don\'t use room: your title sets how many you may hold.',
      `A building pauses when its kind has no room ("no room"). Nobody may hold more than ${PLAYER_PIECE_CAP} pieces.`,
      'Pieces won in battle may take you over your room: you keep them, and production of that kind waits until you\'re back under.',
      'The piece a quest step asks for is made even when its room is full, until the step is done.',
    ],
    tips: ['Stuck making only pawns? Build a stable or barracks: each makes its own room. A king with 4 houses carries a whole pawn line.'],
  },
  bubbles: {
    title: 'Hurry bubbles',
    text: 'Pop the bubbles over your buildings to make them work faster.',
    fine: [
      `While you're playing, a bubble rises over each working building every so often (a fifth of its piece time, between 8 and 90 seconds apart), up to ${BUBBLE_MAX} waiting.`,
      'Popping one moves that building ahead by as long as the bubble took to appear. Pop every bubble and a building works about twice as fast.',
      `About ${Math.round(BUBBLE_GOLD_CHANCE * 100)} in 100 bubbles are gold, worth ${BUBBLE_GOLD_TIMES} times as much. A pop that fills the bar makes the piece at once.`,
      'Buildings waiting for room still grow (greyer) bubbles: popping banks progress for when there\'s room.',
      'Bubbles only grow while you\'re online, and only you can see and pop yours. Swiping across them pops them all.',
    ],
    tips: ['When you log in, sweep your towns: three bubbles on every building is a lot of free production.'],
  },
  buildcap: {
    title: 'Each king holds a dozen',
    text: `A king can hold at most ${BUILDINGS_PER_KING} buildings; to build more, bring another king.`,
    fine: [`A building counts toward every king within ${REACH} squares of it; you can build only if some king in reach holds fewer than ${BUILDINGS_PER_KING}.`, `No empire may hold more than ${PLAYER_BUILDING_CAP} buildings.`],
    tips: ['A second king doesn\'t just double your army: it doubles how much you can build.'],
  },
  // ================= pieces and war =================
  pieces: {
    title: 'Moving pieces',
    text: 'Tap a king and its army is selected; tap the ground (or drag) to march.',
    fine: [
      `The world moves in turns of ${TURN_MS / 1000} seconds. Each turn every piece makes one move, in character:`,
      'Knights hop one L (they jump over pieces, water and rock). Kings step one square. Bishops slide diagonally and stay on their color forever. War elephants slide straight. Queens slide any way. Pawns step forward, turning takes a whole turn, and they never move diagonally.',
      'A troop marches as a column along its road and fans out into a line when it arrives. It moves as fast as its slowest piece (a troop with pawns: about 1 square a turn).',
      'War elephants marching with a troop knock down trees in its way.',
      'Troops without a king can go anywhere: they stay where you send them. Pieces left behind by their king walk home to the nearest king.',
      'Selecting: tap a piece (just it), tap a king (its best army), or use the bar\'s Army / All / King only. + Add lets you tap more pieces in or out; long-press and draw a loop to select many.',
    ],
    tips: ['Knights and elephants make fast raiding parties; pawns are slow but make up most of any army.'],
  },
  battle: {
    title: 'Every battle is chess',
    text: 'Attack an enemy king, and both sides play a real game of chess. Checkmate wins.',
    fine: [
      `Attack by selecting an army and tapping an enemy king (or any of its pieces or buildings). Your king must come within ${ENGAGE_RANGE} squares of the enemy king or of one of its pieces; the troop marches there by itself.`,
      `Then a countdown: ${dur(COUNTDOWN_FIELD_MS)} in the field, ${dur(COUNTDOWN_SIEGE_MS)} if the defender's king stands among its buildings (a siege). The attacker can call it off during the countdown (its king then rests ${dur(CANCEL_COOLDOWN_MS)}, and the defender is protected for ${dur(CANCEL_PROTECT_MS)}).`,
      `Each side has ${dur(CLOCK_BASE_MS)} on its clock, plus ${CLOCK_INC_MS / 1000} seconds per move. The attacker plays White. Running out of time loses; stalemate and the usual chess draws are draws.`,
      `A player who isn't there has their side played by the computer, at their rating, after ${dur(AI_TAKEOVER_MS)}. (A game mostly played by the computer isn't rated.)`,
      'While a battle is on, its pieces are on the board, and nobody can enter the arena or attack either side.',
    ],
    tips: ['Look for checks, captures and threats every move. Your clock matters: don\'t spend two minutes on move three.', 'Attack when the defender is away from home: a field battle has a short countdown and no town to defend.'],
  },
  army: {
    title: 'Your army is who you bring',
    text: 'A side fights with the pieces near its king: at most one chess set.',
    fine: [
      `Each side fights with one legal chess set at most: ${set}. Missing pieces are simply missing.`,
      `The set is chosen from the pieces within ${REACH} squares of that side's king that aren't resting, nearest the arena first. Pieces beyond one set stay out as reserves.`,
      'A walled town (see Sieges) defends with pieces from 14 squares instead of 10.',
      'Strength is material: pawn 1, knight 3, bishop 3, elephant 5, queen 9. The Chronicle and camps size things by it.',
    ],
    tips: ['Before attacking, gather a full set around your king: two elephants and a queen win more games than twelve pawns. Keep extra pieces a little away if you don\'t want them captured as reserves.'],
  },
  stakes: {
    title: 'What a battle costs',
    text: 'The loser\'s king falls, its fighters flee, and the pieces it held nearby join the winner.',
    fine: [
      'Captured pieces die. Pieces that survive the board walk back into the world.',
      'The losing king is removed. Its surviving fighters flee toward their nearest king (routed: they can\'t be ordered until they get home).',
      'The loser\'s reserves (its other pieces within reach of the fallen king) join the winner. A new player\'s starting pieces, and all the pieces of an account under two hours old, perish instead of joining.',
      'Buildings within reach of the fallen king that no other king of the loser holds go to the winner (in a siege, that\'s the town).',
      'Lose to a wild camp and the pieces near you scatter as masterless (see Masterless), not to the camp.',
      'Through chapter 3, a king beaten by a wild camp isn\'t killed: it retreats, wounded, to try again.',
      'If the loser\'s king was the Emperor, the empire falls (see The Emperor).',
      'A draw: pieces captured on the board still die, but no king falls and nothing changes hands; both sides rest half as long.',
    ],
    tips: ['Only bring the pieces you mean to risk: every reserve standing near your king is a prize if you lose.'],
  },
  cooldown: {
    title: 'Rest after battle',
    text: 'Pieces that fought must rest before they fight again.',
    fine: [
      `After a battle, the pieces that fought rest for at least ${dur(MIN_BATTLE_COOLDOWN_MS)}; longer for each piece lost, by how long your buildings take to replace it (a lost knight adds a stable's piece time, divided by how many stables you have; with none, doubled).`,
      'The winning king is protected from attack while it rests. After a draw, both sides rest half as long.',
      'Resting pieces can move but don\'t join battles (they don\'t count in your set).',
    ],
    tips: ['Win cheaply: every piece you lose lengthens your whole army\'s rest.'],
  },
  wilds: {
    title: 'The wilds',
    text: 'Camps of creatures live in the wild. Beat their king to scatter them and take their hoard.',
    fine: [
      'There are 32 factions, from goblins and stag herds to the Dragon Brood; rare ones live in rare lands. Each camp is a creature army with a king.',
      'Camps grow toward a full set as time passes and as empires build nearby (up to 16 pieces, bigger near strong players). Camps rate by their land (see The land has a rating).',
      'Herds never attack. Lairs attack troops that come within 8 squares; hordes within 13, every few minutes. They never attack an Emperor, a king at home among its buildings, or a newly shielded player.',
      'Beat a camp\'s king and the camp scatters: its pieces vanish (creatures never join you), and a hoard of wood, grain, stone or ore is left where it stood, bigger for bigger and rarer camps. The site stays empty for a few hours.',
      'Every new empire gets a small band of its own nearby (weaker than its starting pieces, and it never grows).',
    ],
    tips: ['Hunt camps a little weaker than your army, and hunt them young. A hoard of ore is a palace site ready-made.'],
  },
  troops: {
    title: 'Troops',
    text: 'Pieces you send out of your cities hold where you sent them, together, as a troop.',
    fine: [
      `A move, an attack or a Stop that leaves pieces more than ${TROOP_CITY_R} squares from any of your buildings makes them a troop. They stay at that spot (its post) instead of drifting home, with or without a king.`,
      'Move the whole troop and the troop moves. Move only some of its pieces and they split off: out of your cities they form a new troop; into a city they are simply home.',
      `With a troop selected, + on a kind calls the nearest piece of that kind out to it. It shows as on its way (a gold trail) and joins once it is within ${TROOP_JOIN_R} squares. If it hasn't arrived after ${dur(TROOP_JOIN_MIN_MS)} (longer for a longer walk), it is dropped and walks home. Your Emperor is never called out this way.`,
      `A member left more than ${TROOP_LEASH} squares from its post while not marching or fighting (say, after a lost raid) leaves the troop and walks back to your nearest city. Pieces that flee a lost battle leave it too.`,
      'Called home (a troop\'s Home button, or Call all home in the Troops panel), a troop marches to a city and disbands there. So does a troop whose post becomes part of your city, such as a town it just took.',
      'Knights paving and elephants clearing leave their troops: a work crew is not a troop.',
    ],
    tips: ['Park a small troop near a camp you mean to hunt, then call a knight or two out to it when you are ready: the army is already in place.', 'Keep kings home to hold your towns; send troops out. A troop without a king can raid the wilds, but it can be attacked by other empires too.'],
  },
  raids: {
    title: 'Raids and troops without a king',
    text: 'Any troop with a pawn can raid a wild camp without a king: a pawn commands.',
    fine: [
      'To attack a wild camp, a troop needs a king or at least one pawn. Without a king, the pawn nearest the camp commands, fighting as the king for that battle only (shown as a gold ghost king).',
      'If a raid fails, only the commander pawn falls; the rest walk home. Nothing converts.',
      'A troop without a king can be attacked by another empire: its nearest pawn defends as commander. If it loses, the usual costs apply (fighters flee, reserves change hands).',
      'Attacking another empire always needs a real king.',
    ],
    tips: ['Send a knight-and-pawn raiding party at small camps while your kings stay home holding your towns.'],
  },
  masterless: {
    title: 'Masterless pieces and ruins',
    text: 'Pieces and buildings that belong to no one can be claimed by any king that comes near.',
    fine: [
      `Pieces become masterless when a fallen empire scatters or a wild camp beats an army. A king within ${CLAIM_RANGE} squares claims them. Unclaimed, they vanish after ${dur(MASTERLESS_MS)}.`,
      `Buildings become masterless when their empire falls. A king within ${REACH} squares claims them. Unclaimed, they fall to ruin after ${dur(MASTERLESS_MS)}.`,
      'A guest who leaves without signing in loses their empire after a short while: everything becomes masterless.',
    ],
    tips: ['When a neighbor falls, march a king through their old town: their buildings and pieces are yours for the taking.'],
  },
  // ================= settlements =================
  settlements: {
    title: 'Settlements',
    text: 'Buildings close together make a settlement: 3 a village, 6 a town, 10 a city.',
    fine: [
      'Your buildings within about 8 squares of each other form one settlement, named by the land. 1–2 buildings: a hamlet; 3–5: a village; 6–9: a town; 10+: a city.',
      'A bigger settlement holds itself longer without a king (see Holding a town), spreads wider settled ground, and grows grander: wells, stalls, lamps, bell towers, fountains; its trees and rock become gardens and statues.',
      'Resources inside a settlement stay the same resources: only their look changes.',
    ],
    tips: ['One strong town beats three hamlets: it holds itself for hours while your kings are away.'],
  },
  hold: {
    title: 'Holding a town',
    text: 'A settlement keeps working a while without a king: the bigger, the longer.',
    fine: [
      `A hamlet ${dur(HOLD_MS[1])}, a village ${dur(HOLD_MS[2])}, a town ${dur(HOLD_MS[3])}, a city ${dur(HOLD_MS[4])}, your capital forever (after a ${dur(ANCHOR_GRACE_MS)} grace).`,
      'After that it stops, and decays only if none of your pieces are home. See Leading a king away.',
    ],
  },
  crowns: {
    title: 'Kings are scarce',
    text: 'Kings are made in palaces, each slower than the last; your title caps how many you hold.',
    fine: [
      `A palace (after chapter 4) needs ore and rock beside it. It makes a king in ${dur(BUILDINGS.palace.baseMs)} on ordinary land, × (1 + ${KING_TIME_PER_KING} × the kings you have): the more kings, the slower.`,
      'Your first palace king comes twice as fast; a capital crowns 25% faster. At your title\'s king limit, a palace makes queens instead.',
      `Titles and their king limits: ${TITLES.map((t) => `${t.name} ${t.kingCap}`).join(', ')}. Titles come from finishing Chronicle chapters; many chapters also crown a king for you.`,
      'You can also seize a crown by checkmating a rival\'s Emperor.',
    ],
    tips: ['Every king is a new town, a new army and more room: getting your first palace up early pays for the whole game.'],
  },
  ore: {
    title: 'Ore is precious',
    text: 'Temples and palaces work ore, and ore never grows back.',
    fine: ['Ore is rare and finite; each vein holds a fixed amount. Temples use 15 per bishop, palaces 40 per king or queen.', 'Richer land has more ore, and more of it per vein.', 'Scattered camps near ore leave ore hoards.'],
    tips: ['Claim ore early and hold it with a king. When a vein runs dry, move on: a new town by fresh ore is worth the march.'],
  },
  trade: {
    title: 'Trade',
    text: 'Two of your towns near each other send merchants between them, and both work faster.',
    fine: ['About one pawn in six in an empire with more than one town becomes a merchant, walking between towns up to 80 squares apart.', 'With Trade (chapter 6), each town linked by a merchant in the last half hour works 15% faster (up to +30%).'],
    tips: ['Keep your towns within a merchant\'s walk of each other, and pave the road between them.'],
  },
  // ================= city building =================
  citybuilding: {
    title: 'Building your town your way',
    text: 'Put buildings anywhere near a king, move or demolish them, and draw streets, walls, bridges and gardens.',
    fine: [
      'Buildings go anywhere within reach of one of your kings. A producer with nothing to draw from nearby (no crops for a house, no ore for a temple) still stands and counts for your town; it just makes nothing until it has its resource. The ghost turns amber to warn you.',
      'Move (a building\'s panel): it is rebuilt free at the new spot, out of action while it goes up again. Demolish: it is torn down and half its wood and stone are left beside it as piles. Not during a battle at that town. Altars and the Wonder stay put.',
      'Streets and squares are free, on your own town ground. A wider brush lays a square. A street across water is a bridge (10 wood a square), which anyone can walk on. A street through your wall, fence or hedge is a gate.',
      'Decorations (walls, fences, hedges, flowerbeds, lamps, benches, banners, planters, wells, stalls, statues, fountains, taverns) cost a little wood or stone from nearby. They never count toward your town\'s tier, the building caps, production or room.',
      `You may hold ${DECOR_BASE} decorations and plantings, plus ${DECOR_PER_BUILDING} for each real building (at most ${DECOR_CAP}). Decorations with none of your buildings within ${DECOR_CLEAR_R} squares are cleared.`,
      `Plant a field (${PLANT_FIELD_COST} wood; it fills in over ${dur(PLANT_FIELD_MS)}) or a sapling (free; a tree in ${dur(PLANT_TREE_MS)}) in reach of a king. They become ordinary crops and woods. Rock and ore can't be planted.`,
      'Walls, fences, hedges, wells, statues, stalls and taverns block walking; flowerbeds, streets and bridges don\'t.',
    ],
    tips: ['Plant a field beside a house you placed for looks, and it starts making pawns.', 'A wall with one gate funnels raiders onto your street.'],
  },
  hauling: {
    title: 'Elephants haul stone and ore',
    text: 'Select only war elephants, tap Haul, tap a rock or ore deposit, then tap where to set it down.',
    fine: [
      `Each elephant lifts up to ${HAUL_LOAD} at a time, walks it to the spot (within reach of one of your kings), and sets it down as a pile, then goes back until the deposit is spent. Up to ${CLEAR_CREW} elephants per order.`,
      'The load rides on the elephant. Any new order, or a battle, takes it off the job, and it sets its load down where it stands, as a pile anyone nearby can use.',
      'Piles are ordinary resources: buildings in reach build with them, and a pile of ore or rock beside a temple, barracks or palace feeds it.',
    ],
    tips: ['Carry ore and stone together to found a palace where you want it.'],
  },
  // ================= works =================
  clearing: {
    title: 'Elephants clear land',
    text: 'Select only war elephants, tap Clear land, and drag over the area.',
    fine: [
      `Up to ${CLEAR_CREW} elephants per order, over up to ${CLEAR_MAX}×${CLEAR_MAX} squares. Each takes the nearest thing left, works it down, and moves on.`,
      `Work per spot, for one elephant: a tree ${CLEAR_TURNS.tree} turns, rock ${CLEAR_TURNS.rock}, ore ${CLEAR_TURNS.ore}. Rock and ore are only broken if you tick the box (they never grow back).`,
      'Felled trees are dug out for good (no stump). Hoards and land near other empires are never cleared.',
      'Any new order takes an elephant off the job; what\'s done stays done. Elephants marching with a troop also clear trees in its way.',
    ],
    tips: ['Clear building sites and roads, not the forest your houses need for wood.'],
  },
  paving: {
    title: 'Knights pave roads',
    text: 'Select only knights, tap Pave, then tap where the road should go.',
    fine: [
      `Up to ${PAVE_CREW} knights per order; the road can be up to ${PAVE_MAX} squares, from where they stand to where you tap. It costs nothing but their time: ${PAVE_TURNS} turns per square each.`,
      'The road is split between them so they finish together; more knights finish sooner (2 about 1.7×, 4 about 2.4×, 8 about 3.2× as fast).',
      'A paved square never wears away. A troop whose lead stands on a paved road moves about 1.5× as fast. With Roads (chapter 7), busy footpaths count as roads too.',
    ],
    tips: ['Pave between your towns and toward the frontier: every march down the road afterwards is half again as fast.'],
  },
  altars: {
    title: 'Altars',
    text: 'A bishop raises an altar anywhere; while a bishop tends it, a few buildings nearby work without a king.',
    fine: [
      `A bishop within ${ALTAR_TEND} squares raises it (free; opens with temples). You can hold ${ALTARS_PER_PLAYER}, at least 11 squares apart.`,
      `While a bishop of yours stands within ${ALTAR_TEND} squares, up to ${ALTAR_BUILDINGS} houses, stables or temples within ${ALTAR_REACH} squares work without a king, at ${Math.round(ALTAR_RATE * 100)}% speed. They add no room for pieces.`,
      'An altar is attacked like a troop without a king (its bishop defends as commander). If it loses to an empire, the altar falls to ruin and its buildings become masterless.',
    ],
    tips: ['Put an altar on a rich field far from your towns: a free farm, as long as you can defend its bishop.'],
  },
  // ================= the wider world =================
  rivals: {
    title: 'Rival empires',
    text: 'Other players are empires too. Beat their kings and you take what those kings held.',
    fine: [
      `New players are shielded for ${dur(SPAWN_SHIELD_MS)} while they stay in gentle land (rated 1050 or less): no empire can attack them. Attacking an empire ends your own shield.`,
      'Bots are empires too, played by the computer.',
      `Beat a rival's king: its reserves join you and its buildings (in a siege) are yours. Checkmate their Emperor and their empire falls, and you seize a crown. Accounts under ${dur(FRESH_ACCOUNT_MS)} old give up no pieces or crowns.`,
    ],
    tips: ['Scout before you attack: count the pieces near their king. Strike troops caught away from home; besiege towns only with a full set.'],
  },
  land: {
    title: 'The land has a rating',
    text: 'Every place has an Elo rating. Richer land works faster and holds stronger camps and neighbors.',
    fine: [
      'The land starts from a generated map, then takes on the ratings of the empires that live on it (recomputed every 30 seconds).',
      'Production speed follows the land: 1 + (rating − 1000) / 2000, between 0.7× and 1.9×. Resources there are bigger too.',
      'Camps are rated by their land (plus a step for rarer factions), and rarer factions only appear in higher-rated land.',
      'New players start in gentle land near other empires. The minimap has an Elo layer.',
    ],
    tips: ['Move up as you get stronger: a town in rich land out-produces two in poor land.'],
  },
  ratings: {
    title: 'Your rating',
    text: 'Your Elo rating goes up when you win battles and down when you lose, as on chess.com.',
    fine: [
      'Battles against players, bots and wild camps are rated with the Glicko system (as chess.com does). New players start at 1000 and move fast; ratings settle after about 20 games.',
      'A "?" after your rating means it\'s still provisional. Practice battles, games under 2 moves, and games mostly played by the computer aren\'t rated.',
      'Time away makes your rating less certain again, so it moves faster when you return.',
    ],
  },
  promotion: {
    title: 'Promotion is borrowed',
    text: 'A pawn that reaches the far rank fights as a queen for that battle, then walks home a pawn.',
    fine: ['Promotion works as in chess (you choose the piece); the promoted piece is shown in ghostly armor.', 'When the battle ends, it\'s a pawn again in the world. Promoting counts for the Chronicle and some feats.'],
    tips: ['Promotion wins endgames: push passed pawns when the pieces come off.'],
  },
  siege: {
    title: 'Sieges and walls',
    text: 'Attacking a king in its town is a siege: win, and the town\'s buildings are yours.',
    fine: [
      `A siege is any attack on a king standing among its buildings: a ${dur(COUNTDOWN_SIEGE_MS)} countdown instead of ${dur(COUNTDOWN_FIELD_MS)}.`,
      'A town that has survived a siege raises walls (palisade, then stone, then towers, as it survives more). With Walls (chapter 10), a walled town defends with pieces from 14 squares instead of 10.',
      'Win a siege and the buildings only that king held become yours, walls and tier included.',
    ],
    tips: ['Besiege with more than you think you need: the defender fields its whole nearby garrison.'],
  },
  hoards: {
    title: 'Hoards and captives',
    text: 'A scattered camp leaves a hoard; raider camps hold captives who join you when freed.',
    fine: ['A hoard is a rich resource cache where the camp stood: timber, grain, cut stone or treasure (ore), bigger for bigger and rarer camps. It never regrows.', 'Raider camps (bandits and the like) hold captive pieces. Beat them and the captives join you.', `Renown for camps: common ${RENOWN.common}, uncommon ${RENOWN.uncommon}, rare ${RENOWN.rare}, legendary ${RENOWN.legendary}.`],
    tips: ['Build a palace on an ore hoard: it\'s a ready-made vein.'],
  },
  relics: {
    title: 'Relics',
    text: 'The rarest beasts leave relics that stand in your capital and speed it.',
    fine: ['Rare and legendary factions leave a relic when scattered (the Dragon\'s Skull, the Sphinx\'s Head and more).', 'Each relic speeds your capital by 10% (up to +50%), and they stand in its square for everyone to see.'],
  },
  capital: {
    title: 'Your capital',
    text: 'Name one town your capital: it holds itself forever and crowns faster.',
    fine: ['After chapter 11, name any of your towns the capital (from a building\'s details). It holds itself without a king forever, crowns kings 25% faster, displays your relics, and is where your Wonder must stand.'],
  },
  wonder: {
    title: 'The Wonder',
    text: 'One per empire, in your capital: a monument the whole world can see.',
    fine: ['Opens after chapter 14. It costs 400 wood, 400 stone and 150 ore, takes 30 minutes to raise, makes nothing, and speeds its town by 25%.', 'It shows on everyone\'s far map.'],
  },
  titles: {
    title: 'Renown and titles',
    text: 'Quests, hunts and victories earn Renown; chapters earn titles.',
    fine: [
      `Titles, in order: ${TITLES.map((t) => t.name).join(', ')}. Each raises your king limit and your pawn room per king.`,
      'Renown comes from every quest step and side quest, from scattering camps, and from beating empires (sieges most). It shows your standing.',
      'Side quests are offered every 12 minutes of play from chapter 2 (at most three at once); accept or decline them in the Chronicle. Declined ones come back later.',
    ],
  },
};
