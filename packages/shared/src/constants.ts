// Game constants. Every number here is traceable to a spec in docs/specs.
// Times are in milliseconds unless the name says otherwise.

/** One world turn (movement.md §1). 600ms = 100 BPM (visuals.md §1). */
export const TURN_MS = 600;
/** Server ticks per second (TECH.md T7). */
export const TICK_HZ = 10;

/** The one reach rule: buildings and pieces stay within this of a king (economy.md §2). */
export const REACH = 10;

// ---- Troops (movement.md §10) ----
/** A destination this close to one of your buildings is inside your city: pieces sent there are home. */
export const TROOP_CITY_R = 8;
/** A member left farther than this from its troop's post (and not marching or fighting) is sent home. */
export const TROOP_LEASH = 16;
/** A reinforcement joins its troop once it's this close to the post. */
export const TROOP_JOIN_R = 4;
/** A reinforcement has at least this long to reach its troop (more for a longer walk), or it's dropped. */
export const TROOP_JOIN_MIN_MS = 3 * 60_000;
/** A building's work area: nodes within this many squares of its footprint (economy.md §1). */
export const WORK_AREA = 3;
/** Attack range: king within this of the target king or its holdings (battle.md §2). */
export const ENGAGE_RANGE = 3;
/** Minimum distance from another player's building when placing (economy.md §2). */
export const BUILD_SPACING = 3;

export const COUNTDOWN_SIEGE_MS = 60_000;
export const COUNTDOWN_FIELD_MS = 15_000;
export const CANCEL_COOLDOWN_MS = 120_000;
export const MIN_BATTLE_COOLDOWN_MS = 120_000;
export const CLOCK_BASE_MS = 5 * 60_000;
export const CLOCK_INC_MS = 3_000;
/** Disconnect time before the AI takes over a battle (battle.md §5). */
export const AI_TAKEOVER_MS = 20_000;

export const ANCHOR_GRACE_MS = 60_000;
export const DECAY_EVERY_MS = 30_000;
export const BUILDING_MAX_HP = 100;

export const SPAWN_SHIELD_MS = 2 * 60 * 60_000;
export const MASTERLESS_MS = 2 * 60 * 60_000;
export const CLAIM_RANGE = 3;

export type PieceKind = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
export const PIECE_KINDS: PieceKind[] = ['K', 'Q', 'R', 'B', 'N', 'P'];
export const PIECE_NAME: Record<PieceKind, string> = {
  K: 'King', Q: 'Queen', R: 'Elephant', B: 'Bishop', N: 'Knight', P: 'Pawn',
};
/** Max of each kind in one battle set (battle.md §1). */
export const SET_COUNTS: Record<PieceKind, number> = { K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8 };
/** Material values used by bots and UI estimates. */
export const PIECE_VALUE: Record<PieceKind, number> = { K: 0, Q: 9, R: 5, B: 3, N: 3, P: 1 };

/** The most of each kind one side can bring to a battle (a legal chess set). */
export const SET_MAX: Record<PieceKind, number> = { K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8 };

/**
 * The material of the strongest legal set these pieces could field. A crowd of
 * forty pawns and knights still fights as eight pawns and two knights.
 */
export function setWorth(kinds: Iterable<PieceKind>): number {
  const n: Record<PieceKind, number> = { K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0 };
  for (const k of kinds) n[k]++;
  let w = 0;
  for (const k of ['Q', 'R', 'B', 'N', 'P'] as const) w += Math.min(n[k], SET_MAX[k]) * PIECE_VALUE[k];
  return w;
}

/** Decorations (citybuilding.md §4): drawn by players, no production, no tier, no anchor. */
export type DecorType = 'bridge' | 'wall' | 'fence' | 'hedge' | 'flowerbed' | 'lamp' | 'bench' | 'banner' | 'planter' | 'well' | 'stall' | 'statue' | 'fountain' | 'tavern';
export type BuildingType = 'palace' | 'house' | 'stable' | 'temple' | 'barracks' | 'wonder' | 'altar' | DecorType;
/** Resources. "ore" looks different in each biome (gold, silver, copper, gems) but is one resource. */
export type NodeKind = 'tree' | 'wheat' | 'rock' | 'ore';

export interface BuildingSpec {
  type: BuildingType;
  size: number;
  /** Construction cost, drawn from nodes within REACH of the site. */
  cost: Partial<Record<NodeKind, number>>;
  buildMs: number;
  /** Node kinds that must be in the work area (all of them). */
  needs: NodeKind[];
  /** Drawn per piece produced, from the work-area nodes. */
  draw: Partial<Record<NodeKind, number>>;
  produces: PieceKind[];
  /** Base production time at richness 1 (economy.md §3). */
  baseMs: number;
  /** A decoration (citybuilding.md §4): no production, tier, anchor or building cap. */
  decor?: true;
  /** Pieces may walk over it (a bridge, a flowerbed). */
  walk?: true;
  /** Placed on water (bridges), not land. */
  onWater?: true;
  /** Drawn as a line by dragging (walls, fences, hedges, bridges, flowerbeds). */
  line?: true;
}

