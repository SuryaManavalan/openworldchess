// Balance simulator for resource placement.
// Samples candidate city sites across several seeds, measures what each site
// has in reach, and checks the results against the targets in
// docs/specs/resources.md. Run: node sim/balance.ts [sitesPerSeed] [seeds]
import { mkdirSync, writeFileSync } from 'node:fs';
import { rng } from '../src/random.ts';
import { buildable, eloAt, terrainAt } from '../src/terrain.ts';
import { resourcesInRect, type Kind, type ResourceNode } from '../src/resources.ts';

const SITES = Number(process.argv[2] ?? 1500);
const SEEDS = Number(process.argv[3] ?? 3);
const CITY_R = 10; // city radius (economy.md §2)
const WORLD = 30000; // sample from [-WORLD, WORLD]^2

const BANDS = [
  { name: '<1000', lo: 0, hi: 1000 },
  { name: '1000-1500', lo: 1000, hi: 1500 },
  { name: '1500-2000', lo: 1500, hi: 2000 },
  { name: '2000+', lo: 2000, hi: 9999 },
];

const cheb = (a: ResourceNode, b: ResourceNode) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** A palace site: some gold and some rock close enough to share one palace work area (a 9x9 box). */
const hasPalaceSite = (nodes: ResourceNode[]) => {
  const gold = nodes.filter((n) => n.kind === 'gold'), rock = nodes.filter((n) => n.kind === 'rock');
  return gold.some((g) => rock.some((r) => cheb(g, r) <= 8));
};

/** Start-viable: enough wood to build, and wheat to feed houses and a stable. */
const isViable = (c: Record<Kind, number>) => c.tree >= 4 && c.wheat >= 3;

interface SiteStat { elo: number; counts: Record<Kind, number>; cap: Record<Kind, number>; viable: boolean; palace: boolean }

/** Stratified by elo band: n sites per band, so rare high-elo pockets are measured too. */
function sampleSites(seed: number, n: number): SiteStat[] {
  const r = rng(seed * 7919 + 1);
  const out: SiteStat[] = [];
  const perBand = BANDS.map(() => 0);
  for (let tries = 0; out.length < n * BANDS.length && tries < 3_000_000; tries++) {
    const x = Math.floor((r() * 2 - 1) * WORLD), y = Math.floor((r() * 2 - 1) * WORLD);
    const band = BANDS.findIndex((b) => { const e = eloAt(seed, x, y); return e >= b.lo && e < b.hi; });
    if (perBand[band] >= n || !buildable(terrainAt(seed, x, y))) continue;
    perBand[band]++;
    const nodes = resourcesInRect(seed, x - CITY_R, y - CITY_R, x + CITY_R, y + CITY_R);
    const counts = { tree: 0, wheat: 0, rock: 0, gold: 0 }, cap = { tree: 0, wheat: 0, rock: 0, gold: 0 };
    for (const nd of nodes) { counts[nd.kind]++; cap[nd.kind] += nd.capacity; }
    out.push({ elo: eloAt(seed, x, y), counts, cap, viable: isViable(counts), palace: hasPalaceSite(nodes) });
  }
  return out;
}

/** Distance (Chebyshev) from (x, y) to the nearest node of `kind`, searching outward up to `max`. */
function nearest(seed: number, x: number, y: number, kind: Kind, max: number): number {
  for (let r = 8; r <= max; r *= 2) {
    const nodes = resourcesInRect(seed, x - r, y - r, x + r, y + r, [kind]);
    if (nodes.length) return Math.min(...nodes.map((n) => Math.max(Math.abs(n.x - x), Math.abs(n.y - y))));
  }
  return Infinity;
}

/** Clark-Evans ratio: mean nearest-neighbor distance over what a random pattern would give. Below 1 means clustered. */
function clarkEvans(seed: number, kind: Kind, x0: number, y0: number, size: number): number {
  const nodes = resourcesInRect(seed, x0, y0, x0 + size, y0 + size, [kind]).filter((n) => n.kind === kind);
  if (nodes.length < 10) return NaN;
  let sum = 0;
  for (const a of nodes) {
    let best = Infinity;
    for (const b of nodes) if (a !== b) best = Math.min(best, Math.hypot(a.x - b.x, a.y - b.y));
    sum += best;
  }
  const density = nodes.length / (size * size);
  return sum / nodes.length / (0.5 / Math.sqrt(density));
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const cv = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((v) => (v - m) ** 2))) / m; };
const frac = (xs: SiteStat[], f: (s: SiteStat) => boolean) => xs.filter(f).length / Math.max(1, xs.length);

// ---------- run ----------

const t0 = Date.now();
const all: SiteStat[] = [];
const terrainCounts: Record<string, number> = {};
const gaps: Record<Kind, number[]> = { tree: [], wheat: [], rock: [], gold: [] };
const ce: Record<Kind, number[]> = { tree: [], wheat: [], rock: [], gold: [] };

for (let seed = 1; seed <= SEEDS; seed++) {
  all.push(...sampleSites(seed, SITES));
  const r = rng(seed * 104729);
  for (let k = 0; k < 20000; k++) {
    const t = terrainAt(seed, Math.floor((r() * 2 - 1) * WORLD), Math.floor((r() * 2 - 1) * WORLD));
    terrainCounts[t] = (terrainCounts[t] ?? 0) + 1;
  }
  // Gaps are measured in the new-player zone, where fairness matters most.
  for (let k = 0; k < 120; k++) {
    const x = Math.floor((r() * 2 - 1) * 2500), y = Math.floor((r() * 2 - 1) * 2500);
    if (!buildable(terrainAt(seed, x, y))) continue;
    for (const kind of ['tree', 'wheat', 'rock', 'gold'] as Kind[]) gaps[kind].push(nearest(seed, x, y, kind, 1024));
  }
  for (let k = 0; k < 3; k++)
    for (const kind of ['tree', 'wheat', 'rock', 'gold'] as Kind[]) {
      const size = kind === 'gold' ? 1200 : 300;
      const v = clarkEvans(seed, kind, Math.floor((r() * 2 - 1) * 2000), Math.floor((r() * 2 - 1) * 2000), size);
      if (!Number.isNaN(v)) ce[kind].push(v);
    }
}

