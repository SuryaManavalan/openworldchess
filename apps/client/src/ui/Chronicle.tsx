// The Chronicle on screen (docs/specs/campaign.md §5.5): the quest tracker, the
// unlock ceremony when a chapter ends, and the book with the whole campaign.
import { useState } from 'react';
import { CHAPTERS, RELIC_NAME, TITLES, type Step } from '@owc/shared';
import { commands, mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { scene } from './GameView.tsx';
import { Icon } from './Icon.tsx';

/** How to do a step with the controls (for players new to them). */
function tip(s: Step, phone: boolean): string | null {
  const tap = phone ? 'Tap' : 'Click';
  switch (s.verb) {
    case 'build': return `${tap} the hammer, pick ${s.type[0].toUpperCase() + s.type.slice(1)}, and place it near what it needs.`;
    case 'raise': return 'Buildings make pieces on their own while one of your kings is near.';
    case 'march': return phone ? 'Double-tap your king to select its troop, then drag to where it should go.' : 'Double-click your king to select its troop, then right-click where it should go.';
    case 'hunt': case 'free': return phone ? "Select a king's troop and drag it onto the camp's king to attack." : "Select a king's troop and right-click the camp's king to attack.";
    case 'win': return 'Attack a rival king with a troop led by one of yours.';
    case 'settle': return 'March a king to open land and build there: a new settlement.';
    case 'grow': return 'Build more in one place: 3 buildings make a village, 6 a town, 10 a city.';
    case 'link': return 'Towns close enough to trade send merchants on their own.';
    case 'discover': return 'Rare lands look different: silver woods, fungi, crystal, ash. Explore.';
    default: return null;
  }
}

/** Keep which quest is in focus across reloads. */
function setFocus(id: number | null) {
  useUI.getState().set({ questFocus: id });
  try { if (id) localStorage.setItem('owc.questFocus', String(id)); else localStorage.removeItem('owc.questFocus'); } catch { /* private mode */ }
}

/**
 * The quest tracker (campaign.md §5.5): the banner shows the chapter's step, or a side quest
 * you've focused. New side quests arrive as offers to accept or decline; accepted ones go in
 * your list, and tapping one focuses it. Declined quests come back later, so a mis-tap never
 * loses one for good.
 */
export function ChronicleTracker() {
  const ui = useUI();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);
  const c = mirror.self?.chronicle;
  if (!c || ui.battleFocus != null) return null;
  const ch = CHAPTERS[c.chapter - 1];
  const step = ch?.steps[c.step];
  const show = (at?: [number, number]) => { if (at) scene?.flyTo(at[0], at[1], Math.max(scene.cam.zoom, 0.7)); };
  const offers = c.sides.filter((q) => q.state === 'offered');
  const mine = c.sides.filter((q) => q.state !== 'offered');
  const focused = mine.find((q) => q.id === ui.questFocus);
  if (!ch && !c.sides.length) return null; // the Epilogue: side quests only
  const [have, need] = c.progress;
  const t = step && c.chapter <= 2 ? tip(step, ui.layout === 'phone') : null;
  const decline = (id: number) => {
    if (confirm !== id) { setConfirm(id); return; }
    commands.declineQuest(id); setConfirm(null);
    if (ui.questFocus === id) setFocus(null);
  };
  return (
    <div className="tracker">
      {focused ? (
        <div className="main side-focus">
          <button className="book" aria-label="Back to the chapter" onClick={() => setFocus(null)}><Icon name="star" size={18} /></button>
          <div className="body">
            <span className="kicker">Side quest · +{focused.renown} Renown</span>
            <b>{focused.line}</b>
            {focused.progress && focused.progress[1] > 1 && <span className="prog"><span style={{ width: `${(100 * focused.progress[0]) / focused.progress[1]}%` }} /><em>{focused.progress[0]}/{focused.progress[1]}</em></span>}
            <span className="focus-actions">
              {ch && <button className="chip" onClick={() => setFocus(null)}><Icon name="book" size={12} /> Chapter {ch.n}</button>}
              <button className={`chip ${confirm === focused.id ? 'warn' : ''}`} onClick={() => decline(focused.id)}>{confirm === focused.id ? 'Drop it? It comes back later' : 'Drop'}</button>
            </span>
          </div>
          {focused.at && <button className="link show" onClick={() => show(focused.at)}><Icon name="target" size={15} /> Show me</button>}
        </div>
      ) : ch && step && (
        <div className="main">
          <button className="book" aria-label="Open the Chronicle" onClick={() => ui.set({ sheet: 'chronicle' })}><Icon name="book" size={18} /></button>
          <div className="body">
            <span className="kicker">Chapter {ch.n} · {ch.name}</span>
            <b>{step.line}</b>
            {need > 1 && <span className="prog"><span style={{ width: `${(100 * have) / need}%` }} /><em>{have}/{need}</em></span>}
            {t && <span className="tip">{t}</span>}
          </div>
          {c.target && <button className="link show" onClick={() => show(c.target)}><Icon name="target" size={15} /> Show me</button>}
        </div>
      )}
      {offers.map((q) => (
        <div key={q.id} className="offer">
          <span className="kicker"><Icon name="star" size={12} /> A quest is offered · +{q.renown} Renown</span>
          <span className="line">{q.line}</span>
          <span className="offer-actions">
            {q.at && <button className="link" onClick={() => show(q.at)}>Where?</button>}
            <button className={`btn small ghost ${confirm === q.id ? 'warn' : ''}`} onClick={() => decline(q.id)}>{confirm === q.id ? 'Sure? It comes back later' : 'Decline'}</button>
            <button className="btn small gold" onClick={() => { void commands.acceptQuest(q.id); setFocus(q.id); setConfirm(null); }}>Accept</button>
          </span>
        </div>
      ))}
      {mine.length > 0 && (
        <div className={`sides ${open ? 'open' : ''}`}>
          <button className="sides-head" onClick={() => setOpen(!open)}>
            <Icon name="star" size={13} /> {mine.length} side quest{mine.length > 1 ? 's' : ''}{focused ? '' : ' · tap one to follow it'}
            <Icon name="chevron" size={13} style={{ transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', marginLeft: 'auto' }} />
          </button>
          {open && mine.map((q) => (
            <button key={q.id} className={`side ${q.id === ui.questFocus ? 'on' : ''}`} onClick={() => { setFocus(q.id === ui.questFocus ? null : q.id); show(q.at); setOpen(false); }}>
              <Icon name={q.id === ui.questFocus ? 'target' : 'star'} size={13} />
              <span>{q.line} <em>+{q.renown}</em></span>
            </button>
          ))}
          {open && <button className="sides-close" aria-label="Hide side quests" onClick={() => setOpen(false)}><span className="grabber" /></button>}
        </div>
      )}
    </div>
  );
}

/** A chapter done: the unlock ceremony (campaign.md §5.5). */
export function ChapterCeremony() {
  const ui = useUI();
  const c = ui.ceremony;
  if (!c) return null;
  const next = CHAPTERS[c.n];
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && ui.set({ ceremony: null })}>
      <div className="ceremony">
        <div className="rays" />
        <span className="kicker">Chapter {c.n} complete</span>
        <h2>{c.name}</h2>
        {c.title && <p className="title-won"><Icon name="crown" size={18} /> You are now a <b>{c.title}</b></p>}
        <p className="opens"><span className="new">New</span> {c.opens}</p>
        {c.coronation && <p className="crowned">A new king has been crowned in your court.</p>}
        {next && <p className="muted">Next: Chapter {next.n}, {next.name}. <i>{next.intro}</i></p>}
        <button className="btn gold" onClick={() => ui.set({ ceremony: null })}>Onward</button>
      </div>
    </div>
  );
}

