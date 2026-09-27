import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GameView } from './ui/GameView.tsx';
import { HUD } from './ui/HUD.tsx';
import { useUI } from './store.ts';
import './styles.css';

function App() {
  const set = useUI((s) => s.set);
  useEffect(() => {
    // Layout by viewport and input type, not user agent (ux.md §2).
    const pick = () => set({ layout: window.innerWidth < 760 || (matchMedia('(pointer: coarse)').matches && window.innerWidth < 1000) ? 'phone' : 'desktop' });
    pick();
    window.addEventListener('resize', pick);
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

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
