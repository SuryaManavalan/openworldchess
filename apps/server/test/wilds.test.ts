// The wilds (docs/specs/wilds.md): camps appear by players, grow, raid troops in
// the field, and scatter when their king falls. Creatures never change sides.
import { afterAll, describe, expect, it } from 'vitest';
import { CHAPTERS, FACTIONS, cheb, setWorth, type Building } from '@owc/shared';
import { Game, type PlayerRec } from '../src/game.ts';
import { CAMP_CELL } from '../src/wilds.ts';

// Spawn spots and camp behavior use Math.random: seed it so these tests are reproducible.
let rs = 424242;
Math.random = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; };
const game = new Game({ seed: 5, speed: 1 });
game.battles.countdownScale = 0;
game.shieldMs = 0;
afterAll(() => game.battles.ai.stop());
const join = (name: string) => { const p = game.join(undefined, name) as PlayerRec; p.online = true; return p; };
// A fixed clock too (camp roaming hashes the time).
let now = 1_800_000_000_000;
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
    const c = game.wilds.camps().find((x) => !x.wild!.quarryFor)!; // (a newcomer's own band never grows)
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
    if (process.env.DBG_RAID) console.log('DBG', { hk: [hk.x, hk.y, hk.state, hk.groupId], other: [other.x, other.y, other.state], can: game.battles.canTarget(other, horde.id), last: horde.wild!.lastAttack, size: game.wilds.piecesOf(horde).length, online: p.online, battles: [...game.battles.recs.values()].map((r) => [r.white.player === horde.id, r.black.kingId, r.pub.phase]), settle: game.world.buildingsNear(other.x, other.y, 10).filter((b) => b.owner === other.owner).length });
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
    // Any newcomers are freed captives (pawns and knights of the hero's own), never creatures.
    const newcomers = game.holdings(hero.id).pieces.filter((q) => q.id > 0).length - before;
    expect(newcomers).toBeLessThanOrEqual(5);
    // Spoils (campaign.md §4.2): a hoard where the camp stood.
    const hoards = game.world.nodesNear(camp.wild!.x, camp.wild!.y, 2, 6).filter((n) => n.hoard);
    expect(hoards.length).toBe(1);
    expect(hoards[0].capacity).toBeGreaterThan(200);
    expect(game.wilds.cleared.has(camp.wild!.cell)).toBe(true);
    void cheb;
  });

  it('a hunt with nothing beatable in reach gets a young band of its own, once', () => {
    const p = join('Latecomer');
    const st = game.chronicle.of(p);
    st.ch = 2; st.step = 1; st.chBase = { ...st.tallies };
    // Every camp around has grown into a full army.
    for (const c of game.wilds.camps()) { if (c.wild!.awake === false) c.wild!.roster = ['K', 'Q', 'R', 'R', 'B', 'B', 'N', 'N', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P']; }
    for (const c of game.wilds.camps()) if (c.wild!.awake !== false) game.wilds.remove(c);
    const at = game.selfPlayer(p).chronicle?.target;
    expect(at).toBeTruthy();
    const q = game.wilds.camps().find((c) => c.wild!.quarryFor === p.id)!;
    expect(q).toBeTruthy();
    // Weaker than the strongest legal set the player could field (a crowd of pawns fights as eight).
    const mine = setWorth(game.world.piecesNear(p.home[0], p.home[1], 40).filter((x) => x.owner === p.id).map((x) => x.kind));
    expect(setWorth(game.wilds.piecesOf(q).map((x) => x.kind))).toBeLessThan(mine);
    expect(cheb(at![0], at![1], q.wild!.x, q.wild!.y)).toBeLessThanOrEqual(1);
    // It doesn't grow, and a second look doesn't raise another.
    const size = game.wilds.piecesOf(q).length;
    for (let i = 0; i < 20; i++) tick(60_000);
    expect(game.wilds.piecesOf(q).length).toBe(size);
    expect(game.wilds.quarry(p.id, p.home, 20, now)).toBeNull();
  });

  it('a fight with a camp is rated, like a game against a player (elo.md §1)', () => {
    for (const r of game.battles.recs.values()) if (r.pub.phase !== 'over') { r.pub.phase = 'over'; for (const k of r.sealed) game.world.sealed.delete(k); }
    for (const p of game.world.pieces.values()) if (p.state === 'battle') { p.state = 'idle'; game.world.dropPiece(p, p.x, p.y); }
    const hero = join('Rated');
    const k = game.kingsOf(hero.id).find((x) => !x.emperor)!;
    const camp = game.wilds.camps().find((c) => { const ck = game.wilds.king(c); return ck && ck.state === 'idle' && !ck.groupId; })!;
    const ck = game.wilds.king(camp)!;
    ck.protectedUntil = 0; ck.cooldownUntil = 0;
    const spot = game.world.nearestFree(ck.x + 3, ck.y, 6)!;
    game.world.movePiece(k, spot[0], spot[1]);
    expect(game.battles.engage(k, ck)).toBeNull();
    tick(10);
    const rec = [...game.battles.recs.values()].find((r) => r.white.kingId === k.id)!;
    expect(game.battles.move(hero.id, rec.pub.id, rec.game!.legalMoves()[0])).toBeNull();
    expect(game.battles.move(camp.id, rec.pub.id, rec.game!.legalMoves()[0])).toBeNull();
    const [r0, rd0] = [hero.rating, hero.rd];
    game.battles.resign(camp.id, rec.pub.id);
    expect(rec.pub.result).toBe('white');
    // A new player's first win moves a lot (their deviation is high), and the deviation shrinks.
    expect(hero.rating).toBeGreaterThan(r0 + 20);
    expect(hero.rd).toBeLessThan(rd0);
    expect(hero.ratedAt).toBe(now);
  });

  it('a troop without a king can raid a camp: a pawn commands, and only it falls if the raid fails (battle.md §9)', () => {
    for (const r of game.battles.recs.values()) if (r.pub.phase !== 'over') { r.pub.phase = 'over'; for (const k of r.sealed) game.world.sealed.delete(k); }
    for (const p of game.world.pieces.values()) if (p.state === 'battle') { p.state = 'idle'; game.world.dropPiece(p, p.x, p.y); }
    const raider = join('Raider');
    raider.chron!.ch = 6; // past the newcomers' grace, so a lost raid really costs the pawn
    const camp = game.wilds.camps().find((c) => { const ck = game.wilds.king(c); return ck && ck.state === 'idle' && !ck.groupId; })!;
    const ck = game.wilds.king(camp)!;
    ck.protectedUntil = 0; ck.cooldownUntil = 0;
    // Three pawns beside the camp, no king anywhere near.
    const pawns = [0, 1, 2].map((i) => { const at = game.world.nearestFree(ck.x + 3, ck.y + i, 6)!; const p = { id: game.world.id(), owner: raider.id, kind: 'P' as const, x: at[0], y: at[1], facing: 3 as const, state: 'idle' as const }; game.addPiece(p); return p; });
    const kings = game.kingsOf(raider.id).map((k) => k.id);
    expect(game.orderAttack(raider.id, pawns.map((p) => p.id), ck.id)).toBeNull();
    tick(10);
    const rec = [...game.battles.recs.values()].find((r) => r.white.player === raider.id && r.pub.phase === 'live')!;
    expect(rec).toBeTruthy();
    const commander = rec.white.kingId;
    expect(rec.pub.commanders).toEqual([commander]);
    expect(game.world.pieces.get(commander)!.kind).toBe('P'); // a pawn in the world, a king only on the board
    game.battles.resign(raider.id, rec.pub.id);
    // Only the commander fell; the other raiders are still the raider's, and the real kings are untouched.
    expect(game.world.pieces.has(commander)).toBe(false);
    for (const p of pawns.filter((q) => q.id !== commander)) expect(game.world.pieces.get(p.id)?.owner).toBe(raider.id);
    expect(game.kingsOf(raider.id).map((k) => k.id).sort()).toEqual(kings.sort());
  });

  it('a troop out on its own without a king can be attacked: a pawn defends as its commander (battle.md §9)', () => {
    for (const r of game.battles.recs.values()) if (r.pub.phase !== 'over') { r.pub.phase = 'over'; for (const k of r.sealed) game.world.sealed.delete(k); }
    for (const p of game.world.pieces.values()) if (p.state === 'battle') { p.state = 'idle'; game.world.dropPiece(p, p.x, p.y); }
    const a = join('Hunter'), b = join('Rover');
    // A's king goes far from everyone; B's posted troop (a knight and three pawns) stands beside it.
    const ak = game.kingsOf(a.id).find((k) => !k.emperor)!;
    const spot = game.world.nearestFree(ak.x + 120, ak.y + 120, 20)!;
    game.world.movePiece(ak, spot[0], spot[1]);
    const add = (kind: 'P' | 'N', dx: number, dy: number) => { const at = game.world.nearestFree(spot[0] + dx, spot[1] + dy, 6)!; const p = { id: game.world.id(), owner: b.id, kind, x: at[0], y: at[1], facing: 3 as const, state: 'idle' as const, posted: true }; game.addPiece(p); return p; };
    const knight = add('N', 3, 0);
    const pawns = [add('P', 4, 1), add('P', 4, -1), add('P', 5, 0)];
    for (const k of game.kingsOf(b.id)) expect(cheb(k.x, k.y, knight.x, knight.y)).toBeGreaterThan(10);
    // Aim at the knight: its nearest pawn takes command.
    expect(game.defenderOf(knight)?.kind).toBe('P');
    expect(game.orderAttack(a.id, [ak.id], knight.id)).toBeNull();
    tick(10);
    const rec = [...game.battles.recs.values()].find((r) => r.white.player === a.id && r.pub.phase === 'live')!;
    expect(rec).toBeTruthy();
    const commander = rec.black.kingId;
    expect(pawns.map((p) => p.id)).toContain(commander);
    expect(rec.pub.commanders).toEqual([commander]);
    game.battles.resign(b.id, rec.pub.id);
    // Beaten like any troop: the commander falls, and the survivors flee home.
    expect(game.world.pieces.has(commander)).toBe(false);
    for (const p of [knight, ...pawns].filter((q) => q.id !== commander && game.world.pieces.has(q.id))) expect(game.world.pieces.get(p.id)!.state).toBe('routed');
  });

  it("a new empire gets a young band of its own nearby, and isn't placed beside grown camps", () => {
    const p = join('Newcomer');
    const band = game.wilds.camps().find((c) => c.wild!.quarryFor === p.id);
    expect(band).toBeTruthy();
    const size = band!.wild!.awake === false ? band!.wild!.roster?.length ?? 0 : game.wilds.piecesOf(band!).length;
    expect(size).toBeLessThanOrEqual(4);
    expect(cheb(band!.wild!.x, band!.wild!.y, p.home[0], p.home[1])).toBeLessThanOrEqual(32);
    // No camp of more than 8 pieces within 35 squares of where it starts (when there's room elsewhere).
    for (const c of game.wilds.camps()) {
      if (c === band) continue;
      const n = c.wild!.awake === false ? c.wild!.roster?.length ?? 0 : game.wilds.piecesOf(c).length;
      if (n > 8) expect(cheb(c.wild!.x, c.wild!.y, p.home[0], p.home[1])).toBeGreaterThan(35);
    }
  });

  it("a new empire's first scouting and hunt point close to home, not at a beatable camp far away", () => {
    const p = join('Faraway');
    const st = game.chronicle.of(p);
    st.ch = 1; st.step = 2; st.chBase = { ...st.tallies };
    const away = (x: number, y: number) => Math.min(...game.kingsOf(p.id).map((k) => cheb(k.x, k.y, x, y)));
    // Everything near home is too strong; a weak camp waits far off.
    let far = 0;
    for (const c of game.wilds.camps()) {
      const d = away(c.wild!.x, c.wild!.y);
      if (c.wild!.awake !== false) { if (d <= 40) game.wilds.remove(c); continue; }
      if (d <= 40) c.wild!.roster = ['K', 'Q', 'R', 'R', 'B', 'B', 'N', 'N', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'];
      else if (d <= 600) { c.wild!.roster = ['K', 'P']; far++; }
    }
    if (!far) expect(game.wilds.quarry('decoy', [p.home[0] + 150, p.home[1]], setWorth(['K', 'P', 'P']), now)).toBeTruthy();
    tick();
    const at = game.chronicle.view(p).target;
    expect(at).toBeTruthy();
    expect(away(at![0], at![1])).toBeLessThanOrEqual(40);
    expect(game.wilds.camps().some((c) => c.wild!.quarryFor === p.id && cheb(c.wild!.x, c.wild!.y, at![0], at![1]) <= 1)).toBe(true);
  });

  it('a bounty is offered on a camp the player could beat, not on a nearer full army', () => {
    const p = join('Bountyhunter');
    const st = game.chronicle.of(p);
    st.ch = 2; st.step = 0; st.chBase = { ...st.tallies };
    const from = game.kingsOf(p.id)[0];
    // A grown army (more material than headcount), so a camp's size alone says nothing.
    for (const kind of ['N', 'N', 'B', 'B', 'R'] as const) {
      const at = game.world.nearestFree(from.x, from.y + 2, 6)!;
      game.addPiece({ id: game.world.id(), owner: p.id, kind, x: at[0], y: at[1], facing: 2, state: 'idle' });
    }
    for (const c of game.wilds.camps()) {
      if (c.wild!.awake !== false) { if (cheb(c.wild!.x, c.wild!.y, from.x, from.y) <= 200) game.wilds.remove(c); continue; }
      c.wild!.roster = ['K', 'Q', 'R', 'R', 'B', 'B', 'N', 'N', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'];
    }
    const weak = game.wilds.quarry('decoy-bounty', [from.x + 90, from.y], setWorth(['K', 'P', 'P']), now)!;
    const strong = game.wilds.quarry('decoy-strong', [from.x - 20, from.y], 200, now)!;
    const army = setWorth(game.world.piecesNear(from.x, from.y, 12).filter((x) => x.owner === p.id).map((x) => x.kind));
    expect(setWorth(game.wilds.piecesOf(strong).map((x) => x.kind))).toBeGreaterThan(army);
    expect(setWorth(game.wilds.piecesOf(strong).map((x) => x.kind))).toBeGreaterThan(setWorth(game.wilds.piecesOf(weak).map((x) => x.kind)));
    (game.chronicle as unknown as { writeSide(p: PlayerRec): void }).writeSide(p);
    const q = st.sides.find((x) => x.kind === 'bounty');
    expect(q?.camp).toBe(weak.id);
  });

  it('a fight with an empire points at a rival near your rating, not the nearest one', () => {
    const p = join('Challenger');
    const even = join('EvenMatch'), pro = join('Veteran');
    for (const x of game.players.values()) if (!x.wild && x.id !== p.id) x.rating = 2000;
    p.rating = 1000; even.rating = 1100; pro.rating = 1900;
    const st = game.chronicle.of(p);
    st.ch = CHAPTERS.findIndex((c) => c.steps.some((s) => s.verb === 'win')) + 1; st.step = 0; st.chBase = { ...st.tallies };
    tick();
    const at = game.chronicle.view(p).target;
    const k = game.kingsOf(even.id).find((x) => !x.emperor)!;
    expect(at).toEqual([k.x, k.y]);
  });

  it("chapter 1's scouting: a king (not the Emperor) goes to look at the camp the Chronicle marks", () => {
    const p = join('Lookout');
    const st = game.chronicle.of(p);
    st.ch = 1; st.step = 2; st.chBase = { ...st.tallies };
    tick();
    const at = game.chronicle.view(p).target ?? game.chronicle.view(p).target;
    expect(at).toBeTruthy();
    // The Emperor going doesn't count...
    const emp = game.kingsOf(p.id).find((k) => k.emperor)!;
    const near = game.world.nearestFree(at![0], at![1] + 3, 6)!;
    const home: [number, number] = [emp.x, emp.y];
    game.world.movePiece(emp, near[0], near[1]);
    tick();
    expect(st.ch).toBe(1);
    game.world.movePiece(emp, home[0], home[1]);
    // ...a king does.
    const k = game.kingsOf(p.id).find((x) => !x.emperor)!;
    const by = game.world.nearestFree(at![0] - 3, at![1], 6)!;
    game.world.movePiece(k, by[0], by[1]);
    tick();
    expect(st.ch).toBe(2);
  });

  it('an empire still needs a king to attack another empire', () => {
    const a = join('NoKingA'), b = join('NoKingB');
    const bk = game.kingsOf(b.id)[0];
    const at = game.world.nearestFree(bk.x + 3, bk.y, 6)!;
    const p = { id: game.world.id(), owner: a.id, kind: 'P' as const, x: at[0], y: at[1], facing: 3 as const, state: 'idle' as const };
    game.addPiece(p);
    expect(game.orderAttack(a.id, [p.id], bk.id)).toMatch(/needs a king/);
  });
});
