// Settlements as the client sees them (visuals.md §10): groups of a player's
// buildings, their tier (hamlet → city), a name drawn from the land, and the
// decorations that appear as they grow. Everything here is derived from real
// state and seeded, so every viewer sees the same town. None of it affects play.
import { cheb, distToRect, key, type Building } from '@owc/shared';
import { biomeAt, hash01, terrainAt } from '@owc/worldgen';
import type { Mirror } from '@owc/client-core';

export type Tier = 1 | 2 | 3 | 4;
export const TIER_NAME: Record<Tier, string> = { 1: 'hamlet', 2: 'village', 3: 'town', 4: 'city' };

export interface Settlement {
  id: number;
  owner: string;
  buildings: Building[];
  cx: number;
  cy: number;
  tier: Tier;
  name: string;
  /** Squares of settled ground → tier used for the ground style. */
  ground: Map<number, Tier>;
  /** Times besieged (the most any of its buildings remembers). */
  sieges: number;
}

export interface Decor {
  x: number; y: number; kind: string; color?: string; light?: boolean; variant?: string; bell?: number;
  /** Size in squares (default: by kind), and a sub-square position (clumps sit at their middle). */
  size?: number; fx?: number; fy?: number;
}

/** Walls rise with how often a settlement has been besieged (visuals.md §10). */
export type WallTier = 0 | 1 | 2 | 3; // none, palisade, stone, stone with towers
export const wallTierOf = (sieges: number): WallTier => (sieges >= 6 ? 3 : sieges >= 3 ? 2 : sieges >= 1 ? 1 : 0);

export interface Wall {
  settlement: number;
  tier: WallTier;
  /** Wall runs along square edges: the square inside and the side (0 N, 1 E, 2 S, 3 W). */
  edges: { x: number; y: number; side: number }[];
}

const ROOT_A = ['Oak', 'Ash', 'Stone', 'Elm', 'Thorn', 'Wheat', 'Iron', 'Raven', 'Amber', 'Bright', 'Frost', 'Moss', 'Red', 'Wolf', 'King', 'Queen', 'Rook', 'Bishop'];
const ROOT_B = { water: ['ford', 'bridge', 'port', 'mere', 'brook'], forest: ['wood', 'glade', 'holt', 'grove'], mountain: ['crag', 'fell', 'tor', 'ridge'], plain: ['field', 'ton', 'stead', 'ham', 'bury', 'wick', 'gate'] };

/** Tier by number of buildings (hamlet 1–2, village 3–5, town 6–9, city 10+). */
export const tierOf = (n: number): Tier => (n >= 10 ? 4 : n >= 6 ? 3 : n >= 3 ? 2 : 1);

function nameFor(seed: number, id: number, cx: number, cy: number) {
  // Look at the land around the center: water, forest or mountain flavor the name.
  let water = 0, forest = 0, mountain = 0;
  for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) {
    const t = terrainAt(seed, cx + dx, cy + dy);
    if (t === 'water') water++; else if (t === 'forest') forest++; else if (t === 'mountain') mountain++;
  }
  const kind = water > 2 ? 'water' : mountain > 2 ? 'mountain' : forest > 12 ? 'forest' : 'plain';
  const a = ROOT_A[Math.floor(hash01(seed, id, 0, 401) * ROOT_A.length)];
  const list = ROOT_B[kind];
  return a + list[Math.floor(hash01(seed, id, 1, 402) * list.length)];
}

