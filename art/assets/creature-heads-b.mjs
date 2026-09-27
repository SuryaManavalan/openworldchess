// Creature heads and knight mounts, part B (see creatures.mjs for the contract).
// Heads are drawn in a local frame (head radius 10, centered on 0,0) and scaled
// to ctx.r, with outlines compensated so every size keeps the house line weight.
// Mounts are knight-style profiles facing left in the 100x100 frame, no base.
import { INK, SW, MAT, part, line, circ, ell, uid } from '../lib/style.mjs';

/** Darken a #rrggbb color by factor k (0..1). */
function darken(hex, k = 0.8) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

// ---------- local drawing kit for heads ----------

function kit(ctx) {
  const s = ctx.r / 10, w = SW / s;
  /** Filled part with an optional right-side shade band and an outline. */
  const P = (d, fill, shade = null, { sx = 3, o = 1 } = {}) => {
    let out = `<path d="${d}" fill="${fill}"/>`;
    if (shade) {
      const id = uid('hb');
      out += `<clipPath id="${id}"><path d="${d}"/></clipPath>` +
        `<path d="M${sx} -40 Q${sx - 2} 0 ${sx} 40 L60 40 L60 -40 Z" fill="${shade}" clip-path="url(#${id})"/>`;
    }
    if (o) out += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w * o}" stroke-linejoin="round" stroke-linecap="round"/>`;
    return out;
  };
  /** A fill with no outline. */
  const F = (d, fill, op = 1) => `<path d="${d}" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''}/>`;
  const L = (d, k = 0.7, color = INK) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w * k}" stroke-linecap="round" stroke-linejoin="round"/>`;
  /** An outlined tube along a path (horns, arms). */
  const T = (d, width, color) =>
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width + w * 2}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  /** Stoic eye: oval under a straight brow dipping toward the nose. */
  const E = (x, y, color, r = 1.6, inner = x < 0 ? 1 : -1) => {
    const by = y - r * 1.7, dip = r * 0.35;
    const bl = inner < 0 ? by + dip : by, br = inner < 0 ? by : by + dip;
    return `<ellipse cx="${x}" cy="${y}" rx="${r * 0.7}" ry="${r * 0.95}" fill="${color}"/>` +
      `<path d="M${x - r * 1.5} ${bl} L${x + r * 1.5} ${br}" stroke="${color}" stroke-width="${r * 0.7}" stroke-linecap="round"/>`;
  };
  /** A glowing eye: halo, iris and a dark slit. */
  const G = (x, y, color, r = 1.4, slit = true) =>
    `<circle cx="${x}" cy="${y}" r="${r * 1.9}" fill="${color}" opacity=".35"/>` +
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>` +
    (slit ? `<path d="M${x} ${y - r * 0.8} V${y + r * 0.8}" stroke="${INK}" stroke-width="${r * 0.45}" stroke-linecap="round"/>` : '');
  /** Mirror markup across the vertical center line. */
  const M = (inner) => `<g transform="scale(-1 1)">${inner}</g>`;
  const both = (inner) => inner + M(inner);
  const wrap = (inner) => `<g transform="translate(${ctx.cx} ${ctx.cy}) scale(${s})">${inner}</g>`;
  return { P, F, L, T, E, G, M, both, wrap, w, pal: ctx.pal, role: ctx.role };
}

const head = (fn) => (ctx) => { const k = kit(ctx); return k.wrap(fn(k, ctx.pal, ctx.role)); };
const big = (role) => role === 'R' || role === 'K';

// ---------- heads ----------

const ape = head(({ P, F, L, E, both }, pal, role) =>
  both(P(circ(-10.5, -1, 3.4), pal.accent, null, { o: 0.8 })) +
  P('M-10 1 C-11 -9 -5 -14 0 -14 C5 -14 11 -9 10 1 C10 9 5 12 0 12 C-5 12 -10 9 -10 1 Z', pal.skin, pal.dark) +
  (big(role) ? P('M-3 -13 C-2 -17 2 -17 3 -13 Z', pal.skin, null, { o: 0.8 }) : '') +
  P('M-8.5 -5 C-5 -8 -1 -6 0 -6 C1 -6 5 -8 8.5 -5 C9.5 1 8 11 0 11 C-8 11 -9.5 1 -8.5 -5 Z', pal.accent, darken(pal.accent, 0.85), { sx: 4, o: 0.8 }) +
  L('M-7.5 -3.5 Q-3.5 -6.5 0 -4.2 Q3.5 -6.5 7.5 -3.5', 1.1) +
  E(-3.2, -0.8, INK, 1.5) + E(3.2, -0.8, INK, 1.5) +
  F(ell(-1.7, 3.6, 1, 0.75), INK) + F(ell(1.7, 3.6, 1, 0.75), INK) +
  L('M-3.8 7 Q0 8.3 3.8 7', 0.6));

const snake = head(({ P, F, L, G, both }, pal) =>
  P('M0 -9 C9 -10 14 -2 13 7 C12 13 6 15 0 15 C-6 15 -12 13 -13 7 C-14 -2 -9 -10 0 -9 Z', pal.skin, pal.dark, { sx: 5 }) +
  both(F(ell(-7.5, 6, 2, 2.8), pal.accent) + F(ell(-7.5, 6, 0.9, 1.3), INK)) +
  F('M-3 6 L0 14 L3 6 Z', pal.accent) +
  P('M0 -13 C5 -13 7 -8 6.5 -3 C6 2 3 5 0 5 C-3 5 -6 2 -6.5 -3 C-7 -8 -5 -13 0 -13 Z', pal.skin, pal.dark, { sx: 2 }) +
  L('M-3 -10 Q0 -8.3 3 -10 M-2.5 -7.5 Q0 -6.2 2.5 -7.5', 0.45, pal.dark) +
  G(-3.1, -4.5, pal.eye, 1.3) + G(3.1, -4.5, pal.eye, 1.3) +
  F(circ(-1.2, 1.6, 0.6), INK) + F(circ(1.2, 1.6, 0.6), INK) +
  L('M0 5 V8.6 L-1.5 10.6 M0 8.6 L1.5 10.6', 0.55, '#c8323a'));

const scorpion = head(({ P, F, L, T, G, both }, pal, role) => {
  const claw = T('M-6 6 C-12 6 -14 1 -13 -4', 3.8, pal.skin) +
    P('M-13 -2 C-19 -4 -20 -12 -16 -17.5 L-13.5 -11 L-10 -17.5 C-7 -12 -8 -5 -13 -2 Z', pal.skin, pal.dark, { sx: -12, o: 0.85 });
  // the tail arcs up behind the head, stinger poised over it
  const tail = T('M8 7 C18 4 19 -11 13 -18 C9 -22 2 -23 -2 -20.5', 3.8, pal.skin) +
    L('M16.5 -3 l2.6 0.4 M16.5 -12 l2.4 -1.2 M10 -20.5 l0.6 -2.5', 0.5) +
    P('M-1.5 -22.5 C-7 -23.5 -9.5 -19 -8.5 -13.5 C-7 -16.5 -4.5 -17.5 -1.5 -17.5 Z', pal.dark, null, { o: 0.8 });
  return tail + both(claw) +
    P('M-9.5 -4 C-9.5 -10 9.5 -10 9.5 -4 L10 3 C10 8 5 10 0 10 C-5 10 -10 8 -10 3 Z', pal.skin, pal.dark, { sx: 4 }) +
    P('M-6 -9 C-4 -11.5 4 -11.5 6 -9 L5 -5 L-5 -5 Z', pal.dark, null, { o: 0.6 }) +
    L('M-9.7 1 Q0 4 9.7 1 M-9 5.8 Q0 8.6 9 5.8', 0.5, pal.dark) +
    G(-2.2, -7.2, pal.eye, 1.25, false) + G(2.2, -7.2, pal.eye, 1.25, false) +
    F(circ(-6.3, -3, 0.9), pal.eye) + F(circ(6.3, -3, 0.9), pal.eye) +
    L('M-3 9.5 L-2 13 M3 9.5 L2 13', 0.65) +
    (big(role) ? L('M0 -3 V1', 0.5, pal.dark) : '');
});

const mummy = head(({ P, F, L, G }, pal) =>
  P('M9 5 C12 6 14 9 13 13.5 L11 12.5 C11 9 10 8 8.5 7.5 Z', pal.skin, null, { o: 0.8 }) +
  P('M0 -12 C7 -12 10 -7 10 -1 C10 7 6 12 0 12 C-6 12 -10 7 -10 -1 C-10 -7 -7 -12 0 -12 Z', pal.skin, pal.dark, { sx: 4 }) +
  L('M-9.5 -6.5 L9 -9 M-10 5 L10 2 M-8 9.5 L7 7.5 M-6 -10.5 L6 -11.5 M-9.8 0 L-6 -1', 0.45, pal.dark) +
  P('M-9.9 -4 L9.9 -5.2 L10 0.6 L-10 1.8 Z', '#3a332c', null, { o: 0.6 }) +
  G(-3.6, -1.2, pal.eye, 1.3, false) + G(3.6, -1.7, pal.eye, 1.3, false) +
  F(circ(0, 9.6, 1.1), pal.accent));

const frost = head(({ P, F, L, G, both }, pal, role) =>
  both(P('M-5.5 -9.5 C-10 -12 -13 -15 -12.5 -20 C-9 -17.5 -5.5 -15.5 -2.5 -12 Z', pal.accent, '#cfe6f3', { sx: -8, o: 0.8 })) +
  P('M0 -12 C7 -12 11 -7 11 0 C11 6 8 10 0 10 C-8 10 -11 6 -11 0 C-11 -7 -7 -12 0 -12 Z', pal.skin, pal.dark, { sx: 5 }) +
  L('M-8 -9 l1.5 1.5 M7 -9.5 l-1.2 1.6 M-10 -3 l1.6 0.6', 0.45, pal.dark) +
  P('M-6.5 -4 C-3 -6.3 3 -6.3 6.5 -4 C7 1 5 5 0 5 C-5 5 -7 1 -6.5 -4 Z', pal.dark, null, { o: 0.7 }) +
  L('M-6.3 -4.6 L-1.4 -2.9 M6.3 -4.6 L1.4 -2.9', 0.9) +
  G(-3.1, -1.4, pal.eye, 1.15, false) + G(3.1, -1.4, pal.eye, 1.15, false) +
  F('M-1.2 0.5 L1.2 0.5 L0 2.4 Z', INK) +
  P(role === 'R'
    ? 'M-9 2.5 L-7.5 13 L-5 6.5 L-2.5 15 L0 7.5 L2.5 15 L5 6.5 L7.5 13 L9 2.5 C4 6 -4 6 -9 2.5 Z'
    : 'M-8 3 L-6 12 L-4 6 L-2 14 L0 7 L2 14 L4 6 L6 12 L8 3 C4 6 -4 6 -8 3 Z', pal.accent, '#cfe6f3', { sx: 3, o: 0.8 }));

const mammoth = head(({ P, F, L, both }, pal, role) => {
  const t = big(role) ? 1.25 : 1;
  return both(P(ell(-10, 0, 3.5, 5), pal.dark, null, { o: 0.8 })) +
    P('M-9 4 C-11 -6 -6 -13 0 -13 C6 -13 11 -6 9 4 C8 8 4 9 0 9 C-4 9 -8 8 -9 4 Z', pal.skin, pal.dark, { sx: 4 }) +
    P('M-4.5 -11.5 C-4 -16 -1 -17 0.5 -14 C2 -17.5 5.5 -16 4.5 -11.5 C2 -12.5 -2 -12.5 -4.5 -11.5 Z', pal.dark, null, { o: 0.7 }) +
    both(P(`M-3 5.5 C-8 ${9.5} -${11 * t} ${10 * t} -${13.5 * t} ${3 - 2 * t} C-${11 * t} ${8.5 * t} -7 8.5 -3.5 2.5 Z`, pal.accent, null, { o: 0.75 })) +
    F(circ(-4.3, -2, 1), INK) + F(circ(4.3, -2, 1), INK) +
    L('M-6 -4.5 L-2.8 -3.5 M6 -4.5 L2.8 -3.5', 0.6) +
    P('M-3 2 C-3 8 -3.5 12 -1.5 15.5 C0 17.5 3.2 16.5 3 14.2 C1.5 13.8 1.4 11 2 8 L3 2 Z', pal.skin, pal.dark, { sx: 1, o: 0.85 }) +
    L('M-2.6 8 h4.4 M-2.3 11 h3.8', 0.4, pal.dark);
});

const centaur = head(({ P, F, L, E, both }, pal) => {
  const face = '#e0b894';
  return P('M-9 -1 C-11 -12 -4 -15.5 0 -15.5 C4 -15.5 11 -12 9 -1 L8 3 L-8 3 Z', pal.dark, null) +
    both(P(ell(-8, -1, 1.8, 2.6), face, null, { o: 0.7 })) +
    P('M-7.5 -5 C-7.5 -11 7.5 -11 7.5 -5 L7.5 2 C7.5 8 4 11 0 11 C-4 11 -7.5 8 -7.5 2 Z', face, darken(face, 0.85), { sx: 3.5 }) +
    P('M-7.5 1 C-7 7 -4 13.5 0 14.5 C4 13.5 7 7 7.5 1 C5 4 3 4.8 0 4.2 C-3 4.8 -5 4 -7.5 1 Z', pal.dark, null, { o: 0.8 }) +
    L('M-3.2 5.2 Q0 3.8 3.2 5.2', 0.8, face) +
    P('M-8 -7.5 L8 -7.5 L8 -4.8 L-8 -4.8 Z', pal.accent, null, { o: 0.7 }) +
    F(circ(0, -6.2, 0.9), MAT.gold) +
    E(-3.3, -1.8, INK, 1.4) + E(3.3, -1.8, INK, 1.4) +
    L('M0 -1 L-1 2 H0.6', 0.5);
});

const skull = head(({ P, F, L, G, both }, pal) =>
  P('M0 -12 C7 -12 10 -7 10 -1 C10 3 8 5 7 6 L7 9 L-7 9 L-7 6 C-8 5 -10 3 -10 -1 C-10 -7 -7 -12 0 -12 Z', pal.skin, pal.dark, { sx: 4 }) +
  P('M-6 9 L6 9 L5.5 13 C3 14.2 -3 14.2 -5.5 13 Z', pal.skin, pal.dark, { sx: 3, o: 0.8 }) +
  both(F(ell(-4, 0, 2.9, 3.1), INK)) +
  G(-4, 0.2, pal.eye, 1, false) + G(4, 0.2, pal.eye, 1, false) +
  F('M0 3.3 L-1.4 6.3 H1.4 Z', INK) +
  L('M-4.5 9 V12.2 M-1.5 9 V12.8 M1.5 9 V12.8 M4.5 9 V12.2', 0.4) +
  L('M3 -12 L4 -8 L2.4 -6', 0.45));

const mushroom = head(({ P, F, L, E }, pal) =>
  P('M-6.5 -2 L-7 8 C-7 12.5 7 12.5 7 8 L6.5 -2 Z', pal.skin, pal.dark, { sx: 3 }) +
  P('M-15 -1 C-15 -10 -8 -16.5 0 -16.5 C8 -16.5 15 -10 15 -1 C10 1.2 -10 1.2 -15 -1 Z', pal.accent, darken(pal.accent, 0.82), { sx: 6 }) +
  F(circ(-8, -8, 2.4), pal.skin) + F(circ(1, -12.3, 2), pal.skin) + F(circ(8.5, -6, 2.6), pal.skin) + F(circ(-2.5, -5.2, 1.4), pal.skin) +
  E(-2.6, 3.6, INK, 1.3) + E(2.6, 3.6, INK, 1.3) +
  L('M-1.6 7.8 Q0 8.6 1.6 7.8', 0.45));

const satyr = head(({ P, F, L, T, E, both }, pal) =>
  both(T('M-4 -9.5 C-6 -16.5 -14 -16.5 -14 -10.5 C-14 -5.5 -9 -5.5 -9 -9.2', 2.4, pal.dark)) +
  both(P('M-8 -3 C-12 -4.5 -15.5 -2.5 -16.5 0 C-13 1.2 -10 1 -8 0 Z', '#d4b08a', null, { o: 0.7 })) +
  P('M0 -12 C6 -12 9 -8 8.5 -2 L8 3 C8 9 4 12 0 12 C-4 12 -8 9 -8 3 L-8.5 -2 C-9 -8 -6 -12 0 -12 Z', pal.skin, darken(pal.skin, 0.85), { sx: 3.5 }) +
  P('M-8.5 -4 C-9 -11 -4 -13 0 -12.5 C4 -13 9 -11 8.5 -4 C7 -6 5 -5 4 -7 C3 -5 1 -5 0 -7 C-1 -5 -3 -5 -4 -7 C-5 -5 -7 -6 -8.5 -4 Z', pal.dark, null, { o: 0.75 }) +
  P('M-2.5 8 C-2 12 -1 15 0 16.5 C1 15 2 12 2.5 8 C1 9.5 -1 9.5 -2.5 8 Z', pal.dark, null, { o: 0.7 }) +
  E(-3.1, -0.8, pal.eye, 1.4) + E(3.1, -0.8, pal.eye, 1.4) +
  L('M0 0.5 L-0.9 3.4 H0.6 M-2.2 6.2 Q0 7.2 2.2 6.2', 0.5));

const stone = head(({ P, F, L, G }, pal) =>
  P('M4 -11 L6 -18 L8.8 -10 Z', pal.accent, null, { o: 0.7 }) +
  P('M-7.5 -9.5 L-10.5 -15.5 L-4.8 -11 Z', pal.accent, null, { o: 0.7 }) +
  P('M-10 -4 L-7 -11 L1 -13 L8 -10 L11 -3 L10 6 L5 11 L-4 12 L-10 7 Z', pal.skin, pal.dark, { sx: 4 }) +
  P('M9.5 0 L13.5 -2 L11 4 Z', pal.accent, null, { o: 0.6 }) +
  L('M-7 4 L-3.5 5.5 L-2 4 M2 -9 L3 -6 M-4 -11 L-3 -8.5', 0.45, darken(pal.dark, 0.8)) +
  P('M-8.2 -4 L8.2 -5.2 L7.8 -2.3 L-7.8 -1.4 Z', pal.dark, null, { o: 0.6 }) +
  G(-3.8, 0.6, pal.eye, 1.3, false) + G(3.8, 0.1, pal.eye, 1.3, false) +
  L('M-4 7.5 L-1.2 6.3 L1 7.8 L4 6.4', 0.6));

const fox = head(({ P, F, L, E, both }, pal) =>
  both(P('M-8.5 -4 L-11 -17 L-2 -10 Z', pal.skin, null, { o: 0.9 }) +
    F('M-8.3 -7 L-9.8 -14 L-4.6 -10 Z', pal.accent) +
    F('M-10.3 -14 L-11 -17 L-8.6 -15.4 Z', INK)) +
  P('M-10 -3 C-10 -9 -5 -11 0 -11 C5 -11 10 -9 10 -3 C10 2 6 6 3 9 L0 12 L-3 9 C-6 6 -10 2 -10 -3 Z', pal.skin, pal.dark, { sx: 4 }) +
  P('M-10 -2 C-8 3 -5 5 -2 7 L0 12 L2 7 C5 5 8 3 10 -2 C6 1 3 2 0 1 C-3 2 -6 1 -10 -2 Z', pal.accent, null, { o: 0.6 }) +
  F(circ(0, 10.6, 1.4), INK) +
  E(-3.6, -3, INK, 1.4) + E(3.6, -3, INK, 1.4) +
  both(L('M-6.8 -6.8 Q-4.8 -8 -2.8 -6.6', 0.5, pal.eye)) +
  F('M0 -9.5 L-1.2 -6.5 L0 -5 L1.2 -6.5 Z', pal.eye));

const salamander = head(({ P, F, L, G, both }, pal) =>
  P('M-6 -7 C-8.5 -13 -6 -17 -3 -18.5 C-4 -15 -2 -14 -1 -16.5 C0 -19.5 3 -20.5 4.5 -18 C3 -16 5 -14 6 -16.5 C8.5 -14 8.5 -10 6 -7 Z', pal.accent, null, { o: 0.8 }) +
  F('M-3 -8.5 C-4 -12 -2 -14 0 -15.5 C0 -13 2 -12 3 -13.5 C4.2 -11 3.2 -9 2 -8 Z', pal.eye) +
  P('M-11 -2 C-11 -8 -6 -10 0 -10 C6 -10 11 -8 11 -2 C11 5 6 9 0 9 C-6 9 -11 5 -11 -2 Z', pal.skin, pal.dark, { sx: 4 }) +
  F(circ(-4, 2, 1), pal.dark) + F(circ(5, -3, 1.2), pal.dark) + F(circ(1, -6, 0.8), pal.dark) +
  both(P(circ(-7.6, -5, 2.9), pal.skin, null, { o: 0.8 }) + G(-7.6, -5, pal.accent, 1.35)) +
  F(circ(-2, 3, 0.7), INK) + F(circ(2, 3, 0.7), INK) +
  L('M-7 5 Q0 8.5 7 5', 0.55));

const dragon = head(({ P, F, L, G, both }, pal, role) =>
  both(P(big(role)
    ? 'M-5 -9 C-9 -15 -13 -18 -18 -19.5 C-14.5 -15 -12 -11 -9.5 -5.5 Z'
    : 'M-5 -9 C-8 -14 -12 -17 -16 -18 C-13 -14 -11 -11 -9 -6 Z', pal.accent, null, { o: 0.8 })) +
  both(P('M-8.5 -3 L-15 -6.5 L-13 -1.5 L-16 2 L-10 3.5 Z', pal.dark, null, { o: 0.75 })) +
  P('M-9 -6 C-9 -11 -4 -12 0 -12 C4 -12 9 -11 9 -6 L7 4 C6 10 4 14 0 14 C-4 14 -6 10 -7 4 Z', pal.skin, pal.dark, { sx: 3.5 }) +
  both(P('M-8 -5 L-2 -2.5 L-2.5 -4.8 L-7 -7.3 Z', pal.dark, null, { o: 0.6 })) +
  G(-4.3, -1.8, pal.eye, 1.2) + G(4.3, -1.8, pal.eye, 1.2) +
  L('M0 -10.5 V-4.5 M-3.5 5 Q0 6.6 3.5 5', 0.45, pal.dark) +
  F(ell(-2, 10.8, 0.8, 1.1), INK) + F(ell(2, 10.8, 0.8, 1.1), INK) +
  both(P('M-3.6 13 L-3 16.3 L-2.1 13.6 Z', '#f8f4ec', null, { o: 0.45 })));

const griffon = head(({ P, F, L, E, both }, pal) =>
  P('M-6 -9 L-10.5 -17.5 L-4 -12.5 L-2 -19.5 L1 -12.5 L4.5 -18.5 L5.5 -11.5 L10.5 -15.5 L7.5 -7 Z', pal.skin, pal.dark, { sx: 2, o: 0.8 }) +
  P('M0 -12 C7 -12 10 -7 10 -1 C10 5 7 9 3 10 L-3 10 C-7 9 -10 5 -10 -1 C-10 -7 -7 -12 0 -12 Z', pal.accent, darken(pal.accent, 0.86), { sx: 4 }) +
  L('M-8.5 6.5 L-6.5 9.8 M8.5 6.5 L6.5 9.8 M-9.6 2 L-8 4.5 M9.6 2 L8 4.5', 0.45, pal.dark) +
  both(P('M-9.2 -5 L-1.5 -2.4 L-2 -4.6 L-8.2 -7.6 Z', pal.skin, null, { o: 0.6 })) +
  both(`<circle cx="-4.6" cy="-1.3" r="1.7" fill="${pal.eye}"/><circle cx="-4.4" cy="-1.3" r="0.8" fill="${INK}"/>`) +
  P('M-4 0.5 C-4 -2 4 -2 4 0.5 L2.5 7 C1.5 10 0.5 12.5 0 13.5 C-0.5 12.5 -1.5 10 -2.5 7 Z', MAT.gold, MAT.goldShade, { sx: 1 }) +
  L('M-2 2 Q0 1 2 2', 0.4));

const hag = head(({ P, F, L, E }, pal) => {
  const hair = pal.accent;
  return P('M-9 -6 C-13 -10 -12 -15 -7 -15 C-5 -18 5 -18 7 -15 C12 -15 13 -10 9 -6 L13.5 2 L9 1 L12.5 8.5 L8 5 L-8 5 L-12.5 8.5 L-9 1 L-13.5 2 Z', hair, darken(hair, 0.8), { sx: 5 }) +
    P('M0 -12 C6 -12 8.5 -7 8 -1 C7.5 6 4 11 0 11 C-4 11 -7.5 6 -8 -1 C-8.5 -7 -6 -12 0 -12 Z', pal.skin, darken(pal.skin, 0.84), { sx: 3.5 }) +
    P('M-8 -5 C-7 -11 -3 -13 0 -12 C3 -13 7 -11 8 -5 C6 -8 4 -7 2 -9 C0 -7 -3 -8 -5 -7 C-6 -7 -7 -6 -8 -5 Z', hair, null, { o: 0.7 }) +
    E(-3.4, -2.5, pal.eye, 1.4) + E(3.6, -2.2, pal.eye, 1.1) +
    P('M-0.5 -3 C1 1 4 5 2.2 7.8 C1 8.3 0 7.2 -0.8 6 Z', pal.skin, darken(pal.skin, 0.84), { sx: 1.2, o: 0.7 }) +
    F(circ(2.6, 5.6, 0.9), pal.dark) + F(circ(-5, 3, 0.8), pal.dark) +
    L('M-3.8 8.6 Q-1 7.6 3.5 9.2', 0.55) +
    P('M-1.2 8.2 L-0.7 10.2 L0 8 Z', '#f4ead8', null, { o: 0.4 });
});

export const HEADS = { ape, snake, scorpion, mummy, frost, mammoth, centaur, skull, mushroom, satyr, stone, fox, salamander, dragon, griffon, hag };

// ---------- mounts (profile, facing left) ----------

const harness = (color) => part('M32 67 C45 64 60 64 70 66 V72 C60 70 45 70 31.5 73 Z', color, null);
const glowEye = (x, y, color, r = 2.4) =>
  `<circle cx="${x}" cy="${y}" r="${r * 1.8}" fill="${color}" opacity=".35"/><circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>` +
  `<path d="M${x} ${y - r * 0.8} V${y + r * 0.8}" stroke="${INK}" stroke-width="${r * 0.45}" stroke-linecap="round"/>`;
const dotEye = (x, y, r = 2.2) => `<ellipse cx="${x}" cy="${y}" rx="${r * 0.75}" ry="${r}" fill="${INK}"/>` + line(`M${x - r * 1.5} ${y - r * 1.8} L${x + r * 1.5} ${y - r * 1.5}`, r * 0.7);

function ape_(pal) {
  return part('M30 77 C28 68 30 60 34 56 C28 56 22 54 20 49 C18 44 20 40 24 38 C22 30 28 20 38 14 C44 11 50 13 54 18 C64 24 72 38 72 50 C73 60 71 70 72 77 Z', pal.skin, pal.dark, { shadeX: 58 }) +
    part(circ(46, 40, 4), pal.accent, null) +
    part('M23 36 C28 31 36 32 39 37 C41 44 39 52 35 56 C28 56 21 54 19 49 C17 44 18 39 23 36 Z', pal.accent, null) +
    part('M19 37 C25 30 34 30 40 35 L38 38.5 C32 35 26 35 21 39.5 Z', pal.skin, null) +
    part('M36 58 C30 62 26 68 24 77 H35 C36 71 39 66 43 63 Z', pal.skin, null) + line('M26 77 v-3 M30 77 v-3', 1.6) +
    dotEye(29, 40.5, 2) +
    `<ellipse cx="21.3" cy="45.5" rx="1.3" ry="1" fill="${INK}"/>` + line('M22 51 L30 52', 2) +
    line('M58 30 l5 3 M62 44 l6 2 M60 58 l6 1', 2, pal.dark) + harness(pal.accent);
}

function snake_(pal) {
  const c = 'M60 79 C32 77 26 62 44 55 C62 48 64 36 50 30';
  return `<path d="${c}" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round"/>` +
    `<path d="${c}" fill="none" stroke="${pal.skin}" stroke-width="13.6" stroke-linecap="round"/>` +
    `<path d="${c}" fill="none" stroke="${pal.dark}" stroke-width="5" stroke-dasharray="3 6" />` +
    part('M50 13 C63 13 67 24 63 34 C59 40 52 38 48 34 Z', pal.skin, pal.dark, { shadeX: 58 }) +
    part('M53 31 C46 35 36 35 26 33 C17 31.5 15 25 20 20.5 C26 16.5 40 16 52 20 C59 22 59 29 53 31 Z', pal.skin, pal.dark, { shadeX: 48 }) +
    glowEye(31, 23.5, pal.eye, 2.2) +
    `<circle cx="19.5" cy="24" r="1" fill="${INK}"/>` +
    line('M17 29 L10 30 L7 27.5 M10 30 L7.5 33', 1.6, '#c8323a') +
    line('M40 28 Q46 30 52 27', 1.6, pal.dark);
}

