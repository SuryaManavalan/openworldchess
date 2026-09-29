// The Chronicle (docs/specs/campaign.md): the 15-hour campaign as data.
// Chapters are quests made of steps from one small vocabulary of verbs; the
// server checks them from events it already produces, and the client renders
// them. Nothing here is code that runs rules: it's what the rules read.
import type { BuildingType, PieceKind } from './constants.ts';

/** Titles are the power ladder (campaign.md §4.1). */
export interface Title { name: string; kingCap: number; /** Extra population each king supports. */ popPerKing: number }
export const TITLES: Title[] = [
  { name: 'Settler', kingCap: 2, popPerKing: 0 },
  { name: 'Chieftain', kingCap: 2, popPerKing: 0 },
  { name: 'Warden', kingCap: 3, popPerKing: 2 },
  { name: 'Lord', kingCap: 3, popPerKing: 2 },
  { name: 'Baron', kingCap: 4, popPerKing: 4 },
  { name: 'Count', kingCap: 5, popPerKing: 4 },
  { name: 'Duke', kingCap: 6, popPerKing: 6 },
  { name: 'Prince', kingCap: 8, popPerKing: 6 },
  { name: 'King', kingCap: 12, popPerKing: 8 },
  { name: 'High King', kingCap: 20, popPerKing: 10 },
];

/** Abilities opened by chapters (campaign.md §4). */
export type Ability = 'regents' | 'trade' | 'roads' | 'cartography' | 'walls' | 'capital' | 'muster' | 'wonder';

/** A quest step: one verb, its parameters, a count, and the Chronicle's line. */
/**
 * Every step can name the lessons it teaches (`teach`, ids in lessons.ts): the help card
 * explains them, and the Chronicle's book keeps them. That is where rules are taught.
 */
export type Step = StepGoal & { teach?: string[] };
type StepGoal =
  | { verb: 'build'; type: BuildingType; count: number; line: string }
  | { verb: 'grow'; tier: 2 | 3 | 4; line: string }
  | { verb: 'raise'; kind: PieceKind; count: number; line: string }
  | { verb: 'march'; dist: number; line: string }
  | { verb: 'hunt'; count: number; temper?: 'herd' | 'lair' | 'horde'; minSize?: number; rare?: boolean; inRareLand?: boolean; line: string }
  | { verb: 'free'; count: number; line: string }
  | { verb: 'settle'; minDist?: number; eloAbove?: number; line: string }
  | { verb: 'link'; count: number; line: string }
  | { verb: 'discover'; line: string }
  | { verb: 'win'; count: number; vsEmpire?: boolean; siege?: boolean; line: string }
  | { verb: 'promote'; count: number; line: string }
  | { verb: 'crown'; count: number; line: string }
  /** Look upon the camp the Chronicle marks, with a king (not the Emperor). */
  | { verb: 'scout'; line: string }
  /** Trees felled by your elephants' Clear land. */
  | { verb: 'clear'; count: number; line: string }
  /** Squares paved by your knights. */
  | { verb: 'pave'; count: number; line: string };

export interface Chapter {
  n: number;
  act: string;
  name: string;
  /** The Chronicle's opening line. */
  intro: string;
  /** The story so far, told when the chapter opens (a few sentences). */
  story?: string;
  steps: Step[];
  /** Given when the chapter begins (a king to found the second city with). */
  gift?: { coronation?: boolean };
  /** Granted when it's complete. */
  reward: { title?: number; coronation?: boolean; pieces?: PieceKind[]; buildings?: BuildingType[]; abilities?: Ability[] };
  /** What the unlock ceremony calls the new thing ("Stables: knights and their L-hops"). */
  opens: string;
}

