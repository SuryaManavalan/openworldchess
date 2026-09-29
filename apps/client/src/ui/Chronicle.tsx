// The Chronicle on screen (docs/specs/campaign.md §5.5): the quest tracker, the
// unlock ceremony when a chapter ends, and the book with the whole campaign.
import { useState } from 'react';
import { CHAPTERS, LESSONS, RELIC_NAME, TITLES, type Step } from '@owc/shared';
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
    case 'scout': return phone ? 'Tap your king (not the gold-crowned Emperor), then tap near the marked camp.' : 'Click your king (not the gold-crowned Emperor), then right-click near the marked camp.';
    default: return null;
  }
}

/** How to do each step of the pilgrimage with the controls (campaign.md §5.3). */
const PILGRIM_TIPS = [
  'Select elephants, tap Clear land, and drag over the grove (Show me finds it).',
  'Select a bishop, walk it into the clearing, then tap Raise altar: the altar goes up beside it.',
  'Select knights, tap Pave, and tap the altar: they pave a road from where they stand.',
];

/** Keep which quest is in focus across reloads. */
function setFocus(id: number | null) {
  useUI.getState().set({ questFocus: id });
  try { if (id) localStorage.setItem('owc.questFocus', String(id)); else localStorage.removeItem('owc.questFocus'); } catch { /* private mode */ }
}

/** Fold the quest banner down to one line, or open it again (remembered). */
function setMin(min: boolean) {
  useUI.getState().set({ trackerMin: min });
  try { localStorage.setItem('owc.trackerMin', min ? '1' : '0'); } catch { /* private mode */ }
}

/**
 * The quest banner (campaign.md §5.5): the chapter's step, or a side quest you've focused.
 * It folds down to a one-line pill so it doesn't take the screen. Side quests (offers and
 * your list) live in the Chronicle, whose button shows a badge when one is offered.
 */
