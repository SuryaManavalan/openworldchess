// Crowns, the shop currency (docs/specs/cosmetics.md): a gold coin stamped with
// the game's king crown. Used as the in-game currency icon and for the pack
// images shown on Stripe's checkout page.
import { MAT } from '../lib/style.mjs';

/** One Crown coin, centered at (cx, cy) with radius r, seen slightly from above. Outlines scale with the coin. */
export function coin(cx = 50, cy = 50, r = 40, tilt = 0.9) {
  const ry = r * tilt, rim = r * 0.14, k = r / 40;
  const sw = Math.max(1.2, 2.8 * k);
  const ink = '#2b2622';
  const crown = (x, y) =>
    `<path d="M${x - 17 * k} ${y + 9 * k} L${x - 20 * k} ${y - 8 * k} L${x - 9 * k} ${y - 1 * k} L${x} ${y - 13 * k} L${x + 9 * k} ${y - 1 * k} L${x + 20 * k} ${y - 8 * k} L${x + 17 * k} ${y + 9 * k} Z" fill="#fbe08a" stroke="#9a6a14" stroke-width="${2 * k}" stroke-linejoin="round"/>` +
    `<path d="M${x - 2.4 * k} ${y - 13 * k} V${y - 22 * k} H${x + 2.4 * k} V${y - 13 * k} Z M${x - 6 * k} ${y - 19.5 * k} H${x + 6 * k} V${y - 15.5 * k} H${x - 6 * k} Z" fill="#fbe08a" stroke="#9a6a14" stroke-width="${1.6 * k}" stroke-linejoin="round"/>` +
    `<circle cx="${x}" cy="${y + 2 * k}" r="${2.6 * k}" fill="#d9534a"/>`;
  return (
    // edge (the coin's thickness), with milled lines
    `<path d="M${cx - r} ${cy} A${r} ${ry} 0 0 0 ${cx + r} ${cy} V${cy + rim} A${r} ${ry} 0 0 1 ${cx - r} ${cy + rim} Z" fill="#b9831f" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/>` +
    [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].map((f) => `<path d="M${cx + r * f} ${cy + ry * Math.sqrt(1 - f * f) + rim * 0.25} v${rim * 0.5}" stroke="#8c5f12" stroke-width="${1.3 * k}"/>`).join('') +
    // face
    `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${ry}" fill="${MAT.gold}" stroke="${ink}" stroke-width="${sw}"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${r * 0.8}" ry="${ry * 0.8}" fill="none" stroke="#c9952a" stroke-width="${2 * k}"/>` +
    `<g transform="translate(${cx} ${cy}) scale(1 ${tilt}) translate(${-cx} ${-cy})">${crown(cx, cy + 3 * k)}</g>` +
    // shine
    `<path d="M${cx - r * 0.62} ${cy - ry * 0.3} Q${cx - r * 0.45} ${cy - ry * 0.72} ${cx - r * 0.05} ${cy - ry * 0.8}" stroke="#fff6c9" stroke-width="${3 * k}" fill="none" stroke-linecap="round" opacity=".85"/>`
  );
}

/** The currency icon: one coin, 100x100. */
export function crownIcon() {
  return coin(50, 48, 38, 0.92);
}

/** A pile of Crowns for a pack image, 100x100. More coins for bigger packs. */
export function pile(n = 5) {
  // [x, y, r, tilt], listed back to front.
  const all = [
    [50, 36, 17, 0.5], [34, 44, 16, 0.5], [66, 44, 16, 0.5], [22, 56, 15, 0.5], [78, 56, 15, 0.5],
    [40, 55, 18, 0.5], [60, 55, 18, 0.5], [30, 68, 19, 0.5], [70, 68, 19, 0.5], [50, 70, 21, 0.5],
  ];
  const pick = n >= 10 ? all : n >= 7 ? all.slice(3) : all.slice(5);
  let s = `<ellipse cx="50" cy="84" rx="42" ry="7" fill="#000" opacity=".25"/>`;
  // Stacks behind the pile, taller for bigger packs.
  const stacks = n >= 10 ? [[30, 44, 7], [50, 40, 10], [70, 44, 7]] : n >= 7 ? [[38, 44, 7], [62, 44, 8]] : [[50, 44, 7]];
  for (const [x, base, h] of stacks) for (let i = 0; i < h; i++) s += coin(x, base - i * 3.2, 14, 0.5);
  for (const [x, y, r, t] of pick) s += coin(x, y, r, t);
  // One coin standing on its edge in front, facing us.
  s += coin(n >= 7 ? 82 : 76, 72, 11, 1);
  return s;
}
