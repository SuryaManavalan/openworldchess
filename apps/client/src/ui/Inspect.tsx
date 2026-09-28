// Inspecting things that aren't yours (ux.md §3): tap a piece or a camp to see
// exactly what it is ("Goblin Boss, King of the Goblin Warband"), and on desktop,
// hover for a name tag. Creatures keep their chess role front and center, so
// nobody has to guess how a Wolf Rider moves.
import { useEffect, useRef } from 'react';
import { FACTIONS, cheb, creatureName, REACH, type PieceKind } from '@owc/shared';
import { mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { scene } from './GameView.tsx';
import { creatureUrl, pieceUrl, buildingUrl } from '../game/textures.ts';
import { Icon } from './Icon.tsx';

export const ROLE_NAME: Record<PieceKind, string> = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' };
const TEMPER = {
  herd: { label: 'Herd', text: 'Peaceful. Fights only when you challenge its leader.' },
  lair: { label: 'Lair', text: 'Guards its home: attacks troops that come within 8 squares.' },
  horde: { label: 'Horde', text: 'Raiders: attacks troops in the open within 13 squares.' },
} as const;

/** What a piece is called, for tags and cards. */
export function pieceLabel(p: { kind: PieceKind; wild?: string; owner: string | null }) {
  return creatureName(p.wild, p.kind) ?? ROLE_NAME[p.kind];
}

export function Inspect() {
  const ui = useUI();
  const it = ui.inspect;
  if (!it) return null;
  const close = () => ui.set({ inspect: null });
  const p = it.piece != null ? mirror.pieces.get(it.piece) : undefined;
  const b = it.building != null ? mirror.buildings.get(it.building) : undefined;
  if (!p && !b) return null;
  const owner = p?.owner ?? b?.owner ?? null;
  const pl = owner ? mirror.players.get(owner) : undefined;
  const faction = p?.wild ? FACTIONS[p.wild] : b?.camp ? FACTIONS[b.camp.faction] : pl?.wild ? FACTIONS[pl.wild] : undefined;
  let art = '', title = '', sub = '';
  if (p) {
    art = p.wild ? creatureUrl(p.wild, p.kind) : pieceUrl(p.kind, 'light', pl?.color ?? '#9a9a9a', !!p.emperor, pl?.civ);
    title = pieceLabel(p);
    sub = faction ? `${ROLE_NAME[p.kind]} of the ${faction.name}` : p.emperor ? `Emperor of ${pl?.name ?? '?'}` : pl ? `${ROLE_NAME[p.kind]} · ${pl.name}` : 'Masterless';
  } else if (b) {
    art = b.camp && faction ? creatureUrl(faction.id, 'K') : buildingUrl(b.type === 'ruin' || b.type === 'camp' ? 'house' : b.type, pl?.color ?? '#9a9a9a', pl?.civ);
    title = b.camp?.name ?? (b.type === 'ruin' ? 'Ruin' : b.type[0].toUpperCase() + b.type.slice(1));
    sub = faction ? `Home of the ${faction.name}` : pl ? pl.name : 'Masterless';
  }
  // How strong is it? Count what we can see around its king.
  const king = owner ? [...mirror.pieces.values()].find((q) => q.owner === owner && q.kind === 'K' && (!p || cheb(q.x, q.y, p.x, p.y) <= REACH + 4)) : undefined;
  const band = king ? [...mirror.pieces.values()].filter((q) => q.owner === owner && cheb(q.x, q.y, king.x, king.y) <= REACH) : [];
  const counts = (['Q', 'R', 'B', 'N', 'P'] as PieceKind[]).map((k) => [k, band.filter((q) => q.kind === k).length] as const).filter(([, n]) => n);
  const myKing = ui.selection.map((id) => mirror.pieces.get(id)).find((q) => q?.kind === 'K');
  const attack = () => {
    if (!king) return;
    close();
    ui.set({ pendingAttack: { pieceIds: ui.selection, targetKingId: king.id, name: pl?.name ?? faction?.name ?? 'enemy', siege: false } });
  };
  return (
    <div className="inspect" onClick={(e) => e.stopPropagation()}>
      <button className="x" aria-label="Close" onClick={close}><Icon name="close" size={14} stroke={2.6} /></button>
      <div className="head">
        <img src={art} alt="" />
        <div>
          <b>{title}</b>
          <span>{sub}</span>
          {pl && <span className="rating">Rating {pl.rating}{pl.provisional ? '?' : ''}</span>}
        </div>
      </div>
      {faction && (
        <>
          <div className="badges">
            <span className={`badge temper-${faction.temper}`}>{TEMPER[faction.temper].label}</span>
            <span className="badge">{faction.camp}</span>
            {faction.rarity !== 'common' && <span className={`badge rarity-${faction.rarity}`}>{faction.rarity}</span>}
          </div>
          <p className="lore">{faction.lore}</p>
          <p className="temper">{TEMPER[faction.temper].text}</p>
          {king && (
            <div className="band">
              {[['K', 1] as const, ...counts].map(([k, n]) => (
                <span key={k} title={faction.roles[k]}><img src={creatureUrl(faction.id, k)} alt="" />{n > 1 ? `×${n}` : ''}<small>{faction.roles[k]}</small></span>
              ))}
            </div>
          )}
          <p className="note">Beat its king in battle to scatter the camp and clear the land. Creatures never join your side.</p>
          {myKing && king && <button className="btn danger" onClick={attack}><Icon name="swords" size={16} /> Challenge the {faction.roles.K}</button>}
        </>
      )}
    </div>
  );
}

/** Desktop: a name tag that follows the mouse over pieces and camps. */
export function HoverTag() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0, last = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const sc = scene, node = el.current;
      if (!sc?.ready || !node) return;
      const h = sc.hoverInfo;
      let text = '';
      if (h) {
        const p = h.piece != null ? mirror.pieces.get(h.piece) : undefined;
        const b = h.building != null ? mirror.buildings.get(h.building) : undefined;
        if (p && p.owner !== mirror.me) {
          const pl = p.owner ? mirror.players.get(p.owner) : undefined;
          text = p.wild ? `${pieceLabel(p)} · ${FACTIONS[p.wild]?.name ?? ''}` : `${ROLE_NAME[p.kind]} · ${pl?.name ?? 'Masterless'}`;
        } else if (b?.camp) text = `${b.camp.name} · ${FACTIONS[b.camp.faction]?.name ?? ''}`;
      }
      if (text !== last) { node.textContent = text; last = text; }
      node.style.display = text ? '' : 'none';
      if (text && h) node.style.transform = `translate(${h.sx + 14}px, ${h.sy + 16}px)`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div className="hover-tag" ref={el} style={{ display: 'none' }} />;
}
