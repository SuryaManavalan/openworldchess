// Find (docs/specs/social.md): search rulers and cities by name, see how far they are from you,
// fly there, copy a link to share, and keep friends in a list (saved in this browser).
// Also deep links: openworldchess.com/?city=Rookbridge, ?player=Steven, ?at=x,y.
import { useEffect, useRef, useState } from 'react';
import { TITLES, cheb } from '@owc/shared';
import { VISIT, mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { scene } from './GameView.tsx';
import { Icon } from './Icon.tsx';

interface City { name: string; owner: string; ownerId: string; tier: number; buildings: number; at: [number, number] }
interface Ruler { name: string; id: string; title: number; cities: City[]; home: [number, number] }
interface Friend { id: string; name: string; at: [number, number] }

const TIER = ['', 'hamlet', 'village', 'town', 'city'];
const readFriends = (): Friend[] => { try { return JSON.parse(localStorage.getItem('owc.friends') ?? '[]'); } catch { return []; } };
const writeFriends = (f: Friend[]) => { try { localStorage.setItem('owc.friends', JSON.stringify(f.slice(0, 50))); } catch { /* private mode */ } };

export async function find(q: string): Promise<{ players: Ruler[]; cities: City[] }> {
  try { const r = await fetch(`/api/find?q=${encodeURIComponent(q)}`); if (r.ok) return await r.json(); } catch { /* offline */ }
  return { players: [], cities: [] };
}

/** Where you are: your nearest king to the camera, else home. */
function me(): [number, number] {
  const ks = mirror.myKings();
  const cx = scene?.cam.x ?? 0, cy = scene?.cam.y ?? 0;
  const k = ks.sort((a, b) => cheb(a.x, a.y, cx, cy) - cheb(b.x, b.y, cx, cy))[0];
  return k ? [k.x, k.y] : mirror.self?.home ?? [0, 0];
}
/** "320 squares north-east" (or "here"). */
export function howFar(at: [number, number]): string {
  const [x, y] = me(), d = cheb(x, y, at[0], at[1]);
  if (d < 12) return 'right here';
  const dx = at[0] - x, dy = at[1] - y;
  const dir = (dy < -d / 2.4 ? 'north' : dy > d / 2.4 ? 'south' : '') + (dx > d / 2.4 ? (dy < -d / 2.4 || dy > d / 2.4 ? '-east' : 'east') : dx < -d / 2.4 ? (dy < -d / 2.4 || dy > d / 2.4 ? '-west' : 'west') : '');
  const n = d >= 1000 ? `${(d / 1000).toFixed(1)}k` : String(d);
  return `${n} squares ${dir}`;
}

export function goTo(at: [number, number], zoom = 0.45) {
  if (!scene) return;
  scene.flyTo(at[0], at[1], zoom);
  useUI.getState().set({ sheet: null });
}
const linkTo = (q: string) => `${location.origin}/?${q}`;

function Share({ q, label }: { q: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn ghost small" title={`Copy a link to ${label}`} onClick={() => {
      const url = linkTo(q);
      navigator.clipboard?.writeText(url).then(() => setDone(true), () => window.prompt('Copy this link', url));
      setTimeout(() => setDone(false), 1500);
    }}><Icon name="link" size={14} /> {done ? 'Copied' : 'Link'}</button>
  );
}

function CityRow({ c, showOwner = true }: { c: City; showOwner?: boolean }) {
  return (
    <div className="find-row">
      <button className="find-main" onClick={() => goTo(c.at)}>
        <span className="find-name"><Icon name="castle" size={15} /> {c.name}</span>
        <span className="find-sub">{TIER[c.tier] ?? 'town'}{showOwner ? ` of ${c.owner}` : ''} · {c.buildings} buildings · {howFar(c.at)}</span>
      </button>
      <div className="find-acts">
        <button className="btn small" onClick={() => goTo(c.at)}>Go</button>
        <Share q={`city=${encodeURIComponent(c.name)}&at=${c.at.join(',')}`} label={c.name} />
      </div>
    </div>
  );
}

function RulerRow({ r, friends, toggle }: { r: Ruler; friends: Friend[]; toggle: (r: Ruler) => void }) {
  const isFriend = friends.some((f) => f.id === r.id);
  const you = r.id === mirror.me;
  return (
    <div className="find-ruler">
      <div className="find-row">
        <button className="find-main" onClick={() => goTo(r.home)}>
          <span className="find-name"><Icon name="crown" size={15} /> {r.name}{you ? ' (you)' : ''}</span>
          <span className="find-sub">{TITLES[r.title]?.name ?? 'Settler'} · {r.cities.length ? `${r.cities.length} ${r.cities.length > 1 ? 'towns' : 'town'}` : 'no town yet'} · {howFar(r.home)}</span>
        </button>
        <div className="find-acts">
          {!you && <button className={`btn ghost small ${isFriend ? 'on' : ''}`} title={isFriend ? 'Remove from friends' : 'Add to friends'} onClick={() => toggle(r)}><Icon name="star" size={14} /> {isFriend ? 'Friend' : 'Add'}</button>}
          <Share q={`player=${encodeURIComponent(r.name)}`} label={r.name} />
        </div>
      </div>
      {r.cities.length > 1 && <div className="find-cities">{r.cities.slice(0, 3).map((c) => <button key={c.name + c.at.join()} className="chip" onClick={() => goTo(c.at)}><Icon name="castle" size={12} /> {c.name} · {howFar(c.at)}</button>)}</div>}
    </div>
  );
}

