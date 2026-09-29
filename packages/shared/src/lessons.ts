// Lessons (docs/specs/campaign.md §5.7): one entry per rule of the game, written for a
// player, with its numbers read from the rules themselves. Quest steps list the lessons they
// teach (`teach` in CHAPTERS); the help card and the Chronicle's book show them.
//
// To teach a new rule, or a changed one: edit or add a lesson here, and name it in the
// `teach` of the step where a player first meets it. Numbers come from the constants, so a
// changed constant changes the lesson with it.
import { ANCHOR_GRACE_MS, BUILDINGS, BUILDINGS_PER_KING, BUBBLE_MAX, CLEAR_TURNS, COUNTDOWN_FIELD_MS, COUNTDOWN_SIEGE_MS, ENGAGE_RANGE, KING_TIME_PER_KING, MIN_BATTLE_COOLDOWN_MS, PAVE_CREW, POP_HOUSES_COUNTED, POP_PAWNS_PER_HOUSE, POP_PAWNS_PER_KING, POP_PER_BUILDING, REACH, WORK_AREA, ALTAR_BUILDINGS, ALTAR_RATE, ALTAR_REACH } from './constants.ts';
import { HOLD_MS, TITLES } from './chronicle.ts';

export interface Lesson {
  /** A short name, like a chapter in a manual. */
  title: string;
  /** One or two sentences: the rule, and why it's so. */
  text: string;
}

const min = (ms: number) => (ms >= 3_600_000 ? `${Math.round(ms / 3_600_000)} hour${ms >= 7_200_000 ? 's' : ''}` : `${Math.round(ms / 60_000)} minutes`);
const secs = (ms: number) => `${Math.round(ms / 1000)} seconds`;

