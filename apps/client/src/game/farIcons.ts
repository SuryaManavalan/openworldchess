// Resource icons for the far view (visuals.md §12). Zoomed out, trees, rock, ore and fields
// are too small to draw one by one, so each area gets at most one small icon for what stands
// out there: a stand of trees for a forest, a pile of stones for rocky ground, a glinting
// vein for ore, sheaves for wheat. Only where there's a lot of it, so the map reads at a
// glance without filling up with icons.
import { Container, Graphics, Sprite } from 'pixi.js';
import { CHUNK } from '@owc/shared';
import { biomeAt } from '@owc/worldgen';
import type { Scene } from './scene.ts';
import { nodeArt } from './biomeArt.ts';
import { nodeTexture } from './textures.ts';

const S = 64;
const KINDS = ['tree', 'rock', 'ore', 'wheat'] as const;
type Kind = (typeof KINDS)[number];
/** How much of a kind a 16×16 area needs before it earns an icon. */
const ENOUGH: Record<Kind, number> = { tree: 40, rock: 6, ore: 2, wheat: 12 };
/** Rarer things win a tie: an ore vein in a wood shows as ore. */
const WEIGHT: Record<Kind, number> = { tree: 1, rock: 1.2, ore: 1.6, wheat: 0.9 };
/** Pieces of art in each icon: a stand of trees reads as a forest. */
const CLUSTER: Record<Kind, [number, number][]> = {
  tree: [[-0.42, 0.1], [0.42, 0.1], [0, -0.22]],
  rock: [[-0.3, 0.05], [0.3, -0.05]],
  ore: [[0, 0]],
  wheat: [[-0.35, 0], [0, -0.15], [0.35, 0]],
};
/** Icon height on screen, in pixels, whatever the zoom. */
const PX = 22;

/** A summary per chunk: for each of its four 16×16 quarters and each kind, [count, sum x, sum y]. */
export type ResSummary = Float32Array;
const at = (q: number, k: number) => (q * 4 + k) * 3;

export class FarIcons {
  layer = new Container();
  private scene: Scene;
  /** What the world generates in each chunk (from the terrain worker). */
  private base = new Map<string, ResSummary>();
  /** What's really there now, where the chunk is loaded (felled, mined, regrown). */
  private live = new Map<string, ResSummary>();
  private liveAt = 0;
  private icons = new Map<string, { kind: Kind; sprites: Sprite[]; glow?: Graphics }>();

  constructor(scene: Scene) { this.scene = scene; }

  setBase(k: string, res: ResSummary) { this.base.set(k, res); }

  /** Live counts for the loaded chunks, refreshed every couple of seconds. */
  private refreshLive(now: number) {
    if (now - this.liveAt < 2000) return;
    this.liveAt = now;
    this.live.clear();
    const m = this.scene.mirror;
    for (const k of m.chunks) this.live.set(k, new Float32Array(48));
    for (const n of m.nodes.values()) {
      if (n.remaining <= 0 || n.hoard) continue;
      const cx = Math.floor(n.x / CHUNK), cy = Math.floor(n.y / CHUNK), res = this.live.get(`${cx},${cy}`);
      const ki = KINDS.indexOf(n.kind as Kind);
      if (!res || ki < 0) continue;
      const q = (n.y - cy * CHUNK >= CHUNK / 2 ? 2 : 0) + (n.x - cx * CHUNK >= CHUNK / 2 ? 1 : 0), i = at(q, ki);
      res[i]++; res[i + 1] += n.x; res[i + 2] += n.y;
    }
  }