export const CHAPTERS: Chapter[] = [
  // ---- Act I: Hearth. The basics: the Emperor, kings, reach, buildings, pieces, a first battle. ----
  {
    n: 1, act: 'Hearth', name: 'Hearth', intro: 'An empty square, a loyal king, four pawns and a field. Every empire begins with a roof.',
    story: 'Long ago the First Empire covered the whole Board, until the wilds swallowed it and its crowns were scattered. You carry one of those crowns. While your Emperor lives, your empire lives.',
    steps: [
      { verb: 'build', type: 'house', count: 1, line: 'Raise a house beside the crops. Your Emperor and your king hold this ground together.', teach: ['emperor', 'reach', 'resources', 'construction'] },
      { verb: 'raise', kind: 'P', count: 3, line: 'The house raises pawns on its own. Three pawns, and your people are a people.', teach: ['production', 'population', 'bubbles'] },
      { verb: 'scout', line: 'Smoke rises from the wilds nearby. Send your king (never your Emperor) to see who camps there.', teach: ['kings', 'away', 'pieces'] },
    ],
    reward: { title: 1, buildings: ['stable'] }, opens: 'Stables: knights, who leap in L-shapes',
  },
  {
    n: 2, act: 'Hearth', name: 'First Hunt', intro: 'The camp is young and hungry. Strike before it grows.',
    story: 'The wilds that swallowed the First Empire are waking. Their camps grow as your empire grows, so the time to strike is now, while they are small.',
    steps: [
      { verb: 'raise', kind: 'N', count: 1, line: 'A knight rides where pawns cannot. Raise one in your stable.' , teach: ['army', 'titles'] },
      { verb: 'hunt', count: 1, line: "Lead your king's army against the camp you found, and win the game." , teach: ['battle', 'stakes', 'wilds'] },
    ],
    reward: { pieces: ['N'] }, opens: 'Spoils: every camp you clear leaves a hoard behind',
  },
  {
    n: 3, act: 'Hearth', name: 'Village', intro: 'Three roofs make a village, and a village remembers its king.',
    story: 'A hamlet dies the day its king walks away. A village can wait for him. Build until your hearth can stand on its own.',
    steps: [
      { verb: 'grow', tier: 2, line: 'Build until your hearth is a village: three buildings close together.', teach: ['settlements', 'hold'] },
      { verb: 'raise', kind: 'N', count: 2, line: 'Raise two more knights to ride the village bounds.' , teach: ['cooldown', 'ratings'] },
    ],
    reward: { title: 2, buildings: ['temple'] }, opens: 'Temples: bishops. And villages now hold themselves for an hour without a king',
  },
  // ---- Act II: Realm. More crowns, more towns: kings are scarce, ore is precious. ----
  {
    n: 4, act: 'Realm', name: 'The Second Crown', intro: 'A crown without land is only metal.',
    gift: { coronation: true },
    story: 'In the ruins of the First Empire, the Chronicle has found a second crown, and it has chosen a king. A king holds only the land around him: give him land of his own.',
    steps: [
      { verb: 'settle', minDist: 25, line: 'Lead your new king 25 squares out and found a second settlement. Its buildings will need him.' , teach: ['buildcap'] },
      { verb: 'raise', kind: 'B', count: 1, line: 'Temples work ore. Raise a bishop, who sees along the diagonals.', teach: ['ore'] },
    ],
    reward: { title: 3, buildings: ['barracks', 'palace'] }, opens: 'Barracks and palaces: war elephants, and a seat to crown kings',
  },
  {
    n: 5, act: 'Realm', name: 'Crown of Stone', intro: 'Crowns can be found. Kings must be made, in stone, beside ore.',
    story: 'Two crowns will not hold a realm. The First Empire made its kings in palaces of stone and ore; so will you. But every king you make is harder won than the last.',
    steps: [
      { verb: 'build', type: 'palace', count: 1, line: 'Build a palace where ore meets rock (the Chronicle marks a site).', teach: ['crowns'] },
      { verb: 'crown', count: 1, line: 'Crown a king in your palace. The first comes quickly.' },
    ],
    reward: { title: 4, abilities: ['regents'] }, opens: 'Regents: a queen holds a city as a king would',
  },
  {
    n: 6, act: 'Realm', name: 'Trade Winds', intro: 'Your towns are strong apart. Together they are wealthy.',
    story: 'Merchants walk where kings have made the roads safe. And where the forest presses in, the great beasts of the barracks can push it back.',
    steps: [
      { verb: 'link', count: 1, line: 'Let a merchant walk between two of your towns.', teach: ['trade'] },
      { verb: 'raise', kind: 'R', count: 1, line: 'Raise a war elephant in a barracks.' },
      { verb: 'clear', count: 8, line: 'The woods press close. Set your elephants to clear eight trees.', teach: ['clearing'] },
    ],
    reward: { coronation: true, abilities: ['trade'] }, opens: 'Trade: towns linked by merchants produce 15% faster',
  },
  // ---- Act III: Frontier. The wide world: roads, lairs, strange lands, outposts. ----
  {
    n: 7, act: 'Frontier', name: 'Roads Beyond', intro: 'Past the last field, the map is blank. Fill it.',
    story: 'The First Empire was bound together by roads of stone. Lay the first stones of your own, then follow them out into the blank.',
    steps: [
      { verb: 'pave', count: 12, line: 'Knights lay stone. Pave twelve squares of road out from your town.', teach: ['paving'] },
      { verb: 'march', dist: 150, line: 'Send an expedition 150 squares out, down your road and beyond.' },
      { verb: 'hunt', count: 2, line: 'Clear two camps on the frontier.' , teach: ['raids'] },
    ],
    reward: { title: 5, abilities: ['roads', 'cartography'] }, opens: 'Roads speed marches, and your map remembers camps and rivals',
  },
  {
    n: 8, act: 'Frontier', name: 'The Lairs', intro: 'Some beasts do not wander. They wait.',
    story: 'The old lairs never moved when the First Empire fell; they only grew. And the raiders keep what they take, prisoners too.',
    steps: [
      { verb: 'hunt', count: 1, temper: 'lair', line: 'Clear a lair: wolves, kobolds, owlbears.' },
      { verb: 'free', count: 1, line: 'Free prisoners from a raider camp.' , teach: ['hoards'] },
    ],
    reward: { coronation: true }, opens: 'Captives: raiders hold prisoners who will join you',
  },
  {
    n: 9, act: 'Frontier', name: 'Strange Lands', intro: 'There are places where the grass is silver and the rivers burn.',
    story: 'Where the First Empire fell hardest, the land itself changed. Its strange places hold the rarest beasts, and room for an outpost no king could hold.',
    steps: [
      { verb: 'discover', line: 'Find a rare land: blossom, mushroom, blight, fey, crystal or ash.' },
      { verb: 'hunt', count: 1, inRareLand: true, line: 'Clear a camp in a rare land.' , teach: ['relics'] },
      { verb: 'build', type: 'altar', count: 1, line: 'Raise an altar: a bishop keeps an outpost far from any king.', teach: ['altars'] },
    ],
    reward: {}, opens: 'Relics: rare camps leave trophies for your capital',
  },
  // ---- Act IV: Dominion. Other crowns: rivals, rich land, the deep wilds. ----
  {
    n: 10, act: 'Dominion', name: 'Rivals', intro: 'You are not the only crown on this board.',
    story: 'Other crowns survived the fall, and other hands carry them. Every one of them wants the whole Board back.',
    steps: [{ verb: 'win', count: 1, vsEmpire: true, line: 'Win a battle against another empire.' , teach: ['rivals', 'ratings', 'masterless'] }],
    reward: { title: 6, coronation: true, abilities: ['walls'] }, opens: 'Walls muster: a walled town defends with its whole garrison',
  },
  {
    n: 11, act: 'Dominion', name: 'The Rich Lands', intro: 'Stronger lands, richer veins, harder neighbors.',
    story: 'The land remembers who lives on it. Where the strong settle, the ground grows rich, and the beasts grow bold.',
    steps: [{ verb: 'settle', eloAbove: 150, line: 'Found a town in land rated 150 above your home.', teach: ['land'] }],
    reward: { abilities: ['capital'] }, opens: 'Capital: name one town that holds itself forever and crowns faster',
  },
  {
    n: 12, act: 'Dominion', name: 'The Deep Wilds', intro: 'The old hordes field whole armies.',
    story: 'Deep in the wilds, the hordes that broke the First Empire still march in full array. Meet them with a full army.',
    steps: [
      { verb: 'hunt', count: 1, minSize: 12, line: 'Beat a horde of 12 or more.' },
      { verb: 'promote', count: 1, line: 'Carry a pawn to the far rank in battle.', teach: ['promotion'] },
    ],
    reward: { title: 7, coronation: true, abilities: ['muster'] }, opens: 'Muster: one order gathers every piece near a king',
  },
  // ---- Act V: Legacy. What outlasts you. ----
  {
    n: 13, act: 'Legacy', name: 'Siegecraft', intro: 'Walls fall to those who bring enough.',
    story: 'An empire is not made by holding. Take a rival town, king and walls and all.',
    steps: [{ verb: 'win', count: 1, siege: true, vsEmpire: true, line: 'Win a siege against another empire.', teach: ['siege'] }],
    reward: { title: 8, coronation: true }, opens: 'Towns you take keep their walls and their standing',
  },
  {
    n: 14, act: 'Legacy', name: 'The Dragon', intro: 'On the ash plains, something old sleeps on gold.',
    story: 'The Chronicle knows now what ended the First Empire. It sleeps on the ash plains, on the gold of fallen kings.',
    steps: [{ verb: 'hunt', count: 4, rare: true, line: 'Hunt the great beasts: earn 4 trophies (uncommon camps 1, rare 2, a dragon 4).', teach: ['relics'] }],
    reward: { coronation: true, abilities: ['wonder'] }, opens: 'Wonders: raise one monument the whole world can see',
  },
  {
    n: 15, act: 'Legacy', name: 'Legacy', intro: 'What you build now will outlast every battle.',
    story: 'The First Empire is a ruin because it built nothing that could outlast it. Build what will.',
    steps: [
      { verb: 'grow', tier: 4, line: 'Grow your capital into a city (10 buildings).', teach: ['capital'] },
      { verb: 'build', type: 'wonder', count: 1, line: 'Raise your Wonder.', teach: ['wonder'] },
    ],
    reward: { title: 9 }, opens: 'The Epilogue: the world keeps offering quests',
  },
];

