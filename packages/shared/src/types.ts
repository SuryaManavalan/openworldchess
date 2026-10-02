// Entity shapes shared by server, client and bots.
import type { BuildingType, NodeKind, PieceKind } from './constants.ts';
import type { ChronicleView } from './chronicle.ts';

/** Facing: 0 = north (-y), 1 = east (+x), 2 = south (+y), 3 = west (-x). */
export type Facing = 0 | 1 | 2 | 3;
export const FACING_DELTA: Record<Facing, [number, number]> = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };

export type PieceState = 'idle' | 'moving' | 'battle' | 'routed' | 'masterless';

export interface Piece {
  id: number;
  /** Player id, or null for masterless pieces. */
  owner: string | null;
  kind: PieceKind;
  x: number;
  y: number;
  facing: Facing;
  emperor?: boolean;
  state: PieceState;
  /** Group this piece is moving with. */
  groupId?: number;
  /** Can't start or join a battle until then (battle.md §8). */
  cooldownUntil?: number;
  /** Kings only: can't be attacked until then. */
  protectedUntil?: number;
  /** Set when promoted in battle. */
  promotedFrom?: PieceKind;
  /** Masterless pieces vanish at this time unless claimed. */
  expiresAt?: number;
  /** Current idle routine, for the client's animation choice. */
  routine?: string;
  /** Sent there by its player without a king (movement.md §4): it stays, instead of drifting home. */
  posted?: boolean;
  /** Indoors (citylife.md §1): the building it's in. It's off the board (its square is free) but still in town. */
  inside?: number;
  /** Part of a starting kit: never changes hands (it perishes instead). */
  kit?: boolean;
  /** A creature of the wilds: its faction id (docs/specs/wilds.md). */
  wild?: string;
}

export interface Building {
  id: number;
  owner: string | null;
  type: BuildingType | 'ruin' | 'camp';
  /** Top-left square of the footprint. */
  x: number;
  y: number;
  size: number;
  hp: number;
  /** 0..1 while under construction; 1 when done. */
  built: number;
  /** 0..1 progress toward the next piece. */
  prod: number;
  /** Ms per piece at the current rate, while producing. */
  cycleMs?: number;
  /** Held by a tended altar rather than a king (economy.md §8): works at ALTAR_RATE. */
  outpost?: boolean;
  /** A wall, fence or hedge with a street through it (citybuilding.md §4): a gate, walkable. */
  gate?: boolean;
  /** Hurry bubbles waiting to be popped by the owner (economy.md §7): 0 plain, 1 gold. */
  bubbles?: number[];
  /** Server: when the next bubble rises. */
  bubbleAt?: number;
  /** Why production is paused, if it is. */
  blocked?: 'unanchored' | 'no-node' | 'pop-cap' | 'king-cap' | 'building' | 'paused' | null;
  /** The owner paused production here. */
  paused?: boolean;
  palaceMode?: 'alt' | 'K' | 'Q';
  palaceNext?: 'K' | 'Q';
  /** When the building lost its last anchoring king. */
  unanchoredSince?: number;
  /** Squares of the nodes it last drew from (for the UI). */
  drawsFrom?: [number, number][];
  /** Masterless buildings fall to ruin at this time unless claimed. */
  expiresAt?: number;
  /** Production rate multiplier from node richness (migration.md §3). */
  rate?: number;
  /** Times this building's settlement has been besieged (walls rise with it). */
  sieges?: number;
  /** When a ruin formed (it crumbles away later). */
  ruinedAt?: number;
  /** A camp of the wilds: its faction, art and name (docs/specs/wilds.md). */
  camp?: { faction: string; art: string; name: string };
}

/** A resource node's current state (only nodes that differ from worldgen are stored). */
export interface NodeState {
  x: number;
  y: number;
  kind: NodeKind;
  capacity: number;
  remaining: number;
  /** A cache a scattered camp left behind (campaign.md §4.2): rich, and it never regrows. */
  hoard?: boolean;
  /** Planted by a player (citybuilding.md §5): grows in from nothing, then is ordinary wheat or wood. */
  planted?: boolean;
}

