// The game's icon set: small inline SVGs in one style (rounded 2px strokes on a
// 24px grid, colored by the surrounding text). No emoji or symbol glyphs anywhere
// in the UI: they render differently on every platform.
import type { CSSProperties } from 'react';

const P: Record<string, string> = {
  hammer: 'M3.5 20.5l9.2-9.2M9.8 8.3l4.9-4.9a1.4 1.4 0 0 1 2 0l3.9 3.9a1.4 1.4 0 0 1 0 2l-4.9 4.9a1.4 1.4 0 0 1-2 0l-3.9-3.9a1.4 1.4 0 0 1 0-2zM14.6 3.5l-1.6-1.6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  help: 'M9.2 9a3 3 0 1 1 4.3 2.7c-.9.4-1.5 1.2-1.5 2.1v.7M12 18h.01',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  pause: 'M9 5v14M15 5v14',
  play: 'M8 5l11 7-11 7z',
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z',
  alert: 'M12 4l9 16H3zM12 10v4M12 17.5h.01',
  swords: 'M4 4l9 9M4 4v3l8 8M4 4h3l8 8M20 4l-9 9M20 4v3l-8 8M20 4h-3l-8 8M6 18l-2 2M18 18l2 2M9 15l-3 3M15 15l3 3',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  crown: 'M4 17h16M5 17L3.5 7l5 4L12 5l3.5 6 5-4L19 17',
  castle: 'M5 21V9h2v2h2V9h2v2h2V9h2v2h2V9h2v12zM10 21v-4a2 2 0 0 1 4 0v4',
  house: 'M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5',
  chevron: 'M9 5l7 7-7 7',
  dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  resign: 'M6 21V4M6 4h11l-2 4 2 4H6M3 21h6',
  draw: 'M4 12h4M16 12h4M9 9l6 6M15 9l-6 6',
  // emotes
  handshake: 'M3 11l4-4 4 2 3-2 3 1 4 4M7 7l-4 8 3 3M17 8l4 7-3 3M8 16l2 2M11 14l3 3M13 12l3 3M9 12l4-3',
  clap: 'M8 13l-2-4a1.5 1.5 0 0 1 2.6-1.5l3.4 5M9.5 9.5L8 6a1.5 1.5 0 0 1 2.7-1.2l3.3 6.7M12 8.5l-.7-1.7a1.5 1.5 0 0 1 2.7-1.2l3 6.4c1.4 3-.2 6.3-3.3 7.1-2.2.6-4.5-.3-5.7-2.2L5.5 13a1.5 1.5 0 0 1 2.5-1.5l1.5 2M19 4l1-2M21 7l2-1M4 3l1 2',
  meh: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 10h.01M15.5 10h.01M8.5 15h7',
  flame: 'M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.4 3.6-8.3.5 2 1.6 3 2.7 3.4C12 7 13.3 4.9 15 3c.3 3.7 3.5 6.3 3.5 11.2 0 3.9-2.8 6.8-6.5 6.8zM12 21c-1.7 0-3-1.3-3-3.1 0-1.8 1.4-2.6 2.2-4.2.7 1.4 3.8 2.4 3.8 4.3 0 1.7-1.3 3-3 3z',
  think: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 10h.01M15.5 10h.01M9 15.5c1.6-.8 3.8-.9 6 .4M17 3.5a2 2 0 1 1 2.6 2.6c-.5.3-.6.7-.6 1.2',
  pawn: 'M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9.5 11.5l-1 5.5h7l-1-5.5M6 20h12v-3H6z',
};

export type IconName = keyof typeof P;

/** Emote ids are fixed in the protocol (0–5); these are their icons. */
export const EMOTE_ICONS: IconName[] = ['handshake', 'clap', 'meh', 'flame', 'think', 'pawn'];
export const EMOTE_LABELS = ['Good game', 'Well played', 'Hmm', 'On fire', 'Thinking', 'Your move'];

export function Icon({ name, size = 18, stroke = 2.2, style, title }: { name: IconName; size?: number; stroke?: number; style?: CSSProperties; title?: string }) {
  return (
    <svg className="icon-svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={P[name]} />
    </svg>
  );
}
