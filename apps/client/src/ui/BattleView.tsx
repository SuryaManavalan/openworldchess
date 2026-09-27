// The battle screen (ux.md §4): plain chess, laid out like a chess app.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { FACTIONS, creatureName, type BattlePublic, type PieceKind } from '@owc/shared';
import { commands, mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { ascendedUrl, creatureUrl, pieceUrl } from '../game/textures.ts';
import { ROLE_NAME } from './Inspect.tsx';
import { audio } from '../audio/audio.ts';

const FILES = 'abcdefgh';
import { EMOTE_ICONS, EMOTE_LABELS, Icon } from './Icon.tsx';

function fmt(ms: number) {
  ms = Math.max(0, ms);
  const s = Math.ceil(ms / 1000);
  if (ms < 10_000) return (ms / 1000).toFixed(1);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function BattleView({ battle }: { battle: BattlePublic }) {
  const ui = useUI();
  const me = mirror.me;
  const side = battle.white.playerId === me ? 'white' : battle.black.playerId === me ? 'black' : null;
  const bottom = side ?? 'white';
  const chess = useMemo(() => { try { return new Chess(battle.fen || undefined); } catch { return new Chess(); } }, [battle.fen]);
  const [sel, setSel] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [drag, setDrag] = useState<{ from: string; x: number; y: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const prevFen = useRef<string>('');
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (prevFen.current && battle.fen && prevFen.current !== battle.fen) {
      const a = new Chess(prevFen.current), b = new Chess(battle.fen);
      const diff = new Set<string>();
      for (let f = 0; f < 8; f++) for (let r = 1; r <= 8; r++) {
        const sq = (FILES[f] + r) as Square;
        const x = a.get(sq), y = b.get(sq);
        if ((x?.type ?? '') + (x?.color ?? '') !== (y?.type ?? '') + (y?.color ?? '')) diff.add(sq);
      }
      setChanged(diff);
      setSel(null);
    }
    prevFen.current = battle.fen;
  }, [battle.fen]);

  const turn = chess.turn() === 'w' ? 'white' : 'black';
  const myTurn = side === turn && battle.phase === 'live';
  void now; // re-render every 100ms for the clocks
  const serverNow = mirror.serverNow();
  const clock = (c: 'white' | 'black') => {
    const base = battle.clocks[c];
    if (battle.phase === 'live' && turn === c && battle.clocks.turnStartedAt) return base - (serverNow - battle.clocks.turnStartedAt);
    return base;
  };
  const myClock = side ? clock(side) : 0;
  useEffect(() => { if (myTurn && myClock < 10_000 && myClock > 0 && Math.floor(myClock / 1000) !== Math.floor((myClock + 100) / 1000)) audio.lowClock(); }, [myClock, myTurn]);

  const legalFrom = useMemo(() => (sel ? chess.moves({ square: sel as Square, verbose: true }).map((m) => m.to) : []), [sel, chess]);
  // En passant lands on an empty square but captures: show it as a capture.
  const epTargets = useMemo(() => (sel ? chess.moves({ square: sel as Square, verbose: true }).filter((m) => m.flags.includes('e')).map((m) => m.to as string) : []), [sel, chess]);
  const inCheckSq = useMemo(() => {
    if (!chess.inCheck()) return null;
    for (let f = 0; f < 8; f++) for (let r = 1; r <= 8; r++) { const sq = FILES[f] + r; const p = chess.get(sq as Square); if (p && p.type === 'k' && p.color === chess.turn()) return sq; }
    return null;
  }, [chess]);

  const tryMove = (from: string, to: string) => {
    const mv = chess.moves({ square: from as Square, verbose: true }).find((m) => m.to === to);
    if (!mv) return false;
    if (mv.promotion) { setPromo({ from, to }); return true; }
    commands.battleMove(battle.id, from + to);
    setSel(null);
    return true;
  };

  const onSquare = (sq: string) => {
    if (!myTurn) return;
    const p = chess.get(sq as Square);
    if (sel && sel !== sq && tryMove(sel, sq)) return;
    if (p && (p.color === 'w') === (side === 'white')) { setSel(sq); audio.select(0); } else setSel(null);
  };

  const squareAt = (cx: number, cy: number) => {
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const f = Math.floor(((cx - r.left) / r.width) * 8), rk = Math.floor(((cy - r.top) / r.height) * 8);
    if (f < 0 || f > 7 || rk < 0 || rk > 7) return null;
    return bottom === 'white' ? FILES[f] + (8 - rk) : FILES[7 - f] + (rk + 1);
  };

  const pieceImg = (type: string, color: string, sq: string) => {
    const white = color === 'w';
    const pid = battle.pieceMap[sq];
    const emperor = !!(pid && mirror.pieces.get(pid)?.emperor);
    const wild = mirror.players.get(white ? battle.white.playerId : battle.black.playerId)?.wild;
    // A promoted pawn wears its new piece like a borrowed spirit, for this battle only.
    if (pid != null && type !== 'p' && battle.promoted?.includes(pid)) return ascendedUrl(type.toUpperCase() as PieceKind, white ? 'light' : 'dark', white ? battle.white.color : battle.black.color, wild);
    if (wild) return creatureUrl(wild, type.toUpperCase() as PieceKind);
    return pieceUrl(type.toUpperCase() as PieceKind, white ? 'light' : 'dark', white ? battle.white.color : battle.black.color, emperor);
  };

  // Creatures glow faintly in their faction's color, so they never blend with your pieces.
  const wildOf = (color: string) => mirror.players.get(color === 'w' ? battle.white.playerId : battle.black.playerId)?.wild;
  // Creatures are named on hover, so nobody wonders what a Wolf Rider does.
  const pieceTitle = (type: string, color: string, sq: string) => {
    const wild = mirror.players.get(color === 'w' ? battle.white.playerId : battle.black.playerId)?.wild;
    const kind = type.toUpperCase() as PieceKind;
    const pid = battle.pieceMap[sq];
    if (pid != null && type !== 'p' && battle.promoted?.includes(pid)) return `${wild ? creatureName(wild, 'P') : 'Pawn'}, fighting as a ${ROLE_NAME[kind].toLowerCase()} for this battle only`;
    return wild ? `${creatureName(wild, kind)} (${ROLE_NAME[kind]})` : undefined;
  };

  const rows = [];
  for (let rk = 0; rk < 8; rk++)
    for (let f = 0; f < 8; f++) {
      const sq = bottom === 'white' ? FILES[f] + (8 - rk) : FILES[7 - f] + (rk + 1);
      const light = (f + rk) % 2 === 0;
      const p = chess.get(sq as Square);
      const dragging = drag?.from === sq;
      rows.push(
        <div key={sq} className={`sq ${light ? 'light' : 'dark'} ${changed.has(sq) ? 'last' : ''} ${sel === sq ? 'sel' : ''} ${inCheckSq === sq ? 'check' : ''}`}
          onPointerDown={(e) => {
            if (!myTurn) return;
            const pc = chess.get(sq as Square);
            if (pc && (pc.color === 'w') === (side === 'white')) { setSel(sq); setDrag({ from: sq, x: e.clientX, y: e.clientY }); (e.target as Element).setPointerCapture?.(e.pointerId); }
            else onSquare(sq);
          }}
          onPointerMove={(e) => { if (drag) setDrag({ ...drag, x: e.clientX, y: e.clientY }); }}
          onPointerUp={(e) => {
            if (!drag) return;
            const to = squareAt(e.clientX, e.clientY);
            setDrag(null);
            if (to && to !== drag.from) tryMove(drag.from, to);
          }}>
          {f === 0 && <span className="coord r">{sq[1]}</span>}
          {rk === 7 && <span className="coord f">{sq[0]}</span>}
          {legalFrom.includes(sq as Square) && <span className={p || epTargets.includes(sq) ? 'hint cap' : 'hint'} />}
          {p && <img src={pieceImg(p.type, p.color, sq)} className={dragging ? 'ghosted' : wildOf(p.color) ? 'wild' : ''} style={wildOf(p.color) ? { ['--glow' as string]: FACTIONS[wildOf(p.color)!]?.art.accent } : undefined} draggable={false} alt="" title={pieceTitle(p.type, p.color, sq)} />}
        </div>,
      );
    }

  const player = (c: 'white' | 'black') => {
    const info = battle[c];
    const low = battle.phase === 'live' && clock(c) < 20_000;
    const active = battle.phase === 'live' && turn === c;
    return (
      <div className={`bar ${active ? 'active' : ''}`}>
        <span className="chip" style={{ background: info.color }} />
        <span className="name">{info.name}</span>
        <span className="rating">{info.rating}</span>
        {mirror.players.get(battle[c].playerId)?.wild ? <span className="badge">Wild</span> : battle.aiControlled[c] && <span className="badge">AI playing</span>}
        {battle.drawOfferBy === c && <span className="badge">offers a draw</span>}
        <span className={`clock ${active ? 'on' : ''} ${low ? 'low' : ''}`}>{fmt(clock(c))}</span>
      </div>
    );
  };
  const top = bottom === 'white' ? 'black' : 'white';
  const secs = Math.max(0, Math.ceil((battle.startsAt - mirror.serverNow()) / 1000));
  const emote = ui.hint?.startsWith('emote:') ? ui.hint.split(':') : null;
  const emoteShown = emote && Date.now() - Number(emote[3]) < 2500 ? EMOTE_ICONS[Number(emote[2])] : null;

  return (
    <div className="battle-overlay" onClick={(e) => { if (e.target === e.currentTarget && !side) ui.set({ battleFocus: null }); }}>
      <div className="battle">
        <div className="battle-head">
          <span className="kind">{battle.kind === 'siege' ? 'Siege' : battle.kind === 'practice' ? 'Practice battle' : 'Field battle'}{!side && ' · watching'}</span>
          <button className="icon-btn" aria-label="Close" onClick={() => ui.set({ battleFocus: null })}><Icon name="close" size={18} /></button>
        </div>
        {player(top)}
        <div className="board-wrap">
          <div className="board" ref={boardRef}>{rows}</div>
          {drag && (() => { const pc = chess.get(drag.from as Square); return pc ? <img className="drag-piece" style={{ left: drag.x, top: drag.y }} src={pieceImg(pc.type, pc.color, drag.from)} alt="" /> : null; })()}
          {promo && (
            <div className="promo">
              {(['q', 'r', 'b', 'n'] as const).map((k) => (
                <button key={k} onClick={() => { commands.battleMove(battle.id, promo.from + promo.to + k); setPromo(null); setSel(null); }}>
                  <img src={pieceImg(k, side === 'white' ? 'w' : 'b', '')} alt={k} />
                </button>
              ))}
            </div>
          )}
          {battle.phase === 'countdown' && (
            <div className="board-cover">
              <div className="count">{secs}</div>
              <div>The armies are assembling</div>
              {side === 'white' && <button className="btn ghost" onClick={() => commands.cancelAttack(battle.id)}>Call off the attack</button>}
            </div>
          )}
          {battle.phase === 'over' && (
            <div className="board-cover over">
              <div className="result">{battle.result === 'draw' || !battle.result ? 'Draw' : battle.result === side ? 'Victory' : side ? 'Defeat' : `${battle[battle.result].name} wins`}</div>
              <div>{battle.termination}</div>
              <button className="btn" onClick={() => ui.set({ battleFocus: null })}>Back to the world</button>
            </div>
          )}
          {emoteShown && <div className="emote-pop"><Icon name={emoteShown} size={72} stroke={1.8} /></div>}
        </div>
        {player(bottom)}
        <div className="moves">{battle.moves.map((m, i) => <span key={i}>{i % 2 === 0 && <b>{i / 2 + 1}.</b>}{m}</span>)}</div>
        <div className="battle-actions">
          {EMOTE_ICONS.map((e, i) => <button key={i} className="emote" aria-label={EMOTE_LABELS[i]} title={EMOTE_LABELS[i]} onClick={() => commands.emote(i, battle.id)}><Icon name={e} size={22} /></button>)}
          {side && battle.phase === 'live' && <>
            <button className="btn ghost" onClick={() => commands.draw(battle.id)}>{battle.drawOfferBy && battle.drawOfferBy !== side ? 'Accept draw' : <><Icon name="draw" size={15} /> Draw</>}</button>
            {confirmResign
              ? <button className="btn danger" onClick={() => { commands.resign(battle.id); setConfirmResign(false); }}>Confirm resign</button>
              : <button className="btn ghost" onClick={() => { setConfirmResign(true); setTimeout(() => setConfirmResign(false), 3000); }}><Icon name="resign" size={15} /> Resign</button>}
          </>}
          {side === 'black' && battle.phase === 'countdown' && battle.kind === 'field' && <button className="btn ghost" onClick={() => commands.resign(battle.id)}>Surrender now</button>}
        </div>
      </div>
    </div>
  );
}
