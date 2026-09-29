// Works (docs/specs/movement.md §9): what knights and elephants do besides fighting.
// Knights pave roads; elephants clear land. Both work as crews: a player selects several
// and gives one order, the work is split between them, and more hands finish sooner
// (less the time spent getting to their share). Workers are ordinary idle pieces with a
// job: any new order, or a battle, takes them off it, and what's done stays done.
import { CLEAR_CREW, CLEAR_MAX, CLEAR_TURNS, PAVE_CREW, PAVE_MAX, PAVE_RIDE, PAVE_TURNS, cheb, distToRect, type Piece } from '@owc/shared';
import { bestGaitMove, findPathLong } from '@owc/rules';
import type { Game } from './game.ts';
import type { NodeRec } from './world.ts';

type Record = (p: Piece, fx: number, fy: number) => void;

/** One knight's share of a road: the squares to pave, in order. */
interface Paver { kind: 'pave'; job: number; squares: [number, number][]; i: number; going: boolean; stuck: number; work: number }
/** One elephant on a clearing crew: the node it's working, and how long it has worked it. */
interface Feller { kind: 'clear'; job: number; target?: number; work: number; stuck: number }
interface Job { owner: string; kind: 'pave' | 'clear'; left: number; done: number; at: [number, number]; area?: { x0: number; y0: number; x1: number; y1: number; hard: boolean }; claimed: Set<number>; skip: Set<number> }

export class Works {
  private game: Game;
  private workers = new Map<number, Paver | Feller>();
  private jobs = new Map<number, Job>();
  private nextJob = 1;
  constructor(game: Game) { this.game = game; }

  /** The piece's job, if it has one (for the client: `routine`). */
  busy(id: number) { return this.workers.has(id); }

  /** Take pieces off their jobs (a new order, a battle). */
  release(ids: Iterable<number>) {
    for (const id of ids) {
      const w = this.workers.get(id);
      if (!w) continue;
      this.workers.delete(id);
      const p = this.game.world.pieces.get(id);
      if (p && (p.routine === 'pave' || p.routine === 'clear')) { p.routine = undefined; this.game.world.touch(p); }
      if (w.kind === 'clear' && w.target != null) this.jobs.get(w.job)?.claimed.delete(w.target);
      this.finish(w.job, false);
    }
  }

  /**
   * Knights pave a road from where they stand to `to` (movement.md §9). The route is split
   * into one stretch per knight; each rides to its stretch and paves as it goes.
   */
  pave(player: string, ids: number[], to: [number, number]): string | null {
    const g = this.game, w = g.world;
    const knights = g.orderable(player, ids).filter((p) => p.kind === 'N').slice(0, PAVE_CREW);
    if (!knights.length) return 'Paving needs knights';
    // The road starts at the knight nearest the others, and follows open ground.
    const cx = knights.reduce((s, p) => s + p.x, 0) / knights.length, cy = knights.reduce((s, p) => s + p.y, 0) / knights.length;
    const from = knights.reduce((a, b) => (Math.hypot(a.x - cx, a.y - cy) <= Math.hypot(b.x - cx, b.y - cy) ? a : b));
    if (cheb(from.x, from.y, to[0], to[1]) > PAVE_MAX) return `A road order can be at most ${PAVE_MAX} squares long`;
    const path = findPathLong(from.x, from.y, to[0], to[1], (x, y) => w.walkable(x, y), 40000, g.viewed ? 250 : 5000);
    const road = ([[from.x, from.y], ...path] as [number, number][]).filter(([x, y]) => w.walkable(x, y) || (x === from.x && y === from.y));
    if (road.length < 2) return 'No way to pave through to there';
    const end = road.at(-1)!;
    if (cheb(end[0], end[1], to[0], to[1]) > 2) return 'No way to pave through to there';
    if (road.length > PAVE_MAX) return `A road order can be at most ${PAVE_MAX} squares long`;
    const todo = road.filter(([x, y]) => !w.paved(x, y));
    if (!todo.length) return 'That road is already paved';
    // Stretches along the road, sized so the crew finishes together: a knight riding farther
    // out gets a shorter stretch (riding is PAVE_RIDE times as fast as paving). Whoever
    // finishes first takes over half of the longest stretch left (paveStep).
    const n = Math.max(1, Math.min(knights.length, Math.ceil(todo.length / 4)));
    const lens: number[] = [];
    let at = 0;
    for (let s = 0; s < n; s++) { const l = Math.max(0.15, 1 - at / PAVE_RIDE); lens.push(l); at += l; }
    const scale = todo.length / lens.reduce((a, b) => a + b, 0);
    const free = [...knights];
    const job = this.nextJob++;
    this.jobs.set(job, { owner: player, kind: 'pave', left: 0, done: 0, at: [to[0], to[1]], claimed: new Set(), skip: new Set() });
    let from0 = 0;
    for (let s = 0; s < n; s++) {
      const upto = s === n - 1 ? todo.length : Math.min(todo.length, from0 + Math.max(2, Math.round(lens[s] * scale)));
      const squares = todo.slice(from0, upto);
      from0 = upto;
      if (!squares.length) break;
      const [sx, sy] = squares[0];
      const k = free.splice(free.indexOf(free.reduce((a, b) => (cheb(a.x, a.y, sx, sy) <= cheb(b.x, b.y, sx, sy) ? a : b))), 1)[0];
      this.start(k, { kind: 'pave', job, squares, i: 0, going: false, stuck: 0, work: 0 }, [sx, sy]);
    }
    return null;
  }