/** The lessons each kind of side quest teaches (lessons.ts), shown in its help card. */
export const SIDE_TEACH: Record<string, string[]> = {
  bounty: ['battle', 'army', 'wilds', 'hoards'], rescue: ['hoards', 'stakes'], skirmish: ['rivals', 'stakes', 'siege'],
  pilgrimage: ['clearing', 'altars', 'paving'], opening: ['battle'], feat: ['army', 'cooldown', 'promotion'],
  grow: ['settlements', 'hold'], scout: ['land', 'pieces'], shrine: ['battle'],
};

/** Side quests (campaign.md §5.3): short errands written from the world around you. */
export type SideKind = 'bounty' | 'rescue' | 'scout' | 'grow' | 'skirmish' | 'pilgrimage' | 'shrine' | 'opening' | 'feat';
export interface SideQuest {
  id: number;
  kind: SideKind;
  line: string;
  /** Where it points (a camp, a place). */
  at?: [number, number];
  /** Camp owner id for bounties and rescues. */
  camp?: string;
  /** Scout: the square to reach. Grow: the target tier. */
  tier?: number;
  renown: number;
  /** Also: extra pieces for the reward. */
  pieces?: PieceKind[];
  /**
   * Offered quests wait for you to accept or decline them; only accepted (active) ones
   * count progress (campaign.md §5.3). Older saves have no state: they're active.
   */
  state?: 'offered' | 'active';
  /** Progress to show, when the quest counts something: [have, need]. */
  progress?: [number, number];
  /** A quest in stages (the pilgrimage, campaign.md §5.3): which one you're on, of how many. */
  stage?: number;
  stages?: number;
  /** Pilgrimage: the grove to clear, [x0, y0, x1, y1], and how many trees stood in it. */
  area?: [number, number, number, number];
  trees?: number;
  /** Shrine (campaign.md §5.3): the riddle, once one of your pieces reaches the shrine. `fen` is where it stands now. */
  puzzle?: { fen: string; n: number; left: number };
  /** Opening or feat: which one (OPENINGS / FEATS). */
  challenge?: string;
}

