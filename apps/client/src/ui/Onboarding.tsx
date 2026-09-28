// First-run welcome, the "While you were away" report (progression.md §5),
// and a light guided first session (ROADMAP M6) that advances as you play.
import { useEffect, useState } from 'react';
import { randomName } from '@owc/shared';
import { conn, mirror } from '../net.ts';
import { Icon } from './Icon.tsx';
import type { ReactNode } from 'react';
import { useUI } from '../store.ts';
import { pieceUrl } from '../game/textures.ts';
import { scene } from './GameView.tsx';
import { TikTokMark, tiktokStart } from './ShareTikTok.tsx';

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function Welcome() {
  const ui = useUI();
  // Prefilled with a random handle (the same kind bots get), so a default name looks like anyone's.
  const [name, setName] = useState(() => get('owc.name') ?? randomName());
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (ui.nameError || ui.status === 'open') setBusy(false); }, [ui.nameError, ui.status]);
  useEffect(() => { if (ui.nameError?.includes('taken')) setName((n) => n.replace(/\d+$/, '') + Math.floor(Math.random() * 999)); }, [ui.nameError]);
  useEffect(() => { if (ui.status === 'open' && ui.needName) { ui.set({ needName: false }); put('owc.welcomed', '1'); } }, [ui.status]);
  if (!ui.needName) return null;
  const color = '#d9534a';
  const enter = () => {
    const n = name.trim();
    if (n.length < 2) { ui.set({ nameError: 'Pick a name of at least 2 characters' }); return; }
    put('owc.name', n);
    ui.set({ nameError: null });
    setBusy(true);
    conn.start(n);
  };
  return (
    <div className="welcome-backdrop">
      <div className="welcome">
        <div className="welcome-pieces">
          {(['R', 'N', 'B', 'K', 'Q', 'P'] as const).map((k, i) => <img key={k} src={pieceUrl(k, 'light', color, k === 'K')} style={{ animationDelay: `${i * 90}ms` }} alt="" />)}
        </div>
        <h1>Open World Chess</h1>
        {ui.welcomeNote ? <p className="note">{ui.welcomeNote}</p> : <p>The whole world is a chessboard. Settle near resources, raise an army, and take what other rulers hold, one game of chess at a time.</p>}
        <label htmlFor="welcome-name">Choose a name</label>
        <div className="name-row">
          <input id="welcome-name" value={name} maxLength={20} placeholder="e.g. QuietRook" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enter()} />
          <button className="icon-btn big" aria-label="Another name" onClick={() => { setName(randomName()); ui.set({ nameError: null }); }}><Icon name="dice" size={24} /></button>
        </div>
        {ui.nameError && <p className="field-error">{ui.nameError}</p>}
        <button className="btn big" disabled={busy} onClick={enter}>{busy ? 'Entering…' : 'Play now'}</button>
        {ui.googleEnabled && <a className="btn ghost big google" href="/auth/google/start">Continue with Google</a>}
        {ui.tiktokEnabled && <a className="btn ghost big tiktok" href="/auth/tiktok/start"><TikTokMark /> Continue with TikTok</a>}
        <p className="muted small">No sign-up needed. Sign in later to keep your empire.</p>
      </div>
    </div>
  );
}

/** Guests: sign in or your empire falls when you leave. */
export function SignIn() {
  const ui = useUI();
  const self = mirror.self;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('owc:signin', onOpen);
    // Leaving as a guest: the browser shows its own "leave site?" prompt.
    const beforeUnload = (e: BeforeUnloadEvent) => { if (mirror.self?.guest && mirror.myPieces().length) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    fetch('/auth/config').then((r) => r.json()).then((c) => ui.set({ googleEnabled: !!c.google, tiktokEnabled: !!c.tiktok })).catch(() => {});
    if (get('owc.signedin') === '1' && !sessionStorage.getItem('owc.signedin.toast')) { sessionStorage.setItem('owc.signedin.toast', '1'); setTimeout(() => ui.toast('Signed in. Your empire is safe.', 'good'), 1500); }
    return () => { window.removeEventListener('owc:signin', onOpen); window.removeEventListener('beforeunload', beforeUnload); };
  }, []);
  if (!open || !self) return null;
  const mins = Math.round((self.guestGraceMs ?? 900_000) / 60_000);
  const token = get('owc.token') ?? '';
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="sheet confirm">
        <div className="grabber" />
        {self.guest ? <>
          <h3>Keep your empire</h3>
          <p>You're playing as a guest. <b>If you don't sign in, your empire will fall</b> {mins} minutes after you leave: your pieces go masterless for anyone to claim, and the name <b>{self.name}</b> becomes free again.</p>
          {ui.googleEnabled
            ? <a className="btn big google" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textDecoration: 'none' }} href={`/auth/google/start?token=${encodeURIComponent(token)}`}>Sign in with Google</a>
            : !ui.tiktokEnabled && <p className="muted">Sign-in is being set up. Check back soon.</p>}
          {ui.tiktokEnabled && <a className="btn big tiktok" style={{ display: 'flex', width: '100%', marginTop: 8, textDecoration: 'none' }} href={tiktokStart()}><TikTokMark /> Sign in with TikTok</a>}
          <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setOpen(false)}>Keep playing as a guest</button>
        </> : <>
          <h3>Signed in</h3>
          <p>Your empire is tied to {self.email ?? (self.tiktok ? `your TikTok account (${self.tiktok.name})` : 'your account')}. It stands while you're away (the AI defends your battles), and you can continue on any device.</p>
          {ui.tiktokEnabled && (self.tiktok
            ? <p className="muted small">TikTok connected as <b>{self.tiktok.name}</b>, for sharing battle clips. <button className="link" onClick={() => fetch('/tiktok/disconnect', { method: 'POST', headers: { 'x-owc-token': token } }).then(() => ui.toast('TikTok disconnected', 'info'))}>Disconnect</button></p>
            : <a className="btn ghost tiktok-outline" style={{ width: '100%', marginBottom: 8, textDecoration: 'none' }} href={tiktokStart()}><TikTokMark /> Connect TikTok to share battle clips</a>)}
          <button className="btn ghost" style={{ width: '100%' }} onClick={() => setOpen(false)}>Close</button>
        </>}
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