export function FindPanel() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ players: Ruler[]; cities: City[] } | null>(null);
  const [friends, setFriends] = useState<Friend[]>(readFriends);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { if (useUI.getState().layout !== 'phone') box.current?.focus(); }, []);
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(() => { void find(q).then(setRes); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  // Friends' latest whereabouts (their names may have moved towns).
  useEffect(() => {
    let alive = true;
    void (async () => {
      const next = [...readFriends()];
      for (const f of next) { const r = (await find(f.name)).players.find((p) => p.id === f.id); if (r) { f.at = r.home; f.name = r.name; } }
      if (alive) { setFriends(next); writeFriends(next); }
    })();
    return () => { alive = false; };
  }, []);
  const toggle = (r: Ruler) => {
    const next = friends.some((f) => f.id === r.id) ? friends.filter((f) => f.id !== r.id) : [...friends, { id: r.id, name: r.name, at: r.home }];
    setFriends(next); writeFriends(next);
  };
  return (
    <div className="find">
      <h3>Find</h3>
      <label className="find-box"><Icon name="search" size={18} /><input ref={box} value={q} onChange={(e) => setQ(e.target.value)} placeholder="A ruler or a city" maxLength={30} enterKeyHint="search" /></label>
      {!res && (
        <>
          <h4 className="find-h">Friends</h4>
          {friends.length ? friends.map((f) => (
            <div key={f.id} className="find-row">
              <button className="find-main" onClick={() => goTo(f.at)}>
                <span className="find-name"><Icon name="star" size={15} /> {f.name}</span>
                <span className="find-sub">{howFar(f.at)}</span>
              </button>
              <div className="find-acts">
                <button className="btn small" onClick={() => goTo(f.at)}>Go</button>
                <button className="btn ghost small" aria-label={`Remove ${f.name}`} onClick={() => { const next = friends.filter((x) => x.id !== f.id); setFriends(next); writeFriends(next); }}><Icon name="close" size={13} /></button>
              </div>
            </div>
          )) : <p className="muted small">Search for a ruler and tap Add: they'll stay here, with how far away they are.</p>}
        </>
      )}
      {res && (
        <>
          {res.players.length > 0 && <><h4 className="find-h">Rulers</h4>{res.players.map((r) => <RulerRow key={r.id} r={r} friends={friends} toggle={toggle} />)}</>}
          {res.cities.length > 0 && <><h4 className="find-h">Cities</h4>{res.cities.map((c) => <CityRow key={c.name + c.at.join()} c={c} />)}</>}
          {!res.players.length && !res.cities.length && <p className="muted small">No ruler or city by that name.</p>}
        </>
      )}
    </div>
  );
}

/**
 * Deep links: ?city=Name, ?player=Name or ?at=x,y fly the camera there once the world is up,
 * then the link is taken out of the address bar (a reload goes home as usual).
 */
export async function followDeepLink() {
  const sp = new URLSearchParams(location.search);
  const city = sp.get('city'), player = sp.get('player'), at = sp.get('at');
  if (!city && !player && !at) return;
  let to: [number, number] | null = null, label = '';
  // (Names can repeat across the world: a link with a spot too goes to exactly that one.)
  if (at) { const [x, y] = at.split(',').map(Number); if (Number.isFinite(x) && Number.isFinite(y)) { to = [Math.round(x), Math.round(y)]; label = city ?? (player ? `${player}'s lands` : 'that spot'); } }
  else {
    const r = await find(city ?? player ?? '');
    const want = (city ?? player ?? '').toLowerCase();
    const c = city ? r.cities.find((x) => x.name.toLowerCase() === want) ?? r.cities[0] : undefined;
    const p = player ? r.players.find((x) => x.name.toLowerCase() === want) ?? r.players[0] : undefined;
    if (c) { to = c.at; label = `${c.name}, the ${TIER[c.tier] ?? 'town'} of ${c.owner}`; }
    else if (p) { to = p.home; label = `${p.name}'s lands`; }
  }
  if (!VISIT) { for (const k of ['city', 'player', 'at']) sp.delete(k); history.replaceState(null, '', location.pathname + (sp.toString() ? `?${sp}` : '') + location.hash); }
  visiting = label;
  if (!to || !scene) { useUI.getState().toast('That place couldn\'t be found', 'error'); return; }
  scene.centerOn(to[0], to[1]);
  scene.cam.zoom = 0.45;
  if (!VISIT) useUI.getState().toast(`You're looking at ${label}. ${useUI.getState().layout === 'phone' ? 'Tap a king to come home.' : 'H takes you home.'}`, 'info');
  useUI.getState().bump();
}

/** What a visitor is looking at (for the visit bar). */
export let visiting = '';

/** The visitor's bar (social.md §2): where they are, and the way in. */
export function VisitBar() {
  useUI();
  return (
    <div className="visit-bar">
      <div className="visit-text"><b>{visiting ? `Visiting ${visiting}` : 'Visiting the Board'}</b><span>Every city here is built by a player. The whole world is one chessboard.</span></div>
      <button className="btn gold" onClick={() => { location.href = location.origin + '/'; }}>Play free</button>
    </div>
  );
}