function scorpion_(pal) {
  const tail = 'M62 64 C75 56 77 40 71 28 C65 18 53 16 47 22';
  return `<path d="${tail}" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>` +
    `<path d="${tail}" fill="none" stroke="${pal.skin}" stroke-width="6.6" stroke-linecap="round"/>` +
    line('M69 52 l6 2 M73 40 l6 -1 M69 27 l5 -4 M58 19 l1 -6', 2.2) +
    part('M49 20 C43 16 37 20 36 28 C39 25 43 25 47 27 Z', pal.dark, null) +
    line('M26 64 C20 62 17 58 18 53', 7, INK) + line('M26 64 C20 62 17 58 18 53', 3.6, pal.skin) +
    part('M18.5 55 C12 53 10 44 14 38 L17 44 L20.5 38 C24.5 42 24 51 18.5 55 Z', pal.skin, pal.dark, { shadeX: 20 }) +
    line('M30 72 L22 78 M40 73 L35 79 M58 73 L64 79', 2.4) +
    part('M22 77 C20 66 30 58 46 58 C60 58 70 64 70 77 Z', pal.skin, pal.dark, { shadeX: 55 }) +
    line('M40 59 Q38 68 40 77 M53 59 Q52 68 54 77', 2, pal.dark) +
    `<circle cx="27" cy="63" r="1.7" fill="${pal.eye}"/><circle cx="31.5" cy="61.5" r="1.7" fill="${pal.eye}"/>` +
    part('M43 58 C48 56 54 56 58 58 L58 63 L43 63 Z', pal.accent, null);
}

