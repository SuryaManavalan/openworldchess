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
export type Step =
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
  | { verb: 'crown'; count: number; line: string };

export interface Chapter {
  n: number;
  act: string;
  name: string;
  /** The Chronicle's opening line. */
  intro: string;
  steps: Step[];
  /** Given when the chapter begins (a king to found the second city with). */
  gift?: { coronation?: boolean };
  /** Granted when it's complete. */
  reward: { title?: number; coronation?: boolean; pieces?: PieceKind[]; buildings?: BuildingType[]; abilities?: Ability[] };
  /** What the unlock ceremony calls the new thing ("Stables: knights and their L-hops"). */
  opens: string;
}

export const CHAPTERS: Chapter[] = [
  {
    n: 1, act: 'Hearth', name: 'Hearth', intro: 'Every empire begins with a roof and a field.',
    steps: [
      { verb: 'build', type: 'house', count: 1, line: 'Raise a house beside a field of crops.' },
      { verb: 'raise', kind: 'P', count: 3, line: 'Let the house raise three pawns.' },
      { verb: 'march', dist: 10, line: 'Lead your king out: march 10 squares from home.' },
    ],
    reward: { title: 1, buildings: ['stable'] }, opens: 'Stables: knights, who leap in L-shapes',
  },
  {
    n: 2, act: 'Hearth', name: 'First Hunt', intro: 'The wilds are close. They are also generous to the bold.',
    steps: [
      { verb: 'raise', kind: 'N', count: 1, line: 'Raise a knight in your stable.' },
      { verb: 'hunt', count: 1, line: 'Hunt the camp the Chronicle has marked.' },
    ],
    reward: { pieces: ['N'] }, opens: 'Spoils: every camp you clear leaves a hoard behind',
  },
  {
    n: 3, act: 'Hearth', name: 'Village', intro: 'A hamlet huddles; a village stands.',
    steps: [
      { verb: 'grow', tier: 2, line: 'Grow a settlement to a village (3 buildings).' },
      { verb: 'raise', kind: 'N', count: 2, line: 'Raise two more knights.' },
    ],
    reward: { title: 2, buildings: ['temple'] }, opens: 'Temples: bishops. And villages now hold themselves for an hour without a king',
  },
  {
    n: 4, act: 'Realm', name: 'The Second Crown', intro: 'A crown has been forged for you. Give it a kingdom.',
    gift: { coronation: true },
    steps: [
      { verb: 'settle', minDist: 25, line: 'Found a second settlement at least 25 squares from your first.' },
      { verb: 'raise', kind: 'B', count: 1, line: 'Raise a bishop in a temple.' },
    ],
    reward: { title: 3, buildings: ['barracks', 'palace'] }, opens: 'Barracks and palaces: war elephants, and a seat to crown kings',
  },
  {
    n: 5, act: 'Realm', name: 'Crown of Stone', intro: 'Kings are not found. They are made, in stone, beside ore.',
    steps: [
      { verb: 'build', type: 'palace', count: 1, line: 'Build a palace where ore meets rock (the Chronicle marks a site).' },
      { verb: 'crown', count: 1, line: 'Crown a king in your palace (your first comes quickly).' },
    ],
    reward: { title: 4, abilities: ['regents'] }, opens: 'Regents: a queen holds a city as a king would',
  },
  {
    n: 6, act: 'Realm', name: 'Trade Winds', intro: 'Two towns, one road, twice the wealth.',
    steps: [
      { verb: 'link', count: 1, line: 'Let a merchant carry goods between two of your towns.' },
      { verb: 'raise', kind: 'R', count: 1, line: 'Raise a war elephant in a barracks.' },
    ],
    reward: { coronation: true, abilities: ['trade'] }, opens: 'Trade: towns linked by merchants produce 15% faster',
  },
  {
    n: 7, act: 'Frontier', name: 'Roads Beyond', intro: 'Past the last field, the map is blank. Fill it.',
    steps: [
      { verb: 'march', dist: 150, line: 'Send an expedition 150 squares from home.' },
      { verb: 'hunt', count: 2, line: 'Clear two camps.' },
    ],
    reward: { title: 5, abilities: ['roads', 'cartography'] }, opens: 'Roads speed marches, and your map remembers camps and rivals',
  },
  {
    n: 8, act: 'Frontier', name: 'The Lairs', intro: 'Some beasts do not wander. They wait.',
    steps: [
      { verb: 'hunt', count: 1, temper: 'lair', line: 'Clear a lair: wolves, kobolds, owlbears.' },
      { verb: 'free', count: 1, line: 'Free prisoners from a raider camp.' },
    ],
    reward: { coronation: true }, opens: 'Captives: raiders hold prisoners who will join you',
  },
  {
    n: 9, act: 'Frontier', name: 'Strange Lands', intro: 'There are places where the grass is silver and the rivers burn.',
    steps: [
      { verb: 'discover', line: 'Find a rare land: blossom, mushroom, blight, fey, crystal or ash.' },
      { verb: 'hunt', count: 1, inRareLand: true, line: 'Clear a camp in a rare land.' },
    ],
    reward: {}, opens: 'Relics: rare camps leave trophies for your capital',
  },
  {
    n: 10, act: 'Dominion', name: 'Rivals', intro: 'You are not the only crown on this board.',
    steps: [{ verb: 'win', count: 1, vsEmpire: true, line: 'Win a battle against another empire.' }],
    reward: { title: 6, coronation: true, abilities: ['walls'] }, opens: 'Walls muster: a walled town defends with its whole garrison',
  },
  {
    n: 11, act: 'Dominion', name: 'The Rich Lands', intro: 'Stronger lands, richer veins, harder neighbors.',
    steps: [{ verb: 'settle', eloAbove: 150, line: 'Found a town in land rated 150 above your home.' }],
    reward: { abilities: ['capital'] }, opens: 'Capital: name one town that holds itself forever and crowns faster',
  },
  {
    n: 12, act: 'Dominion', name: 'The Deep Wilds', intro: 'The old hordes field whole armies.',
    steps: [
      { verb: 'hunt', count: 1, minSize: 12, line: 'Beat a horde of 12 or more.' },
      { verb: 'promote', count: 1, line: 'Carry a pawn to the far rank in battle.' },
    ],
    reward: { title: 7, coronation: true, abilities: ['muster'] }, opens: 'Muster: one order gathers every piece near a king',
  },
  {
    n: 13, act: 'Legacy', name: 'Siegecraft', intro: 'Walls fall to those who bring enough.',
    steps: [{ verb: 'win', count: 1, siege: true, vsEmpire: true, line: 'Win a siege against another empire.' }],
    reward: { title: 8, coronation: true }, opens: 'Towns you take keep their walls and their standing',
  },
  {
    n: 14, act: 'Legacy', name: 'The Dragon', intro: 'On the ash plains, something old sleeps on gold.',
    steps: [{ verb: 'hunt', count: 4, rare: true, line: 'Hunt the great beasts: earn 4 trophies (uncommon camps 1, rare 2, a dragon 4).' }],
    reward: { coronation: true, abilities: ['wonder'] }, opens: 'Wonders: raise one monument the whole world can see',
  },
  {
    n: 15, act: 'Legacy', name: 'Legacy', intro: 'What you build now will outlast every battle.',
    steps: [
      { verb: 'grow', tier: 4, line: 'Grow your capital into a city (10 buildings).' },
      { verb: 'build', type: 'wonder', count: 1, line: 'Raise your Wonder.' },
    ],
    reward: { title: 9 }, opens: 'The Epilogue: the world keeps offering quests',
  },
];

/** Side quests (campaign.md §5.3): short errands written from the world around you. */
export type SideKind = 'bounty' | 'rescue' | 'scout' | 'grow' | 'skirmish';
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
