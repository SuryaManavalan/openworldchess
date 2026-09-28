// How each biome looks (visuals.md §11): ground colors per terrain, the little
// marks painted on squares, and which tree, rock, ore and crop art its resource
// nodes use. Purely visual: a biome never changes the rules (world.md §2b).
import { BIOMES, hash01, type Biome } from '@owc/worldgen';

/** [light, dark, mark] for one terrain in one biome. */
export type Pal = [string, string, string];
/** Terrain codes: 0 grass, 1 sand, 2 water, 3 forest, 4 mountain. */
export const BASE: Pal[] = [
  ['#b5d175', '#95b957', '#7fa246'],
  ['#f1e2b5', '#e2cd96', '#c9b27a'],
  ['#8fd0e3', '#71bcd4', '#e6f6fb'],
  ['#8fb85a', '#76a447', '#5c8a38'],
  ['#a39a8c', '#8f8678', '#766e62'],
];

/** Marks painted on open ground and forest floor. */
export type Mark = 'tuft' | 'dot' | 'ripple' | 'petal' | 'sparkle' | 'crack' | 'heather' | 'cap' | 'leaf';

interface Look {
  pal: Partial<Record<0 | 1 | 2 | 3 | 4, Pal>>;
  mark?: Mark;
  /** Accent color for special marks (petals, heather, sparkles). */
  accent?: string;
  trees: string[];
  rock: string;
  ore: string;
  crop: string;
  /** Water that glows (lava). */
  lava?: boolean;
}

