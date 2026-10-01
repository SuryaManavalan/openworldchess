// Usage analytics (docs/specs/stats.md): first-party counters for the private
// /stats.html page. No third-party service, no personal details: visitors are
// random IDs the browser makes up, players are game IDs, bots never count.
//
// Kept in a small JSON file next to the world save (stats.json), written with it.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Game, PlayerRec } from './game.ts';
import { perf } from './perf.ts';

const STATS_KEY = process.env.STATS_KEY ?? '';
const MAX_IDS = 250_000;

export interface Day {
  visitors: number; newVisitors: number;
  players: number; newPlayers: number;
  peak: number; playerMinutes: number;
  battles: { pvp: number; wild: number; practice: number };
  chapters: Record<string, number>;
  signIns: { google: number; tiktok: number };
  purchases: number; revenueCents: number; shares: number;
  sources: Record<string, number>;
}
interface Seen { f: string; l: string; n: number; s?: string }
interface Data {
  v: 1;
  days: Record<string, Day>;
  hours: Record<string, { visitors: number; newPlayers: number; peak: number }>;
  vids: Record<string, Seen>;
  players: Record<string, Seen>;
  chapterDone: Record<string, number>;
  purchasers: string[];
  recent: { purchases: { at: number; cents: number; crowns: number }[]; signIns: { at: number; kind: string }[] };
  since: number;
}

