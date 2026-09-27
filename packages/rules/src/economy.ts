// Economy formulas (economy.md §3, migration.md §3).
import { BUILDINGS, type BuildingType, type PieceKind } from '@owc/shared';
import { richness } from '@owc/worldgen';

export { richness };

/** Production time for one piece, faster on richer nodes. */
export function productionMs(type: BuildingType, nodeRichness: number, speed = 1): number {
  return BUILDINGS[type].baseMs / Math.max(0.1, nodeRichness) / speed;
}

/** Which building produces each piece kind. */
export const PRODUCER: Record<PieceKind, BuildingType> = { P: 'house', N: 'stable', B: 'temple', R: 'barracks', Q: 'palace', K: 'palace' };

/**
 * productionTime used for battle cooldowns (battle.md §8): the base time divided
 * by how many producing buildings the player has for that kind, or doubled
 * if they have none.
 */
export function regenMs(kind: PieceKind, producingCounts: Partial<Record<BuildingType, number>>, speed = 1): number {
  const type = PRODUCER[kind];
  const n = producingCounts[type] ?? 0;
  const base = BUILDINGS[type].baseMs / speed;
  return n > 0 ? base / n : base * 2;
}