const DOG = 'M30 77 C30 66 36 60 41 55 C34 55 25 53 19 50 C15 48 15 44 18 42 L32 36 C33 28 34 20 35 11 L43 22 C45 17 48 12 51 9 L52 24 C63 29 70 38 70 50 C70 60 69 70 70 77 Z';

function jackal_(pal) {
  const body = '#3a332c', shade = '#2b2622';
  return part(DOG, body, shade, { shadeX: 56 }) +
    line('M38 17 L41 22 M49 14 L50 22', 1.6, MAT.gold) +
    glowEye(35.5, 38.5, pal.eye, 1.8) +
    `<ellipse cx="16.5" cy="45" rx="1.6" ry="1.3" fill="#1a1612"/>` + line('M20 50 L31 49', 1.8, '#1a1612') +
    part('M32 64 C45 61 60 61 70 63 V70 C60 68 45 68 31 71 Z', pal.accent, null) +
    line('M36 66.5 H66', 2, MAT.gold);
}

function fox_(pal) {
  const d = 'M30 77 C30 66 37 60 42 55 C35 55 25 53 18 50 C14 48 15 44 18 42 L33 36 C33 28 35 20 37 11 L45 23 C47 18 50 14 54 10 L54 26 C64 31 70 40 70 52 C70 62 69 70 70 77 Z';
  return part(d, pal.skin, pal.dark, { shadeX: 58 }) +
    part('M42 55 C36 61 31 67 30 77 H44 C44 68 46 62 51 57 Z', pal.accent, null) +
    part('M18 50 C25 53 33 54 40 55 L38 51 C31 51 24 49 19 46 Z', pal.accent, null) +
    `<path d="M37 11 L38.5 17 L41 16 Z M54 10 L53.5 17 L51 15.5 Z" fill="${INK}"/>` +
    dotEye(36, 39, 2) + line('M32 34 Q35 32 39 34', 1.6, pal.eye) +
    `<ellipse cx="16.5" cy="45" rx="1.7" ry="1.4" fill="${INK}"/>`;
}

