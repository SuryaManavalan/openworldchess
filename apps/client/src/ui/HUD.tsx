// The HUD (ux.md §4–5). Phone: information on top, actions in the thumb zone,
// detail in bottom sheets. Desktop: side panels and hotkeys. Same features.
import { useEffect, useMemo, useRef, useState } from 'react';
import { BUILDINGS, PIECE_NAME, REACH, cheb, type BuildingType, type Piece, type PieceKind } from '@owc/shared';
import { eloAt, terrainAt } from '@owc/worldgen';
import { commands, conn, mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { scene, input } from './GameView.tsx';
import { buildingUrl, pieceUrl } from '../game/textures.ts';
import { audio } from '../audio/audio.ts';
import { BattleView } from './BattleView.tsx';
import { AwayReport, Guide, SignIn, SignInNudge, Welcome } from './Onboarding.tsx';
import { Inspect, HoverTag } from './Inspect.tsx';
import { Shop, Coin } from './Shop.tsx';
import { PerfOverlay, perfOn } from './PerfOverlay.tsx';
import { Markers } from './Markers.tsx';
import { Icon, type IconName } from './Icon.tsx';

const KIND_ORDER: PieceKind[] = ['K', 'Q', 'R', 'B', 'N', 'P'];
const NODE_NAME: Record<string, string> = { tree: 'wood', rock: 'stone', ore: 'ore', wheat: 'wheat' };

export function HUD() {
  const ui = useUI();
  const battle = ui.battleFocus != null ? mirror.battles.get(ui.battleFocus) : undefined;
  return (
    <div className={`hud layout-${ui.layout}`}>
      <Markers />
      <TopBar />
      <Alerts />
      <Guide />
      <Toasts />
      {ui.layout === 'desktop' && <SidePanel />}
      <BottomDock />
      <Sheet />
      {perfOn && <PerfOverlay />}
      <Inspect />
      {ui.layout === 'desktop' && <HoverTag />}
      {ui.pendingAttack && <AttackConfirm />}
      {battle && <BattleView battle={battle} />}
      {ui.status !== 'open' && <div className="conn-pill">{ui.status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</div>}
      <AwayReport />
      <SignInNudge />
      <SignIn />
      <Welcome />
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
        <span className="muted">{self?.rating ?? ''}</span>
        {self?.guest && <button className="badge guest" onClick={() => window.dispatchEvent(new Event('owc:signin'))}>{ui.layout === 'phone' ? 'Sign in' : 'Guest · sign in'}</button>}
        {shielded && <span className="badge shield" title="New players can't be attacked for a while"><Icon name="shield" size={13} />{ui.layout === 'phone' ? '' : ' shielded'}</span>}
      </div>
      <div className="stats">
        <span className="stat" title="Pieces / population cap"><img src={pieceUrl('P', 'light', self?.color ?? '#888', false, self?.civ)} alt="" />{pieces.length}{self?.popCap ? <span className="muted">/{self.popCap}</span> : null}</span>
        <span className="stat kstat" title="Kings"><img src={pieceUrl('K', 'light', self?.color ?? '#888', false, self?.civ)} alt="" />{pieces.filter((p) => p.kind === 'K').length}</span>
        <span className="stat bstat" title="Buildings"><Icon name="house" size={16} />{mirror.myBuildings().filter((b) => b.type !== 'ruin').length}</span>
        <DayClock />
        <button className="link stat" aria-label="Battles" onClick={() => ui.set({ sheet: 'battles' })}><Icon name="swords" size={17} />{live.length || ''}</button>
      </div>
      <div className="top-actions">
        <button className={`icon-btn ${ui.flagMode ? 'on' : ''}`} aria-label="Place a flag" title="Place a flag (F)" onClick={() => { ui.set({ flagMode: !ui.flagMode }); if (!ui.flagMode) ui.toast(ui.layout === 'phone' ? 'Tap the map to place a flag' : 'Click the map to place a flag', 'info', 'flag'); }}><Icon name="flag" size={19} /></button>
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
      {ui.alerts.map((a) => {
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
        const g = input?.groupOf(k) ?? [k.id];
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

function BottomDock() {
  const ui = useUI();
  const kings = useKings();
  const sel = ui.selection.map((id) => mirror.pieces.get(id)).filter(Boolean) as Piece[];
  const pending = input?.pendingMove;
  return (
    <div className="dock">
      {ui.buildType && (
        <div className="action-row build-row">
          <span className={`ghost-state ${ui.ghost?.ok ? 'ok' : 'bad'}`}>{ui.ghost ? ui.ghost.reason : 'Drag on the map to place'}</span>
          {ui.layout === 'phone' && <button className="btn" disabled={!ui.ghost?.ok} onClick={() => input?.placeBuilding()}><Icon name="check" size={18} /> Build</button>}
          <button className="btn ghost" onClick={() => ui.set({ buildType: null, ghost: null })}>Cancel</button>
        </div>
      )}
      {!ui.buildType && sel.length > 0 && (
        <div className="action-row">
          <span className="sel-summary">
            {KIND_ORDER.map((k) => { const n = sel.filter((p) => p.kind === k).length; return n ? <span key={k} className="kc"><img src={pieceUrl(k, 'light', mirror.self?.color ?? '#888', k === 'K' && sel.some((p) => p.emperor), mirror.self?.civ)} alt="" />{n > 1 && n}</span> : null; })}
          </span>
          {pending ? <>
            <button className="btn" onClick={() => { input?.issue([pending[0], pending[1]]); useUI.getState().bump(); }}>Move here</button>
            <button className="btn ghost" onClick={() => { if (input) input.pendingMove = null; if (scene) scene.pendingMarker = null; ui.bump(); }} aria-label="Cancel"><Icon name="close" size={16} /></button>
          </> : <>
            <button className="btn ghost" onClick={() => commands.stop(ui.selection)}>Stop</button>
            {ui.layout === 'phone' && <button className={`btn ghost ${ui.lassoMode ? 'on' : ''}`} onClick={() => ui.set({ lassoMode: !ui.lassoMode })}>+ Add</button>}
            <button className="btn ghost" onClick={() => ui.select([])}>Clear</button>
          </>}
          {!pending && <span className="hint-text">{ui.layout === 'phone' ? 'Drag from your pieces to a square, or onto an enemy' : 'Right-click a square to move · on an enemy to attack'}</span>}
        </div>
      )}
      {ui.layout === 'phone' && (
        <div className="troop-bar">
          <div className="chips">{kings.map((k) => <KingChip key={k.id} k={k} compact />)}</div>
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
      <section>
        <h3>Build <span className="muted kbd">B</span></h3>
        <BuildList />
      </section>
      <Minimap />
      <p className="keys muted">Drag to select · right-click to move or attack · right-drag or WASD to pan · wheel to zoom · Q/E rotate · H home · S stop</p>
      {ui.sheet === 'details' && <Details />}
    </div>
  );
}

function BuildList() {
  const ui = useUI();
  const color = mirror.self?.color ?? '#888';
  const types: BuildingType[] = ['house', 'stable', 'temple', 'barracks', 'palace'];
  return (
    <div className="build-list">
      {types.map((t) => {
        const s = BUILDINGS[t];
        return (
          <button key={t} className={`build-card ${ui.buildType === t ? 'on' : ''}`} onClick={() => {
            ui.set({ buildType: ui.buildType === t ? null : t, sheet: ui.layout === 'phone' ? null : ui.sheet });
            // Drop the ghost where the player is looking (phones), ready to drag.
            if (scene) input?.updateGhost([scene.cam.x, scene.cam.y]);
          }}>
            <img src={buildingUrl(t, color, mirror.self?.civ)} alt="" />
            <span className="bname">{t[0].toUpperCase() + t.slice(1)}</span>
            <span className="bmeta">{s.produces.map((k) => PIECE_NAME[k]).join(' / ')} · needs {s.needs.map((n) => NODE_NAME[n]).join(' + ')} nearby</span>
            <span className="bcost">{Object.entries(s.cost).map(([k, v]) => `${v} ${NODE_NAME[k]}`).join(', ')}</span>
          </button>
        );
      })}
    </div>
  );
}

function Details() {
  const ui = useUI();
  const id = ui.hint?.startsWith('building:') ? Number(ui.hint.split(':')[1]) : null;
  const b = id != null ? mirror.buildings.get(id) : undefined;
  if (!b || b.type === 'ruin') return <p className="muted">Tap one of your buildings to see it here.</p>;
  const spec = BUILDINGS[b.type as BuildingType];
  const why: Record<string, string> = { unanchored: 'No king nearby: it is decaying', 'no-node': `Nothing to draw from: needs ${spec.needs.map((n) => NODE_NAME[n]).join(' + ')} within 3 squares`, 'pop-cap': 'At your population cap. Each king supports 16 pieces, +6 per nearby house (up to 3). More kings raise it', building: 'Under construction', paused: 'Paused by you' };
  return (
    <div className="details">
      <h3>{b.type[0].toUpperCase() + b.type.slice(1)}</h3>
      <div className="meter"><span style={{ width: `${(b.built < 1 ? b.built : b.prod) * 100}%` }} /></div>
      <p>{b.blocked ? why[b.blocked] : `Producing ${spec.produces.map((k) => PIECE_NAME[k]).join('/')} · ${b.rate ?? 1}× speed from local richness`}</p>
      <p className="muted">Condition {b.hp}/100</p>
      <button className="btn ghost small" onClick={() => commands.pause(b.id, !b.paused)}>{b.paused ? <><Icon name="play" size={14} /> Resume production</> : <><Icon name="pause" size={14} /> Pause production</>}</button>
      {b.type === 'palace' && (
        <div className="seg">
          {(['alt', 'K', 'Q'] as const).map((m) => <button key={m} className={b.palaceMode === m ? 'on' : ''} onClick={() => commands.palaceMode(b.id, m)}>{m === 'alt' ? 'Alternate' : m === 'K' ? 'Kings' : 'Queens'}</button>)}
        </div>
      )}
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
        <div className="grabber" onClick={close} />
        {ui.sheet === 'build' && <><h3>Build near a king</h3><BuildList /></>}
        {ui.sheet === 'details' && <Details />}
        {ui.sheet === 'battles' && <BattleList />}
        {ui.sheet === 'settings' && <Settings />}
        {ui.sheet === 'help' && <Help />}
        {ui.sheet === 'shop' && <Shop />}
        {ui.layout === 'phone' && ui.sheet === 'build' && <Minimap />}
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
      <label className="row"><span>Sound</span><input id="set-sound" type="checkbox" checked={s.sound} onChange={(e) => ui.setSettings({ sound: e.target.checked })} /></label>
      {(['music', 'effects', 'ambience'] as const).map((k) => (
        <label key={k} className="row"><span>{k[0].toUpperCase() + k.slice(1)}</span><input id={`set-${k}`} type="range" min={0} max={1} step={0.05} value={s[k]} onChange={(e) => ui.setSettings({ [k]: Number(e.target.value) })} /></label>
      ))}
      <label className="row"><span>Reduce motion</span><input id="set-motion" type="checkbox" checked={s.reduceMotion} onChange={(e) => ui.setSettings({ reduceMotion: e.target.checked })} /></label>
      <label className="row"><span>Watch mode when idle</span><input id="set-watch" type="checkbox" checked={s.watchMode} onChange={(e) => ui.setSettings({ watchMode: e.target.checked })} /></label>
      <label className="row"><span>Attack alerts outside the app</span><button className="btn ghost" onClick={() => { try { Notification.requestPermission(); } catch { /* */ } }}>Allow</button></label>
      <label className="row"><span>{mirror.self?.guest ? 'Playing as a guest' : `Signed in${mirror.self?.email ? ` as ${mirror.self.email}` : ''}`}</span><button className="btn ghost" onClick={() => window.dispatchEvent(new Event('owc:signin'))}>{mirror.self?.guest ? 'Sign in' : 'Account'}</button></label>
      <label className="row col"><span>Name</span><span style={{ display: 'flex', gap: 8 }}><input id="set-name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} /><button className="btn ghost" onClick={() => conn.send({ t: 'profile', name: name.trim() })}>Rename</button></span></label>
    </div>
  );
}

function Help() {
  return (
    <div className="help">
      <h3>How to play</h3>
      <ul>
        <li><b>Everything stays near a king.</b> Pieces and buildings must be within 10 squares of one of your kings. Walk kings forward and your pieces follow.</li>
        <li><b>Build next to resources.</b> Each building draws from nodes within 3 squares: houses and stables from wheat, barracks from rock, temples from ore, the palace from ore and rock. Construction takes wood and stone from within 10 squares.</li>
        <li><b>Battles are chess.</b> Take a group with a king to an enemy king. After a countdown, both sides fight with up to one chess set. Lose your king and your survivors flee; the pieces it held go to the winner.</li>
        <li><b>Protect your Emperor</b> (the gold crown). If it falls, you start again somewhere new.</li>
        <li><b>Higher elo lands are richer:</b> buildings there produce faster and ore is common. The players there are stronger too.</li>
      </ul>
      <p className="muted">Phone: drag from your pieces to command · long-press and draw to select many · double-tap a piece for its king's group · pinch to zoom · twist with two fingers to rotate.</p>
    </div>
  );
}

function AttackConfirm() {
  const ui = useUI();
  const a = ui.pendingAttack!;
  const mine = a.pieceIds.map((id) => mirror.pieces.get(id)).filter(Boolean) as Piece[];
  const target = mirror.pieces.get(a.targetKingId);
  const theirs = target ? [...mirror.pieces.values()].filter((p) => p.owner === target.owner && cheb(p.x, p.y, target.x, target.y) <= REACH) : [];
  const val = (ps: Piece[]) => ps.reduce((s, p) => s + ({ K: 0, Q: 9, R: 5, B: 3, N: 3, P: 1 } as const)[p.kind], 0);
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && ui.set({ pendingAttack: null })}>
      <div className="sheet confirm">
        <h3>Attack {a.name}?</h3>
        <p>{a.siege ? 'A siege: they get 60 seconds to prepare.' : 'A field battle: 15 seconds until it starts.'} Both sides fight with at most one chess set. If your king falls, the pieces with it are lost.</p>
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
        const e = eloAt(mirror.seed, wx, wy);
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
      <span className="muted small">Area elo here: {mirror.seed && scene?.ready ? Math.round(eloAt(mirror.seed, scene.cam.x, scene.cam.y)) : '—'}</span>
    </div>
  );
}

export { conn };
