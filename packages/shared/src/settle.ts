// Settlements from buildings (visuals.md §10, campaign.md §4.3): a player's
// buildings within 8 squares of each other are one settlement. The client
// draws them; the server uses them for holding cities, trade and quests.
import { cheb, distToRect } from './geom.ts';
import { tierOfCount } from './chronicle.ts';
import type { Building } from './types.ts';

export interface SettlementInfo { id: number; owner: string; buildings: Building[]; cx: number; cy: number; tier: number }

export function clusterSettlements(all: Iterable<Building>): SettlementInfo[] {
  const byOwner = new Map<string, Building[]>();
  for (const b of all) {
    if (!b.owner || b.type === 'ruin' || b.type === 'camp') continue;
    let l = byOwner.get(b.owner);
    if (!l) byOwner.set(b.owner, (l = []));
    l.push(b);
  }
  const out: SettlementInfo[] = [];
  for (const [owner, blds] of byOwner) {
    const parent = blds.map((_, i) => i);
    const find = (i: number): number => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
    for (let i = 0; i < blds.length; i++)
      for (let j = i + 1; j < blds.length; j++) {
        const a = blds[i], b = blds[j];
        if (cheb(a.x, a.y, b.x, b.y) > 12) continue;
        if (distToRect(a.x, a.y, b.x, b.y, b.size) <= 8) parent[find(i)] = find(j);
      }
    const groups = new Map<number, Building[]>();
    blds.forEach((b, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r)!.push(b); });
    for (const bs of groups.values()) {
      out.push({
        id: Math.min(...bs.map((b) => b.id)), owner, buildings: bs,
        cx: Math.round(bs.reduce((s, b) => s + b.x + b.size / 2, 0) / bs.length),
        cy: Math.round(bs.reduce((s, b) => s + b.y + b.size / 2, 0) / bs.length),
        tier: tierOfCount(bs.length),
      });
    }
  }
  return out;
}
