// A promoted pawn (battle.md §5): it fights as its new piece for this battle only,
// like a pawn that found a magic artifact. So we draw the pawn, and around it a
// glowing, see-through spirit of the piece it's acting as: the spirit's shape
// (a queen's crown, a knight's head) tells you how it moves, and the pawn inside
// tells you it's borrowed. Works for player pieces and creatures alike.
import { uid } from '../lib/style.mjs';

const SPIRIT = '#9fe8ff';

/**
 * ghost: markup of the piece it's acting as (100x100). pawn: markup of the pawn.
 * Returns 100x100 markup.
 */
export function ascended(ghost, pawn, gold = false) {
  const f = uid('asc'), g = uid('glow');
  // Filter: recolor the ghost to a pale spirit tone, keeping its shape and shading.
  const filters =
    `<filter id="${f}" x="-20%" y="-20%" width="140%" height="140%">` +
      // A raid's commander (battle.md §9) wears a golden spirit; a promotion, a pale blue one.
      (gold ? `<feColorMatrix type="matrix" values="0.3 0.3 0.3 0 0.62  0.28 0.28 0.28 0 0.48  0.1 0.1 0.1 0 0.12  0 0 0 0.8 0"/>`
            : `<feColorMatrix type="matrix" values="0.25 0.25 0.25 0 0.45  0.3 0.3 0.3 0 0.62  0.3 0.3 0.3 0 0.72  0 0 0 0.75 0"/>`) +
    `</filter>` +
    `<filter id="${g}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2"/></filter>`;
  const spark = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28} Z" fill="#fff" opacity="0.9"/>`;
  return `<defs>${filters}</defs>` +
    // A soft aura behind everything.
    `<ellipse cx="50" cy="50" rx="34" ry="40" fill="${gold ? '#ffd76a' : SPIRIT}" opacity="${gold ? 0.36 : 0.28}" filter="url(#${g})"/>` +
    // The spirit of the piece it's playing as, a little larger and lifted.
    `<g filter="url(#${f})" transform="translate(50 52) scale(1.06) translate(-50 -54)">${ghost}</g>` +
    // The pawn itself, in front and smaller, standing on the ground line.
    `<g transform="translate(50 90) scale(0.74) translate(-50 -90)">${pawn}</g>` +
    spark(18, 30, 4.5) + spark(83, 22, 3.6) + spark(78, 60, 2.8);
}