/** The client's view of a player's Chronicle. */
export interface ChronicleView {
  chapter: number;
  step: number;
  /** Progress on the current step (count so far, count needed). */
  progress: [number, number];
  /** Where the current step points, if anywhere. */
  target?: [number, number];
  title: number;
  renown: number;
  abilities: Ability[];
  buildings: BuildingType[];
  sides: SideQuest[];
  relics: string[];
  capital?: [number, number];
  /** Chapters done (0 = on chapter 1). */
  done: number;
}

/** Renown by camp rarity (campaign.md §4.1). */
export const RENOWN = { common: 20, uncommon: 40, rare: 90, legendary: 250, empireWin: 60, siegeWin: 120 } as const;

/** Relic per rare/legendary faction (campaign.md §4.2). */
export const RELIC_OF: Record<string, string> = {
  dragons: 'dragon', mummies: 'sphinx', kitsune: 'kitsune', griffons: 'griffon', hags: 'hag',
  elementals: 'crystal', frost: 'frost', serpents: 'serpent',
};
export const RELIC_NAME: Record<string, string> = {
  dragon: "Dragon's Skull", sphinx: "Sphinx's Head", kitsune: 'Nine-Tail Idol', griffon: 'Griffon Totem',
  hag: "Hag's Cauldron", crystal: 'Crystal Crown', frost: "Jarl's Ice Axe", serpent: 'Serpent Idol',
};

