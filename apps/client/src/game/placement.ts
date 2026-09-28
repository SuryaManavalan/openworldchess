// Client-side building placement check, mirroring the server's rules
// (economy.md §2–3), so the ghost turns green or red before you commit.
import { ALTAR_BUILDINGS, ALTAR_REACH, ALTAR_TEND, ALTAR_TYPES, BUILDINGS, BUILD_SPACING, REACH, WORK_AREA, distToRect, key, type BuildingType, type NodeKind } from '@owc/shared';
import { buildable, terrainAt } from '@owc/worldgen';
import { mirror } from '../net.ts';

const NAME: Record<NodeKind, string> = { tree: 'wood', rock: 'stone', ore: 'ore', wheat: 'crops' };

export function checkPlacement(type: BuildingType, x: number, y: number): { ok: boolean; reason: string; rate?: number } {
  const spec = BUILDINGS[type], size = spec.size;
  const kings = mirror.myKings().filter((k) => k.state !== 'battle' && distToRect(k.x, k.y, x, y, size) <= REACH);
  // Altars (economy.md §8): a bishop raises one anywhere; a tended one holds a few small buildings.
  const tended = (a: { x: number; y: number }) => mirror.myPieces().some((p) => p.kind === 'B' && p.state !== 'battle' && Math.max(Math.abs(p.x - a.x), Math.abs(p.y - a.y)) <= ALTAR_TEND);
  if (type === 'altar') {
    if (!tended({ x, y })) return { ok: false, reason: 'Needs one of your bishops beside it' };
    if (mirror.myBuildings().some((b) => b.type === 'altar' && Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) <= 2 * ALTAR_REACH)) return { ok: false, reason: 'Too close to another of your altars' };
  } else if (!kings.length) {
    const altar = mirror.myBuildings().find((b) => b.type === 'altar' && b.built >= 1 && distToRect(b.x, b.y, x, y, size) <= ALTAR_REACH && tended(b));
    if (!altar) return { ok: false, reason: 'Needs one of your kings within 10 squares (or a tended altar within 5)' };
    if (!ALTAR_TYPES.includes(type)) return { ok: false, reason: 'By an altar: only houses, stables and temples' };
    if (mirror.myBuildings().filter((b) => b.type !== 'altar' && b.type !== 'ruin' && distToRect(altar.x, altar.y, b.x, b.y, b.size) <= ALTAR_REACH).length >= ALTAR_BUILDINGS) return { ok: false, reason: `An altar holds at most ${ALTAR_BUILDINGS} buildings` };
  }
  for (let dy = 0; dy < size; dy++)
    for (let dx = 0; dx < size; dx++) {
      const sx = x + dx, sy = y + dy;
      const t = terrainAt(mirror.seed, sx, sy);
      if (!buildable(t)) return { ok: false, reason: t === 'water' ? 'Not on water' : 'Not on mountains' };
      const n = mirror.nodes.get(key(sx, sy));
      if (n && n.remaining > 0 && n.kind !== 'wheat') return { ok: false, reason: n.kind === 'tree' ? 'A tree is in the way' : 'Rock is in the way' };
      for (const b of mirror.buildings.values()) if (distToRect(sx, sy, b.x, b.y, b.size) === 0) return { ok: false, reason: 'Something is already there' };
      const pid = mirror.pieceAt.get(key(sx, sy));
      if (pid != null && mirror.pieces.get(pid)?.owner !== mirror.me) return { ok: false, reason: 'Someone is standing there' };
    }
  for (const b of mirror.buildings.values())
    if (b.owner && b.owner !== mirror.me && distToRect(x, y, b.x, b.y, b.size) <= BUILD_SPACING + size - 1) return { ok: false, reason: 'Too close to another player' };
  if (type === 'palace' && mirror.myBuildings().some((b) => b.type === 'palace' && kings.some((k) => distToRect(k.x, k.y, b.x, b.y, b.size) <= REACH)))
    return { ok: false, reason: 'One palace per king' };
  const nodes = [...mirror.nodes.values()];
  for (const [kind, amt] of Object.entries(spec.cost) as [NodeKind, number][]) {
    const have = nodes.filter((n) => n.kind === kind && distToRect(n.x, n.y, x, y, size) <= REACH).reduce((s, n) => s + Math.max(0, n.remaining), 0);
    if (have < amt) return { ok: false, reason: `Needs ${amt} ${NAME[kind]} within 10 squares (${have} here)` };
  }
  const missing = spec.needs.filter((k) => !nodes.some((n) => n.kind === k && n.remaining > 0 && distToRect(n.x, n.y, x, y, size) <= WORK_AREA));
  if (missing.length) return { ok: false, reason: `Won't produce: no ${missing.map((k) => NAME[k]).join(' or ')} within 3 squares` };
  return { ok: true, reason: 'Good spot' };
}
