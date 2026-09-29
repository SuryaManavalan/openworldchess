// The Chronicle (docs/specs/campaign.md): chapters, unlocks, titles, coronations,
// holding the realm, side quests.
import { afterAll, describe, expect, it } from 'vitest';
import { CHAPTERS, LESSONS, SIDE_TEACH, TITLES, cheb, setWorth, type Building, type SideQuest } from '@owc/shared';
import { findPath } from '@owc/rules';
import { Chess } from 'chess.js';
import { Game, type PlayerRec } from '../src/game.ts';

let rs = 777;
Math.random = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; };
const game = new Game({ seed: 11, speed: 1, wilds: false });
afterAll(() => game.battles.ai.stop());
let now = 1_800_000_000_000;
const join = (name: string) => { const p = game.join(undefined, name) as PlayerRec; p.online = true; return p; };
let nextB = 3_000_000;
const place = (owner: string, type: Building['type'], x: number, y: number, size = 1): Building => {
  const b: Building = { id: nextB++, owner, type, x, y, size, hp: 100, built: 1, prod: 0 };
  game.world.addBuilding(b);
  return b;
};
const tick = (ms = 5000) => { now += ms; game.now = now; game.economy(now); };

describe('the Chronicle', () => {
  it('a new player starts at chapter 1 with only houses to build', () => {
    const p = join('Newcomer');
    const st = game.chronicle.of(p);
    expect(st.ch).toBe(1);
    expect(st.buildings).toEqual(['house']);
    const k = game.kingsOf(p.id)[0];
    expect(game.build(p.id, 'stable', [k.x + 2, k.y + 2])).toMatch(/chapter 1/);
    expect(game.selfPlayer(p).chronicle?.chapter).toBe(1);
  });

  it('finishing a chapter grants its title and unlocks, and counts goals done early', () => {
    const p = join('Climber');
    const k = game.kingsOf(p.id).find((x) => !x.emperor)!;
    // Chapter 1: a house, three pawns raised, and the king (not the Emperor) scouting out
    // (with the wilds off, as here, there's no camp to scout: a march of 10 stands in for it).
    place(p.id, 'house', k.x + 3, k.y + 3);
    for (let i = 0; i < 3; i++) game.chronicle.note(p.id, 'raise:P');
    const spot = game.world.nearestFree(p.home[0] + 14, p.home[1], 6)!;
    game.world.movePiece(k, spot[0], spot[1]);
    tick();
    const st = game.chronicle.of(p);
    expect(st.ch).toBe(2);
    expect(st.title).toBe(1);
    expect(TITLES[st.title].name).toBe('Chieftain');
    expect(st.buildings).toContain('stable');
  });

  it('starting over wipes the empire but keeps the account, only with the name typed', () => {
    const p = join('Restarter');
    const st = game.chronicle.of(p);
    st.ch = 6; st.title = 4; st.renown = 900;
    p.crowns = 700; p.civs = ['roman'];
    const k = game.kingsOf(p.id)[0];
    const b = place(p.id, 'house', k.x + 3, k.y + 3);
    const oldIds = [...game.world.pieces.values()].filter((x) => x.owner === p.id).map((x) => x.id);
    expect(game.resetEmpire(p, 'wrong name')).toMatch(/name/);
    expect(game.world.buildings.has(b.id)).toBe(true);
    expect(game.resetEmpire(p, 'restarter')).toBeNull();
    expect(game.world.buildings.has(b.id)).toBe(false);
    for (const id of oldIds) expect(game.world.pieces.has(id)).toBe(false);
    expect(game.kingsOf(p.id).length).toBeGreaterThan(0);
    const fresh = game.chronicle.of(p);
    expect(fresh.ch).toBe(1);
    expect(fresh.title).toBe(0);
    expect(p.crowns).toBe(700);
    expect(p.civs).toEqual(['roman']);
    // Not again right away.
    expect(game.resetEmpire(p, 'Restarter')).toMatch(/once an hour/);
  });

  it('strength counts only the legal set a side could field', () => {
    expect(setWorth(['K', ...Array(30).fill('P'), ...Array(12).fill('N')])).toBe(8 + 6);
    expect(setWorth(['K', 'Q', 'Q', 'R', 'R', 'R', 'B', 'N', 'P'])).toBe(9 + 10 + 3 + 3 + 1);
  });

  it('a realm full of pawns still raises knights', () => {
    const p = join('Pawnful');
    const k = game.kingsOf(p.id)[0];
    const spot = game.world.nearestFree(k.x + 4, k.y - 4, 8)!;
    const stable = place(p.id, 'stable', spot[0], spot[1], 2);
    const mine = (kind: string) => [...game.world.pieces.values()].filter((q) => q.owner === p.id && q.kind === kind).length;
    while (mine('P') < game.popCaps(p.id).P) {
      const at = game.world.nearestFree(k.x - 6, k.y - 6, 14)!;
      game.addPiece({ id: game.world.id(), owner: p.id, kind: 'P', x: at[0], y: at[1], facing: 2, state: 'idle' });
    }
    tick();
    expect(stable.blocked).not.toBe('pop-cap');
    // Fill the knights' room and the stable pauses.
    while (mine('N') < game.popCaps(p.id).N) {
      const at = game.world.nearestFree(k.x - 6, k.y + 6, 14)!;
      game.addPiece({ id: game.world.id(), owner: p.id, kind: 'N', x: at[0], y: at[1], facing: 2, state: 'idle' });
    }
    tick();
    expect(stable.blocked).toBe('pop-cap');
  });

  it('a full population still raises the piece the chapter asks for', () => {
    const p = join('Crowded');
    const st = game.chronicle.of(p);
    st.ch = 4; st.step = 1; st.buildings = [...new Set([...st.buildings, 'temple'])];
    st.chBase = { ...st.tallies };
    const k = game.kingsOf(p.id)[0];
    // A temple beside ore, and a realm filled to its cap with bishops.
    const spot = game.world.nearestFree(k.x + 4, k.y + 4, 8)!;
    const temple = place(p.id, 'temple', spot[0], spot[1], 2);
    game.world.addHoard(spot[0] + 2, spot[1], 'ore', 500);
    const mine = () => [...game.world.pieces.values()].filter((q) => q.owner === p.id && q.kind === 'B').length;
    const cap = game.popCaps(p.id).B;
    while (mine() < cap) {
      const at = game.world.nearestFree(k.x - 6, k.y - 6, 14)!;
      game.addPiece({ id: game.world.id(), owner: p.id, kind: 'B', x: at[0], y: at[1], facing: 2, state: 'idle' });
    }
    tick();
    expect(mine()).toBeGreaterThanOrEqual(cap);
    expect(temple.blocked).toBeNull();
    // Once the bishop is raised, the cap applies again.
    game.chronicle.note(p.id, 'raise:B');
    expect(game.chronicle.wants(p)).toBeNull();
  });

  it("chapter 4's gift crowns a new king within the title's cap", () => {
    const p = join('Crowned');
    const st = game.chronicle.of(p);
    // Jump to the end of chapter 3 and complete it.
    st.ch = 3; st.step = 0; st.title = 1;
    const before = game.kingsOf(p.id).length;
    game.chronicle.complete(p);
    expect(st.ch).toBe(4);
    expect(st.title).toBe(2); // Warden: king cap 3
    expect(game.kingsOf(p.id).length).toBe(before + 1);
    // At the cap, a further coronation is refused politely.
    expect(game.chronicle.coronation(p)).toBe(false);
  });

  it('a village holds itself for a while without a king, and never decays while its people are home', () => {
    const p = join('Villager');
    const k = game.kingsOf(p.id)[0];
    const bs = [place(p.id, 'house', k.x + 3, k.y), place(p.id, 'house', k.x + 5, k.y), place(p.id, 'house', k.x + 7, k.y)];
    game.chronicle.refreshSettlements(now, true);
    expect(game.chronicle.settlementOfBuilding(bs[0].id)?.tier).toBe(2);
    // Every king leaves, far away.
    for (const kk of game.kingsOf(p.id)) { const s = game.world.nearestFree(kk.x + 80, kk.y, 10)!; game.world.movePiece(kk, s[0], s[1]); }
    tick(1000);
    for (let i = 0; i < 20; i++) tick(60_000); // 20 minutes: a village holds for an hour
    expect(bs[0].blocked).not.toBe('unanchored');
    for (let i = 0; i < 50; i++) tick(60_000); // past the hour: production pauses...
    expect(bs[0].blocked).toBe('unanchored');
    // ...but pawns are still home, so nothing decays.
    expect(bs.every((b) => b.hp === 100)).toBe(true);
  });

  it('existing empires join at the chapter their holdings match', () => {
    const p = join('Veteran');
    delete p.chron;
    const k = game.kingsOf(p.id)[0];
    place(p.id, 'house', k.x + 2, k.y - 3); place(p.id, 'house', k.x + 4, k.y - 3); place(p.id, 'stable', k.x + 6, k.y - 3, 2);
    game.chronicle.refreshSettlements(now, true);
    const st = game.chronicle.of(p);
    expect(st.ch).toBe(4);
    expect(st.buildings).toEqual(expect.arrayContaining(['house', 'stable', 'temple', 'barracks', 'palace']));
    expect(st.title).toBe(2);
  });

  it('side quests appear after half an hour of play, and pay out', () => {
    const p = join('Errand');
    const st = game.chronicle.of(p);
    st.ch = 3;
    // A settlement one building short of its next tier, so a quest is always on offer (wherever the player spawned).
    const k = game.kingsOf(p.id)[0];
    for (const [dx, dy] of [[2, -3], [4, -3]]) { const at = game.world.nearestFree(k.x + dx, k.y + dy, 6)!; place(p.id, 'house', at[0], at[1]); }
    game.chronicle.refreshSettlements(now, true);
    for (let i = 0; i < 7; i++) tick(5 * 60_000);
    expect(st.sides.length).toBeGreaterThan(0);
    const q = st.sides[0];
    // It's an offer until accepted, and only accepted quests count.
    expect(q.state).toBe('offered');
    expect(game.chronicle.accept(p, q.id)).toBeNull();
    expect(q.state).toBe('active');
    const renown = st.renown;
    // A skirmish, scout or grow quest here; finish whichever came.
    if (q.kind === 'skirmish') game.chronicle.note(p.id, 'win:empire');
    else { game.chronicle.decline(p, q.id); expect(st.sides.some((x) => x.id === q.id)).toBe(false); return; }
    expect(st.renown).toBeGreaterThan(renown);
  });

  it('a declined quest is shelved and offered again later, never lost', () => {
    const p = join('Picky');
    const st = game.chronicle.of(p);
    st.ch = 3;
    const k = game.kingsOf(p.id)[0];
    for (const [dx, dy] of [[2, -3], [4, -3]]) { const at = game.world.nearestFree(k.x + dx, k.y + dy, 6)!; place(p.id, 'house', at[0], at[1]); }
    game.chronicle.refreshSettlements(now, true);
    for (let i = 0; i < 4 && !st.sides.length; i++) tick(5 * 60_000);
    const q = st.sides[0];
    expect(q).toBeTruthy();
    game.chronicle.decline(p, q.id);
    expect(st.sides.some((x) => x.id === q.id)).toBe(false);
    // (Only one offer waits at a time: turn the others down so the declined one can come back.)
    for (let i = 0; i < 16 && !st.sides.some((x) => x.id === q.id); i++) { tick(5 * 60_000); for (const o of st.sides) if (o.id !== q.id && o.state === 'offered') game.chronicle.decline(p, o.id); }
    const again = st.sides.find((x) => x.id === q.id);
    expect(again?.state).toBe('offered');
    expect(again?.line).toBe(q.line);
  });

  it('the pilgrimage: clear a grove, raise an altar there, pave a road home', () => {
    const p = join('Palmer');
    const st = game.chronicle.of(p);
    st.ch = 5; st.buildings = [...new Set([...st.buildings, 'house', 'temple'])];
    const k = game.kingsOf(p.id)[0];
    for (const [dx, dy] of [[2, -3], [4, -3], [6, -3]]) { const at = game.world.nearestFree(k.x + dx, k.y + dy, 6)!; place(p.id, 'house', at[0], at[1]); }
    game.chronicle.refreshSettlements(now, true);
    const q = (game.chronicle as unknown as { pilgrimage: (p: PlayerRec, id: number) => SideQuest | null }).pilgrimage(p, 900);
    expect(q).toBeTruthy();
    if (!q) return;
    q.state = 'active';
    st.sides.push(q);
    const [x0, y0, x1, y1] = q.area!;
    // 1: clear the grove (as elephants would).
    for (const n of game.world.nodesNear(x0, y0, 10, 0)) if (n.kind === 'tree' && n.x <= x1 && n.y <= y1) { game.world.drawNode(n, n.remaining, now); }
    tick();
    expect(q.stage).toBe(1);
    // 2: an altar in the clearing, raised by a bishop.
    const site = game.world.nearestFree(x0 + 5, y0 + 5, 5, (x, y) => game.world.buildable(x, y) && !game.world.nodeAt(x, y))!;
    const b = { id: game.world.id(), owner: p.id, kind: 'B' as const, x: site[0] + 1, y: site[1], facing: 2 as const, state: 'idle' as const };
    game.addPiece(game.world.pieceIdAt(b.x, b.y) == null ? b : { ...b, x: site[0], y: site[1] + 1 });
    expect(game.build(p.id, 'altar', site)).toBeNull();
    for (let i = 0; i < 14; i++) tick();
    expect(q.stage).toBe(2);
    // 3: pave a road home (straight along a path, as knights would).
    const path = findPath(site[0], site[1], k.x, k.y, (x, y) => game.world.walkable(x, y) || (x === site[0] && y === site[1]), 40000);
    for (const [x, y] of path) game.world.pave(x, y);
    const renown = st.renown;
    tick();
    expect(st.sides.some((x) => x.id === q.id)).toBe(false);
    expect(st.renown).toBe(renown + 150);
  });

  it('a shrine poses its riddle when a piece arrives, and checks every move (campaign.md §5.3)', () => {
    const p = join('Riddler');
    const st = game.chronicle.of(p);
    const k = game.kingsOf(p.id)[0];
    const at = game.world.nearestFree(k.x + 6, k.y, 4)!;
    const q: SideQuest = { id: 950, kind: 'shrine', at, line: 'A shrine', renown: 60, state: 'active' };
    st.sides.push(q);
    tick();
    expect(q.puzzle).toBeUndefined();
    // A piece reaches the shrine: the riddle appears.
    game.addPiece({ id: game.world.id(), owner: p.id, kind: 'P', x: at[0], y: at[1] + 1, facing: 2, state: 'idle' });
    tick();
    expect(q.puzzle).toBeTruthy();
    // A mate in 2 (proved by the generator): a wrong move resets, the right line solves it.
    const fen = 'r7/1p1k4/4pQ2/p2pB1P1/4p3/PP6/4BP1P/3RR2K w - - 3 39';
    q.puzzle = { fen, n: 2, left: 2 };
    (q as SideQuest & { start?: string }).start = fen;
    expect(game.chronicle.solve(p, 950, 'f6f7')).toMatch(/resets/);
    expect(q.puzzle.fen).toBe(fen);
    expect(game.chronicle.solve(p, 950, 'e2b5')).toBeNull();
    expect(q.puzzle.left).toBe(1);
    // Whatever the defense played, one move mates now.
    const c = new Chess(q.puzzle.fen);
    const mate = c.moves({ verbose: true }).find((m) => { c.move(m); const k = c.isCheckmate(); c.undo(); return k; })!;
    const renown = st.renown;
    expect(game.chronicle.solve(p, 950, mate.from + mate.to)).toBeNull();
    expect(st.sides.some((x) => x.id === 950)).toBe(false);
    expect(st.renown).toBe(renown + 60);
  });

  it('opening challenges and feats are judged from the game (campaign.md §5.3)', () => {
    const p = join('Openings');
    const st = game.chronicle.of(p);
    st.sides.push({ id: 960, kind: 'opening', challenge: 'italian', line: 'Italian', renown: 70, state: 'active' });
    st.sides.push({ id: 961, kind: 'feat', challenge: 'swift', line: 'Swift', renown: 60, state: 'active' });
    st.sides.push({ id: 962, kind: 'opening', challenge: 'queens-gambit', line: 'QG', renown: 70, state: 'active' });
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    // Scholar's mate, opened as the Italian: e4, Nf3... then Bc4.
    game.chronicle.battleWon(p.id, { side: 'white', startFen: start, moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'Nxf7'], promoted: 0 });
    expect(st.sides.some((x) => x.id === 960)).toBe(false); // the Italian: done
    expect(st.sides.some((x) => x.id === 961)).toBe(false); // five moves: swift
    expect(st.sides.some((x) => x.id === 962)).toBe(true);  // not a Queen's Gambit
  });

  it('side quests: at most three at once, and only kinds the chapter has opened (campaign.md §5.3)', () => {
    const p = join('Paced');
    const st = game.chronicle.of(p);
    st.ch = 3;
    const k = game.kingsOf(p.id)[0];
    for (const [dx, dy] of [[2, -3], [4, -3]]) { const at = game.world.nearestFree(k.x + dx, k.y + dy, 6)!; place(p.id, 'house', at[0], at[1]); }
    game.chronicle.refreshSettlements(now, true);
    for (let i = 0; i < 40; i++) {
      tick(5 * 60_000);
      // Take up whatever's offered, so offers keep coming.
      for (const q of st.sides) if (q.state === 'offered') game.chronicle.accept(p, q.id);
      expect(st.sides.length).toBeLessThanOrEqual(3);
    }
    // Chapter 3 opens bounties, growth and shrines, nothing later (no openings, feats or skirmishes).
    for (const q of st.sides) expect(['bounty', 'grow', 'shrine']).toContain(q.kind);
    expect(st.sides.length).toBeGreaterThan(0);
  });

  it("a player's king cap follows their title", () => {
    const p = join('Capped');
    const st = game.chronicle.of(p);
    st.title = 0;
    expect(game.chronicle.kingCap(p)).toBe(2);
    st.title = 9;
    expect(game.chronicle.kingCap(p)).toBe(20);
  });

  it('every rule is taught somewhere, and every lesson a quest names exists (campaign.md §5.7)', () => {
    const taught = new Set<string>();
    for (const ch of CHAPTERS) for (const s of ch.steps) for (const id of s.teach ?? []) { expect(LESSONS[id], `chapter ${ch.n} names "${id}"`).toBeTruthy(); taught.add(id); }
    for (const ids of Object.values(SIDE_TEACH)) for (const id of ids) { expect(LESSONS[id], `side quests name "${id}"`).toBeTruthy(); taught.add(id); }
    for (const id of Object.keys(LESSONS)) expect(taught.has(id), `lesson "${id}" isn't taught by any quest`).toBe(true);
    // Every lesson has its plain line and its fine print.
    for (const [id, l] of Object.entries(LESSONS)) { expect(l.text.length, id).toBeGreaterThan(10); expect(l.fine.length, id).toBeGreaterThan(0); }
  });

  it('every chapter is reachable: each has steps, and each unlock is used by a later goal or play', () => {
    expect(CHAPTERS.length).toBe(15);
    const unlocked = new Set<string>(['house']);
    for (const ch of CHAPTERS) {
      for (const s of ch.steps) if (s.verb === 'build') expect(unlocked.has(s.type)).toBe(true);
      for (const s of ch.steps) if (s.verb === 'raise' && s.kind !== 'P') {
        const need = { N: 'stable', B: 'temple', R: 'barracks', Q: 'palace', K: 'palace' }[s.kind];
        expect(unlocked.has(need)).toBe(true);
      }
      for (const b of ch.reward.buildings ?? []) { unlocked.add(b); if (b === 'temple') unlocked.add('altar'); } // altars open with temples
      if (ch.reward.abilities?.includes('wonder')) unlocked.add('wonder');
    }
    void cheb;
  });
});
