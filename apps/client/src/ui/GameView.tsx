// Mounts the Pixi world and bridges world events to the HUD, sound and fx.
import { followDeepLink } from './Find.tsx';
import { useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Scene } from '../game/scene.ts';
import { Input } from '../game/input.ts';
import { VISIT, commands, conn, mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { audio } from '../audio/audio.ts';

export let scene: Scene | null = null;
export let input: Input | null = null;

export function GameView() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const sc = new Scene(mirror);
    scene = sc;
    sc.init(host.current!).then(() => {
      if (!alive) return;
      input = new Input(sc);
      // Debug/automation hook (read-only use in tests and the console).
      (window as unknown as { __owc: unknown }).__owc = { mirror, scene: sc, input, ui: useUI, commands };
      sc.onSubscribe = (chunks) => conn.setSubs(chunks);
      const emp = mirror.myPieces().find((p) => p.emperor) ?? mirror.myKings()[0];
      if (emp) sc.centerOn(emp.x, emp.y); else if (mirror.self) sc.centerOn(...mirror.self.home);
      sc.cam.zoom = window.innerWidth < 700 ? 0.62 : 0.9;
      // A shared link to a city, ruler or spot (Find.tsx).
      if (mirror.self || VISIT) void followDeepLink(); else { const once = mirror.onSelf; let done = false; mirror.onSelf = () => { once(); if (!done) { done = true; void followDeepLink(); } }; }
    });
    bridge(sc);
    const beat = setInterval(() => {
      audio.syncBeat(Math.max(0, mirror.nextTurnAt - mirror.serverNow()), mirror.turnMs);
      watchMode(sc);
    }, 1000);
    return () => { alive = false; clearInterval(beat); sc.app.destroy(true); scene = null; };
  }, []);
  return <div ref={host} className="game-host" />;
}

let bridged = false;
function bridge(sc0: Scene) {
  void sc0;
  if (bridged) return;
  bridged = true;
  const ui = useUI.getState;
  let bumpQueued = false;
  const bump = () => { if (!bumpQueued) { bumpQueued = true; requestAnimationFrame(() => { bumpQueued = false; ui().bump(); }); } };
  const prevTurn = mirror.onTurn;
  mirror.onTurn = (n) => { prevTurn(n); bump(); };
  mirror.onSelf = () => {
    bump();
    if (scene && scene.cam.x === 0 && scene.cam.y === 0 && mirror.self) scene.centerOn(...mirror.self.home);
  };
  mirror.onAlert = (a) => {
    ui().alert({ kind: a.kind, text: a.text, battleId: a.battleId, at: a.at });
    if (a.kind === 'attacked') { audio.attack(); try { navigator.vibrate?.([80, 60, 80]); } catch { /* */ } notify(a.text); }
    if (a.kind === 'respawned' && a.at && scene) scene.centerOn(a.at[0], a.at[1]);
  };
  const seenFen = new Map<number, string>();
  mirror.onBattle = (b) => {
    const mine = b.white.playerId === mirror.me || b.black.playerId === mirror.me;
    audio.countdown = [...mirror.battles.values()].some((x) => x.phase === 'countdown' && (x.white.playerId === mirror.me || x.black.playerId === mirror.me));
    audio.tension = [...mirror.battles.values()].some((x) => x.phase === 'live' && (x.white.playerId === mirror.me || x.black.playerId === mirror.me)) ? 1 : 0;
    if (mine && b.phase === 'live' && !seenFen.has(b.id)) ui().set({ battleFocus: b.id });
    // Chess sounds for battles you're in or watching.
    const prev = seenFen.get(b.id);
    if (b.fen && prev && prev !== b.fen && (mine || ui().battleFocus === b.id)) {
      const last = b.moves[b.moves.length - 1] ?? '';
      audio.clack(last.includes('x'), last.includes('+') || last.includes('#'));
      try { navigator.vibrate?.(last.includes('x') ? 18 : 8); } catch { /* */ }
    }
    if (b.fen) seenFen.set(b.id, b.fen);
    if (scene) scene.settleDirty = true; // gates close/open
    bump();
  };
  mirror.onBattleEnd = (id, s, result) => {
    const b = mirror.battles.get(id);
    if (!b) return;
    const winColor = result === 'white' ? b.white.color : result === 'black' ? b.black.color : '#ffffff';
    const sc = scene;
    if (sc) {
      sc.fx.checkmate(b.cx, b.cy, winColor);
      if (s.converted.length) sc.fx.schedule(700, () => sc.fx.conversionWave(s.converted, b.cx, b.cy, winColor));
    }
    const mine = b.white.playerId === mirror.me || b.black.playerId === mirror.me;
    if (mine) {
      const won = s.winner === mirror.me;
      audio.mate(won);
      const delta = s.ratingChange[mirror.me];
      ui().alert({ kind: 'info', text: `${won ? 'Victory' : s.winner ? 'Defeat' : 'Draw'} · ${b.termination}${delta ? ` · rating ${delta > 0 ? '+' : ''}${delta}` : ''}${s.converted.length ? ` · ${s.converted.length} pieces ${won ? 'join you' : 'lost'}` : ''}` });
    }
    bump();
  };
  mirror.onError = (msg) => ui().toast(msg, 'error');
  mirror.onEmote = (m) => { if (m.battleId && ui().battleFocus === m.battleId) ui().set({ hint: `emote:${m.playerId}:${m.id}:${Date.now()}` }); };
  void Chess;
}

function notify(text: string) {
  try {
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Open World Chess', { body: text, icon: '/icon.svg' });
  } catch { /* unsupported */ }
}

/** Watch mode (visuals.md §6): after a minute idle, drift across your holdings. */
let watchTarget: [number, number] | null = null;
let watchUntil = 0;
function watchMode(sc: Scene) {
  const ui = useUI.getState();
  // Nothing drifts while you're doing something: a menu, a selection, a dialog, an order waiting.
  const busy = ui.battleFocus || ui.buildType || ui.share || ui.sheet || ui.selection.length || ui.pendingAttack || ui.pendingClear || ui.inspect || ui.orderMode || ui.ceremony;
  if (!ui.settings.watchMode || ui.settings.reduceMotion || busy) { if (ui.watching) ui.set({ watching: false }); return; }
  if (Date.now() - sc.lastInput < 60_000) return;
  if (!ui.watching) ui.set({ watching: true });
  if (!watchTarget || Date.now() > watchUntil) {
    const spots = [...mirror.myBuildings().map((b) => [b.x, b.y] as [number, number]), ...mirror.myPieces().filter((p) => p.state === 'moving' || p.routine).map((p) => [p.x, p.y] as [number, number])];
    watchTarget = spots.length ? spots[Math.floor(Math.random() * spots.length)] : null;
    watchUntil = Date.now() + 9000;
  }
  if (!watchTarget) return;
  if (!watchLoop) {
    watchLoop = true;
    const step = () => {
      if (!useUI.getState().watching || !scene || !watchTarget) { watchLoop = false; return; }
      sc.cam.x += (watchTarget[0] - sc.cam.x) * 0.004; sc.cam.y += (watchTarget[1] - sc.cam.y) * 0.004;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
let watchLoop = false;
