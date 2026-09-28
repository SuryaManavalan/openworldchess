// Input (ux.md §3): touch gestures and mouse/keyboard both turn into the same
// commands. One model everywhere: select, then direct.
import { BUILDINGS, REACH, cheb, type Piece } from '@owc/shared';
import { pickSet } from '@owc/rules';
import type { Scene } from './scene.ts';
import { commands, mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { audio } from '../audio/audio.ts';
import { checkPlacement } from './placement.ts';

interface Ptr { id: number; x: number; y: number; sx: number; sy: number; t0: number; type: string; button: number }

const TAP_MOVE = 10;
const LONG_PRESS = 420;

const haptic = (ms = 10) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };

export class Input {
  scene: Scene;
  private ptrs = new Map<number, Ptr>();
  private mode: 'none' | 'pan' | 'command' | 'lasso' | 'box' | 'pinch' | 'ghost' = 'none';
  private longTimer: ReturnType<typeof setTimeout> | null = null;
  private longFired = false;
  private lastTap = { t: 0, x: 0, y: 0 };
  private pinch = { d: 0, a: 0, mx: 0, my: 0, rotAcc: 0 };
  private vel = { x: 0, y: 0 };
  private keys = new Set<string>();
  private lassoPts: [number, number][] = [];
  pendingMove: [number, number] | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    const el = scene.app.canvas;
    el.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Any real gesture anywhere (buttons and sheets included) can start the sound.
    const unlockAudio = () => audio.unlock().then(() => audio.setVolumes(useUI.getState().settings));
    window.addEventListener('pointerdown', unlockAudio, true);
    window.addEventListener('keydown', unlockAudio, true);
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    scene.app.ticker.add(() => this.tick());
  }

  /** Until when wheel events count as a touchpad's (one gesture keeps its reading). */
  private padUntil = 0;
  /**
   * The wheel (ux.md §3). A touchpad's two-finger swipe pans and its pinch zooms (browsers send
   * a pinch as a wheel with Ctrl held); a mouse wheel zooms. A touchpad scrolls in small,
   * smooth steps, often sideways too; a mouse wheel in fixed notches, straight up and down.
   */
  private wheel(e: WheelEvent) {
    e.preventDefault();
    this.touched();
    const now = performance.now();
    if (e.ctrlKey) { this.scene.zoomBy(Math.exp(-e.deltaY * 0.01), e.offsetX, e.offsetY); return; }
    const pad = e.deltaMode === 0 && (e.deltaX !== 0 || !Number.isInteger(e.deltaY) || Math.abs(e.deltaY) < 40);
    if (pad) this.padUntil = now + 400;
    if (pad || now < this.padUntil) { this.panScreen(-e.deltaX, -e.deltaY); this.padUntil = now + 400; return; }
    this.scene.zoomBy(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY);
  }

  private touched() {
    this.scene.lastInput = Date.now();
    if (useUI.getState().watching) useUI.getState().set({ watching: false });
    audio.unlock().then(() => audio.setVolumes(useUI.getState().settings));
  }

  /** On touch, a command aims 80px above the finger so the thumb never hides the target (ux.md §3). */
  private aim(p: Ptr): [number, number] {
    return p.type === 'mouse' ? this.sq(p) : this.scene.toSquare(p.x, p.y - 80);
  }

  private sq(e: { offsetX: number; offsetY: number } | Ptr): [number, number] {
    const [x, y] = 'offsetX' in e ? this.scene.toSquare(e.offsetX, e.offsetY) : this.scene.toSquare(e.x, e.y);
    return [x, y];
  }
  private local(e: PointerEvent) {
    const r = this.scene.app.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ---------- pointer ----------

  private down(e: PointerEvent) {
    this.touched();
    const { x, y } = this.local(e);
    const p: Ptr = { id: e.pointerId, x, y, sx: x, sy: y, t0: performance.now(), type: e.pointerType, button: e.button };
    this.ptrs.set(e.pointerId, p);
    this.vel = { x: 0, y: 0 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (this.ptrs.size === 2) {
      this.cancelLong();
      const [a, b] = [...this.ptrs.values()];
      this.mode = 'pinch';
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, rotAcc: 0 };
      this.scene.pathPreview = null; this.scene.lasso = null; this.scene.box = null;
      return;
    }
    if (this.ptrs.size > 2) return;
    this.mode = 'none';
    this.longFired = false;
    const ui = useUI.getState();
    if (ui.buildType) { this.mode = 'ghost'; this.updateGhost(this.sq(p)); return; }
    if (e.pointerType === 'mouse') {
      // Middle-drag, or Ctrl / Space held with any drag, pans (for touchpads: ux.md §3).
      if (e.button === 1 || e.ctrlKey || this.keys.has(' ')) this.mode = 'pan';
      return;
    }
    // touch: long-press starts a lasso (ux.md §3)
    this.longTimer = setTimeout(() => {
      this.longFired = true;
      if (this.mode === 'none') {
        haptic(15);
        this.mode = 'lasso';
        this.lassoPts = [this.sq(p)];
        this.scene.lasso = this.lassoPts;
      }
    }, LONG_PRESS);
  }

  private cancelLong() { if (this.longTimer) clearTimeout(this.longTimer); this.longTimer = null; }

  private move(e: PointerEvent) {
    const { x, y } = this.local(e);
    const p = this.ptrs.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') {
        const [sx, sy] = this.scene.toSquare(x, y);
        this.scene.hover = [Math.round(sx), Math.round(sy)];
        const hp = this.scene.pickPiece(sx, sy, 0.6), hb = hp ? undefined : this.scene.pickBuilding(sx, sy);
        this.scene.hoverInfo = hp || hb ? { piece: hp?.id, building: hb?.id, sx: e.clientX, sy: e.clientY } : null;
        if (useUI.getState().buildType) this.updateGhost([sx, sy]);
      }
      return;
    }
    const dx = x - p.x, dy = y - p.y;
    p.x = x; p.y = y;
    const moved = Math.hypot(x - p.sx, y - p.sy);
    const sc = this.scene;
    if (this.mode === 'pinch' && this.ptrs.size >= 2) {
      const [a, b] = [...this.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      sc.zoomBy(d / Math.max(1, this.pinch.d), mx, my);
      this.panScreen(mx - this.pinch.mx, my - this.pinch.my);
      // Two-finger twist rotates in 90° steps with a haptic tick (ux.md §3).
      let da = ang - this.pinch.a;
      if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
      this.pinch.rotAcc += da;
      if (Math.abs(this.pinch.rotAcc) > 0.6) { sc.rotate(this.pinch.rotAcc > 0 ? -1 : 1); this.pinch.rotAcc = 0; haptic(12); }
      this.pinch.d = d; this.pinch.a = ang; this.pinch.mx = mx; this.pinch.my = my;
      return;
    }
    if (this.mode === 'ghost') { this.updateGhost(this.sq(p)); return; }
    if (this.mode === 'none' && moved > TAP_MOVE) {
      this.cancelLong();
      const [wx, wy] = this.sq({ ...p, x: p.sx, y: p.sy });
      const under = sc.pickPiece(wx, wy, 0.75);
      const sel = useUI.getState().selection;
      // Choosing land to clear: any drag marks out the area (movement.md §9).
      if (useUI.getState().orderMode === 'clear' && p.button !== 2 && p.button !== 1) { this.mode = 'box'; sc.box = { a: [wx, wy], b: [wx, wy] }; }
      else if (p.type === 'mouse') {
        if (p.button === 2 || p.button === 1) this.mode = 'pan';
        else if (under && sel.includes(under.id)) this.mode = 'command';
        else { this.mode = 'box'; sc.box = { a: [wx, wy], b: [wx, wy] }; }
      } else this.mode = under && sel.includes(under.id) ? 'command' : 'pan';
    }
    // Swiping across bubbles pops them, like running a thumb over bubble wrap.
    if (this.mode === 'pan' || this.mode === 'box') this.popAt(this.sq(p));
    if (this.mode === 'pan') { this.panScreen(dx, dy); this.vel = { x: dx, y: dy }; }
    else if (this.mode === 'command') this.previewCommand(this.aim(p));
    else if (this.mode === 'lasso') {
      const s = this.sq(p);
      const last = this.lassoPts[this.lassoPts.length - 1];
      if (Math.hypot(s[0] - last[0], s[1] - last[1]) > 0.3) this.lassoPts.push(s);
    } else if (this.mode === 'box' && sc.box) sc.box.b = this.sq(p);
  }

  private up(e: PointerEvent, cancelled = false) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    this.ptrs.delete(e.pointerId);
    this.cancelLong();
    const sc = this.scene;
    if (this.mode === 'pinch') { if (this.ptrs.size === 0) this.mode = 'none'; return; }
    const moved = Math.hypot(p.x - p.sx, p.y - p.sy);
    const at = this.sq(p);
    if (cancelled) { this.reset(); return; }
    switch (this.mode) {
      case 'command': this.finishCommand(this.aim(p)); break;
      case 'lasso': this.finishLasso(); break;
      case 'box': this.finishBox(); break;
      case 'ghost':
        if (p.type === 'mouse') this.placeBuilding();
        break;
      case 'pan': break;
      default:
        if (moved <= TAP_MOVE) {
          if (p.type === 'mouse' && p.button === 2) this.rightClick(at);
          else if (this.longFired) this.longPress(at);
          else this.tap(at, p.type);
        }
    }
    this.reset();
  }

  private reset() {
    this.mode = 'none';
    this.scene.pathPreview = null; this.scene.lasso = null; this.scene.box = null;
  }

  private panScreen(dx: number, dy: number) {
    const sc = this.scene;
    const th = sc.theta, z = sc.cam.zoom * 64;
    // screen delta → world delta (inverse rotation)
    const wx = (dx * Math.cos(th) + dy * Math.sin(th)) / z, wy = (-dx * Math.sin(th) + dy * Math.cos(th)) / z;
    sc.cam.x -= wx; sc.cam.y -= wy;
  }

  // ---------- gestures → commands ----------

  private myPiece(x: number, y: number) {
    const p = this.scene.pickPiece(x, y, 0.75);
    return p && p.owner === mirror.me ? p : undefined;
  }

  /**
   * A king's best legal army (ux.md §3): the chess set it would fight with (a queen,
   * 2 rooks, 2 bishops, 2 knights, 8 pawns), filled with its nearest pieces that
   * aren't recovering from a battle. The same rule the server uses to pick a battle set.
   */
  armyOf(king: Piece): number[] {
    const now = mirror.serverNow();
    const near = mirror.myPieces().filter((q) => q.state !== 'battle' && cheb(q.x, q.y, king.x, king.y) <= REACH && (q.kind !== 'K' || q.id === king.id) && (q.id === king.id || (q.cooldownUntil ?? 0) <= now));
    return pickSet(king.id, near, king.x, king.y).set.map((q) => q.id);
  }

  /** The group a king leads: all your pieces within its reach (movement.md §4). */
  groupOf(p: Piece): number[] {
    const king = p.kind === 'K' ? p : mirror.myKings().filter((k) => cheb(k.x, k.y, p.x, p.y) <= REACH).sort((a, b) => cheb(a.x, a.y, p.x, p.y) - cheb(b.x, b.y, p.x, p.y))[0];
    if (!king) return [p.id];
    return mirror.myPieces().filter((q) => q.state !== 'battle' && cheb(q.x, q.y, king.x, king.y) <= REACH && (q.kind !== 'K' || q.id === king.id)).map((q) => q.id);
  }

  /** Pop the hurry bubble at a point, if there is one. */
  private popAt(at: [number, number]): boolean {
    const hit = this.scene.bubbles.pick(at[0], at[1]);
    if (!hit) return false;
    const gold = this.scene.bubbles.pop(hit.building, hit.i);
    if (gold == null) return false;
    commands.popBubble(hit.building, hit.i);
    haptic(gold ? 30 : 8);
    return true;
  }

  private tap(at: [number, number], type: string) {
    const ui = useUI.getState(), sc = this.scene;
    if (ui.flagMode) { ui.addFlag(at[0], at[1]); sc.fx.ripple(Math.round(at[0]), Math.round(at[1]), 0xe3b23c); haptic(15); return; }
    // A hurry bubble floats above everything else (economy.md §7).
    if (this.popAt(at)) return;
    // A work order waiting for its place (movement.md §9).
    if (ui.orderMode && !ui.selection.length) ui.set({ orderMode: null });
    if (ui.orderMode && ui.selection.length) {
      const to: [number, number] = [Math.round(at[0]), Math.round(at[1])];
      if (ui.orderMode === 'pave') { void commands.pave(ui.selection, to); sc.fx.ripple(to[0], to[1], 0xa39a8b); audio.commit(); haptic(); }
      else ui.set({ pendingClear: { ids: ui.selection, a: [to[0] - 4, to[1] - 4], b: [to[0] + 4, to[1] + 4] } });
      ui.set({ orderMode: null });
      return;
    }
    const now = performance.now();
    const dbl = now - this.lastTap.t < 320 && Math.hypot(at[0] - this.lastTap.x, at[1] - this.lastTap.y) < 1.2;
    this.lastTap = { t: now, x: at[0], y: at[1] };
    const mine = this.myPiece(at[0], at[1]);
    if (mine) {
      this.pendingMove = null;
      // Double-tap: everything under that king. Tap a king: its best army. Tap a piece: just it.
      if (dbl) { const g = this.groupOf(mine); this.selectWithSound(g); haptic(); return; }
      const sel = ui.selection;
      // Adding (the Add button, or Shift): each tap puts a piece in or takes it out.
      if (this.keys.has('Shift') || (sel.length && ui.lassoMode)) { this.selectWithSound(sel.includes(mine.id) ? sel.filter((i) => i !== mine.id) : [...sel, mine.id]); return; }
      // Tapping the one piece you have selected lets it go.
      if (sel.length === 1 && sel[0] === mine.id) { ui.select([]); haptic(6); return; }
      // A king brings its army (the bar offers everything near it, or the king alone); a piece is just itself.
      this.selectWithSound(mine.kind === 'K' ? this.armyOf(mine) : [mine.id]);
      return;
    }
    const arena = sc.pickArena(at[0], at[1]);
    if (arena) { useUI.getState().set({ battleFocus: arena.id }); return; }
    const other = sc.pickPiece(at[0], at[1], 0.75);
    if (other && ui.selection.length && type !== 'mouse') { this.issue(at, other); return; }
    // Someone else's piece or camp: show what it is (ux.md §3).
    if (other) { ui.set({ inspect: { piece: other.id } }); haptic(8); return; }
    const b = sc.pickBuilding(at[0], at[1]);
    if (b && b.owner === mirror.me && !ui.selection.length) { ui.set({ sheet: 'details', selection: [] }); useUI.getState().set({ hint: `building:${b.id}` }); return; }
    if (b && b.owner !== mirror.me && (!ui.selection.length || type === 'mouse')) { ui.set({ inspect: { building: b.id } }); return; }
    if (ui.inspect) ui.set({ inspect: null });
    if (ui.selection.length) {
      if (type === 'mouse') { if (!ui.lassoMode) ui.select([]); return; }
      // Two-step command for touch: tap the ground to place, then confirm (ux.md §3). Tapping the
      // marker again confirms it, like the Move here button.
      const to: [number, number] = [Math.round(at[0]), Math.round(at[1])];
      if (this.pendingMove && Math.max(Math.abs(this.pendingMove[0] - to[0]), Math.abs(this.pendingMove[1] - to[1])) <= 1) { this.issue(this.pendingMove); ui.bump(); return; }
      this.pendingMove = to;
      sc.pendingMarker = this.pendingMove;
      sc.pathPreview = null;
      ui.bump();
      return;
    }
  }

  private longPress(at: [number, number]) {
    const mine = this.myPiece(at[0], at[1]);
    if (mine) { this.selectWithSound(this.groupOf(mine)); haptic(); return; }
    // Long-press empty ground: drop a flag there.
    if (!this.scene.pickPiece(at[0], at[1], 0.75) && !this.scene.pickBuilding(at[0], at[1])) { useUI.getState().addFlag(at[0], at[1]); this.scene.fx.ripple(Math.round(at[0]), Math.round(at[1]), 0xe3b23c); haptic(20); useUI.getState().toast('Flag placed'); }
  }

  private rightClick(at: [number, number]) {
    const sel = useUI.getState().selection;
    if (!sel.length) return;
    this.issue(at, this.scene.pickPiece(at[0], at[1], 0.75));
  }

  private previewCommand(at: [number, number]) {
    const sel = useUI.getState().selection.map((id) => mirror.pieces.get(id)).filter(Boolean) as Piece[];
    if (!sel.length) return;
    const lead = sel.find((p) => p.kind === 'K') ?? sel[0];
    const target = this.scene.pickPiece(at[0], at[1], 0.75);
    const enemy = !!target && target.owner !== mirror.me;
    const to: [number, number] = [Math.round(at[0]), Math.round(at[1])];
    this.scene.pathPreview = { from: [lead.x, lead.y], to, ok: true, attack: enemy };
  }

  private finishCommand(at: [number, number]) {
    const target = this.scene.pickPiece(at[0], at[1], 0.75);
    this.issue(at, target);
  }

  /** Move there, or attack whatever king holds the thing there. */
  issue(at: [number, number], target?: Piece) {
    const ui = useUI.getState();
    const sel = ui.selection;
    if (!sel.length) return;
    const b = !target ? this.scene.pickBuilding(at[0], at[1]) : undefined;
    const enemyOwner = target && target.owner !== mirror.me ? target.owner : b && b.owner && b.owner !== mirror.me ? b.owner : null;
    if (enemyOwner) {
      const ref = target ?? { x: b!.x, y: b!.y };
      const kings = [...mirror.pieces.values()]
        .filter((p) => p.owner === enemyOwner && p.kind === 'K' && p.state !== 'battle')
        .sort((a, c) => cheb(a.x, a.y, ref.x, ref.y) - cheb(c.x, c.y, ref.x, ref.y));
      // A piece answers through the king whose reach it's in. A troop out on its own without
      // a king can still be attacked: the server names one of its pawns commander (battle.md §9).
      const inReach = kings[0] && cheb(kings[0].x, kings[0].y, ref.x, ref.y) <= REACH ? kings[0] : undefined;
      const wild = !!mirror.players.get(enemyOwner)?.wild;
      // A building held without a king (an altar's, economy.md §8): the pieces tending it answer.
      const keeper = !target && b && !inReach && !wild ? [...mirror.pieces.values()].filter((p) => p.owner === enemyOwner && p.state !== 'battle' && cheb(p.x, p.y, b.x, b.y) <= 6).sort((a, c) => cheb(a.x, a.y, b.x, b.y) - cheb(c.x, c.y, b.x, b.y))[0] : undefined;
      const king = target?.kind === 'K' ? target : inReach ?? keeper ?? (target && !wild ? target : kings[0]);
      if (!king) { ui.toast('No enemy king there to challenge', 'error'); return; }
      this.attack(sel, king, enemyOwner);
      return;
    }
    const to: [number, number] = [Math.round(at[0]), Math.round(at[1])];
    this.scene.fx.ripple(to[0], to[1], 0xffffff);
    audio.commit(); haptic();
    this.pendingMove = null;
    this.scene.pendingMarker = null;
    const key = sel.slice().sort((a, b) => a - b).join(',');
    this.scene.moveTargets.set(key, { to, ids: sel, attack: false, t0: performance.now() });
    commands.move(sel, to).then((err) => { if (err) { audio.error(); this.scene.moveTargets.delete(key); } });
  }

  /** Challenge an enemy king: a confirm sheet first (ux.md §3). Raiding the wilds needs no king (battle.md §9): a pawn leads as commander. */
  private attack(sel: number[], king: Piece, enemyOwner: string) {
    const ui = useUI.getState();
    const hasKing = sel.some((id) => mirror.pieces.get(id)?.kind === 'K');
    const wild = !!mirror.players.get(enemyOwner)?.wild;
    const raid = !hasKing && wild && sel.some((id) => mirror.pieces.get(id)?.kind === 'P');
    if (!hasKing && !raid) { ui.toast(wild ? 'A raid on the wilds needs a king or at least one pawn' : 'An attack on an empire needs a king in your selection', 'error'); audio.error(); return; }
    const siege = [...mirror.buildings.values()].some((bl) => bl.owner === enemyOwner && cheb(bl.x, bl.y, king.x, king.y) <= REACH);
    ui.set({ pendingAttack: { pieceIds: sel, targetKingId: king.id, name: mirror.players.get(enemyOwner)?.name ?? 'enemy', siege, raid, kingless: king.kind !== 'K' || undefined } });
    audio.attack(); haptic(20);
  }

  private selectWithSound(ids: number[]) {
    useUI.getState().select(ids);
    ids.slice(0, 14).forEach((_, i) => audio.select(i));
  }

  private finishLasso() {
    const pts = this.lassoPts;
    // Held without drawing: that's a long-press.
    if (pts.length < 3) { if (pts[0]) this.longPress(pts[0]); return; }
    const inside = (x: number, y: number) => {
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const found = mirror.myPieces().filter((p) => p.state !== 'battle' && inside(p.x, p.y)).map((p) => p.id);
    // While adding, a loop adds to what's selected.
    const ids = useUI.getState().lassoMode ? [...new Set([...useUI.getState().selection, ...found])] : found;
    // Pop one after another along the loop (visuals.md §5).
    ids.forEach((id, i) => this.scene.fx.schedule(i * 45, () => { const v = this.scene.pieces.get(id); if (v) v.pop = performance.now(); }));
    this.selectWithSound(ids);
    if (ids.length) haptic(12);
  }

  private finishBox() {
    const b = this.scene.box;
    if (!b) return;
    const [x0, x1] = [Math.min(b.a[0], b.b[0]), Math.max(b.a[0], b.b[0])], [y0, y1] = [Math.min(b.a[1], b.b[1]), Math.max(b.a[1], b.b[1])];
    const ui = useUI.getState();
    if (ui.orderMode === 'clear') {
      ui.set({ orderMode: null, pendingClear: { ids: ui.selection, a: [Math.round(x0), Math.round(y0)], b: [Math.round(x1), Math.round(y1)] } });
      return;
    }
    const ids = mirror.myPieces().filter((p) => p.state !== 'battle' && p.x >= x0 - 0.5 && p.x <= x1 + 0.5 && p.y >= y0 - 0.5 && p.y <= y1 + 0.5).map((p) => p.id);
    const sel = this.keys.has('Shift') || ui.lassoMode ? [...new Set([...ui.selection, ...ids])] : ids;
    this.selectWithSound(sel);
  }

  // ---------- building ----------

  updateGhost(at: [number, number]) {
    const ui = useUI.getState();
    if (!ui.buildType) return;
    const size = BUILDINGS[ui.buildType].size;
    const x = Math.round(at[0] - (size - 1) / 2), y = Math.round(at[1] - (size - 1) / 2);
    const res = checkPlacement(ui.buildType, x, y);
    ui.set({ ghost: { x, y, ok: res.ok, reason: res.reason } });
  }

  placeBuilding() {
    const ui = useUI.getState();
    if (!ui.buildType || !ui.ghost) return;
    const { x, y, ok, reason } = ui.ghost;
    if (!ok) { ui.toast(reason, 'error'); audio.error(); return; }
    const type = ui.buildType;
    commands.build(type, [x, y]).then((err) => {
      if (!err) { audio.build(); this.scene.fx.dust(x, y, 12); haptic(15); ui.set({ buildType: null, ghost: null }); }
      else audio.error();
    });
  }

  // ---------- keyboard ----------

  private key(e: KeyboardEvent, down: boolean) {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (down) this.keys.add(k); else this.keys.delete(k);
    if (!down) return;
    this.touched();
    const ui = useUI.getState(), sc = this.scene;
    if (k === 'q') sc.rotate(-1);
    else if (k === 'e') sc.rotate(1);
    else if (k === 'Escape') { if (ui.orderMode) ui.set({ orderMode: null }); else if (ui.buildType) ui.set({ buildType: null, ghost: null }); else if (ui.battleFocus) ui.set({ battleFocus: null }); else { ui.select([]); this.pendingMove = null; sc.pendingMarker = null; } }
    else if (k === 's' && !e.ctrlKey) { if (ui.selection.length) commands.stop(ui.selection); }
    else if (k === 'b') ui.set({ sheet: ui.sheet === 'build' ? null : 'build' });
    else if (k === 'f' && this.scene.hover) { ui.addFlag(this.scene.hover[0], this.scene.hover[1]); this.scene.fx.ripple(this.scene.hover[0], this.scene.hover[1], 0xe3b23c); }
    else if (k === 'h' || k === 'Home') { const emp = mirror.myPieces().find((p) => p.emperor); if (emp) sc.centerOn(emp.x, emp.y); }
    else if (k === '+' || k === '=') sc.zoomBy(1.15);
    else if (k === '-') sc.zoomBy(1 / 1.15);
    else if (k === 'a' && e.ctrlKey) { e.preventDefault(); this.selectWithSound(mirror.myPieces().filter((p) => p.state !== 'battle').map((p) => p.id)); }
  }

  private tick() {
    const sc = this.scene, dt = sc.app.ticker.deltaMS;
    const speed = (0.5 * dt) / Math.max(0.3, sc.cam.zoom);
    let dx = 0, dy = 0;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) dy -= 1;
    if (this.keys.has('s') && !this.keys.has('Control') && !useUI.getState().selection.length) dy += 1;
    if (this.keys.has('ArrowDown')) dy += 1;
    if (this.keys.has('a') && !this.keys.has('Control') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) dx += 1;
    if (dx || dy) { this.panScreen(-dx * speed * 1.8, -dy * speed * 1.8); sc.lastInput = Date.now(); }
    // inertia after a touch pan
    if (this.mode === 'none' && (Math.abs(this.vel.x) > 0.1 || Math.abs(this.vel.y) > 0.1)) {
      this.panScreen(this.vel.x, this.vel.y);
      this.vel.x *= 0.92; this.vel.y *= 0.92;
    }
  }
}
