// The wilds (docs/specs/wilds.md): hordes and herds that live between the
// cities. Each faction maps the six chess roles to creatures, so a Goblin Boss
// is a king and moves and fights exactly like one. Data only; art lives in
// art/assets/creatures.mjs, behavior on the server.
import type { NodeKind, PieceKind } from './constants.ts';

/** How a faction behaves toward players. */
export type Temper =
  /** Grazing animals: never attack; fight only when attacked. */
  | 'herd'
  /** Guards its den: attacks kings that come close to its camp. */
  | 'lair'
  /** Raiders: attack kings that come close, and roam wider. */
  | 'horde';

/** How rare a faction is. */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
/** How often a faction is picked, relative to others in its biome. */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 1, uncommon: 0.45, rare: 0.15, legendary: 0.05 };

export interface Faction {
  id: string;
  name: string;
  /** What its camp is called ("Goblin Camp"). */
  camp: string;
  /** Which camp art to draw (art/assets/camps.mjs). */
  campArt: string;
  temper: Temper;
  /** Biomes it lives in, most at home first. */
  biomes: string[];
  /** Camps sit near this kind of resource (or water). */
  near: NodeKind | 'water';
  rarity: Rarity;
  /** Only appears where the area rating is at least this. */
  minElo: number;
  /** Creature name for each chess role. */
  roles: Record<PieceKind, string>;
  /** Art: head type, knight mount, and palette (skin, dark, accent, eyes). */
  art: { head: string; mount: string; skin: string; dark: string; accent: string; eye: string };
  /** One line of flavor for the inspect card. */
  lore: string;
}

const f = (id: string, name: string, camp: string, campArt: string, temper: Temper, biomes: string, near: NodeKind | 'water', rarity: Rarity, minElo: number, roles: string, head: string, mount: string, skin: string, dark: string, accent: string, eye: string, lore: string): Faction => {
  const [K, Q, R, B, N, P] = roles.split('|');
  return { id, name, camp, campArt, temper, biomes: biomes.split(' '), near, rarity, minElo, roles: { K, Q, R, B, N, P }, art: { head, mount, skin, dark, accent, eye }, lore };
};

