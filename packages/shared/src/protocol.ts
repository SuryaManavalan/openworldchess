// Client ↔ server protocol (networking.md §2). Client messages are validated
// with zod on the server; server messages are plain typed objects.
import { z } from 'zod';
import type { BattlePublic, Building, NodeState, Piece, PlayerPublic, PlayerSelf } from './types.ts';

export const PROTOCOL_VERSION = 1;

const xy = z.tuple([z.number().int(), z.number().int()]);
const ids = z.array(z.number().int()).max(200);

export const ClientMsg = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), token: z.string().max(200).optional(), name: z.string().max(24).optional(), v: z.number() }),
  z.object({ t: z.literal('sub'), chunks: z.array(xy).max(81) }),
  z.object({ t: z.literal('order.move'), rid: z.number().optional(), pieceIds: ids, to: xy }),
  z.object({ t: z.literal('order.stop'), pieceIds: ids }),
  z.object({ t: z.literal('order.attack'), rid: z.number().optional(), pieceIds: ids, targetKingId: z.number().int() }),
  z.object({ t: z.literal('order.cancelAttack'), battleId: z.number().int() }),
  z.object({ t: z.literal('build'), rid: z.number().optional(), building: z.enum(['palace', 'house', 'stable', 'temple', 'barracks']), at: xy }),
  z.object({ t: z.literal('building.pause'), buildingId: z.number().int(), paused: z.boolean() }),
  z.object({ t: z.literal('palace.mode'), buildingId: z.number().int(), mode: z.enum(['alt', 'K', 'Q']) }),
  z.object({ t: z.literal('battle.move'), battleId: z.number().int(), uci: z.string().min(4).max(5) }),
  z.object({ t: z.literal('battle.resign'), battleId: z.number().int() }),
  z.object({ t: z.literal('battle.draw'), battleId: z.number().int() }),
  z.object({ t: z.literal('battle.watch'), battleId: z.number().int() }),
  z.object({ t: z.literal('battle.unwatch'), battleId: z.number().int() }),
  z.object({ t: z.literal('emote'), battleId: z.number().int().optional(), id: z.number().int().min(0).max(15) }),
  z.object({ t: z.literal('practice') }),
  z.object({ t: z.literal('profile'), name: z.string().min(2).max(20) }),
  z.object({ t: z.literal('ping'), at: z.number() }),
]);
export type ClientMsg = z.infer<typeof ClientMsg>;

/** A piece move within a turn: [pieceId, fromX, fromY, toX, toY, facing]. */
export type TurnMove = [number, number, number, number, number, number];

export type ServerMsg =
  | { t: 'welcome'; v: number; token: string; self: PlayerSelf; seed: number; turn: number; turnMs: number; serverTime: number; nextTurnAt: number }
  | { t: 'chunk'; cx: number; cy: number; pieces: Piece[]; buildings: Building[]; nodes: NodeState[]; traffic: number[] }
  | { t: 'turn'; n: number; at: number; moves: TurnMove[]; pieces: Piece[]; removed: number[]; buildings: Building[]; removedBuildings: number[]; nodes: NodeState[] }
  | { t: 'mine'; pieces: Piece[]; buildings: Building[] }
  | { t: 'players'; players: PlayerPublic[] }
  | { t: 'self'; self: PlayerSelf }
  | { t: 'battle'; battle: BattlePublic }
  | { t: 'battles'; battles: BattlePublic[] }
  | { t: 'battle.end'; battleId: number; result: 'white' | 'black' | 'draw'; termination: string; summary: BattleSummary }
  | { t: 'alert'; kind: 'attacked' | 'battle-soon' | 'decay' | 'emperor-lost' | 'respawned' | 'info'; text: string; battleId?: number; at?: [number, number] }
  | { t: 'emote'; battleId?: number; playerId: string; id: number }
  | { t: 'away'; since: number; events: { at: number; kind: string; text: string }[] }
  | { t: 'ack'; rid: number }
  | { t: 'err'; rid?: number; msg: string }
  | { t: 'pong'; at: number; serverTime: number };

export interface BattleSummary {
  winner: string | null;
  loser: string | null;
  killed: number[];
  converted: number[];
  routed: number[];
  promoted: number[];
  buildingsTransferred: number[];
  emperorKilled: boolean;
  cooldownMs: number;
  rated: boolean;
  ratingChange: Record<string, number>;
}
