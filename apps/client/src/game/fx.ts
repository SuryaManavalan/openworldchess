// Life and juice (visuals.md): wind, particles, ripples, birds that react to
// troops, water glints, day and night with lit windows, and the conversion wave.
import { Container, Graphics } from 'pixi.js';
import type { PieceKind } from '@owc/shared';
import type { MoveEvent } from '@owc/client-core';
import type { Scene } from './scene.ts';
import { codeAt } from './terrain.ts';
import { audio } from '../audio/audio.ts';
import { useUI } from '../store.ts';

const S = 64;

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number; add?: boolean }
interface Ring { x: number; y: number; t0: number; dur: number; color: number; r: number }
interface Bird { x: number; y: number; vx: number; vy: number; rx: number; ry: number; scared: number; flap: number }
interface Scheduled { at: number; run: () => void }

/** Day length: 40 real minutes, the same for everyone (visuals.md §4). */
const DAY_MS = 40 * 60_000;

export class Fx {
  layer = new Container();
  screenLayer = new Container();
  private g = new Graphics();
  private night = new Graphics();
  private lights = new Graphics();
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private birds: Bird[] = [];
  private queue: Scheduled[] = [];
  private scene: Scene;
  private lastFlock = 0;
  private recentSteps: { x: number; y: number; t: number }[] = [];
  darkness = 0;

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
      p.x += p.vx * dt * 0.06; p.y += p.vy * dt * 0.06; p.vy += 0.002 * dt;
      const a = 1 - p.life / p.max;
      g.circle(p.x, p.y, p.size * (0.6 + 0.4 * a)).fill({ color: p.color, alpha: a * 0.85 });
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i], k = (now - r.t0) / r.dur;
      if (k >= 1) { this.rings.splice(i, 1); continue; }
      g.circle(r.x, r.y, S * r.r * (0.3 + 0.9 * k)).stroke({ width: 6 * (1 - k) + 1, color: r.color, alpha: 1 - k });
    }
    this.updateBirds(now, dt);
    this.updateWater(now);
    this.updateNight(now);
  }

  private updateBirds(now: number, dt: number) {
    const sc = this.scene;
    // Keep a flock roosting near trees close to the camera.
    if (now - this.lastFlock > 4000) {
      this.lastFlock = now;
      const trees = [...sc.nodes.values()].filter((s) => (s as unknown as { kind: string }).kind === 'tree');
      if (this.birds.length < 14 && trees.length) {
        const roost = trees[Math.floor(Math.random() * trees.length)] as unknown as { wx: number; wy: number };
        for (let i = 0; i < 5; i++) this.birds.push({ x: roost.wx + Math.random() * 2, y: roost.wy + Math.random() * 2, vx: 0, vy: 0, rx: roost.wx, ry: roost.wy, scared: 0, flap: Math.random() * 6 });
      }
      this.birds = this.birds.filter((b) => Math.hypot(b.x - sc.cam.x, b.y - sc.cam.y) < 60);
    }
    this.recentSteps = this.recentSteps.filter((s) => now - s.t < 1500);
    const g = this.g;
    for (const b of this.birds) {
      // Scatter from troops within 6 squares (visuals.md §4).
      for (const s of this.recentSteps) if (Math.hypot(s.x - b.x, s.y - b.y) < 6 && b.scared <= 0) {
        b.scared = 3500; const a = Math.atan2(b.y - s.y, b.x - s.x);
        b.vx = Math.cos(a) * 0.012; b.vy = Math.sin(a) * 0.012;
        if (Math.random() < 0.3) audio.birds();
      }
      if (b.scared > 0) { b.scared -= dt; }
      else {
        // orbit the roost lazily
        const ang = Math.atan2(b.y - b.ry, b.x - b.rx) + 0.9;
        const tx = b.rx + Math.cos(ang) * 3, ty = b.ry + Math.sin(ang) * 2;
        b.vx += (tx - b.x) * 0.00002 * dt; b.vy += (ty - b.y) * 0.00002 * dt;
        b.vx *= 0.985; b.vy *= 0.985;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.flap += dt * (b.scared > 0 ? 0.03 : 0.012);
      const px = (b.x + 0.5) * S, py = (b.y + 0.5) * S - S * 1.2, w = S * 0.14, f = Math.sin(b.flap) * w * 0.7;
      g.moveTo(px - w, py - f).lineTo(px, py).lineTo(px + w, py - f).stroke({ width: 3, color: 0x2b2622, alpha: 0.75 });
    }
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
    const phase = ((m.serverNow() % DAY_MS) + DAY_MS) % DAY_MS / DAY_MS;
    const sun = Math.sin(phase * Math.PI * 2);
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
    for (const b of m.buildings.values()) {
      if (b.type === 'ruin' || b.built < 1) continue;
      const bx = (b.x + b.size / 2) * S, by = (b.y + b.size / 2) * S;
      const flick = 0.85 + 0.15 * Math.sin(now / 180 + b.id * 3);
      l.circle(bx, by, S * (0.9 + b.size * 0.5)).fill({ color: 0xffb347, alpha: a * 0.28 * flick });
      l.circle(bx, by, S * 0.45 * b.size).fill({ color: 0xffd27a, alpha: a * 0.35 * flick });
    }
    // Pawns drilling at night carry lanterns.
    for (const [id, v] of sc.pieces) {
      const p = m.pieces.get(id);
      if (!p || p.kind !== 'P' || p.routine !== 'drill') continue;
      l.circle((v.x + 0.5) * S, (v.y + 0.5) * S, S * 0.7).fill({ color: 0xffc36b, alpha: a * 0.3 });
    }
  }
}