export const BUILDINGS: Record<BuildingType, BuildingSpec> = {
  house: { type: 'house', size: 1, cost: { tree: 30 }, buildMs: 20_000, needs: ['wheat'], draw: { wheat: 5 }, produces: ['P'], baseMs: 60_000 },
  stable: { type: 'stable', size: 2, cost: { tree: 80 }, buildMs: 45_000, needs: ['wheat'], draw: { wheat: 20 }, produces: ['N'], baseMs: 240_000 },
  temple: { type: 'temple', size: 2, cost: { tree: 60, rock: 40 }, buildMs: 45_000, needs: ['ore'], draw: { ore: 15 }, produces: ['B'], baseMs: 240_000 },
  barracks: { type: 'barracks', size: 2, cost: { tree: 60, rock: 80 }, buildMs: 60_000, needs: ['rock'], draw: { rock: 30 }, produces: ['R'], baseMs: 300_000 },
  palace: { type: 'palace', size: 3, cost: { tree: 120, rock: 150 }, buildMs: 90_000, needs: ['ore', 'rock'], draw: { ore: 40, rock: 40 }, produces: ['K', 'Q'], baseMs: 1_200_000 },
  // The campaign's capstone (campaign.md §4.5): one per empire, in a city capital; it produces nothing, it lifts its town.
  // A bishop's altar (economy.md §8): raised anywhere by a bishop standing beside it; free, and it produces nothing.
  altar: { type: 'altar', size: 1, cost: {}, buildMs: 60_000, needs: [], draw: {}, produces: [], baseMs: 0 },
  wonder: { type: 'wonder', size: 3, cost: { tree: 400, rock: 400, ore: 150 }, buildMs: 30 * 60_000, needs: [], draw: {}, produces: [], baseMs: 0 },
  // Decorations (citybuilding.md §4).
  bridge: { type: 'bridge', size: 1, cost: { tree: 10 }, buildMs: 4_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true, walk: true, onWater: true, line: true },
  wall: { type: 'wall', size: 1, cost: { rock: 8 }, buildMs: 4_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true, line: true },
  fence: { type: 'fence', size: 1, cost: { tree: 3 }, buildMs: 2_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true, line: true },
  hedge: { type: 'hedge', size: 1, cost: { tree: 2 }, buildMs: 2_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true, line: true },
  flowerbed: { type: 'flowerbed', size: 1, cost: { tree: 2 }, buildMs: 2_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true, walk: true, line: true },
  lamp: { type: 'lamp', size: 1, cost: { tree: 3 }, buildMs: 2_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true },
  bench: { type: 'bench', size: 1, cost: { tree: 4 }, buildMs: 2_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true },
  banner: { type: 'banner', size: 1, cost: { tree: 4 }, buildMs: 2_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true },
  planter: { type: 'planter', size: 1, cost: { tree: 5 }, buildMs: 2_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true },
  well: { type: 'well', size: 1, cost: { rock: 12 }, buildMs: 6_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true },
  stall: { type: 'stall', size: 1, cost: { tree: 10 }, buildMs: 5_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true },
  statue: { type: 'statue', size: 1, cost: { rock: 25 }, buildMs: 10_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true },
  fountain: { type: 'fountain', size: 1, cost: { rock: 35 }, buildMs: 12_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true },
  tavern: { type: 'tavern', size: 2, cost: { tree: 40, rock: 15 }, buildMs: 30_000, needs: [], draw: {}, produces: [], baseMs: 0, decor: true },
};

/** Every decoration type, in palette order (citybuilding.md §4). */
export const DECOR_TYPES: DecorType[] = ['bridge', 'wall', 'fence', 'hedge', 'flowerbed', 'lamp', 'bench', 'banner', 'planter', 'well', 'stall', 'statue', 'fountain', 'tavern'];
export const isDecor = (t: string): t is DecorType => !!(BUILDINGS as Record<string, BuildingSpec | undefined>)[t]?.decor;
/** Decorations a player may hold: a base, more for each real building, and a hard cap (citybuilding.md §7). */
export const DECOR_BASE = 20, DECOR_PER_BUILDING = 4, DECOR_CAP = 400;
/** Decor with none of its owner's real buildings this close is cleared. */
export const DECOR_CLEAR_R = 15;
/** Planting (citybuilding.md §5): how long a field and a sapling take to grow in, and what a field costs. */
export const PLANT_FIELD_MS = 5 * 60_000, PLANT_TREE_MS = 8 * 60_000, PLANT_FIELD_COST = 2;
/** Hauling (citybuilding.md §6): what one elephant carries. */
export const HAUL_LOAD = 60;

