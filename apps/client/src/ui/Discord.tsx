// The community Discord: a button at the top of Settings, and a gentle invitation for people
// who keep coming back (on the 3rd day they play, then every 3 days, until they join).
import { useEffect, useState } from 'react';
import { useUI } from '../store.ts';
import { mirror } from '../net.ts';

export const DISCORD_URL = 'https://discord.gg/B6kPjrakW';

/** Discord's logo (simple-icons, CC0), filled in the current color. */
export function DiscordLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

const read = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Remember that they joined (or tapped through to join): no more invitations. */
export function markJoined() { write('owc.discordJoined', true); }

/** The Discord button: Discord's blurple, its logo, and the invite. */
export function DiscordButton({ label = 'Join our Discord' }: { label?: string }) {
  return (
    <a className="btn discord-btn" href={DISCORD_URL} target="_blank" rel="noopener noreferrer" onClick={markJoined}>
      <DiscordLogo size={20} /> {label}
    </a>
  );
}

/**
 * The invitation: for anyone who has played on 3 or more different days (the server's count,
 * or this browser's, whichever is more), then every 3 days, until they join. It waits for a
 * quiet moment (no battle, sheet or welcome screen open).
 */
export function DiscordNudge() {
  const ui = useUI();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const d = today();
    const days = read<string[]>('owc.visitDays', []);
    if (!days.includes(d)) write('owc.visitDays', [...days, d].slice(-30));
    const local = days.includes(d) ? days.length : days.length + 1;
    const last = read<string | null>('owc.discordShown', null);
    if (read('owc.discordJoined', false) || (last && daysBetween(last, d) < 3)) return;
    let tries = 0;
    const t = setInterval(() => {
      // Played on 3+ days? (The server knows about other devices and days before this browser.)
      if (Math.max(local, mirror.self?.daysPlayed ?? 0) < 3) { if (mirror.self) clearInterval(t); return; }
      const s = useUI.getState();
      const busy = s.sheet || s.tutorial != null || s.battleFocus != null || s.questHelp || s.riddle != null || s.buildType || document.querySelector('.welcome-backdrop, .story-backdrop');
      if (busy) { if (++tries > 30) clearInterval(t); return; }
      clearInterval(t);
      write('owc.discordShown', d);
      setOpen(true);
    }, 25_000);
    return () => clearInterval(t);
  }, []);
  if (!open || ui.battleFocus != null) return null;
  const close = () => setOpen(false);
  return (
    <div className="sheet-backdrop story-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="story-card discord-card" role="dialog" aria-label="Join the Discord">
        <span className="discord-mark"><DiscordLogo size={34} /></span>
        <h2>Join the Discord</h2>
        <p className="story-text">Meet the other rulers of the Board, find allies (and rivals), report bugs, and see what's coming before anyone else.</p>
        <DiscordButton label="Join the Discord" />
        <button className="btn ghost" onClick={close}>Not now</button>
      </div>
    </div>
  );
}