export const FACTIONS: Record<string, Faction> = Object.fromEntries([
  f('goblins', 'Goblin Warband', 'Goblin Camp', 'tents', 'horde', 'highland meadow badlands', 'rock', 'common', 0, 'Goblin Boss|Hobgoblin Captain|Bugbear Brute|Goblin Hexer|Wolf Rider|Goblin', 'goblin', 'wolf', '#8fb35a', '#5f7a3a', '#b5543a', '#f3d23a', 'Squabbling raiders who nest in quarries and hoard whatever shines.'),
  f('wolves', 'Wolf Pack', 'Wolf Den', 'den', 'lair', 'taiga woodland birch', 'tree', 'common', 0, 'Alpha Wolf|Dire Wolf|Cave Bear|Moon Howler|Worg|Grey Wolf', 'wolf', 'wolf', '#9a9a96', '#5f5f5c', '#dcdcd4', '#f3d23a', 'They follow the herds through the pines and defend their den to the last.'),
  f('kobolds', 'Kobold Warren', 'Kobold Warren', 'burrow', 'lair', 'badlands highland desert', 'ore', 'common', 0, 'Kobold Chieftain|Dragon Wyrmling|Burrow Drake|Scale Sorcerer|Weasel Rider|Kobold', 'kobold', 'weasel', '#c8643a', '#8a3f22', '#e3b23c', '#fff2a8', 'Tunnelers who worship a sleeping dragon and trap every path to their gold.'),
  f('orcs', 'Orc Warhost', 'Orc War Camp', 'tents', 'horde', 'savanna meadow badlands', 'wheat', 'common', 900, 'Orc Warchief|Blood Priestess|Ogre|Orc Shaman|Boar Rider|Orc', 'orc', 'boar', '#7f9563', '#4f5f3c', '#9e3b30', '#ff6a4a', 'A war band on the march, taking the fields of anyone too weak to hold them.'),
  f('bandits', 'Bandit Company', 'Bandit Camp', 'tents', 'horde', 'meadow woodland autumn', 'ore', 'common', 0, 'Bandit Lord|Bandit Captain|Thug|Hedge Wizard|Highwayman|Cutpurse', 'bandit', 'horse', '#e0b894', '#5a4636', '#8a2f2f', '#2b2622', 'Deserters and thieves who tax every road they can see from their camp.'),
  f('deer', 'Stag Herd', 'Glade', 'glade', 'herd', 'meadow birch woodland autumn', 'wheat', 'common', 0, 'Great Stag|Silver Hind|Elk|White Hart|Swift Buck|Fawn', 'deer', 'deer', '#c28a52', '#8a5e36', '#f4ead8', '#2b2622', 'Grazers of the meadows. Peaceful, unless their stag is threatened.'),
  f('boars', 'Boar Sounder', 'Wallow', 'wallow', 'herd', 'woodland autumn jungle', 'tree', 'common', 0, 'Boar King|Great Sow|Dire Boar|Old Tusker|Charging Boar|Piglet', 'boar', 'boar', '#7a5a48', '#4e382c', '#f1e6cf', '#2b2622', 'They root through the forest floor and charge anything that startles them.'),
  f('gnolls', 'Gnoll Pack', 'Gnoll Lair', 'totem', 'horde', 'savanna desert', 'wheat', 'common', 0, 'Fang Lord|Pack Mother|Hulking Gnoll|Witherling|Hyena|Gnoll', 'gnoll', 'hyena', '#c9a86a', '#8a6d3f', '#6b3f2a', '#f3d23a', 'Laughing hunters of the open plains. They never stop moving for long.'),
  f('lizardfolk', 'Lizardfolk Tribe', 'Swamp Village', 'huts', 'lair', 'swamp jungle', 'water', 'common', 0, 'Lizard King|Lizard Queen|Crocodile|Swamp Shaman|Giant Lizard|Lizardfolk', 'lizard', 'lizard', '#5f9a6e', '#3f6a4a', '#d9b24a', '#f3e08a', 'Patient hunters of the riverbanks who never waste anything they catch.'),
  f('frogfolk', 'Frogfolk Bog', 'Bog Mound', 'huts', 'horde', 'swamp', 'water', 'common', 0, 'Frog King|Toad Matron|Giant Toad|Bog Mystic|Newt Rider|Frogling', 'frog', 'newt', '#7fae4a', '#4f7a2e', '#e3b23c', '#f3e08a', 'Croaking raiders of the marsh who steal anything that floats.'),
  f('spiders', 'Spider Nest', 'Webbed Hollow', 'web', 'lair', 'jungle woodland blight', 'tree', 'uncommon', 0, 'Brood Mother|Phase Spider|Giant Spider|Web Witch|Leaping Spider|Spiderling', 'spider', 'spider', '#4a3f5c', '#2e2640', '#c7508f', '#ff5a6a', 'The trees here are heavy with silk. Things hang in it that were once travelers.'),
  f('owlbears', 'Owlbear Brood', 'Owlbear Nest', 'nest', 'lair', 'woodland autumn birch taiga', 'tree', 'uncommon', 0, 'Elder Owlbear|Owlbear Matron|Brown Bear|Great Horned Owl|Owlbear Cub|Owlbear Chick', 'owlbear', 'owlbear', '#9a7048', '#6b4a2e', '#e8d4a8', '#f3a93a', 'Half owl, half bear, entirely territorial. Leave the nest alone.'),
  f('harpies', 'Harpy Roost', 'Roost', 'nest', 'lair', 'highland badlands', 'rock', 'uncommon', 0, 'Harpy Matriarch|Siren|Roc Fledgling|Harpy Crone|Vulture Rider|Harpy', 'harpy', 'bird', '#d8b8a0', '#6b4a5c', '#8e5bd1', '#f3d23a', 'Their songs carry down the cliffs. Travelers who follow them rarely return.'),
  f('trolls', 'Troll Band', 'Troll Cave', 'den', 'horde', 'taiga highland swamp', 'rock', 'uncommon', 1100, 'Troll Chief|Troll Hag|Stone Giant|Troll Seer|Warg|Troll Whelp', 'troll', 'wolf', '#6f8a7a', '#46594c', '#b8a878', '#f3d23a', 'Huge, hungry and hard to kill. They come down from the mountains in lean years.'),
  f('sahuagin', 'Sahuagin Raiders', 'Tide Camp', 'huts', 'horde', 'swamp jungle meadow', 'water', 'uncommon', 1000, 'Sahuagin Baron|Sea Priestess|Giant Crab|Tide Priest|Shark Rider|Sahuagin', 'fish', 'shark', '#4f8f9a', '#2f5f6a', '#e3b23c', '#f3f08a', 'Sea devils who wade up the rivers to raid. They hate the dry land folk.'),
  f('lions', 'Lion Pride', 'Pride Rock', 'stones', 'lair', 'savanna', 'wheat', 'common', 0, 'Pride Lord|Lioness|Rhinoceros|Old Mane|Cheetah|Lion Cub', 'lion', 'cheetah', '#d9a655', '#9a6d30', '#7a4a22', '#2b2622', 'Lords of the long grass. They hunt at dusk and sleep through the heat.'),
  f('apes', 'Ape Troop', 'Canopy Nest', 'nest', 'lair', 'jungle', 'tree', 'common', 0, 'Silverback|Great Mother|Gorilla Brute|Mandrill Elder|Swinging Ape|Monkey', 'ape', 'ape', '#5a4a44', '#3a2e2a', '#c9a88a', '#f3d23a', 'Clever, loud and strong. They defend their fruit trees with thrown rocks.'),
  f('serpents', 'Serpent Cult', 'Snake Temple', 'temple', 'horde', 'jungle desert', 'ore', 'uncommon', 1200, 'Serpent Emperor|Naga Queen|Great Constrictor|Venom Priest|Cobra Rider|Snakeling', 'snake', 'snake', '#6a9a4a', '#3f5f2a', '#d9b24a', '#ff5a3a', 'Cold-blooded priests who drag captives to their temples in the green.'),
  f('scorpions', 'Scorpion Swarm', 'Dune Burrow', 'burrow', 'lair', 'desert badlands', 'rock', 'common', 0, 'Scorpion King|Scorpion Queen|Giant Scorpion|Stinger Priest|Scuttler|Scorpling', 'scorpion', 'scorpion', '#b5733a', '#7a4a22', '#3a2e2a', '#ff5a3a', 'The dunes hide them until the sand starts to move.'),
  f('mummies', 'Tomb Guard', 'Buried Tomb', 'pyramid', 'lair', 'desert', 'ore', 'rare', 1400, 'Mummy Lord|Tomb Queen|Stone Sphinx|Embalmer|Jackal Warrior|Mummy', 'mummy', 'jackal', '#e8dcc0', '#a8997a', '#3f8fd1', '#6fd1c4', 'Wrapped kings who still guard the gold they were buried with.'),
  f('frost', 'Frost Clan', 'Ice Cave', 'icecave', 'horde', 'tundra taiga', 'rock', 'uncommon', 1200, 'Frost Jarl|Ice Witch|Yeti|Rime Shaman|Winter Wolf|Snow Imp', 'frost', 'wolf', '#bcd6e8', '#7a9ab5', '#e8f4fb', '#3fb5e8', 'Giants and yetis of the far snows. Their breath freezes the rivers.'),
  f('mammoths', 'Mammoth Herd', 'Frozen Wallow', 'wallow', 'herd', 'tundra', 'wheat', 'common', 0, 'Mammoth Bull|Mammoth Matriarch|Woolly Rhino|Elder Tusker|Musk Ox|Mammoth Calf', 'mammoth', 'muskox', '#8a6448', '#5a3e2a', '#f4ead8', '#2b2622', 'Slow giants of the tundra. Nothing stands in front of a charging herd.'),
  f('centaurs', 'Centaur Tribe', 'Hill Camp', 'tipi', 'lair', 'meadow highland savanna', 'wheat', 'uncommon', 1100, 'Centaur Chieftain|Centaur Oracle|Stone Hurler|Star Reader|Centaur Lancer|Centaur Scout', 'centaur', 'horse', '#c9a07a', '#7a5a3a', '#3f7ab5', '#2b2622', 'Proud archers of the open hills. They read war in the stars.'),
  f('undead', 'Restless Dead', 'Barrow', 'barrow', 'horde', 'blight highland tundra', 'rock', 'uncommon', 0, 'Skeleton Lord|Wight|Bone Golem|Necromancer|Skeletal Steed|Skeleton', 'skull', 'bone', '#e8e2cf', '#a9a28c', '#6fd1c4', '#6fd1c4', 'Old soldiers who never stopped marching. Their barrows are full of grave goods.'),
  f('sporefolk', 'Sporefolk Circle', 'Fairy Ring', 'ring', 'herd', 'mushroom swamp jungle', 'tree', 'common', 0, 'Spore Sovereign|Spore Mother|Shambling Mound|Spore Druid|Toad Rider|Sprout', 'mushroom', 'toad', '#e8dcc8', '#a8998a', '#b5543a', '#2b2622', 'Gentle mushroom folk who share dreams through their spores. Rarely hostile.'),
  f('fey', 'Fey Court', 'Moonlit Glade', 'ring', 'herd', 'fey blossom', 'water', 'uncommon', 0, 'Satyr Lord|Dryad|Treant|Pixie Seer|Unicorn|Satyr', 'satyr', 'unicorn', '#d4b08a', '#6b4a2e', '#6fae4a', '#6fd1c4', 'Revelers from another world, dancing at the edge of this one.'),
  f('elementals', 'Earthen Court', 'Standing Stones', 'stones', 'lair', 'crystal highland badlands', 'rock', 'uncommon', 1300, 'Stone Sovereign|Crystal Queen|Earth Elemental|Geode Seer|Rolling Boulder|Pebble Sprite', 'stone', 'stone', '#a8a296', '#766f64', '#8fc6dc', '#8fe6ff', 'The hills themselves, awake. They care nothing for crowns, only for the stone.'),
  f('kitsune', 'Kitsune Shrine', 'Fox Shrine', 'shrine', 'lair', 'blossom', 'tree', 'rare', 1200, 'Nine-Tail Sage|Fox Empress|Lion Dog|Shrine Keeper|Spirit Fox|Fox Kit', 'fox', 'fox', '#e8904a', '#b5602a', '#f8f4ec', '#8a2f2f', 'Foxes older than any kingdom, keeping a shrine under the blossoms.'),
  f('salamanders', 'Fire Clan', 'Magma Forge', 'forge', 'horde', 'volcanic', 'ore', 'uncommon', 1300, 'Salamander Lord|Flame Matron|Magma Golem|Ember Priest|Hell Hound|Salamander', 'salamander', 'hellhound', '#d9543a', '#8a2f22', '#f3b23a', '#fff2a8', 'Born in the ash fields. They forge weapons in the rivers of fire.'),
  f('dragons', 'Dragon Brood', 'Dragon Hoard', 'hoard', 'lair', 'volcanic highland badlands', 'ore', 'legendary', 1700, 'Red Dragon|Dragon Matriarch|Drake|Wyrm Seer|Wyvern|Dragon Whelp', 'dragon', 'wyvern', '#c83a2f', '#7a1f1a', '#f0c24a', '#f3e08a', 'An old red and her brood, asleep on a mountain of gold. Mostly asleep.'),
  f('griffons', 'Griffon Aerie', 'Aerie', 'nest', 'lair', 'highland', 'rock', 'rare', 1400, 'Griffon King|Sky Queen|Roc|Thunderbird|Hippogriff|Griffon Chick', 'griffon', 'hippogriff', '#e0b060', '#8a6030', '#f4ead8', '#f3a93a', 'Half eagle, half lion. They nest on the highest crags and hate horses.'),
  f('hags', 'Hag Coven', 'Witch Hut', 'witchhut', 'lair', 'swamp blight', 'water', 'rare', 1300, 'Hag Mother|Green Hag|Flesh Golem|Bog Witch|Raven Rider|Scarecrow', 'hag', 'raven', '#8fa878', '#4f5f3c', '#6b3f7a', '#f3e08a', 'Three sisters in a hut that walks. They trade in names, and never fairly.'),
].map((x) => [x.id, x]));

export const FACTION_IDS = Object.keys(FACTIONS);

/** Display name of a wild piece, e.g. "Goblin Boss". */
export const creatureName = (faction: string | undefined, kind: PieceKind) => (faction && FACTIONS[faction] ? FACTIONS[faction].roles[kind] : undefined);

/** The order a camp grows in, from a lone king toward a full set (docs/specs/wilds.md §3). */
export const GROWTH_ORDER: PieceKind[] = ['K', 'P', 'P', 'N', 'P', 'P', 'B', 'P', 'R', 'P', 'Q', 'N', 'B', 'R', 'P', 'P'];

/** A camp (the client draws its props and label). */
export interface Camp {
  id: number;
  faction: string;
  x: number;
  y: number;
  /** Squares it roams within. */
  radius: number;
  name: string;
  kingId: number;
  /** Target size right now (grows over time). */
  size: number;
}
