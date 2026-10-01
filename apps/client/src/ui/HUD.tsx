// The HUD (ux.md §4–5). Phone: information on top, actions in the thumb zone,
// detail in bottom sheets. Desktop: side panels and hotkeys. Same features.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ALTAR_BUILDINGS, ALTAR_RATE, ALTAR_REACH, LESSONS, BUILDINGS, CLEAR_TURNS, TURN_MS, CHAPTERS, PIECE_NAME, POP_HOUSES_COUNTED, POP_PAWNS_PER_HOUSE, POP_PAWNS_PER_KING, POP_PER_BUILDING, REACH, TITLES, cheb, setWorth, type BuildingType, type Piece, type PieceKind } from '@owc/shared';
import { terrainAt } from '@owc/worldgen';
import { commands, conn, mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { scene, input } from './GameView.tsx';
import { buildingUrl, pieceUrl } from '../game/textures.ts';
import { audio } from '../audio/audio.ts';
import { BattleView } from './BattleView.tsx';
import { ShareTikTok } from './ShareTikTok.tsx';
import { AwayReport, Guide, SignIn, SignInNudge, Welcome } from './Onboarding.tsx';
import { ChapterCeremony, ChronicleBook, ChronicleTracker } from './Chronicle.tsx';
import { Inspect, HoverTag } from './Inspect.tsx';
import { Shop, Coin } from './Shop.tsx';
import { CivShowcase } from './CivShowcase.tsx';
import { PerfOverlay, perfOn } from './PerfOverlay.tsx';
import { Markers } from './Markers.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { SheetGrab } from './SheetGrab.tsx';
import { LessonView } from './LessonView.tsx';
import { Riddle } from './Riddle.tsx';
import { QuestHelp } from './QuestHelp.tsx';
import { DiscordButton, DiscordNudge } from './Discord.tsx';
import { TroopList, nearestOf, troopOfSelection, troopsOf } from './troops.tsx';
import { BuildPalette, ToolBar } from './BuildPalette.tsx';
import { Controls } from './Controls.tsx';
import { controlsOpen, setControlsOpen } from '../store.ts';
import { Celebrate } from './Celebrate.tsx';
import { checkPlacement } from '../game/placement.ts';

const KIND_ORDER: PieceKind[] = ['K', 'Q', 'R', 'B', 'N', 'P'];
const NODE_NAME: Record<string, string> = { tree: 'wood', rock: 'stone', ore: 'ore', wheat: 'crops' };

/** ?cinema: the world without the interface, for filming footage (docs/marketing). Battles still show. */
const CINEMA = typeof location !== 'undefined' && new URLSearchParams(location.search).has('cinema');

export function HUD() {
  const ui = useUI();
  const battle = ui.battleFocus != null ? mirror.battles.get(ui.battleFocus) : undefined;
  return (
    <div className={`hud layout-${ui.layout}${CINEMA ? ' cinema' : ''}`}>
      <Markers />
      <TopBar />
      {/* On phones these stack in one column under the top bar, so they never overlap. */}
      <div className={`top-stack ${ui.layout === 'phone' && (ui.sheet || ui.questHelp || ui.riddle != null || ui.pendingAttack || ui.pendingClear || ui.inspect || battle) ? 'covered' : ''}`}>
        {mirror.self?.chronicle ? <ChronicleTracker /> : <Guide />}
        <Alerts />
        {ui.layout === 'phone' && <Toasts />}
      </div>
      <ChapterCeremony />
      {ui.layout === 'desktop' && <SidePanel />}
      <BottomDock />
      <Sheet />
      {perfOn && <PerfOverlay />}
      <Inspect />
      {ui.layout === 'desktop' && <HoverTag />}
      {ui.pendingAttack && <AttackConfirm />}
      {ui.pendingClear && <ClearConfirm />}
      {ui.riddle != null && <Riddle />}
      <QuestHelp />
      <Celebrate />
      {battle && <BattleView battle={battle} />}
      {ui.status !== 'open' && <div className="conn-pill">{ui.status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</div>}
      <AwayReport />
      <SignInNudge />
      <DiscordNudge />
      <CivShowcase />
      <SignIn />
      <ShareTikTok />
      <Welcome />
      {ui.updateReady && ui.battleFocus == null && <button className="update-pill" onClick={() => location.reload()}>A new version is ready · Reload</button>}
      {ui.watching && <div className="watch-pill">Watching your lands · touch to take over</div>}
    </div>
  );
}

function TopBar() {
  const ui = useUI();
  const self = mirror.self;
  const pieces = mirror.myPieces();
  const shielded = self && self.shieldUntil > mirror.serverNow();
  const live = [...mirror.battles.values()].filter((b) => b.phase !== 'over');
  return (
    <div className="topbar">
      <div className="me">
        <span className="chip" style={{ background: self?.color ?? '#888' }} />
        <b>{self?.name ?? '…'}</b>
        {self?.chronicle && ui.layout !== 'phone' && <span className="badge title" title="Your title in the Chronicle">{TITLES[self.chronicle.title].name}</span>}
        <span className="muted" title={self?.provisional ? 'Your rating is still settling: it moves a lot in your first games' : undefined}>{self?.rating ?? ''}{self?.provisional ? '?' : ''}</span>
        {self?.guest && <button className="badge guest" onClick={() => window.dispatchEvent(new Event('owc:signin'))}>{ui.layout === 'phone' ? 'Sign in' : 'Guest · sign in'}</button>}
        {shielded && <span className="badge shield" title="New players can't be attacked for a while"><Icon name="shield" size={13} />{ui.layout === 'phone' ? '' : ' shielded'}</span>}
      </div>
      <div className="stats">
        <span className="stat" title={popTitle(self)} onClick={() => ui.layout === 'phone' && ui.toast(popTitle(self), 'info')}><img src={pieceUrl('P', 'light', self?.color ?? '#888', false, self?.civ)} alt="" />{pieces.length}{self?.popCap ? <span className="muted">/{self.popCap}</span> : null}</span>
        <span className="stat kstat" title="Kings"><img src={pieceUrl('K', 'light', self?.color ?? '#888', false, self?.civ)} alt="" />{pieces.filter((p) => p.kind === 'K').length}</span>
        <span className="stat bstat" title="Buildings"><Icon name="house" size={16} />{mirror.myBuildings().filter((b) => b.type !== 'ruin').length}</span>
        <DayClock />
        {(ui.layout !== 'phone' || live.length > 0) && <button className="link stat" aria-label="Battles" onClick={() => ui.set({ sheet: 'battles' })}><Icon name="swords" size={17} />{live.length || ''}</button>}
      </div>
      <div className="top-actions">
        <button className={`icon-btn ${ui.flagMode ? 'on' : ''}`} aria-label="Place a flag" title="Place a flag (F)" onClick={() => { ui.set({ flagMode: !ui.flagMode }); if (!ui.flagMode) ui.toast(ui.layout === 'phone' ? 'Tap the map to place a flag' : 'Click the map to place a flag', 'info', 'flag'); }}><Icon name="flag" size={19} /></button>
        <button className="icon-btn" aria-label="The Chronicle" title="The Chronicle" onClick={() => ui.set({ sheet: ui.sheet === 'chronicle' ? null : 'chronicle' })}><Icon name="book" size={19} />{(() => { const n = self?.chronicle?.sides.filter((q) => q.state === 'offered').length ?? 0; return n ? <span className="dot-badge" aria-label={`${n} quest${n > 1 ? 's' : ''} offered`}>{n}</span> : null; })()}</button>
        <button className="icon-btn shop-btn" aria-label="Civilizations shop" title="Civilizations" onClick={() => ui.set({ sheet: ui.sheet === 'shop' ? null : 'shop' })}><Coin size={19} /></button>
        <button className="icon-btn" aria-label="Help" onClick={() => ui.set({ sheet: ui.sheet === 'help' ? null : 'help' })}><Icon name="help" size={19} /></button>
        <button className="icon-btn" aria-label="Settings" onClick={() => ui.set({ sheet: ui.sheet === 'settings' ? null : 'settings' })}><Icon name="menu" size={19} /></button>
      </div>
    </div>
  );
}

/** Day number and sun/moon (the world shares one 40-minute day). */
function DayClock() {
  const now = mirror.serverNow(), DAY = 40 * 60_000;
  const phase = (((now % DAY) + DAY) % DAY) / DAY;
  const day = Math.floor((now - Date.UTC(2026, 8, 26)) / DAY) + 1;
  const sun = Math.sin(phase * Math.PI * 2);
  return <span title={`Day ${day}`} className="day stat"><Icon name={sun >= 0 ? 'sun' : 'moon'} size={16} />{day}</span>;
}

function Alerts() {
  const ui = useUI();
  return (
    <div className="alerts">
      {ui.alerts.slice(0, ui.layout === 'phone' ? 2 : 4).map((a) => {
        const b = a.battleId != null ? mirror.battles.get(a.battleId) : undefined;
        const secs = b && b.phase === 'countdown' ? Math.max(0, Math.ceil((b.startsAt - mirror.serverNow()) / 1000)) : null;
        return (
          <div key={a.id} className={`alert ${a.kind}`} onClick={() => {
            if (a.at && scene) scene.centerOn(a.at[0], a.at[1]);
            if (b) ui.set({ battleFocus: b.id });
            ui.dismissAlert(a.id);
          }}>
            <span className="a-icon"><Icon name={(a.kind === 'attacked' ? 'alert' : a.kind === 'battle-soon' ? 'swords' : a.kind === 'emperor-lost' ? 'crown' : 'bell') as IconName} size={20} /></span>
            <span className="a-text">{a.text.replace(/Battle in \d+s/, secs != null ? `Battle in 0:${String(secs).padStart(2, '0')}` : 'Battle')}</span>
            {(a.at || b) && <span className="a-go">{b ? 'Go to battle' : 'Show'} <Icon name="chevron" size={14} /></span>}
          </div>
        );
      })}
    </div>
  );
}

function Toasts() {
  const ui = useUI();
  return <div className="toasts">{ui.toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.icon && <Icon name={t.icon as IconName} size={16} />}{t.text}</div>)}</div>;
}

