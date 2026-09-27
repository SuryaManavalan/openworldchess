// Game constants. Every number here is traceable to a spec in docs/specs.
// Times are in milliseconds unless the name says otherwise.

/** One world turn (movement.md §1). 600ms = 100 BPM (visuals.md §1). */
export const TURN_MS = 600;
/** Server ticks per second (TECH.md T7). */
export const TICK_HZ = 10;

/** The one reach rule: buildings and pieces stay within this of a king (economy.md §2). */
export const REACH = 10;
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

export type BuildingType = 'palace' | 'house' | 'stable' | 'temple' | 'barracks';
export type NodeKind = 'tree' | 'wheat' | 'rock' | 'gold';

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
}

export const BUILDINGS: Record<BuildingType, BuildingSpec> = {
  house: { type: 'house', size: 1, cost: { tree: 30 }, buildMs: 20_000, needs: ['wheat'], draw: { wheat: 5 }, produces: ['P'], baseMs: 60_000 },
  stable: { type: 'stable', size: 2, cost: { tree: 80 }, buildMs: 45_000, needs: ['wheat'], draw: { wheat: 20 }, produces: ['N'], baseMs: 240_000 },
  temple: { type: 'temple', size: 2, cost: { tree: 60, rock: 40 }, buildMs: 45_000, needs: ['gold'], draw: { gold: 15 }, produces: ['B'], baseMs: 240_000 },
  barracks: { type: 'barracks', size: 2, cost: { tree: 60, rock: 80 }, buildMs: 60_000, needs: ['rock'], draw: { rock: 30 }, produces: ['R'], baseMs: 300_000 },
  palace: { type: 'palace', size: 3, cost: { tree: 120, rock: 150 }, buildMs: 90_000, needs: ['gold', 'rock'], draw: { gold: 40, rock: 40 }, produces: ['K', 'Q'], baseMs: 1_200_000 },
};

/**
 * Population (docs/specs/safeguards.md §1): each king supports KING_POP pieces,
 * plus HOUSE_POP per house within its reach, counting at most HOUSES_PER_KING
 * houses. So one king carries at most 34 pieces, about two chess sets. A hard
 * per-player cap protects the server whatever else happens.
 */
export const KING_POP = 16;
export const HOUSE_POP = 6;
export const HOUSES_PER_KING = 3;
export const PLAYER_PIECE_CAP = 400;
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
