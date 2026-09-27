// The wilds (docs/specs/wilds.md): camps appear by players, grow, raid troops in
// the field, and scatter when their king falls. Creatures never change sides.
import { afterAll, describe, expect, it } from 'vitest';
import { FACTIONS, cheb, type Building } from '@owc/shared';
import { Game, type PlayerRec } from '../src/game.ts';
import { CAMP_CELL } from '../src/wilds.ts';

const game = new Game({ seed: 5, speed: 1 });
game.battles.countdownScale = 0;
game.shieldMs = 0;
afterAll(() => game.battles.ai.stop());
const join = (name: string) => { const p = game.join(undefined, name) as PlayerRec; p.online = true; return p; };
let now = Date.now();
const tick = (ms = 5001) => { now += ms; game.now = now; game.economy(now); game.worldTurn(now); game.battles.tick(now); };

describe('wilds', () => {
  it('sites are deterministic, and each faction lives in its own biomes', () => {
    let found = 0;
    for (let j = -6; j < 6; j++)
      for (let i = -6; i < 6; i++) {
        const s = game.wilds.site(i, j);
        if (!s) continue;
        found++;
        expect(s.faction.biomes).toContain(s.biome);
        expect(Math.floor(s.x / CAMP_CELL)).toBeGreaterThanOrEqual(i - 1);
        expect(game.wilds.site(i, j)).toBe(s);
      }
    expect(found).toBeGreaterThan(20);
  });

  it('camps appear near players as small bands, in creature form', () => {
    join('Ranger');
    tick();
    const camps = game.wilds.camps();
    expect(camps.length).toBeGreaterThan(0);
    for (const c of camps) {
      const pieces = game.wilds.piecesOf(c);
      // A band: a king and pawns (and maybe a knight), 3–5 strong for a new player.
      const kinds = pieces.map((p) => p.kind);
      expect(kinds.filter((k) => k === 'K').length).toBe(1);
      expect(kinds.length).toBeGreaterThanOrEqual(3);
      expect(kinds.length).toBeLessThanOrEqual(5);
      expect(pieces.every((p) => p.wild === c.wild!.faction)).toBe(true);
      const b = game.world.buildings.get(c.wild!.buildingId)!;
      expect(b.type).toBe('camp');
      expect(b.camp?.name).toBe(FACTIONS[c.wild!.faction].camp);
      // Camps keep clear of cities.
      expect(game.world.buildingsNear(b.x, b.y, 30).filter((o) => o.owner && !game.wilds.campOf(o.owner)).length).toBe(0);
    }
  });

  it('camps grow toward a full set as players build nearby, and their rating rises', () => {
    const c = game.wilds.camps()[0];
    const info = c.wild!;
    const start = c.rating;
    // A city grows beside the camp.
    for (let i = 0; i < 20; i++) {
      const b: Building = { id: 2_000_000 + i, owner: 'someone', type: 'house', x: info.x + 40 + (i % 5) * 2, y: info.y + 40 + Math.floor(i / 5) * 2, size: 1, hp: 100, built: 1, prod: 0 };
      game.world.addBuilding(b);
    }
    expect(game.wilds.maxSize(c, now)).toBe(16);
    for (let i = 0; i < 30; i++) tick(4 * 60_000 + 1);
    const pieces = game.wilds.piecesOf(c);
    expect(pieces.length).toBeGreaterThan(8);
    expect(pieces.filter((p) => p.kind === 'K').length).toBe(1);
    expect(c.rating).toBeGreaterThan(start);
    for (let i = 0; i < 20; i++) game.world.removeBuilding(2_000_000 + i);
  });

  it('a horde raids an online troop that comes close, but never an Emperor', () => {
    const horde = game.wilds.camps().find((c) => FACTIONS[c.wild!.faction].temper !== 'herd' && game.wilds.piecesOf(c).length >= 3);
    if (!horde) return; // no raiders near this spawn in this seed
    // Everyone else steps away (camps only raid online players), so the Wanderer is the only target.
    for (const o of game.players.values()) if (!o.wild) o.online = false;
    const p = join('Wanderer');
    const emp = game.kingsOf(p.id).find((k) => k.emperor)!;
    const other = game.kingsOf(p.id).find((k) => !k.emperor)!;
    const hk = game.wilds.king(horde)!;
    // Hold the horde still at home for the test (it roams on its own otherwise).
    if (hk.groupId) game.orderStop(horde.id, game.wilds.piecesOf(horde).map((q) => q.id));
    horde.wild!.x = hk.x - 1; horde.wild!.y = hk.y - 3;
    const spot = game.world.nearestFree(hk.x + 2, hk.y, 3)!;
    game.world.movePiece(emp, spot[0], spot[1]);
    horde.wild!.lastAttack = 0;
    tick();
    expect([...game.battles.recs.values()].some((r) => r.black.kingId === emp.id)).toBe(false);
    const spot2 = game.world.nearestFree(hk.x - 2, hk.y, 3)!;
    game.world.movePiece(other, spot2[0], spot2[1]);
    horde.wild!.lastAttack = 0;
    for (let i = 0; i < 80 && ![...game.battles.recs.values()].some((r) => r.black.kingId === other.id); i++) tick(600);
    expect([...game.battles.recs.values()].some((r) => r.white.player === horde.id && r.black.kingId === other.id)).toBe(true);
  });

  it("beating a camp's king scatters the camp; creatures never join you", () => {
    for (const r of game.battles.recs.values()) if (r.pub.phase !== 'over') { r.pub.phase = 'over'; for (const k of r.sealed) game.world.sealed.delete(k); }
    for (const p of game.world.pieces.values()) if (p.state === 'battle') { p.state = 'idle'; game.world.dropPiece(p, p.x, p.y); }
    const hero = join('Hero');
    const k = game.kingsOf(hero.id).find((x) => !x.emperor)!;
    const camp = game.wilds.camps().find((c) => { const ck = game.wilds.king(c); return ck && ck.state === 'idle' && !ck.groupId; })!;
    const ck = game.wilds.king(camp)!;
    ck.protectedUntil = 0; ck.cooldownUntil = 0;
    const spot = game.world.nearestFree(ck.x + 3, ck.y, 6)!;
    game.world.movePiece(k, spot[0], spot[1]);
    const before = game.holdings(hero.id).pieces.length;
    expect(game.battles.engage(k, ck)).toBeNull();
    tick(10);
    const rec = [...game.battles.recs.values()].find((r) => r.white.kingId === k.id)!;
    expect(rec.pub.phase).toBe('live');
    game.battles.resign(camp.id, rec.pub.id);
    expect(rec.pub.result).toBe('white');
    expect(game.players.has(camp.id)).toBe(false);
    expect([...game.world.pieces.values()].some((p) => p.owner === camp.id)).toBe(false);
    expect(game.world.buildings.has(camp.wild!.buildingId)).toBe(false);
    expect(game.holdings(hero.id).pieces.every((p) => !p.wild)).toBe(true);
    expect(game.holdings(hero.id).pieces.length).toBeLessThanOrEqual(before);
    expect(game.wilds.cleared.has(camp.wild!.cell)).toBe(true);
    void cheb;
  });
});