/** Kings you own: one chip each (the troop bar). */
function useKings() {
  const ui = useUI();
  void ui.version;
  return mirror.myKings().sort((a, b) => Number(!!b.emperor) - Number(!!a.emperor) || a.id - b.id);
}

function groupCount(k: Piece) {
  return mirror.myPieces().filter((p) => cheb(p.x, p.y, k.x, k.y) <= REACH && (p.kind !== 'K' || p.id === k.id)).length;
}

function KingChip({ k, compact }: { k: Piece; compact?: boolean }) {
  const ui = useUI();
  const color = mirror.self?.color ?? '#888';
  const selected = ui.selection.includes(k.id);
  const cd = (k.cooldownUntil ?? 0) - mirror.serverNow();
  const inBattle = k.state === 'battle';
  return (
    <button className={`king-chip ${selected ? 'on' : ''} ${inBattle ? 'battle' : ''}`}
      onClick={() => {
        const g = input?.armyOf(k) ?? [k.id];
        ui.select(g); g.slice(0, 12).forEach((_, i) => audio.select(i));
        scene?.centerOn(k.x, k.y);
      }}>
      <img src={pieceUrl('K', 'light', color, !!k.emperor, mirror.self?.civ)} alt="" />
      <span className="count">{groupCount(k)}</span>
      {!compact && <span className="label">{k.emperor ? 'Emperor' : `King ${k.id % 1000}`}</span>}
      {cd > 0 && <span className="cd" style={{ ['--p' as string]: `${Math.min(1, cd / 600_000) * 360}deg` }} />}
      {k.state === 'moving' && <span className="moving-dot" />}
    </button>
  );
}

/** Your troops out on excursions (movement.md §10): opens the Troops panel. */
function TroopsChip() {
  const ui = useUI();
  const n = troopsOf().length;
  return (
    <button className={`king-chip troops-chip ${ui.sheet === 'troops' ? 'on' : ''}`} aria-label={`${n} troop${n > 1 ? 's' : ''} out`} onClick={() => ui.set({ sheet: ui.sheet === 'troops' ? null : 'troops' })}>
      <Icon name="troop" size={22} />
      <span className="count">{n}</span>
    </button>
  );
}

/**
 * The selection bar (ux.md §3, reworked 2026-09-28). Top: what you have, kind by kind (tap a
 * kind to leave one behind), and a × that's always there. With a king: how much of its
 * troop, as buttons (its army, everything near it, or the king alone). Then what you can
 * do, wrapping rather than scrolling so nothing hides. A one-line hint says how to order.
 */
