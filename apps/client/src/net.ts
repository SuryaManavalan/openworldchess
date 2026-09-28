// The browser's connection to the game server, plus the commands every
// gesture and key turns into (ux.md §9).
import { Connection } from '@owc/client-core';
import type { BuildingType } from '@owc/shared';
import { useUI } from './store.ts';

const tokenKey = 'owc.token';
const readToken = () => { try { return localStorage.getItem(tokenKey); } catch { return null; } };

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
/** ?watch: look at the world without an empire (for filming; see tools/shorts). */
export const WATCH = new URLSearchParams(location.search).has('watch');
export const conn = new Connection({
  url: `${proto}://${location.host}/play`,
  WebSocket: WebSocket as never,
  token: WATCH ? null : readToken(),
  watch: WATCH,
  autoStart: false,
  onToken: (t) => { try { localStorage.setItem(tokenKey, t); } catch { /* ignore */ } },
  onStatus: (s) => useUI.getState().set({ status: s }),
  onHelloError: (msg, code) => {
    // A saved token that no longer works means the guest empire fell.
    try { if (localStorage.getItem(tokenKey)) { localStorage.removeItem(tokenKey); useUI.getState().set({ welcomeNote: 'Your last empire fell while you were away. Choose a name to rise again.' }); } } catch { /* ignore */ }
    useUI.getState().set({ needName: true, nameError: code === 'need-name' ? null : msg });
  },
});
// Returning players reconnect at once; new players choose a name first.
if (WATCH || readToken()) conn.start(); else useUI.getState().set({ needName: true });
export const mirror = conn.mirror;
// A chapter done: celebrate it (campaign.md §5.5).
mirror.onChapter = (c) => useUI.getState().set({ ceremony: c });
// Off to Stripe's secure checkout page.
mirror.onShopUrl = (url) => { location.href = url; };

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
  popBubble(buildingId: number, i: number) { conn.send({ t: 'bubble.pop', buildingId, i }); },
  pause(buildingId: number, paused: boolean) { conn.send({ t: 'building.pause', buildingId, paused }); },
  palaceMode(buildingId: number, mode: 'alt' | 'K' | 'Q') { conn.send({ t: 'palace.mode', buildingId, mode }); },
  battleMove(battleId: number, uci: string) { conn.send({ t: 'battle.move', battleId, uci }); },
  resign(battleId: number) { conn.send({ t: 'battle.resign', battleId }); },
  draw(battleId: number) { conn.send({ t: 'battle.draw', battleId }); },
  cancelAttack(battleId: number) { conn.send({ t: 'order.cancelAttack', battleId }); },
  watch(battleId: number) { conn.send({ t: 'battle.watch', battleId }); },
  practice() { conn.send({ t: 'practice' }); },
  emote(id: number, battleId?: number) { conn.send({ t: 'emote', id, battleId }); },
  // Shop (cosmetics.md): Crowns via Stripe, civilizations via Crowns.
  setCapital(buildingId: number) { return conn.request({ t: 'capital.set', buildingId }); },
  resetEmpire(name: string) { return conn.request({ t: 'empire.reset', name }); },
  declineQuest(id: number) { conn.send({ t: 'quest.decline', id }); },
  muster(kingId: number) { return conn.request({ t: 'muster', kingId }); },
  checkout(pack: string) { return conn.request({ t: 'shop.checkout', pack }); },
  buyCiv(civ: string) { return conn.request({ t: 'civ.buy', civ }); },
  equipCiv(civ: string | null) { conn.send({ t: 'civ.equip', civ }); },
};
