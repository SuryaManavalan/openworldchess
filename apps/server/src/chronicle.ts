// The Chronicle (docs/specs/campaign.md): each player's place in the campaign,
// their quests, titles, Renown, relics and unlocks. Quests are data
// (packages/shared/src/chronicle.ts); this module keeps score from events the
// game already produces and hands out rewards.
import {
  CHAPTERS, FACTIONS, PIECE_NAME, key, setWorth, RAIDERS, REACH, RELIC_OF, RELIC_NAME, RENOWN, TITLES, cheb, clusterSettlements,
  type Ability, type BuildingType, type ChronicleView, type PieceKind, type SettlementInfo, type SideQuest, type Step,
} from '@owc/shared';
import { biomeAt, RARE_BIOMES, resourcesInRect } from '@owc/worldgen';
import type { Game, PlayerRec } from './game.ts';
import { perf } from './perf.ts';

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
  /** Declined or dropped quests, offered again later (played time when they come back). */
  shelved?: { q: SideQuest; back: number }[];
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
/** A new side quest is offered every so often while you play (campaign.md §5.3). */
const SIDE_FIRST_MS = 10 * 60_000;
const SIDE_EVERY_MS = 12 * 60_000;
/** Quests you can hold at once, and offers waiting for an answer. */
const MAX_SIDES = 4;
const MAX_OFFERS = 2;
/** A declined quest comes back as an offer after this much play. */
const SHELF_MS = 20 * 60_000;
const active = (q: SideQuest) => q.state !== 'offered';
const PILGRIM_ALTAR = 'A pilgrimage, 2 of 3: build an Altar in the clearing. Bring a bishop there, then choose Altar from the build menu (or select the bishop and tap Raise altar).';

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
      relics: [], sides: [], nextSideAt: SIDE_FIRST_MS, played: 0, doneAt: [],
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
    const progress = step ? perf.time('view.progress', () => this.progress(p, step)) : [0, 0] as [number, number];
    // Only read the marker here (views go out on every reconnect and every 2.5s): a missing
    // or stale one is worked out in the tick, within a time budget (performance.md).
    const target = step ? this.peekTarget(p, step) : undefined;
    const cap = perf.time('view.capital', () => this.capitalOf(p));
    return {
      chapter: st.ch, step: st.step, progress, target,
      title: st.title, renown: Math.round(st.renown), abilities: st.abilities, buildings: st.buildings,
      sides: st.sides, relics: st.relics, capital: cap?.buildings.length ? [cap.cx, cap.cy] : undefined,
      done: st.ch - 1,
    };
  }

  has(p: PlayerRec | undefined, a: Ability) { return !!p?.chron?.abilities.includes(a); }
  kingCap(p: PlayerRec) { return TITLES[this.of(p).title].kingCap; }
  popPerKing(p: PlayerRec) { return TITLES[this.of(p).title].popPerKing; }
  canBuild(p: PlayerRec, type: BuildingType): string | null {
    // Altars open with temples: a bishop is needed to raise one anyway (economy.md §8).
    if (type === 'altar') return this.canBuild(p, 'temple') ? 'Altars open with temples' : null;
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
    for (const q of st.sides.filter(active)) {
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

  /** Players whose quest marker needs working out (done in the tick, within a budget). */
  private wantTarget = new Set<string>();
  /** The cached marker for this step (even if due for a refresh), queuing a refresh if needed. */
  private peekTarget(p: PlayerRec, s: Step): [number, number] | undefined {
    // Tests and simulations (no live viewers) work it out now, deterministically.
    if (!this.game.viewed) return this.targetOf(p, s);
    const c = this.targets.get(p.id), key = JSON.stringify(s);
    if (!c || c.key !== key || c.until <= this.game.now) this.wantTarget.add(p.id);
    return c && c.key === key ? c.at : undefined;
  }
  /** Work out queued markers, up to `ms` of time. */
  private refreshTargets(ms: number) {
    const end = performance.now() + ms;
    for (const id of [...this.wantTarget]) {
      if (performance.now() > end) break;
      this.wantTarget.delete(id);
      const p = this.game.players.get(id);
      const st = p?.chron, step = st ? CHAPTERS[st.ch - 1]?.steps[st.step] : undefined;
      if (p && step) perf.time(`chronicle.target.${step.verb}${step.verb === 'build' ? '.' + step.type : ''}`, () => this.targetOf(p, step));
    }
  }

  private targetOf(p: PlayerRec, s: Step): [number, number] | undefined {
    const key = JSON.stringify(s);
    const c = this.targets.get(p.id);
    if (c && c.key === key && c.until > this.game.now) return c.at;
    // Searches over the map (rare lands, rich lands, palace sites) are costly and their
    // answers don't move: keep them for 10 minutes. Camps and rivals move: 30 seconds.
    const slow = s.verb === 'discover' || s.verb === 'settle' || s.verb === 'build';
    // At most two map-wide searches a second (after a restart everyone needs one at once):
    // the rest keep their last marker, or get one a moment later (views are re-sent every 2.5s).
    if (slow) {
      const sec = Math.floor(this.game.now / 1000);
      if (sec !== this.searchSec) { this.searchSec = sec; this.searches = 0; }
      if (this.searches >= 2) return c?.key === key ? c.at : undefined;
      this.searches++;
    }
    this.ringPending = false;
    const at = this.findTarget(p, s);
    // A ring search that ran out of time: no answer yet, keep working on it next tick.
    if (this.ringPending) { this.wantTarget.add(p.id); return c?.key === key ? c.at : undefined; }
    this.targets.set(p.id, { key, at, until: this.game.now + (slow ? 600_000 : 30_000) });
    return at;
  }

  private searchSec = 0;
  private searches = 0;

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
    if (s.verb === 'build' && s.type === 'palace') return this.palaceSite(p, from.x, from.y);
    if (s.verb === 'discover') return this.searchRing(from.x, from.y, 1600, 24, (x, y) => RARE_BIOMES.includes(biomeAt(w.seed, x, y)), `discover:${p.id}`);
    if (s.verb === 'settle' && s.eloAbove != null) {
      const need = w.elo(p.home[0], p.home[1]) + s.eloAbove;
      return this.searchRing(from.x, from.y, 4000, 60, (x, y) => w.elo(x, y) >= need && w.buildable(x, y), `settle:${p.id}:${need}`);
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

  /** 40-square tiles within 200 squares, nearest first (the palace-site search walks them in order). */
  private static TILES = (() => {
    const t: [number, number][] = [];
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) t.push([dx, dy]);
    return t.sort((a, b) => Math.max(Math.abs(a[0]), Math.abs(a[1])) - Math.max(Math.abs(b[0]), Math.abs(b[1])) || Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
  })();
  private palaceTiles = new Map<string, number>();

  /**
   * The nearest spot with ore and rock close together (a palace site), searched
   * tile by tile in the generated map, without loading those chunks into the
   * world. On the live server it works 12ms a call and resumes where it left off.
   */
  private palaceSite(p: PlayerRec, x0: number, y0: number): [number, number] | undefined {
    const w = this.w, live = !!this.game.viewed, end = live ? performance.now() + 12 : Infinity;
    const slot = `${p.id}:${x0},${y0}`, T = 40;
    for (let i = live ? this.palaceTiles.get(slot) ?? 0 : 0; i < Chronicle.TILES.length; i++) {
      if (performance.now() > end) { this.palaceTiles.set(slot, i); this.ringPending = true; return undefined; }
      const [dx, dy] = Chronicle.TILES[i], tx = x0 + dx * T - T / 2, ty = y0 + dy * T - T / 2;
      for (const o of resourcesInRect(w.seed, tx, ty, tx + T, ty + T, ['ore'])) {
        // Mined out? (The overlay holds changed nodes; reading it loads no chunks.)
        const mined = w.nodeOverlay.get(key(o.x, o.y));
        if (mined && (mined.remaining <= 0 || mined.gone)) continue;
        if (resourcesInRect(w.seed, o.x - 5, o.y - 5, o.x + 6, o.y + 6, ['rock']).length) { this.palaceTiles.delete(slot); return [o.x, o.y]; }
      }
    }
    this.palaceTiles.delete(slot);
    return undefined;
  }

  /** Resumable ring searches, keyed by what's being searched (performance.md). */
  private rings = new Map<string, { r: number; i: number }>();
  /** Set when a ring search ran out of time this call: the answer isn't known yet. */
  private ringPending = false;

  /**
   * Nearest square (in widening rings) where `ok` holds. On the live server a
   * search works for at most 12ms a call and picks up where it left off next
   * time (a map-wide search can sample thousands of squares).
   */
  private searchRing(x0: number, y0: number, maxR: number, step: number, ok: (x: number, y: number) => boolean, key?: string): [number, number] | undefined {
    const live = !!this.game.viewed && key != null;
    const end = live ? performance.now() + 12 : Infinity;
    const k = `${key}:${x0},${y0}`, st = live ? this.rings.get(k) ?? { r: step, i: 0 } : { r: step, i: 0 };
    for (; st.r <= maxR; st.r += step, st.i = 0) {
      const n = Math.max(8, Math.round((2 * Math.PI * st.r) / step));
      for (; st.i < n; st.i++) {
        if ((st.i & 31) === 31 && performance.now() > end) { this.rings.set(k, st); this.ringPending = true; return undefined; }
        const a = (st.i / n) * Math.PI * 2, x = Math.round(x0 + Math.cos(a) * st.r), y = Math.round(y0 + Math.sin(a) * st.r);
        if (ok(x, y)) { this.rings.delete(k); return [x, y]; }
      }
    }
    this.rings.delete(k);
    return undefined;
  }

  // ---------- the tick ----------

  /** Every few seconds: time played, state-based goals, side quests. */
  tick(now: number, dt: number) {
    this.refreshSettlements(now);
    this.refreshTargets(25);
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
      for (const q of st.sides) {
        // A bounty whose camp is gone (someone else cleared it) quietly expires, offered or not.
        if ((q.kind === 'bounty' || q.kind === 'rescue') && q.camp && !this.game.players.has(q.camp)) { st.sides = st.sides.filter((x) => x !== q); continue; }
        if (!active(q)) continue;
        if (q.kind === 'scout' && q.at && kings.some((k) => cheb(k.x, k.y, q.at![0], q.at![1]) <= 8)) this.finishSide(p, q);
        if (q.kind === 'grow' && q.tier && this.settlementsOf(p.id).some((s) => s.tier >= q.tier!)) this.finishSide(p, q);
        if (q.kind === 'pilgrimage' && this.pilgrimageStep(p, q)) this.finishSide(p, q);
      }
      if (p.online && st.played >= st.nextSideAt && st.sides.filter(active).length < MAX_SIDES && st.sides.filter((q) => !active(q)).length < MAX_OFFERS && st.ch >= 2) {
        st.nextSideAt = st.played + SIDE_EVERY_MS;
        this.offerSide(p);
      }
      this.advance(p);
    }
  }

  // ---------- side quests ----------

  /** Offer a quest: one you declined a while ago, if it still makes sense, or a new one. */
  private offerSide(p: PlayerRec) {
    const st = this.of(p);
    const back = (st.shelved ?? []).find((s) => st.played >= s.back && (!s.q.camp || this.game.players.has(s.q.camp)));
    if (back) {
      st.shelved = st.shelved!.filter((s) => s !== back);
      const q: SideQuest = { ...back.q, state: 'offered' };
      st.sides.push(q);
      this.game.onAlert(p.id, { kind: 'info', text: `A quest is offered again: ${q.line}`, at: q.at });
      return;
    }
    this.writeSide(p);
  }

  /** Take up an offered quest (campaign.md §5.3). */
  accept(p: PlayerRec, id: number): string | null {
    const st = this.of(p);
    const q = st.sides.find((x) => x.id === id);
    if (!q) return 'That quest is gone';
    if (active(q)) return null;
    if (st.sides.filter(active).length >= MAX_SIDES) return `You can hold ${MAX_SIDES} quests at once: finish or drop one first`;
    q.state = 'active';
    this.advance(p);
    return null;
  }

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
      () => this.pilgrimage(p, id),
      () => { const rival = [...w.pieces.values()].find((k) => k.kind === 'K' && k.owner && k.owner !== p.id && !k.emperor && !g.players.get(k.owner)?.wild && cheb(k.x, k.y, from.x, from.y) <= 200 && (g.players.get(k.owner)?.shieldUntil ?? 0) < g.now); return rival ? { id, kind: 'skirmish', at: [rival.x, rival.y], line: `${g.players.get(rival.owner!)?.name ?? 'A rival'} has troops nearby. Win a battle against an empire.`, renown: RENOWN.empireWin * 2 } : null; },
    ];
    // Rotate: don't repeat the last kind.
    const order = makers.map((m, i) => ({ m, i })).sort((a, b) => ((a.i + id) % makers.length) - ((b.i + id) % makers.length));
    for (const { m } of order) {
      const q = m();
      if (q && q.kind !== last) { q.state = 'offered'; st.sides.push(q); this.game.onAlert(p.id, { kind: 'info', text: `A quest is offered: ${q.line}`, at: q.at }); return; }
    }
  }

  /**
   * The pilgrimage (campaign.md §5.3): a chain of three. Clear a grove some way out from your
   * town with elephants, raise an altar in the clearing with a bishop, then have knights pave
   * a road from the altar home. It teaches what those pieces do outside battle.
   */
  private pilgrimage(p: PlayerRec, id: number): SideQuest | null {
    const st = this.of(p), w = this.w;
    if (!st.buildings.includes('temple') || st.sides.some((q) => q.kind === 'pilgrimage') || (st.shelved ?? []).some((s) => s.q.kind === 'pilgrimage')) return null;
    const home = this.capitalOf(p) ?? this.settlementsOf(p.id).sort((a, b) => b.buildings.length - a.buildings.length)[0];
    if (!home) return null;
    // The woodiest 10×10 patch on a ring 30–45 squares out, away from other empires.
    let best: { x: number; y: number; n: number } | null = null;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = 30 + (i % 3) * 7;
      const x = Math.round(home.cx + Math.cos(a) * r) - 5, y = Math.round(home.cy + Math.sin(a) * r) - 5;
      if (w.buildingsNear(x + 5, y + 5, 20).some((b) => b.owner && b.owner !== p.id)) continue;
      const n = w.nodesNear(x, y, 10, 0).filter((q) => q.kind === 'tree' && q.remaining > 0 && !q.hoard).length;
      if (n >= 10 && (!best || n > best.n)) best = { x, y, n };
    }
    if (!best) return null;
    return {
      id, kind: 'pilgrimage', stage: 0, stages: 3, area: [best.x, best.y, best.x + 9, best.y + 9], trees: best.n, progress: [0, best.n],
      at: [best.x + 5, best.y + 5], line: 'A pilgrimage, 1 of 3: an old grove hides a holy place. Clear its trees with elephants.', renown: 150, pieces: ['B'],
    };
  }

  /** Move a pilgrimage along its stages; true when it's done. */
  private pilgrimageStep(p: PlayerRec, q: SideQuest): boolean {
    const w = this.w, [x0, y0, x1, y1] = q.area!;
    if (q.stage === 0) {
      const left = w.nodesNear(x0, y0, 10, 0).filter((n) => n.kind === 'tree' && n.remaining > 0 && !n.hoard && n.x <= x1 && n.y <= y1).length;
      q.progress = [Math.max(0, q.trees! - left), q.trees!];
      if (left <= Math.floor(q.trees! * 0.2)) {
        q.stage = 1; q.progress = undefined;
        q.line = PILGRIM_ALTAR;
        this.game.onAlert(p.id, { kind: 'info', text: 'The grove is cleared. Now raise an altar there', at: q.at });
      }
      return false;
    }
    const altar = w.buildingsNear(x0 + 5, y0 + 5, 9).find((b) => b.owner === p.id && b.type === 'altar' && b.built >= 1);
    if (q.stage === 1) {
      if (q.line !== PILGRIM_ALTAR) q.line = PILGRIM_ALTAR; // quests offered before the wording changed
      if (!altar) return false;
      q.stage = 2; q.at = [altar.x, altar.y];
      q.line = 'A pilgrimage, 3 of 3: pave a road with knights from the altar to your town.';
      this.game.onAlert(p.id, { kind: 'info', text: 'The altar stands. Now pave a road home to it', at: q.at });
      return false;
    }
    // Stage 3: paved squares link the altar to one of your settlements.
    return !!altar && this.roadHome(p, altar.x, altar.y);
  }

  /** Is there a paved road from beside (x, y) to within reach of one of your towns? */
  private roadHome(p: PlayerRec, x: number, y: number): boolean {
    const w = this.w, towns = this.settlementsOf(p.id).filter((s) => s.buildings.length >= 2);
    const seen = new Set<number>(), queue: [number, number][] = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (w.paved(x + dx, y + dy)) { queue.push([x + dx, y + dy]); seen.add((x + dx) * 134217728 + y + dy); }
    while (queue.length && seen.size < 4000) {
      const [cx, cy] = queue.shift()!;
      if (cheb(cx, cy, x, y) > 8 && towns.some((s) => cheb(s.cx, s.cy, cx, cy) <= REACH)) return true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy, k = nx * 134217728 + ny;
        if (!seen.has(k) && w.paved(nx, ny)) { seen.add(k); queue.push([nx, ny]); }
      }
    }
    return false;
  }

  private finishSide(p: PlayerRec, q: SideQuest) {
    const st = this.of(p);
    st.sides = st.sides.filter((x) => x.id !== q.id);
    st.renown += q.renown;
    for (const k of q.pieces ?? []) this.grantPiece(p, k, q.at);
    this.game.onAlert(p.id, { kind: 'info', text: `Quest complete: +${q.renown} Renown${q.pieces?.length ? ` and ${q.pieces.map((k) => `a ${PIECE_NAME[k].toLowerCase()}`).join(', ')}` : ''}` });
  }

  /** Decline an offer or drop a quest: it's shelved, and offered again later (never lost for good). */
  decline(p: PlayerRec, id: number) {
    const st = this.of(p);
    const q = st.sides.find((x) => x.id === id);
    if (!q) return;
    st.sides = st.sides.filter((x) => x !== q);
    st.shelved = [...(st.shelved ?? []), { q: { ...q, state: undefined }, back: st.played + SHELF_MS }].slice(-6);
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
