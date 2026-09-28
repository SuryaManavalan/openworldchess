// Merge parallel generator outputs (out/puzzles-*.json) into packages/shared/src/puzzles.json, without duplicates.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
const OUT = new URL('../../packages/shared/src/puzzles.json', import.meta.url).pathname;
const all = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const seen = new Set(all.map((p) => p.fen.split(' ').slice(0, 2).join(' ')));
for (const f of readdirSync('out').filter((f) => /^puzzles-\d+\.json$/.test(f))) {
  for (const p of JSON.parse(readFileSync(`out/${f}`, 'utf8'))) { const k = p.fen.split(' ').slice(0, 2).join(' '); if (!seen.has(k)) { seen.add(k); all.push(p); } }
}
writeFileSync(OUT, JSON.stringify(all, null, 0).replace(/},{/g, '},\n{'));
console.log(`${all.length} puzzles (${all.filter((p) => p.n === 2).length} mate in 2)`);
