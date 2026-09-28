// Hurry bubbles (economy.md §7): the server grows them over your working buildings;
// tapping (or swiping across) one pops it, and that building jumps ahead. Popping is
// meant to feel like bubble wrap: each bubble wobbles, springs in, bursts into
// droplets with a pitch that climbs while you keep a combo going, and now and then
// one is gold.
import { Container, Sprite, Text, Texture } from 'pixi.js';
import { BUILDINGS, bubbleWorth, type Building, type BuildingType } from '@owc/shared';
import type { Scene } from './scene.ts';
import { pieceTexture } from './textures.ts';
import { audio } from '../audio/audio.ts';

const S = 64;
/** Bubble radius in world pixels at zoom 1 (a comfortable 44px tap target). */
const R = 22;
/** Pops closer together than this keep the combo going. */
const COMBO_MS = 1600;

interface BubbleView { sprite: Sprite; icon: Sprite; label: Text; gold: boolean; dull: boolean; born: number; phase: number; x: number; y: number; r: number }

const textures: Partial<Record<string, Texture>> = {};

/**
 * A glossy soap bubble (or a gold one), drawn once on a canvas. Dull ones (the building
 * is waiting for room, economy.md §7) are greyer and flatter: still worth popping, but
 * they look like they're waiting.
 */
function bubbleTexture(gold: boolean, dull = false): Texture {
  const k = `${gold ? 'gold' : 'plain'}${dull ? ':dull' : ''}`;
  if (textures[k]) return textures[k]!;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const cx = 64, cy = 64, r = 56;
  const body = g.createRadialGradient(cx - 14, cy - 18, 4, cx, cy, r);
  if (dull && gold) {
    body.addColorStop(0, 'rgba(235,228,205,0.6)');
    body.addColorStop(0.5, 'rgba(190,170,120,0.35)');
    body.addColorStop(0.85, 'rgba(165,145,100,0.5)');
    body.addColorStop(1, 'rgba(200,185,145,0.85)');
  } else if (dull) {
    body.addColorStop(0, 'rgba(225,225,228,0.28)');
    body.addColorStop(0.55, 'rgba(170,172,180,0.12)');
    body.addColorStop(0.86, 'rgba(150,152,162,0.3)');
    body.addColorStop(1, 'rgba(190,192,200,0.7)');
  } else if (gold) {
    body.addColorStop(0, 'rgba(255,250,225,0.75)');
    body.addColorStop(0.5, 'rgba(255,212,96,0.42)');
    body.addColorStop(0.85, 'rgba(235,165,40,0.6)');
    body.addColorStop(1, 'rgba(255,232,150,0.95)');
  } else {
    body.addColorStop(0, 'rgba(255,255,255,0.32)');
    body.addColorStop(0.55, 'rgba(200,235,255,0.10)');
    body.addColorStop(0.86, 'rgba(165,215,255,0.28)');
    body.addColorStop(1, 'rgba(225,245,255,0.75)');
  }
  g.fillStyle = body;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  // Iridescent rim: thin-film colors sliding around the edge.
  const conic = (g as CanvasRenderingContext2D & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient }).createConicGradient?.(0.4, cx, cy);
  if (conic) {
    const hues = dull ? (gold ? ['#d8ccaa', '#b9a57a', '#d8ccaa'] : ['#c9c3cf', '#aeb5bd', '#c9c3cf']) : gold ? ['#fff1b0', '#ffc94a', '#ffe9a0', '#f2a93b', '#fff1b0'] : ['#ffc2ea', '#a8f0ff', '#fff4a8', '#c7b4ff', '#ffc2ea'];
    hues.forEach((h, i) => conic.addColorStop(i / (hues.length - 1), h));
    g.strokeStyle = conic;
  } else g.strokeStyle = dull ? '#b8b8c0' : gold ? '#ffd76a' : '#cdeeff';
  g.globalAlpha = 0.85;
  g.lineWidth = 4;
  g.beginPath(); g.arc(cx, cy, r - 2, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1;
  // The window highlight and a small back glint.
  g.save();
  g.translate(cx - 21, cy - 25); g.rotate(-0.65);
  g.fillStyle = dull ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.9)';
  g.beginPath(); g.ellipse(0, 0, 15, 7.5, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath(); g.arc(cx + 24, cy + 22, 4, 0, Math.PI * 2); g.fill();
  return (textures[k] = Texture.from(c));
}