function SelectionBar({ sel, pending }: { sel: Piece[]; pending: [number, number] | null | undefined }) {
  const ui = useUI();
  const phone = ui.layout === 'phone';
  const clear = () => { ui.select([]); ui.set({ lassoMode: false, orderMode: null }); if (input) input.pendingMove = null; if (scene) scene.pendingMarker = null; };
  const kings = sel.filter((p) => p.kind === 'K');
  const k = kings.length === 1 ? kings[0] : undefined;
  const same = (ids: number[]) => ids.length === sel.length && ids.every((id) => ui.selection.includes(id));
  const army = k && input ? input.armyOf(k) : [], all = k && input ? input.groupOf(k) : [];
  // When its army is everything near it, one button says so.
  const scopes = !k ? [] : [
    ...(all.length > army.length ? [{ label: 'Army', ids: army, title: 'Its best legal army: the chess set it would fight with' }] : []),
    { label: all.length > army.length ? 'All' : 'Army', ids: all, title: 'Every piece within its reach' },
    { label: 'King only', ids: [k.id], title: 'Just the king' },
  ];
  const knights = sel.filter((p) => p.kind === 'N').length;
  // A piece's own work shows only when the selection is all that kind (a troop marches; a crew works).
  const only = (kind: PieceKind) => sel.every((p) => p.kind === kind);
  // The selection is (part of) a troop out on an excursion (movement.md §10).
  const troop = troopOfSelection(ui.selection);
  const troopNo = troop ? troopsOf().indexOf(troop) + 1 : 0;
  const joining = new Set(troop?.joining.map((j) => j.id) ?? []);
  const hint = ui.orderMode === 'pave' ? `Tap where the road should go: ${knights} knight${knights > 1 ? 's' : ''} will pave it`
    : ui.orderMode === 'clear' ? 'Drag over the land to clear, or tap its middle'
    : ui.orderMode === 'haul' ? 'Tap the rock or ore deposit to haul'
    : ui.orderMode === 'haulTo' ? 'Now tap where to set it down (near one of your kings)'
    : ui.lassoMode ? (phone ? 'Tap pieces to add or remove them · long-press and draw to add many' : 'Click pieces to add or remove them')
    : pending ? null
    : troop ? (phone ? '+ calls the nearest piece of that kind out to the troop' : '+ calls the nearest piece of that kind out to the troop · right-click to move it')
    : phone ? 'Tap the ground to move · tap an enemy to attack' : 'Right-click to move · right-click an enemy to attack';
  // Where "nearest" is measured from: the troop's post, or the selection's middle.
  const from: [number, number] = troop ? troop.at : [Math.round(sel.reduce((s, p) => s + p.x, 0) / sel.length), Math.round(sel.reduce((s, p) => s + p.y, 0) / sel.length)];
  const lead = sel.find((p) => p.kind === 'K') ?? sel[0];
  const mine = mirror.myPieces();
  // − lets the farthest of a kind go; + brings the nearest one in (with a troop: calls it out).
  const minus = (kind: PieceKind) => {
    const of = sel.filter((p) => p.kind === kind).sort((a, b) => cheb(b.x, b.y, lead.x, lead.y) - cheb(a.x, a.y, lead.x, lead.y));
    if (of[0]) ui.select(ui.selection.filter((id) => id !== of[0].id));
  };
  const plus = async (kind: PieceKind) => {
    const q = nearestOf(kind, from, new Set(ui.selection));
    if (!q) return;
    if (troop) {
      const e = await commands.reinforce(troop.id, q.id);
      if (e) { ui.toast(e, 'error'); return; }
      ui.toast(`A ${PIECE_NAME[kind].toLowerCase()} is on its way to the troop`, 'info');
    }
    ui.select([...useUI.getState().selection, q.id]);
    audio.select(ui.selection.length);
  };
  const kinds = KIND_ORDER.filter((kind) => mine.some((p) => p.kind === kind));
  return (
    <div className="action-row sel-bar">
      <div className="sel-top">
        <span className="sel-title">
          {troop ? <><Icon name="troop" size={16} /> Troop {troopNo}</> : 'Selected'}
          <b className="sel-count">{troop ? `· ${sel.length}` : sel.length}</b>
          {joining.size > 0 && <span className="sel-otw">{joining.size} on the way</span>}
        </span>
        <button className="icon-btn sel-close" aria-label="Deselect" title="Deselect (Esc)" onClick={clear}><Icon name="close" size={18} stroke={2.6} /></button>
      </div>
      <div className="steppers">
        {kinds.map((kind) => {
          const n = sel.filter((p) => p.kind === kind).length;
          const have = mine.filter((p) => p.kind === kind && p.state !== 'battle' && !p.emperor).length + (kind === 'K' && sel.some((p) => p.emperor) ? 1 : 0);
          const more = !!nearestOf(kind, from, new Set(ui.selection));
          const otw = sel.filter((p) => p.kind === kind && joining.has(p.id)).length;
          const name = PIECE_NAME[kind].toLowerCase();
          return (
            <span key={kind} className={`stepper ${n ? 'on' : ''}`}>
              <button className="st-btn" disabled={!n} aria-label={`One ${name} fewer`} title={`Leave a ${name} behind`} onClick={() => minus(kind)}>−</button>
              <span className="st-mid" title={`${n} of your ${have} ${name}s selected`}>
                <img src={pieceUrl(kind, 'light', mirror.self?.color ?? '#888', kind === 'K' && sel.some((p) => p.emperor && p.kind === 'K'), mirror.self?.civ)} alt="" />
                <b>{n}</b><small>/{have}</small>
                {otw > 0 && <em className="st-otw" title={`${otw} on the way`}>↗{otw}</em>}
              </span>
              <button className="st-btn" disabled={!more} aria-label={troop ? `Call a ${name} to the troop` : `One ${name} more`} title={troop ? `Call the nearest ${name} out to the troop` : `Add the nearest ${name}`} onClick={() => void plus(kind)}>+</button>
            </span>
          );
        })}
      </div>
      {scopes.length > 0 && !pending && !troop && (
        <div className="seg sel-scope">
          {scopes.map((sc) => <button key={sc.label} className={same(sc.ids) ? 'on' : ''} title={sc.title} onClick={() => ui.select(sc.ids)}>{sc.label}{sc.ids.length > 1 ? ` ${sc.ids.length}` : ''}</button>)}
        </div>
      )}
      <div className="sel-actions">
        {pending ? <>
          <button className="btn" onClick={() => { input?.issue([pending[0], pending[1]]); useUI.getState().bump(); }}>Move here</button>
          <button className="btn ghost" onClick={() => { if (input) input.pendingMove = null; if (scene) scene.pendingMarker = null; ui.bump(); }}>Cancel</button>
        </> : <>
          {troop && !troop.home && <button className="btn ghost" title="March this troop back to the nearest city; it disbands there" onClick={() => commands.troopHome(troop.id).then((e) => e ? ui.toast(e, 'error') : ui.toast('The troop marches home', 'info'))}>Home</button>}
          <button className="btn ghost" onClick={() => commands.stop(ui.selection)}>Stop</button>
          <button className={`btn ghost ${ui.lassoMode ? 'on' : ''}`} title={phone ? 'Add or remove pieces by tapping them' : 'Add or remove pieces by clicking them (or Shift-click)'} onClick={() => ui.set({ lassoMode: !ui.lassoMode })}>{ui.lassoMode ? 'Adding…' : '+ Add'}</button>
          {/* Works (movement.md §9): knights pave, elephants clear. */}
          {only('N') && <button className={`btn ghost ${ui.orderMode === 'pave' ? 'on' : ''}`} title="Knights pave a road from here to where you tap" onClick={() => ui.set({ orderMode: ui.orderMode === 'pave' ? null : 'pave' })}>Pave</button>}
          {/* A bishop raises an altar beside itself (economy.md §8). */}
          {only('B') && mirror.self?.chronicle?.buildings.includes('temple') && <button className="btn ghost" title="Raise an altar beside this bishop" onClick={() => {
            const b = sel.find((p) => p.kind === 'B')!;
            // The first good spot beside the bishop (an altar needs one within 2 squares).
            const spots: [number, number][] = [];
            for (let r = 1; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) spots.push([b.x + dx, b.y + dy]);
            const at = spots.find(([x, y]) => checkPlacement('altar', x, y).ok) ?? spots[0];
            clear();
            ui.set({ buildType: 'altar' });
            input?.updateGhost(at);
          }}>Raise altar</button>}
          {only('R') && <button className={`btn ghost ${ui.orderMode === 'haul' || ui.orderMode === 'haulTo' ? 'on' : ''}`} title="Elephants carry rock or ore to where you want it, a load at a time" onClick={() => ui.set({ orderMode: ui.orderMode === 'haul' || ui.orderMode === 'haulTo' ? null : 'haul', haulFrom: null })}>Haul</button>}
          {only('R') && <button className={`btn ghost ${ui.orderMode === 'clear' ? 'on' : ''}`} title="Elephants clear the trees (and, if you choose, rock and ore) in an area" onClick={() => ui.set({ orderMode: ui.orderMode === 'clear' ? null : 'clear' })}>Clear land</button>}
          {mirror.self?.chronicle?.abilities.includes('muster') && sel.length === 1 && sel[0].kind === 'K' && <button className="btn ghost" title="Gather every piece within 20 squares to this king" onClick={() => commands.muster(sel[0].id).then((e) => e && ui.toast(e, 'error'))}><Icon name="horn" size={15} /> Muster</button>}
        </>}
      </div>
      {hint && <span className="hint-text">{hint}</span>}
    </div>
  );
}

