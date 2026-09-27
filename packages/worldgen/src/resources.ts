// Resource node placement. See docs/specs/resources.md for the math.
//
// Each resource layer is a jittered grid of cluster sites. Every grid cell
// rolls once for a cluster, with a probability that depends on the local
// terrain and area elo. A cluster that exists gets a random size and
// shape. A jittered grid (instead of pure random placement) bounds the
// largest possible gap between clusters, which is how starting-resource
// coverage is guaranteed while still looking natural. On top of the clusters,
// two per-square "fill" layers add forest trees and rock along mountain edges.
import { gaussian, hash, hash01, rng, valueNoise } from './random.ts';
import { eloAt, fields, terrainAt, type Terrain } from './terrain.ts';

export type Kind = 'tree' | 'wheat' | 'rock' | 'gold';

export interface ResourceNode {
  x: number;
  y: number;
  kind: Kind;
  capacity: number;
}

interface Site {
  terrain: Terrain;
  height: number;
  moisture: number;
  elo: number;
}

interface Layer {
  kind: Kind;
  salt: number;
  /** Grid cell size in squares: one potential cluster per cell. */
  cell: number;
  /** Chance that this cell has a cluster, given the site at its center. */
  chance: (s: Site) => number;
  size: [number, number];
  shape: 'scatter' | 'blob';
  /** Standard deviation of scatter offsets, in squares. */
  spread: number;
  /** Chance a cluster also brings a small rock outcrop beside it. */
  companionRock?: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 0 at elo 1000 and below, 1 at elo 2400 and above. */
export const eloFactor = (elo: number) => clamp01((elo - 1000) / 1400);

export const LAYERS: Record<string, Layer> = {
  grove: {
    kind: 'tree', salt: 10, cell: 11, size: [7, 16], shape: 'scatter', spread: 1.5,
    chance: (s) => (s.terrain === 'forest' ? 0.95 : s.terrain === 'grass' ? 0.8 : 0.4),
  },
  field: {
    kind: 'wheat', salt: 20, cell: 13, size: [4, 9], shape: 'blob', spread: 0,
    // Wheat likes open grass of middling moisture.
    chance: (s) => (s.terrain !== 'grass' ? 0.25 : 0.55 + 0.4 * (1 - clamp01(Math.abs(s.moisture) / 0.35))),
  },
  outcrop: {
    kind: 'rock', salt: 30, cell: 20, size: [2, 6], shape: 'scatter', spread: 1.4,
    // Rock is more likely on high ground.
    chance: (s) => 0.2 + 0.7 * clamp01((s.height + 0.15) / 0.5),
  },
  vein: {
    kind: 'gold', salt: 40, cell: 30, size: [2, 4], shape: 'scatter', spread: 1.0, companionRock: 0.6,
    // Gold is rare, likes high ground, and is far more common in high-elo areas.
    chance: (s) => (0.14 + 0.5 * eloFactor(s.elo)) * (0.6 + 0.8 * clamp01((s.height + 0.1) / 0.5)),
  },
};

const FILL = { forestTree: 0.24, mountainRock: 0.06 };
const BASE_CAPACITY: Record<Kind, number> = { tree: 200, wheat: 100, rock: 400, gold: 150 };
const PRIORITY: Record<Kind, number> = { gold: 4, rock: 3, wheat: 2, tree: 1 };
/** Farthest a cluster member can land from its cell, in squares. */
const REACH = 12;

const canHold = (kind: Kind, t: Terrain) =>
  kind === 'wheat' ? t === 'grass' : kind === 'tree' ? t === 'grass' || t === 'forest' : t !== 'water' && t !== 'mountain';

/** Node size: bigger in higher-elo areas, with ±20% random variation. */
export const richness = (elo: number) => Math.max(0.7, Math.min(1.9, 1 + (elo - 1000) / 2000));

function node(seed: number, x: number, y: number, kind: Kind, elo: number): ResourceNode {
  const jitter = 0.8 + 0.4 * hash01(seed, x, y, 99);
  return { x, y, kind, capacity: Math.round(BASE_CAPACITY[kind] * richness(elo) * jitter) };
}

/** All nodes of one cluster cell (empty if the cell rolled no cluster). */
export function clusterAt(seed: number, layer: Layer, i: number, j: number): ResourceNode[] {
  const r = rng(hash(seed, i, j, layer.salt));
  const cx = Math.floor((i + 0.15 + 0.7 * r()) * layer.cell);
  const cy = Math.floor((j + 0.15 + 0.7 * r()) * layer.cell);
  const terrain = terrainAt(seed, cx, cy);
  const f = fields(seed, cx, cy);
  const elo = eloAt(seed, cx, cy);
  if (r() >= layer.chance({ terrain, ...f, elo })) return [];

  const size = layer.size[0] + Math.floor(r() * (layer.size[1] - layer.size[0] + 1));
  const out: ResourceNode[] = [];
  const taken = new Set<string>();
  const add = (x: number, y: number, kind: Kind) => {
    const k = `${x},${y}`;
    if (taken.has(k) || !canHold(kind, terrainAt(seed, x, y))) return false;
    taken.add(k);
    out.push(node(seed, x, y, kind, elo));
    return true;
  };

  if (layer.shape === 'blob') {
    // Grow a connected patch outward from the center, like a field.
    if (add(cx, cy, layer.kind)) {
      const frontier = [[cx, cy]];
      for (let tries = 0; out.length < size && tries < size * 8 && frontier.length; tries++) {
        const [fx, fy] = frontier[Math.floor(r() * frontier.length)];
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)];
        if (add(fx + dx, fy + dy, layer.kind)) frontier.push([fx + dx, fy + dy]);
      }
    }
  } else {
    for (let tries = 0; out.length < size && tries < size * 6; tries++)
      add(cx + Math.round(gaussian(r) * layer.spread), cy + Math.round(gaussian(r) * layer.spread), layer.kind);
  }

  if (out.length && layer.companionRock && r() < layer.companionRock) {
    // A small outcrop 3-5 squares away: gold next to rock is a palace site.
    const a = r() * 2 * Math.PI, d = 3 + r() * 2;
    const rx = cx + Math.round(Math.cos(a) * d), ry = cy + Math.round(Math.sin(a) * d);
    const n = 2 + Math.floor(r() * 3);
    for (let tries = 0, got = 0; got < n && tries < 12; tries++)
      if (add(rx + Math.round(gaussian(r) * 0.8), ry + Math.round(gaussian(r) * 0.8), 'rock')) got++;
  }
  return out;
}