  /**
   * Elephants clear an area (movement.md §9): each takes the nearest uncleared tree (and,
   * if asked, rock and ore) in it, works it down and moves on. Hoards and land within reach
   * of another empire's buildings are left alone.
   */
  clear(player: string, ids: number[], a: [number, number], b: [number, number], hard: boolean): string | null {
    const g = this.game;
    const crew = g.orderable(player, ids).filter((p) => p.kind === 'R').slice(0, CLEAR_CREW);
    if (!crew.length) return 'Clearing needs elephants';
    const area = { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]), hard };
    if (area.x1 - area.x0 + 1 > CLEAR_MAX || area.y1 - area.y0 + 1 > CLEAR_MAX) return `An area can be at most ${CLEAR_MAX}×${CLEAR_MAX} squares`;
    if (!this.targets(player, area).length) return hard ? 'Nothing to clear there' : 'No trees to clear there (rock and ore are left unless you include them)';
    const job = this.nextJob++;
    this.jobs.set(job, { owner: player, kind: 'clear', left: 0, done: 0, at: [Math.round((area.x0 + area.x1) / 2), Math.round((area.y0 + area.y1) / 2)], area, claimed: new Set(), skip: new Set() });
    for (const p of crew) this.start(p, { kind: 'clear', job, work: 0, stuck: 0 });
    return null;
  }

  /** What's left to clear in an area. */
  targets(player: string, area: { x0: number; y0: number; x1: number; y1: number; hard: boolean }): NodeRec[] {
    const w = this.game.world;
    const cx = Math.floor((area.x0 + area.x1) / 2), cy = Math.floor((area.y0 + area.y1) / 2), r = Math.ceil(Math.max(area.x1 - area.x0, area.y1 - area.y0) / 2) + 1;
    const theirs = w.buildingsNear(cx, cy, r + 10).filter((b) => b.owner && b.owner !== player && b.type !== 'ruin' && !this.game.players.get(b.owner)?.wild);
    return w.nodesNear(cx - r, cy - r, 1, 2 * r).filter((n) =>
      n.x >= area.x0 && n.x <= area.x1 && n.y >= area.y0 && n.y <= area.y1 && !n.hoard && n.remaining > 0
      && (n.kind === 'tree' || (area.hard && (n.kind === 'rock' || n.kind === 'ore')))
      && !theirs.some((b) => distToRect(n.x, n.y, b.x, b.y, b.size) <= 10));
  }

  private start(p: Piece, job: Paver | Feller, goTo?: [number, number]) {
    const g = this.game;
    // Leaving any march; posted where they work, so they don't drift home.
    g.orderStop(p.owner!, [p.id]);
    this.release([p.id]);
    this.workers.set(p.id, job);
    this.jobs.get(job.job)!.left++;
    p.posted = true;
    p.routine = job.kind;
    g.world.touch(p);
    if (job.kind === 'pave' && goTo && cheb(p.x, p.y, goTo[0], goTo[1]) > 2) {
      job.going = true;
      g.orderMove(p.owner!, [p.id], goTo, undefined, 60, undefined, true, true);
    }
  }

  private finish(jobId: number, completed: boolean) {
    const j = this.jobs.get(jobId);
    if (!j) return;
    j.left--;
    if (completed) j.done++;
    if (j.left > 0) return;
    this.jobs.delete(jobId);
    if (j.done) this.game.onAlert(j.owner, { kind: 'info', text: j.kind === 'pave' ? 'The road is paved' : 'The land is cleared', at: j.at });
  }

  /** One world turn of work. */
  step(record: Record) {
    const g = this.game, w = g.world;
    for (const [id, job] of [...this.workers]) {
      const p = w.pieces.get(id);
      if (!p || p.state === 'battle' || p.state === 'masterless' || !p.owner) { this.release([id]); continue; }
      if (p.groupId) continue; // riding out to its share
      if (job.kind === 'pave') this.paveStep(p, job, record);
      else this.clearStep(p, job, record);
    }
  }

  private done(p: Piece, job: Paver | Feller) {
    this.workers.delete(p.id);
    if (p.routine === job.kind) { p.routine = undefined; this.game.world.touch(p); }
    this.finish(job.job, true);
  }

  private walk(p: Piece, tx: number, ty: number, record: Record): boolean {
    const w = this.game.world;
    const m = bestGaitMove(p, tx, ty, (x, y) => w.free(x, y, p.id), 90, 6);
    if (!m) return false;
    const fx = p.x, fy = p.y;
    p.facing = m.facing;
    if (!m.turn) w.movePiece(p, m.x, m.y); else w.touch(p);
    record(p, fx, fy);
    return true;
  }

  /**
   * A knight paves the next square of its stretch when it's beside it (PAVE_TURNS turns of
   * work each), and keeps up with the road. Done early, it takes half of a crewmate's
   * longest stretch left.
   */
  private paveStep(p: Piece, job: Paver, record: Record) {
    const w = this.game.world;
    job.going = false;
    while (job.i < job.squares.length && w.paved(...job.squares[job.i])) job.i++;
    if (job.i >= job.squares.length && !this.steal(p, job)) { this.done(p, job); return; }
    if (job.going) return;
    const [x, y] = job.squares[job.i];
    if (cheb(p.x, p.y, x, y) <= 2 && ++job.work >= PAVE_TURNS) {
      if (w.pave(x, y)) this.game.chronicle.note(p.owner, 'pave'); // quests count paved squares
      job.i++;
      job.work = 0;
      job.stuck = 0;
    }
    const [ax, ay] = job.squares[Math.min(job.i, job.squares.length - 1)];
    if (cheb(p.x, p.y, ax, ay) > 1) {
      const before = cheb(p.x, p.y, ax, ay);
      this.walk(p, ax, ay, record);
      if (cheb(p.x, p.y, ax, ay) >= before) job.stuck++;
    }
    // Hemmed in: ride around properly, and give up on this stretch if even that fails.
    if (job.stuck === 8) { job.going = true; this.game.orderMove(p.owner!, [p.id], [ax, ay], undefined, 40, undefined, true, true); }
    if (job.stuck > 30) { job.squares = job.squares.slice(job.i + 1); job.i = 0; job.stuck = 0; if (!job.squares.length) this.done(p, job); }
  }

  /** Take over the far half of the crewmate's longest stretch left; false if nothing's worth it. */
  private steal(p: Piece, job: Paver): boolean {
    let best: Paver | undefined, left = 0;
    for (const o of this.workers.values()) if (o !== job && o.kind === 'pave' && o.job === job.job && o.squares.length - o.i > left) { best = o; left = o.squares.length - o.i; }
    if (!best || left < 6) return false;
    const cut = best.i + Math.ceil(left / 2);
    job.squares = best.squares.slice(cut); job.i = 0; job.work = 0; job.stuck = 0;
    best.squares = best.squares.slice(0, cut);
    const [sx, sy] = job.squares[0];
    if (cheb(p.x, p.y, sx, sy) > 2) { job.going = true; this.game.orderMove(p.owner!, [p.id], [sx, sy], undefined, 60, undefined, true, true); }
    return true;
  }

  /** An elephant picks the nearest thing left to clear, walks beside it, and works it down. */
  private clearStep(p: Piece, job: Feller, record: Record) {
    const w = this.game.world, j = this.jobs.get(job.job);
    if (!j?.area) { this.done(p, job); return; }
    let n = job.target != null ? w.nodeAt(Math.floor(job.target / 1e6) - 500000, (job.target % 1e6) - 500000) : undefined;
    if (job.target != null && (!n || n.remaining <= 0)) { j.claimed.delete(job.target); job.target = undefined; n = undefined; }
    if (!n) {
      const left = this.targets(j.owner, j.area).filter((q) => !j.claimed.has(nk(q)) && !j.skip.has(nk(q)));
      if (!left.length) { this.done(p, job); return; }
      n = left.reduce((a, b) => (cheb(a.x, a.y, p.x, p.y) <= cheb(b.x, b.y, p.x, p.y) ? a : b));
      job.target = nk(n); job.work = 0; job.stuck = 0;
      j.claimed.add(job.target);
    }
    if (cheb(p.x, p.y, n.x, n.y) <= 1) {
      // Working it: a turn toward it, and it falls when the work is done.
      if (++job.work >= CLEAR_TURNS[n.kind as 'tree' | 'rock' | 'ore']) {
        w.drawNode(n, n.remaining, this.game.now);
        if (n.kind === 'tree') this.game.chronicle.note(p.owner, 'clear'); // quests count felled trees
        if (n.kind === 'tree') { n.dig = true; n.regrowAt = this.game.now + 60_000; } // the stump is dug out, not regrown
        j.claimed.delete(job.target!); job.target = undefined;
      }
      return;
    }
    const before = cheb(p.x, p.y, n.x, n.y);
    this.walk(p, n.x, n.y, record);
    if (cheb(p.x, p.y, n.x, n.y) >= before && ++job.stuck > 10) {
      // Can't get to it (walled in by other trees or water): leave it for later, or for someone else.
      j.claimed.delete(job.target!); j.skip.add(job.target!); job.target = undefined;
    }
  }
}

/** A node's key in a job's claimed and skipped sets. */
const nk = (n: { x: number; y: number }) => (n.x + 500000) * 1e6 + (n.y + 500000);
