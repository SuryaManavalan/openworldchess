// The browser's connection to the game server, plus the commands every
// gesture and key turns into (ux.md §9).
import { Connection } from '@owc/client-core';
import type { BuildingType } from '@owc/shared';
import { useUI } from './store.ts';

const tokenKey = 'owc.token';
const readToken = () => { try { return localStorage.getItem(tokenKey); } catch { return null; } };

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
export const conn = new Connection({
  url: `${proto}://${location.host}/play`,
  WebSocket: WebSocket as never,
  token: readToken(),
  name: (() => { try { return localStorage.getItem('owc.name') ?? undefined; } catch { return undefined; } })(),
  onToken: (t) => { try { localStorage.setItem(tokenKey, t); } catch { /* ignore */ } },
  onStatus: (s) => useUI.getState().set({ status: s }),
});
export const mirror = conn.mirror;

/** The commands (ux.md §9): everything input produces goes through these. */
export const commands = {
  async move(pieceIds: number[], to: [number, number]) {
    const err = await conn.request({ t: 'order.move', pieceIds, to });
    if (err) useUI.getState().toast(err, 'error');
    return err;
  },
  stop(pieceIds: number[]) { conn.send({ t: 'order.stop', pieceIds }); },
  async attack(pieceIds: number[], targetKingId: number) {
    const err = await conn.request({ t: 'order.attack', pieceIds, targetKingId });
    if (err) useUI.getState().toast(err, 'error');
    return err;
  },
  async build(building: BuildingType, at: [number, number]) {
    const err = await conn.request({ t: 'build', building, at });
    if (err) useUI.getState().toast(err, 'error');
    return err;
  },
  pause(buildingId: number, paused: boolean) { conn.send({ t: 'building.pause', buildingId, paused }); },
  palaceMode(buildingId: number, mode: 'alt' | 'K' | 'Q') { conn.send({ t: 'palace.mode', buildingId, mode }); },
  battleMove(battleId: number, uci: string) { conn.send({ t: 'battle.move', battleId, uci }); },
  resign(battleId: number) { conn.send({ t: 'battle.resign', battleId }); },
  draw(battleId: number) { conn.send({ t: 'battle.draw', battleId }); },
  cancelAttack(battleId: number) { conn.send({ t: 'order.cancelAttack', battleId }); },
  watch(battleId: number) { conn.send({ t: 'battle.watch', battleId }); },
  practice() { conn.send({ t: 'practice' }); },
  emote(id: number, battleId?: number) { conn.send({ t: 'emote', id, battleId }); },
};
