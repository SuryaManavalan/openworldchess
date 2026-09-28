// The Chronicle (docs/specs/campaign.md): each player's place in the campaign,
// their quests, titles, Renown, relics and unlocks. Quests are data
// (packages/shared/src/chronicle.ts); this module keeps score from events the
// game already produces and hands out rewards.
import {
  CHAPTERS, FACTIONS, setWorth, RAIDERS, REACH, RELIC_OF, RELIC_NAME, RENOWN, TITLES, cheb, clusterSettlements,
  type Ability, type BuildingType, type ChronicleView, type PieceKind, type SettlementInfo, type SideQuest, type Step,
} from '@owc/shared';
import { biomeAt, RARE_BIOMES } from '@owc/worldgen';
import type { Game, PlayerRec } from './game.ts';

export interface ChronState {
  /** Current chapter (1–15); 16 is the Epilogue. */
  ch: number;
  step: number;
  /** Unused (kept so older saves load). */
  base: number;
  /** Tallies when the chapter began: "raise 3 pawns" counts from then, not from the dawn of time. */
  chBase?: Record<string, number>;
  tallies: Record<string, number>;
  title: number;
  renown: number;
  abilities: Ability[];
  buildings: BuildingType[];
  relics: string[];
  /** A building in the capital settlement (the capital is whatever settlement holds it). */
  capital?: number;
  sides: SideQuest[];
  nextSideAt: number;
  /** Active play time, in ms. */
  played: number;
  /** Played time when each chapter was completed. */
  doneAt: number[];
  discovered?: boolean;
  /** The first king from the first palace comes quickly (campaign.md §7). */
  firstKingDone?: boolean;
  marchBest?: number;
  nextSideId?: number;
}

/** Keys counted only since their chapter began (the rest count from whenever they happened). */
const SINCE_STEP = (k: string) => k === 'hunt' || k.startsWith('raise:');
const SIDE_EVERY_MS = 30 * 60_000;
const MAX_SIDES = 3;

const keyOf = (s: Step): string | null => {
  switch (s.verb) {
    case 'raise': return `raise:${s.kind}`;
    case 'hunt': return s.inRareLand ? 'hunt:rareland' : s.rare ? 'hunt:rare' : s.temper ? `hunt:${s.temper}` : s.minSize ? `hunt:${s.minSize}` : 'hunt';
    case 'free': return 'free';
    case 'link': return 'link';
    case 'win': return s.siege ? 'win:siege' : s.vsEmpire ? 'win:empire' : 'win';
    case 'promote': return 'promote';
    case 'crown': return 'crown';
    default: return null;
  }
};

export class Chronicle {
  game: Game;
  /** Settlements, recomputed every few seconds (cheap enough; used by the economy too). */
  settlements: SettlementInfo[] = [];
  private settlementOf = new Map<number, SettlementInfo>();
  private settledAt = 0;
  /** Drop anything cached for a player (their empire started over). */
  forget(id: string) { this.targets.delete(id); }

  /** Cached quest targets per player (so we don't search every tick). */
  private targets = new Map<string, { key: string; at?: [number, number]; until: number }>();
  /** Chapter completions to announce (the network layer sends the ceremony). */
  onChapter: (playerId: string, info: { n: number; name: string; opens: string; title?: string; coronation?: boolean }) => void = () => {};
  constructor(game: Game) { this.game = game; }

  get w() { return this.game.world; }

  // ---------- state ----------

  /** A player's Chronicle, created on first use (new players start at chapter 1; earlier players where their empire stands). */
  of(p: PlayerRec): ChronState {
    if (p.chron) return p.chron;
    // No Chronicle yet means the player existed before the campaign (new players get one
    // at creation): they keep every building they could already build, and start where
    // their empire stands.
    return this.begin(p, true);
  }

  begin(p: PlayerRec, legacy: boolean): ChronState {
    const st: ChronState = {
      ch: 1, step: 0, base: 0, tallies: {}, title: 0, renown: 0, abilities: [],
      buildings: legacy ? ['house', 'stable', 'temple', 'barracks', 'palace'] : ['house'],
      relics: [], sides: [], nextSideAt: SIDE_EVERY_MS, played: 0, doneAt: [],
    };
    p.chron = st;
    if (legacy) this.catchUp(p);
    return st;
  }

