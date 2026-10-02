// The hands-on tutorial (ux.md §10): a coach card at the top says what to do, and a ghost
// hand (touch) or cursor (mouse) shows exactly how, on the real map, again and again until
// the player does it. Each step finishes when the player actually does the thing. Any step
// can be skipped, or the whole tour; Help replays it.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BUILDINGS, cheb, type Piece } from '@owc/shared';
import { terrainAt, walkable } from '@owc/worldgen';
import { mirror } from '../net.ts';
import { useUI, type Sheet } from '../store.ts';
import { input, scene } from './GameView.tsx';
import { audio } from '../audio/audio.ts';
import { checkPlacement } from '../game/placement.ts';
import { Icon } from './Icon.tsx';

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

// ---------- the ghost: a scripted pointer ----------

type Pt = [number, number];
/** A screen point, looked up every frame (the camera moves, the bar re-renders). */
type P = () => Pt | null;
export type Seg =
  /** Glide there; `drag`: with the finger (or button) held down. */
  | { k: 'go'; to: P; ms?: number; drag?: boolean; label?: string }
  /** Glide there and tap (or click; `right`: right-click). */
  | { k: 'tap'; to: P; right?: boolean; label?: string }
  /** Press and hold where it is. */
  | { k: 'press'; ms: number; label?: string }
  /** Held down, draw a loop around a point (the lasso); `r` in pixels. */
  | { k: 'loop'; c: P; r: () => number; ms?: number; label?: string }
  /** Two fingers spreading apart. */
  | { k: 'pinch'; c: P; ms?: number; label?: string }
  /** The mouse wheel turning. */
  | { k: 'wheel'; c: P; ms?: number; label?: string }
  | { k: 'wait'; ms: number; label?: string };

interface Frame { x: number; y: number; down: boolean; ripple: number | null; right: boolean; label: string | null; two: number | null; wheel: number | null; trail: Pt[] | null }

const GLIDE = 550, TAP = 1000, PAUSE = 1100;
const dur = (s: Seg) => s.k === 'go' ? s.ms ?? 800 : s.k === 'tap' ? TAP : s.k === 'loop' ? s.ms ?? 1700 : s.k === 'pinch' || s.k === 'wheel' ? s.ms ?? 1500 : s.ms;
const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const lerp = (a: Pt, b: Pt, u: number): Pt => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

/** Where the pointer is `t` ms into the script (null: between runs, or nothing to point at). */
function frameAt(segs: Seg[], t: number): Frame | null {
  let pos: Pt | null = null, acc = 0, anchor: Pt | null = null;
  const f = (p: Pt, o: Partial<Frame> = {}): Frame => ({ x: p[0], y: p[1], down: false, ripple: null, right: false, label: null, two: null, wheel: null, trail: null, ...o });
  for (const s of segs) {
    const d = dur(s), into = t - acc, inside = into < d;
    const label = s.label ?? null;
    if (s.k !== 'press' && !(s.k === 'go' && s.drag)) anchor = null;
    switch (s.k) {
      case 'go': {
        const to = s.to();
        if (!to) break;
        const from = pos ?? [to[0] + 70, to[1] + 90] as Pt;
        if (s.drag && !anchor) anchor = from;
        if (inside) { const p = lerp(from, to, ease(into / d)); return f(p, { down: !!s.drag, label, trail: s.drag && anchor ? [anchor, p] : null }); }
        pos = to;
        break;
      }
      case 'tap': {
        const to = s.to();
        if (!to) break;
        const from = pos ?? [to[0] + 70, to[1] + 90] as Pt;
        if (inside) {
          if (into < GLIDE) return f(lerp(from, to, ease(into / GLIDE)), { label });
          const u = (into - GLIDE) / (TAP - GLIDE);
          return f(to, { down: u < 0.4, ripple: u, right: !!s.right, label: label ?? (s.right ? 'Right-click' : null) });
        }
        pos = to;
        break;
      }
      case 'press':
        if (!pos) break;
        if (!anchor) anchor = pos;
        if (inside) return f(pos, { down: true, label, ripple: into > d * 0.7 ? (into - d * 0.7) / (d * 0.3) : null });
        break;
      case 'loop': {
        const c = s.c();
        if (!c) break;
        const r = s.r(), at = (a: number): Pt => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
        if (inside) {
          const end = -Math.PI / 2 + (into / d) * Math.PI * 2.1;
          const trail: Pt[] = [];
          for (let a = -Math.PI / 2; a < end; a += 0.12) trail.push(at(a));
          return f(at(end), { down: true, label, trail: [...trail, at(end)] });
        }
        pos = at(-Math.PI / 2 + Math.PI * 2.1);
        break;
      }
      case 'pinch': {
        const c = s.c();
        if (!c) break;
        if (inside) return f(c, { two: 22 + 70 * ease(Math.min(1, (into / d) * 1.3)), label, down: true });
        pos = c;
        break;
      }
      case 'wheel': {
        const c = s.c();
        if (!c) break;
        if (inside) return f(c, { wheel: into / d, label });
        pos = c;
        break;
      }
      case 'wait':
        if (pos && inside) return f(pos, { label });
        break;
    }
    acc += d;
  }
  return null;
}

