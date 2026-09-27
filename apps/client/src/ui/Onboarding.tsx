// First-run welcome, the "While you were away" report (progression.md §5),
// and a light guided first session (ROADMAP M6) that advances as you play.
import { useEffect, useState } from 'react';
import { conn, mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { pieceUrl } from '../game/textures.ts';
import { scene } from './GameView.tsx';

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function Welcome() {
  const ui = useUI();
  const [open, setOpen] = useState(() => !get('owc.welcomed'));
  const [name, setName] = useState('');
  useEffect(() => { if (mirror.self && !name) setName(mirror.self.name); }, [ui.version]);
  if (!open) return null;
  const color = mirror.self?.color ?? '#d9534a';
  const enter = () => {
    const n = name.trim();
    if (n && n !== mirror.self?.name) conn.send({ t: 'profile', name: n });
    put('owc.welcomed', '1');
    setOpen(false);
  };
  return (
    <div className="welcome-backdrop">
      <div className="welcome">
        <div className="welcome-pieces">
          {(['R', 'N', 'B', 'K', 'Q', 'P'] as const).map((k, i) => <img key={k} src={pieceUrl(k, 'light', color, k === 'K')} style={{ animationDelay: `${i * 90}ms` }} alt="" />)}
        </div>
        <h1>Open World Chess</h1>
        <p>The whole world is a chessboard. Settle near resources, raise an army, and take what other rulers hold, one game of chess at a time.</p>
        <label htmlFor="welcome-name">Your name</label>
        <input id="welcome-name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enter()} />
        <button className="btn big" onClick={enter}>Enter the world</button>
        <p className="muted small">No sign-up. Your realm is saved on this device.</p>
      </div>
    </div>
  );
}

export function AwayReport() {
  const [report, setReport] = useState<{ since: number; events: { at: number; kind: string; text: string }[] } | null>(null);
  useEffect(() => { mirror.onAway = (m) => setReport(m); }, []);
  if (!report) return null;
  const mins = Math.round((Date.now() - report.since) / 60000);
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && setReport(null)}>
      <div className="sheet">
        <div className="grabber" />
        <h3>While you were away <span className="muted small">({mins < 90 ? `${mins} min` : `${Math.round(mins / 60)} h`})</span></h3>
        <ul className="away-list">{report.events.slice(-12).reverse().map((e, i) => <li key={i} className={e.kind}>{e.text}</li>)}</ul>
        <button className="btn" style={{ width: '100%' }} onClick={() => setReport(null)}>Back to the world</button>
      </div>
    </div>
  );
}

const STEPS = [
  { id: 'select', text: (phone: boolean) => phone ? 'Double-tap your Emperor (gold crown) to select its group.' : 'Double-click your Emperor (gold crown) to select its group.' },
  { id: 'move', text: (phone: boolean) => phone ? 'Drag from your pieces to a square to march there.' : 'Right-click a square to march there.' },
  { id: 'house', text: () => 'Build a house (🔨) next to wheat. It will produce pawns.' },
  { id: 'battle', text: () => 'Battles are chess. Try a practice battle from the ⚔ menu.' },
] as const;

export function Guide() {
  const ui = useUI();
  const [done, setDone] = useState<string[]>(() => JSON.parse(get('owc.guide') ?? '[]'));
  const [hidden, setHidden] = useState(() => get('owc.guide.hidden') === '1');
  useEffect(() => {
    const d = new Set(done);
    const emp = mirror.myPieces().find((p) => p.emperor);
    if (emp && ui.selection.includes(emp.id)) d.add('select');
    if (mirror.myPieces().some((p) => p.state === 'moving')) d.add('move');
    if (mirror.myBuildings().some((b) => b.type === 'house')) d.add('house');
    if ([...mirror.battles.values()].some((b) => b.white.playerId === mirror.me || b.black.playerId === mirror.me)) d.add('battle');
    if (d.size !== done.length) { const arr = [...d]; setDone(arr); put('owc.guide', JSON.stringify(arr)); }
  }, [ui.version, ui.selection]);
  const step = STEPS.find((s) => !done.includes(s.id));
  if (hidden || !step || get('owc.welcomed') !== '1') return null;
  return (
    <div className="guide">
      <span className="step">{STEPS.indexOf(step) + 1}/{STEPS.length}</span>
      <span>{step.text(ui.layout === 'phone')}</span>
      {step.id === 'select' && <button className="link" onClick={() => { const e = mirror.myPieces().find((p) => p.emperor); if (e) scene?.centerOn(e.x, e.y); }}>Show me</button>}
      <button className="icon-btn small" aria-label="Hide guide" onClick={() => { setHidden(true); put('owc.guide.hidden', '1'); }}>✕</button>
    </div>
  );
}