  /** Place an existing empire at the chapter its holdings match, granting everything before it. */
  private catchUp(p: PlayerRec) {
    const st = p.chron!;
    const mine = [...this.w.buildings.values()].filter((b) => b.owner === p.id && b.type !== 'ruin' && b.built >= 1);
    const setts = this.settlementsOf(p.id);
    const checks: (() => boolean)[] = [
      () => mine.some((b) => b.type === 'house'),
      () => mine.length >= 2,
      () => setts.some((s) => s.tier >= 2),
      () => setts.length >= 2,
      () => mine.some((b) => b.type === 'palace'),
    ];
    for (const ok of checks) {
      if (!ok()) break;
      this.complete(p, true);
    }
  }

  view(p: PlayerRec): ChronicleView {
    const st = this.of(p);
    const ch = CHAPTERS[st.ch - 1];
    const step = ch?.steps[st.step];
    return {
      chapter: st.ch, step: st.step, progress: step ? this.progress(p, step) : [0, 0],
      target: step ? this.targetOf(p, step) : undefined,
      title: st.title, renown: Math.round(st.renown), abilities: st.abilities, buildings: st.buildings,
      sides: st.sides, relics: st.relics, capital: this.capitalOf(p)?.buildings.length ? [this.capitalOf(p)!.cx, this.capitalOf(p)!.cy] : undefined,
      done: st.ch - 1,
    };
  }

  has(p: PlayerRec | undefined, a: Ability) { return !!p?.chron?.abilities.includes(a); }
  kingCap(p: PlayerRec) { return TITLES[this.of(p).title].kingCap; }
  popPerKing(p: PlayerRec) { return TITLES[this.of(p).title].popPerKing; }
  canBuild(p: PlayerRec, type: BuildingType): string | null {
    const st = this.of(p);
    if (st.buildings.includes(type)) return null;
    const ch = CHAPTERS.find((c) => c.reward.buildings?.includes(type) || (type === 'wonder' && c.reward.abilities?.includes('wonder')));
    return ch ? `Unlocks after chapter ${ch.n}: ${ch.name}` : 'Not available';
  }

  // ---------- settlements ----------

  refreshSettlements(now: number, force = false) {
    if (!force && now - this.settledAt < 4000) return;
    this.settledAt = now;
    this.settlements = clusterSettlements(this.w.buildings.values());
    this.settlementOf = new Map();
    for (const s of this.settlements) for (const b of s.buildings) this.settlementOf.set(b.id, s);
  }
  settlementOfBuilding(id: number) { return this.settlementOf.get(id); }
  settlementsOf(owner: string) { this.refreshSettlements(this.game.now); return this.settlements.filter((s) => s.owner === owner); }

  /** The capital: the settlement holding the chosen building (campaign.md §4.3). */
  capitalOf(p: PlayerRec): SettlementInfo | undefined {
    const id = p.chron?.capital;
    if (id == null) return undefined;
    const s = this.settlementOf.get(id);
    return s && s.owner === p.id ? s : undefined;
  }

  // ---------- events ----------

  /** Count an event toward quests (and side quests). */
  note(playerId: string | null | undefined, key: string, n = 1, extra?: { camp?: string }) {
    const p = playerId ? this.game.players.get(playerId) : undefined;
    if (!p || p.wild) return;
    const st = this.of(p);
    st.tallies[key] = (st.tallies[key] ?? 0) + n;
    // Side quests tied to a camp, or to a kind of event.
    for (const q of [...st.sides]) {
      const done = (q.kind === 'bounty' || q.kind === 'rescue') ? key === 'hunt' && extra?.camp === q.camp
        : q.kind === 'skirmish' ? key === 'win:empire' : false;
      if (done) this.finishSide(p, q);
    }
    this.advance(p);
  }

  addRenown(playerId: string, amount: number) {
    const p = this.game.players.get(playerId);
    if (!p || p.wild) return;
    this.of(p).renown += amount;
  }

  // ---------- progress ----------

  /** The piece the current step asks the player to raise, and how many are still needed. */
  wants(p: PlayerRec): { kind: PieceKind; left: number } | null {
    if (p.wild) return null;
    const st = p.chron;
    const s = st ? CHAPTERS[st.ch - 1]?.steps[st.step] : undefined;
    if (!s || s.verb !== 'raise') return null;
    const [have, need] = this.progress(p, s);
    return have < need ? { kind: s.kind, left: need - have } : null;
  }

