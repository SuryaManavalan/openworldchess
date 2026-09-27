// Cosmetic civilizations (docs/specs/cosmetics.md): a paid restyle of all your
// pieces and buildings. Looks only: no civilization plays differently.

export interface Civ {
  id: string;
  name: string;
  /** One line for the shop card. */
  tagline: string;
  /** Price in Crowns, the in-game currency. */
  price: number;
  /** Shop card accent. */
  color: string;
}

export const CIVS: Civ[] = [
  { id: 'dravidian', name: 'Dravidian', tagline: 'Granite gopurams, temple bells and war elephants in gold nettipattam.', price: 500, color: '#c8742e' },
  { id: 'roman', name: 'Roman', tagline: 'Marble porticoes, legionaries and an emperor crowned in gold laurel.', price: 500, color: '#8e2f3f' },
  { id: 'chinese', name: 'Chinese', tagline: 'Vermilion halls under golden roofs, pagodas and phoenix crowns.', price: 500, color: '#c23b2b' },
  { id: 'egyptian', name: 'Egyptian', tagline: 'Pylon gates, obelisks and a pharaoh in the double crown.', price: 500, color: '#2f6fa8' },
];

/**
 * Crowns: the shop currency, bought in packs through Stripe (cosmetics.md §2).
 * Bigger packs carry a bonus.
 */
export interface CrownPack { id: string; crowns: number; cents: number; bonus?: string }
export const CROWN_PACKS: CrownPack[] = [
  { id: 'crowns-500', crowns: 500, cents: 499 },
  { id: 'crowns-1100', crowns: 1100, cents: 999, bonus: '+10%' },
  { id: 'crowns-2400', crowns: 2400, cents: 1999, bonus: '+20%' },
];
export const packById = (id: string | undefined) => CROWN_PACKS.find((p) => p.id === id);

export const CIV_IDS = CIVS.map((c) => c.id);
export const civById = (id: string | undefined) => CIVS.find((c) => c.id === id);