function hellhound_(pal) {
  const d = 'M30 77 C30 66 37 60 42 55 C35 56 26 55 19 51 C15 49 15 44 19 42 L33 35 C34 29 36 23 38 17 L45 26 C58 26 68 36 69 50 C70 60 69 70 70 77 Z';
  return part('M45 24 C51 16 56 22 58 18 C63 22 60 28 67 27 C66 33 71 35 76 37 C71 42 73 46 78 50 C73 54 75 60 80 64 C74 66 73 72 73 77 L66 77 C67 66 68 56 66 46 C63 35 56 29 45 26 Z', pal.skin, null) +
    `<path d="M50 24 C54 22 57 25 60 25 C62 30 66 33 70 37 C67 42 69 47 72 51 C68 55 70 61 73 65 C70 68 69 72 69 77 L67 77 C67 66 67 56 65 46 C62 36 57 30 50 27 Z" fill="${pal.accent}"/>` +
    part(d, '#3a2e2a', '#2b2320', { shadeX: 56 }) +
    glowEye(35, 38.5, pal.accent, 2) +
    part('M21 50.5 L23 55 L25 51 Z M27 51.5 L28.5 55.5 L30.5 52 Z', '#f4ead8', null) +
    `<ellipse cx="17" cy="45" rx="1.6" ry="1.3" fill="#1a1612"/>`;
}