  progress(p: PlayerRec, s: Step): [number, number] {
    const st = this.of(p);
    const key = keyOf(s);
    if (key) {
      const have = (st.tallies[key] ?? 0) - (SINCE_STEP(key) ? st.chBase?.[key] ?? 0 : 0);
      const need = 'count' in s ? s.count : 1;
      return [Math.min(need, Math.max(0, have)), need];
    }
    switch (s.verb) {
      case 'build': return [Math.min(s.count, [...this.w.buildings.values()].filter((b) => b.owner === p.id && b.type === s.type && b.built >= 1).length), s.count];
      case 'grow': return [this.settlementsOf(p.id).some((x) => x.tier >= s.tier) ? 1 : 0, 1];
      case 'march': return [(st.marchBest ?? 0) >= s.dist ? 1 : 0, 1];
      case 'discover': return [st.discovered ? 1 : 0, 1];
      case 'settle': {
        const ss = this.settlementsOf(p.id);
        if (s.eloAbove != null) {
          const home = this.w.elo(p.home[0], p.home[1]);
          return [ss.some((x) => this.w.elo(x.cx, x.cy) >= home + s.eloAbove!) ? 1 : 0, 1];
        }
        const far = ss.some((a) => ss.some((b) => a !== b && cheb(a.cx, a.cy, b.cx, b.cy) >= (s.minDist ?? 0)));
        return [far ? 1 : 0, 1];
      }
      default: return [0, 1];
    }
  }

  /** Move through finished steps (several at once when goals were done early). */
  advance(p: PlayerRec) {
    const st = this.of(p);
    for (let guard = 0; guard < 40; guard++) {
      const ch = CHAPTERS[st.ch - 1];
      if (!ch) return;
      const step = ch.steps[st.step];
      const [have, need] = this.progress(p, step);
      if (have < need) return;
      st.step++;
      this.targets.delete(p.id);
      if (st.step >= ch.steps.length) this.complete(p);
      else this.startStep(p);
    }
  }

  private startStep(p: PlayerRec) {
    const st = this.of(p);
    const step = CHAPTERS[st.ch - 1]?.steps[st.step];
    const key = step ? keyOf(step) : null;
    st.base = key && SINCE_STEP(key) ? st.tallies[key] ?? 0 : 0;
  }

  /** A chapter is done: its rewards, the ceremony, and the next chapter's gift. */
  complete(p: PlayerRec, quiet = false) {
    const st = this.of(p);
    const ch = CHAPTERS[st.ch - 1];
    if (!ch) return;
    const r = ch.reward;
    if (r.title != null) st.title = Math.max(st.title, r.title);
    for (const b of r.buildings ?? []) if (!st.buildings.includes(b)) st.buildings.push(b);
    for (const a of r.abilities ?? []) if (!st.abilities.includes(a)) st.abilities.push(a);
    if (includes(r.abilities, 'wonder') && !st.buildings.includes('wonder')) st.buildings.push('wonder');
    st.doneAt.push(st.played);
    if (!quiet) {
      for (const k of r.pieces ?? []) this.grantPiece(p, k);
      if (r.coronation) this.coronation(p);
      this.game.logEvent(p.id, 'chronicle', `Completed chapter ${ch.n}: ${ch.name}`);
      this.onChapter(p.id, { n: ch.n, name: ch.name, opens: ch.opens, title: r.title != null ? TITLES[r.title].name : undefined, coronation: r.coronation });
    }
    st.ch++;
    st.step = 0;
    st.chBase = { ...st.tallies };
    this.startStep(p);
    const next = CHAPTERS[st.ch - 1];
    if (next?.gift?.coronation && !quiet) this.coronation(p);
    this.game.onPlayers();
  }

  // ---------- rewards ----------