/**
 * Population by piece (safeguards.md §1, as of 2026-09-28): each piece has its own room,
 * set by the buildings in each king's city (within its reach). A city full of pawns can
 * still raise knights and elephants; more stables make room for more knights.
 */
export const POP_PAWNS_PER_KING = 8;
export const POP_PAWNS_PER_HOUSE = 6;
export const POP_HOUSES_COUNTED = 4;
/** Room per building of the kind that makes the piece. Kings follow your title instead. */
export const POP_PER_BUILDING: Partial<Record<PieceKind, { type: BuildingType; n: number }>> = {
  N: { type: 'stable', n: 2 }, B: { type: 'temple', n: 2 }, R: { type: 'barracks', n: 2 }, Q: { type: 'palace', n: 1 },
};
export const PLAYER_PIECE_CAP = 400;
/**
 * Paved roads (movement.md §9): a square's traffic at or above PAVED is a paved road.
 * Paving never wears off, and troops on it move about 1.5× as fast.
 */
export const PAVED = 1000;
/**
 * Altars (economy.md §8): a small outpost a bishop holds far from any king. While a bishop
 * of yours stands within ALTAR_TEND squares of it, it holds the land within ALTAR_REACH:
 * up to ALTAR_BUILDINGS houses, stables or temples can stand there and keep working, at
 * ALTAR_RATE of the usual speed. They add no population room (that stays with kings).
 */
export const ALTAR_TEND = 2;
export const ALTAR_REACH = 5;
export const ALTAR_BUILDINGS = 3;
export const ALTAR_TYPES: BuildingType[] = ['house', 'stable', 'temple'];
export const ALTAR_RATE = 0.6;
export const ALTARS_PER_PLAYER = 4;
/** Knights in one paving crew, and the longest road one order lays. */
export const PAVE_CREW = 8;
export const PAVE_MAX = 400;
/** Turns of a knight's work per square, and how many times faster a knight rides than it paves. */
export const PAVE_TURNS = 2;
export const PAVE_RIDE = 4;
/**
 * Clearing (movement.md §9): elephants in one crew, the largest area one order clears, and
 * turns of one elephant's work to bring each down. Rock and ore are only cleared when asked.
 */
export const CLEAR_CREW = 8;
export const CLEAR_MAX = 40;
export const CLEAR_TURNS = { tree: 2, rock: 8, ore: 20 } as const;
/**
 * Hurry bubbles (economy.md §7): while you're online, bubbles rise over your working
 * buildings, one every fifth of a piece's time (8 s to 90 s apart, a little irregular),
 * up to BUBBLE_MAX waiting. Popping one advances that building by the time it took to
 * appear, so popping every bubble about doubles production. Now and then one is gold,
 * worth BUBBLE_GOLD_TIMES as much.
 */
export const BUBBLE_MAX = 3;
export const BUBBLE_GOLD_CHANCE = 0.08;
export const BUBBLE_GOLD_TIMES = 4;
/** Time between bubbles for a building making a piece every cycleMs. */
export const bubbleEveryMs = (cycleMs: number) => Math.max(8_000, Math.min(90_000, cycleMs / 5));
/** How far a popped bubble advances production (a fraction of a piece). */
export const bubbleWorth = (cycleMs: number, gold: boolean) => Math.min(gold ? 1 : 0.25, (bubbleEveryMs(cycleMs) / cycleMs) * (gold ? BUBBLE_GOLD_TIMES : 1));
/** Kings are the scarce resource: a hard cap, and each extra king takes longer to crown. */
export const PLAYER_KING_CAP = 20;
export const KING_TIME_PER_KING = 1 / 4; // palace king time × (1 + kings/4)
/** Buildings per king (counted within its reach) and a hard per-player cap. */
export const BUILDINGS_PER_KING = 12;
export const PLAYER_BUILDING_CAP = 160;
/** Ruins crumble away (freeing the squares) after this long. */
export const RUIN_LIFETIME_MS = 6 * 60 * 60_000;
/** A defender gets this long of protection when an attack on them is called off. */
export const CANCEL_PROTECT_MS = 120_000;
/** Accounts younger than this don't hand over pieces when they lose (anti-farming). */
export const FRESH_ACCOUNT_MS = 2 * 60 * 60_000;

/** Player colors (art.md §2). */
export const TEAM_COLORS = ['#d9534a', '#4a7fd4', '#e3b23c', '#8e5bd1', '#2fa59a', '#e0803a', '#5bb04f', '#c7508f', '#46a6c9', '#8a6d4f'];

/** The starting kit (economy.md §5). */
export const START_KIT: PieceKind[] = ['K', 'P', 'P', 'P', 'P'];