export const LOOK: Record<Biome, Look> = {
  meadow: { pal: {}, trees: ['oak', 'oak', 'pine'], rock: 'boulder', ore: 'gold', crop: 'wheat' },
  woodland: { pal: { 0: ['#afcd6e', '#8fb551', '#799c40'] }, trees: ['oak', 'pine', 'oak'], rock: 'mossy', ore: 'gold', crop: 'wheat' },
  birch: { pal: { 0: ['#bdd882', '#a2c267', '#86a84e'], 3: ['#a8c86e', '#8fb358', '#77993f'] }, mark: 'leaf', accent: '#e8d86a', trees: ['birch', 'birch', 'oak'], rock: 'mossy', ore: 'silver', crop: 'wheat' },
  autumn: { pal: { 0: ['#c8c67c', '#b2ae60', '#a0703a'], 3: ['#caa35c', '#b58c46', '#9a5a2e'] }, mark: 'leaf', accent: '#d9743a', trees: ['maple', 'maple', 'oak'], rock: 'mossy', ore: 'copper', crop: 'pumpkins' },
  taiga: { pal: { 0: ['#a3be80', '#8aa86a', '#6e8e56'], 3: ['#739c62', '#608a52', '#4a6e3e'] }, trees: ['pine', 'pine', 'snowpine'], rock: 'boulder', ore: 'silver', crop: 'berries' },
  tundra: {
    pal: { 0: ['#eef3f6', '#dde7ee', '#c5d3de'], 1: ['#e4e8e4', '#d4dad4', '#b8c2bc'], 2: ['#b8dcea', '#a2cfe0', '#f4fbfe'], 3: ['#dfe9e6', '#cddcd8', '#a8c0bc'], 4: ['#dde2e7', '#c8cfd6', '#f8fbfd'] },
    mark: 'sparkle', accent: '#ffffff', trees: ['snowpine'], rock: 'snowy', ore: 'silver', crop: 'berries',
  },
  highland: { pal: { 0: ['#b4c27c', '#9bac64', '#7f9050'] }, mark: 'heather', accent: '#a0679e', trees: ['juniper', 'pine'], rock: 'boulder', ore: 'gold', crop: 'wheat' },
  savanna: { pal: { 0: ['#dccb7e', '#cbb664', '#b39a4a'], 1: ['#efdcaa', '#e2cb8e', '#c9ae74'] }, trees: ['acacia'], rock: 'sandstone', ore: 'copper', crop: 'corn' },
  desert: {
    pal: { 0: ['#f1dda2', '#e7cd88', '#cdb070'], 1: ['#f4e4b4', '#ead598', '#d2b882'], 4: ['#caa87c', '#b8956a', '#9a7a54'] },
    mark: 'ripple', trees: ['cactus', 'cactus', 'palm'], rock: 'sandstone', ore: 'gold', crop: 'cactusfruit',
  },
  badlands: {
    pal: { 0: ['#dba97a', '#ca956a', '#a8704a'], 1: ['#e8c69e', '#dab488', '#bf9670'], 4: ['#b9714b', '#a45f3f', '#874a30'] },
    mark: 'crack', trees: ['joshua', 'cactus'], rock: 'redrock', ore: 'copper', crop: 'corn',
  },
  jungle: { pal: { 0: ['#a2d06c', '#88bc56', '#6ea040'], 3: ['#6fae4a', '#5c9a3a', '#48802c'] }, mark: 'leaf', accent: '#3f8a3a', trees: ['palm', 'palm', 'oak'], rock: 'mossy', ore: 'emerald', crop: 'corn' },
  swamp: {
    pal: { 0: ['#93aa6c', '#7f965a', '#617c46'], 1: ['#bcae8c', '#ab9c7c', '#8a7c5e'], 2: ['#83ab9c', '#6f998a', '#b8d4c4'], 3: ['#7c9c5c', '#6a8a4c', '#52703a'] },
    mark: 'dot', accent: '#5f7a44', trees: ['willow', 'willow', 'deadtree'], rock: 'mossy', ore: 'emerald', crop: 'rice',
  },
  blossom: { pal: { 0: ['#c6dc88', '#adc670', '#94ae58'], 3: ['#bad07c', '#a2bc66', '#889f50'] }, mark: 'petal', accent: '#f2a6c2', trees: ['cherry', 'cherry', 'oak'], rock: 'boulder', ore: 'amethyst', crop: 'wheat' },
  mushroom: { pal: { 0: ['#abba96', '#97a781', '#7c8c68'], 3: ['#919e7c', '#7e8c6a', '#667452'] }, mark: 'cap', accent: '#c46a5a', trees: ['bigshroom', 'bigshroom', 'oak'], rock: 'mossy', ore: 'amethyst', crop: 'glowcaps' },
  blight: {
    pal: { 0: ['#aba792', '#98947e', '#6f6a5a'], 2: ['#737e74', '#646e66', '#9aa29a'], 3: ['#918d7a', '#807c6a', '#625e50'], 4: ['#7c7874', '#6c6864', '#565250'] },
    mark: 'crack', trees: ['deadtree'], rock: 'grave', ore: 'silver', crop: 'pumpkins',
  },
  fey: {
    pal: { 0: ['#a2d8a4', '#89c68e', '#6aa872'], 2: ['#a2e2e2', '#88d2d6', '#f0ffff'], 3: ['#82c69c', '#6cb288', '#52966c'] },
    mark: 'sparkle', accent: '#eaffb0', trees: ['silverwood', 'silverwood', 'cherry'], rock: 'runestone', ore: 'sapphire', crop: 'berries',
  },
  crystal: {
    pal: { 0: ['#cbd6e2', '#b6c4d4', '#8fa6c0'], 1: ['#e2e4ee', '#d2d6e4', '#b4bad0'], 2: ['#b6e6f2', '#9ad8ea', '#f4feff'], 3: ['#b2c6d8', '#9cb2c8', '#7e96b0'], 4: ['#aab6da', '#96a4ca', '#d8e0ff'] },
    mark: 'sparkle', accent: '#bfe8ff', trees: ['crystaltree', 'silverwood'], rock: 'crystal', ore: 'sapphire', crop: 'glowcaps',
  },
  volcanic: {
    pal: { 0: ['#8c8682', '#7c7672', '#5a5450'], 1: ['#9c948c', '#8c847c', '#6c645c'], 2: ['#e2703a', '#d25a2a', '#ffd070'], 3: ['#716c68', '#645f5b', '#4a4542'], 4: ['#4c4644', '#403a38', '#2e2a28'] },
    mark: 'crack', accent: '#e8703a', trees: ['charred'], rock: 'basalt', ore: 'ruby', crop: 'firebloom', lava: true,
  },
};

const LOOKS = BIOMES.map((b) => LOOK[b]);
export const lookOf = (code: number) => LOOKS[code] ?? LOOK.meadow;
export const palOf = (code: number, biome: number): Pal => lookOf(biome).pal[code as 0 | 1 | 2 | 3 | 4] ?? BASE[code];

/** Art key for a resource node in a biome, e.g. "tree:cherry" or "ore:ruby". */
export function nodeArt(seed: number, kind: string, x: number, y: number, biome: Biome, depleted = false, hoard = false): string {
  // Hoards left by scattered camps look like treasure caches (campaign.md §4.2).
  if (hoard) return `hoard:${kind}`;
  const l = LOOK[biome];
  if (kind === 'tree') return depleted ? 'stump' : `tree:${l.trees[Math.floor(hash01(seed, x, y, 5) * l.trees.length)]}`;
  if (kind === 'rock') return `rock:${l.rock}`;
  if (kind === 'ore') return `ore:${l.ore}`;
  return `crop:${l.crop}`;
}