/** Days and hours are Pacific time (PST/PDT, daylight saving handled), to match the team's day. */
export const TZ = 'America/Los_Angeles';
const pt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
const parts = (t: number) => Object.fromEntries(pt.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
const dayOf = (t = Date.now()) => { const p = parts(t); return `${p.year}-${p.month}-${p.day}`; };
const hourOf = (t = Date.now()) => { const p = parts(t); return `${p.year}-${p.month}-${p.day} ${p.hour}:00`; };
const blankDay = (): Day => ({ visitors: 0, newVisitors: 0, players: 0, newPlayers: 0, peak: 0, playerMinutes: 0, battles: { pvp: 0, wild: 0, practice: 0 }, chapters: {}, signIns: { google: 0, tiktok: 0 }, purchases: 0, revenueCents: 0, shares: 0, sources: {} });

class Stats {
  d: Data = { v: 1, days: {}, hours: {}, vids: {}, players: {}, chapterDone: {}, purchasers: [], recent: { purchases: [], signIns: [] }, since: Date.now() };
  file = '';
  online = 0;

  private day(t = Date.now()) { return (this.d.days[dayOf(t)] ??= blankDay()); }
  /** How many different days this player has been seen (since the stats began; older accounts start at 1). */
  daysOf(id: string) { return this.d.players[id]?.n ?? 0; }
  private hour(t = Date.now()) {
    const h = (this.d.hours[hourOf(t)] ??= { visitors: 0, newPlayers: 0, peak: 0 });
    const keys = Object.keys(this.d.hours);
    if (keys.length > 72) for (const k of keys.sort().slice(0, keys.length - 72)) delete this.d.hours[k];
    return h;
  }

  /** Load (or start) the stats kept next to the world save; backfill from the world the first time. */
  load(file: string, game: Game) {
    this.file = file;
    if (existsSync(file)) { try { this.d = { ...this.d, ...JSON.parse(readFileSync(file, 'utf8')) }; return; } catch { /* start over */ } }
    // First run: count the players who already exist, and how far they got.
    for (const p of game.players.values()) {
      if (p.isBot || p.wild) continue;
      this.d.players[p.id] = { f: dayOf(p.createdAt), l: dayOf(p.lastSeen), n: 1 };
      const done = (p.chron?.ch ?? 1) - 1;
      for (let c = 1; c <= done; c++) this.d.chapterDone[c] = (this.d.chapterDone[c] ?? 0) + 1;
      if (p.receipts?.length) this.d.purchasers.push(p.id);
    }
  }
  save() {
    if (!this.file) return;
    writeFileSync(this.file + '.tmp', JSON.stringify(this.d));
    renameSync(this.file + '.tmp', this.file);
  }

  /** A browser opened the site (once per page load; counted once per visitor per day). */
  visit(vid: string, src: string) {
    const today = dayOf(), d = this.day(), s = this.d.vids[vid];
    if (!s) {
      if (Object.keys(this.d.vids).length >= MAX_IDS) return;
      this.d.vids[vid] = { f: today, l: today, n: 1, s: src };
      d.newVisitors++; d.visitors++; this.hour().visitors++;
      d.sources[src] = (d.sources[src] ?? 0) + 1;
    } else if (s.l !== today) { s.l = today; s.n++; d.visitors++; this.hour().visitors++; }
  }

  /** A person (not a bot) joined the game. */
  player(p: PlayerRec, isNew: boolean) {
    if (p.isBot || p.wild) return;
    const today = dayOf(), d = this.day(), s = this.d.players[p.id];
    if (!s) { this.d.players[p.id] = { f: today, l: today, n: 1 }; d.players++; if (isNew) { d.newPlayers++; this.hour().newPlayers++; } }
    else if (s.l !== today) { s.l = today; s.n++; d.players++; }
  }

  /** Once a minute: people online now. */
  sample(online: number) {
    this.online = online;
    const d = this.day(), h = this.hour();
    d.peak = Math.max(d.peak, online); h.peak = Math.max(h.peak, online);
    d.playerMinutes += online;
  }

  battle(kind: 'pvp' | 'wild' | 'practice') { this.day().battles[kind]++; }
  chapter(n: number) { const d = this.day(); d.chapters[n] = (d.chapters[n] ?? 0) + 1; this.d.chapterDone[n] = (this.d.chapterDone[n] ?? 0) + 1; }
  signIn(kind: 'google' | 'tiktok') { this.day().signIns[kind]++; this.d.recent.signIns = [{ at: Date.now(), kind }, ...this.d.recent.signIns].slice(0, 25); }
  purchase(playerId: string, cents: number, crowns: number) {
    const d = this.day(); d.purchases++; d.revenueCents += cents;
    if (!this.d.purchasers.includes(playerId)) this.d.purchasers.push(playerId);
    this.d.recent.purchases = [{ at: Date.now(), cents, crowns }, ...this.d.recent.purchases].slice(0, 25);
  }
  share() { this.day().shares++; }

  report(game: Game, live: { humans: number; watchers: number; bots: number }) {
    const days = Object.keys(this.d.days).sort().slice(-30);
    const series = (f: (d: Day) => number) => days.map((day) => ({ day, n: f(this.d.days[day]) }));
    const sum = (f: (d: Day) => number) => Object.values(this.d.days).reduce((a, d) => a + f(d), 0);
    const retention: Record<number, number> = {};
    for (const s of Object.values(this.d.vids)) retention[Math.min(s.n, 10)] = (retention[Math.min(s.n, 10)] ?? 0) + 1;
    const sources: Record<string, number> = {};
    for (const d of Object.values(this.d.days)) for (const [k, v] of Object.entries(d.sources)) sources[k] = (sources[k] ?? 0) + v;
    // Where active players are in the Chronicle now (seen in the last 7 days).
    const weekAgo = Date.now() - 7 * 86_400_000, now: Record<number, number> = {};
    let signedIn = 0;
    for (const p of game.players.values()) {
      if (p.isBot || p.wild) continue;
      if (p.googleSub || p.tiktokId) signedIn++;
      if (p.lastSeen >= weekAgo && p.chron) now[p.chron.ch] = (now[p.chron.ch] ?? 0) + 1;
    }
    const today = this.d.days[dayOf()] ?? blankDay();
    const hours = Object.keys(this.d.hours).sort().slice(-48);
    const mem = process.memoryUsage();
    return {
      generatedAt: Date.now(), since: this.d.since, tz: TZ,
      live: { ...live, battles: game.battles.active().filter((b) => b.phase !== 'over').length, campsAwake: game.wilds.awake().length, pieces: game.world.pieces.size, buildings: game.world.buildings.size, rssMb: Math.round(mem.rss / 1048576), uptimeMin: Math.round(process.uptime() / 60), perf: perf.last },
      totals: {
        visitors: Object.keys(this.d.vids).length,
        returned: Object.values(this.d.vids).filter((s) => s.n > 1).length,
        players: Object.keys(this.d.players).length,
        playersReturned: Object.values(this.d.players).filter((s) => s.n > 1).length,
        signedIn, purchasers: this.d.purchasers.length,
        revenueCents: sum((d) => d.revenueCents), purchases: sum((d) => d.purchases),
        battles: sum((d) => d.battles.pvp + d.battles.wild + d.battles.practice),
        shares: sum((d) => d.shares), playerHours: Math.round(sum((d) => d.playerMinutes) / 60),
        chapterDone: this.d.chapterDone, sources,
      },
      today: { visitors: today.visitors, newVisitors: today.newVisitors, players: today.players, newPlayers: today.newPlayers, peak: today.peak },
      byDay: {
        visitors: series((d) => d.visitors), newVisitors: series((d) => d.newVisitors),
        players: series((d) => d.players), newPlayers: series((d) => d.newPlayers),
        peak: series((d) => d.peak), playerHours: series((d) => Math.round(d.playerMinutes / 6) / 10),
        battles: series((d) => d.battles.pvp + d.battles.wild + d.battles.practice),
        revenueCents: series((d) => d.revenueCents), tiktok: series((d) => d.sources.tiktok ?? 0),
      },
      byHour: hours.map((hour) => ({ hour, visitors: this.d.hours[hour].visitors, newPlayers: this.d.hours[hour].newPlayers, peak: this.d.hours[hour].peak })),
      retention: Object.entries(retention).map(([days, n]) => ({ days: Number(days), n })).sort((a, b) => a.days - b.days),
      chapterNow: Object.entries(now).map(([ch, n]) => ({ ch: Number(ch), n })).sort((a, b) => a.ch - b.ch),
      recent: this.d.recent,
      days: days.map((day) => ({ day, ...this.d.days[day] })),
    };
  }
}

export const stats = new Stats();

/** Where a visit came from: the page tells us its referrer, UTM source and in-app browser. */
export function sourceOf(ref: string, utm: string, ua: string): string {
  const s = `${utm} ${ref}`.toLowerCase();
  if (/tiktok|musical_ly|bytedance/.test(`${s} ${ua.toLowerCase()}`)) return 'tiktok';
  if (/youtube|youtu\.be/.test(s)) return 'youtube';
  if (/instagram/.test(`${s} ${ua.toLowerCase()}`)) return 'instagram';
  if (/reddit/.test(s)) return 'reddit';
  if (/google\./.test(s)) return 'google';
  if (/(x|twitter|t)\.co/.test(s)) return 'x';
  if (/discord/.test(s)) return 'discord';
  if (utm) return utm.slice(0, 20).toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'other';
  if (ref && !/openworldchess\.com/.test(ref)) return 'other';
  return 'direct';
}

export async function handleStats(game: Game, req: IncomingMessage, res: ServerResponse, live: () => { humans: number; watchers: number; bots: number }): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/api/visit' && req.method === 'POST') {
    const body = await new Promise<string>((ok) => { let b = ''; req.on('data', (c) => { if (b.length < 2000) b += c; }); req.on('end', () => ok(b)); req.on('error', () => ok('')); });
    try {
      const m = JSON.parse(body) as { vid?: string; ref?: string; utm?: string };
      if (m.vid && /^[a-z0-9]{8,40}$/.test(m.vid)) stats.visit(m.vid, sourceOf(String(m.ref ?? '').slice(0, 300), String(m.utm ?? '').slice(0, 40), String(req.headers['user-agent'] ?? '')));
    } catch { /* ignore */ }
    res.statusCode = 204; res.end();
    return true;
  }
  if (url.pathname === '/api/stats') {
    if (!STATS_KEY || req.headers['x-stats-key'] !== STATS_KEY) { res.statusCode = 404; res.end('not found'); return true; }
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(stats.report(game, live())));
    return true;
  }
  return false;
}
