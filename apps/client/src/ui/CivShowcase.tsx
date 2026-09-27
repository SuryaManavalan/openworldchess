// Showing off the civilizations (cosmetics.md §5): now and then, never often, one
// civilization appears in the corner, with *your* empire already wearing it,
// and an invitation to the shop. One at a time, rotating, skipping ones you own.
import { useEffect, useState } from 'react';
import { CIVS, type Civ, type PieceKind } from '@owc/shared';
import { mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { buildingUrl, pieceUrl } from '../game/textures.ts';
import { Coin } from './Shop.tsx';
import { Icon } from './Icon.tsx';

/** Active play before the first showcase, and between showcases. */
const FIRST_MS = 20 * 60_000;
const EVERY_MS = 45 * 60_000;
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

const PIECES: PieceKind[] = ['K', 'Q', 'N', 'P'];
/** ?showcase in the URL shows one right away (for screenshots and checking). */
const FORCE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('showcase');

export function CivShowcase() {
  const ui = useUI();
  const [played, setPlayed] = useState(0);
  const [civ, setCiv] = useState<Civ | null>(null);
  const [leaving, setLeaving] = useState(false);
  // Count only active play (tab visible).
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) setPlayed((p) => p + 10_000); }, 10_000);
    return () => clearInterval(t);
  }, []);
  const self = mirror.self;
  const owned = new Set(self?.civsOwned ?? []);
  const quiet = !self || ui.needName || ui.battleFocus != null || ui.sheet != null || ui.pendingAttack != null || !!ui.inspect;
  useEffect(() => {
    if (civ || quiet) return;
    const last = Number(get('owc.showcaseAt') ?? 0);
    if (!FORCE && (played < FIRST_MS || (last && Date.now() - last < EVERY_MS))) return;
    const choices = CIVS.filter((c) => !owned.has(c.id));
    if (!choices.length) return;
    // New ones first, then rotate through the rest.
    const fresh = choices.find((c) => c.isNew && !get(`owc.showcased.${c.id}`));
    const i = Number(get('owc.showcaseNext') ?? 0);
    const pick = fresh ?? choices[i % choices.length];
    put('owc.showcaseNext', String(i + 1));
    put('owc.showcaseAt', String(Date.now()));
    put(`owc.showcased.${pick.id}`, '1');
    setCiv(pick);
  }, [played, quiet]);
  if (!civ || !self) return null;
  const close = () => { setLeaving(true); setTimeout(() => { setCiv(null); setLeaving(false); }, 250); };
  const look = () => { ui.set({ sheet: 'shop', shopFocus: civ.id }); close(); };
  const color = self.color ?? '#d9534a';
  return (
    <div className={`showcase ${leaving ? 'leaving' : ''}`} style={{ ['--civ' as string]: civ.color }} role="dialog" aria-label={`${civ.name} civilization`}>
      <button className="x" aria-label="Not now" onClick={close}><Icon name="close" size={13} stroke={2.6} /></button>
      <div className="stage">
        <div className="rays" />
        <img className="palace" src={buildingUrl('palace', color, civ.id)} alt="" />
        <img className="temple" src={buildingUrl('temple', color, civ.id)} alt="" />
        <div className="pieces">{PIECES.map((k, i) => <img key={k} src={pieceUrl(k, 'light', color, k === 'K', civ.id)} style={{ animationDelay: `${300 + i * 120}ms` }} alt="" />)}</div>
        <span className="spark s1" /><span className="spark s2" /><span className="spark s3" />
        {civ.isNew && <span className="new">New</span>}
      </div>
      <div className="copy">
        <span className="kicker">{civ.name} civilization</span>
        <b>{civ.pitch}</b>
        <span className="muted">{civ.tagline} Your empire, as everyone will see it.</span>
        <div className="row">
          <button className="btn gold" onClick={look}>Take a look</button>
          <span className="price"><Coin size={14} /> {civ.price}</span>
        </div>
      </div>
    </div>
  );
}
