// Life and juice (visuals.md): wind, particles, ripples, birds that react to
// troops, water glints, day and night with lit windows, and the conversion wave.
import { Container, Graphics, Text } from 'pixi.js';
import { isDecor, type PieceKind } from '@owc/shared';
import type { MoveEvent } from '@owc/client-core';
import type { Scene } from './scene.ts';
import { codeAt } from './terrain.ts';
import { hash01 } from '@owc/worldgen';
import { audio } from '../audio/audio.ts';
import { useUI } from '../store.ts';

const S = 64;

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number; add?: boolean }
interface Ring { x: number; y: number; t0: number; dur: number; color: number; r: number }
/** A bird circles its roost slowly; startled, it flies straight off and fades away. */
interface Bird { x: number; y: number; rx: number; ry: number; ang: number; rad: number; speed: number; flap: number; born: number; leave?: { vx: number; vy: number; t: number } }
interface Scheduled { at: number; run: () => void }
/** Words that float up and fade (a popped bubble's time saved). */
interface Floater { t: Text; x: number; y: number; t0: number; dur: number; rise: number; big: number }

/** Day length: 40 real minutes, the same for everyone (visuals.md §4). */
import { DAY_MS } from '@owc/shared';
const FILM_TIME = (() => { try { const t = new URLSearchParams(location.search).get('time'); return t === 'noon' ? 0.25 : t === 'dusk' ? 0.52 : t === 'night' ? 0.72 : t ? Number(t) : null; } catch { return null; } })();

export class Fx {
  layer = new Container();
  screenLayer = new Container();
  private g = new Graphics();
  private night = new Graphics();
  private lights = new Graphics();
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  /** Above the night and the bubbles: floating words. */
  top = new Container();
  private floaters: Floater[] = [];
  private birds: Bird[] = [];
  private queue: Scheduled[] = [];
  private scene: Scene;
  private lastFlock = 0;
  private recentSteps: { x: number; y: number; t: number }[] = [];
  darkness = 0;
  private prevSun: number | null = null;
  private lampsLit = new Set<string>();

  constructor(scene: Scene) {
    this.scene = scene;
    this.layer.addChild(this.night, this.g, this.lights);
    this.lights.blendMode = 'add';
  }

  /** A gusty wind field shared by trees, wheat and flags (visuals.md §4). */
  wind(x: number, y: number, t: number) {
    const gust = Math.max(0, Math.sin((x + y) * 0.045 - t * 0.7)) ** 3;
    return Math.sin(t * 1.4 + x * 0.23 + y * 0.17) * (0.35 + 0.65 * gust);
  }

  schedule(delay: number, run: () => void) { this.queue.push({ at: performance.now() + delay, run }); }

  dust(x: number, y: number, n = 8, color = 0xcbb68a) {
    if (useUI.getState().settings.reduceMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.4 + Math.random() * 1.2;
      this.particles.push({ x: (x + 0.5) * S, y: (y + 0.5) * S + S * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - 0.3, life: 0, max: 500 + Math.random() * 400, color, size: 3 + Math.random() * 5 });
    }
  }