/** Springy scale-in: overshoots, then settles. */
const spring = (t: number) => (t >= 1 ? 1 : 1 - Math.cos(t * Math.PI * 2.5) * Math.exp(-t * 5.5));

export class Bubbles {
  layer = new Container();
  private views = new Map<number, BubbleView[]>();
  private scene: Scene;
  private combo = 0;
  private comboAt = 0;
  private lastSparkle = 0;

  constructor(scene: Scene) { this.scene = scene; }

  update(now: number, counter: number, view: { x0: number; x1: number; y0: number; y1: number }) {
    const sc = this.scene, m = sc.mirror;
    // Only close enough to tap: from afar a town shouldn't be covered in bubbles.
    const show = !sc.far && sc.cam.zoom > 0.5;
    this.layer.visible = show;
    const seen = new Set<number>();
    if (show) {
      for (const id of m.mineBuildings) {
        const b = m.buildings.get(id);
        if (!b?.bubbles?.length || b.x + b.size < view.x0 || b.x > view.x1 || b.y + b.size < view.y0 || b.y > view.y1) continue;
        seen.add(id);
        this.place(b, this.sync(b, now), now, counter);
      }
    }
    for (const [id, vs] of this.views) if (!seen.has(id)) { for (const v of vs) v.sprite.destroy({ children: true }); this.views.delete(id); }
    // Gold bubbles glitter.
    if (show && now - this.lastSparkle > 450) {
      this.lastSparkle = now;
      for (const vs of this.views.values()) for (const v of vs) if (v.gold && !v.dull) sc.fx.glint(v.x + (Math.random() - 0.5) * v.r * 1.6, v.y + (Math.random() - 0.5) * v.r * 1.6);
    }
  }

  /**
   * One bubble per building, however many are waiting: gold if any is gold, with a count
   * when there's more than one (economy.md §7). Each tap pops one; it stays until the last.
   */
  private sync(b: Building, now: number): BubbleView[] {
    const all = b.bubbles ?? [], dull = b.blocked === 'pop-cap';
    const want = all.length ? [all.includes(1) ? 1 : 0] : [];
    let vs = this.views.get(b.id);
    if (!vs) this.views.set(b.id, (vs = []));
    let i = 0;
    while (i < vs.length && i < want.length && vs[i].gold === (want[i] === 1) && vs[i].dull === dull) i++;
    for (const v of vs.splice(i)) v.sprite.destroy({ children: true });
    for (; i < want.length; i++) {
      const gold = want[i] === 1;
      const sprite = new Sprite(bubbleTexture(gold, dull));
      sprite.anchor.set(0.5);
      const kind = b.type === 'palace' ? (b.palaceNext ?? 'K') : BUILDINGS[b.type as BuildingType]?.produces[0] ?? 'P';
      const me = this.scene.mirror.me ? this.scene.mirror.players.get(this.scene.mirror.me) : undefined;
      // The piece it's hurrying, inside the bubble (once its art is ready).
      const tex = () => pieceTexture(kind, 'light', me?.color ?? '#888', false, () => { if (!icon.destroyed) icon.texture = tex() ?? Texture.EMPTY; }, me?.civ);
      const icon: Sprite = new Sprite(Texture.EMPTY);
      icon.texture = tex() ?? Texture.EMPTY;
      icon.anchor.set(0.5, 0.55);
      icon.alpha = dull ? 0.6 : 0.92;
      icon.scale.set(0.5); // piece art is 128px, like the bubble: half its width
      sprite.addChild(icon);
      // How many are waiting (×2, ×3), on the bubble's shoulder.
      const label = new Text({ text: '', style: { fontFamily: 'Nunito, system-ui', fontWeight: '900', fontSize: 34, fill: 0xffffff, stroke: { color: 0x23211f, width: 7 } } });
      label.anchor.set(0.5);
      label.position.set(40, -40);
      sprite.addChild(label);
      this.layer.addChild(sprite);
      vs.push({ sprite, icon, label, gold, dull, born: now, phase: Math.random() * 6.28, x: 0, y: 0, r: R });
    }
    const n = all.length;
    for (const v of vs) { const t = n > 1 ? `×${n}` : ''; if (v.label.text !== t) v.label.text = t; }
    return vs;
  }

