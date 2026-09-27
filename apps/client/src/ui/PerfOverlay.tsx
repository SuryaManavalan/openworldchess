// ?perf in the URL: a small overlay with what the client is spending
// (performance.md §2): frames per second, our per-frame work, what's on the
// stage, and the network. Cheap, and off unless asked for.
import { useEffect, useRef } from 'react';
import { conn, mirror } from '../net.ts';
import { scene } from './GameView.tsx';

export const perfOn = typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf');

export function PerfOverlay() {
  const el = useRef<HTMLPreElement>(null);
  useEffect(() => {
    let raf = 0, frames = 0, last = performance.now(), lastBytes = conn.stats.bytes, lastMsgs = conn.stats.msgs, text = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      frames++;
      const now = performance.now();
      if (now - last < 1000) return;
      const secs = (now - last) / 1000, sc = scene;
      const kb = (conn.stats.bytes - lastBytes) / 1024 / secs, msgs = (conn.stats.msgs - lastMsgs) / secs;
      const st = sc?.ready ? sc.stats() : null;
      text = `fps ${(frames / secs).toFixed(0)} · work ${sc?.frameMs.toFixed(1) ?? '-'}ms\n` +
        (st ? `on stage ${st.stage}: nodes ${st.nodes}/${st.nodesLoaded} · pieces ${st.pieces} · buildings ${st.buildings} · chunks ${st.chunks}\n` : '') +
        `world: pieces ${mirror.pieces.size} buildings ${mirror.buildings.size} nodes ${mirror.nodes.size}\n` +
        `net ${kb.toFixed(1)} KB/s · ${msgs.toFixed(1)} msg/s · zoom ${sc?.cam.zoom.toFixed(2) ?? '-'}`;
      if (el.current) el.current.textContent = text;
      frames = 0; last = now; lastBytes = conn.stats.bytes; lastMsgs = conn.stats.msgs;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <pre className="perf-overlay" ref={el} />;
}
