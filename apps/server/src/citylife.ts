// City life (docs/specs/citylife.md): what keeps a big town from becoming a crowd. Pieces live in
// buildings, go home at night and come out at dawn; by day a town keeps only so many outdoors
// (a few on shift at each working building), and when it's still over-full, the surplus goes
// on pilgrimage to the player's altars or other towns, as an automatic troop that comes home.
// All of it is idle life: any order, battle or work takes a piece straight out of it.
import { HOMES, OUTDOORS_BASE, OUTDOORS_PER_BUILDING, PILGRIMS_MAX, cheb, distToRect, isDecor, sunAt, type Building, type Piece } from '@owc/shared';
import { hash01 } from '@owc/worldgen';
import type { Game } from './game.ts';

/** A town's numbers, refreshed every few turns (and kept current as pieces come and go). */
export interface Town {
  id: number; owner: string; cx: number; cy: number; r: number;
  buildings: Building[];
  /** Idle pieces outdoors now, and how many the town keeps outdoors by day. */
  outdoors: number; quota: number;
  /** Residents per building. */
  inside: Map<number, number>;
  /** Pawns on shift: this share of the town's pawns works the supply runs. */
  workShare: number;
  at: number;
}

const REFRESH_TURNS = 10;

export class CityLife {
  private game: Game;
  constructor(game: Game) { this.game = game; }
  private towns = new Map<number, Town>();
  private byOwner = new Map<string, { at: number; ids: number[] }>();
  private lastPilgrims = new Map<number, number>();

  /** Night: nearly everyone goes home (a little past dusk, until a little after dawn). */
  night() { return sunAt(this.game.now) < -0.15; }

  /** The town a piece is in (or undefined, out in the field). */
  townOf(p: Piece): Town | undefined {
    if (!p.owner) return undefined;
    const g = this.game;
    // (Remembered a few turns per piece: towns don't move, and this runs for every idle piece.)
    const c = this.seen.get(p.id);
    if (c && g.turn - c.at < REFRESH_TURNS && (c.t == null || this.towns.get(c.t.id) === c.t)) return c.t ?? undefined;
    let o = this.byOwner.get(p.owner);
    if (!o || g.turn - o.at >= REFRESH_TURNS) {
      const ss = g.chronicle.settlementsOf(p.owner);
      o = { at: g.turn, ids: ss.map((s) => s.id) };
      this.byOwner.set(p.owner, o);
      for (const s of ss) {
        const t = this.towns.get(s.id);
        if (!t || g.turn - t.at >= REFRESH_TURNS) this.towns.set(s.id, this.measure(s.id, p.owner, s.buildings, s.cx, s.cy));
      }
    }
    let best: Town | undefined, bd = Infinity;
    for (const id of o.ids) {
      const t = this.towns.get(id);
      if (!t) continue;
      const d = cheb(p.x, p.y, t.cx, t.cy);
      if (d <= t.r && d < bd) { best = t; bd = d; }
    }
    this.seen.set(p.id, { at: g.turn, t: best ?? null });
    if (this.seen.size > 20000) this.seen.clear();
    return best;
  }
  private seen = new Map<number, { at: number; t: Town | null }>();

  private measure(id: number, owner: string, all: Building[], cx: number, cy: number): Town {
    const g = this.game, w = g.world;
    const buildings = all.filter((b) => b.type !== 'ruin' && !isDecor(b.type));
    const r = Math.max(8, ...buildings.map((b) => cheb(b.x, b.y, cx, cy) + 6));
    const inside = new Map<number, number>();
    let outdoors = 0, pawns = 0;
    for (const q of w.piecesNear(cx, cy, r)) {
      if (q.owner !== owner) continue;
      if (q.inside != null) { inside.set(q.inside, (inside.get(q.inside) ?? 0) + 1); continue; }
      if (this.idleHere(q)) { outdoors++; if (q.kind === 'P') pawns++; }
    }
    const working = buildings.filter((b) => b.drawsFrom?.length && b.built >= 1).length;
    return {
      id, owner, cx, cy, r, buildings, outdoors, inside, at: g.turn,
      quota: Math.round(OUTDOORS_BASE + OUTDOORS_PER_BUILDING * buildings.length),
      workShare: pawns ? Math.min(1, (2 * working) / pawns) : 1,
    };
  }

  /** An idle piece living its town life (not marching, working, trading, tending or posted). */
  idleHere(q: Piece) {
    return q.state === 'idle' && !q.groupId && !q.posted && !this.game.works.busy(q.id)
      && !(q.routine?.startsWith('merchant') || q.routine === 'trade' || q.routine === 'tend' || q.routine === 'watch');
  }

  /** On shift: this pawn works the supply runs (a stable share of the town's pawns, by id). */
  onShift(p: Piece, t: Town) { return p.kind === 'P' && hash01(this.game.world.seed, p.id, 5, 81) < t.workShare; }

  /** A building with room for this piece: its kind's home, or a tavern; nearest first. */
  homeFor(p: Piece, t: Town): Building | undefined {
    let best: Building | undefined, bd = Infinity;
    // At night they squeeze in to sleep: twice as many to a building.
    const squeeze = this.night() ? 2 : 1;
    for (const b of t.buildings) {
      const h = HOMES[b.type];
      if (!h || !h.kinds.includes(p.kind) || b.built < 1 || (t.inside.get(b.id) ?? 0) >= h.n * squeeze) continue;
      const d = distToRect(p.x, p.y, b.x, b.y, b.size);
      if (d < bd) { best = b; bd = d; }
    }
    return best;
  }

