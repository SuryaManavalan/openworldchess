// Persistence (TECH.md T11), development backend: an atomic JSON snapshot.
// The Game only talks to save()/load(), so a Postgres backend can replace it.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Building, Piece } from '@owc/shared';
import type { Game, PlayerRec } from './game.ts';
import type { NodeRec } from './world.ts';

interface Snapshot {
  v: 1;
  seed: number;
  nextId: number;
  turn: number;
  players: PlayerRec[];
  pieces: Piece[];
  buildings: Building[];
  nodes: [number, NodeRec][];
  traffic: [number, number][];
  events?: [string, { at: number; kind: string; text: string }[]][];
}

export function save(game: Game, file: string) {
  const w = game.world;
  const snap: Snapshot = {
    v: 1, seed: w.seed, nextId: w.nextId, turn: game.turn,
    players: [...game.players.values()],
    pieces: [...w.pieces.values()],
    buildings: [...w.buildings.values()],
    nodes: [...w.nodeOverlay],
    traffic: [...w.traffic],
    events: [...game.events],
  };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file + '.tmp', JSON.stringify(snap));
  renameSync(file + '.tmp', file);
}

export function load(game: Game, file: string): boolean {
  if (!existsSync(file)) return false;
  const snap = JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
  if (snap.seed !== game.world.seed) return false;
  const w = game.world;
  w.nextId = snap.nextId;
  game.turn = snap.turn;
  for (const p of snap.players) { p.online = false; p.leftAt ??= Date.now(); game.players.set(p.id, p); game.tokens.set(p.token, p.id); }
  for (const [k, n] of snap.nodes) w.nodeOverlay.set(k, n);
  for (const [k, t] of snap.traffic ?? []) w.traffic.set(k, t);
  for (const [pid, ev] of snap.events ?? []) game.events.set(pid, ev);
  for (const b of snap.buildings) w.addBuilding(b);
  for (const p of snap.pieces) {
    // Battles and marches in progress don't survive a restart.
    if (p.state === 'battle' || p.state === 'moving') p.state = 'idle';
    p.groupId = undefined;
    game.addPiece(p);
  }
  return true;
}
