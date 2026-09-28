// Ratings (docs/specs/elo.md §1). Glicko-1, the way chess.com rates games, plus
// Glicko-2 (older saves and tests). One game at a time.

export interface Rating { rating: number; rd: number; vol: number }

const SCALE = 173.7178;
const TAU = 0.5;

export function glicko2(me: Rating, opp: Rating, score: 0 | 0.5 | 1): Rating {
  const mu = (me.rating - 1500) / SCALE, phi = me.rd / SCALE;
  const muJ = (opp.rating - 1500) / SCALE, phiJ = opp.rd / SCALE;
  const g = 1 / Math.sqrt(1 + (3 * phiJ * phiJ) / (Math.PI * Math.PI));
  const E = 1 / (1 + Math.exp(-g * (mu - muJ)));
  const v = 1 / (g * g * E * (1 - E));
  const delta = v * g * (score - E);
  // volatility (Illinois algorithm)
  const a = Math.log(me.vol * me.vol);
  const f = (x: number) => (Math.exp(x) * (delta * delta - phi * phi - v - Math.exp(x))) / (2 * (phi * phi + v + Math.exp(x)) ** 2) - (x - a) / (TAU * TAU);
  let A = a, B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else { let k = 1; while (f(a - k * TAU) < 0) k++; B = a - k * TAU; }
  let fA = f(A), fB = f(B);
  for (let i = 0; i < 60 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA), fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const vol = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * g * (score - E);
  return { rating: muNew * SCALE + 1500, rd: Math.max(30, phiNew * SCALE), vol };
}

/** Standard expected score, used by bots to judge fights. */
export const expected = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / 400));

// ---------- Glicko-1, as chess.com uses it ----------

const Q = Math.log(10) / 400;
const gRd = (rd: number) => 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI));

/** A new player's deviation: the system knows nothing yet, so ratings move fast. */
export const RD_NEW = 350;
/** The most settled a rating gets (changes of about ±6 a game at this point). */
export const RD_MIN = 45;
/** Deviation grows back when you don't play: from settled to brand new in about a year. */
export const RD_PER_DAY = Math.sqrt((RD_NEW * RD_NEW - 60 * 60) / 365);
/** Shown with a "?" until the rating settles, like chess.com's provisional ratings. */
export const RD_PROVISIONAL = 110;

/** The deviation after `days` without a rated game. */
export function rdAfter(rd: number, days: number): number {
  return Math.min(RD_NEW, Math.sqrt(rd * rd + RD_PER_DAY * RD_PER_DAY * Math.max(0, days)));
}

/**
 * One rated game under Glicko-1. The change is large while your deviation is high
 * (a new player wins about +175 against an equal, settled opponent) and shrinks as
 * games accumulate (about ±26 after 10 games, ±10 once settled).
 */
export function glicko1(me: { rating: number; rd: number }, opp: { rating: number; rd: number }, score: 0 | 0.5 | 1): { rating: number; rd: number } {
  const g = gRd(opp.rd);
  const E = 1 / (1 + 10 ** ((-g * (me.rating - opp.rating)) / 400));
  const d2 = 1 / (Q * Q * g * g * E * (1 - E));
  const k = Q / (1 / (me.rd * me.rd) + 1 / d2);
  return { rating: me.rating + k * g * (score - E), rd: Math.max(RD_MIN, Math.sqrt(1 / (1 / (me.rd * me.rd) + 1 / d2))) };
}