  /** A new king appears beside the Emperor (campaign.md §4.1), within the title's king cap. */
  coronation(p: PlayerRec): boolean {
    const g = this.game, w = this.w;
    const kings = g.kingsOf(p.id);
    if (kings.length >= this.kingCap(p)) { g.onAlert(p.id, { kind: 'info', text: 'A crown awaits, but your title allows no more kings yet' }); return false; }
    const near = (p.emperorId != null ? w.pieces.get(p.emperorId) : undefined) ?? kings[0];
    const at = near ? w.nearestFree(near.x + 1, near.y, 8) : w.nearestFree(p.home[0], p.home[1], 12);
    if (!at) return false;
    g.addPiece({ id: w.id(), owner: p.id, kind: 'K', x: at[0], y: at[1], facing: 2, state: 'idle', routine: 'born' });
    g.onAlert(p.id, { kind: 'info', text: 'A new king is crowned in your court', at });
    return true;
  }

  grantPiece(p: PlayerRec, kind: PieceKind, near?: [number, number]): boolean {
    const g = this.game, w = this.w;
    const k = g.kingsOf(p.id)[0];
    const [x, y] = near ?? (k ? [k.x, k.y] : p.home);
    const at = w.nearestFree(x, y + 1, 8);
    if (!at) return false;
    g.addPiece({ id: w.id(), owner: p.id, kind, x: at[0], y: at[1], facing: 2, state: 'idle', routine: 'born' });
    return true;
  }

  /** A camp is scattered (campaign.md §4.2): Renown, a relic from rare ones, the hunt counted. */
  onHunt(playerId: string, faction: string, size: number, campId: string, at: [number, number]) {
    const p = this.game.players.get(playerId);
    const f = FACTIONS[faction];
    if (!p || p.wild || !f) return;
    const st = this.of(p);
    st.renown += RENOWN[f.rarity] * (1 + size / 16);
    const rareLand = RARE_BIOMES.includes(biomeAt(this.w.seed, at[0], at[1]));
    this.note(p.id, 'hunt', 1, { camp: campId });
    this.note(p.id, `hunt:${f.temper}`);
    // Trophies for the great hunt (chapter 14): uncommon 1, rare 2, legendary 4.
    if (f.rarity !== 'common') this.note(p.id, 'hunt:rare', { uncommon: 1, rare: 2, legendary: 4 }[f.rarity]);
    if (rareLand) this.note(p.id, 'hunt:rareland');
    if (size >= 12) this.note(p.id, 'hunt:12');
    const relic = RELIC_OF[faction];
    if (relic && !st.relics.includes(relic)) {
      st.relics.push(relic);
      this.game.onAlert(p.id, { kind: 'info', text: `A relic: the ${RELIC_NAME[relic]} now stands in your capital` });
    }
  }

  /** Captives freed from a raider camp (campaign.md §4.2). */
  freeCaptives(playerId: string, faction: string, size: number, at: [number, number]): number {
    const p = this.game.players.get(playerId);
    if (!p || p.wild || !RAIDERS.has(faction)) return 0;
    const n = Math.min(4, 1 + Math.floor(size / 5));
    let freed = 0;
    for (let i = 0; i < n; i++) if (this.grantPiece(p, 'P', at)) freed++;
    if (size >= 10 && this.grantPiece(p, 'N', at)) freed++;
    if (freed) {
      this.game.onAlert(p.id, { kind: 'info', text: `${freed} captives freed. They join your ${TITLES[this.of(p).title].name.toLowerCase()}'s banner` });
      this.note(p.id, 'free', freed);
    }
    return freed;
  }

  // ---------- targets (map markers) ----------

  private targetOf(p: PlayerRec, s: Step): [number, number] | undefined {
    const key = JSON.stringify(s);
    const c = this.targets.get(p.id);
    if (c && c.key === key && c.until > this.game.now) return c.at;
    const at = this.findTarget(p, s);
    // Searches over the map (rare lands, rich lands, palace sites) are costly and their
    // answers don't move: keep them for 10 minutes. Camps and rivals move: 30 seconds.
    const slow = s.verb === 'discover' || s.verb === 'settle' || s.verb === 'build';
    this.targets.set(p.id, { key, at, until: this.game.now + (slow ? 600_000 : 30_000) });
    return at;
  }