function BottomDock() {
  const ui = useUI();
  const kings = useKings();
  const sel = ui.selection.map((id) => mirror.pieces.get(id)).filter(Boolean) as Piece[];
  const pending = input?.pendingMove;
  return (
    <div className="dock">
      {ui.tool && <ToolBar />}
      {/* On a wide screen, toasts sit just above whatever the dock is showing (never under the selection bar). */}
      {ui.layout !== 'phone' && <Toasts />}
      {!ui.tool && ui.buildType && (
        <div className="action-row build-row">
          <span className={`ghost-state ${ui.ghost?.ok ? 'ok' : 'bad'}`}>{ui.ghost ? ui.ghost.reason : 'Drag on the map to place'}</span>
          {ui.layout === 'phone' && <button className="btn" disabled={!ui.ghost?.ok} onClick={() => input?.placeBuilding()}><Icon name="check" size={18} /> {ui.moving != null ? 'Move here' : 'Build'}</button>}
          <button className="btn ghost" onClick={() => ui.set({ buildType: null, ghost: null, moving: null })}>Cancel</button>
        </div>
      )}
      {!ui.tool && !ui.buildType && sel.length > 0 && <SelectionBar sel={sel} pending={pending} />}
      {ui.layout === 'phone' && !ui.tool && (
        <div className="troop-bar">
          <div className="chips">
            {kings.map((k) => <KingChip key={k.id} k={k} compact />)}
            {troopsOf().length > 0 && <TroopsChip />}
          </div>
          <button className="build-fab" aria-label="Build" onClick={() => ui.set({ sheet: ui.sheet === 'build' ? null : 'build' })}><Icon name="hammer" size={28} stroke={2.4} /></button>
        </div>
      )}
    </div>
  );
}

function SidePanel() {
  const ui = useUI();
  const kings = useKings();
  return (
    <div className="side">
      <section>
        <h3>Your kings</h3>
        <div className="king-list">{kings.map((k) => <KingChip key={k.id} k={k} />)}</div>
        {!kings.length && <p className="muted">No kings. A new Emperor is on the way.</p>}
      </section>
      {troopsOf().length > 0 && (
        <section>
          <h3>Troops out</h3>
          <TroopList />
        </section>
      )}
      <section>
        <h3>Build <span className="muted kbd">B</span></h3>
        <BuildPalette buildings={<BuildList />} />
      </section>
      <Minimap />
      <button className="link keys-link" onClick={() => { setControlsOpen('map'); ui.set({ sheet: 'controls' }); }}><Icon name="help" size={14} /> Controls <span className="kbd">?</span></button>
      {ui.sheet === 'details' && <Details />}
    </div>
  );
}

/** Camps and rival buildings seen this session (drawn on the minimap with Cartography). */
const SEEN = new Map<number, { x: number; y: number; camp: boolean; color: string }>();