  update(now: number, counter: number, view: { x0: number; x1: number; y0: number; y1: number }) {
    const sc = this.scene;
    this.layer.visible = sc.far;
    if (!sc.far) { if (this.icons.size) this.clear(); return; }
    this.refreshLive(now);
    const z = sc.cam.zoom;
    // Very far out, whole chunks instead of quarters: fewer, bigger areas, so fewer icons.
    const whole = z < 0.08;
    const size = PX / z, used = new Set<string>();
    const cx0 = Math.floor(view.x0 / CHUNK), cx1 = Math.floor(view.x1 / CHUNK), cy0 = Math.floor(view.y0 / CHUNK), cy1 = Math.floor(view.y1 / CHUNK);
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++) {
        const k = `${cx},${cy}`, res = this.live.get(k) ?? this.base.get(k);
        if (!res) continue;
        for (const quarters of whole ? [[0, 1, 2, 3]] : [[0], [1], [2], [3]]) {
          // The kind that stands out most here, if any does.
          let best: Kind | null = null, score = 1, bx = 0, by = 0;
          KINDS.forEach((kind, ki) => {
            let n = 0, sx = 0, sy = 0;
            for (const q of quarters) { const i = at(q, ki); n += res[i]; sx += res[i + 1]; sy += res[i + 2]; }
            const s = (n / (ENOUGH[kind] * quarters.length)) * WEIGHT[kind];
            if (s >= score) { score = s; best = kind; bx = sx / n; by = sy / n; }
          });
          if (!best) continue;
          const id = `${k}:${quarters.join('')}`;
          used.add(id);
          this.place(id, best, bx, by, size, counter);
        }
      }
    for (const [id, icon] of this.icons) if (!used.has(id)) { for (const s of icon.sprites) s.destroy(); icon.glow?.destroy(); this.icons.delete(id); }
  }

  private place(id: string, kind: Kind, x: number, y: number, size: number, counter: number) {
    let icon = this.icons.get(id);
    if (icon && icon.kind !== kind) { for (const s of icon.sprites) s.destroy(); icon.glow?.destroy(); icon = undefined; }
    if (!icon) {
      const seed = this.scene.mirror.seed, rx = Math.round(x), ry = Math.round(y);
      const variant = nodeArt(seed, kind, rx, ry, biomeAt(seed, rx, ry), false, false);
      const sprites = CLUSTER[kind].map(() => {
        const s = new Sprite();
        s.anchor.set(0.5, 0.86);
        const tex = nodeTexture(variant, () => { if (!s.destroyed) s.texture = nodeTexture(variant)!; });
        if (tex) s.texture = tex;
        this.layer.addChild(s);
        return s;
      });
      // Ore is the rarest and the most wanted: it glows gold, so it isn't mistaken for rock.
      let glow: Graphics | undefined;
      if (kind === 'ore') {
        glow = new Graphics();
        glow.circle(0, 0, 0.62).fill({ color: 0xffd76a, alpha: 0.35 }).circle(0, 0, 0.4).fill({ color: 0xfff2b0, alpha: 0.3 });
        glow.star(0.42, -0.5, 4, 0.2, 0.07).fill({ color: 0xfff6c8 });
        this.layer.addChildAt(glow, 0);
      }
      icon = { kind, sprites, glow };
      this.icons.set(id, icon);
    }
    if (icon.glow) { icon.glow.position.set((x + 0.5) * S, (y + 0.5) * S); icon.glow.scale.set(size); icon.glow.rotation = counter; }
    const th = this.scene.theta;
    const rt = [Math.cos(th), -Math.sin(th)], up = [-Math.sin(th), -Math.cos(th)];
    icon.sprites.forEach((s, i) => {
      const [ox, oy] = CLUSTER[kind][i];
      // Offsets in screen directions, so the cluster stays upright as the camera turns.
      s.position.set((x + 0.5) * S + (rt[0] * ox - up[0] * oy) * size, (y + 0.5) * S + (rt[1] * ox - up[1] * oy) * size);
      s.width = s.height = size;
      s.rotation = counter;
    });
  }

  private clear() { for (const icon of this.icons.values()) { for (const s of icon.sprites) s.destroy(); icon.glow?.destroy(); } this.icons.clear(); }
}