/** The book: the whole campaign, your title, Renown and relics. */
export function ChronicleBook() {
  const c = mirror.self?.chronicle;
  if (!c) return <p className="muted">The Chronicle opens when you join the world.</p>;
  const acts = [...new Set(CHAPTERS.map((ch) => ch.act))];
  return (
    <div className="chronicle-book">
      <h3>The Chronicle</h3>
      <div className="standing">
        <span><Icon name="crown" size={15} /> {TITLES[c.title].name}</span>
        <span><Icon name="star" size={15} /> {c.renown.toLocaleString()} Renown</span>
        <span>Kings allowed: {TITLES[c.title].kingCap}</span>
      </div>
      {acts.map((act) => (
        <div key={act} className="act">
          <h4>{act}</h4>
          {CHAPTERS.filter((ch) => ch.act === act).map((ch) => {
            const state = ch.n < c.chapter ? 'done' : ch.n === c.chapter ? 'now' : 'later';
            return (
              <div key={ch.n} className={`chapter ${state}`}>
                <span className="num">{state === 'done' ? <Icon name="check" size={13} /> : state === 'later' ? <Icon name="lock" size={12} /> : ch.n}</span>
                <div>
                  <b>{ch.name}</b>
                  {state !== 'later' ? <span className="muted">{ch.intro}</span> : <span className="muted">Opens: {ch.opens.split(':')[0]}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {c.relics.length > 0 && (
        <div className="relics"><h4>Relics</h4>{c.relics.map((r) => <span key={r} className="badge">{RELIC_NAME[r] ?? r}</span>)}</div>
      )}
    </div>
  );
}