export const LESSONS: Record<string, Lesson> = {
  // ---- your crown ----
  emperor: { title: 'The Emperor', text: 'Your Emperor (the gold crown) is your empire itself. If it falls in battle, your whole empire scatters and you begin again somewhere new. Keep it home, and let your kings take the risks.' },
  kings: { title: 'Kings', text: 'Kings are your commanders. Every battle is fought king against king, so a troop needs a king to attack an empire. A fallen king is a loss; a fallen Emperor is the end.' },
  reach: { title: 'Reach', text: `Everything you build works only while one of your kings (or your Emperor) stands within ${REACH} squares of it. A king holds the land around it; that is what kings are for.` },
  away: { title: 'Leading a king away', text: `When a king walks off, the buildings it held keep working if another of your kings is within ${REACH} squares. If none is, they stop after ${secs(ANCHOR_GRACE_MS)}, and a lone hamlet starts to decay after ${min(HOLD_MS[1])}. Bigger settlements hold themselves longer.` },
  // ---- land and buildings ----
  resources: { title: 'Resources stay where they grow', text: `There is no stockpile. A building works the resource beside it (within ${WORK_AREA} squares): a house works crops, a stable crops, a temple ore, a barracks rock. Where you build is the whole strategy.` },
  construction: { title: 'Building', text: `A building's cost is taken from the trees and rock within ${REACH} squares of its site, and it rises on its own while a king is near. Trees regrow; rock and ore run out.` },
  production: { title: 'Production', text: 'Buildings make pieces on their own, one after another: houses pawns, stables knights, temples bishops, barracks war elephants, palaces kings and queens.' },
  population: { title: 'Room for pieces', text: `Each piece has its own room, set by the buildings near your kings: pawns ${POP_PAWNS_PER_KING} per king and ${POP_PAWNS_PER_HOUSE} per house (up to ${POP_HOUSES_COUNTED}), knights ${POP_PER_BUILDING.N?.n ?? 2} per stable, bishops ${POP_PER_BUILDING.B?.n ?? 2} per temple, elephants ${POP_PER_BUILDING.R?.n ?? 2} per barracks. A building pauses when its piece has no room.` },
  bubbles: { title: 'Hurry bubbles', text: `While you play, bubbles rise over your working buildings (up to ${BUBBLE_MAX} each). Pop one to push its piece along; pop them all and a building works about twice as fast. Gold ones are worth four.` },
  buildcap: { title: 'Each king holds a dozen', text: `A king can hold at most ${BUILDINGS_PER_KING} buildings. To build more, bring another king.` },
  // ---- pieces and war ----
  pieces: { title: 'Pieces in the world', text: 'Pieces walk the board as they move in chess: knights leap in L-shapes, bishops keep to their color, pawns trudge. Tap a king and its army is selected; tap the ground to march.' },
  battle: { title: 'Every battle is chess', text: `Attack an enemy king and, after a countdown (${secs(COUNTDOWN_FIELD_MS)} in the field, ${secs(COUNTDOWN_SIEGE_MS)} for a town), both sides play a real game of chess with a clock. Checkmate their king to win.` },
  army: { title: 'Your army is who you bring', text: `A side fights with the pieces near its king, at most one chess set: 8 pawns, 2 knights, 2 bishops, 2 elephants and a queen. You can attack from ${ENGAGE_RANGE} squares away. Bring the right pieces.` },
  stakes: { title: 'What a battle costs', text: 'Win, and the loser\'s king falls, its fighters flee, and the pieces it held nearby join you. Lose, and it happens to you. (Through chapter 3, a king beaten by the wilds only retreats wounded.)' },
  cooldown: { title: 'Rest after battle', text: `Pieces that fought need rest before they fight again: at least ${min(MIN_BATTLE_COOLDOWN_MS)}, more for the pieces you lost.` },
  wilds: { title: 'The wilds', text: 'Camps of creatures live in the wild. They grow as empires grow around them, and some raid troops that come close. Beat a camp\'s king and it scatters, leaving a hoard. Creatures never join you.' },
  // ---- settlements ----
  settlements: { title: 'Settlements', text: 'Buildings close together make a settlement: 3 a village, 6 a town, 10 a city. Bigger ones look grander and hold themselves longer without a king.' },
  hold: { title: 'Holding a town', text: `Without a king, a settlement keeps working for a while: a hamlet ${min(HOLD_MS[1])}, a village ${min(HOLD_MS[2])}, a town ${min(HOLD_MS[3])}, a city ${min(HOLD_MS[4])}. After that it stops, and decays if none of your pieces are home.` },
  crowns: { title: 'Kings are scarce', text: `A palace crowns kings, each one slower than the last (+${Math.round(KING_TIME_PER_KING * 100)}% time per king you have). Your title sets how many kings you may hold: ${TITLES[0].kingCap} for a ${TITLES[0].name}, more as you rise.` },
  ore: { title: 'Ore is precious', text: 'Temples and palaces work ore, and ore never grows back. A good vein is worth fighting for.' },
  trade: { title: 'Trade', text: 'Two of your towns close enough to each other send merchants between them. Linked towns work faster.' },
  // ---- works ----
  clearing: { title: 'Elephants clear land', text: `Select only war elephants and Clear land, then drag over an area: they fell trees (${CLEAR_TURNS.tree} turns each; rock and ore only if you ask). More elephants work faster.` },
  paving: { title: 'Knights pave roads', text: `Select only knights (up to ${PAVE_CREW}) and Pave, then tap where the road should go. Troops march about half again as fast on a paved road.` },
  altars: { title: 'Altars', text: `A bishop can raise an altar anywhere. While a bishop tends it, up to ${ALTAR_BUILDINGS} houses, stables or temples within ${ALTAR_REACH} squares work without a king, at ${Math.round(ALTAR_RATE * 100)}% speed.` },
  // ---- the wider world ----
  rivals: { title: 'Rival empires', text: 'Other players are empires too. New players are shielded for a while in gentle land. Beat a rival\'s king and you take the pieces it held; take a king in its town and the town is yours.' },
  land: { title: 'The land has a rating', text: 'Every square of land has an Elo rating, shaped by the empires living on it. Richer land works faster and holds rarer, stronger camps and stronger neighbors.' },
  promotion: { title: 'Promotion is borrowed', text: 'A pawn that reaches the far rank fights as a queen for the rest of that battle, then walks home a pawn.' },
  siege: { title: 'Sieges and walls', text: 'A town that survives a siege raises walls; with Walls, a walled town defends with its whole garrison. Take a king in its town, and the buildings it held are yours.' },
  relics: { title: 'Relics', text: 'The rarest beasts leave relics. Carried home, they stand in your capital for everyone to see, and speed its buildings.' },
  capital: { title: 'Your capital', text: 'Name one town your capital: it holds itself forever, crowns kings faster, and shows off your relics.' },
  wonder: { title: 'The Wonder', text: 'One per empire, in your capital: a monument the whole world can see.' },
};