  /**
   * What an idle piece in a town should do about home, this step:
   * 'out' to come out of doors, 'stay' (indoors), 'home' (walk to `b` and go in), or null to
   * carry on with its routine outdoors.
   */
  decide(p: Piece): { act: 'out' | 'stay' | 'home' | 'edge'; b?: Building; t?: Town; to?: [number, number] } | null {
    const t = this.townOf(p);
    if (!t || p.kind === 'K' || p.posted) return null; // kings stay where their players can see them
    const night = this.night();
    if (p.inside != null) {
      if (night) return { act: 'stay', t };
      // By day they come out, a few a step, while the town has room outdoors.
      return t.outdoors < t.quota ? { act: 'out', t } : { act: 'stay', t };
    }
    const crowded = t.outdoors > t.quota;
    if (!night && (!crowded || this.onShift(p, t))) return null;
    const b = this.homeFor(p, t);
    if (b) return { act: 'home', b, t };
    // No room indoors: out to the town's edge (its outskirts), out of the middle of things.
    const d = cheb(p.x, p.y, t.cx, t.cy);
    if (d >= t.r - 4) return { act: 'stay', t };
    // Spread evenly around the whole rim (each piece its own spot), on open land.
    const w = this.game.world, a = hash01(w.seed, p.id, 6, 84) * Math.PI * 2;
    const at = w.nearestFree(Math.round(t.cx + Math.cos(a) * (t.r - 2)), Math.round(t.cy + Math.sin(a) * (t.r - 2)), 5);
    return at ? { act: 'edge', t, to: at } : null;
  }

  /** Bookkeeping as pieces go in and out. */
  went(t: Town, b: Building | undefined, inOut: 1 | -1) {
    t.outdoors -= inOut;
    if (b) t.inside.set(b.id, Math.max(0, (t.inside.get(b.id) ?? 0) + inOut));
  }

  /**
   * By day, a town still over-full sends some of its idle pieces on pilgrimage (citylife.md §4):
   * to one of the player's altars, or failing that another of their towns, led by a bishop
   * when one is free. At most one at a time from each town, and not too often.
   */
  maybePilgrims(t: Town) {
    const g = this.game, w = g.world;
    if (this.night() || t.outdoors <= t.quota * 1.3 + 4) return;
    if (g.turn - (this.lastPilgrims.get(t.id) ?? -1e9) < 60) return;
    const pl = g.players.get(t.owner);
    if (!pl || pl.isBot || (pl.troops ?? []).filter((x) => x.auto === 'pilgrims' && x.from && cheb(x.from[0], x.from[1], t.cx, t.cy) <= 12).length >= 2) return;
    this.lastPilgrims.set(t.id, g.turn);
    // Where to: an altar of theirs, else another of their towns (near enough to walk).
    const altars = [...w.buildings.values()].filter((b) => b.owner === t.owner && b.type === 'altar' && b.built >= 1 && cheb(b.x, b.y, t.cx, t.cy) > t.r - 4 && cheb(b.x, b.y, t.cx, t.cy) <= 150);
    const towns = g.chronicle.settlementsOf(t.owner).filter((s) => s.id !== t.id && cheb(s.cx, s.cy, t.cx, t.cy) >= 15 && cheb(s.cx, s.cy, t.cx, t.cy) <= 100);
    let to: [number, number] | null = null, dest = '';
    const pick = <X,>(xs: X[]) => xs[Math.floor(hash01(w.seed, t.id, g.turn, 82) * xs.length)];
    if (altars.length) { const a = pick(altars); const at = w.nearestFree(a.x, a.y + 2, 5); if (at) { to = at; dest = 'an altar'; } }
    if (!to && towns.length) { const s = pick(towns); const at = w.nearestFree(s.cx, s.cy, 6); if (at) { to = at; dest = 'another of your towns'; } }
    // Failing those: out to the countryside, open land a walk beyond the town (never another empire's).
    if (!to) for (let i = 0; i < 8 && !to; i++) {
      const a = hash01(w.seed, t.id, g.turn + i, 85) * Math.PI * 2, r = t.r + 14 + i * 2;
      const x = Math.round(t.cx + Math.cos(a) * r), y = Math.round(t.cy + Math.sin(a) * r);
      if (!w.walkable(x, y) || w.buildingsNear(x, y, 12).some((b) => b.owner && b.owner !== t.owner)) continue;
      const at = w.nearestFree(x, y, 4);
      if (at) { to = at; dest = 'the countryside'; }
    }
    if (!to) return;
    const idle = w.piecesNear(t.cx, t.cy, t.r).filter((q) => q.owner === t.owner && q.inside == null && q.kind !== 'K' && q.kind !== 'Q' && this.idleHere(q) && !this.onShift(q, t));
    const bishop = idle.find((q) => q.kind === 'B');
    const rest = idle.filter((q) => q !== bishop).sort((a, b) => hash01(w.seed, a.id, g.turn, 83) - hash01(w.seed, b.id, g.turn, 83));
    const band = [...(bishop ? [bishop] : []), ...rest].slice(0, Math.min(PILGRIMS_MAX, Math.round(t.outdoors - t.quota)));
    if (band.length < 3) return;
    if (g.troops.pilgrimage(t.owner, band.map((q) => q.id), to, dest, [t.cx, t.cy])) t.outdoors -= band.length;
  }
}