  private findTarget(p: PlayerRec, s: Step): [number, number] | undefined {
    const g = this.game, w = this.w;
    const kings = g.kingsOf(p.id);
    if (!kings.length) return undefined;
    const from = kings[0];
    // Strength is material, not headcount: five pawns don't beat a camp with a rook and a queen.
    const worth = (ks: PieceKind[]) => setWorth(ks); // only a legal set takes the field
    const army = Math.max(...kings.map((k) => worth(w.piecesNear(k.x, k.y, REACH).filter((q) => q.owner === p.id).map((q) => q.kind))));
    const nearest = <T extends { x: number; y: number }>(xs: T[]) => xs.reduce<T | undefined>((a, b) => (!a || Math.min(...kings.map((k) => cheb(k.x, k.y, b.x, b.y))) < Math.min(...kings.map((k) => cheb(k.x, k.y, a.x, a.y))) ? b : a), undefined);
    if (s.verb === 'hunt' || s.verb === 'free') {
      const all = g.wilds.camps().map((c) => {
        const f = FACTIONS[c.wild!.faction];
        const ks = c.wild!.awake === false ? c.wild!.roster ?? ['K', 'P'] as PieceKind[] : g.wilds.piecesOf(c).map((q) => q.kind);
        return { x: c.wild!.x, y: c.wild!.y, f, size: ks.length, might: worth(ks) };
      });
      const plain = s.verb === 'hunt' && !s.temper && !s.rare && !s.minSize && !s.inRareLand;
      const camps = all.filter(({ f, size, might, x, y }) => {
        if (s.verb === 'free') return RAIDERS.has(f.id);
        if (s.temper && f.temper !== s.temper) return false;
        if (s.rare && f.rarity === 'common') return false;
        if (s.minSize && size < s.minSize) return false;
        if (s.inRareLand && !RARE_BIOMES.includes(biomeAt(w.seed, x, y))) return false;
        // Plain hunts point at something the player's army can beat.
        if (!s.temper && !s.rare && !s.minSize && !s.inRareLand && might > army) return false;
        return Math.min(...kings.map((k) => cheb(k.x, k.y, x, y))) <= 600;
      });
      const c = nearest(camps);
      if (c) return [c.x + 1, c.y + 1];
      if (!plain) return undefined;
      // Nothing beatable in reach: the Chronicle raises a young band near the strongest king,
      // or failing that marks the weakest camp in range.
      const lead = kings.reduce((a, k) => (worth(w.piecesNear(k.x, k.y, REACH).filter((q) => q.owner === p.id).map((q) => q.kind)) > worth(w.piecesNear(a.x, a.y, REACH).filter((q) => q.owner === p.id).map((q) => q.kind)) ? k : a));
      const q = g.wilds.enabled ? g.wilds.quarry(p.id, [lead.x, lead.y], army, g.now) : null;
      if (q) return [q.wild!.x + 1, q.wild!.y + 1];
      const weak = all.filter((x) => Math.min(...kings.map((k) => cheb(k.x, k.y, x.x, x.y))) <= 600).sort((a, b) => a.might - b.might)[0];
      return weak ? [weak.x + 1, weak.y + 1] : undefined;
    }
    if (s.verb === 'build' && s.type === 'palace') {
      // The nearest spot with ore and rock close together.
      for (let r = 20; r <= 200; r += 30) {
        const ores = w.nodesNear(from.x, from.y, 1, r).filter((n) => n.kind === 'ore' && n.remaining > 0);
        const site = ores.find((o) => w.nodesNear(o.x, o.y, 1, 5).some((n) => n.kind === 'rock' && n.remaining > 0));
        if (site) return [site.x, site.y];
      }
      return undefined;
    }
    if (s.verb === 'discover') return this.searchRing(from.x, from.y, 1600, 24, (x, y) => RARE_BIOMES.includes(biomeAt(w.seed, x, y)));
    if (s.verb === 'settle' && s.eloAbove != null) {
      const need = w.elo(p.home[0], p.home[1]) + s.eloAbove;
      return this.searchRing(from.x, from.y, 4000, 60, (x, y) => w.elo(x, y) >= need && w.buildable(x, y));
    }
    if (s.verb === 'win') {
      const rivals = [...w.pieces.values()].filter((k) => k.kind === 'K' && k.owner && k.owner !== p.id && !k.emperor && !g.players.get(k.owner)?.wild && (g.players.get(k.owner)?.shieldUntil ?? 0) < g.now);
      const t = nearest(rivals.filter((k) => cheb(k.x, k.y, from.x, from.y) <= 800));
      return t ? [t.x, t.y] : undefined;
    }
    if (s.verb === 'grow') {
      const best = this.settlementsOf(p.id).sort((a, b) => b.buildings.length - a.buildings.length)[0];
      return best ? [best.cx, best.cy] : undefined;
    }
    return undefined;
  }

