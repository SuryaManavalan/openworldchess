// The Herald (docs/specs/discord.md): news of the Board, posted to the community Discord through a
// webhook (HERALD_WEBHOOK in the server's env; without one it only logs what it would post).
// - A pulse when 3+ people are playing (at most every 3 hours, or a new high for the day).
// - Big moments as they happen (a Wonder raised, a new city, a siege won, a dragon slain), at
//   most one every 30 minutes; the rest wait for the digest.
// - A daily digest at 7 pm Pacific: chapters completed (by whom), side quests, battles, new cities.
// Player names are the public names everyone sees in the game. Nothing is posted about bots.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { CHAPTERS, isDecor } from '@owc/shared';
import { townName } from '@owc/worldgen';
import type { Game } from './game.ts';
import { TZ } from './stats.ts';

const PULSE_MIN = 3;
const PULSE_EVERY_MS = 3 * 3600_000;
const MOMENT_EVERY_MS = 30 * 60_000;
const DIGEST_HOUR = 19;

const pt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
const parts = (t: number) => Object.fromEntries(pt.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
const dayOf = (t: number) => { const p = parts(t); return `${p.year}-${p.month}-${p.day}`; };
/** Discord text from a player-chosen string: no markdown tricks, no mentions. */
export const clean = (s: string) => s.replace(/[\\*_~`|>#@[\]()]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'someone';

interface Day {
  day: string;
  chapters: { who: string; n: number; name: string; title?: string }[];
  sides: Record<string, number>;
  battles: { pvp: number; wild: number; sieges: { winner: string; loser: string }[] };
  moments: string[];
  peak: number;
}
interface State { v: 1; today: Day; lastPulse: number; pulsedPeak: number; lastMoment: number; digested: string; seen: { wonders: number[]; cities: number[] } }

export interface Post { content: string; embeds?: { title?: string; description?: string; color?: number; footer?: { text: string } }[] }

export class Herald {
  private game: Game;
  private file = '';
  private hook = process.env.HERALD_WEBHOOK ?? '';
  /** Where posts go (tests swap it). */
  send: (p: Post) => Promise<void> = (p) => this.deliver(p);
  s: State;
  constructor(game: Game) { this.game = game; this.s = this.blank(); }

  private blankDay(now = Date.now()): Day { return { day: dayOf(now), chapters: [], sides: {}, battles: { pvp: 0, wild: 0, sieges: [] }, moments: [], peak: 0 }; }
  private blank(): State { return { v: 1, today: this.blankDay(), lastPulse: 0, pulsedPeak: 0, lastMoment: 0, digested: '', seen: { wonders: [], cities: [] } }; }

  load(file: string) {
    this.file = file;
    try { if (existsSync(file)) this.s = { ...this.blank(), ...JSON.parse(readFileSync(file, 'utf8')) }; } catch { /* start fresh */ }
  }
  save() { if (!this.file) return; try { writeFileSync(this.file + '.tmp', JSON.stringify(this.s)); renameSync(this.file + '.tmp', this.file); } catch { /* next time */ } }

  private human(id: string | null | undefined) { const p = id ? this.game.players.get(id) : undefined; return p && !p.isBot && !p.wild ? p : undefined; }

  // ---------- what happened ----------

  chapter(playerId: string, n: number, title?: string) {
    const p = this.human(playerId); if (!p) return;
    this.s.today.chapters.push({ who: clean(p.name), n, name: CHAPTERS[n - 1]?.name ?? `Chapter ${n}`, title });
    if (n >= 10) this.moment(`👑 **${clean(p.name)}** finished chapter ${n}, *${CHAPTERS[n - 1]?.name}*${title ? `, and is now a ${title}` : ''}.`);
  }
  side(playerId: string, kind: string) { if (this.human(playerId)) this.s.today.sides[kind] = (this.s.today.sides[kind] ?? 0) + 1; }
  battle(kind: string, winner: string | null, loser: string | null, wild: boolean, town?: string) {
    const w = this.human(winner), l = this.human(loser);
    if (!w && !l) return;
    if (wild) { this.s.today.battles.wild++; return; }
    this.s.today.battles.pvp++;
    if (kind === 'siege' && w && l) {
      this.s.today.battles.sieges.push({ winner: clean(w.name), loser: clean(l.name) });
      this.moment(`⚔️ **${clean(w.name)}** took ${town ? `**${clean(town)}**` : 'a town'} from **${clean(l.name)}** in a siege.`);
    }
  }
  dragon(playerId: string) { const p = this.human(playerId); if (p) this.moment(`🐉 **${clean(p.name)}** slew a dragon.`); }

  /** A big moment: posted now if the last was a while ago, else saved for the digest. */
  private moment(text: string) {
    const now = this.game.now || Date.now();
    if (now - this.s.lastMoment >= MOMENT_EVERY_MS) { this.s.lastMoment = now; void this.send({ content: text }); }
    else this.s.today.moments.push(text);
  }

  // ---------- every minute ----------

  tick(now: number, humans: number) {
    const s = this.s;
    if (dayOf(now) !== s.today.day) s.today = this.blankDay(now);
    s.today.peak = Math.max(s.today.peak, humans);
    // The pulse: never below 3 (an empty-feeling number does more harm than none).
    const fresh = now - s.lastPulse >= PULSE_EVERY_MS;
    if (humans >= PULSE_MIN && (fresh || humans >= s.pulsedPeak + 3)) {
      s.pulsedPeak = fresh ? humans : Math.max(s.pulsedPeak, humans); s.lastPulse = now;
      void this.send({ content: `🟢 **${humans} rulers** are on the Board right now. Join them: https://openworldchess.com` });
    }
    this.scan();
    // The digest, once a day at 7 pm Pacific.
    if (Number(parts(now).hour) >= DIGEST_HOUR && s.digested !== s.today.day) { s.digested = s.today.day; const d = this.digest(s.today); if (d) void this.send(d); }
  }

  /** New Wonders and cities since the last look (announced once each). */
  private scan() {
    const g = this.game;
    for (const b of g.world.buildings.values()) {
      if (b.type !== 'wonder' || b.built < 1 || this.s.seen.wonders.includes(b.id)) continue;
      this.s.seen.wonders.push(b.id);
      const p = this.human(b.owner); if (p) this.moment(`🏛️ **${clean(p.name)}** raised a **Wonder**. The whole Board can see it.`);
    }
    for (const p of g.players.values()) {
      if (p.isBot || p.wild) continue;
      for (const st of g.chronicle.settlementsOf(p.id)) {
        if (st.tier < 4 || this.s.seen.cities.includes(st.id)) continue;
        this.s.seen.cities.push(st.id);
        this.moment(`🏙️ **${clean(p.name)}**'s town **${townName(g.world.seed, st.id, st.cx, st.cy)}** grew into a **city**.`);
      }
    }
    if (this.s.seen.cities.length > 5000) this.s.seen.cities = this.s.seen.cities.slice(-3000);
  }

  /** Today on the Board: who finished which chapters, quests, battles, moments that waited. */
  digest(d: Day): Post | null {
    const lines: string[] = [];
    if (d.chapters.length) {
      const by = new Map<string, { n: number; name: string }[]>();
      for (const c of d.chapters) by.set(c.who, [...(by.get(c.who) ?? []), c]);
      const shown = [...by].slice(0, 12).map(([who, cs]) => `**${who}**: ${cs.map((c) => `ch. ${c.n} *${c.name}*`).join(', ')}`);
      lines.push(`📜 **Chapters completed**\n${shown.join('\n')}${by.size > 12 ? `\n…and ${by.size - 12} more rulers` : ''}`);
    }
    const sides = Object.values(d.sides).reduce((a, b) => a + b, 0);
    if (sides) lines.push(`🗺️ **${sides} side quest${sides > 1 ? 's' : ''}** done (${Object.entries(d.sides).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k}`).join(', ')})`);
    if (d.battles.pvp || d.battles.wild) lines.push(`⚔️ **${d.battles.pvp} battle${d.battles.pvp === 1 ? '' : 's'}** between empires, **${d.battles.wild}** against the wilds${d.battles.sieges.length ? `\n${d.battles.sieges.slice(0, 5).map((x) => `· **${x.winner}** won a siege against **${x.loser}**`).join('\n')}` : ''}`);
    if (d.moments.length) lines.push(d.moments.slice(0, 6).join('\n'));
    if (d.peak >= PULSE_MIN) lines.push(`🟢 Up to **${d.peak}** rulers on the Board at once.`);
    if (!lines.length) return null;
    return { content: '', embeds: [{ title: 'Today on the Board', description: lines.join('\n\n').slice(0, 4000), color: 0xe3b23c, footer: { text: 'Open World Chess · openworldchess.com' } }] };
  }

  /**
   * Cities worth showing (the daily City of the Day, tools/herald/showcase.mjs): real players'
   * settlements of 6+ buildings, best first (size, then what they've built to make it beautiful).
   */
  showcase() {
    const g = this.game, out: { name: string; owner: string; tier: number; buildings: number; decor: number; at: [number, number]; score: number }[] = [];
    for (const p of g.players.values()) {
      if (p.isBot || p.wild) continue;
      for (const st of g.chronicle.settlementsOf(p.id)) {
        if (st.buildings.length < 6) continue;
        const decor = g.world.buildingsNear(st.cx, st.cy, 16).filter((b) => b.owner === p.id && isDecor(b.type)).length;
        out.push({ name: townName(g.world.seed, st.id, st.cx, st.cy), owner: clean(p.name), tier: st.tier, buildings: st.buildings.length, decor, at: [st.cx, st.cy], score: st.buildings.length + decor * 0.4 });
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 30);
  }

  private async deliver(p: Post) {
    if (!this.hook) { console.log('[herald] (no webhook)', JSON.stringify(p).slice(0, 300)); return; }
    try {
      await fetch(this.hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'The Herald', ...p, allowed_mentions: { parse: [] } }) });
    } catch (e) { console.log('[herald] post failed', String(e).slice(0, 120)); }
  }
}

