// The directory (docs/specs/social.md): find rulers and cities by name. Public (names and cities
// are what anyone sees on the map), used by the in-game Find panel and by deep links
// (openworldchess.com/?city=Rookbridge, ?player=Steven, ?at=x,y).
import { isDecor } from '@owc/shared';
import { townName } from '@owc/worldgen';
import type { Game } from './game.ts';

export interface CityEntry { name: string; owner: string; ownerId: string; tier: number; buildings: number; at: [number, number] }
export interface PlayerEntry { name: string; id: string; title: number; cities: CityEntry[]; home: [number, number] }

const REFRESH_MS = 60_000;

export class Directory {
  private game: Game;
  private at = 0;
  private cities: CityEntry[] = [];
  constructor(game: Game) { this.game = game; }

  /** Every player city (not bots, not the wilds), refreshed each minute. */
  private index() {
    const g = this.game;
    if (Date.now() - this.at < REFRESH_MS && this.cities.length) return this.cities;
    this.at = Date.now();
    const out: CityEntry[] = [];
    for (const p of g.players.values()) {
      if (p.isBot || p.wild) continue;
      for (const st of g.chronicle.settlementsOf(p.id)) {
        const real = st.buildings.filter((b) => !isDecor(b.type)).length;
        if (!real) continue;
        out.push({ name: townName(g.world.seed, st.id, st.cx, st.cy), owner: p.name, ownerId: p.id, tier: st.tier, buildings: real, at: [st.cx, st.cy] });
      }
    }
    this.cities = out.sort((a, b) => b.buildings - a.buildings);
    return this.cities;
  }

  /** Every player city, biggest first (for the site's /cities page). */
  all(): CityEntry[] { return this.index(); }

  /**
   * Rulers and cities matching `q` (case-insensitive; names that start with it first). A ruler
   * comes with their biggest cities, or, with no city yet, where their kings are.
   */
  find(q: string): { players: PlayerEntry[]; cities: CityEntry[] } {
    const g = this.game, s = q.trim().toLowerCase().slice(0, 30);
    if (s.length < 2) return { players: [], cities: [] };
    const rank = (name: string) => { const n = name.toLowerCase(); return n === s ? 0 : n.startsWith(s) ? 1 : n.includes(s) ? 2 : 9; };
    const all = this.index();
    const players: PlayerEntry[] = [];
    for (const p of g.players.values()) {
      if (p.isBot || p.wild || rank(p.name) > 2) continue;
      const mine = all.filter((c) => c.ownerId === p.id).slice(0, 4);
      const king = g.kingsOf(p.id).find((k) => !k.emperor) ?? g.kingsOf(p.id)[0];
      players.push({ name: p.name, id: p.id, title: p.chron?.title ?? 0, cities: mine, home: mine[0]?.at ?? (king ? [king.x, king.y] : p.home) });
    }
    players.sort((a, b) => rank(a.name) - rank(b.name) || b.cities.length - a.cities.length);
    const cities = all.filter((c) => rank(c.name) <= 2).sort((a, b) => rank(a.name) - rank(b.name) || b.buildings - a.buildings);
    return { players: players.slice(0, 10), cities: cities.slice(0, 10) };
  }
}