export function ChronicleTracker() {
  const ui = useUI();
  const [confirm, setConfirm] = useState(false);
  const c = mirror.self?.chronicle;
  if (!c || ui.battleFocus != null) return null;
  const ch = CHAPTERS[c.chapter - 1];
  const step = ch?.steps[c.step];
  const show = (at?: [number, number]) => { if (at) scene?.flyTo(at[0], at[1], Math.max(scene.cam.zoom, 0.7)); };
  const focused = c.sides.find((q) => q.state !== 'offered' && q.id === ui.questFocus);
  if (!focused && !(ch && step)) return null;
  const line = focused ? focused.line : step!.line;
  const [have, need] = focused ? focused.progress ?? [0, 0] : c.progress;
  const kicker = focused ? `Side quest · +${focused.renown} Renown` : `Chapter ${ch!.n} · ${ch!.name}`;
  const target = focused ? focused.at : c.target;
  if (ui.trackerMin) return (
    <div className="tracker">
      <button className={`mini ${focused ? 'side-focus' : ''}`} aria-label="Show the quest" onClick={() => setMin(false)}>
        <Icon name={focused ? 'star' : 'book'} size={15} />
        <span className="mini-line">{line}</span>
        {need > 1 && <em>{have}/{need}</em>}
        <Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />
      </button>
    </div>
  );
  const t = !focused && step && c.chapter <= 2 ? tip(step, ui.layout === 'phone') : null;
  return (
    <div className="tracker">
      <div className={`main ${focused ? 'side-focus' : ''}`}>
        <button className="book" aria-label="Open the Chronicle" onClick={() => ui.set({ sheet: 'chronicle' })}><Icon name={focused ? 'star' : 'book'} size={18} /></button>
        <div className="body">
          <span className="kicker">{kicker}</span>
          <b>{line}</b>
          {need > 1 && <span className="prog"><span style={{ width: `${(100 * have) / need}%` }} /><em>{have}/{need}</em></span>}
          {t && <span className="tip">{t}</span>}
          {!focused && step?.teach?.length ? <button className="learn-chip" onClick={() => ui.set({ questHelp: {} })}><Icon name="book" size={12} /> Learn: {step.teach.map((id) => LESSONS[id]?.title).filter(Boolean).join(' · ')}</button> : null}
          {focused?.kind === 'pilgrimage' && <span className="tip keep">{PILGRIM_TIPS[focused.stage ?? 0]}</span>}
          {focused?.kind === 'shrine' && !focused.puzzle && <span className="tip keep">Walk any of your pieces onto the shrine (Show finds it).</span>}
          {focused?.puzzle && <button className="btn small gold riddle-go" onClick={() => ui.set({ riddle: focused.id })}>Answer the riddle</button>}
          {focused && (
            <span className="focus-actions">
              {ch && <button className="chip" onClick={() => setFocus(null)}><Icon name="book" size={12} /> Chapter {ch.n}</button>}
              <button className={`chip ${confirm ? 'warn' : ''}`} onClick={() => { if (!confirm) { setConfirm(true); return; } commands.declineQuest(focused.id); setFocus(null); setConfirm(false); }}>{confirm ? 'Drop it? It comes back later' : 'Drop'}</button>
            </span>
          )}
        </div>
        <div className="side-btns">
          <button className="icon-btn small" aria-label="Fold the quest away" onClick={() => setMin(true)}><Icon name="chevron" size={14} style={{ transform: 'rotate(-90deg)' }} /></button>
          {target && <button className="link show" onClick={() => show(target)}><Icon name="target" size={15} /> Show</button>}
          <button className="link show how" onClick={() => ui.set({ questHelp: focused ? { side: focused.id } : {} })}><Icon name="help" size={15} /> How?</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Side quests, in the Chronicle (campaign.md §5.5): offers to accept or decline (declined
 * ones come back later), and your list, where tapping one follows it in the quest banner.
 */
function SideQuests() {
  const ui = useUI();
  const [confirm, setConfirm] = useState<number | null>(null);
  const c = mirror.self?.chronicle;
  if (!c?.sides.length) return <p className="muted small">Side quests appear here as you play (from chapter 2): errands from the land around you, for Renown.</p>;
  const offers = c.sides.filter((q) => q.state === 'offered'), mine = c.sides.filter((q) => q.state !== 'offered');
  const fly = (at?: [number, number]) => { if (at) { scene?.flyTo(at[0], at[1], Math.max(scene.cam.zoom, 0.7)); ui.set({ sheet: null }); } };
  const decline = (id: number) => { if (confirm !== id) { setConfirm(id); return; } commands.declineQuest(id); setConfirm(null); if (ui.questFocus === id) setFocus(null); };
  return (
    <div className="side-quests">
      {offers.map((q) => (
        <div key={q.id} className="sq offer">
          <span className="kicker"><Icon name="star" size={12} /> Offered · +{q.renown} Renown</span>
          <span className="line">{q.line}</span>
          <span className="sq-actions">
            {q.at && <button className="link" onClick={() => fly(q.at)}>Where?</button>}
            <button className={`btn small ghost ${confirm === q.id ? 'warn' : ''}`} onClick={() => decline(q.id)}>{confirm === q.id ? 'Sure? It comes back later' : 'Decline'}</button>
            <button className="btn small gold" onClick={() => { void commands.acceptQuest(q.id); setFocus(q.id); setMin(false); setConfirm(null); }}>Accept</button>
          </span>
        </div>
      ))}
      {mine.map((q) => (
        <div key={q.id} className={`sq ${q.id === ui.questFocus ? 'on' : ''}`}>
          <span className="line">{q.line} <em>+{q.renown}</em></span>
          {q.progress && q.progress[1] > 1 && <span className="muted small">{q.progress[0]}/{q.progress[1]}</span>}
          <span className="sq-actions">
            {q.at && <button className="link" onClick={() => fly(q.at)}>Where?</button>}
            <button className={`btn small ghost ${confirm === q.id ? 'warn' : ''}`} onClick={() => decline(q.id)}>{confirm === q.id ? 'Drop it? It comes back' : 'Drop'}</button>
            <button className="btn small ghost" onClick={() => ui.set({ questHelp: { side: q.id }, sheet: null })}>How?</button>
            {q.puzzle && <button className="btn small gold" onClick={() => ui.set({ riddle: q.id, sheet: null })}>Answer</button>}
            <button className={`btn small ${q.id === ui.questFocus ? 'gold' : 'ghost'}`} onClick={() => { setFocus(q.id === ui.questFocus ? null : q.id); setMin(false); }}>{q.id === ui.questFocus ? 'Following' : 'Follow'}</button>
          </span>
        </div>
      ))}
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
        {next && <p className="muted">Next: Chapter {next.n}, {next.name}. <i>{next.story ?? next.intro}</i></p>}
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
      <h4>Side quests</h4>
      <SideQuests />
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
      {/* Every rule the Chronicle has taught so far (lessons.ts), in the order you met them. */}
      {(() => {
        const ids: string[] = [];
        CHAPTERS.forEach((ch) => ch.steps.forEach((s, i) => { if (ch.n < c.chapter || (ch.n === c.chapter && i <= c.step)) for (const id of s.teach ?? []) if (!ids.includes(id)) ids.push(id); }));
        return ids.length ? (
          <div className="lessons"><h4>What you've learned</h4>{ids.map((id) => LESSONS[id] && <details key={id}><summary>{LESSONS[id].title}</summary><p>{LESSONS[id].text}</p></details>)}</div>
        ) : null;
      })()}
      {c.relics.length > 0 && (
        <div className="relics"><h4>Relics</h4>{c.relics.map((r) => <span key={r} className="badge">{RELIC_NAME[r] ?? r}</span>)}</div>
      )}
    </div>
  );
}