export function computeSettlements(m: Mirror): Settlement[] {
  const blds = [...m.buildings.values()].filter((b) => b.owner && b.type !== 'ruin' && b.type !== 'camp');
  // Union buildings of the same owner that are close together.
  const parent = new Map<number, number>(blds.map((b) => [b.id, b.id]));
  const find = (i: number): number => { let p = parent.get(i)!; while (p !== parent.get(p)) p = parent.get(p)!; parent.set(i, p); return p; };
  for (let i = 0; i < blds.length; i++)
    for (let j = i + 1; j < blds.length; j++) {
      const a = blds[i], b = blds[j];
      if (a.owner !== b.owner || cheb(a.x, a.y, b.x, b.y) > 12) continue;
      if (distToRect(a.x, a.y, b.x, b.y, b.size) <= 8) parent.set(find(a.id), find(b.id));
    }
  const groups = new Map<number, Building[]>();
  for (const b of blds) { const r = find(b.id); if (!groups.has(r)) groups.set(r, []); groups.get(r)!.push(b); }
  const out: Settlement[] = [];
  for (const bs of groups.values()) {
    const id = Math.min(...bs.map((b) => b.id));
    const cx = Math.round(bs.reduce((s, b) => s + b.x + b.size / 2, 0) / bs.length);
    const cy = Math.round(bs.reduce((s, b) => s + b.y + b.size / 2, 0) / bs.length);
    const tier = tierOf(bs.length);
    // Settled ground spreads further as the settlement grows.
    const spread = tier === 1 ? 1 : tier === 2 ? 2 : 3;
    const ground = new Map<number, Tier>();
    for (const b of bs)
      for (let y = b.y - spread; y < b.y + b.size + spread; y++)
        for (let x = b.x - spread; x < b.x + b.size + spread; x++) ground.set(key(x, y), tier);
    // Cities: fill the core between buildings (a real chessboard at the heart).
    if (tier >= 3) {
      const r = tier === 4 ? 6 : 4;
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r + 0.5) ground.set(key(x, y), tier);
    }
    out.push({ id, owner: bs[0].owner!, buildings: bs, cx, cy, tier, name: nameFor(m.seed, id, cx, cy), ground, sieges: Math.max(0, ...bs.map((b) => b.sieges ?? 0)) });
  }
  return out;
}