function muskox_(pal) {
  return part('M30 77 C29 68 32 60 36 56 C30 56 23 54 20 50 C17 46 18 40 22 36 C26 30 32 26 40 24 C52 22 64 28 68 38 C72 48 70 62 72 77 Z', pal.skin, pal.dark, { shadeX: 58 }) +
    part('M42 25 C53 23 64 29 68 38 C72 48 71 62 72 77 L56 77 C58 66 56 58 51 52 C47 46 43 38 42 25 Z', pal.dark, null) +
    line('M52 58 l2 8 M60 50 l2 9 M64 64 l1 8', 1.8, darken(pal.dark, 0.7)) +
    dotEye(29, 36, 2) +
    part('M35 26 C41 20 53 20 57 24 C53 28 48 28 45 31 C41 35 40 42 43 47 C44 50 40 52 37 49 C33 44 32 33 35 26 Z', '#d9cdb5', '#b5a88e', { shadeX: 44 }) +
    `<ellipse cx="20.5" cy="44.5" rx="1.5" ry="1.2" fill="${INK}"/>` + line('M21 50 L28 51', 1.8);
}

const KNIGHT = 'M30 77 C30 64 40 58 44 52 C38 54 30 57 24 53 C19 50 18 44 22 41 C28 34 34 26 40 21 L41 12 L47 19 C58 18 71 26 72 42 C74 56 70 68 70 77 Z';