  sparkle(x: number, y: number, color = 0xfff2b0, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.5;
      this.particles.push({ x: (x + 0.5) * S, y: (y + 0.5) * S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 0, max: 600 + Math.random() * 500, color, size: 2 + Math.random() * 3, add: true });
    }
  }

  /** One tiny glint at a world point (pixels), for gold bubbles. */
  glint(wx: number, wy: number) {
    this.particles.push({ x: wx, y: wy, vx: (Math.random() - 0.5) * 0.4, vy: -0.4 - Math.random() * 0.4, life: 0, max: 500 + Math.random() * 300, color: 0xfff2b0, size: 1.5 + Math.random() * 2, add: true });
  }

  /**
   * A popped hurry bubble (economy.md §7): a flash ring, droplets flung out, and the
   * time it saved floating up. Keep popping and the combo grows, with the words.
   */
  bubblePop(wx: number, wy: number, r: number, gold: boolean, combo: number, secs: number, full = false) {
    const reduce = useUI.getState().settings.reduceMotion;
    const n = (gold ? 28 : 12) + Math.min(12, combo);
    const colors = full ? (gold ? [0xd8ccaa, 0xb9a57a, 0xe8e2d0] : [0xd6d6dc, 0xaeb5bd, 0xc9c3cf]) : gold ? [0xffd76a, 0xfff2b0, 0xffb830, 0xffffff] : [0xffffff, 0xbfe8ff, 0xffc6f0, 0xfff3a6, 0xc7b4ff];
    for (let i = 0; i < (reduce ? Math.ceil(n / 3) : n); i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, sp = (gold ? 2.6 : 1.8) + Math.random() * 2.2;
      this.particles.push({ x: wx + Math.cos(a) * r * 0.8, y: wy + Math.sin(a) * r * 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.8, life: 0, max: 380 + Math.random() * 320, color: colors[i % colors.length], size: 2 + Math.random() * (gold ? 3.5 : 2.5), add: true });
    }
    this.rings.push({ x: wx, y: wy, t0: performance.now(), dur: gold ? 700 : 360, color: gold ? 0xffd76a : 0xe8f6ff, r: (r / S) * (gold ? 2.6 : 1.5) });
    if (gold) this.rings.push({ x: wx, y: wy, t0: performance.now() + 90, dur: 800, color: 0xfff2b0, r: (r / S) * 4 });
    // Every fifth pop in a row, a flourish.
    if (combo >= 5 && combo % 5 === 0) this.rings.push({ x: wx, y: wy, t0: performance.now(), dur: 900, color: 0xc7b4ff, r: (r / S) * 5 });
    // Waiting for room (full): the time still banks, and the words say why nothing appears.
    const words = full ? (secs > 0 ? `−${secs}s · no room` : 'No room') : `${gold ? '★ ' : ''}${secs > 0 ? `−${secs}s` : 'Hurry!'}${combo >= 3 ? `  ×${combo}` : ''}`;
    const t = new Text({ text: words, style: { fontFamily: 'Nunito, system-ui', fontWeight: '900', fontSize: gold && !full ? 30 : 24, fill: full ? 0xc9c6c0 : gold ? 0xffd76a : combo >= 10 ? 0xffc6f0 : combo >= 5 ? 0xbfe8ff : 0xffffff, stroke: { color: 0x23211f, width: 6 } } });
    t.anchor.set(0.5, 1);
    this.top.addChild(t);
    this.floaters.push({ t, x: wx, y: wy - r, t0: performance.now(), dur: gold ? 1400 : 950, rise: gold ? 70 : 46, big: 1 + Math.min(0.6, combo * 0.04) });
    if (this.floaters.length > 24) this.floaters.shift()!.t.destroy();
  }

  ripple(x: number, y: number, color = 0xffffff, r = 1) { this.rings.push({ x: (x + 0.5) * S, y: (y + 0.5) * S, t0: performance.now(), dur: 650, color, r }); }

  birth(x: number, y: number, color: string) {
    this.sparkle(x, y, parseInt(color.slice(1), 16), 16);
    this.ripple(x, y, 0xfff2b0, 1.2);
    if (this.onScreen(x, y)) audio.birth();
  }

  onScreen(x: number, y: number, margin = 2) {
    if (!this.scene.ready) return false;
    const [sx, sy] = this.scene.toScreen(x, y);
    const { width, height } = this.scene.app.screen;
    return sx > -margin * S && sy > -margin * S && sx < width + margin * S && sy < height + margin * S;
  }

  onStep(kind: PieceKind, e: MoveEvent, _p: unknown) {
    this.recentSteps.push({ x: e.to[0], y: e.to[1], t: performance.now() });
    if (this.onScreen(e.to[0], e.to[1])) audio.step(kind, e.turn, this.pan(e.to[0], e.to[1]));
  }

  landed(kind: PieceKind, x: number, y: number, dist: number) {
    if (kind === 'N') this.dust(x, y, 6);
    else if (kind === 'R' && dist >= 3) this.dust(x, y, 14, 0xbfa77a);
    else if (kind === 'Q' && dist >= 4) this.sparkle(x, y, 0xffffff, 6);
    // splash at fords
    if (codeAt(x, y) === 2) this.sparkle(x, y, 0xe6f6fb, 10);
  }

  pan(x: number, y: number) {
    const [sx] = this.scene.toScreen(x, y);
    return Math.max(-1, Math.min(1, (sx / this.scene.app.screen.width) * 2 - 1));
  }

  /** The big payoff: banners flip to the winner's color in a wave (visuals.md §5). */
  conversionWave(ids: number[], cx: number, cy: number, color: string) {
    const views = ids.map((id) => this.scene.pieces.get(id)).filter(Boolean);
    views.sort((a, b) => Math.hypot(a!.x - cx, a!.y - cy) - Math.hypot(b!.x - cx, b!.y - cy));
    views.forEach((v, i) => this.schedule(i * 90, () => {
      v!.flash = performance.now(); v!.flashColor = parseInt(color.slice(1), 16); v!.pop = performance.now();
      this.sparkle(v!.x, v!.y, v!.flashColor, 10);
      audio.cascade(i);
    }));
  }

  checkmate(cx: number, cy: number, color: string) {
    const c = parseInt(color.slice(1), 16);
    this.rings.push({ x: (cx + 0.5) * S, y: (cy + 0.5) * S, t0: performance.now(), dur: 1600, color: c, r: 14 });
    this.sparkle(cx, cy, c, 40);
  }

  update(now: number, _zsort: (x: number, y: number) => number, _counter: number) {
    const dt = this.scene.app.ticker.deltaMS;
    for (let i = this.queue.length - 1; i >= 0; i--) if (now >= this.queue[i].at) { const q = this.queue[i]; this.queue.splice(i, 1); q.run(); }
    const g = this.g;
    g.clear();
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt * 0.06; p.y += p.vy * dt * 0.06;
      if (p.color !== 0xd9d4cc) p.vy += 0.002 * dt; else p.size += dt * 0.004; // smoke rises and spreads
      const a = 1 - p.life / p.max;
      g.circle(p.x, p.y, p.size * (0.6 + 0.4 * a)).fill({ color: p.color, alpha: a * 0.85 });
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i], k = (now - r.t0) / r.dur;
      if (k >= 1) { this.rings.splice(i, 1); continue; }
      if (k < 0) continue;
      g.circle(r.x, r.y, S * r.r * (0.3 + 0.9 * k)).stroke({ width: (r.r > 4 ? 14 : 6) * (1 - k) + 1, color: r.color, alpha: (1 - k) * 0.9 });
    }
    // floating words: pop in, rise, fade; always upright and readable at any zoom
    const z = this.scene.cam.zoom, th = this.scene.theta;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i], k = (now - f.t0) / f.dur;
      if (k >= 1) { f.t.destroy(); this.floaters.splice(i, 1); continue; }
      const rise = f.rise * (1 - (1 - k) ** 3) / Math.max(0.5, z);
      f.t.position.set(f.x - Math.sin(th) * rise, f.y - Math.cos(th) * rise);
      f.t.rotation = -th;
      f.t.scale.set((0.8 / Math.max(0.5, z)) * f.big * (k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15))));
      f.t.alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    }
    this.updateSmoke(now);
    this.updateBirds(now, dt);
    this.updateWater(now);
    this.updateNight(now);
  }

  /** Chimney smoke from buildings that are working (visuals.md §10). */
  private lastSmoke = 0;
  private updateSmoke(now: number) {
    if (now - this.lastSmoke < 280 || useUI.getState().settings.reduceMotion) return;
    this.lastSmoke = now;
    const sc = this.scene;
    for (const b of sc.mirror.buildings.values()) {
      if (b.type === 'ruin' || b.built < 1 || b.blocked || !(b.type === 'house' || b.type === 'barracks' || b.type === 'palace' || b.type === 'stable')) continue;
      if (Math.random() > 0.35 || !this.onScreen(b.x, b.y, 1)) continue;
      const th = sc.theta, h = b.size * S * 0.95;
      const x = (b.x + b.size * 0.68) * S - Math.sin(th) * h, y = (b.y + b.size * 0.5) * S - Math.cos(th) * h;
      const up = 0.5 + Math.random() * 0.3;
      this.particles.push({ x, y, vx: -Math.sin(th) * up + (Math.random() - 0.5) * 0.2 + 0.15, vy: -Math.cos(th) * up, life: 0, max: 1800 + Math.random() * 900, color: 0xd9d4cc, size: 5 + Math.random() * 5 });
    }
  }

  /**
   * Dawn: town bells ring out, once per strike for the town's tier, rippling
   * gold over the rooftops; the birds take off (visuals.md §10). Dusk: one soft toll.
   */
  dawn(dusk: boolean) {
    const sc = this.scene;
    let strikes = 0;
    for (const d of sc.decor) {
      if (d.kind !== 'belltower') continue;
      const st = sc.settlementAt(d.x, d.y);
      const mine = sc.settlements.find((s) => s.id === st)?.owner === sc.mirror.me;
      if (!this.onScreen(d.x, d.y, 6) && !mine) continue;
      const n = dusk ? 1 : d.bell ?? 3;
      sc.bellUntil.set(st, performance.now() + n * 1300 + 1500);
      for (let i = 0; i < n && strikes < 12; i++, strikes++) {
        this.schedule(i * 1300 + Math.random() * 200, () => {
          // Each strike rolls out as two rings of light over the rooftops.
          const c = dusk ? 0xffb86b : 0xffe08a;
          this.rings.push({ x: (d.x + 0.5) * S, y: (d.y - 0.6) * S, t0: performance.now(), dur: 2200, color: c, r: 9 });
          this.rings.push({ x: (d.x + 0.5) * S, y: (d.y - 0.6) * S, t0: performance.now() + 250, dur: 2000, color: 0xffffff, r: 6 });
          this.sparkle(d.x, d.y - 1.2, c, 10);
          if (this.onScreen(d.x, d.y, 6)) audio.townBell(i, this.pan(d.x, d.y), dusk);
        });
      }
    }
    if (!dusk) for (const b of this.birds) if (!b.leave) b.leave = { vx: (Math.random() - 0.5) * 0.004, vy: -0.004, t: 0 };
    const day = Math.floor((sc.mirror.serverNow() - Date.UTC(2026, 8, 26)) / DAY_MS) + 1;
    useUI.getState().toast(dusk ? `Dusk falls · day ${day}` : `Dawn breaks · day ${day + 1}`, 'good', dusk ? 'moon' : 'sun');
  }

  private updateBirds(now: number, dt: number) {
    const sc = this.scene;
    // A small flock now and then, roosting in trees near the view (visuals.md §4).
    if (now - this.lastFlock > 12000) {
      this.lastFlock = now;
      const trees = [...sc.nodes.values()].filter((s) => (s as unknown as { kind: string }).kind === 'tree');
      if (this.birds.length < 6 && trees.length && Math.random() < 0.6) {
        const roost = trees[Math.floor(Math.random() * trees.length)] as unknown as { wx: number; wy: number };
        const dir = Math.random() < 0.5 ? 1 : -1, ang0 = Math.random() * Math.PI * 2;
        for (let i = 0; i < 3; i++)
          this.birds.push({ x: roost.wx, y: roost.wy, rx: roost.wx, ry: roost.wy, ang: ang0 + i * 0.35, rad: 2.6 + i * 0.3, speed: dir * (0.00032 + Math.random() * 0.00006), flap: Math.random() * 6, born: now });
      }
    }
    this.recentSteps = this.recentSteps.filter((s) => now - s.t < 1500);
    const g = this.g;
    const keep: Bird[] = [];
    for (const b of this.birds) {
      if (Math.hypot(b.rx - sc.cam.x, b.ry - sc.cam.y) > 70) continue;
      // Troops passing within 5 squares startle them (visuals.md §4).
      if (!b.leave) for (const s of this.recentSteps) if (Math.hypot(s.x - b.x, s.y - b.y) < 5) {
        const a = Math.atan2(b.y - s.y, b.x - s.x);
        b.leave = { vx: Math.cos(a) * 0.005, vy: Math.sin(a) * 0.005 - 0.002, t: 0 };
        if (Math.random() < 0.2) audio.birds();
        break;
      }
      let alpha = Math.min(1, (now - b.born) / 1200) * 0.7;
      if (b.leave) {
        // Straight away, easing up to speed, fading out over 3 seconds.
        b.leave.t += dt;
        const k = Math.min(1, b.leave.t / 600);
        b.x += b.leave.vx * dt * k; b.y += b.leave.vy * dt * k;
        alpha *= Math.max(0, 1 - b.leave.t / 3000);
        if (alpha <= 0) continue;
      } else {
        // A slow, smooth loop around the roost (about 20 seconds a lap).
        b.ang += b.speed * dt;
        b.x = b.rx + Math.cos(b.ang) * b.rad;
        b.y = b.ry + Math.sin(b.ang) * b.rad * 0.6;
      }
      keep.push(b);
      b.flap += dt * (b.leave ? 0.02 : 0.008);
      const px = (b.x + 0.5) * S, py = (b.y + 0.5) * S - S * 1.2, w = S * 0.13, f = Math.sin(b.flap) * w * 0.5;
      g.moveTo(px - w, py - f).lineTo(px, py).lineTo(px + w, py - f).stroke({ width: 2.5, color: 0x2b2622, alpha });
    }
    this.birds = keep;
  }

  private lastGlint = 0;
  private updateWater(now: number) {
    if (now - this.lastGlint < 120) return;
    this.lastGlint = now;
    const sc = this.scene;
    for (let i = 0; i < 4; i++) {
      const x = Math.round(sc.cam.x + (Math.random() - 0.5) * 30 / sc.cam.zoom), y = Math.round(sc.cam.y + (Math.random() - 0.5) * 20 / sc.cam.zoom);
      if (codeAt(x, y) === 2) this.particles.push({ x: (x + Math.random()) * S, y: (y + Math.random()) * S, vx: 0, vy: 0, life: 0, max: 700, color: 0xffffff, size: 2.5, add: true });
    }
  }

  /** Cosmetic day/night: color grading and warm windows at night. */
  private updateNight(now: number) {
    const sc = this.scene, m = sc.mirror;
    // ?time=noon|dusk|night pins the hour (filming, tools/shorts).
    const pin = FILM_TIME;
    const phase = pin ?? ((m.serverNow() % DAY_MS) + DAY_MS) % DAY_MS / DAY_MS;
    const sun = Math.sin(phase * Math.PI * 2);
    // The sun crossing the horizon: bells at dawn, a softer one at dusk.
    if (this.prevSun != null && this.prevSun < 0 && sun >= 0) this.dawn(false);
    if (this.prevSun != null && this.prevSun >= 0 && sun < 0) this.dawn(true);
    this.prevSun = sun;
    this.darkness = Math.max(0, Math.min(1, (-sun - 0.25) * 1.8)) * 0.3;
    const dusk = Math.max(0, 1 - Math.abs(sun) * 4) * 0.18;
    const n = this.night;
    n.clear();
    const view = 200 * S;
    const cx = (sc.cam.x + 0.5) * S, cy = (sc.cam.y + 0.5) * S;
    if (dusk > 0.01) n.rect(cx - view, cy - view, view * 2, view * 2).fill({ color: 0xff9a50, alpha: dusk });
    if (this.darkness > 0.01) n.rect(cx - view, cy - view, view * 2, view * 2).fill({ color: 0x1a2350, alpha: this.darkness });
    // Night moves above the ground but under the lights.
    const l = this.lights;
    l.clear();
    if (this.darkness < 0.05) return;
    const a = this.darkness * 1.6;
    // Lit windows: a soft pool (a few fading rings, not one hard disc) under real buildings, and
    // under the decorations that hold a flame (lamps, taverns, stalls). Walls and gardens stay dark.
    const pool = (x: number, y: number, r: number, alpha: number) => {
      for (const [k, f] of [[1, 0.22], [0.72, 0.3], [0.48, 0.4], [0.26, 0.55]] as const) l.circle(x, y, r * k).fill({ color: k > 0.6 ? 0xffb347 : 0xffd27a, alpha: alpha * f });
    };
    for (const b of m.buildings.values()) {
      if (b.type === 'ruin' || b.built < 1) continue;
      if (isDecor(b.type) && b.type !== 'lamp' && b.type !== 'tavern' && b.type !== 'stall') continue;
      const bx = (b.x + b.size / 2) * S, by = (b.y + b.size / 2) * S;
      const flick = 0.85 + 0.15 * Math.sin(now / 180 + b.id * 3);
      pool(bx, b.type === 'lamp' ? by - S * 0.2 : by, b.type === 'lamp' ? S * 0.85 : S * (0.55 + b.size * 0.3), a * flick * (b.type === 'lamp' ? 1 : 0.8));
    }
    // Street lamps light one by one as the dark deepens, each with a little spark.
    for (const d of sc.decor) {
      if (!d.light) continue;
      const id = `${d.x},${d.y}`;
      const threshold = 0.04 + hash01(sc.mirror.seed, d.x, d.y, 440) * 0.12;
      if (this.darkness < threshold) { this.lampsLit.delete(id); continue; }
      if (!this.lampsLit.has(id)) { this.lampsLit.add(id); this.sparkle(d.x, d.y - 0.4, 0xffe3a0, 6); }
      pool((d.x + 0.5) * S, (d.y + 0.5) * S - S * 0.2, S * 0.85, a);
    }
    // Pawns drilling at night carry lanterns.
    for (const [id, v] of sc.pieces) {
      const p = m.pieces.get(id);
      if (!p || p.kind !== 'P' || p.routine !== 'drill') continue;
      l.circle((v.x + 0.5) * S, (v.y + 0.5) * S, S * 0.7).fill({ color: 0xffc36b, alpha: a * 0.3 });
    }
  }
}