  private place(b: Building, vs: BubbleView[], now: number, counter: number) {
    const sc = this.scene, th = sc.theta, z = sc.cam.zoom;
    const k = Math.max(1, 0.8 / z);
    const r = R * k;
    const cx = (b.x + b.size / 2) * S, cy = (b.y + b.size / 2) * S;
    const upX = -Math.sin(th), upY = -Math.cos(th), rtX = Math.cos(th), rtY = -Math.sin(th);
    const n = vs.length;
    vs.forEach((v, i) => {
      const along = (i - (n - 1) / 2) * r * 2.15;
      const bob = Math.sin(now / 700 + v.phase) * r * 0.16;
      const up = b.size * S * 0.62 + 14 + r * 1.35 + bob + (i % 2) * r * 0.35;
      v.x = cx + upX * up + rtX * along;
      v.y = cy + upY * up + rtY * along;
      v.r = r;
      const s = spring(Math.min(1, (now - v.born) / 520));
      const wob = Math.sin(now / 210 + v.phase) * 0.05;
      v.sprite.position.set(v.x, v.y);
      v.sprite.rotation = counter;
      const base = (2 * r) / 112; // the drawn circle is 112 of the texture's 128 pixels
      v.sprite.scale.set(base * s * (1 + wob), base * s * (1 - wob));
      v.icon.rotation = Math.sin(now / 900 + v.phase) * 0.12;
    });
  }

  /** The bubble under a point (squares), if any. Generous: a thumb is bigger than a bubble. */
  /** The bubble under a point, as the building and the index of the one to pop (gold first). */
  pick(x: number, y: number): { building: number; i: number } | null {
    const wx = (x + 0.5) * S, wy = (y + 0.5) * S;
    let best: { building: number; i: number } | null = null, bd = Infinity;
    for (const [id, vs] of this.views) for (const v of vs) {
      const d = Math.hypot(v.x - wx, v.y - wy);
      const bs = this.scene.mirror.buildings.get(id)?.bubbles ?? [];
      const i = bs.indexOf(v.gold ? 1 : 0);
      if (i >= 0 && d < v.r * 1.3 && d < bd) { bd = d; best = { building: id, i }; }
    }
    return best;
  }

  /** Pop it here at once (the server confirms); returns whether it was gold, or null if it's gone. */
  pop(building: number, i: number): boolean | null {
    const sc = this.scene, b = sc.mirror.buildings.get(building), vs = this.views.get(building);
    const v = vs?.[0];
    if (!b?.bubbles || !v || b.bubbles[i] == null) return null;
    const gold = b.bubbles[i] === 1;
    b.bubbles.splice(i, 1);
    const now = performance.now();
    // More waiting: the same bubble springs back with one fewer; the last one bursts.
    if (b.bubbles.length && (b.bubbles.includes(1) || !gold)) { v.born = now - 150; v.label.text = b.bubbles.length > 1 ? `×${b.bubbles.length}` : ''; }
    else { vs!.splice(0, 1); v.sprite.destroy({ children: true }); }
    this.combo = now - this.comboAt < COMBO_MS ? this.combo + 1 : 1;
    this.comboAt = now;
    // Waiting for room: the pop still banks progress (up to one whole piece), but it sounds off-key.
    const worth = b.cycleMs ? Math.min(bubbleWorth(b.cycleMs, gold), 1 - b.prod) : 0;
    b.prod = Math.min(1, b.prod + worth); // the bar jumps now; the server's number follows
    sc.fx.bubblePop(v.x, v.y, v.r, gold, this.combo, Math.round((worth * (b.cycleMs ?? 0)) / 1000), v.dull);
    sc.squash(building);
    audio.bubble(this.combo, gold, v.dull);
    return gold;
  }
}