function BuildList() {
  const ui = useUI();
  const color = mirror.self?.color ?? '#888';
  const chron = mirror.self?.chronicle;
  // The Chronicle opens buildings chapter by chapter; the Wonder appears once it's earned (campaign.md §3).
  const types: BuildingType[] = ['house', 'stable', 'temple', 'barracks', 'palace', 'altar', ...(chron?.buildings.includes('wonder') ? ['wonder' as const] : [])];
  // Altars open with temples (economy.md §8).
  const opensAt = (t: BuildingType) => CHAPTERS.find((c) => c.reward.buildings?.includes(t === 'altar' ? 'temple' : t))?.n;
  return (
    <div className="build-list">
      {types.map((t) => {
        const s = BUILDINGS[t];
        const locked = !!chron && !chron.buildings.includes(t === 'altar' ? 'temple' : t);
        if (locked) return (
          <div key={t} className="build-card locked" title="Opens as you progress through the Chronicle">
            <img src={buildingUrl(t, color, mirror.self?.civ)} alt="" />
            <span className="bname">{t[0].toUpperCase() + t.slice(1)}</span>
            <span className="bmeta"><Icon name="lock" size={12} /> Opens after chapter {opensAt(t)}</span>
          </div>
        );
        return (
          <button key={t} className={`build-card ${ui.buildType === t ? 'on' : ''}`} onClick={() => {
            ui.set({ buildType: ui.buildType === t ? null : t, sheet: ui.layout === 'phone' ? null : ui.sheet });
            // Drop the ghost where the player is looking (phones), ready to drag.
            if (scene) input?.updateGhost([scene.cam.x, scene.cam.y]);
          }}>
            <img src={buildingUrl(t, color, mirror.self?.civ)} alt="" />
            <span className="bname">{t[0].toUpperCase() + t.slice(1)}</span>
            <span className="bmeta">{t === 'altar' ? 'Raised by a bishop, anywhere · holds up to 3 houses, stables or temples around it' : t === 'wonder' ? 'A monument the world can see · in your capital' : `${s.produces.map((k) => PIECE_NAME[k]).join(' / ')} · needs ${s.needs.map((n) => NODE_NAME[n]).join(' + ')} nearby`}</span>
            <span className="bcost">{Object.entries(s.cost).map(([k, v]) => `${v} ${NODE_NAME[k]}`).join(', ') || 'Free: a bishop\'s time'}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Why a building is paused for room, and what makes more (safeguards.md §1). */
function popFull(type: BuildingType): string {
  const kind = BUILDINGS[type].produces[0];
  if (type === 'palace') return 'No room: kings follow your title, and each palace makes room for 1 queen';
  if (type === 'house') return `No room for more pawns: each king has room for ${POP_PAWNS_PER_KING}, +${POP_PAWNS_PER_HOUSE} per house near it (up to ${POP_HOUSES_COUNTED})`;
  return `No room for more ${PIECE_NAME[kind].toLowerCase()}s: each ${type} near a king makes room for ${POP_PER_BUILDING[kind]?.n ?? 2}. Build another to raise more`;
}

/** Pieces and room by kind (safeguards.md §1), for the population readout. */
const POP_FROM: Record<string, string> = { P: 'houses', N: 'stables', B: 'temples', R: 'barracks', Q: 'palaces' };
function popTitle(self: typeof mirror.self): string {
  if (!self?.pop) return 'Pieces / population';
  return 'Room by piece (each comes from the buildings near your kings)\n' + (['P', 'N', 'B', 'R', 'Q'] as const)
    .map((k) => { const [have, room] = self.pop![k] ?? [0, 0]; return `${PIECE_NAME[k]}s ${have}/${room} (from ${POP_FROM[k]})`; }).join('\n');
}

function Details() {
  const ui = useUI();
  const id = ui.hint?.startsWith('building:') ? Number(ui.hint.split(':')[1]) : null;
  const b = id != null ? mirror.buildings.get(id) : undefined;
  if (!b || b.type === 'ruin') return <p className="muted">Tap one of your buildings to see it here.</p>;
  const spec = BUILDINGS[b.type as BuildingType];
  const mine = b.owner === mirror.me;
  // A decoration (citybuilding.md §4): what it is, and remove it.
  if (spec?.decor) return (
    <div className="details">
      <h3>{b.type[0].toUpperCase() + b.type.slice(1)}</h3>
      <p className="muted">A decoration: it adds beauty, not production. {b.gate ? 'A street runs through it, so it\'s a gate.' : ''}</p>
      {mine && <div className="row-actions"><button className="btn ghost small" onClick={() => { void commands.eraseDecor([[b.x, b.y]]); ui.set({ sheet: null, hint: null }); }}><Icon name="close" size={14} /> Remove</button></div>}
    </div>
  );
  const why: Record<string, string> = { unanchored: b.type === 'altar' ? 'No bishop tending it: bring one within 2 squares, or it will fall to ruin' : 'No king (or tended altar) nearby for too long: production has paused (it only decays if none of your pieces are home)', 'no-node': `Nothing to draw from: needs ${spec.needs.map((n) => NODE_NAME[n]).join(' + ')} within 3 squares`, 'pop-cap': popFull(b.type as BuildingType), 'king-cap': `Your title lets you hold ${TITLES[mirror.self?.chronicle?.title ?? 0]?.kingCap ?? 2} kings, and you have them all: it crowns again when your title rises (or a king falls). Switch it to queens meanwhile.`, building: 'Under construction', paused: 'Paused by you' };
  return (
    <div className="details">
      <h3>{b.type[0].toUpperCase() + b.type.slice(1)}</h3>
      <div className="meter"><span style={{ width: `${(b.built < 1 ? b.built : b.prod) * 100}%` }} /></div>
      <p>{b.blocked ? why[b.blocked] : b.type === 'altar' ? `Tended by a bishop: it holds the land within ${ALTAR_REACH} squares, where up to ${ALTAR_BUILDINGS} houses, stables or temples can stand without a king.` : `Producing ${spec.produces.map((k) => PIECE_NAME[k]).join('/')} · ${b.rate ?? 1}× speed from local richness`}</p>
      {b.outpost && <p className="muted">Held by an altar, not a king: it works at {Math.round(ALTAR_RATE * 100)}% speed.</p>}
      <p className="muted">Condition {b.hp}/100</p>
      {b.type !== 'altar' && <button className="btn ghost small" onClick={() => commands.pause(b.id, !b.paused)}>{b.paused ? <><Icon name="play" size={14} /> Resume production</> : <><Icon name="pause" size={14} /> Pause production</>}</button>}
      {mirror.self?.chronicle?.abilities.includes('capital') && (
        mirror.self.chronicle.capital && Math.max(Math.abs(mirror.self.chronicle.capital[0] - b.x), Math.abs(mirror.self.chronicle.capital[1] - b.y)) <= 10
          ? <p className="muted"><Icon name="crown" size={13} /> Your capital: it holds itself forever and crowns kings faster.</p>
          : <button className="btn ghost small" onClick={() => commands.setCapital(b.id).then((e) => e && ui.toast(e, 'error'))}><Icon name="crown" size={14} /> Make this town your capital</button>
      )}
      {mine && b.type !== 'altar' && b.type !== 'wonder' && <MoveDemolish b={b} />}
      {b.type === 'palace' && (
        <div className="seg">
          {(['alt', 'K', 'Q'] as const).map((m) => <button key={m} className={b.palaceMode === m ? 'on' : ''} onClick={() => commands.palaceMode(b.id, m)}>{m === 'alt' ? 'Alternate' : m === 'K' ? 'Kings' : 'Queens'}</button>)}
        </div>
      )}
    </div>
  );
}

/** Move a building or tear it down (citybuilding.md §3). Demolishing asks twice. */
function MoveDemolish({ b }: { b: { id: number; type: string; x: number; y: number } }) {
  const ui = useUI();
  const [sure, setSure] = useState(false);
  return (
    <div className="row-actions move-demolish">
      <button className="btn ghost small" onClick={() => {
        ui.set({ moving: b.id, buildType: b.type as BuildingType, sheet: ui.layout === 'phone' ? null : ui.sheet, tool: null });
        input?.updateGhost([b.x, b.y]);
      }}><Icon name="move" size={14} /> Move</button>
      <button className={`btn ghost small ${sure ? 'danger-text' : ''}`} onClick={() => {
        if (!sure) { setSure(true); return; }
        void commands.demolish(b.id).then((e) => { if (e) ui.toast(e, 'error'); else { ui.toast('Torn down: half its wood and stone are left beside it', 'info'); ui.set({ sheet: null, hint: null }); } });
      }}><Icon name="close" size={14} /> {sure ? 'Tap again to tear it down' : 'Demolish'}</button>
    </div>
  );
}

function Sheet() {
  const ui = useUI();
  if (!ui.sheet || (ui.layout === 'desktop' && ui.sheet === 'details') || (ui.layout === 'desktop' && ui.sheet === 'build')) return null;
  const close = () => ui.set({ sheet: null });
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet">
        <SheetGrab onClose={close} />
        {ui.sheet === 'build' && <><h3>Build</h3><BuildPalette buildings={<BuildList />} /></>}
        {ui.sheet === 'details' && <Details />}
        {ui.sheet === 'battles' && <BattleList />}
        {ui.sheet === 'settings' && <Settings />}
        {ui.sheet === 'help' && <Help />}
        {ui.sheet === 'shop' && <Shop />}
        {ui.sheet === 'chronicle' && <ChronicleBook />}
        {ui.sheet === 'troops' && <><h3>Troops out</h3><TroopList /></>}
        {ui.sheet === 'controls' && <Controls open={controlsOpen} />}
        {ui.layout === 'phone' && ui.sheet === 'build' && ui.buildTab === 'build' && <Minimap />}
      </div>
    </div>
  );
}

function BattleList() {
  const ui = useUI();
  const list = [...mirror.battles.values()].filter((b) => b.phase !== 'over');
  return (
    <div>
      <h3>Battles</h3>
      {!list.length && <p className="muted">No battles right now.</p>}
      <button className="btn ghost" style={{ width: '100%', marginBottom: 8 }} onClick={() => { commands.practice(); ui.set({ sheet: null }); }}><Icon name="pawn" size={16} /> Practice battle vs AI</button>
      {list.map((b) => (
        <button key={b.id} className="row-btn" onClick={() => { ui.set({ battleFocus: b.id, sheet: null }); scene?.centerOn(b.cx, b.cy); }}>
          <span className="chip" style={{ background: b.white.color }} /> {b.white.name} vs <span className="chip" style={{ background: b.black.color }} /> {b.black.name}
          <span className="muted"> · {b.phase === 'countdown' ? 'starting' : `${b.moves.length} moves`}</span>
        </button>
      ))}
    </div>
  );
}

function Settings() {
  const ui = useUI();
  const s = ui.settings;
  useEffect(() => { audio.setVolumes(s); }, [s]);
  const [name, setName] = useState(() => mirror.self?.name ?? '');
  return (
    <div className="settings">
      <h3>Settings</h3>
      <div className="row-actions guide-row">
        <button className="btn ghost" onClick={() => { setControlsOpen('map'); ui.set({ sheet: 'controls' }); }}><Icon name="help" size={16} /> Controls</button>
        <button className="btn ghost" onClick={() => ui.set({ sheet: 'help' })}><Icon name="book" size={16} /> Rulebook</button>
      </div>
      <div className="discord-row">
        <DiscordButton />
        <span className="muted small">Allies, rivals, bug reports, and what's coming next.</span>
      </div>
      <label className="row"><span>Sound</span><input id="set-sound" type="checkbox" checked={s.sound} onChange={(e) => ui.setSettings({ sound: e.target.checked })} /></label>
      {(['music', 'effects', 'ambience'] as const).map((k) => (
        <label key={k} className="row"><span>{k[0].toUpperCase() + k.slice(1)}</span><input id={`set-${k}`} type="range" min={0} max={1} step={0.05} value={s[k]} onChange={(e) => ui.setSettings({ [k]: Number(e.target.value) })} /></label>
      ))}
      <label className="row"><span>Reduce motion</span><input id="set-motion" type="checkbox" checked={s.reduceMotion} onChange={(e) => ui.setSettings({ reduceMotion: e.target.checked })} /></label>
      <label className="row"><span>Watch mode when idle</span><input id="set-watch" type="checkbox" checked={s.watchMode} onChange={(e) => ui.setSettings({ watchMode: e.target.checked })} /></label>
      <label className="row"><span>Attack alerts outside the app</span><button className="btn ghost" onClick={() => { try { Notification.requestPermission(); } catch { /* */ } }}>Allow</button></label>
      <label className="row"><span>{mirror.self?.guest ? 'Playing as a guest' : `Signed in${mirror.self?.email ? ` as ${mirror.self.email}` : ''}`}</span><button className="btn ghost" onClick={() => window.dispatchEvent(new Event('owc:signin'))}>{mirror.self?.guest ? 'Sign in' : 'Account'}</button></label>
      <label className="row col"><span>Name</span><span style={{ display: 'flex', gap: 8 }}><input id="set-name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} /><button className="btn ghost" onClick={() => conn.send({ t: 'profile', name: name.trim() })}>Rename</button></span></label>
      <StartOver />
    </div>
  );
}

/** Reset the empire and play from scratch: asked twice, the second time by typing its name. */
function StartOver() {
  const ui = useUI();
  const self = mirror.self;
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!self) return null;
  // One reset an hour: say how long before you can, instead of refusing after you've typed.
  const wait = self.resetAt ? Math.ceil((self.resetAt + 60 * 60_000 - Date.now()) / 60_000) : 0;
  const pieces = mirror.myPieces().length, buildings = mirror.myBuildings().filter((b) => b.type !== 'ruin').length;
  const go = async () => {
    setBusy(true); setErr(null);
    const e = await commands.resetEmpire(typed);
    if (e) { setErr(e); setBusy(false); ui.toast(e, 'error'); return; }
    ui.toast('A new beginning', 'good');
    setTimeout(() => location.reload(), 600);
  };
  return (
    <div className="start-over">
      {step === 0 && <label className="row"><span>Start over from scratch{wait > 0 && <small className="muted"> · once an hour, again in {wait} min</small>}</span><button className="btn ghost danger-text" disabled={wait > 0} onClick={() => setStep(1)}>Start over…</button></label>}
      {step === 1 && <div className="confirm-box">
        <b>Start your empire over?</b>
        <p>Your {pieces} pieces and {buildings} buildings will be gone for good, and the Chronicle begins again at chapter 1 somewhere new. You keep your name, your sign-in, your Crowns and your civilizations.</p>
        <div className="row-actions">
          <button className="btn danger" onClick={() => setStep(2)}>Yes, continue</button>
          <button className="btn ghost" onClick={() => setStep(0)}>Keep my empire</button>
        </div>
      </div>}
      {step === 2 && <div className="confirm-box">
        <b>This can't be undone.</b>
        <p>Type <b>{self.name}</b> to confirm.</p>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={self.name} autoFocus />
        {err && <p className="field-error">{err}</p>}
        <div className="row-actions">
          <button className="btn danger" disabled={busy || typed.trim().toLowerCase() !== self.name.toLowerCase()} onClick={go}>{busy ? 'Starting over…' : 'Reset my empire'}</button>
          <button className="btn ghost" onClick={() => { setStep(0); setTyped(''); setErr(null); }}>Cancel</button>
        </div>
      </div>}
    </div>
  );
}

/**
 * Help: the whole rulebook (lessons.ts), every rule with its fine print and tactics, taught
 * by the Chronicle or not. Nothing about the game is a secret (campaign.md §5.7).
 */
function Help() {
  const ui = useUI();
  return (
    <div className="help">
      <h3>The rulebook</h3>
      <button className="btn ghost small" onClick={() => { setControlsOpen('map'); ui.set({ sheet: 'controls' }); }}><Icon name="help" size={14} /> Controls for this {ui.layout === 'phone' ? 'phone' : 'computer'}</button>
      <p className="muted">Every rule of the game. Open a rule for its fine print (every number and exception) and tactics. The Chronicle teaches these as you go; they're all here if you'd rather read ahead.</p>
      <div className="rulebook">
        {Object.entries(LESSONS).map(([id, l]) => (
          <details key={id} className="lesson-row"><summary>{l.title}</summary><LessonView l={l} bare /></details>
        ))}
      </div>
    </div>
  );
}

/**
 * Confirm land to clear (movement.md §9): what's there, how long it takes, and a choice to
 * break rock and ore too. Those never grow back, so it says how many would go.
 */
function ClearConfirm() {
  const ui = useUI();
  const c = ui.pendingClear!;
  const [hard, setHard] = useState(false);
  const x0 = Math.min(c.a[0], c.b[0]), x1 = Math.max(c.a[0], c.b[0]), y0 = Math.min(c.a[1], c.b[1]), y1 = Math.max(c.a[1], c.b[1]);
  const count = { tree: 0, rock: 0, ore: 0 };
  for (const n of mirror.nodes.values()) if (!n.hoard && n.remaining > 0 && n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1 && n.kind in count) count[n.kind as keyof typeof count]++;
  const crew = c.ids.filter((id) => mirror.pieces.get(id)?.kind === 'R').length || 1;
  const turns = (count.tree * CLEAR_TURNS.tree + (hard ? count.rock * CLEAR_TURNS.rock + count.ore * CLEAR_TURNS.ore : 0)) / crew;
  const secs = Math.round((turns * 1.6 * TURN_MS) / 1000); // walking between spots too
  const close = () => ui.set({ pendingClear: null });
  const nothing = !count.tree && (!hard || (!count.rock && !count.ore));
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet confirm">
        <SheetGrab onClose={close} />
        <h3>Clear this land?</h3>
        <p>{nothing && !count.rock && !count.ore ? `Nothing to clear in these ${x1 - x0 + 1}×${y1 - y0 + 1} squares: no trees, rock or ore.` : `${x1 - x0 + 1}×${y1 - y0 + 1} squares: ${count.tree} tree${count.tree === 1 ? '' : 's'}${count.rock ? `, ${count.rock} rock` : ''}${count.ore ? `, ${count.ore} ore` : ''}.`} {nothing ? '' : `${crew} elephant${crew > 1 ? 's' : ''} will take about ${secs < 90 ? `${Math.max(5, secs)} seconds` : `${Math.round(secs / 60)} minutes`}.`}</p>
        {(count.rock > 0 || count.ore > 0) && (
          <label className="check-row"><input type="checkbox" checked={hard} onChange={(e) => setHard(e.target.checked)} /> Also break rock and ore</label>
        )}
        {hard && (count.rock > 0 || count.ore > 0) && <p className="warn-text">Rock and ore never grow back. This destroys {count.rock ? `${count.rock} rock` : ''}{count.rock && count.ore ? ' and ' : ''}{count.ore ? `${count.ore} ore` : ''}{count.ore ? ', which palaces need' : ''}.</p>}
        <div className="row-actions">
          <button className="btn" disabled={nothing} onClick={() => { void commands.clearLand(c.ids, [x0, y0], [x1, y1], hard); close(); }}>Clear</button>
          <button className="btn ghost" onClick={close}>Not now</button>
        </div>
      </div>
    </div>
  );
}

function AttackConfirm() {
  const ui = useUI();
  const a = ui.pendingAttack!;
  const mine = a.pieceIds.map((id) => mirror.pieces.get(id)).filter(Boolean) as Piece[];
  const target = mirror.pieces.get(a.targetKingId);
  const theirs = target ? [...mirror.pieces.values()].filter((p) => p.owner === target.owner && cheb(p.x, p.y, target.x, target.y) <= REACH) : [];
  // What each side could actually field: one legal chess set.
  const val = (ps: Piece[]) => setWorth(ps.map((p) => p.kind));
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && ui.set({ pendingAttack: null })}>
      <div className="sheet confirm">
        <SheetGrab onClose={() => ui.set({ pendingAttack: null })} />
        <h3>Attack {a.name}?</h3>
        {a.kingless && <p>Their troop has no king: one of its pawns will command it, as its king for this battle.</p>}
        <p>{a.raid ? 'A raid: one of your pawns leads as the king for this battle only. If you lose, only that pawn falls; the rest walk home.' : `${a.siege ? 'A siege: they get 60 seconds to prepare.' : 'A field battle: 15 seconds until it starts.'} Both sides fight with at most one chess set. If your king falls, the pieces with it are lost.`}</p>
        <div className="versus"><div><b>You</b><span>{mine.length} pieces · material {val(mine)}</span></div><div className="vs">vs</div><div><b>{a.name}</b><span>~{theirs.length} pieces seen · material {val(theirs)}</span></div></div>
        <div className="row-actions">
          <button className="btn danger" onClick={() => { commands.attack(a.pieceIds, a.targetKingId); if (scene && target) scene.moveTargets.set('attack:' + a.targetKingId, { to: [target.x, target.y], ids: a.pieceIds, attack: true, t0: performance.now() }); ui.set({ pendingAttack: null }); }}><Icon name="swords" size={17} /> Attack</button>
          <button className="btn ghost" onClick={() => ui.set({ pendingAttack: null })}>Not now</button>
        </div>
      </div>
    </div>
  );
}

/** Minimap: terrain, your holdings, other players, and an elo-band layer. */
function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [elo, setElo] = useState(false);
  const ui = useUI();
  const size = 180, span = 320;
  const center = useMemo(() => (scene?.ready ? [Math.round(scene.cam.x / 16) * 16, Math.round(scene.cam.y / 16) * 16] : [0, 0]), [ui.version]);
  const base = useMemo(() => {
    if (!mirror.seed) return null;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d')!;
    const col: Record<string, string> = { grass: '#95b957', forest: '#6f9a4a', water: '#71bcd4', mountain: '#8a8176', sand: '#e2cd96' };
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
      const wx = center[0] + (x / size - 0.5) * span, wy = center[1] + (y / size - 0.5) * span;
      if (elo) {
        const e = mirror.land.at(wx, wy);
        const t = Math.max(0, Math.min(1, (e - 600) / 1800));
        g.fillStyle = `hsl(${210 - t * 200}, 55%, ${45 + t * 5}%)`;
      } else g.fillStyle = col[terrainAt(mirror.seed, Math.round(wx), Math.round(wy))];
      g.fillRect(x, y, 2, 2);
    }
    return c;
  }, [center[0], center[1], elo, mirror.seed]);
  useEffect(() => {
    const c = ref.current;
    if (!c || !base) return;
    const g = c.getContext('2d')!;
    g.drawImage(base, 0, 0);
    const toMap = (x: number, y: number) => [((x - center[0]) / span + 0.5) * size, ((y - center[1]) / span + 0.5) * size];
    for (const p of mirror.pieces.values()) {
      const [mx, my] = toMap(p.x, p.y);
      g.fillStyle = p.owner ? mirror.players.get(p.owner)?.color ?? '#888' : '#aaa';
      g.fillRect(mx - 1, my - 1, p.kind === 'K' ? 4 : 2, p.kind === 'K' ? 4 : 2);
    }
    for (const b of mirror.buildings.values()) { const [mx, my] = toMap(b.x, b.y); g.fillStyle = '#2b2622'; g.fillRect(mx - 2, my - 2, 4, 4); }
    // Cartography (campaign.md §4.4): camps and rival settlements you've seen stay on your map.
    for (const b of mirror.buildings.values()) if (b.owner && b.owner !== mirror.me) SEEN.set(b.id, { x: b.x, y: b.y, camp: b.type === 'camp', color: mirror.players.get(b.owner)?.color ?? '#999' });
    if (mirror.self?.chronicle?.abilities.includes('cartography'))
      for (const [id, s] of SEEN) {
        if (mirror.buildings.has(id)) continue;
        const [mx, my] = toMap(s.x, s.y);
        if (mx < 0 || my < 0 || mx > size || my > size) continue;
        g.fillStyle = s.camp ? '#b5543a' : s.color; g.strokeStyle = '#2b2622'; g.lineWidth = 1;
        g.beginPath(); if (s.camp) g.arc(mx, my, 2.5, 0, Math.PI * 2); else g.rect(mx - 2.5, my - 2.5, 5, 5); g.fill(); g.stroke();
      }
    if (scene?.ready) {
      const [mx, my] = toMap(scene.cam.x, scene.cam.y);
      const w = (scene.app.screen.width / (64 * scene.cam.zoom)) / span * size, h = (scene.app.screen.height / (64 * scene.cam.zoom)) / span * size;
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(mx - w / 2, my - h / 2, w, h);
    }
  });
  return (
    <div className="minimap">
      <canvas ref={ref} width={size} height={size} onClick={(e) => {
        const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const x = center[0] + ((e.clientX - r.left) / r.width - 0.5) * span, y = center[1] + ((e.clientY - r.top) / r.height - 0.5) * span;
        scene?.centerOn(x, y);
      }} />
      <button className={`btn ghost small ${elo ? 'on' : ''}`} onClick={() => setElo(!elo)}>{elo ? 'Terrain' : 'Elo map'}</button>
      <span className="muted small">Area elo here: {mirror.seed && scene?.ready ? Math.round(mirror.land.at(scene.cam.x, scene.cam.y)) : '—'}</span>
    </div>
  );
}

export { conn };
