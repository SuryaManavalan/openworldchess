// Server observability (docs/specs/performance.md §2). Cheap enough to leave on
// in production: a few counters per timed section, rolled up every minute.
//
//   const end = perf.start('turn.groups'); ...; end();
//   perf.count('path.long');  perf.gauge('pieces', () => world.pieces.size);
//
// GET /metrics (localhost only) returns the last complete window and the live
// one; a one-line summary goes to the log each minute; anything slower than
// SLOW_MS is logged on its own with its name.
import { monitorEventLoopDelay } from 'node:perf_hooks';

interface Stat { n: number; total: number; max: number }
const SLOW_MS = 250;

class Perf {
  private cur = new Map<string, Stat>();
  private counts = new Map<string, number>();
  private gauges = new Map<string, () => number>();
  private windowStart = Date.now();
  last: Record<string, unknown> | null = null;
  private loop = monitorEventLoopDelay({ resolution: 10 });
  /** Log a summary each window (off in tests). */
  log = !process.env.VITEST;

  constructor() { this.loop.enable(); }

  start(name: string): () => number {
    const t0 = performance.now();
    return () => {
      const ms = performance.now() - t0;
      this.add(name, ms);
      return ms;
    };
  }

  time<T>(name: string, fn: () => T): T {
    const end = this.start(name);
    try { return fn(); } finally { end(); }
  }

  add(name: string, ms: number) {
    let s = this.cur.get(name);
    if (!s) this.cur.set(name, (s = { n: 0, total: 0, max: 0 }));
    s.n++; s.total += ms; if (ms > s.max) s.max = ms;
    if (ms > SLOW_MS && this.log) console.warn(`[perf] slow ${name}: ${ms.toFixed(0)}ms`);
  }

  count(name: string, by = 1) { this.counts.set(name, (this.counts.get(name) ?? 0) + by); }
  gauge(name: string, fn: () => number) { this.gauges.set(name, fn); }

  snapshot(now = Date.now()) {
    const secs = Math.max(0.001, (now - this.windowStart) / 1000);
    const timings: Record<string, { n: number; totalMs: number; avgMs: number; maxMs: number; pctOfWall: number }> = {};
    for (const [k, s] of [...this.cur].sort((a, b) => b[1].total - a[1].total))
      timings[k] = { n: s.n, totalMs: Math.round(s.total), avgMs: +(s.total / s.n).toFixed(2), maxMs: Math.round(s.max), pctOfWall: +((s.total / (secs * 1000)) * 100).toFixed(1) };
    const gauges: Record<string, number> = {};
    for (const [k, fn] of this.gauges) { try { gauges[k] = fn(); } catch { gauges[k] = -1; } }
    const mem = process.memoryUsage();
    return {
      windowSecs: +secs.toFixed(1),
      cpu: process.cpuUsage(),
      loopLagMs: { p50: +(this.loop.percentile(50) / 1e6).toFixed(1), p99: +(this.loop.percentile(99) / 1e6).toFixed(1), max: +(this.loop.max / 1e6).toFixed(1) },
      memMB: { rss: Math.round(mem.rss / 1048576), heap: Math.round(mem.heapUsed / 1048576) },
      timings,
      counts: Object.fromEntries(this.counts),
      gauges,
    };
  }

  /** Close the window: keep it as `last`, start a new one. */
  roll(now = Date.now()) {
    this.last = this.snapshot(now);
    if (this.log) {
      const t = this.last.timings as Record<string, { pctOfWall: number; maxMs: number }>;
      const top = Object.entries(t).slice(0, 8).map(([k, v]) => `${k} ${v.pctOfWall}% (max ${v.maxMs}ms)`).join(', ');
      const lag = this.last.loopLagMs as { p99: number };
      console.log(`[perf] lag p99 ${lag.p99}ms · ${top} · ${JSON.stringify(this.last.gauges)}`);
    }
    this.cur = new Map(); this.counts = new Map(); this.windowStart = now; this.loop.reset();
  }
}

export const perf = new Perf();
