import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GameView } from './ui/GameView.tsx';
import { HUD } from './ui/HUD.tsx';
import { useUI } from './store.ts';
import { unstashClip } from './ui/ShareTikTok.tsx';
import './styles.css';

function App() {
  const set = useUI((s) => s.set);
  useEffect(() => {
    // Layout by viewport and input type, not user agent (ux.md §2).
    const pick = () => set({ layout: window.innerWidth < 760 || (matchMedia('(pointer: coarse)').matches && window.innerWidth < 1000) ? 'phone' : 'desktop' });
    pick();
    window.addEventListener('resize', pick);
    // Back from Stripe's checkout (cosmetics.md): reopen the shop. Crowns arrive with the payment webhook, usually within seconds.
    const shop = new URLSearchParams(location.search).get('shop');
    if (shop) {
      history.replaceState(null, '', location.pathname);
      set({ sheet: 'shop' });
      if (shop === 'success') setTimeout(() => useUI.getState().toast('Payment received. Your Crowns are on their way', 'good', 'crown'), 800);
    }
    // Back from TikTok sign-in (tiktok.md): reopen the clip that was being shared.
    const then = new URLSearchParams(location.search).get('then');
    if (then) {
      history.replaceState(null, '', location.pathname);
      const clip = then === 'share' ? unstashClip() : null;
      if (clip) set({ share: clip });
    }
    return () => window.removeEventListener('resize', pick);
  }, [set]);
  return (
    <>
      <GameView />
      <HUD />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

// Count the visit (docs/specs/stats.md): a random ID this browser keeps, and where the
// visit came from. First-party only; no third-party analytics. Filming (?watch) doesn't count.
if (!new URLSearchParams(location.search).has('watch')) {
  try {
    let vid = localStorage.getItem('owc.vid');
    if (!vid) { vid = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('owc.vid', vid); }
    const q = new URLSearchParams(location.search);
    const body = JSON.stringify({ vid, ref: document.referrer, utm: q.get('utm_source') ?? q.get('ref') ?? '' });
    fetch('/api/visit', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch { /* private mode */ }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
