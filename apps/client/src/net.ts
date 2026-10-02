// The browser's connection to the game server, plus the commands every
// gesture and key turns into (ux.md §9).
import { Connection } from '@owc/client-core';
import type { BuildingType, DecorType } from '@owc/shared';
import { useUI } from './store.ts';

const tokenKey = 'owc.token';
const readToken = () => { try { return localStorage.getItem(tokenKey); } catch { return null; } };

const proto = location.protocol === 'https:' ? 'wss' : 'ws';
/** ?watch: look at the world without an empire (for filming; see tools/shorts). */
export const WATCH = new URLSearchParams(location.search).has('watch');
/**
 * Visiting (social.md §2): someone new opened a link to a city, ruler or spot. They look around
 * first, without an empire, with a bar to start their own.
 */
export const VISIT = !WATCH && !readToken() && ['city', 'player', 'at'].some((k) => new URLSearchParams(location.search).has(k));
export const conn = new Connection({
  url: `${proto}://${location.host}/play`,
  WebSocket: WebSocket as never,
  token: WATCH || VISIT ? null : readToken(),
  watch: WATCH || VISIT,
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
if (WATCH || VISIT || readToken()) conn.start(); else useUI.getState().set({ needName: true });
export const mirror = conn.mirror;
// A chapter done: celebrate it (campaign.md §5.5).
mirror.onChapter = (c) => useUI.getState().set({ ceremony: c });
// Off to Stripe's secure checkout page.
mirror.onShopUrl = (url) => { location.href = url; };
// A deploy happened while this tab was open: reload to get the new quests and rules. Never
// in the middle of a battle: then the update waits, with a Reload button, until you're done.
mirror.onNewBuild = () => {
  const ui = useUI.getState();
  if (ui.battleFocus == null) { ui.toast('Updating to the new version…', 'info'); setTimeout(() => location.reload(), 1200); }
  else ui.set({ updateReady: true });
};

/** The commands (ux.md §9): everything input produces goes through these. */
export const commands = {
  async move(pieceIds: number[], to: [number, number]) {
    const err = await conn.request({ t: 'order.move', pieceIds, to });
    if (err) useUI.getState().toast(err, 'error');
    return err;
  },
  async pave(pieceIds: number[], to: [number, number]) {
    const err = await conn.request({ t: 'order.pave', pieceIds, to });
    if (err) useUI.getState().toast(err, 'error'); else useUI.getState().toast('The knights ride out to pave', 'info');
  },
  async clearLand(pieceIds: number[], a: [number, number], b: [number, number], hard: boolean) {
    const err = await conn.request({ t: 'order.clear', pieceIds, a, b, hard });
    if (err) useUI.getState().toast(err, 'error'); else useUI.getState().toast('The elephants set to work', 'info');
  },
  haul(pieceIds: number[], from: [number, number], to: [number, number]) { return conn.request({ t: 'order.haul', pieceIds, from, to }); },
  stop(pieceIds: number[]) { conn.send({ t: 'order.stop', pieceIds }); },
  /** A camp can be named by its home instead (wilds.md §4): its king answers, wherever it is. */
  async attack(pieceIds: number[], targetKingId?: number, targetBuildingId?: number) {
    const err = await conn.request({ t: 'order.attack', pieceIds, targetKingId, targetBuildingId });
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
  practice(arena?: number) { conn.send({ t: 'practice', ...(arena != null ? { arena } : {}) }); },
  emote(id: number, battleId?: number) { conn.send({ t: 'emote', id, battleId }); },
  // Shop (cosmetics.md): Crowns via Stripe, civilizations via Crowns.
  setCapital(buildingId: number) { return conn.request({ t: 'capital.set', buildingId }); },
  resetEmpire(name: string) { return conn.request({ t: 'empire.reset', name }); },
  declineQuest(id: number) { conn.send({ t: 'quest.decline', id }); },
  async solveQuest(id: number, uci: string) {
    return conn.request({ t: 'quest.solve', id, uci });
  },
  async acceptQuest(id: number) {
    const err = await conn.request({ t: 'quest.accept', id });
    if (err) useUI.getState().toast(err, 'error');
  },
  muster(kingId: number) { return conn.request({ t: 'muster', kingId }); },
  // City building (citybuilding.md).
  placeDecor(type: DecorType, cells: [number, number][], sid?: number) { return conn.request({ t: 'decor.place', type, cells, sid }); },
  eraseDecor(cells: [number, number][]) { return conn.request({ t: 'decor.erase', cells }); },
  paintPaving(cells: [number, number][], style: number | null, sid?: number) { return conn.request(style == null ? { t: 'paint.paving', cells, erase: true, sid } : { t: 'paint.paving', cells, style, sid }); },
  plant(kind: 'wheat' | 'tree', cells: [number, number][], sid?: number) { return conn.request({ t: 'plant', kind, cells, sid }); },
  undoCity() { return conn.request({ t: 'city.undo' }); },
  moveBuilding(buildingId: number, at: [number, number]) { return conn.request({ t: 'building.move', buildingId, at }); },
  demolish(buildingId: number) { return conn.request({ t: 'building.demolish', buildingId }); },
  // Troops (movement.md §10).
  reinforce(troopId: number, pieceId: number) { return conn.request({ t: 'troop.reinforce', troopId, pieceId }); },
  troopHome(troopId: number, to?: [number, number]) { return conn.request({ t: 'troop.home', troopId, to }); },
  troopsHome(to?: [number, number]) { return conn.request({ t: 'troop.homeAll', to }); },
  checkout(pack: string) { return conn.request({ t: 'shop.checkout', pack }); },
  buyCiv(civ: string) { return conn.request({ t: 'civ.buy', civ }); },
  equipCiv(civ: string | null) { conn.send({ t: 'civ.equip', civ }); },
};