/** Decorations for a settlement, deterministic from the seed and its state. */
export function decorate(m: Mirror, s: Settlement, color: string, traffic: (x: number, y: number) => number, sparse = false): Decor[] {
  const out: Decor[] = [];
  // Once a player decorates a town themselves (8+ pieces), its automatic props step back so their
  // choices read clearly (citybuilding.md §9): the centrepiece and banners stay.
  const THIN = new Set(['bench', 'stall', 'lamp', 'shrub', 'planter']);
  const taken = new Set<number>();
  const blocked = (x: number, y: number) => {
    const k = key(x, y);
    if (taken.has(k) || m.nodes.has(k)) return true;
    for (const b of s.buildings) if (distToRect(x, y, b.x, b.y, b.size) === 0) return true;
    for (const b of m.buildings.values()) if (distToRect(x, y, b.x, b.y, b.size) === 0) return true;
    return false;
  };
  const put = (x: number, y: number, kind: string, extra: Partial<Decor> = {}) => {
    if (sparse && THIN.has(kind)) return false;
    if (blocked(x, y) || traffic(x, y) >= 12) return false;
    taken.add(key(x, y));
    out.push({ x, y, kind, ...extra });
    return true;
  };
  const h = (x: number, y: number, salt: number) => hash01(m.seed, x, y, salt);
  const ring = (b: Building, d = 1) => {
    const sq: [number, number][] = [];
    for (let y = b.y - d; y < b.y + b.size + d; y++) for (let x = b.x - d; x < b.x + b.size + d; x++) if (distToRect(x, y, b.x, b.y, b.size) === d) sq.push([x, y]);
    return sq;
  };
  // Village: a well at the heart (a city's is a fountain), benches around it.
  if (s.tier >= 2) {
    for (let r = 0; r < 5; r++) {
      let done = false;
      for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) done = put(s.cx + dx, s.cy + dy, s.tier >= 4 ? 'fountain' : 'well');
      if (done) break;
    }
    for (const [dx, dy] of [[2, 0], [-2, 0]]) if (h(s.cx + dx, s.cy + dy, 403) < 0.6) put(s.cx + dx, s.cy + dy, 'bench');
  }
  // A capital shows its relics around the heart (campaign.md §4.2): trophies everyone can see.
  const owner = m.players.get(s.owner);
  if (owner?.capital && owner.relics?.length && Math.max(Math.abs(owner.capital[0] - s.cx), Math.abs(owner.capital[1] - s.cy)) <= 6) {
    let i = 0;
    for (let r = 2; r <= 6 && i < owner.relics.length; r++)
      for (let dy = -r; dy <= r && i < owner.relics.length; dy++) for (let dx = -r; dx <= r && i < owner.relics.length; dx++)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && (dx + dy) % 2 === 0 && put(s.cx + dx, s.cy + dy, `relic:${owner.relics[i]}`)) i++;
  }
  // Props beside buildings, by what they are.
  for (const b of s.buildings) {
    const around = ring(b);
    const pick = (kind: string, p: number, salt: number, extra: Partial<Decor> = {}) => {
      for (const [x, y] of around) if (h(x, y, salt) < p && put(x, y, kind, extra)) return;
    };
    if (b.type === 'stable') pick('haystack', 0.35, 410);
    if (b.type === 'barracks') pick('dummy', 0.35, 411);
    if (b.type === 'temple' || b.type === 'palace') pick('flowers', 0.4, 412);
    if (b.type === 'house' && h(b.x, b.y, 413) < 0.5) pick('crates', 0.3, 414);
  }
  // Town: market stalls near the center, lamps along the streets.
  if (s.tier >= 3) {
    let stalls = 0;
    for (let dy = -4; dy <= 4 && stalls < s.tier - 1; dy++) for (let dx = -4; dx <= 4 && stalls < s.tier - 1; dx++)
      if (h(s.cx + dx, s.cy + dy, 420) < 0.12 && put(s.cx + dx, s.cy + dy, 'stall', { color })) stalls++;
    for (const k of s.ground.keys()) {
      const x = Math.round(k / 134217728), y = k - x * 134217728;
      if (traffic(x, y) >= 12) continue;
      const nearRoad = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => traffic(x + dx, y + dy) >= 12);
      if (nearRoad && h(x, y, 421) < 0.14) put(x, y, 'lamp', { light: true });
    }
  }
  // Town: a bell tower near the heart (it rings at dawn).
  if (s.tier >= 3) {
    // Spiral out from the heart until there's room (every town gets one).
    let done = false;
    for (let r = 1; r < 9 && !done; r++)
      for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r) done = put(s.cx + dx, s.cy + dy, 'belltower', { color, bell: s.tier });
  }
  // The green edge: shrubs (some flowering) along the rim of the settled ground, and
  // trees in tubs around a town's heart. They soften where the settlement meets the land.
  if (s.tier >= 2) {
    let n = 0;
    for (const k of s.ground.keys()) {
      if (n >= 6 + s.tier * 3) break;
      const [x, y] = unk(k);
      const edge = SIDES.some(([dx, dy]) => !s.ground.has(key(x + dx, y + dy)));
      if (edge && h(x, y, 440) < 0.16 && !SIDES.some(([dx, dy]) => traffic(x + dx, y + dy) >= 12) && put(x, y, 'shrub', { variant: h(x, y, 441) < 0.4 ? 'b' : 'a' })) n++;
    }
  }
  if (s.tier >= 3) {
    let n = 0;
    for (let r = 3; r <= 6 && n < s.tier; r++)
      for (let dy = -r; dy <= r && n < s.tier; dy++) for (let dx = -r; dx <= r && n < s.tier; dx++)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && h(s.cx + dx, s.cy + dy, 442) < 0.08 && put(s.cx + dx, s.cy + dy, 'planter')) n++;
  }
  // City: banners at the edges.
  if (s.tier >= 4) {
    const xs = s.buildings.map((b) => b.x), ys = s.buildings.map((b) => b.y);
    for (const [x, y] of [[Math.min(...xs) - 2, Math.min(...ys) - 2], [Math.max(...xs) + 3, Math.min(...ys) - 2], [Math.min(...xs) - 2, Math.max(...ys) + 3], [Math.max(...xs) + 3, Math.max(...ys) + 3]]) put(x, y, 'banner', { color });
  }
  return out.slice(0, 60);
}

const SIDES: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const unk = (k: number): [number, number] => { const x = Math.round(k / 134217728); return [x, k - x * 134217728]; };

/**
 * Walls around a besieged settlement: along the edge of its settled ground,
 * with gates where roads cross it and towers at the corners. They're drawn,
 * not simulated: walls never block anyone (PRINCIPLES.md §5).
 * `underAttack` closes the gates.
 */
