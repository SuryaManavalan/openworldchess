// Glicko-2, one game at a time (progression.md §2).

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
