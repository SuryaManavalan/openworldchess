// Default player names in the style of real online handles. Shared by the
// welcome screen (a prefilled suggestion) and bots, so bot names look like
// what a real player would have kept (bots.md §4).

const A = ['iron', 'quiet', 'grey', 'amber', 'north', 'stone', 'ash', 'river', 'oak', 'frost', 'ember', 'moor', 'silent', 'lucky', 'slow', 'deep', 'tiny', 'old', 'swift', 'bold', 'lone', 'dark', 'wild', 'noble'];
const B = ['rook', 'gambit', 'pawnstorm', 'bishop', 'knight', 'tempo', 'castle', 'zugzwang', 'endgame', 'sicilian', 'caro', 'fork', 'pin', 'blunder', 'queen', 'king', 'elephant', 'marshal', 'squire', 'warden'];

/** A random handle like "QuietRook412" or "ash_gambit". */
export function randomName(rand: () => number = Math.random): string {
  const a = A[Math.floor(rand() * A.length)], b = B[Math.floor(rand() * B.length)];
  const style = rand();
  const num = rand() < 0.7 ? String(Math.floor(rand() * 999)) : '';
  const name = style < 0.5 ? a[0].toUpperCase() + a.slice(1) + b[0].toUpperCase() + b.slice(1) + num : style < 0.8 ? `${a}_${b}${num}` : `${a}${b}${num}`;
  return name.slice(0, 20);
}