  /** Nearest square (in widening rings) where `ok` holds. */
  private searchRing(x0: number, y0: number, maxR: number, step: number, ok: (x: number, y: number) => boolean): [number, number] | undefined {
    for (let r = step; r <= maxR; r += step) {
      const n = Math.max(8, Math.round((2 * Math.PI * r) / step));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = Math.round(x0 + Math.cos(a) * r), y = Math.round(y0 + Math.sin(a) * r);
        if (ok(x, y)) return [x, y];
      }
    }
    return undefined;
  }

  // ---------- the tick ----------

  /** Every few seconds: time played, state-based goals, side quests. */
  tick(now: number, dt: number) {
    this.refreshSettlements(now);
    for (const p of this.game.players.values()) {
      if (p.wild) continue;
      const st = this.of(p);
      // Game time (a sped-up server, like the balance simulation, plays faster).
      if (p.online) { st.played += dt * this.game.speed; }
      const kings = this.game.kingsOf(p.id);
      // Farthest a king has marched from home.
      for (const k of kings) { const d = cheb(k.x, k.y, p.home[0], p.home[1]); if (d > (st.marchBest ?? 0)) st.marchBest = d; }
      // Rare lands seen: any of your kings within 12 squares of one.
      if (!st.discovered && p.online)
        for (const k of kings) {
          for (const [dx, dy] of [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12], [8, 8], [-8, 8], [8, -8], [-8, -8]])
            if (RARE_BIOMES.includes(biomeAt(this.w.seed, k.x + dx, k.y + dy))) { st.discovered = true; break; }
          if (st.discovered) break;
        }
      // Scout side quests complete by getting there.
      for (const q of [...st.sides]) {
        if (q.kind === 'scout' && q.at && kings.some((k) => cheb(k.x, k.y, q.at![0], q.at![1]) <= 8)) this.finishSide(p, q);
        if (q.kind === 'grow' && q.tier && this.settlementsOf(p.id).some((s) => s.tier >= q.tier!)) this.finishSide(p, q);
        // A bounty whose camp is gone (someone else cleared it) quietly expires.
        if ((q.kind === 'bounty' || q.kind === 'rescue') && q.camp && !this.game.players.has(q.camp)) st.sides = st.sides.filter((x) => x !== q);
      }
      if (p.online && st.played >= st.nextSideAt && st.sides.length < MAX_SIDES && st.ch >= 2) {
        st.nextSideAt = st.played + SIDE_EVERY_MS;
        this.writeSide(p);
      }
      this.advance(p);
    }
  }

  // ---------- side quests ----------

  private writeSide(p: PlayerRec) {
    const g = this.game, w = this.w, st = this.of(p);
    const kings = g.kingsOf(p.id);
    if (!kings.length) return;
    const from = kings[0];
    // Strength is material, not headcount: five pawns don't beat a camp with a rook and a queen.
    const worth = (ks: PieceKind[]) => setWorth(ks); // only a legal set takes the field
    const army = Math.max(...kings.map((k) => worth(w.piecesNear(k.x, k.y, REACH).filter((q) => q.owner === p.id).map((q) => q.kind))));
    const id = (st.nextSideId = (st.nextSideId ?? 0) + 1);
    const last = st.sides.at(-1)?.kind;
    const camps = g.wilds.camps().map((c) => ({ c, f: FACTIONS[c.wild!.faction], size: c.wild!.awake === false ? c.wild!.roster?.length ?? 2 : g.wilds.piecesOf(c).length }))
      .filter(({ c }) => !st.sides.some((q) => q.camp === c.id) && cheb(c.wild!.x, c.wild!.y, from.x, from.y) <= 200)
      .sort((a, b) => cheb(a.c.wild!.x, a.c.wild!.y, from.x, from.y) - cheb(b.c.wild!.x, b.c.wild!.y, from.x, from.y));
    const makers: (() => SideQuest | null)[] = [
      () => { const t = camps.find(({ f, size }) => RAIDERS.has(f.id) && size <= army + 2); return t ? { id, kind: 'rescue', camp: t.c.id, at: [t.c.wild!.x + 1, t.c.wild!.y + 1], line: `The ${t.f.name} hold prisoners. Free them.`, renown: 40, pieces: ['P'] } : null; },
      () => { const t = camps.find(({ size }) => size <= army + 2); return t ? { id, kind: 'bounty', camp: t.c.id, at: [t.c.wild!.x + 1, t.c.wild!.y + 1], line: `A bounty on the ${t.f.name} (${t.f.camp}).`, renown: Math.round(RENOWN[t.f.rarity] * 1.5) } : null; },
      () => { const at = this.searchRing(from.x, from.y, 500, 30, (x, y) => RARE_BIOMES.includes(biomeAt(w.seed, x, y))); return at && !st.discovered ? { id, kind: 'scout', at, line: 'Travelers speak of a strange land nearby. See it for yourself.', renown: 50 } : null; },
      () => { const s = this.settlementsOf(p.id).find((x) => x.tier < 4 && [3, 6, 10].includes(x.buildings.length + 1)); return s ? { id, kind: 'grow', at: [s.cx, s.cy], tier: s.tier + 1, line: 'One more building and this settlement rises a tier.', renown: 30, pieces: ['N'] } : null; },
      () => { const rival = [...w.pieces.values()].find((k) => k.kind === 'K' && k.owner && k.owner !== p.id && !k.emperor && !g.players.get(k.owner)?.wild && cheb(k.x, k.y, from.x, from.y) <= 200 && (g.players.get(k.owner)?.shieldUntil ?? 0) < g.now); return rival ? { id, kind: 'skirmish', at: [rival.x, rival.y], line: `${g.players.get(rival.owner!)?.name ?? 'A rival'} has troops nearby. Win a battle against an empire.`, renown: RENOWN.empireWin * 2 } : null; },
    ];
    // Rotate: don't repeat the last kind.
    const order = makers.map((m, i) => ({ m, i })).sort((a, b) => ((a.i + id) % makers.length) - ((b.i + id) % makers.length));
    for (const { m } of order) {
      const q = m();
      if (q && q.kind !== last) { st.sides.push(q); this.game.onAlert(p.id, { kind: 'info', text: `New quest: ${q.line}`, at: q.at }); return; }
    }
  }

  private finishSide(p: PlayerRec, q: SideQuest) {
    const st = this.of(p);
    st.sides = st.sides.filter((x) => x.id !== q.id);
    st.renown += q.renown;
    for (const k of q.pieces ?? []) this.grantPiece(p, k, q.at);
    this.game.onAlert(p.id, { kind: 'info', text: `Quest complete: +${q.renown} Renown${q.pieces?.length ? ` and a ${q.pieces.join(', ') === 'N' ? 'knight' : 'pawn'}` : ''}` });
  }

  decline(p: PlayerRec, id: number) {
    const st = this.of(p);
    st.sides = st.sides.filter((q) => q.id !== id);
  }

  /** Name a capital (campaign.md §4.3): any of your buildings marks its settlement. */
  setCapital(p: PlayerRec, buildingId: number): string | null {
    if (!this.has(p, 'capital')) return 'Capitals open in chapter 11';
    const b = this.w.buildings.get(buildingId);
    if (!b || b.owner !== p.id) return 'Pick one of your towns';
    this.of(p).capital = buildingId;
    this.game.onAlert(p.id, { kind: 'info', text: 'This town is now your capital' });
    return null;
  }

  /** Production multiplier for a building from relics, trade, the Wonder (campaign.md §4). */
  bonus(b: { id: number; owner: string | null }): number {
    const p = b.owner ? this.game.players.get(b.owner) : undefined;
    if (!p?.chron) return 1;
    const s = this.settlementOf.get(b.id);
    if (!s) return 1;
    let m = 1;
    const cap = this.capitalOf(p) ?? this.settlementsOf(p.id).sort((a, c) => c.buildings.length - a.buildings.length)[0];
    if (cap && cap.id === s.id) m += Math.min(0.5, 0.1 * p.chron.relics.length);
    if (s.buildings.some((x) => x.type === 'wonder' && x.built >= 1)) m += 0.25;
    if (this.has(p, 'trade')) m += Math.min(0.3, 0.15 * this.game.tradeLinks(s.id));
    return m;
  }
}

function includes(list: Ability[] | undefined, a: Ability) { return !!list?.includes(a); }
