// The Herald (docs/specs/discord.md): the community Discord's crier. A pawn in its kettle helm
// blows a long brass trumpet hung with a gold banner bearing a knight, on a plum disc in a
// gold ring. Same style as everything else: ink outline, flat fills, a soft shade band.
import { INK, MAT, part, line, circ, rr } from '../lib/style.mjs';
import { pawn } from './pieces.mjs';

export function herald() {
  const disc = part(circ(50, 50, 47), '#4a2f52', null) +
    `<circle cx="50" cy="50" r="43.5" fill="none" stroke="${MAT.gold}" stroke-width="2.6"/>` +
    `<circle cx="50" cy="50" r="47" fill="none" stroke="${INK}" stroke-width="3.2"/>`;
  // The pawn, a little left and low, facing right.
  const body = `<g transform="translate(-6 9) scale(0.86)">${pawn({ side: 'light', team: '#e3b23c' })}</g>`;
  // The banner hangs from the trumpet: gold cloth, a swallowtail, a knight's head on it.
  const banner = part('M53.4 49.9 L69.1 40.4 L69.1 67.4 L61.2 60.4 L53.4 76.9 Z', '#e3b23c', '#c9962a', { shadeX: 64 }) +
    `<g transform="translate(50.7 44.1) scale(0.22)"><path d="M30 77 C30 64 40 58 44 52 C38 54 30 57 24 53 C19 50 18 44 22 41 C28 34 34 26 40 21 L41 12 L47 19 C58 18 71 26 72 42 C74 56 70 68 70 77 Z" fill="#4a2f52"/></g>`;
  // The trumpet: a brass tube from the herald's mouth, flaring into a bell; sound lines from it.
  const horn = line('M45.0 55.0 L73.0 38.0', 4.4, INK) + line('M45.0 55.0 L73.0 38.0', 2.2, MAT.gold) +
    part('M74.1 39.9 L86.6 39.1 Q85.0 30.7 78.3 25.5 L71.9 36.1 Z', MAT.gold, MAT.goldShade, { shadeX: 82 }) + line('M86.6 39.1 Q85.0 30.7 78.3 25.5', 1.8, '#fff1c2') +
    part(circ(45,55,2.6), MAT.goldShade, null);
  const sound = line('M90.6 34.3 L96.5 34.3 M88.4 28.7 L93.5 25.5 M84.4 24.0 L87.1 18.9', 2.2, '#f6e7c1');
  return disc + body + banner + horn + sound;
}
