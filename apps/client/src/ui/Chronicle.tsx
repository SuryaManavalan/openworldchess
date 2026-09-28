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

export function ChronicleTracker() {
  const ui = useUI();
  const [open, setOpen] = useState(false);
  const c = mirror.self?.chronicle;
  if (!c || ui.battleFocus != null) return null;
  const ch = CHAPTERS[c.chapter - 1];
  const step = ch?.steps[c.step];
  const show = (at?: [number, number]) => { if (at) scene?.flyTo(at[0], at[1], Math.max(scene.cam.zoom, 0.7)); };
  if (!ch) {
    // The Epilogue: side quests only.
    if (!c.sides.length) return null;
  }
  const [have, need] = c.progress;
  const t = step && c.chapter <= 2 ? tip(step, ui.layout === 'phone') : null;
  return (
    <div className="tracker">
      {ch && step && (
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
      {c.sides.length > 0 && (
        <div className="sides">
          <button className="sides-head" onClick={() => setOpen(!open)}><Icon name="star" size={13} /> {c.sides.length} side quest{c.sides.length > 1 ? 's' : ''} <Icon name="chevron" size={12} style={{ transform: open ? 'rotate(90deg)' : undefined }} /></button>
          {open && c.sides.map((q) => (
            <div key={q.id} className="side">
              <span>{q.line} <em>+{q.renown} Renown</em></span>
              {q.at && <button className="link" onClick={() => show(q.at)}>Show</button>}
              <button className="x" aria-label="Decline" onClick={() => commands.declineQuest(q.id)}><Icon name="close" size={11} stroke={2.6} /></button>
            </div>
          ))}
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
