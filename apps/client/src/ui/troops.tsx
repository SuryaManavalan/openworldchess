// Troops (movement.md §10): pieces out of your cities, holding where you sent them. The
// Troops panel lists them (jump to one, select it, call it home, call everyone home), and
// the selection bar reinforces the troop you have selected.
import { useState } from 'react';
import { PIECE_NAME, TROOP_CITY_R, cheb, type Piece, type PieceKind, type Troop } from '@owc/shared';
import { commands, mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { input, scene } from './GameView.tsx';
import { Icon } from './Icon.tsx';
import { pieceUrl } from '../game/textures.ts';

export const KINDS: PieceKind[] = ['K', 'Q', 'R', 'B', 'N', 'P'];

export const troopsOf = (): Troop[] => mirror.self?.troops ?? [];
export const idsOf = (t: Troop) => [...t.members, ...t.joining.map((j) => j.id)];

/** The troop a selection belongs to: every selected piece is in it (a member, or on its way). */
export function troopOfSelection(sel: number[]): Troop | undefined {
  if (!sel.length) return undefined;
  return troopsOf().find((t) => { const ids = new Set(idsOf(t)); return sel.every((id) => ids.has(id)); });
}

/** Your cities: their names and hearts (the settlements you hold). */
export function myCities() {
  return (scene?.settlements ?? []).filter((s) => s.owner === mirror.me).map((s) => ({ id: s.id, name: s.name, at: [s.cx, s.cy] as [number, number] }));
}

function where(at: [number, number], home?: boolean): string {
  const c = myCities().sort((a, b) => cheb(a.at[0], a.at[1], at[0], at[1]) - cheb(b.at[0], b.at[1], at[0], at[1]))[0];
  if (!c) return '';
  const dx = at[0] - c.at[0], dy = at[1] - c.at[1], d = cheb(at[0], at[1], c.at[0], c.at[1]);
  if (d <= TROOP_CITY_R) return home ? `to ${c.name}` : `at ${c.name}`;
  const dir = (dy < -d / 2 ? 'N' : dy > d / 2 ? 'S' : '') + (dx > d / 2 ? 'E' : dx < -d / 2 ? 'W' : '');
  return `${d} sq ${dir || 'from'} ${dir ? 'of ' : ''}${c.name}`;
}

/** What the troop is doing, in a few words. */
export function status(t: Troop): string {
  const ps = t.members.map((id) => mirror.pieces.get(id)).filter(Boolean) as Piece[];
  if (t.home) return 'Heading home';
  if (ps.some((p) => p.state === 'battle')) return 'In battle';
  if (ps.some((p) => p.state === 'moving')) return 'Marching';
  return 'Holding';
}

/**
 * The nearest piece of a kind that isn't already in `exclude` (and isn't fighting, and isn't
 * your Emperor: he never gets added without you tapping him).
 */
export function nearestOf(kind: PieceKind, from: [number, number], exclude: Set<number>): Piece | undefined {
  return mirror.myPieces().filter((p) => p.kind === kind && !p.emperor && p.state !== 'battle' && !exclude.has(p.id))
    .sort((a, b) => cheb(a.x, a.y, from[0], from[1]) - cheb(b.x, b.y, from[0], from[1]))[0];
}

export function selectTroop(t: Troop) {
  const ui = useUI.getState();
  ui.select(idsOf(t));
  ui.set({ sheet: null });
  scene?.flyTo(t.at[0], t.at[1], Math.max(scene.cam.zoom, 0.6));
  if (input) input.pendingMove = null;
}

/** Composition: a small piece image and count per kind. */
export function Makeup({ ids, joining = [] }: { ids: number[]; joining?: number[] }) {
  const color = mirror.self?.color ?? '#888', civ = mirror.self?.civ;
  const count = (kind: PieceKind, list: number[]) => list.filter((id) => mirror.pieces.get(id)?.kind === kind).length;
  return (
    <span className="makeup">
      {KINDS.map((k) => {
        const n = count(k, ids), j = count(k, joining);
        if (!n && !j) return null;
        const emp = k === 'K' && ids.some((id) => mirror.pieces.get(id)?.emperor);
        return <span key={k} className="mk" title={PIECE_NAME[k]}><img src={pieceUrl(k, 'light', color, emp, civ)} alt="" />{n}{j > 0 && <em title={`${j} on the way`}>+{j}</em>}</span>;
      })}
    </span>
  );
}

function TroopRow({ t, n }: { t: Troop; n: number }) {
  const ui = useUI();
  const home = async () => { const e = await commands.troopHome(t.id); if (e) ui.toast(e, 'error'); else ui.toast('The troop marches home', 'info'); };
  return (
    <div className="troop-row">
      <button className="troop-main" onClick={() => selectTroop(t)} title="Select this troop and go to it">
        <span className="troop-name"><Icon name="troop" size={15} /> Troop {n}</span>
        <Makeup ids={t.members} joining={t.joining.map((j) => j.id)} />
        <span className="troop-where">{status(t)}{where(t.at, t.home) ? ` · ${where(t.at, t.home)}` : ''}</span>
      </button>
      <div className="troop-acts">
        <button className="btn ghost small" onClick={() => selectTroop(t)}>Go</button>
        {!t.home && <button className="btn ghost small" onClick={home}>Home</button>}
      </div>
    </div>
  );
}

/** The Troops panel: every troop out, and calling them home. */
export function TroopList() {
  const ui = useUI();
  void ui.version;
  const list = troopsOf();
  const cities = myCities();
  const [to, setTo] = useState<string>('near');
  if (!list.length) return <p className="muted small">No troops are out. Send pieces out of your cities and they hold where you sent them, as a troop.</p>;
  const callAll = async () => {
    const c = cities.find((x) => String(x.id) === to);
    const e = await commands.troopsHome(c?.at);
    if (e) ui.toast(e, 'error'); else ui.toast(list.length > 1 ? 'Every troop marches home' : 'The troop marches home', 'info');
  };
  return (
    <div className="troop-list">
      {list.map((t, i) => <TroopRow key={t.id} t={t} n={i + 1} />)}
      {list.some((t) => !t.home) && (
        <div className="troop-all">
          <span>Call all to</span>
          <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Which city">
            <option value="near">each one's nearest city</option>
            {cities.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
          <button className="btn small" onClick={callAll}>Call home</button>
        </div>
      )}
    </div>
  );
}
