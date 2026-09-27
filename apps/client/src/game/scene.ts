// The world view: camera, chunk streaming, and live views of pieces,
// buildings and resource nodes, animated from server turns (movement.md §8).
import { Application, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { CHUNK, REACH, cheb, chunkKey, key, type Building, type NodeState, type Piece, type PieceKind } from '@owc/shared';
import { hash01 } from '@owc/worldgen';
import { Chess } from 'chess.js';
import type { Mirror, MoveEvent } from '@owc/client-core';
import { buildingTexture, nodeTexture, pieceTexture, stumpTexture } from './textures.ts';
import { paintChunk, terrainCodes, textureFrom, TPX } from './terrain.ts';
import { Fx } from './fx.ts';
import { computeSettlements, decorate, wallsFor, TIER_NAME, type Decor, type Settlement, type Wall } from './settlements.ts';
import { decorTexture } from './textures.ts';
import { useUI } from '../store.ts';

export const S = 64; // world pixels per square

export interface Camera { x: number; y: number; zoom: number; rot: number; rotShown: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

interface Anim { fx: number; fy: number; tx: number; ty: number; t0: number; dur: number; turn: boolean }

export class PieceView {
  sprite = new Sprite();
  id: number;
  kind: PieceKind = 'P';
  texKey = '';
  x: number;
  y: number;
  anim: Anim | null = null;
  flip = 1;
  pop = 0;
  born = 0;
  flash = 0;
  flashColor = 0xffffff;
  /** What the piece carries (hauling pawns, merchants). */
  cargo: Sprite | null = null;
  constructor(p: Piece) { this.id = p.id; this.x = p.x; this.y = p.y; this.sprite.anchor.set(0.5, 0.84); }
}

class BuildingView {
  sprite = new Sprite();
  bar = new Graphics();
  texKey = '';
  constructor() { this.sprite.anchor.set(0.5, 0.88); }
}

export class Scene {
  app = new Application();
  world = new Container();
  ground = new Container();
  decals = new Graphics();
  objects = new Container({ sortableChildren: true });
  arenas = new Container({ sortableChildren: true });
  overlay = new Container();
  labels = new Container();
  cam: Camera = { x: 0, y: 0, zoom: 1, rot: 0, rotShown: 0 };
  mirror: Mirror;
  fx: Fx;
  pieces = new Map<number, PieceView>();
  buildings = new Map<number, BuildingView>();
  nodes = new Map<number, Sprite>();
  kingLabels = new Map<number, Text>();
  /** Settlements (visuals.md §10), their settled ground, decorations and name labels. */
  settlements: Settlement[] = [];
  groundMap = new Map<number, number>();
  decor: Decor[] = [];
  private decorSprites = new Map<string, Sprite>();
  private townLabels = new Map<number, Text>();
  walls: Wall[] = [];
  private wallsG = new Graphics();
  /** Until when a settlement's bell swings (settlement id → time). */
  bellUntil = new Map<number, number>();
  settleDirty = true;
  private lastSettle = 0;
  private chunkViews = new Map<string, { sprite: Sprite; canvas: HTMLCanvasElement; codes: Uint8Array; dirty: boolean }>();
  private requested = new Set<string>();
  private worker: Worker;
  private arenaG = new Graphics();
  private arenaPieces = new Map<string, Sprite>();
  private lastSub = '';
  onSubscribe: (chunks: [number, number][]) => void = () => {};
  hover: [number, number] | null = null;
  pathPreview: { from: [number, number]; to: [number, number]; ok: boolean; attack: boolean } | null = null;
  lasso: [number, number][] | null = null;
  box: { a: [number, number]; b: [number, number] } | null = null;
  lastInput = Date.now();
  ready = false;

  constructor(mirror: Mirror) {
    this.mirror = mirror;
    this.fx = new Fx(this);
    this.worker = new Worker(new URL('./terrainWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<{ cx: number; cy: number; codes: Uint8Array }>) => this.chunkReady(e.data.cx, e.data.cy, e.data.codes);
  }

  async init(el: HTMLElement) {
    await this.app.init({ resizeTo: el, background: '#6f8f4a', antialias: true, resolution: Math.min(2, devicePixelRatio), autoDensity: true });
    el.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = 'none';
    this.world.addChild(this.ground, this.wallsG, this.decals, this.objects, this.arenas, this.fx.layer, this.labels);
    this.arenas.addChild(this.arenaG);
    this.arenaG.zIndex = -1e9;
    this.app.stage.addChild(this.world, this.fx.screenLayer, this.overlay);
    this.bindMirror();
    this.app.ticker.add(() => this.frame());
    this.ready = true;
  }

  // ---------- coordinates ----------

  /** Screen point → world square (float). */
  toSquare(sx: number, sy: number): [number, number] {
    const p = this.world.toLocal({ x: sx, y: sy });
    return [p.x / S - 0.5, p.y / S - 0.5];
  }
  toScreen(x: number, y: number): [number, number] {
    const p = this.world.toGlobal({ x: (x + 0.5) * S, y: (y + 0.5) * S });
    return [p.x, p.y];
  }
  get theta() { return (this.cam.rotShown * Math.PI) / 2; }

  centerOn(x: number, y: number) { this.cam.x = x; this.cam.y = y; }
  zoomBy(f: number, sx?: number, sy?: number) {
    const before = sx != null ? this.toSquare(sx, sy!) : null;
    this.cam.zoom = clamp(this.cam.zoom * f, 0.22, 2.4);
    this.applyCamera();
    if (before) {
      const after = this.toSquare(sx!, sy!);
      this.cam.x += before[0] - after[0]; this.cam.y += before[1] - after[1];
    }
  }
  rotate(dir: 1 | -1) { this.cam.rot += dir; }

  private applyCamera() {
    const { width, height } = this.app.screen;
    this.world.pivot.set((this.cam.x + 0.5) * S, (this.cam.y + 0.5) * S);
    this.world.position.set(width / 2, height / 2);
    this.world.scale.set(this.cam.zoom);
    this.world.rotation = this.theta;
  }

  // ---------- chunks ----------

  private visibleChunks(): [number, number][] {
    const { width, height } = this.app.screen;
    const pts = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => this.toSquare(x, y));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    let c0x = Math.floor(Math.min(...xs) / CHUNK) - 1, c1x = Math.floor(Math.max(...xs) / CHUNK) + 1;
    let c0y = Math.floor(Math.min(...ys) / CHUNK) - 1, c1y = Math.floor(Math.max(...ys) / CHUNK) + 1;
    const ccx = Math.floor(this.cam.x / CHUNK), ccy = Math.floor(this.cam.y / CHUNK);
    c0x = Math.max(c0x, ccx - 4); c1x = Math.min(c1x, ccx + 4); c0y = Math.max(c0y, ccy - 4); c1y = Math.min(c1y, ccy + 4);
    const out: [number, number][] = [];
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) out.push([cx, cy]);
    return out;
  }

  private updateChunks() {
    const vis = this.visibleChunks();
    const sig = vis.map((c) => c.join(',')).join(';');
    if (sig !== this.lastSub) { this.lastSub = sig; this.onSubscribe(vis); }
    const want = new Set(vis.map(([x, y]) => chunkKey(x, y)));
    for (const [cx, cy] of vis) {
      const k = chunkKey(cx, cy);
      if (!this.chunkViews.has(k) && !this.requested.has(k) && this.mirror.seed) {
        this.requested.add(k);
        this.worker.postMessage({ seed: this.mirror.seed, cx, cy, size: CHUNK });
      }
    }
    for (const [k, v] of this.chunkViews) if (!want.has(k)) { v.sprite.destroy({ texture: true, textureSource: true }); this.chunkViews.delete(k); this.requested.delete(k); }
    for (const [k, v] of this.chunkViews) if (v.dirty) { v.dirty = false; this.repaint(k, v); }
  }

  private chunkReady(cx: number, cy: number, codes: Uint8Array) {
    const k = chunkKey(cx, cy);
    terrainCodes.set(k, codes);
    if (!this.requested.has(k)) return;
    const canvas = document.createElement('canvas');
    const sprite = new Sprite();
    sprite.position.set(cx * CHUNK * S, cy * CHUNK * S);
    sprite.scale.set(S / TPX);
    this.ground.addChild(sprite);
    const v = { sprite, canvas, codes, dirty: false };
    this.chunkViews.set(k, v);
    this.repaint(k, v);
  }

  private repaint(k: string, v: { sprite: Sprite; canvas: HTMLCanvasElement; codes: Uint8Array }) {
    const [cx, cy] = k.split(',').map(Number);
    const m = this.mirror;
    paintChunk(m.seed, cx, cy, {
      codes: v.codes,
      ground: (x, y) => this.groundMap.get(key(x, y)) ?? 0,
      traffic: (x, y) => m.traffic.get(key(x, y)) ?? 0,
    }, v.canvas);
    // Pixi caches one texture per canvas: re-upload the pixels, don't make a new one.
    // (Making a new one returned the cached texture, so repaints never reached the GPU:
    // cities you hadn't watched stayed grass.)
    if (v.sprite.texture && v.sprite.texture.source?.resource === v.canvas) v.sprite.texture.source.update();
    else v.sprite.texture = textureFrom(v.canvas);
  }

  markChunkDirty(x: number, y: number) {
    const v = this.chunkViews.get(chunkKey(Math.floor(x / CHUNK), Math.floor(y / CHUNK)));
    if (v) v.dirty = true;
  }

  // ---------- mirror → views ----------

  colorOf(owner: string | null) { return owner ? this.mirror.players.get(owner)?.color ?? '#9a9a9a' : '#8a8a8a'; }

  private bindMirror() {
    const m = this.mirror;
    m.onPieceChange = (p, prev) => {
      let v = this.pieces.get(p.id);
      if (!v) {
        v = new PieceView(p);
        this.pieces.set(p.id, v);
        this.objects.addChild(v.sprite);
        if (p.routine === 'born') { v.born = performance.now(); this.fx.birth(p.x, p.y, this.colorOf(p.owner)); }
      } else if (!v.anim && (Math.abs(v.x - p.x) > 0.01 || Math.abs(v.y - p.y) > 0.01)) {
        if (Math.abs(v.x - p.x) + Math.abs(v.y - p.y) > 6) { v.x = p.x; v.y = p.y; }
        else v.anim = { fx: v.x, fy: v.y, tx: p.x, ty: p.y, t0: performance.now(), dur: m.turnMs * 0.9, turn: false };
      }
      if (prev && prev.owner !== p.owner && prev.owner) { v.flash = performance.now(); v.flashColor = parseInt(this.colorOf(p.owner).slice(1), 16); }
    };
    m.onPieceRemoved = (p) => {
      const v = this.pieces.get(p.id);
      if (v) { this.fx.dust(v.x, v.y, 10); v.sprite.destroy(); v.cargo?.destroy(); this.pieces.delete(p.id); }
      this.kingLabels.get(p.id)?.destroy(); this.kingLabels.delete(p.id);
    };
    m.onMoves = (moves: MoveEvent[]) => {
      const now = performance.now();
      for (const e of moves) {
        const v = this.pieces.get(e.id);
        if (!v) continue;
        v.anim = { fx: v.x, fy: v.y, tx: e.to[0], ty: e.to[1], t0: now, dur: m.turnMs * 0.92, turn: e.turn };
        if (!e.turn) this.markTraffic(e.to[0], e.to[1]);
        this.fx.onStep(v.kind, e, m.pieces.get(e.id));
      }
    };
    m.onBuildingChange = (b, prev) => {
      if (!prev || prev.type !== b.type || prev.owner !== b.owner) this.settleDirty = true;
      if (prev && prev.built < 1 && b.built >= 1) this.fx.ripple(b.x + b.size / 2 - 0.5, b.y + b.size / 2 - 0.5, 0xfff2b0, b.size * 1.2);
    };
    m.onBuildingRemoved = (id) => {
      this.settleDirty = true; this.buildings.get(id)?.sprite.destroy(); this.buildings.get(id)?.bar.destroy(); this.buildings.delete(id); };
    m.onNodeChange = (n) => this.syncNode(n);
    m.onChunk = (cx, cy) => {
      for (const n of m.nodes.values()) if (Math.floor(n.x / CHUNK) === cx && Math.floor(n.y / CHUNK) === cy) this.syncNode(n);
      const v = this.chunkViews.get(chunkKey(cx, cy));
      if (v) v.dirty = true;
      this.settleDirty = true;
    };
  }

  private trafficDirty = new Set<string>();
  private markTraffic(x: number, y: number) {
    const t = this.mirror.traffic.get(key(x, y)) ?? 0;
    // A square just became a trail, road or street: repaint (and neighbors across chunk edges).
    if (t === 4 || t === 12 || t === 60) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) this.markChunkDirty(x + dx, y + dy);
  }

  private syncNode(n: NodeState) {
    const k = key(n.x, n.y);
    let s = this.nodes.get(k);
    const alive = this.mirror.nodes.has(k);
    if (!alive) { if (s) { this.fx.dust(n.x, n.y, 6); s.destroy(); this.nodes.delete(k); } return; }
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.86);
      this.objects.addChild(s);
      this.nodes.set(k, s);
    }
    const variant = n.kind === 'tree' ? (n.remaining <= 0 ? 'stump' : hash01(this.mirror.seed, n.x, n.y, 5) < 0.45 ? 'pine' : 'tree') : n.kind;
    const tex = variant === 'stump' ? stumpTexture(() => this.syncNode(n)) : nodeTexture(variant, () => this.syncNode(n));
    if (tex) s.texture = tex;
    const frac = n.capacity ? n.remaining / n.capacity : 1;
    const base = n.kind === 'wheat' ? 0.95 : n.kind === 'tree' ? 1.05 + hash01(this.mirror.seed, n.x, n.y, 6) * 0.2 : 1;
    // Mines shrink as they're worked (visuals.md §3).
    const shrink = n.kind === 'rock' || n.kind === 'gold' ? 0.55 + 0.45 * frac : n.kind === 'wheat' ? 0.5 + 0.5 * frac : 1;
    s.width = S * base * shrink; s.height = S * base * shrink;
    s.position.set((n.x + 0.5) * S, (n.y + 0.5) * S + S * 0.36);
    (s as Sprite & { wx?: number; wy?: number; kind?: string }).wx = n.x;
    (s as Sprite & { wx?: number; wy?: number; kind?: string }).wy = n.y;
    (s as Sprite & { wx?: number; wy?: number; kind?: string }).kind = n.kind;
  }

  // ---------- per frame ----------

  private frame() {
    const now = performance.now();
    const c = this.cam;
    c.rotShown += (c.rot - c.rotShown) * Math.min(1, this.app.ticker.deltaMS / 140);
    if (Math.abs(c.rot - c.rotShown) < 0.001) c.rotShown = c.rot;
    this.applyCamera();
    if ((this.settleDirty && now - this.lastSettle > 800) || now - this.lastSettle > 15_000) this.refreshSettlements(now);
    this.updateChunks();
    const th = this.theta, sin = Math.sin(th), cos = Math.cos(th);
    const zsort = (wx: number, wy: number) => wx * sin + wy * cos;
    const counter = -th;
    const m = this.mirror;
    const t = now / 1000;
    const sel = new Set(useUI.getState().selection);
    const reduce = useUI.getState().settings.reduceMotion;

    // Pieces
    for (const [id, v] of this.pieces) {
      const p = m.pieces.get(id);
      if (!p) continue;
      const hidden = p.state === 'battle';
      v.sprite.visible = !hidden;
      if (hidden) continue;
      const color = this.colorOf(p.owner);
      const texKey = `${p.kind}:${color}:${!!p.emperor}`;
      if (texKey !== v.texKey || !v.sprite.texture || v.sprite.texture.label === 'EMPTY') {
        const tex = pieceTexture(p.kind, 'light', color, !!p.emperor);
        if (tex) { v.sprite.texture = tex; v.texKey = texKey; }
      }
      v.kind = p.kind;
      let lift = 0, squash = 1;
      if (v.anim) {
        const a = v.anim;
        const k = Math.min(1, (now - a.t0) / a.dur);
        if (a.turn) {
          squash = 1 - 0.12 * Math.sin(Math.PI * k);
          v.x = a.tx; v.y = a.ty;
        } else {
          const e = p.kind === 'N' ? k : p.kind === 'P' || p.kind === 'K' ? ease(k) : 1 - (1 - k) ** 3;
          v.x = a.fx + (a.tx - a.fx) * e; v.y = a.fy + (a.ty - a.fy) * e;
          if (p.kind === 'N') lift = Math.sin(Math.PI * k) * S * 0.55; // the L-hop arc
          else if (p.kind === 'P' || p.kind === 'K') lift = Math.abs(Math.sin(Math.PI * k * 2)) * S * 0.06;
          else if (p.kind === 'R' && k > 0.85) squash = 1 - 0.1 * Math.sin(Math.PI * (k - 0.85) / 0.15);
        }
        if (k >= 1) {
          v.anim = null;
          v.x = a.tx; v.y = a.ty;
          if (!a.turn) this.fx.landed(p.kind, a.tx, a.ty, Math.hypot(a.tx - a.fx, a.ty - a.fy));
        }
      }
      // Face the direction of travel on screen: art faces left.
      const [fdx, fdy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][p.facing];
      const screenDx = fdx * cos - fdy * sin;
      if (Math.abs(screenDx) > 0.3) v.flip = screenDx > 0 ? -1 : 1;
      const breathe = reduce ? 1 : 1 + 0.018 * Math.sin(t * (Math.PI * 2 / 1.2) + id);
      const popK = v.pop ? Math.max(0, 1 - (now - v.pop) / 220) : 0;
      const pop = 1 + 0.12 * Math.sin(Math.PI * popK) * (popK > 0 ? 1 : 0);
      const scale = (S / 128) * 1.42 * pop;
      v.sprite.scale.set(scale * v.flip * (2 - squash), scale * squash * breathe);
      const wx = (v.x + 0.5) * S, wy = (v.y + 0.5) * S;
      // Lift is "up" on screen, so it's applied along the counter-rotated axis.
      // Feet sit slightly below the square's center; lift raises the piece toward screen-up.
      v.sprite.position.set(wx + Math.sin(th) * (S * 0.42 - lift), wy + Math.cos(th) * (S * 0.42 - lift));
      v.sprite.rotation = counter;
      v.sprite.zIndex = zsort(wx, wy) + 1;
      // Tint: routed pieces fade, masterless are grey, converted pieces flash.
      let tint = 0xffffff;
      if (p.state === 'routed') tint = 0xc8c8c8;
      if (!p.owner) tint = 0xaaaaaa;
      if (v.flash && now - v.flash < 700) { const f = 1 - (now - v.flash) / 700; tint = mix(0xffffff, v.flashColor, f * 0.8); }
      v.sprite.tint = tint;
      v.sprite.alpha = (p.cooldownUntil ?? 0) > m.serverNow() && p.owner === m.me ? 0.92 : 1;
      if (v.born && now - v.born < 900) v.sprite.alpha = Math.min(1, (now - v.born) / 500);
      if (sel.has(id) && !v.pop && v.sprite.visible) v.pop = now;
      if (!sel.has(id)) v.pop = 0;
      // Goods on the back: gathered wheat, logs, stone or gold; a merchant's pack.
      const load = p.routine?.startsWith('haul:') ? p.routine.slice(5) : p.routine?.startsWith('merchant') ? 'pack' : null;
      if (load && this.cam.zoom > 0.35) {
        if (!v.cargo) { v.cargo = new Sprite(); v.cargo.anchor.set(0.5, 0.7); this.objects.addChild(v.cargo); }
        const tex = decorTexture('cargo', load);
        if (tex) v.cargo.texture = tex;
        const up = S * 0.7 + lift + Math.abs(Math.sin(t * 7 + id)) * 2;
        v.cargo.width = v.cargo.height = S * 0.58;
        v.cargo.position.set(wx - Math.sin(th) * (up - S * 0.42), wy - Math.cos(th) * (up - S * 0.42));
        v.cargo.rotation = counter;
        v.cargo.zIndex = v.sprite.zIndex + 0.01;
        v.cargo.visible = v.sprite.visible;
      } else if (v.cargo) { v.cargo.destroy(); v.cargo = null; }
      // Name banners over other players' kings when zoomed in.
      if (p.kind === 'K' && p.owner !== m.me) this.kingLabel(p, v, wx, wy, th);
    }

    // Buildings
    for (const b of m.buildings.values()) this.drawBuilding(b, zsort, counter, now);
    // Nodes: wind sway (visuals.md §4)
    for (const s of this.nodes.values()) {
      const n = s as Sprite & { wx: number; wy: number; kind: string };
      s.rotation = counter;
      const wx = (n.wx + 0.5) * S, wy = (n.wy + 0.5) * S;
      // keep node feet on the square under rotation
      s.position.set(wx + Math.sin(th) * S * 0.36, wy + Math.cos(th) * S * 0.36);
      s.zIndex = zsort(wx, wy);
      if (n.kind === 'tree' || n.kind === 'wheat') s.skew.x = reduce ? 0 : this.fx.wind(n.wx, n.wy, t) * (n.kind === 'wheat' ? 0.16 : 0.05);
    }
    this.drawTown(zsort, counter);
    this.drawDecals(now, sel);
    this.drawArenas(now, zsort, counter);
    this.fx.update(now, zsort, counter);
  }

  private kingLabel(p: Piece, v: PieceView, wx: number, wy: number, th: number) {
    const show = this.cam.zoom > 0.55;
    let label = this.kingLabels.get(p.id);
    if (!show) { if (label) label.visible = false; return; }
    if (!label) {
      const pl = p.owner ? this.mirror.players.get(p.owner) : undefined;
      label = new Text({ text: (p.emperor ? '♛ ' : '') + (pl?.name ?? '—'), style: { fontFamily: 'Nunito, system-ui', fontWeight: '800', fontSize: 22, fill: 0xffffff, stroke: { color: 0x23211f, width: 5 } } });
      label.anchor.set(0.5, 1);
      this.labels.addChild(label);
      this.kingLabels.set(p.id, label);
    }
    label.visible = true;
    label.scale.set(0.7 / Math.max(0.7, this.cam.zoom) * 1.1);
    label.rotation = -th;
    label.position.set(wx - Math.sin(th) * S * 0.75, wy - Math.cos(th) * S * 0.75);
    void v;
  }

  private drawBuilding(b: Building, zsort: (x: number, y: number) => number, counter: number, now: number) {
    let v = this.buildings.get(b.id);
    if (!v) {
      v = new BuildingView();
      this.buildings.set(b.id, v);
      this.objects.addChild(v.sprite);
      this.objects.addChild(v.bar);
    }
    const color = this.colorOf(b.owner);
    const k = `${b.type}:${color}`;
    if (k !== v.texKey) { const tex = buildingTexture(b.type, color); if (tex) { v.sprite.texture = tex; v.texKey = k; } }
    const th = this.theta;
    const cx = (b.x + b.size / 2) * S, cy = (b.y + b.size / 2) * S;
    const w = b.size * S * (b.size === 1 ? 1.25 : 1.12);
    v.sprite.width = w; v.sprite.height = w;
    const drop = b.size * S * 0.44;
    v.sprite.position.set(cx + Math.sin(th) * drop, cy + Math.cos(th) * drop);
    v.sprite.rotation = counter;
    v.sprite.zIndex = zsort(cx + Math.sin(th) * drop * 0.9, cy + Math.cos(th) * drop * 0.9);
    // State reads at a glance: scaffold-pale while building, greying with decay.
    const building = b.built < 1;
    v.sprite.alpha = building ? 0.45 + 0.5 * b.built : 1;
    v.sprite.tint = b.type === 'ruin' ? 0xffffff : mix(0x9a9a9a, 0xffffff, b.hp / 100);
    const producing = !building && !b.blocked && b.type !== 'ruin';
    if (producing) v.sprite.tint = mix(v.sprite.tint as number, 0xfff3c4, 0.12 + 0.08 * Math.sin(now / 300 + b.id));
    // Progress bar (construction or production), in screen-up direction.
    v.bar.clear();
    if (b.type !== 'ruin' && b.owner === this.mirror.me && this.cam.zoom > 0.4) {
      const frac = building ? b.built : b.prod;
      const bw = S * Math.max(0.9, b.size * 0.7), bh = 7;
      v.bar.rect(-bw / 2, 0, bw, bh).fill({ color: 0x23211f, alpha: 0.7 });
      v.bar.rect(-bw / 2 + 1.5, 1.5, (bw - 3) * frac, bh - 3).fill({ color: building ? 0xe3b23c : b.blocked ? 0xa0a0a0 : 0x95b957 });
      const up = b.size * S * 0.62 + 10;
      v.bar.position.set(cx - Math.sin(th) * up, cy - Math.cos(th) * up);
      v.bar.rotation = counter;
      v.bar.zIndex = v.sprite.zIndex + 0.5;
    }
  }

  private drawDecals(now: number, sel: Set<number>) {
    const g = this.decals;
    g.clear();
    const m = this.mirror;
    // Reach rings of selected kings (the one reach rule, economy.md §2).
    for (const id of sel) {
      const p = m.pieces.get(id), v = this.pieces.get(id);
      if (!p || !v || p.state === 'battle') continue;
      const cx = (v.x + 0.5) * S, cy = (v.y + 0.5) * S;
      g.circle(cx, cy, S * 0.46).stroke({ width: 4, color: 0xffffff, alpha: 0.9 });
      g.circle(cx, cy, S * 0.46).fill({ color: 0xffffff, alpha: 0.12 });
      if (p.kind === 'K') {
        g.rect((v.x - REACH) * S, (v.y - REACH) * S, (REACH * 2 + 1) * S, (REACH * 2 + 1) * S).stroke({ width: 3, color: 0xffffff, alpha: 0.25 + 0.1 * Math.sin(now / 500) });
      }
    }
    // Path preview while dragging a command (ux.md §3).
    if (this.pathPreview) {
      const { from, to, ok, attack } = this.pathPreview;
      const col = attack ? 0xe0503a : ok ? 0xffffff : 0xff6b5a;
      const fx = (from[0] + 0.5) * S, fy = (from[1] + 0.5) * S, tx = (to[0] + 0.5) * S, ty = (to[1] + 0.5) * S;
      const len = Math.hypot(tx - fx, ty - fy), dash = 18, off = (now / 12) % (dash * 2);
      for (let d = -off; d < len; d += dash * 2) {
        const a = Math.max(0, d), b = Math.min(len, d + dash);
        if (b <= a) continue;
        g.moveTo(fx + ((tx - fx) * a) / len, fy + ((ty - fy) * a) / len).lineTo(fx + ((tx - fx) * b) / len, fy + ((ty - fy) * b) / len);
      }
      g.stroke({ width: 6, color: col, alpha: 0.85, cap: 'round' });
      g.rect(to[0] * S, to[1] * S, S, S).stroke({ width: 5, color: col, alpha: 0.9 });
    }
    // Lasso and box selection.
    if (this.lasso && this.lasso.length > 1) {
      g.moveTo((this.lasso[0][0] + 0.5) * S, (this.lasso[0][1] + 0.5) * S);
      for (const [x, y] of this.lasso) g.lineTo((x + 0.5) * S, (y + 0.5) * S);
      g.stroke({ width: 4, color: 0xffffff, alpha: 0.8 });
    }
    if (this.box) {
      const [ax, ay] = this.box.a, [bx, by] = this.box.b;
      g.rect((Math.min(ax, bx) + 0.5) * S, (Math.min(ay, by) + 0.5) * S, Math.abs(bx - ax) * S, Math.abs(by - ay) * S).fill({ color: 0xffffff, alpha: 0.08 }).stroke({ width: 3, color: 0xffffff, alpha: 0.7 });
    }
    // Building ghost with its work area (economy.md §3).
    const ui = useUI.getState();
    if (ui.buildType && ui.ghost) {
      const size = ({ house: 1, stable: 2, temple: 2, barracks: 2, palace: 3 } as const)[ui.buildType];
      const { x, y, ok } = ui.ghost;
      g.rect((x - 3) * S, (y - 3) * S, (size + 6) * S, (size + 6) * S).fill({ color: ok ? 0x95b957 : 0xe0503a, alpha: 0.1 }).stroke({ width: 3, color: ok ? 0xb5e07a : 0xff8a7a, alpha: 0.6 });
      g.rect(x * S, y * S, size * S, size * S).fill({ color: ok ? 0x95b957 : 0xe0503a, alpha: 0.35 }).stroke({ width: 5, color: ok ? 0xd8ffb0 : 0xffb0a6 });
      for (const n of m.nodes.values())
        if (n.x >= x - 3 && n.x < x + size + 3 && n.y >= y - 3 && n.y < y + size + 3 && n.remaining > 0)
          g.circle((n.x + 0.5) * S, (n.y + 0.5) * S, S * 0.4).stroke({ width: 3, color: 0xfff2b0, alpha: 0.8 });
    }
    // Hover square on desktop
    if (this.hover && !ui.buildType) g.rect(this.hover[0] * S, this.hover[1] * S, S, S).stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
  }

  settlementAt(x: number, y: number) { return this.settlements.find((st) => st.ground.has(key(x, y)))?.id ?? -1; }

  /** Recompute settlements: repaint ground that changed tier, re-place decorations. */
  private refreshSettlements(now: number) {
    this.settleDirty = false;
    this.lastSettle = now;
    const m = this.mirror;
    this.settlements = computeSettlements(m);
    const next = new Map<number, number>();
    for (const st of this.settlements) for (const [k, t] of st.ground) next.set(k, Math.max(next.get(k) ?? 0, t));
    const touched = new Set<string>();
    const mark = (k: number) => { const x = Math.round(k / 134217728), y = k - x * 134217728; touched.add(chunkKey(Math.floor(x / CHUNK), Math.floor(y / CHUNK))); };
    for (const [k, t] of next) if (this.groundMap.get(k) !== t) mark(k);
    for (const k of this.groundMap.keys()) if (!next.has(k)) mark(k);
    this.groundMap = next;
    for (const ck of touched) { const v = this.chunkViews.get(ck); if (v) v.dirty = true; }
    const traffic = (x: number, y: number) => m.traffic.get(key(x, y)) ?? 0;
    this.decor = this.settlements.flatMap((st) => decorate(m, st, this.colorOf(st.owner), traffic));
    // Walls for settlements that have been besieged; gates shut while they're under attack.
    this.walls = [];
    for (const st of this.settlements) {
      const underAttack = [...m.battles.values()].some((b) => b.phase !== 'over' && b.black.playerId === st.owner && cheb(b.cx, b.cy, st.cx, st.cy) <= 20);
      const { wall, decor } = wallsFor(m, st, this.colorOf(st.owner), traffic, underAttack);
      if (wall) this.walls.push(wall);
      this.decor.push(...decor);
    }
    this.drawWalls();
  }

  /** Wall lines along settlement edges: palisade, then stone (visuals.md §10). */
  private drawWalls() {
    const g = this.wallsG;
    g.clear();
    const seg = (x: number, y: number, side: number): [number, number, number, number] => {
      const x0 = x * S, y0 = y * S, x1 = (x + 1) * S, y1 = (y + 1) * S;
      return side === 0 ? [x0, y0, x1, y0] : side === 1 ? [x1, y0, x1, y1] : side === 2 ? [x0, y1, x1, y1] : [x0, y0, x0, y1];
    };
    for (const w of this.walls) {
      const stone = w.tier >= 2;
      const width = stone ? S * 0.26 : S * 0.16;
      for (const pass of [0, 1, 2]) {
        for (const e of w.edges) { const [a, b, c, d] = seg(e.x, e.y, e.side); g.moveTo(a, b).lineTo(c, d); }
        if (pass === 0) g.stroke({ width: width + 6, color: 0x2b2622, cap: 'square', join: 'miter' });
        else if (pass === 1) g.stroke({ width, color: stone ? 0xbdb7ab : 0x8a5a34, cap: 'square', join: 'miter' });
        else g.stroke({ width: width * 0.35, color: stone ? 0xe3dfd6 : 0xb07a48, cap: 'square', join: 'miter', alpha: 0.9 });
      }
      // Palisade stakes / stone merlons along the top.
      for (const e of w.edges) {
        const [a, b, c, d] = seg(e.x, e.y, e.side);
        for (const t of [0.25, 0.75]) g.circle(a + (c - a) * t, b + (d - b) * t, stone ? 5 : 4).fill({ color: stone ? 0x9d9689 : 0x6d4526 });
      }
    }
  }

  /** Decorations and settlement name labels. */
  private drawTown(zsort: (x: number, y: number) => number, counter: number) {
    const th = this.theta, used = new Set<string>();
    for (const d of this.decor) {
      const id = `${d.kind}:${d.x},${d.y}`;
      used.add(id);
      let s = this.decorSprites.get(id);
      if (!s) { s = new Sprite(); s.anchor.set(0.5, 0.86); this.objects.addChild(s); this.decorSprites.set(id, s); }
      const tex = decorTexture(d.kind, d.color, d.variant);
      if (tex) s.texture = tex;
      const wx = (d.x + 0.5) * S, wy = (d.y + 0.5) * S;
      const size = d.kind === 'gate' || d.kind === 'belltower' ? S * 1.25 : d.kind === 'tower' ? S * 1.1 : d.kind === 'stall' || d.kind === 'well' ? S * 0.95 : S * 0.78;
      s.width = size; s.height = size;
      s.position.set(wx + Math.sin(th) * S * 0.36, wy + Math.cos(th) * S * 0.36);
      // A ringing bell tower sways.
      const ring = d.kind === 'belltower' ? Math.max(0, (this.bellUntil.get(this.settlementAt(d.x, d.y)) ?? 0) - performance.now()) : 0;
      s.rotation = counter + (ring > 0 ? Math.sin(performance.now() / 180) * 0.05 * Math.min(1, ring / 1500) : 0);
      s.zIndex = zsort(wx, wy) - 0.5;
    }
    for (const [id, s] of this.decorSprites) if (!used.has(id)) { s.destroy(); this.decorSprites.delete(id); }
    // Name labels: readable when zoomed out, where they matter most.
    const seen = new Set<number>();
    for (const st of this.settlements) {
      seen.add(st.id);
      let t = this.townLabels.get(st.id);
      const text = `${st.name} · ${TIER_NAME[st.tier]}`;
      if (!t) {
        t = new Text({ text, style: { fontFamily: 'Nunito, system-ui', fontWeight: '900', fontSize: 26, fill: 0xfff6dc, stroke: { color: 0x2b2622, width: 6 }, letterSpacing: 0.5 } });
        t.anchor.set(0.5, 1);
        this.labels.addChild(t);
        this.townLabels.set(st.id, t);
      }
      if (t.text !== text) t.text = text;
      const top = Math.min(...st.buildings.map((b) => b.y)) - 1.2;
      const wx = (st.cx + 0.5) * S, wy = top * S;
      t.visible = this.cam.zoom < 1.4;
      t.scale.set(Math.min(2.4, 0.75 / this.cam.zoom) * (0.8 + st.tier * 0.12));
      t.rotation = -th;
      t.position.set(wx, wy);
      t.alpha = st.owner === this.mirror.me ? 0.95 : 0.85;
    }
    for (const [id, t] of this.townLabels) if (!seen.has(id)) { t.destroy(); this.townLabels.delete(id); }
  }

  /** Battle arenas drawn in the world (battle.md §3, §9). */
  private drawArenas(now: number, zsort: (x: number, y: number) => number, counter: number) {
    const g = this.arenaG;
    g.clear();
    const used = new Set<string>();
    const m = this.mirror;
    for (const b of m.battles.values()) {
      if (b.phase === 'countdown') {
        const secs = Math.max(0, Math.ceil((b.startsAt - m.serverNow()) / 1000));
        const pulse = 0.5 + 0.5 * Math.sin(now / (secs < 10 ? 120 : 300));
        for (const [kid, col] of [[b.white.kingId, b.white.color], [b.black.kingId, b.black.color]] as const) {
          const v = this.pieces.get(kid);
          if (!v) continue;
          g.circle((v.x + 0.5) * S, (v.y + 0.5) * S, S * (1.1 + 0.2 * pulse)).stroke({ width: 5, color: parseInt(col.slice(1), 16), alpha: 0.9 });
          g.circle((v.x + 0.5) * S, (v.y + 0.5) * S, S * REACH).stroke({ width: 3, color: parseInt(col.slice(1), 16), alpha: 0.25 });
        }
        const wv = this.pieces.get(b.white.kingId), bv = this.pieces.get(b.black.kingId);
        if (wv && bv) g.moveTo((wv.x + 0.5) * S, (wv.y + 0.5) * S).lineTo((bv.x + 0.5) * S, (bv.y + 0.5) * S).stroke({ width: 4, color: 0xe0503a, alpha: 0.4 + 0.4 * pulse });
        continue;
      }
      if (b.kind === 'practice' || (b.phase !== 'live' && !(b.phase === 'over' && b.fen))) continue;
      // Board squares on the world grid, oriented by the attacker's approach.
      const [fx, fy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][b.whiteFacing];
      const rx = -fy, ry = fx;
      const a1x = b.cx - 4 * rx - 3 * fx, a1y = b.cy - 4 * ry - 3 * fy;
      const sq = (file: number, rank: number): [number, number] => [a1x + file * rx + rank * fx, a1y + file * ry + rank * fy];
      const [c1x, c1y] = sq(0, 0), [c2x, c2y] = sq(7, 7);
      const minx = Math.min(c1x, c2x), miny = Math.min(c1y, c2y);
      const fade = b.phase === 'over' ? 0.6 : 1;
      g.roundRect((minx - 0.35) * S, (miny - 0.35) * S, 8.7 * S, 8.7 * S, 20).fill({ color: 0x3a2a1a, alpha: 0.85 * fade }).stroke({ width: 6, color: 0xe3b23c, alpha: 0.9 * fade });
      for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
        const [x, y] = sq(f, r);
        g.rect(x * S, y * S, S, S).fill({ color: (f + r) % 2 ? 0xeeeed2 : 0x769656, alpha: fade });
      }
      // The dome (Wizard101 bubble)
      const ccx = (minx + 4) * S, ccy = (miny + 4) * S;
      g.circle(ccx, ccy, S * 6.2).fill({ color: 0xbfe6ff, alpha: 0.07 + 0.03 * Math.sin(now / 700) }).stroke({ width: 4, color: 0xdff4ff, alpha: 0.35 });
      if (!b.fen) continue;
      const chess = new Chess(b.fen);
      for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
        const name = String.fromCharCode(97 + f) + (r + 1);
        const pc = chess.get(name as never) as { type: string; color: string } | undefined;
        if (!pc) continue;
        const id = `${b.id}:${name}`;
        used.add(id);
        let s = this.arenaPieces.get(id);
        if (!s) { s = new Sprite(); s.anchor.set(0.5, 0.84); this.arenas.addChild(s); this.arenaPieces.set(id, s); }
        const white = pc.color === 'w';
        const pid = b.pieceMap[name];
        const tex = pieceTexture(pc.type.toUpperCase() as PieceKind, white ? 'light' : 'dark', white ? b.white.color : b.black.color, !!(pid && m.pieces.get(pid)?.emperor));
        if (tex) s.texture = tex;
        const [x, y] = sq(f, r);
        const th = this.theta, wx = (x + 0.5) * S, wy = (y + 0.5) * S;
        s.position.set(wx + Math.sin(th) * S * 0.34, wy + Math.cos(th) * S * 0.34);
        s.scale.set((S / 128) * 1.3);
        s.rotation = counter;
        s.zIndex = zsort(wx, wy) + 2;
        s.alpha = fade;
      }
    }
    for (const [id, s] of this.arenaPieces) if (!used.has(id)) { s.destroy(); this.arenaPieces.delete(id); }
  }

  /** Squares with something selectable of mine near a world point. */
  pickPiece(x: number, y: number, radius = 0.6): Piece | undefined {
    let best: Piece | undefined, bd = radius;
    for (const [id, v] of this.pieces) {
      const p = this.mirror.pieces.get(id);
      if (!p || p.state === 'battle') continue;
      const d = Math.hypot(v.x - x, v.y - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  pickBuilding(x: number, y: number): Building | undefined {
    const rx = Math.floor(x + 0.5), ry = Math.floor(y + 0.5);
    for (const b of this.mirror.buildings.values()) if (rx >= b.x && rx < b.x + b.size && ry >= b.y && ry < b.y + b.size) return b;
    return undefined;
  }

  pickArena(x: number, y: number) {
    for (const b of this.mirror.battles.values()) if (b.phase !== 'over' && Math.hypot(b.cx - x, b.cy - y) < 6) return b;
    return undefined;
  }
}

export function mix(a: number, b: number, t: number) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export type { Texture };