export interface PlayerPublic {
  /** A new or returning player's rating is still settling (shown with a "?", like chess.com). */
  provisional?: boolean;
  id: string;
  name: string;
  color: string;
  emblem: number;
  rating: number;
  online: boolean;
  /** A camp of the wilds, not a person (its faction id). */
  wild?: string;
  /** Cosmetic civilization in use (docs/specs/cosmetics.md). */
  civ?: string;
  /** Their title, relics and capital, for everyone to see (campaign.md §4). */
  title?: number;
  relics?: string[];
  capital?: [number, number];
}

/** Pieces sent out of your cities hold where they were sent, together (movement.md §10). */
export interface Troop {
  id: number;
  /** Where the troop holds (its post). */
  at: [number, number];
  members: number[];
  /** Reinforcements on their way, dropped if they haven't arrived by `until`. */
  joining: { id: number; until: number }[];
  /** Called home to a city: it disbands once everyone is there. */
  home?: boolean;
  /** An automatic pilgrimage (citylife.md §4): where it set out from, and when it reached its shrine. */
  auto?: 'pilgrims';
  from?: [number, number];
  arrived?: number;
  /** What it's walking to, for the Troops list ("Pilgrims · to the altar"). */
  dest?: string;
}

export interface PlayerSelf extends PlayerPublic {
  /** Your troops out on excursions. */
  troops?: Troop[];
  /** How many different days you've played (for the community invitation). */
  daysPlayed?: number;
  /** Not signed in: the empire falls this long after the player leaves. */
  guest: boolean;
  guestGraceMs: number;
  email?: string;
  /** Current population cap (safeguards.md §1). */
  popCap: number;
  /** Pieces and room by kind (safeguards.md §1): [have, room]. Kings aren't listed (your title sets them). */
  pop?: Partial<Record<PieceKind, [number, number]>>;
  emperorId: number | null;
  shieldUntil: number;
  /** When this empire last started over (one reset an hour). */
  resetAt?: number;
  home: [number, number];
  /** Cosmetic civilizations this account owns, and its Crowns (the shop currency). */
  civsOwned?: string[];
  crowns?: number;
  /** Whether the shop can take payments right now. */
  shopOpen?: boolean;
  /** Their place in the campaign (campaign.md). */
  chronicle?: ChronicleView;
  /** The connected TikTok account, for sharing clips. */
  tiktok?: { name: string };
}

export type BattleResult = 'white' | 'black' | 'draw' | null;

export interface BattlePublic {
  id: number;
  kind: 'siege' | 'field' | 'practice';
  /** A practice match played on an Arena (that building's id): drawn on its squares in the world. */
  arena?: number;
  /** Arena center on the world grid. */
  cx: number;
  cy: number;
  /** Direction the white (attacker) side faces, for orientation. */
  whiteFacing: Facing;
  white: { playerId: string; kingId: number; name: string; rating: number; color: string };
  black: { playerId: string; kingId: number; name: string; rating: number; color: string };
  /** 'countdown' until startsAt, then 'live', then 'over'. */
  phase: 'countdown' | 'live' | 'over';
  startsAt: number;
  fen: string;
  /** The position the battle began from (for replays and clips). */
  startFen?: string;
  moves: string[];
  clocks: { white: number; black: number; turnStartedAt: number | null };
  result: BattleResult;
  termination?: string;
  /** Board square (e.g. "e1") → world piece id. */
  pieceMap: Record<string, number>;
  aiControlled: { white: boolean; black: boolean };
  drawOfferBy?: 'white' | 'black' | null;
  /** World ids of pawns promoted in this battle: they fight as their new piece, then turn back into pawns (battle.md §5). */
  promoted?: number[];
  /** World ids of pawns commanding a raid on the wilds: they fight as the king, for this battle only (battle.md §9). */
  commanders?: number[];
}
