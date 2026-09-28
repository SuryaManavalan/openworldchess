// A shrine's riddle (campaign.md §5.3): a mate in 1 or 2 on a small board. Tap a piece, then
// its square. The server checks every move: a right one gets the defense's reply, a wrong
// one resets the riddle. Solved, the quest pays out.
import { useEffect, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { commands, mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { pieceUrl } from '../game/textures.ts';
import { audio } from '../audio/audio.ts';
import { SheetGrab } from './SheetGrab.tsx';

const KIND: Record<string, 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'> = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' };

export function Riddle() {
  const ui = useUI();
  const id = ui.riddle;
  const q = mirror.self?.chronicle?.sides.find((x) => x.id === id);
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  useEffect(() => { setSel(null); setNote(null); setSolved(false); }, [id]);
  if (id == null) return null;
  const close = () => ui.set({ riddle: null });
  // Solved: the quest is gone from the list.
  if (!q?.puzzle) return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet confirm riddle">
        <SheetGrab onClose={close} />
        <h3>{solved ? 'The shrine is answered' : 'No riddle here'}</h3>
        <p>{solved ? 'Checkmate. The shrine grants its reward.' : 'Bring one of your pieces to the shrine first.'}</p>
        <button className="btn" onClick={close}>Onward</button>
      </div>
    </div>
  );
  const c = new Chess(q.puzzle.fen);
  const white = c.turn() === 'w';
  const targets = sel ? new Set(c.moves({ square: sel as Square, verbose: true }).map((m) => m.to)) : new Set<string>();
  const color = mirror.self?.color ?? '#888';
  const tap = (sq: string) => {
    const pc = c.get(sq as Square);
    if (pc && pc.color === c.turn()) { setSel(sq); audio.select(0); return; }
    if (!sel || !targets.has(sq as Square)) { setSel(null); return; }
    const promo = c.get(sel as Square)?.type === 'p' && (sq[1] === '8' || sq[1] === '1') ? 'q' : '';
    const uci = sel + sq + promo;
    setSel(null);
    const test = new Chess(q.puzzle!.fen);
    test.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: promo || undefined });
    audio.clack(!!c.get(sq as Square), test.inCheck());
    void commands.solveQuest(q.id, uci).then((err) => {
      if (err) { setNote(err); audio.error(); }
      else if (test.isCheckmate()) { setSolved(true); audio.mate(true); }
      else setNote('Right. Now finish it.');
    });
  };
  const rows = [];
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const file = white ? f : 7 - f, rank = white ? 7 - r : r;
      const sq = String.fromCharCode(97 + file) + (rank + 1);
      const pc = c.get(sq as Square);
      const light = (file + rank) % 2 === 1;
      rows.push(
        <div key={sq} className={`sq ${light ? 'light' : 'dark'} ${sel === sq ? 'sel' : ''}`} onClick={() => tap(sq)}>
          {pc && <img src={pieceUrl(KIND[pc.type], pc.color === 'w' ? 'light' : 'dark', pc.color === c.turn() ? color : '#8a8a8a', false, mirror.self?.civ)} alt="" />}
          {targets.has(sq as Square) && <span className={`hint ${pc ? 'cap' : ''}`} />}
        </div>,
      );
    }
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet confirm riddle">
        <SheetGrab onClose={close} />
        <h3>The shrine's riddle</h3>
        <p><b>{white ? 'White' : 'Black'} to play. Mate in {q.puzzle.left}.</b> {q.puzzle.left < q.puzzle.n ? 'The defense has answered.' : 'Only one first move works.'}</p>
        <div className="riddle-board board">{rows}</div>
        {note && <p className={note.startsWith('Right') ? 'good-text' : 'warn-text'}>{note}</p>}
        <button className="btn ghost" onClick={close}>Later</button>
      </div>
    </div>
  );
}
