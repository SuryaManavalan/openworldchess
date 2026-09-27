// Creature heads and knight mounts, set A (see creatures.mjs for the contract).
// Heads are drawn in a local box where the head mass is a circle of radius 10
// around (0, 0), then scaled to ctx.r; outlines are corrected so they come out
// at the house weight at any size.
import { INK, SW, part, line, uid } from '../lib/style.mjs';

function tint(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** Drawing kit for one head: local units, outline weight kept constant. */
function kit({ cx, cy, r, pal }) {
  const k = r / 10, sw = SW / k;
  const P = (d, fill, { shade = tint(fill, -0.18), sx = 3, stroke = true, w = sw } = {}) => {
    let s = `<path d="${d}" fill="${fill}"/>`;
    if (shade) {
      const id = uid('h');
      s += `<clipPath id="${id}"><path d="${d}"/></clipPath><rect x="${sx}" y="-40" width="60" height="80" fill="${shade}" clip-path="url(#${id})"/>`;
    }
    if (stroke) s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
    return s;
  };
  const F = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
  const L = (d, w = 2.2, color = INK) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w / k}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const O = (x, y, rx, ry = rx) => `M${x - rx} ${y} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
  // A stoic eye: solid oval under a straight ink brow dipping toward the nose.
  const E = (x, y, s0 = 1.6, color = pal.eye, inner = x < 0 ? 1 : -1, brow = true, s = s0 * 1.25) =>
    `<ellipse cx="${x}" cy="${y}" rx="${s * 0.75}" ry="${s}" fill="${color}"${color === INK ? '' : ` stroke="${INK}" stroke-width="${0.8 / k}"`}/>` +
    (brow ? `<path d="M${x - s * 1.6} ${y - s * 1.7 + (inner < 0 ? s * 0.5 : 0)} L${x + s * 1.6} ${y - s * 1.7 + (inner > 0 ? s * 0.5 : 0)}" stroke="${INK}" stroke-width="${1.3 / k}" stroke-linecap="round"/>` : '');
  const EE = (y, gap = 7, s, color) => E(-gap / 2, y, s, color) + E(gap / 2, y, s, color);
  const wrap = (inner) => `<g transform="translate(${cx} ${cy}) scale(${k})">${inner}</g>`;
  return { P, F, L, O, E, EE, wrap, pal };
}

const mirrorX = (d) => d.replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (m, x, y) => `${-parseFloat(x)} ${y}`);
const both = (P, d, fill, o) => P(d, fill, o) + P(mirrorX(d), fill, o);
const big = (role) => role === 'K' || role === 'R';

// ---------- heads ----------

export const HEADS = {
  goblin(ctx) {
    const { P, L, EE, wrap, pal } = kit(ctx);
    return wrap(
      // long drooping ears
      both(P, 'M-7 -3 C-12 -6 -17 -9 -20 -8 C-17 -3 -12 1 -7 3 Z', pal.skin, { shade: null }) +
      L('M-10 -3 L-15 -6', 1.4) + L('M10 -3 L15 -6', 1.4) +
      P('M-9 -2 C-9 -9 -4 -10 0 -10 C4 -10 9 -9 9 -2 C9 5 5 10 0 10 C-5 10 -9 5 -9 -2 Z', pal.skin) +
      EE(-1.5, 7.5, 1.8) +
      // hooked nose and a snaggle-toothed grin
      P('M-1.2 0 L1.2 0 L2.2 5.5 L-2.4 4.6 Z', tint(pal.skin, -0.12), { shade: null, w: 1.3 }) +
      L('M-4 7.5 H4', 1.4) + P('M-3 7.5 L-2.4 9.8 L-1.6 7.5 Z M1.6 7.5 L2.4 9.8 L3 7.5 Z', '#f6efdf', { shade: null, w: 0.8 }),
    );
  },

  wolf(ctx) {
    const { P, F, L, EE, O, wrap, pal } = kit(ctx);
    return wrap(
      both(P, 'M-9 -3 L-9 -16 L-2 -9 Z', pal.skin, { shade: null }) +
      both(P, 'M-7.5 -5 L-7.8 -12.5 L-4 -8.5 Z', tint(pal.accent, -0.1), { shade: null, stroke: false }) +
      P('M-10 -3 C-10 -9 -5 -10 0 -10 C5 -10 10 -9 10 -3 C11 3 8 5 6 7 L0 12 L-6 7 C-8 5 -11 3 -10 -3 Z', pal.skin) +
      // pale muzzle and cheek ruff
      P('M-5 3 C-5 0 5 0 5 3 L3 9 L0 11.5 L-3 9 Z', pal.accent, { shade: null }) +
      both(P, 'M-10 1 L-13 4 L-9 5 L-11 8 L-6 7 Z', pal.skin, { shade: null }) +
      EE(-2.5, 8, 1.6) +
      P(O(0, 3.2, 2.4, 1.6), INK, { shade: null, stroke: false }) +
      L('M0 5 V8 M-2.2 9 Q0 10 2.2 9', 1.2),
    );
  },

  kobold(ctx) {
    const { P, L, EE, O, wrap, pal, F } = kit(ctx);
    return wrap(
      // swept-back horns
      both(P, 'M-5 -8 C-8 -13 -12 -15 -15 -14 C-12 -12 -10 -9 -8 -5 Z', '#efe4c8', { shade: null }) +
      // fin ears
      both(P, 'M-8 -2 L-17 -4 L-14 0 L-17 3 L-8 3 Z', pal.accent, { shade: null }) +
      P('M-8 -3 C-8 -9 -4 -10 0 -10 C4 -10 8 -9 8 -3 C8 2 6 4 5 6 C4 10 2 12 0 12 C-2 12 -4 10 -5 6 C-6 4 -8 2 -8 -3 Z', pal.skin) +
      // scale belly of the snout
      P('M-3.5 4 C-3 2 3 2 3.5 4 L2.5 10 Q0 11.5 -2.5 10 Z', tint(pal.skin, 0.25), { shade: null }) +
      EE(-2.5, 8, 1.7) +
      F(O(-1.3, 9, 0.6), INK) + F(O(1.3, 9, 0.6), INK) +
      L('M-3 -6 l1.5 1.2 M0 -7.5 l1.5 1.2 M3 -6 l1.5 1.2', 1, tint(pal.skin, -0.3)),
    );
  },

  orc(ctx) {
    const { P, L, EE, wrap, pal, F, O } = kit(ctx);
    const t = big(ctx.role) ? 1.4 : 1;
    return wrap(
      both(P, 'M-9 -3 L-15 -7 L-11 1 Z', pal.skin, { shade: null }) +
      P('M-10 -2 C-10 -9 -5 -10 0 -10 C5 -10 10 -9 10 -2 C11 4 8 10 0 10 C-8 10 -11 4 -10 -2 Z', pal.skin) +
      // heavy brow ridge
      P('M-8 -4 Q0 -7 8 -4 L8 -2 Q0 -4 -8 -2 Z', tint(pal.skin, -0.25), { shade: null, w: 1.8 }) +
      EE(-0.5, 7.5, 1.6) +
      // flat nose
      P('M-2.5 1.5 Q0 0 2.5 1.5 L2 4 H-2 Z', tint(pal.skin, -0.1), { shade: null, w: 1.6 }) +
      L('M-5 7 Q0 5.5 5 7', 1.5) +
      // lower tusks
      both(P, `M-4.2 7 L${-4.8 - t} ${6.5 - 4 * t} L-2.6 6.8 Z`, '#f6efdf', { shade: null, w: 1.4 }) +
      F(O(0, -8, 0), 'none') + L('M-6 -8 L-5 -9.5 M5 -8 L6 -9.5', 1),
    );
  },

  bandit(ctx) {
    const { P, L, EE, wrap, pal } = kit(ctx);
    return wrap(
      // pointed hood
      P('M0 -16 C8 -12 12 -5 12 3 C12 9 8 12 0 12 C-8 12 -12 9 -12 3 C-12 -5 -8 -12 0 -16 Z', pal.dark) +
      P('M-7 0 C-7 -5 -4 -7 0 -7 C4 -7 7 -5 7 0 C7 6 4 9 0 9 C-4 9 -7 6 -7 0 Z', pal.skin, { shade: tint(pal.skin, -0.15) }) +
      // domino mask
      P('M-8 -2.5 Q0 -4.5 8 -2.5 L8 1.5 Q4 2.5 0 0.8 Q-4 2.5 -8 1.5 Z', pal.accent, { shade: null, w: 1.8 }) +
      EE(-0.5, 7, 1.3, '#f8f4ec') +
      // stubble jaw and a stern mouth
      L('M-2.5 5.5 H2.5', 1.3) +
      L('M-4 3 l-0.5 0.8 M4 3 l0.5 0.8', 0.9, tint(pal.skin, -0.35)),
    );
  },

  deer(ctx) {
    const { P, L, EE, wrap, pal, O } = kit(ctx);
    const antlers = ctx.role === 'K' || ctx.role === 'R' || ctx.role === 'B';
    const ant = 'M-4 -8 C-6 -12 -9 -15 -12 -20 M-7.5 -13 L-13 -13 M-9.8 -16.5 L-8 -21 M-11 -18.6 L-16 -19';
    return wrap(
      (antlers ? L(ant, 3.6) + L(mirrorX(ant), 3.6) + L(ant, 1.8, '#efe0c0') + L(mirrorX(ant), 1.8, '#efe0c0') : '') +
      // leaf ears out to the sides
      both(P, 'M-7 -4 C-12 -8 -17 -7 -18 -5 C-15 -2 -11 -1 -7 -1 Z', pal.skin, { shade: null }) +
      both(P, 'M-9 -4 C-12 -5.5 -14.5 -5.5 -15.5 -4.8 C-13 -3.4 -11 -3 -9 -3 Z', pal.accent, { shade: null, stroke: false }) +
      P('M-8 -3 C-8 -9 -4 -10 0 -10 C4 -10 8 -9 8 -3 C8 2 5 6 3.5 10 Q0 12.5 -3.5 10 C-5 6 -8 2 -8 -3 Z', pal.skin) +
      P('M-3.2 6 Q0 4.5 3.2 6 L3 10 Q0 12.3 -3 10 Z', pal.accent, { shade: null, w: 1.6 }) +
      P(O(0, 8.4, 1.8, 1.2), INK, { shade: null, stroke: false }) +
      EE(-2, 8, 1.8, INK) +
      L('M-1.5 -7 l1.5 1 l1.5 -1', 1, tint(pal.skin, 0.35)),
    );
  },

  boar(ctx) {
    const { P, L, EE, wrap, pal, F, O } = kit(ctx);
    const t = big(ctx.role) ? 1.5 : 1;
    return wrap(
      // bristle crest
      P('M-5 -8 L-4 -13 L-2 -9.5 L0 -14 L2 -9.5 L4 -13 L5 -8 Z', pal.dark, { shade: null }) +
      both(P, 'M-7 -5 L-12 -11 L-5 -8.5 Z', pal.skin, { shade: null }) +
      P('M-10 -1 C-10 -8 -5 -9.5 0 -9.5 C5 -9.5 10 -8 10 -1 C10 5 7 10 0 10 C-7 10 -10 5 -10 -1 Z', pal.skin) +
      EE(-2.5, 9, 1.5, INK) +
      // snout disc
      P(O(0, 5, 5, 3.6), tint(pal.skin, 0.35), { shade: null }) +
      F(O(-1.8, 5, 0.9, 1.3), INK) + F(O(1.8, 5, 0.9, 1.3), INK) +
      // tusks curling up past the snout
      both(P, `M-4.5 7 C${-7 - t} ${6.5} ${-8 - t} ${4 - 2 * t} ${-7 - t} ${2 - 3 * t} C-7 3 -6 5 -3.5 6 Z`, pal.accent, { shade: null, w: 1.4 }),
    );
  },

  gnoll(ctx) {
    const { P, L, EE, wrap, pal, F, O } = kit(ctx);
    return wrap(
      // mane crest
      P('M-3 -8 L-5 -15 L-1 -11 L0 -16 L1.5 -11 L5 -14 L3 -8 Z', pal.accent, { shade: null }) +
      // round hyena ears
      both(P, 'M-6 -6 C-9 -14 -15 -13 -13 -6 C-12 -3 -9 -3 -6 -4 Z', pal.skin, { shade: null }) +
      both(P, 'M-8 -6.5 C-10 -11 -12.5 -10 -12 -7 Z', pal.dark, { shade: null, stroke: false }) +
      P('M-9 -3 C-9 -9 -5 -10 0 -10 C5 -10 9 -9 9 -3 C9 2 6 5 5 8 C4 11 2 12.5 0 12.5 C-2 12.5 -4 11 -5 8 C-6 5 -9 2 -9 -3 Z', pal.skin) +
      // dark muzzle and spots
      P('M-4 3 Q0 1.5 4 3 L3 10 Q0 12.2 -3 10 Z', pal.dark, { shade: null }) +
      P(O(0, 4.3, 1.8, 1.2), INK, { shade: null, stroke: false }) +
      F(O(-6, 0, 0.9), pal.dark) + F(O(6.5, -1, 0.8), pal.dark) + F(O(-4, -7, 0.7), pal.dark) + F(O(4.5, -7.5, 0.8), pal.dark) +
      EE(-2.5, 7.5, 1.5) +
      L('M-1.8 9.5 L-1.2 11 M1.8 9.5 L1.2 11', 1, '#f6efdf'),
    );
  },

  lizard(ctx) {
    const { P, L, EE, wrap, pal, F, O } = kit(ctx);
    return wrap(
      // spined crest over the skull
      P('M-2 -9 L-4 -16 L0 -12 L1 -18 L3 -12 L6 -15 L4 -8 Z', pal.accent, { shade: null }) +
      // side frills
      both(P, 'M-8 -2 L-15 -6 L-13 -1 L-16 2 L-12 3 L-14 7 L-8 5 Z', pal.accent, { shade: null }) +
      P('M-9 -2 C-9 -8 -5 -10 0 -10 C5 -10 9 -8 9 -2 C9 4 7 9 5 11 Q0 13 -5 11 C-7 9 -9 4 -9 -2 Z', pal.skin) +
      // big eyes set on the sides
      P(O(-5.5, -2, 2.7), pal.eye, { shade: null, w: 1.4 }) + P(O(5.5, -2, 2.7), pal.eye, { shade: null, w: 1.4 }) +
      F('M-5.9 -4.2 h0.8 v4.4 h-0.8 Z', INK) + F('M5.1 -4.2 h0.8 v4.4 h-0.8 Z', INK) +
      L('M-5 8 Q0 10 5 8', 1.4) + F(O(-1.4, 4, 0.6), INK) + F(O(1.4, 4, 0.6), INK) +
      L('M-3 -6 h1.5 M1.5 -6 h1.5 M-1 -3.5 h2', 1, tint(pal.skin, -0.3)),
    );
  },

  frog(ctx) {
    const { P, L, wrap, pal, F, O } = kit(ctx);
    return wrap(
      // wide flat head with eyes bulging on top
      P('M-12 2 C-12 -5 -7 -7 0 -7 C7 -7 12 -5 12 2 C12 8 7 10 0 10 C-7 10 -12 8 -12 2 Z', pal.skin) +
      P(O(-6.5, -7, 4.2), pal.skin, { shade: null }) + P(O(6.5, -7, 4.2), pal.skin, { shade: null }) +
      P(O(-6.5, -7.5, 2.6), pal.eye, { shade: null, w: 1.2 }) + P(O(6.5, -7.5, 2.6), pal.eye, { shade: null, w: 1.2 }) +
      F('M-8.4 -8 h3.8 v1.1 h-3.8 Z', INK) + F('M4.6 -8 h3.8 v1.1 h-3.8 Z', INK) +
      // pale throat and a wide mouth
      P('M-8 5 Q0 11 8 5 Q9 9 0 10.5 Q-9 9 -8 5 Z', pal.accent, { shade: null, stroke: false }) +
      L('M-10 3.5 Q0 8 10 3.5', 1.6) +
      F(O(-1.5, -1, 0.6), INK) + F(O(1.5, -1, 0.6), INK) +
      F(O(-8, -1, 0.9), pal.dark) + F(O(8.5, 0.5, 0.7), pal.dark),
    );
  },

  spider(ctx) {
    const { P, L, wrap, pal, F, O } = kit(ctx);
    const e = (x, y, r) => F(O(x, y, r), pal.eye) + F(O(x - r * 0.3, y - r * 0.3, r * 0.3), '#fff');
    return wrap(
      // leg tips reaching up behind the head
      L('M-7 -5 C-11 -12 -14 -12 -17 -8 M7 -5 C11 -12 14 -12 17 -8 M-8 0 C-13 -4 -16 -3 -18 1 M8 0 C13 -4 16 -3 18 1', 3.2) +
      L('M-7 -5 C-11 -12 -14 -12 -17 -8 M7 -5 C11 -12 14 -12 17 -8 M-8 0 C-13 -4 -16 -3 -18 1 M8 0 C13 -4 16 -3 18 1', 1.5, pal.dark) +
      P('M-10 0 C-10 -7 -5 -10 0 -10 C5 -10 10 -7 10 0 C10 6 6 9 0 9 C-6 9 -10 6 -10 0 Z', pal.skin) +
      // fangs
      both(P, 'M-4 6 C-5 9 -4 12 -2 13 C-2.5 11 -1.5 9 -1 7 Z', pal.dark, { shade: null, w: 1.4 }) +
      // eight eyes: two big, six small
      e(-2.4, -1, 2.1) + e(2.4, -1, 2.1) +
      e(-6, -3.5, 1.2) + e(6, -3.5, 1.2) + e(-4, -5.8, 1) + e(4, -5.8, 1) + e(-1.3, -6.5, 0.9) + e(1.3, -6.5, 0.9) +
      L('M-5 3 l1 1 M5 3 l-1 1', 0.9, pal.accent),
    );
  },

  owlbear(ctx) {
    const { P, L, wrap, pal, F, O } = kit(ctx);
    return wrap(
      // feather ear tufts
      both(P, 'M-5 -8 L-10 -16 L-8 -8 L-11 -12 L-9 -5 Z', pal.dark, { shade: null }) +
      P('M-11 0 C-11 -8 -6 -10 0 -10 C6 -10 11 -8 11 0 C11 7 7 11 0 11 C-7 11 -11 7 -11 0 Z', pal.skin) +
      // pale facial discs with big round eyes
      P(O(-4.3, -1.5, 4.2), pal.accent, { shade: null, w: 1.4 }) + P(O(4.3, -1.5, 4.2), pal.accent, { shade: null, w: 1.4 }) +
      P(O(-4.3, -1.5, 2), pal.eye, { shade: null, w: 1 }) + P(O(4.3, -1.5, 2), pal.eye, { shade: null, w: 1 }) +
      F(O(-4.3, -1.5, 0.9), INK) + F(O(4.3, -1.5, 0.9), INK) +
      L('M-8 -5.5 L-1 -3.5 M8 -5.5 L1 -3.5', 1.4) +
      // hooked beak
      P('M-2.5 1.5 Q0 0.5 2.5 1.5 L0.5 8 Q0 8.8 -0.5 8 Z', '#e8b03a', { shade: '#c38f22', sx: 0.5, w: 1.4 }) +
      L('M-7 6 l1 1.5 M7 6 l-1 1.5 M-3 9 l0.5 1.3 M3 9 l-0.5 1.3', 1, pal.dark),
    );
  },

  harpy(ctx) {
    const { P, L, EE, wrap, pal } = kit(ctx);
    return wrap(
      // wild feather hair
      P('M-12 6 L-14 -2 L-11 -3 L-13 -9 L-9 -9 L-9 -15 L-4 -12 L0 -17 L4 -12 L9 -15 L9 -9 L13 -9 L11 -3 L14 -2 L12 6 L8 4 L8 -3 L-8 -3 L-8 4 Z', pal.dark, { shade: tint(pal.dark, -0.2), sx: 5 }) +
      P('M-7 -1 C-7 -6 -4 -8 0 -8 C4 -8 7 -6 7 -1 C7 5 4 9 0 9 C-4 9 -7 5 -7 -1 Z', pal.skin, { shade: tint(pal.skin, -0.15) }) +
      P('M-7 -3 Q-3 -8 0 -8 Q3 -8 7 -3 Q3 -5.5 0 -5.5 Q-3 -5.5 -7 -3 Z', pal.dark, { shade: null, stroke: false }) +
      EE(-0.5, 6.5, 1.4) +
      // sharp nose, thin mouth
      L('M0 1 L-1 3.5 H0.5', 1.1) + L('M-2 6 Q0 5.3 2 6', 1.2) +
      P('M-1.5 -7 L0 -9.5 L1.5 -7 L0 -5.5 Z', pal.accent, { shade: null, w: 1 }),
    );
  },

  troll(ctx) {
    const { P, L, EE, wrap, pal, F, O } = kit(ctx);
    return wrap(
      // shaggy hair tuft
      P('M-6 -8 L-7 -14 L-3 -10 L-1 -15 L1 -10 L4 -14 L5 -8 Z', pal.accent, { shade: null }) +
      // big droopy ears
      both(P, 'M-9 -3 C-14 -4 -16 1 -13 4 C-11 5 -9 3 -8.5 1 Z', pal.skin, { shade: null }) +
      P('M-9 -2 C-9 -9 -5 -10 0 -10 C5 -10 9 -9 9 -2 C10 5 7 11 0 11 C-7 11 -10 5 -9 -2 Z', pal.skin) +
      P('M-7.5 -4 Q0 -6.5 7.5 -4 L7.5 -2.5 Q0 -4.5 -7.5 -2.5 Z', tint(pal.skin, -0.25), { shade: null, w: 1.5 }) +
      EE(-1, 7.5, 1.5) +
      // long hanging nose
      P('M-1.5 -1 C-2 3 -3.5 6 -1.5 7.5 C0.5 8.5 2.5 7 1.8 4.5 C1.3 2 1.5 0 1.5 -1 Z', tint(pal.skin, -0.08), { shade: null, w: 1.4 }) +
      L('M-5 9 Q0 10.5 5 9', 1.3) +
      both(P, 'M-4.5 9 L-5 6.2 L-3.3 8.8 Z', '#f6efdf', { shade: null, w: 1 }) +
      F(O(5.5, 1.5, 0.8), tint(pal.skin, -0.3)) + F(O(-6, 4, 0.6), tint(pal.skin, -0.3)),
    );
  },

  fish(ctx) {
    const { P, L, wrap, pal, F, O } = kit(ctx);
    return wrap(
      // spined fin crest
      P('M-6 -7 L-7 -15 L-3 -12 L-2 -17 L1 -12 L4 -16 L5 -11 L8 -13 L6 -6 Z', pal.accent, { shade: null }) +
      L('M-3 -9 L-5 -13 M0 -9 L-1 -14 M3 -9 L4 -13', 1, tint(pal.accent, -0.35)) +
      // gill fins
      both(P, 'M-9 -1 L-16 -6 L-15 0 L-17 4 L-9 4 Z', pal.accent, { shade: null }) +
      P('M-10 -1 C-10 -8 -5 -10 0 -10 C5 -10 10 -8 10 -1 C10 6 6 11 0 11 C-6 11 -10 6 -10 -1 Z', pal.skin) +
      // round fish eyes
      P(O(-4.5, -2.5, 2.6), pal.eye, { shade: null, w: 1.3 }) + P(O(4.5, -2.5, 2.6), pal.eye, { shade: null, w: 1.3 }) +
      F(O(-4.5, -2.5, 1.1), INK) + F(O(4.5, -2.5, 1.1), INK) +
      // wide mouth full of teeth
      P('M-6 4 Q0 2.5 6 4 Q5 9 0 9 Q-5 9 -6 4 Z', tint(pal.dark, -0.4), { shade: null, w: 1.5 }) +
      F('M-5 4 L-4 6 L-3 3.6 L-2 5.8 L-1 3.3 L0 5.6 L1 3.3 L2 5.8 L3 3.6 L4 6 L5 4 Z', '#f6efdf') +
      L('M-7 7 l-1.5 0.5 M7 7 l1.5 0.5', 1, tint(pal.skin, -0.35)),
    );
  },

  lion(ctx) {
    const { P, L, EE, wrap, pal, F, O } = kit(ctx);
    const maned = ctx.role !== 'Q' && ctx.role !== 'P';
    const mane = 'M0 -16 L4 -13 L9 -14 L10 -9 L15 -7 L13 -2 L16 2 L12 5 L13 10 L8 10 L6 14 L2 12 L0 16 L-2 12 L-6 14 L-8 10 L-13 10 L-12 5 L-16 2 L-13 -2 L-15 -7 L-10 -9 L-9 -14 L-4 -13 Z';
    return wrap(
      (maned ? P(mane, pal.accent, { shade: tint(pal.accent, -0.2), sx: 5 }) : both(P, 'M-6 -7 C-10 -12 -13 -9 -11 -5 Z', pal.skin, { shade: null })) +
      P('M-9 -2 C-9 -8 -5 -9.5 0 -9.5 C5 -9.5 9 -8 9 -2 C9 4 6 9 0 9 C-6 9 -9 4 -9 -2 Z', pal.skin) +
      (maned ? both(P, 'M-6 -7.5 C-8 -10.5 -10.5 -9 -9.5 -6 Z', pal.skin, { shade: null }) : '') +
      P('M-4.5 3 C-4.5 1 4.5 1 4.5 3 C4.5 6.5 2.5 8.5 0 8.5 C-2.5 8.5 -4.5 6.5 -4.5 3 Z', tint(pal.skin, 0.45), { shade: null, w: 1.4 }) +
      P('M-2 1.5 H2 L0 4 Z', INK, { shade: null, stroke: false }) +
      L('M0 4 V5.5 M-2 6.5 Q0 7.5 2 6.5', 1.1) +
      EE(-2.5, 7.5, 1.5, INK) +
      L('M0 -8 V-4', 1, tint(pal.skin, -0.25)) +
      F(O(-3, 5, 0.35), INK) + F(O(3, 5, 0.35), INK),
    );
  },
};

// ---------- mounts: knight profiles facing left ----------

const neckFront = 'M30 77 C30 64 40 58 44 52';
const neckBack = (x, y) => `C${x + 10} ${y - 1} 71 28 72 42 C74 56 70 68 70 77 Z`;
const eyeAt = (x, y, color = INK, r = 2) =>
  `<ellipse cx="${x}" cy="${y}" rx="${r * 0.72}" ry="${r}" fill="${color}"${color === INK ? '' : ` stroke="${INK}" stroke-width="1"`}/>` +
  `<path d="M${x - 3} ${y - 3.4} L${x + 3} ${y - 2.6}" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;
const dot = (x, y, rx = 1.4, ry = 1.8) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${INK}"/>`;
/** A saddle cloth band across the neck in the accent color. */
const harness = (pal) => part('M36 66 Q53 60 71 64 L71 71 Q53 67 33 73 Z', pal.accent, null);
/** Body with a shade band. */
const body = (d, fill, sx = 58) => part(d, fill, tint(fill, -0.18), { shadeX: sx });

export const MOUNTS = {
  horse(pal) {
    return body(`${neckFront} C38 54 30 57 24 53 C19 50 18 44 22 41 C28 34 34 26 40 21 L41 12 L47 19 ${neckBack(47, 19)}`, pal.skin) +
      part('M47 19 C58 18 71 26 72 42 C74 56 70 68 70 77 L63 77 C63 66 67 55 64 42 C62 31 56 25 46 23 Z', pal.dark, null) +
      line('M60 30 L66 28 M64 42 L70 41 M64 55 L70 56', 2.4) +
      harness(pal) + eyeAt(38, 32) + dot(24.5, 46);
  },

  wolf(pal) {
    return body(`${neckFront} C37 53 27 52 18 48 C14 46 15 41 19 40 L30 36 C33 32 35 27 36 24 L37 10 L44 20 L48 11 L51 22 ${neckBack(51, 22)}`, pal.skin) +
      part('M19 40 L30 36 C28 42 24 46 17 46 C15 44 16 41 19 40 Z', pal.accent, null) +
      // ruff down the neck
      part('M52 22 C62 22 71 30 72 42 C74 56 70 68 70 77 L64 77 L67 70 L62 66 L66 58 L61 52 L65 45 L59 38 L62 32 L55 28 Z', pal.dark, null) +
      line('M22 47 L27 45', 1.6) + harness(pal) + eyeAt(38, 32, pal.eye) + dot(17, 42, 1.8, 1.5);
  },

  weasel(pal) {
    return body(`${neckFront} C38 52 28 50 20 46 C15 44 15 38 20 36 C27 32 34 28 38 24 C38 18 42 14 46 15 C50 16 50 20 49 22 ${neckBack(49, 22)}`, pal.skin) +
      part('M20 36 C24 34 28 36 30 40 C27 44 22 46 18 44 C15 42 16 38 20 36 Z', tint(pal.skin, 0.5), null) +
      part('M56 26 C66 30 71 36 72 42 C74 56 70 68 70 77 L65 77 C66 64 67 50 60 40 Z', pal.dark, null) +
      harness(pal) + eyeAt(36, 31, pal.eye) + dot(17, 39, 1.5, 1.3) + line('M20 43 L10 41 M20 44 L11 46', 1);
  },

  boar(pal) {
    return body(`${neckFront} C40 56 30 58 22 56 L16 55 C13 54 13 46 16 45 L22 43 C28 36 34 29 40 25 L40 14 L48 22 ${neckBack(48, 22)}`, pal.skin) +
      // bristle mane
      part('M48 20 L52 14 L55 21 L60 16 L61 24 L67 21 L66 29 L72 29 L69 36 C68 30 62 24 52 23 Z', pal.dark, null) +
      part('M14 45 C11 47 11 54 14 56 L18 56 L18 45 Z', tint(pal.skin, 0.35), null) +
      part('M24 52 C20 50 18 44 22 38 C21 44 24 48 28 49 Z', pal.accent === '#9e3b30' ? '#f6efdf' : '#f6efdf', null) +
      harness(pal) + eyeAt(37, 35) + dot(14.5, 49, 0.8, 1.2) + dot(14.5, 53, 0.8, 1.2);
  },

  deer(pal) {
    return line('M45 18 C47 10 44 4 40 1 M46 12 L52 6 M44 7 L48 2', 4.6) + line('M45 18 C47 10 44 4 40 1 M46 12 L52 6 M44 7 L48 2', 2.2, '#efe0c0') +
      body(`${neckFront} C38 54 29 56 22 53 C18 51 18 46 21 43 C27 37 33 28 38 22 L30 17 C37 14 42 16 45 18 L50 14 L50 20 ${neckBack(50, 20)}`, pal.skin) +
      part('M22 53 C18 51 18 46 21 43 C23 46 26 49 30 51 C28 53 25 54 22 53 Z', pal.accent, null) +
      part('M40 18 C34 16 32 18 31 17 C35 14 40 15 43 17 Z', pal.accent, null) +
      harness(pal) + eyeAt(36, 32) + dot(21, 46, 1.4, 1.2);
  },

  hyena(pal) {
    return body(`${neckFront} C38 54 29 55 21 52 C16 50 16 44 20 42 C26 38 32 31 35 26 C33 20 35 13 40 13 C43 14 44 18 44 22 L50 22 ${neckBack(50, 22)}`, pal.skin) +
      part('M50 21 L53 15 L56 22 L60 17 L61 25 L66 22 L66 30 L72 31 L70 38 C66 30 60 24 50 23 Z', pal.accent, null) +
      part('M21 52 C16 50 16 44 20 42 C23 46 27 48 31 49 C29 52 25 53 21 52 Z', pal.dark, null) +
      `<circle cx="54" cy="44" r="2" fill="${pal.dark}"/><circle cx="61" cy="55" r="2.2" fill="${pal.dark}"/><circle cx="50" cy="60" r="1.8" fill="${pal.dark}"/>` +
      harness(pal) + eyeAt(35, 33, pal.eye) + dot(18, 45, 1.6, 1.4);
  },

  lizard(pal) {
    return body(`${neckFront} C38 52 26 52 17 50 C13 49 12 44 16 42 C24 38 30 32 36 28 C40 25 44 22 50 22 ${neckBack(50, 22)}`, pal.skin) +
      part('M50 21 L53 13 L57 22 L62 15 L63 25 L69 20 L68 30 L74 29 L71 38 C68 30 60 24 50 23 Z', pal.accent, null) +
      line('M16 47 Q26 48 34 45', 1.6) +
      part('M34 31 C38 25 44 25 46 29 C44 33 38 35 34 31 Z', pal.skin, null) +
      `<ellipse cx="40" cy="30" rx="2.8" ry="2.6" fill="${pal.eye}" stroke="${INK}" stroke-width="1"/><rect x="39.4" y="27.8" width="1.2" height="4.4" fill="${INK}"/>` +
      harness(pal) + dot(15.5, 44.5, 0.9, 0.8) + line('M50 40 l3 2 M56 50 l3 2 M48 50 l3 2', 1.2, tint(pal.skin, -0.3));
  },

  newt(pal) {
    return body(`${neckFront} C38 53 26 54 18 52 C12 50 11 44 16 41 C24 36 30 30 38 26 C44 23 48 22 52 22 ${neckBack(52, 22)}`, pal.skin) +
      // frilled external gills
      part('M50 26 L58 14 L57 23 L64 16 L61 26 L68 22 L62 30 Z', '#e0869a', null) +
      part('M18 52 C12 50 11 44 16 41 C22 46 30 48 38 48 C32 52 24 53 18 52 Z', tint(pal.skin, 0.4), null) +
      `<circle cx="55" cy="46" r="2.3" fill="${pal.dark}"/><circle cx="62" cy="58" r="2" fill="${pal.dark}"/><circle cx="48" cy="58" r="1.6" fill="${pal.dark}"/>` +
      part('M32 32 C35 26 42 26 43 31 C41 35 35 36 32 32 Z', pal.skin, null) +
      `<circle cx="37.5" cy="31" r="2.7" fill="${pal.eye}" stroke="${INK}" stroke-width="1"/><circle cx="37.5" cy="31" r="1.2" fill="${INK}"/>` +
      harness(pal) + line('M15 46 Q24 49 32 47', 1.5);
  },

  spider(pal) {
    const leg = (d) => line(d, 5.2) + line(d, 2.8, pal.dark);
    return leg('M40 50 C30 40 22 36 14 42 L12 52') + leg('M46 44 C38 30 30 22 22 22 L18 30') +
      body(`${neckFront} C38 54 30 56 26 52 C20 48 22 36 30 30 C38 24 44 20 52 22 ${neckBack(52, 22)}`, pal.skin) +
      part('M52 21 C62 21 71 30 72 42 C73 52 71 64 70 77 L64 77 C64 64 68 50 60 36 Z', pal.accent, null) +
      leg('M60 40 C66 26 74 18 82 20 L86 30') +
      // fangs and eye cluster
      part('M26 52 C24 57 25 62 28 64 C28 60 30 57 31 54 Z', pal.dark, null) +
      [[34, 34, 2.4], [30, 38, 2.2], [38, 30, 1.5], [28, 32, 1.3], [35, 39, 1.3]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${pal.eye}"/>`).join('') +
      line('M58 58 l4 -2 M56 66 l4 -2', 1.2, pal.accent);
  },

  owlbear(pal) {
    return body(`${neckFront} C40 56 34 57 29 55 L22 58 L25 50 C19 46 18 38 22 34 C26 28 32 23 38 21 L38 11 L44 18 L48 12 L50 20 ${neckBack(50, 20)}`, pal.skin) +
      part('M25 50 L22 58 L29 55 C31 52 30 49 28 48 Z', '#e8b03a', null) +
      part('M23 36 C26 30 33 28 38 32 C40 38 36 45 30 46 C25 46 22 42 23 36 Z', pal.accent, null) +
      `<circle cx="31" cy="37" r="3.2" fill="${pal.eye}" stroke="${INK}" stroke-width="1.2"/><circle cx="31" cy="37" r="1.4" fill="${INK}"/>` +
      line('M26 32 L35 33', 1.8) +
      part('M50 19 C60 20 71 30 72 42 C74 56 70 68 70 77 L64 77 L66 70 L61 65 L65 58 L60 52 L64 45 L58 38 L61 31 L54 27 Z', pal.dark, null) +
      harness(pal);
  },

  bird(pal) {
    return body(`${neckFront} C40 54 32 54 28 50 L14 52 C16 46 22 42 28 42 C26 34 30 26 36 22 C42 18 50 18 54 20 ${neckBack(54, 20)}`, pal.skin) +
      // hooked beak
      part('M29 42 C22 41 14 44 12 50 C12 54 15 55 16 52 L28 50 Z', '#e8b03a', '#c38f22', { shadeX: 24 }) +
      // feather crest and neck feathers in the dark color
      part('M44 19 L50 8 L52 18 L60 10 L58 21 L66 18 L62 27 C58 22 52 20 44 21 Z', pal.dark, null) +
      part('M62 27 C68 32 72 38 72 44 C74 56 70 68 70 77 L64 77 L66 71 L61 66 L65 60 L60 55 L64 49 L59 44 L63 38 L58 33 Z', pal.dark, null) +
      harness(pal) + eyeAt(35, 31, pal.eye);
  },

  shark(pal) {
    return body(`${neckFront} C38 56 28 57 20 54 C14 52 12 46 14 40 C20 32 28 26 38 23 L50 8 L52 22 ${neckBack(52, 22)}`, pal.skin) +
      part('M14 40 C18 44 26 46 36 44 C32 50 26 55 20 54 C14 52 12 46 14 40 Z', tint(pal.skin, 0.55), null) +
      // teeth
      part('M16 44 L18 47 L20 44.5 L22 47.5 L24 45 L26 48 L28 45 L30 47 L32 44.5 Z', '#f6efdf', null) +
      line('M48 40 q2 5 0 10 M53 40 q2 5 0 10 M58 40 q2 5 0 10', 1.8) +
      part('M52 21 C62 22 71 30 72 42 C74 56 70 68 70 77 L65 77 C66 62 66 46 60 34 Z', pal.dark, null) +
      harness(pal) + `<circle cx="33" cy="34" r="2.2" fill="${INK}"/><circle cx="32.3" cy="33.3" r="0.7" fill="#fff"/>`;
  },

  cheetah(pal) {
    return body(`${neckFront} C38 53 29 53 22 50 C17 48 16 42 19 39 C25 34 31 28 36 25 C35 20 37 15 41 15 C44 16 45 19 45 22 L51 22 ${neckBack(51, 22)}`, pal.skin) +
      part('M22 50 C17 48 16 42 19 39 C22 43 26 45 30 46 C28 49 25 50 22 50 Z', tint(pal.skin, 0.5), null) +
      [[48, 30], [55, 36], [62, 44], [52, 48], [60, 56], [48, 62], [64, 66], [42, 42]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.9" fill="${pal.accent}"/>`).join('') +
      // the tear mark
      line('M34 34 Q31 40 25 43', 1.8) +
      harness(pal) + eyeAt(36, 31) + dot(18, 42, 1.5, 1.3);
  },
};