/**
 * A gentle, recurring nudge for guests to sign in: first after a few minutes,
 * then every so often while they actively play, and at moments that make the
 * empire feel worth keeping (a building finished, a battle won, a village).
 * "Later" snoozes it. Never more often than every 5 minutes.
 */
// (owc.nudgeFirst in localStorage shortens the first delay, for testing.)
const NUDGE_FIRST = Number(get('owc.nudgeFirst')) || 3 * 60_000, NUDGE_EVERY = 12 * 60_000, NUDGE_MIN_GAP = 5 * 60_000;

export function SignInNudge() {
  const ui = useUI();
  const [show, setShow] = useState<string | null>(null);
  const [played, setPlayed] = useState(0);
  const [lastNudge, setLastNudge] = useState(() => Number(get('owc.nudgeAt') ?? 0));
  const [seen, setSeen] = useState({ built: false, won: false, village: false });
  // Count only active play (tab visible).
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) setPlayed((p) => p + 5000); }, 5000);
    return () => clearInterval(t);
  }, []);
  const self = mirror.self;
  const eligible = !!self?.guest && ui.googleEnabled && !ui.needName && !ui.battleFocus;
  const nudge = (why: string) => {
    if (!eligible || show) return;
    if (Date.now() - lastNudge < NUDGE_MIN_GAP) return;
    setShow(why);
  };
  // Time-based.
  useEffect(() => {
    if (!eligible) return;
    const due = lastNudge ? played >= NUDGE_FIRST && Date.now() - lastNudge >= NUDGE_EVERY : played >= NUDGE_FIRST;
    if (due) nudge('time');
  }, [played, eligible]);
  // Milestones.
  useEffect(() => {
    if (!eligible) return;
    const built = mirror.myBuildings().some((b) => b.type !== 'ruin' && b.built >= 1);
    if (built && !seen.built) { setSeen((s) => ({ ...s, built: true })); nudge('built'); }
    const house = mirror.myBuildings().filter((b) => b.type !== 'ruin').length >= 3;
    if (house && !seen.village) { setSeen((s) => ({ ...s, village: true })); nudge('village'); }
  }, [ui.version, eligible]);
  useEffect(() => {
    const prev = mirror.onBattleEnd;
    mirror.onBattleEnd = (id, s, r, t) => { prev(id, s, r, t); if (s.winner === mirror.me && !seen.won) { setSeen((x) => ({ ...x, won: true })); setTimeout(() => nudge('won'), 4000); } };
    return () => { mirror.onBattleEnd = prev; };
  }, [eligible, seen.won, lastNudge]);
  if (!show || !self) return null;
  const pieces = mirror.myPieces().length, buildings = mirror.myBuildings().filter((b) => b.type !== 'ruin').length;
  const mins = Math.round((self.guestGraceMs ?? 900_000) / 60_000);
  const lead = show === 'won' ? 'A victory worth keeping.' : show === 'built' ? 'Your first building stands.' : show === 'village' ? 'Your settlement is becoming a village.' : 'Still playing as a guest.';
  const dismiss = () => { const now = Date.now(); setLastNudge(now); put('owc.nudgeAt', String(now)); setShow(null); };
  return (
    <div className="nudge" role="status">
      <div className="nudge-text">
        <b>{lead}</b> Your empire: {pieces} pieces{buildings ? `, ${buildings} building${buildings > 1 ? 's' : ''}` : ''}. Sign in so it doesn't fall {mins} minutes after you leave.
      </div>
      <div className="nudge-actions">
        <a className="btn google small" href={`/auth/google/start?token=${encodeURIComponent(get('owc.token') ?? '')}`} onClick={dismiss}>Sign in</a>
        <button className="btn ghost small" onClick={dismiss}>Later</button>
      </div>
    </div>
  );
}

const STEPS: { id: string; text: (phone: boolean) => ReactNode }[] = [
  { id: 'select', text: (phone: boolean) => phone ? 'Double-tap your Emperor (gold crown) to select its group.' : 'Double-click your Emperor (gold crown) to select its group.' },
  { id: 'move', text: (phone: boolean) => phone ? 'Drag from your pieces to a square to march there.' : 'Right-click a square to march there.' },
  { id: 'house', text: () => <>Build a house <Icon name="hammer" size={15} /> next to wheat. It will produce pawns.</> },
  { id: 'battle', text: () => <>Battles are chess. Try a practice battle from the <Icon name="swords" size={15} /> menu.</> },
];

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
      <button className="icon-btn small" aria-label="Hide guide" onClick={() => { setHidden(true); put('owc.guide.hidden', '1'); }}><Icon name="close" size={14} /></button>
    </div>
  );
}