function adjacentToMountain(seed: number, x: number, y: number): boolean {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
    if (terrainAt(seed, x + dx, y + dy) === 'mountain') return true;
  return false;
}

/**
 * Every resource node with x0 <= x <= x1 and y0 <= y <= y1.
 * Pass `kinds` to skip the layers you don't need (much faster for big areas).
 */
export function resourcesInRect(
  seed: number, x0: number, y0: number, x1: number, y1: number,
  kinds: Kind[] = ['tree', 'wheat', 'rock', 'gold'],
): ResourceNode[] {
  const want = new Set(kinds);
  const best = new Map<string, ResourceNode>();
  const offer = (n: ResourceNode) => {
    if (n.x < x0 || n.x > x1 || n.y < y0 || n.y > y1 || !want.has(n.kind)) return;
    const k = `${n.x},${n.y}`;
    const cur = best.get(k);
    if (!cur || PRIORITY[n.kind] > PRIORITY[cur.kind]) best.set(k, n);
  };

  for (const layer of Object.values(LAYERS)) {
    if (!want.has(layer.kind) && !(layer.companionRock && want.has('rock'))) continue;
    const i0 = Math.floor((x0 - REACH) / layer.cell), i1 = Math.floor((x1 + REACH) / layer.cell);
    const j0 = Math.floor((y0 - REACH) / layer.cell), j1 = Math.floor((y1 + REACH) / layer.cell);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) for (const n of clusterAt(seed, layer, i, j)) offer(n);
  }

  if (want.has('tree') || want.has('rock'))
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const t = terrainAt(seed, x, y);
        // Forest trees grow in patches: a small-scale noise field thins them.
        if (want.has('tree') && t === 'forest' && hash01(seed, x, y, 60) < FILL.forestTree * 2.2 * clamp01(valueNoise(seed, x / 7, y / 7, 62)))
          offer(node(seed, x, y, 'tree', eloAt(seed, x, y)));
        else if (want.has('rock') && t !== 'water' && t !== 'mountain' && hash01(seed, x, y, 61) < FILL.mountainRock && adjacentToMountain(seed, x, y))
          offer(node(seed, x, y, 'rock', eloAt(seed, x, y)));
      }
  return [...best.values()];
}