const low = all.filter((s) => s.elo < 1200);
const high = all.filter((s) => s.elo >= 2000);

interface Check { name: string; value: number; lo: number; hi: number; fmt: 'pct' | 'num' }
const checks: Check[] = [
  { name: 'Start-viable sites (low elo)', value: frac(low, (s) => s.viable), lo: 0.9, hi: 1, fmt: 'pct' },
  { name: 'Sites with rock in reach (low elo)', value: frac(low, (s) => s.counts.rock > 0), lo: 0.5, hi: 0.75, fmt: 'pct' },
  { name: 'Sites with gold in reach (low elo)', value: frac(low, (s) => s.counts.gold > 0), lo: 0.06, hi: 0.15, fmt: 'pct' },
  { name: 'Palace sites (low elo)', value: frac(low, (s) => s.palace), lo: 0.03, hi: 0.08, fmt: 'pct' },
  { name: 'Palace sites (elo 2000+)', value: frac(high, (s) => s.palace), lo: 0.12, hi: 0.3, fmt: 'pct' },
  { name: 'Nearest wood, 99th pct (squares)', value: pct(gaps.tree, 0.99), lo: 0, hi: 20, fmt: 'num' },
  { name: 'Nearest wheat, 99th pct (squares)', value: pct(gaps.wheat, 0.99), lo: 0, hi: 25, fmt: 'num' },
  { name: 'Nearest rock, 99th pct (squares)', value: pct(gaps.rock, 0.99), lo: 0, hi: 50, fmt: 'num' },
  { name: 'Nearest gold, 90th pct (squares)', value: pct(gaps.gold, 0.9), lo: 0, hi: 150, fmt: 'num' },
  { name: 'Clustering: wood (Clark-Evans R)', value: mean(ce.tree), lo: 0, hi: 0.8, fmt: 'num' },
  { name: 'Clustering: wheat (R)', value: mean(ce.wheat), lo: 0, hi: 0.7, fmt: 'num' },
  { name: 'Clustering: rock (R)', value: mean(ce.rock), lo: 0, hi: 0.7, fmt: 'num' },
  { name: 'Clustering: gold (R)', value: mean(ce.gold), lo: 0, hi: 0.6, fmt: 'num' },
];

const show = (c: Check) => (c.fmt === 'pct' ? `${(c.value * 100).toFixed(1)}%` : c.value.toFixed(2));
const range = (c: Check) => (c.fmt === 'pct' ? `${c.lo * 100}–${c.hi * 100}%` : `${c.lo}–${c.hi}`);
const pass = (c: Check) => c.value >= c.lo && c.value <= c.hi;

console.log(`\n${all.length} sites over ${SEEDS} seeds in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
console.log('Terrain mix: ' + Object.entries(terrainCounts).map(([k, v]) => `${k} ${((v / (20000 * SEEDS)) * 100).toFixed(1)}%`).join(', '));
console.log('\nCheck'.padEnd(44) + 'Value'.padEnd(10) + 'Target'.padEnd(12) + 'Result');
for (const c of checks) console.log(c.name.padEnd(43) + show(c).padEnd(10) + range(c).padEnd(12) + (pass(c) ? 'PASS' : 'FAIL'));

console.log('\nBy elo band        sites   viable   rock   gold   palace   wood cap   rock cap   gold cap   CV(site value)');
const bandRows = BANDS.map((b) => {
  const s = all.filter((x) => x.elo >= b.lo && x.elo < b.hi);
  const value = s.map((x) => x.cap.tree * 0.2 + x.cap.wheat * 0.5 + x.cap.rock * 0.4 + x.cap.gold * 2);
  const row = {
    band: b.name, sites: s.length,
    viable: frac(s, (x) => x.viable), rock: frac(s, (x) => x.counts.rock > 0),
    gold: frac(s, (x) => x.counts.gold > 0), palace: frac(s, (x) => x.palace),
    woodCap: s.length ? mean(s.map((x) => x.cap.tree)) : 0, rockCap: s.length ? mean(s.map((x) => x.cap.rock)) : 0,
    goldCap: s.length ? mean(s.map((x) => x.cap.gold)) : 0, cv: s.length ? cv(value) : 0,
  };
  const p = (v: number) => `${(v * 100).toFixed(0)}%`.padStart(6);
  console.log(`${row.band.padEnd(16)}${String(row.sites).padStart(7)}  ${p(row.viable)} ${p(row.rock)} ${p(row.gold)} ${p(row.palace)}   ${row.woodCap.toFixed(0).padStart(8)}   ${row.rockCap.toFixed(0).padStart(8)}   ${row.goldCap.toFixed(0).padStart(8)}   ${row.cv.toFixed(2).padStart(8)}`);
  return row;
});

mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/report.json', import.meta.url), JSON.stringify({ checks: checks.map((c) => ({ ...c, pass: pass(c) })), bandRows, terrainCounts }, null, 2));
const failed = checks.filter((c) => !pass(c)).length;
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks pass');
process.exitCode = failed ? 1 : 0;