function bone_(pal) {
  const b = '#e8e2cf', s = '#a9a28c';
  return part('M47 19 L56 14 L57 21 L66 18 L65 27 L74 28 L69 35 L77 40 L70 45 L76 53 L69 57 L74 65 L68 69 L70 77 L63 77 C63 66 67 55 64 42 C62 31 56 25 46 23 Z', pal.accent, null) +
    part(KNIGHT, b, s, { shadeX: 58 }) +
    `<ellipse cx="37" cy="32" rx="4.6" ry="5" fill="${INK}"/>` + glowEye(37, 32.5, pal.eye, 1.6) +
    `<ellipse cx="24" cy="45" rx="2" ry="2.6" fill="${INK}"/>` +
    line('M24 53 C30 55.5 37 55 43 52', 2.2) + line('M28 52.5 v3 M32 53 v3 M36 53 v3 M40 52.5 v2.5', 1.4) +
    line('M40 62 h8 M38 68 h10 M37 74 h11', 2.2, s);
}

function toad_(pal) {
  const skin = '#8a9a5a', shade = '#6a7a42';
  return part('M22 77 C16 70 16 58 24 50 C28 44 34 40 42 40 C44 34 50 32 54 36 C62 38 70 48 72 60 C73 68 72 74 70 77 Z', skin, shade, { shadeX: 58 }) +
    part(circ(48, 37, 7), skin, null) + dotEye(47, 37, 2.4) +
    line('M19 60 C28 64 38 63 45 58', 2.4) +
    `<circle cx="58" cy="52" r="3" fill="${shade}"/><circle cx="64" cy="64" r="2.4" fill="${shade}"/><circle cx="36" cy="50" r="2" fill="${shade}"/>` +
    part('M50 44 C56 42 64 46 67 52 L60 58 C57 52 54 49 49 49 Z', pal.accent, null) +
    part('M27 77 C25 71 28 66 33 67 L38 77 Z', skin, null) + line('M29 77 v-2 M33 77 v-2', 1.4);
}