export function wallsFor(m: Mirror, s: Settlement, color: string, traffic: (x: number, y: number) => number, underAttack: boolean): { wall: Wall | null; decor: Decor[] } {
  const tier = wallTierOf(s.sieges);
  if (!tier) return { wall: null, decor: [] };
  const edges: Wall['edges'] = [];
  const decor: Decor[] = [];
  const gates = new Set<number>();
  for (const k of s.ground.keys()) {
    const [x, y] = unk(k);
    const t = terrainAt(m.seed, x, y);
    if (t === 'water' || t === 'mountain') continue;
    const open: number[] = [];
    SIDES.forEach(([dx, dy], side) => { if (!s.ground.has(key(x + dx, y + dy))) open.push(side); });
    if (!open.length) continue;
    // Roads through the wall become gates.
    const road = open.some((side) => traffic(x + SIDES[side][0], y + SIDES[side][1]) >= 4) && traffic(x, y) >= 12;
    const gateNearby = [...gates].some((g) => { const [gx, gy] = unk(g); return cheb(gx, gy, x, y) <= 2; });
    if (road && !gateNearby) {
      gates.add(k);
      decor.push({ x, y, kind: 'gate', color, variant: underAttack ? 'closed' : 'open' });
      continue;
    }
    for (const side of open) edges.push({ x, y, side });
    // Towers on corners (two perpendicular open sides).
    const corner = open.length >= 2 && open.some((a) => open.includes((a + 1) % 4));
    if (corner && tier >= 2 && (tier === 3 || hash01(m.seed, x, y, 430) < 0.5)) decor.push({ x, y, kind: 'tower', color, variant: 'stone' });
    else if (corner && tier === 1 && hash01(m.seed, x, y, 431) < 0.3) decor.push({ x, y, kind: 'tower', color, variant: 'wood' });
  }
  return { wall: { settlement: s.id, tier, edges }, decor };
}

/** Resources that take a civilized form in settlements (visuals.md §13); the rest stay wild for now. */
export const CIVIC_KINDS = new Set(['tree', 'rock']);

/**
 * Civilized resources (visuals.md §13): inside a village, town or city, trees, rock, ore and
 * wheat stay what they are but are drawn tended, grander with the settlement's tier. Nodes of
 * one kind that share a 3×3 block (3 or more) are drawn as one piece at their middle: an
 * orchard, a garden, a monument. Returns the pieces to draw and the node squares they replace.
 */
export function civicResources(m: Mirror, groundTier: (k: number) => number, colorOf: (owner: string | null) => string, ownerAt: (x: number, y: number) => string | null): { decor: Decor[]; hidden: Set<number> } {
  const decor: Decor[] = [], hidden = new Set<number>();
  const cells = new Map<string, { kind: string; xs: number[]; ys: number[]; tier: number }>();
  for (const n of m.nodes.values()) {
    if (n.remaining <= 0 || n.hoard || !CIVIC_KINDS.has(n.kind)) continue;
    const k = key(n.x, n.y), tier = groundTier(k);
    if (tier < 2) continue;
    const ck = `${n.kind}:${Math.floor(n.x / 3)},${Math.floor(n.y / 3)}`;
    let c = cells.get(ck);
    if (!c) cells.set(ck, (c = { kind: n.kind, xs: [], ys: [], tier }));
    c.xs.push(n.x); c.ys.push(n.y); c.tier = Math.max(c.tier, tier);
  }
  for (const c of cells.values()) {
    const clump = c.xs.length >= 3;
    const place = (x: number, y: number, fx: number, fy: number, size?: number) => {
      const biome = biomeAt(m.seed, x, y);
      const v = Math.floor(hash01(m.seed, x, y, 450) * 4);
      decor.push({ x, y, fx, fy, size, kind: 'civic', color: colorOf(ownerAt(x, y)), variant: `${c.kind}:${c.tier}:${clump ? 1 : 0}:${biome}:${v}` });
    };
    c.xs.forEach((x, i) => hidden.add(key(x, c.ys[i])));
    if (clump) {
      const mx = c.xs.reduce((a, b) => a + b, 0) / c.xs.length, my = c.ys.reduce((a, b) => a + b, 0) / c.ys.length;
      place(Math.round(mx), Math.round(my), mx, my, Math.min(3, 1.2 + 0.3 * c.xs.length));
    } else c.xs.forEach((x, i) => place(x, c.ys[i], x, c.ys[i]));
  }
  return { decor, hidden };
}
