// Troops (movement.md §10): pieces you send out of your cities hold where you sent them,
// together. Moving a whole troop moves it; moving part of it splits that part off. A troop
// can be reinforced (the nearest piece of a kind walks out to join it) and called home,
// where it disbands. A member stranded far from its post walks home on its own.
import { TROOP_CITY_R, TROOP_JOIN_MIN_MS, TROOP_JOIN_R, TROOP_LEASH, TURN_MS, cheb, type Piece, type Troop } from '@owc/shared';
import type { Game, PlayerRec } from './game.ts';

export class Troops {
  private game: Game;
  constructor(game: Game) { this.game = game; }

  private get w() { return this.game.world; }

  of(p: PlayerRec): Troop[] { return (p.troops ??= []); }

  /** Inside one of the player's cities: near any of their buildings. */
  inCity(owner: string, x: number, y: number): boolean {
    return this.w.buildingsNear(x, y, TROOP_CITY_R).some((b) => b.owner === owner && b.type !== 'ruin');
  }

  /** The nearest city's heart (a settlement center), or home. */
  nearestCity(owner: string, x: number, y: number): [number, number] {
    const p = this.game.players.get(owner);
    const s = this.game.chronicle.settlementsOf(owner).sort((a, b) => cheb(a.cx, a.cy, x, y) - cheb(b.cx, b.cy, x, y))[0];
    return s ? [s.cx, s.cy] : p?.home ?? [x, y];
  }

  troopOf(owner: string, pieceId: number): Troop | undefined {
    const p = this.game.players.get(owner);
    return p?.troops?.find((t) => t.members.includes(pieceId) || t.joining.some((j) => j.id === pieceId));
  }

  /** Take pieces out of whatever troops they're in (members or on their way). */
  release(owner: string, ids: number[], keepPosted = false) {
    const p = this.game.players.get(owner);
    if (!p?.troops?.length) return;
    const set = new Set(ids);
    for (const t of p.troops) {
      t.members = t.members.filter((id) => !set.has(id));
      t.joining = t.joining.filter((j) => !set.has(j.id));
    }
    p.troops = p.troops.filter((t) => t.members.length || t.joining.length);
    if (!keepPosted) for (const id of ids) { const q = this.w.pieces.get(id); if (q?.posted && q.owner === owner && q.routine !== 'tend') { q.posted = undefined; this.w.touch(q); } }
  }

  /**
   * The player sent these pieces to `to` (a move, a stop, or an attack). The whole of a troop
   * moves the troop; anything else leaves its old troops and, outside a city, forms a new one.
   */
  assign(owner: string, pieces: Piece[], to: [number, number]) {
    const p = this.game.players.get(owner);
    if (!p || p.wild || !pieces.length) return;
    const ids = new Set(pieces.map((q) => q.id));
    const home = this.inCity(owner, to[0], to[1]);
    const whole = this.of(p).find((t) => t.members.length && t.members.every((id) => ids.has(id)) && pieces.every((q) => t.members.includes(q.id) || t.joining.some((j) => j.id === q.id)));
    if (whole) {
      whole.at = [to[0], to[1]];
      whole.members = [...ids];
      whole.joining = whole.joining.filter((j) => !ids.has(j.id));
      whole.home = home || undefined;
      for (const q of pieces) this.post(q, true);
      return;
    }
    // Sent home to a city: out of their troops, but posted as the order says (orderMove).
    this.release(owner, [...ids], home);
    if (home) return;
    this.of(p).push({ id: this.w.id(), at: [to[0], to[1]], members: [...ids], joining: [] });
    for (const q of pieces) this.post(q, true);
  }

  private post(q: Piece, on: boolean) {
    if (!!q.posted === on) return;
    q.posted = on || undefined;
    this.w.touch(q);
  }

