// Winning feels like winning (campaign.md §5.5): a finished step or side quest gets the
// full jackpot. A gold flash, a slammed "QUEST COMPLETE", Renown rolling up, coins and
// confetti bursting and raining, and a climbing run of bells into a chord. A new chapter
// opens with its story. Watches the Chronicle view for changes; nothing here is gameplay.
import { useEffect, useRef, useState } from 'react';
import { CHAPTERS } from '@owc/shared';
import { mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { audio } from '../audio/audio.ts';

interface Win { title: string; line: string; renown: number; big: boolean; at: number }
interface Bit { x: number; y: number; vx: number; vy: number; r: number; spin: number; a: number; kind: 'coin' | 'gem' | 'paper'; color: string; life: number }

const COLORS = ['#f3d27a', '#ffe9a0', '#e3b23c', '#ffffff', '#cfe6a4', '#7fa8ff', '#f2a9c0'];

/** Coins, gems and confetti, bursting from the middle of the screen and raining down. */
function Fireworks({ big }: { big: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!, g = cv.getContext('2d')!;
    const dpr = Math.min(2, devicePixelRatio);
    const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr);
    const bits: Bit[] = [];
    const burst = (n: number, cx: number, cy: number, speed: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * speed * dpr;
        const kind = Math.random() < 0.45 ? 'coin' : Math.random() < 0.3 ? 'gem' : 'paper';
        bits.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6 * dpr, r: (kind === 'paper' ? 5 : 7 + Math.random() * 5) * dpr, spin: Math.random() * 6, a: Math.random() * 6, kind, color: COLORS[Math.floor(Math.random() * COLORS.length)], life: 0 });
      }
    };
    burst(big ? 160 : 90, W / 2, H * 0.42, big ? 16 : 12);
    let rain = big ? 70 : 30;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = now - t0;
      g.clearRect(0, 0, W, H);
      if (rain > 0 && t > 250) { for (let i = 0; i < 3 && rain > 0; i++, rain--) bits.push({ x: Math.random() * W, y: -20, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, r: 6 * dpr, spin: Math.random() * 6, a: 0, kind: Math.random() < 0.6 ? 'coin' : 'paper', color: COLORS[Math.floor(Math.random() * COLORS.length)], life: 0 }); }
      if (big && t > 500 && t < 520) burst(80, W * 0.25, H * 0.35, 10);
      if (big && t > 750 && t < 770) burst(80, W * 0.75, H * 0.35, 10);
      for (const b of bits) {
        b.life += 16; b.vy += 0.35 * dpr; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.a += b.spin * 0.02;
        const fade = Math.max(0, 1 - Math.max(0, t - 2200) / 600);
        g.save(); g.globalAlpha = fade; g.translate(b.x, b.y); g.rotate(b.a);
        if (b.kind === 'coin') {
          const squash = Math.abs(Math.cos(b.a * 2));
          g.fillStyle = '#e3b23c'; g.beginPath(); g.ellipse(0, 0, b.r * (0.3 + 0.7 * squash), b.r, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#ffe9a0'; g.beginPath(); g.ellipse(-b.r * 0.2 * squash, -b.r * 0.2, b.r * 0.35 * squash, b.r * 0.5, 0, 0, Math.PI * 2); g.fill();
        } else if (b.kind === 'gem') {
          g.fillStyle = b.color; g.beginPath(); g.moveTo(0, -b.r); g.lineTo(b.r * 0.7, 0); g.lineTo(0, b.r); g.lineTo(-b.r * 0.7, 0); g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-b.r * 0.15, -b.r * 0.6, b.r * 0.3, b.r * 0.4);
        } else { g.fillStyle = b.color; g.fillRect(-b.r, -b.r * 0.5, b.r * 2, b.r); }
        g.restore();
      }
      if (t < 2900) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [big]);
  return <canvas ref={ref} className="fireworks" />;
}

/** Renown counting up, fast then slowing, like a payout. */
function Rolling({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => { const k = Math.min(1, (now - t0) / 1100); setN(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n}</>;
}

export function Celebrate() {
  const ui = useUI();
  void ui.version;
  const [win, setWin] = useState<Win | null>(null);
  const [story, setStory] = useState<number | null>(null);
  const prev = useRef<{ ch: number; step: number; sides: Map<number, string>; renown: number } | null>(null);
  const c = mirror.self?.chronicle;
  useEffect(() => {
    if (!c) return;
    const now = { ch: c.chapter, step: c.step, sides: new Map(c.sides.map((q) => [q.id, q.line] as [number, string])), renown: c.renown };
    const p = prev.current;
    prev.current = now;
    // A chapter's story, once, when it opens (chapter 1 too, the first time you play).
    let seen = 0;
    try { seen = Number(localStorage.getItem('owc.storySeen') ?? 0); } catch { /* private mode */ }
    if (c.step === 0 && c.chapter > seen && CHAPTERS[c.chapter - 1]?.story && !(p && p.ch !== c.chapter)) setStory(c.chapter);
    if (!p) return;
    const gained = Math.max(0, c.renown - p.renown);
    if (c.chapter === p.ch && c.step > p.step) {
      const done = CHAPTERS[c.chapter - 1]?.steps[p.step];
      if (done) { setWin({ title: 'QUEST COMPLETE', line: done.line, renown: gained, big: false, at: Date.now() }); audio.jackpot(false); }
    } else if (c.chapter > p.ch) {
      audio.jackpot(true); // the chapter's ceremony shows the rest
      setTimeout(() => setStory(c.chapter), 4000);
    }
    for (const [id, line] of p.sides) if (!now.sides.has(id) && gained > 0) { setWin({ title: 'QUEST COMPLETE', line, renown: gained, big: false, at: Date.now() }); audio.jackpot(false); break; }
  }, [c?.chapter, c?.step, c?.renown, c?.sides.length]);
  useEffect(() => { if (!win) return; const t = setTimeout(() => setWin(null), 3200); return () => clearTimeout(t); }, [win]);
  const closeStory = () => { try { localStorage.setItem('owc.storySeen', String(story)); } catch { /* private mode */ } setStory(null); };
  const ch = story ? CHAPTERS[story - 1] : null;
  return (
    <>
      {win && (
        <div className="celebrate" key={win.at}>
          <div className="celebrate-flash" />
          <Fireworks big={win.big} />
          <div className="celebrate-card">
            <div className="celebrate-rays" />
            <div className="celebrate-title">{win.title}</div>
            <div className="celebrate-line">{win.line}</div>
            {win.renown > 0 && <div className="celebrate-renown">+<Rolling to={win.renown} /> Renown</div>}
          </div>
        </div>
      )}
      {ch && !ui.ceremony && (
        <div className="sheet-backdrop story-backdrop" onClick={(e) => e.target === e.currentTarget && closeStory()}>
          <div className="story-card">
            <span className="kicker">Chapter {ch.n} · {ch.act}</span>
            <h2>{ch.name}</h2>
            <p className="story-text">{ch.story}</p>
            <p className="story-intro"><i>{ch.intro}</i></p>
            <button className="btn gold" onClick={closeStory}>Begin</button>
          </div>
        </div>
      )}
    </>
  );
}