/** Raider factions hold captives (campaign.md §4.2). */
export const RAIDERS = new Set(['bandits', 'orcs', 'goblins', 'gnolls', 'sahuagin', 'trolls']);

/** Settlement tiers by number of buildings (matches the client's). */
export const tierOfCount = (n: number) => (n >= 10 ? 4 : n >= 6 ? 3 : n >= 3 ? 2 : 1);
/** How long a settlement keeps producing with no king in reach, by tier (campaign.md §4.3). */
export const HOLD_MS: Record<number, number> = { 1: 10 * 60_000, 2: 60 * 60_000, 3: 4 * 60 * 60_000, 4: 12 * 60 * 60_000 };

/**
 * Opening challenges (campaign.md §5.3): win a battle having opened with these moves (as White,
 * among your first `within` moves, in any order). Only openings a normal army can play.
 */
export const OPENINGS: Record<string, { name: string; moves: string[]; within: number; who: string }> = {
  italian: { name: 'the Italian Game', moves: ['e4', 'Nf3', 'Bc4'], within: 3, who: 'The old masters of the south' },
  'queens-gambit': { name: "the Queen's Gambit", moves: ['d4', 'c4'], within: 2, who: 'The monks of the east' },
  london: { name: 'the London System', moves: ['d4', 'Bf4'], within: 3, who: 'A stubborn old general' },
  'kings-gambit': { name: "the King's Gambit", moves: ['e4', 'f4'], within: 2, who: 'The bards of the hill courts' },
  english: { name: 'the English Opening', moves: ['c4'], within: 1, who: 'Merchants from across the sea' },
  ruy: { name: 'the Ruy Lopez', moves: ['e4', 'Nf3', 'Bb5'], within: 3, who: 'A bishop of the western church' },
  bongcloud: { name: 'the Bongcloud', moves: ['e4', 'Ke2'], within: 2, who: 'A very confident jester' },
};

/** Feats (campaign.md §5.3): a win with a handicap, checked from the battle's moves. */
export const FEATS: Record<string, string> = {
  queenless: 'Win a battle without losing your queen',
  swift: 'Win a battle in 20 moves or fewer',
  promote: 'Win a battle after promoting a pawn',
  flawless: 'Win a battle losing no more than two pieces',
};