  /** Call a piece out to a troop: it walks to the post and joins when it gets there. */
  reinforce(owner: string, troopId: number, pieceId: number): string | null {
    const p = this.game.players.get(owner);
    const t = p?.troops?.find((x) => x.id === troopId);
    if (!p || !t) return 'That troop is gone';
    if (t.home) return 'That troop is heading home';
    const [q] = this.game.orderable(owner, [pieceId]);
    if (!q) return 'That piece can\'t come right now';
    if (t.members.includes(q.id) || t.joining.some((j) => j.id === q.id)) return null;
    this.release(owner, [q.id]);
    const dist = cheb(q.x, q.y, t.at[0], t.at[1]);
    const err = this.game.orderMove(owner, [q.id], t.at, undefined, undefined, undefined, false, false, true);
    if (err) return err;
    t.joining.push({ id: q.id, until: this.game.now + Math.max(TROOP_JOIN_MIN_MS, dist * TURN_MS * 4 / Math.max(1, this.game.speed)) });
    this.post(q, true);
    return null;
  }

  /** Call a troop home (to a city, or the nearest one): it disbands when it gets there. */
  callHome(owner: string, troopId: number, to?: [number, number]): string | null {
    const p = this.game.players.get(owner);
    const t = p?.troops?.find((x) => x.id === troopId);
    if (!p || !t) return 'That troop is gone';
    const ids = [...t.members, ...t.joining.map((j) => j.id)];
    const dest = to ?? this.nearestCity(owner, t.at[0], t.at[1]);
    if (!this.inCity(owner, dest[0], dest[1])) return 'Pick one of your cities';
    return this.game.orderMove(owner, ids, dest, undefined, undefined, undefined, true);
  }

  callAllHome(owner: string, to?: [number, number]): string | null {
    const p = this.game.players.get(owner);
    if (!p?.troops?.length) return 'No troops are out';
    let err: string | null = null;
    for (const t of [...p.troops]) err = this.callHome(owner, t.id, to) ?? err;
    return err;
  }

  /** Each turn: arrivals join, stragglers go home, troops home again disband. */
  step() {
    const g = this.game, w = this.w;
    for (const p of g.players.values()) {
      if (!p.troops?.length) continue;
      for (const t of p.troops) {
        const lost: number[] = [];
        t.members = t.members.filter((id) => {
          const q = w.pieces.get(id);
          if (!q || q.owner !== p.id) return false;
          if (q.state === 'routed') { lost.push(id); return false; }
          if (q.state === 'idle' && !q.groupId && !t.home && cheb(q.x, q.y, t.at[0], t.at[1]) > TROOP_LEASH) { lost.push(id); return false; }
          return true;
        });
        t.joining = t.joining.filter((j) => {
          const q = w.pieces.get(j.id);
          if (!q || q.owner !== p.id || q.state === 'routed') return false;
          if (cheb(q.x, q.y, t.at[0], t.at[1]) <= TROOP_JOIN_R) { t.members.push(q.id); return false; }
          if (g.now > j.until) { lost.push(q.id); return false; }
          return true;
        });
        // Called home (or its post is now inside a city, say a town it just took): once everyone
        // has stopped, they're home, and the troop is done.
        if ((t.home || this.inCity(p.id, t.at[0], t.at[1])) && t.members.every((id) => { const q = w.pieces.get(id); return !q || (q.state !== 'moving' && !q.groupId); })) {
          for (const id of t.members) { const q = w.pieces.get(id); if (q && q.routine !== 'tend') this.post(q, false); }
          t.members = []; t.joining = [];
        }
        // Stragglers and late reinforcements walk back to the nearest city.
        for (const id of lost) {
          const q = w.pieces.get(id);
          if (!q) continue;
          if (q.routine !== 'tend') this.post(q, false);
          if (q.state === 'idle' && !this.inCity(p.id, q.x, q.y)) g.orderMove(p.id, [q.id], this.nearestCity(p.id, q.x, q.y), undefined, 40);
        }
      }
      p.troops = p.troops.filter((t) => t.members.length || t.joining.length);
    }
  }
}
