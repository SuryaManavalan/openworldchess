// The shop (docs/specs/cosmetics.md): cosmetic civilizations, bought with Crowns.
//
// Low-pressure by design: prices are in Crowns, previews show *your* empire in
// that style, and unlocking with Crowns you have is one tap. Only if you're
// short does the Crown packs step appear, and only a pack button leaves the
// game, for Stripe's own checkout page (Apple Pay, Google Pay and cards).
import { useEffect, useRef, useState } from 'react';
import { CIVS, CROWN_PACKS, type Civ, type PieceKind } from '@owc/shared';
import { commands, mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { buildingUrl, pieceUrl } from '../game/textures.ts';
import * as crownsArt from 'owc-art/crowns';
import { Icon } from './Icon.tsx';

const coinUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${(crownsArt.crownIcon as unknown as () => string)()}</svg>`);

/** A Crown coin, inline with text. */
export function Coin({ size = 16 }: { size?: number }) {
  return <img className="coin" src={coinUrl} width={size} height={size} alt="Crowns" />;
}

const PREVIEW: PieceKind[] = ['K', 'Q', 'N', 'P'];

function Preview({ civ }: { civ?: string }) {
  const color = mirror.self?.color ?? '#d9534a';
  return (
    <div className="civ-preview">
      <img className="bld" src={buildingUrl('palace', color, civ)} alt="" />
      <img className="bld" src={buildingUrl('temple', color, civ)} alt="" />
      <div className="pcs">{PREVIEW.map((k) => <img key={k} src={pieceUrl(k, 'light', color, false, civ)} alt="" />)}</div>
    </div>
  );
}

export function Shop() {
  const ui = useUI();
  const self = mirror.self;
  const crowns = self?.crowns ?? 0;
  const owned = new Set(self?.civsOwned ?? []);
  const [confirm, setConfirm] = useState<Civ | null>(null);
  const [packs, setPacks] = useState<{ need?: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Opened from the showcase: scroll to that civilization and make it glow.
  const listRef = useRef<HTMLDivElement>(null);
  const focus = ui.shopFocus;
  useEffect(() => {
    if (!focus) return;
    const el = listRef.current?.querySelector(`[data-civ="${focus}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => useUI.getState().set({ shopFocus: null }), 4000);
    return () => clearTimeout(t);
  }, [focus]);

  const unlock = async (c: Civ) => {
    setBusy(c.id);
    const err = await commands.buyCiv(c.id);
    setBusy(null); setConfirm(null);
    if (err) ui.toast(err, 'error');
    else ui.toast(`The ${c.name} civilization is yours`, 'good', 'crown');
  };
  const buy = async (pack: string) => {
    if (self?.guest) { window.dispatchEvent(new Event('owc:signin')); return; }
    setBusy(pack);
    const err = await commands.checkout(pack);
    // On success the page is already on its way to Stripe.
    if (err) { setBusy(null); ui.toast(err, 'error'); }
  };

  if (packs) {
    return (
      <div className="shop">
        <button className="back" onClick={() => setPacks(null)}><Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} /> Civilizations</button>
        <h3>Get Crowns</h3>
        {packs.need ? <p className="muted">You need {packs.need.toLocaleString()} more Crowns.</p> : <p className="muted">Crowns unlock civilizations for your empire.</p>}
        <div className="packs">
          {CROWN_PACKS.map((p) => (
            <button key={p.id} className="pack" disabled={!!busy || !self?.shopOpen} onClick={() => buy(p.id)}>
              <img src={`/img/crowns-${p.crowns}.png`} alt="" />
              <b><Coin size={15} /> {p.crowns.toLocaleString()}</b>
              {p.bonus && <span className="bonus">{p.bonus}</span>}
              <span className="price">{busy === p.id ? 'Opening…' : `$${(p.cents / 100).toFixed(2)}`}</span>
            </button>
          ))}
        </div>
        {!self?.shopOpen && <p className="muted small">The shop opens soon.</p>}
        {self?.guest && <p className="muted small">Sign in first, so your Crowns are saved to your account.</p>}
        <p className="muted small secure"><Icon name="shield" size={13} /> Secure checkout by Stripe · Apple Pay, Google Pay and cards</p>
      </div>
    );
  }

  return (
    <div className="shop">
      <div className="shop-head">
        <h3>Civilizations</h3>
        <button className="balance" onClick={() => setPacks({})}><Coin /> {crowns.toLocaleString()} <span className="plus">+</span></button>
      </div>
      <p className="muted">Restyle every piece and building in your empire. Everyone who visits your lands sees it. Looks only: it never changes how anything plays.</p>
      <div className="civs" ref={listRef}>
        <div className={`civ ${!self?.civ ? 'on' : ''}`}>
          <Preview />
          <div className="info"><b>Classic</b><span className="muted">The original look.</span></div>
          <button className="btn ghost" disabled={!self?.civ} onClick={() => commands.equipCiv(null)}>{!self?.civ ? 'In use' : 'Use'}</button>
        </div>
        {CIVS.map((c) => {
          const has = owned.has(c.id), inUse = self?.civ === c.id;
          return (
            <div key={c.id} data-civ={c.id} className={`civ ${inUse ? 'on' : ''} ${focus === c.id ? 'focus' : ''}`} style={{ ['--civ' as string]: c.color }}>
              <Preview civ={c.id} />
              <div className="info"><b>{c.name}</b><span className="muted">{c.tagline}</span></div>
              {has
                ? <button className="btn ghost" disabled={inUse} onClick={() => commands.equipCiv(c.id)}>{inUse ? 'In use' : 'Use'}</button>
                : confirm?.id === c.id
                  ? <div className="confirm-row">
                      <button className="btn" disabled={busy === c.id} onClick={() => unlock(c)}>Unlock for <Coin size={14} /> {c.price}</button>
                      <button className="btn ghost" onClick={() => setConfirm(null)}>Not now</button>
                    </div>
                  : <button className="btn" onClick={() => (crowns >= c.price ? setConfirm(c) : setPacks({ need: c.price - crowns }))}><Coin size={14} /> {c.price}</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