function unicorn_(pal) {
  const mane = 'M47 19 C58 18 71 26 72 42 C74 56 70 68 70 77 L63 77 C63 66 67 55 64 42 C62 31 56 25 46 23 Z';
  return part(KNIGHT, '#f8f4ec', '#d9d0c2', { shadeX: 58 }) +
    part(mane, pal.accent, null) +
    line('M60 30 L66 28 M64 42 L70 41 M64 55 L70 56', 2.4) +
    part('M38 22.5 L27 2 L44 18.5 Z', MAT.gold, MAT.goldShade, { shadeX: 36 }) +
    line('M33 12 L38 12 M30.5 7 L35 7.5 M36 17 L41 16.5', 1.4) +
    eye(38, 32, pal.eye) + `<ellipse cx="24.5" cy="46" rx="1.4" ry="1.8" fill="${INK}"/>`;
}

const eye = (x, y, color, r = 2.4) => `<ellipse cx="${x}" cy="${y}" rx="${r * 0.7}" ry="${r * 0.95}" fill="${color}"/>` +
  `<ellipse cx="${x - 0.2}" cy="${y}" rx="${r * 0.32}" ry="${r * 0.55}" fill="${INK}"/>` +
  line(`M${x - r * 1.5} ${y - r * 1.4} L${x + r * 1.5} ${y - r * 1.8}`, r * 0.7);