/** A pointing hand, its fingertip at (14, 1). Drawn twice: a dark silhouette, then the light hand on top. */
function Hand({ down }: { down: boolean }) {
  const parts = (
    <>
      <rect x="9" y="0" width="10" height="30" rx="5" />
      <rect x="17.5" y="15" width="9" height="16" rx="4.5" />
      <rect x="25.5" y="17" width="8.5" height="15" rx="4.25" />
      <rect x="7" y="20" width="29" height="24" rx="9" />
      <rect x="0" y="23" width="9" height="18" rx="4.5" transform="rotate(-28 5 32)" />
      <rect x="12" y="40" width="20" height="11" rx="3" />
    </>
  );
  return (
    <svg className={`tut-hand ${down ? 'down' : ''}`} width="44" height="57" viewBox="-2 -2 40 55" aria-hidden>
      <g fill="#1d1b19" stroke="#1d1b19" strokeWidth="3.4" strokeLinejoin="round">{parts}</g>
      <g fill="#fbf7ee">{parts}</g>
      <g stroke="#cbbfa9" strokeWidth="1.2" strokeLinecap="round"><path d="M19 22v6M26.5 23v6M12 34h10" /></g>
    </svg>
  );
}

function Cursor() {
  return (
    <svg className="tut-cursor" width="26" height="32" viewBox="0 0 18 26" aria-hidden>
      <path d="M1 1 L1 20.5 L5.8 16.2 L9.2 24 L12.6 22.5 L9.3 15 L15.6 15 Z" fill="#fbf7ee" stroke="#1d1b19" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** The ghost pointer and the ring on what it's showing. Purely visual: it never takes a touch. */
function Ghost({ segs, touch, ring }: { segs: Seg[]; touch: boolean; ring?: P }) {
  const [fr, setFr] = useState<{ f: Frame | null; ring: Pt | null }>({ f: null, ring: null });
  useEffect(() => {
    const total = segs.reduce((s, x) => s + dur(x), 0) + PAUSE, t0 = performance.now();
    let raf = 0;
    const tick = () => { raf = requestAnimationFrame(tick); setFr({ f: segs.length ? frameAt(segs, (performance.now() - t0) % total) : null, ring: ring?.() ?? null }); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [segs, ring]);
  const { f } = fr;
  return (
    <div className="tut-ghost" aria-hidden>
      {fr.ring && <div className="tut-ring" style={{ left: fr.ring[0], top: fr.ring[1] }} />}
      {f?.trail && <svg className="tut-trail"><polyline points={f.trail.map((p) => p.join(',')).join(' ')} /></svg>}
      {f && f.ripple != null && <div className={`tut-ripple ${f.right ? 'right' : ''}`} style={{ left: f.x, top: f.y, transform: `translate(-50%, -50%) scale(${0.4 + f.ripple * 1.4})`, opacity: 1 - f.ripple }} />}
      {f && f.two != null ? <>
        <div className="tut-touch" style={{ left: f.x - f.two * 0.7, top: f.y + f.two * 0.7 }} />
        <div className="tut-touch" style={{ left: f.x + f.two * 0.7, top: f.y - f.two * 0.7 }} />
      </> : f && <>
        {touch && f.down && <div className="tut-touch" style={{ left: f.x, top: f.y }} />}
        <div className="tut-pointer" style={{ left: f.x, top: f.y }}>
          {touch ? <Hand down={f.down} /> : <Cursor />}
          {!touch && f.down && <span className="tut-press" />}
          {f.wheel != null && <span className="tut-wheel"><i style={{ transform: `translateY(${Math.sin(f.wheel * Math.PI * 6) * 3}px)` }} /></span>}
        </div>
      </>}
      {f?.label && <span className="tut-label" style={{ left: f.x + (touch ? 40 : 26), top: f.y + (touch ? 30 : 22) }}>{f.label}</span>}
    </div>
  );
}

// ---------- where things are ----------

/** A world square's centre on screen. */
const sq = (x: number, y: number): Pt | null => {
  if (!scene) return null;
  const r = scene.app.canvas.getBoundingClientRect(), [sx, sy] = scene.toScreen(x, y);
  return [r.left + sx, r.top + sy];
};
const at = (p: Pt | null | undefined): P => () => (p ? sq(p[0], p[1]) : null);
/** A piece, wherever it walks. */
const pieceAt = (id: number | undefined): P => () => { const p = id != null ? mirror.pieces.get(id) : undefined; return p ? sq(p.x, p.y) : null; };
/** An element on the page (its centre), or a spot on the screen while it isn't there yet. */
const dom = (sel: string, fallback?: [number, number]): P => () => {
  const el = document.querySelector(sel);
  if (el) { const r = el.getBoundingClientRect(); if (r.width) return [r.left + r.width / 2, r.top + r.height / 2]; }
  return fallback ? [innerWidth * fallback[0], innerHeight * fallback[1]] : null;
};
const screen = (fx: number, fy: number): P => () => [innerWidth * fx, innerHeight * fy];
const px = (squares: number) => () => squares * (scene?.cam.zoom ?? 1) * 64;

const emperor = () => mirror.myPieces().find((p) => p.emperor);
const ready = (p: Piece) => p.state !== 'battle';
const king = () => { const e = emperor(); return mirror.myPieces().filter((p) => p.kind === 'K' && !p.emperor && ready(p)).sort((a, b) => (e ? cheb(a.x, a.y, e.x, e.y) - cheb(b.x, b.y, e.x, e.y) : 0))[0]; };
const home = (): Pt | null => { const p = emperor() ?? king() ?? mirror.myPieces()[0]; return p ? [p.x, p.y] : null; };
const hasHouse = () => mirror.myBuildings().some((b) => b.type === 'house');

/**
 * An empty, walkable square about `dist` away. Sideways on screen first: the coach card covers
 * the top and the bar the bottom, so there's more room across than up and down.
 */
function freeNear(from: Pt, dist: number): Pt | null {
  if (!scene) return null;
  const taken = new Set([...mirror.nodes.values()].filter((n) => cheb(n.x, n.y, from[0], from[1]) <= dist + 6).map((n) => `${n.x},${n.y}`));
  const o = scene.toScreen(from[0], from[1]);
  const tall = (p: Pt) => Math.abs(scene!.toScreen(p[0], p[1])[1] - o[1]);
  for (let d = dist; d <= dist + 5; d++) {
    const ring: Pt[] = [];
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) ring.push([from[0] + dx * d, from[1] + dy * d]);
    ring.sort((a, b) => tall(a) - tall(b));
    const ok = ring.find(([x, y]) => walkable(terrainAt(mirror.seed, x, y)) && !taken.has(`${x},${y}`) && !scene!.pickPiece(x, y, 0.9) && !scene!.pickBuilding(x, y));
    if (ok) return ok;
  }
  return null;
}

/** A good spot for the first house: near the Emperor, with crops in reach (no amber warning). */
function houseSpot(): Pt | null {
  const h = home();
  if (!h) return null;
  let best: Pt | null = null, bestD = Infinity, fallback: Pt | null = null;
  for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) {
    const x = h[0] + dx, y = h[1] + dy, r = checkPlacement('house', x, y);
    if (!r.ok) continue;
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    if (!r.warn && d < bestD) { best = [x, y]; bestD = d; }
    if (!fallback) fallback = [x, y];
  }
  return best ?? fallback;
}

/**
 * Bring squares into view: centred in the clear band between the coach card and the bottom
 * bar, at a zoom where they all fit (but no closer than `zoom`).
 */
function fly(p: Pt | null | undefined, zoom = 1, ...more: (Pt | null | undefined)[]) {
  const sc = scene;
  const pts = [p, ...more].filter(Boolean) as Pt[];
  if (!sc || !pts.length) return;
  const top = (document.querySelector('.tut-card')?.getBoundingClientRect().bottom ?? 215) + 16;
  const bar = document.querySelector('.dock')?.getBoundingClientRect().top;
  const bottom = (bar && bar > top + 120 ? bar : innerHeight - 260) - 16;
  const mid: Pt = [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length];
  const span = Math.max(1, ...pts.map((q) => Math.max(Math.abs(q[0] - mid[0]), Math.abs(q[1] - mid[1])))) * 2 + 2;
  const fit = Math.min((innerWidth - 40) / (span * 64), Math.max(80, bottom - top) / (span * 64));
  const z = Math.min(Math.max(sc.cam.zoom, zoom), Math.max(0.45, fit));
  // The camera's centre shows mid-screen; shift it so `mid` sits mid-band. (A screen offset
  // straight down, turned into the world the same way Input.panScreen does.)
  const shift = innerHeight / 2 - (top + bottom) / 2, k = 1 / (z * 64), th = sc.theta;
  sc.flyTo(mid[0] + shift * k * Math.sin(th), mid[1] + shift * k * Math.cos(th), z);
}
const deselect = () => { useUI.getState().select([]); if (input) input.pendingMove = null; if (scene) scene.pendingMarker = null; };

// ---------- the steps ----------

interface Ctx { touch: boolean; m: Record<string, any> }
interface Step {
  id: string;
  title: (c: Ctx) => string;
  text: (c: Ctx) => ReactNode;
  /** Set up when the step begins (pick targets, move the camera). False skips the step. */
  start?: (c: Ctx) => boolean | void;
  /** Done when this turns true. Without it, the step is read and closed with Next. */
  done?: (c: Ctx) => boolean;
  /** Undone (the player backed out of a multi-part step): go back to this step. */
  back?: (c: Ctx) => string | null;
  demo?: (c: Ctx) => Seg[];
  ring?: (c: Ctx) => P | undefined;
  /** A sheet the step uses (others pause the tour while open). */
  sheet?: Sheet;
  next?: string;
}

type Stats = NonNullable<typeof input>['stats'];
const snap = (c: Ctx) => { if (input) c.m.stats = { ...input.stats }; };
const grew = (c: Ctx, k: keyof Stats) => !!input && !!c.m.stats && input.stats[k] > c.m.stats[k];

const STEPS: Step[] = [
  {
    id: 'hello', next: 'Show me',
    title: () => 'Welcome to the endless board',
    text: (c) => <>A quick hands-on tour: looking around, leading your pieces, and building. About two minutes. A ghost {c.touch ? 'hand' : 'cursor'} shows each move; then you do it.</>,
  },
  {
    id: 'pan',
    title: (c) => c.touch ? 'Drag to look around' : 'Move the map',
    text: (c) => c.touch ? 'Put one finger on the map and drag it.' : <>Hold <kbd>Space</kbd> and drag (or drag with the middle button). <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> and the arrow keys work too; on a touchpad, swipe with two fingers.</>,
    start: (c) => { c.m.cam = scene ? [scene.cam.x, scene.cam.y] : [0, 0]; },
    done: (c) => !!scene && Math.hypot(scene.cam.x - c.m.cam[0], scene.cam.y - c.m.cam[1]) >= 4,
    demo: (c) => [
      { k: 'go', to: screen(0.3, 0.52), ms: 500 }, { k: 'press', ms: 250, label: c.touch ? undefined : 'Space + drag' },
      { k: 'go', to: screen(0.72, 0.46), ms: 1100, drag: true, label: c.touch ? undefined : 'Space + drag' }, { k: 'wait', ms: 300 },
    ],
  },
  {
    id: 'zoom',
    title: (c) => c.touch ? 'Pinch to zoom' : 'Scroll to zoom',
    text: (c) => c.touch ? 'Two fingers on the map: spread them to zoom in, pinch them together to see more.' : 'Turn the mouse wheel to zoom in and out (pinch on a touchpad).',
    start: (c) => { c.m.zoom = scene?.cam.zoom ?? 1; },
    done: (c) => !!scene && (scene.cam.zoom / c.m.zoom > 1.2 || scene.cam.zoom / c.m.zoom < 0.83),
    demo: (c) => c.touch ? [{ k: 'pinch', c: screen(0.5, 0.5), ms: 1500 }] : [{ k: 'go', to: screen(0.5, 0.5), ms: 500 }, { k: 'wheel', c: screen(0.5, 0.5), ms: 1500, label: 'Scroll' }],
  },
  {
    id: 'rulers', next: 'Got it',
    title: () => 'Your Emperor and your king',
    text: () => <>The <b>Emperor</b> wears the gold crown. While he lives, your empire lives, so keep him at home. Your other <b>king</b> is the one who leads armies out.</>,
    start: (c) => { const e = emperor(); if (!e) return false; const k = king(); c.m.e = e.id; c.m.k = k?.id; fly([e.x, e.y], 1.1, k ? [k.x, k.y] : null); },
    demo: (c) => [{ k: 'go', to: pieceAt(c.m.e), ms: 700, label: 'Emperor' }, { k: 'wait', ms: 1100, label: 'Emperor' }, ...(c.m.k != null ? [{ k: 'go', to: pieceAt(c.m.k), ms: 700, label: 'King' } as Seg, { k: 'wait', ms: 1100, label: 'King' } as Seg] : [])],
  },
  {
    id: 'pick',
    title: (c) => `${c.touch ? 'Tap' : 'Click'} a pawn`,
    text: (c) => `${c.touch ? 'Tap' : 'Click'} one of your pawns to select it.`,
    start: (c) => {
      const h = home(), pawn = mirror.myPieces().filter((p) => p.kind === 'P' && ready(p)).sort((a, b) => (h ? cheb(a.x, a.y, h[0], h[1]) - cheb(b.x, b.y, h[0], h[1]) : 0))[0];
      if (!pawn) return false;
      c.m.pawn = pawn.id; deselect(); fly([pawn.x, pawn.y], 1.1);
    },
    done: () => { const s = useUI.getState().selection; return s.length === 1 && mirror.pieces.get(s[0])?.kind === 'P'; },
    demo: (c) => [{ k: 'tap', to: pieceAt(c.m.pawn) }],
    ring: (c) => pieceAt(c.m.pawn),
  },
  {
    id: 'move',
    title: (c) => c.touch ? 'Send it somewhere' : 'Right-click to move',
    text: (c) => c.touch ? <>Tap an empty square to aim, then tap the <b>same square again</b> to send it (or <b>Move here</b> on the bar).</> : 'Right-click an empty square: the pawn walks there.',
    start: (c) => {
      const ui = useUI.getState();
      if (!ui.selection.length && c.m.pawn != null && mirror.pieces.has(c.m.pawn)) ui.select([c.m.pawn]);
      const p = mirror.pieces.get(useUI.getState().selection[0]);
      if (!p) return false;
      c.m.to = freeNear([p.x, p.y], 4); snap(c); fly([p.x, p.y], 1, c.m.to);
    },
    done: (c) => grew(c, 'moves'),
    demo: (c) => c.touch ? [{ k: 'tap', to: at(c.m.to), label: 'Aim' }, { k: 'wait', ms: 350 }, { k: 'tap', to: at(c.m.to), label: 'Go' }] : [{ k: 'tap', to: at(c.m.to), right: true }],
    ring: (c) => at(c.m.to),
  },
  {
    id: 'army',
    title: (c) => `${c.touch ? 'Tap' : 'Click'} your king`,
    text: (c) => `${c.touch ? 'Tap' : 'Click'} your king (the one without the gold crown). He comes with his army: the pieces around him.`,
    start: (c) => { const k = king(); if (!k) return false; c.m.k = k.id; fly([k.x, k.y], 1); },
    done: (c) => { const s = useUI.getState().selection; return s.includes(c.m.k) && s.length >= 2; },
    demo: (c) => [{ k: 'tap', to: pieceAt(c.m.k) }],
    ring: (c) => pieceAt(c.m.k),
  },
  {
    id: 'trim',
    title: () => 'Choose who goes',
    text: (c) => <>The bar shows who's selected, kind by kind. {c.touch ? 'Tap' : 'Click'} <b>−</b> to leave a pawn behind; <b>+</b> brings the nearest one along.</>,
    start: (c) => { if (!document.querySelector('button[aria-label="One pawn fewer"]:not(:disabled)')) return false; c.m.n = useUI.getState().selection.length; },
    done: (c) => { const n = useUI.getState().selection.length; return n > 0 && n !== c.m.n; },
    demo: () => [{ k: 'tap', to: dom('button[aria-label="One pawn fewer"]') }],
  },
  {
    id: 'march',
    title: (c) => c.touch ? 'Drag them there' : 'March them',
    text: (c) => c.touch ? 'Press on a selected piece and drag to where they should go. Let go, and they march together.' : 'Right-click a square to march them all. They keep together and wait for the slowest.',
    start: (c) => {
      const ui = useUI.getState(), k = king();
      if (!ui.selection.length && k && input) ui.select(input.armyOf(k));
      const sel = useUI.getState().selection.map((id) => mirror.pieces.get(id)).filter(Boolean) as Piece[];
      const lead = sel.find((p) => p.kind === 'K') ?? sel[0];
      if (!lead) return false;
      c.m.lead = lead.id; c.m.to = freeNear([lead.x, lead.y], 5); snap(c); fly([lead.x, lead.y], 0.9, c.m.to);
    },
    done: (c) => grew(c, 'moves'),
    demo: (c) => c.touch
      ? [{ k: 'go', to: pieceAt(c.m.lead), ms: 600 }, { k: 'press', ms: 300 }, { k: 'go', to: at(c.m.to), ms: 1200, drag: true }, { k: 'wait', ms: 200 }]
      : [{ k: 'tap', to: at(c.m.to), right: true }],
    ring: (c) => at(c.m.to),
  },
  {
    id: 'deselect',
    title: () => 'Let them go',
    text: (c) => c.touch ? <>Tap the <b>×</b> on the bar to deselect.</> : <>Click the <b>×</b> on the bar (or press <kbd>Esc</kbd>) to deselect.</>,
    start: () => useUI.getState().selection.length > 0,
    done: () => !useUI.getState().selection.length,
    demo: () => [{ k: 'tap', to: dom('.sel-close') }],
  },
  {
    id: 'many',
    title: () => 'Select many at once',
    text: (c) => c.touch ? 'Hold your finger on the map until it buzzes, then draw a loop around your pieces.' : 'Drag a box around your pieces with the left button.',
    start: (c) => {
      const h = home();
      if (!h) return false;
      const near = mirror.myPieces().filter((p) => ready(p) && cheb(p.x, p.y, h[0], h[1]) <= 10);
      if (near.length < 2) return false;
      deselect();
      const xs = near.map((p) => p.x), ys = near.map((p) => p.y);
      c.m.lo = [Math.min(...xs) - 1, Math.min(...ys) - 1]; c.m.hi = [Math.max(...xs) + 1, Math.max(...ys) + 1];
      c.m.mid = [(c.m.lo[0] + c.m.hi[0]) / 2, (c.m.lo[1] + c.m.hi[1]) / 2];
      c.m.r = Math.min(8, Math.max(c.m.hi[0] - c.m.lo[0], c.m.hi[1] - c.m.lo[1]) / 2 + 0.6);
      fly(c.m.lo, 0.6, c.m.hi); snap(c);
    },
    done: (c) => grew(c, 'groups'),
    demo: (c) => {
      if (!c.touch) return [{ k: 'go', to: at(c.m.lo), ms: 600 }, { k: 'press', ms: 200 }, { k: 'go', to: at(c.m.hi), ms: 1300, drag: true, label: 'Drag' }, { k: 'wait', ms: 300 }];
      const top: P = () => { const m = sq(c.m.mid[0], c.m.mid[1]); return m ? [m[0], m[1] - px(c.m.r)()] : null; };
      return [{ k: 'go', to: top, ms: 600 }, { k: 'press', ms: 700, label: 'Hold…' }, { k: 'loop', c: at(c.m.mid), r: px(c.m.r), ms: 1700 }, { k: 'wait', ms: 200 }];
    },
  },
  {
    id: 'spot',
    title: () => 'Or pick the place first',
    text: (c) => <>With nothing selected, {c.touch ? 'tap' : 'click'} an empty square. Your nearest piece is chosen; <b>+</b> brings the next nearest. Then <b>Move here</b>.</>,
    start: (c) => { const h = home(); if (!h) return false; deselect(); c.m.to = freeNear(h, 4); snap(c); fly(c.m.to, 0.9, h); },
    done: (c) => grew(c, 'spots'),
    demo: (c) => [
      { k: 'tap', to: at(c.m.to) }, { k: 'wait', ms: 250 },
      // (These two show once the bar is up: the first tap brings it.)
      { k: 'tap', to: dom('button[aria-label="One pawn more"]:not(:disabled)'), label: '+' }, { k: 'wait', ms: 200 },
      { k: 'tap', to: dom('.sel-actions .btn:not(.ghost)'), label: 'Move here' },
    ],
    ring: (c) => at(c.m.to),
  },
  {
    id: 'hammer',
    title: () => 'Time to build',
    text: () => <>Tap the hammer <Icon name="hammer" size={15} /> to open the builder.</>,
    sheet: 'build',
    // (Wide screens have the Build list in the side panel: no hammer to tap.)
    start: () => { if (useUI.getState().layout !== 'phone' || hasHouse()) return false; deselect(); },
    done: () => { const ui = useUI.getState(); return ui.sheet === 'build' || ui.buildType != null; },
    demo: () => [{ k: 'tap', to: dom('.build-fab') }],
  },
  {
    id: 'house',
    title: () => 'Pick a house',
    text: (c) => <>{c.touch ? 'Tap' : 'Click'} <b>House</b>{useUI.getState().layout === 'phone' ? '' : ' in the Build list'}. A house raises pawns, and it needs crops (wheat) nearby.</>,
    sheet: 'build',
    start: () => { if (hasHouse()) return false; deselect(); },
    done: () => useUI.getState().buildType === 'house',
    back: () => (useUI.getState().layout === 'phone' && !useUI.getState().sheet ? 'hammer' : null),
    demo: () => [{ k: 'tap', to: dom('button.build-card') }],
  },
  {
    id: 'place',
    title: () => 'Place it by the wheat',
    text: (c) => c.touch ? <>Drag the outline next to the wheat (green is good; amber means no crops in reach), then tap <b>Build</b>.</> : 'Move the outline next to the wheat (green is good; amber means no crops in reach) and click to build.',
    start: (c) => { if (hasHouse()) return false; c.m.to = houseSpot(); fly(c.m.to, 0.8, home()); snap(c); },
    // (Built: the house reaches the mirror a moment after the outline goes away.)
    done: (c) => hasHouse() || grew(c, 'builds'),
    back: (c) => (useUI.getState().buildType || grew(c, 'builds') ? null : useUI.getState().layout === 'phone' ? 'hammer' : 'house'),
    demo: (c) => {
      const mid = (BUILDINGS.house.size - 1) / 2;
      const spot: P = () => (c.m.to ? sq(c.m.to[0] + mid, c.m.to[1] + mid) : null);
      if (!c.touch) return [{ k: 'go', to: spot, ms: 900 }, { k: 'tap', to: spot }];
      const ghost: P = () => { const g = useUI.getState().ghost; return g ? sq(g.x + mid, g.y + mid) : null; };
      return [{ k: 'go', to: ghost, ms: 500 }, { k: 'press', ms: 250 }, { k: 'go', to: spot, ms: 1100, drag: true }, { k: 'wait', ms: 200 }, { k: 'tap', to: dom('.build-row .btn:not(.ghost)') }];
    },
    ring: (c) => (c.m.to ? () => sq(c.m.to[0] + (BUILDINGS.house.size - 1) / 2, c.m.to[1] + (BUILDINGS.house.size - 1) / 2) : undefined),
  },
  {
    id: 'fight', next: 'Next',
    title: () => 'Battles are chess',
    text: (c) => <>To attack, select pieces and {c.touch ? 'tap' : 'right-click'} an enemy camp or king. The fight is a real game of chess, with the pieces you brought. The Chronicle leads you to your first one soon.</>,
  },
  {
    id: 'end', next: 'Start playing',
    title: () => "You're ready",
    text: () => <>The banner at the top is your next quest: tap <b>How?</b> on it any time. Every control is under <Icon name="help" size={14} /> Help, where you can also replay this tour.</>,
  },
];

// ---------- the coach ----------

export function startTutorial() { put('owc.tut', '0'); useUI.getState().set({ tutorial: 0, sheet: null }); }

export function Tutorial() {
  const ui = useUI();
  const idx = ui.tutorial;
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const ctx = useRef<Ctx>({ touch, m: {} });
  const [started, setStarted] = useState<number | null>(null);
  const [cheer, setCheer] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const step = idx != null ? STEPS[idx] : undefined;

  // A brand-new empire (the Chronicle's very first step) gets the tour once, unless it was skipped.
  useEffect(() => {
    const c = mirror.self?.chronicle;
    if (idx == null && get('owc.tut') == null && c?.chapter === 1 && c.step === 0 && mirror.myPieces().length) startTutorial();
  }, [ui.version, idx]);

  const go = (i: number) => {
    setCheer(false);
    if (i >= STEPS.length) { put('owc.tut', 'done'); useUI.getState().set({ tutorial: null }); return; }
    put('owc.tut', String(i));
    useUI.getState().set({ tutorial: i });
  };
  const skipAll = () => { go(STEPS.length); useUI.getState().toast('You can replay the tour from Help (?)', 'info'); };

  // Each step sets itself up when it begins (and steps that don't apply are passed over).
  useEffect(() => {
    if (idx == null || !step || blocked || started === idx) return;
    ctx.current = { touch, m: {} };
    const ok = step.start?.(ctx.current);
    setStarted(idx);
    if (ok === false) go(idx + 1);
  }, [idx, blocked, started]);

  // Watch for the player doing it.
  useEffect(() => {
    if (idx == null || !step) return;
    const t = setInterval(() => {
      const u = useUI.getState();
      setBlocked(!!(u.needName || u.ceremony || u.battleFocus != null || u.pendingAttack || u.pendingClear || u.riddle != null || u.questHelp
        || (u.sheet && u.sheet !== step.sheet) || document.querySelector('.story-backdrop')));
      if (started !== idx || cheer) return;
      if (step.done?.(ctx.current)) {
        setCheer(true);
        audio.commit();
        try { navigator.vibrate?.(12); } catch { /* not supported */ }
        setTimeout(() => go(idx + 1), 900);
        return;
      }
      const back = step.back?.(ctx.current);
      if (back) { const j = STEPS.findIndex((s) => s.id === back); if (j >= 0 && j < idx) go(j); }
    }, 200);
    return () => clearInterval(t);
  }, [idx, started, cheer, step]);

  const segs = useRef<{ key: number; segs: Seg[]; ring?: P }>({ key: -1, segs: [] });
  if (idx == null || !step || blocked || started !== idx) return null;
  if (segs.current.key !== idx) segs.current = { key: idx, segs: step.demo?.(ctx.current) ?? [], ring: step.ring?.(ctx.current) };
  const c = ctx.current;
  const n = STEPS.length;
  return (
    <>
      {!cheer && <Ghost segs={segs.current.segs} ring={segs.current.ring} touch={touch} />}
      <div className={`tut-card ${cheer ? 'cheer' : ''}`} role="dialog" aria-live="polite">
        <div className="tut-top">
          <span className="tut-count">Tutorial · {idx + 1}/{n}</span>
          <button className="link tut-skip-all" onClick={skipAll}>Skip tutorial</button>
        </div>
        <b className="tut-title">{cheer ? <><Icon name="check" size={17} /> Nicely done</> : step.title(c)}</b>
        {!cheer && <p className="tut-text">{step.text(c)}</p>}
        {!cheer && (
          <div className="tut-actions">
            {!step.done ? <button className="btn small" onClick={() => go(idx + 1)}>{step.next ?? 'Next'}</button>
              : <span className="tut-wait"><span className="tut-dot" /> Your turn: {c.touch ? 'try it on the map' : 'try it'}</span>}
            {step.done && <button className="link" onClick={() => go(idx + 1)}>Skip step</button>}
          </div>
        )}
        <div className="tut-progress"><i style={{ width: `${((idx + (cheer ? 1 : 0)) / n) * 100}%` }} /></div>
      </div>
    </>
  );
}
