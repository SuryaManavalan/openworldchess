// Map markers (ux.md §3): floating pins for settlements when zoomed out, flags you
// drop anywhere, and arrows on the screen edge pointing at off-screen flags, your
// settlements and your Emperor. Tap one to fly there. Positions update every
// frame without re-rendering React.
import { useEffect, useRef } from 'react';
import { mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { scene } from './GameView.tsx';
import { TIER_NAME } from '../game/settlements.ts';
import { Icon } from './Icon.tsx';

interface Marker { key: string; x: number; y: number; kind: 'flag' | 'town' | 'mytown' | 'emperor' | 'quest'; label: string; color: string; id?: number }

const PIN_ZOOM = 0.35;

function collect(flags: { id: number; x: number; y: number; color: string }[]): Marker[] {
  const out: Marker[] = [];
  for (const f of flags) out.push({ key: `f${f.id}`, x: f.x, y: f.y, kind: 'flag', label: 'Flag', color: f.color, id: f.id });
  for (const st of scene?.settlements ?? []) {
    const mine = st.owner === mirror.me;
    out.push({ key: `t${st.id}`, x: st.cx, y: st.cy, kind: mine ? 'mytown' : 'town', label: `${st.name} · ${TIER_NAME[st.tier]}`, color: mirror.players.get(st.owner)?.color ?? '#999' });
  }
  // Quest targets (campaign.md §5.5): the main step's and any side quests'.
  const c = mirror.self?.chronicle;
  if (c?.target) out.push({ key: 'q-main', x: c.target[0], y: c.target[1], kind: 'quest', label: 'Quest', color: '#f3d27a' });
  for (const q of c?.sides ?? []) if (q.at) out.push({ key: `q-${q.id}`, x: q.at[0], y: q.at[1], kind: 'quest', label: 'Side quest', color: '#cfe6a4' });
  const emp = mirror.myPieces().find((p) => p.emperor);
  if (emp) out.push({ key: 'emp', x: emp.x, y: emp.y, kind: 'emperor', label: 'Emperor', color: mirror.self?.color ?? '#e3b23c' });
  return out;
}

export function Markers() {
  const ui = useUI();
  const root = useRef<HTMLDivElement>(null);
  const markers = useRef<Marker[]>([]);
  const list = collect(ui.flags);
  markers.current = list;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = root.current, sc = scene;
      if (!el || !sc?.ready) return;
      const W = window.innerWidth, H = window.innerHeight;
      const phone = useUI.getState().layout === 'phone';
      const inset = { l: 12, r: phone ? 12 : 330, t: 78, b: phone ? 170 : 96 };
      const far = sc.cam.zoom < PIN_ZOOM;
      const cx = (inset.l + W - inset.r) / 2, cy = (inset.t + H - inset.b) / 2;
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      for (const m of markers.current) {
        const node = el.querySelector<HTMLElement>(`[data-k="${m.key}"]`);
        if (!node) continue;
        // Live position for moving things (the Emperor).
        if (m.kind === 'emperor') { const e = mirror.myPieces().find((p) => p.emperor); if (e) { m.x = e.x; m.y = e.y; } }
        const [sx, sy] = sc.toScreen(m.x, m.y);
        const onScreen = sx > inset.l && sx < W - inset.r && sy > inset.t && sy < H - inset.b;
        const wantsArrow = m.kind === 'flag' || m.kind === 'emperor' || m.kind === 'mytown' || m.kind === 'quest';
        const showPin = onScreen && (m.kind === 'flag' || m.kind === 'quest' || far);
        if (showPin) {
          node.style.display = '';
          node.className = `marker pin ${m.kind}`;
          node.style.transform = `translate(${sx}px, ${sy}px)`;
          continue;
        }
        if (onScreen || !wantsArrow) { node.style.display = 'none'; continue; }
        // Edge point along the line from the view's center toward the target.
        const dx = sx - cx, dy = sy - cy;
        const kx = dx ? ((dx > 0 ? W - inset.r : inset.l) - cx) / dx : Infinity;
        const ky = dy ? ((dy > 0 ? H - inset.b : inset.t) - cy) / dy : Infinity;
        const k = Math.min(kx, ky);
        node.style.display = '';
        node.className = `marker arrow ${m.kind}`;
        const w = node.offsetWidth || 60, h = node.offsetHeight || 32;
        // Keep the whole chip on screen, and step past chips already placed.
        // (Within the visible map: not under the desktop side panel.)
        let left = Math.max(inset.l - 4, Math.min(W - inset.r - w - 4, cx + dx * k - w / 2));
        let top = Math.max(inset.t - 10, Math.min(H - inset.b - h + 10, cy + dy * k - h / 2));
        for (let tries = 0; tries < 6 && placed.some((p) => left < p.x + p.w + 4 && left + w + 4 > p.x && top < p.y + p.h + 4 && top + h + 4 > p.y); tries++) {
          if (kx < ky) top += h + 6; else left += (dx > 0 ? -1 : 1) * (w + 6);
        }
        placed.push({ x: left, y: top, w, h });
        node.style.transform = `translate(${left}px, ${top}px)`;
        // The arrowhead orbits the chip, pointing at the target.
        const ang = Math.atan2(dy, dx);
        const tip = node.querySelector<HTMLElement>('.tip');
        if (tip) tip.style.transform = `translate(${w / 2 + Math.cos(ang) * (w / 2 + 6)}px, ${h / 2 + Math.sin(ang) * (h / 2 + 6)}px) rotate(${ang}rad)`;
        const dist = Math.round(Math.hypot(m.x - sc.cam.x, m.y - sc.cam.y));
        const d = node.querySelector<HTMLElement>('.dist');
        if (d) d.textContent = dist > 999 ? `${(dist / 1000).toFixed(1)}k` : String(dist);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const go = (key: string) => {
    const m = markers.current.find((x) => x.key === key);
    if (m && scene) scene.flyTo(m.x, m.y, scene.cam.zoom < PIN_ZOOM && m.kind !== 'flag' ? 0.8 : Math.max(scene.cam.zoom, 0.5));
  };
  return (
    <div className="markers" ref={root}>
      {list.map((m) => (
        <div key={m.key} data-k={m.key} className={`marker ${m.kind}`} style={{ display: 'none', ['--c' as string]: m.color }} onClick={() => go(m.key)}>
          <span className="tip" />
          <span className="icon"><Icon name={m.kind === 'flag' ? 'flag' : m.kind === 'emperor' ? 'crown' : m.kind === 'mytown' ? 'castle' : m.kind === 'quest' ? 'target' : 'house'} size={14} stroke={2.4} /></span>
          <span className="name">{m.kind === 'flag' ? '' : m.label}</span>
          <span className="dist" />
          {m.kind === 'flag' && <button className="x" aria-label="Remove flag" onClick={(e) => { e.stopPropagation(); ui.removeFlag(m.id!); }}><Icon name="close" size={11} stroke={2.6} /></button>}
        </div>
      ))}
    </div>
  );
}