function stone_(pal) {
  return part('M58 19 L62 7 L66.5 20 Z', pal.accent, null) +
    part('M68 31 L77 24 L73.5 37 Z', pal.accent, null) +
    part('M30 77 L32 62 L42 54 L28 54 L18 48 L20 38 L30 30 L38 16 L52 14 L64 22 L72 38 L72 56 L70 77 Z', pal.skin, pal.dark, { shadeX: 56 }) +
    line('M44 26 L48 34 L45 40 M56 46 L62 52 M38 66 L46 64 L50 70', 2, darken(pal.dark, 0.8)) +
    part('M24 35 L38 30 L37 36 L25 40 Z', pal.dark, null) +
    glowEye(32, 38, pal.eye, 2) +
    line('M20 48 L28 50 L34 48', 2.2);
}

function wyvern_(pal) {
  return part('M60 42 L80 8 L83 24 L91 20 L86 44 L70 58 Z', pal.dark, null) +
    line('M80 8 L72 48 M91 20 L74 50', 1.6, darken(pal.dark, 0.7)) +
    part('M34 77 C34 66 40 58 46 52 C40 50 34 47 30 47 L16 47 C11.5 47 11.5 40 16 39 L30 36 C34 30 40 26 46 26 L57 15 L54 28 C64 34 70 46 70 60 C70 68 70 72 70 77 Z', pal.skin, pal.dark, { shadeX: 56 }) +
    part('M46 27 L62 9 L53 29 Z', pal.accent, null) +
    part('M16 47 L17.5 50.5 L19 47 Z M22 47 L23.5 50.5 L25 47 Z', '#f8f4ec', null) +
    part('M47 55 C54 53 62 53 68 55 L69 62 C62 60 55 60 47 62 Z', pal.accent, null) +
    glowEye(33.5, 38.5, pal.eye, 1.9) +
    `<ellipse cx="15.5" cy="42.5" rx="1.3" ry="1" fill="${INK}"/>` +
    line('M50 38 l4 -2 M58 46 l5 -2', 1.6, pal.dark);
}

function hippogriff_(pal) {
  const neck = 'M30 77 C30 66 36 58 42 52 C50 55 60 55 70 51 C70 60 69 70 70 77 Z';
  return part('M52 16 L63 8 L60 18 L71 14 L66 24 L75 25 L68 32 Z', pal.skin, null) +
    part('M30 77 C30 66 36 58 42 52 C36 50 30 46 29 42 C28 36 30 30 34 24 C40 16 52 14 60 18 C68 24 72 34 70 46 C70 58 69 70 70 77 Z', pal.accent, darken(pal.accent, 0.86), { shadeX: 58 }) +
    part('M30 77 C30 66 36 58 42 52 L46 56 L50 52 L54 56 L58 52 L62 55 L66 50 L70 51 C70 60 69 70 70 77 Z', pal.skin, pal.dark, { shadeX: 58 }) +
    part('M32 30 C24 29 16 32 14 40 C13 46 15 50 17 52 C17 47 20 44 24 44 L33 43 Z', MAT.gold, MAT.goldShade, { shadeX: 28 }) +
    `<circle cx="38" cy="31" r="2.6" fill="${pal.eye}"/><circle cx="37.6" cy="31" r="1.2" fill="${INK}"/>` +
    line('M33 26.5 L43 27.5', 2.2) + line('M24 36 Q27 35 29 37', 1.4);
}

function raven_(pal) {
  const b = '#3a3540', s = '#2a2630';
  return part('M30 77 C30 66 36 58 42 52 C36 50 31 46 30 42 C29 36 31 30 35 24 C41 17 52 15 60 19 C68 24 72 34 70 46 C70 58 69 70 70 77 Z', b, s, { shadeX: 58 }) +
    part('M57 18 L64 12 L63 20 L71 18 L67 26 Z', b, null) +
    part('M33 27 C24 27 13 33 10 40 C18 40.5 26 41 34 42 Z', '#55505c', '#44404a', { shadeX: 24 }) +
    line('M12 40 L30 36', 1.4, '#2a2630') +
    `<circle cx="39" cy="30" r="2.4" fill="${pal.eye}"/><circle cx="38.7" cy="30" r="1.1" fill="${INK}"/>` +
    line('M36 48 l3 4 M42 50 l2 5 M48 51 l1 5', 1.8, '#5a5462') +
    harness(pal.accent);
}

export const MOUNTS = {
  ape: ape_, snake: snake_, scorpion: scorpion_, jackal: jackal_, muskox: muskox_, bone: bone_, toad: toad_,
  unicorn: unicorn_, stone: stone_, fox: fox_, hellhound: hellhound_, wyvern: wyvern_, hippogriff: hippogriff_, raven: raven_,
};
