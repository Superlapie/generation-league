import type { CreatureInstance, ItemDefinition, MoveDefinition, SpeciesDefinition, Stats } from './types';
import { calculateStats, expForLevel, NATURES, SeededRng, ZERO_STATS } from './rules';

const S = (hp: number, attack: number, defense: number, spAttack: number, spDefense: number, speed: number): Stats => ({ hp, attack, defense, spAttack, spDefense, speed });

const CREATURE_META: Record<string, { regionalNumber: number; category: string; description: string; habitat: string; height: number; weight: number; baseHappiness: number }> = {
  cragbud: { regionalNumber: 1, category: 'Sprout Stone', description: 'A young stone-backed sprout that stores sunlight in its moss.', habitat: 'Verdant Path', height: .4, weight: 6.2, baseHappiness: 70 },
  mossolith: { regionalNumber: 2, category: 'Moss Rock', description: 'Its layered shell gathers dew and protects a growing root heart.', habitat: 'Glimmerwood', height: .9, weight: 38.5, baseHappiness: 70 },
  glimmoss: { regionalNumber: 3, category: 'Grove Warden', description: 'Ancient moss blooms across its stone armor when it calls the wind.', habitat: 'Glimmerwood', height: 1.7, weight: 112.4, baseHappiness: 70 },
  cinderskink: { regionalNumber: 4, category: 'Ember Skink', description: 'A quick little skink that warms its tail by swallowing hot cinders.', habitat: 'Cinderstep', height: .5, weight: 7.1, baseHappiness: 70 },
  pyrograith: { regionalNumber: 5, category: 'Ash Runner', description: 'Its smoke mantle keeps its body cool while its inner flame accelerates.', habitat: 'Ashfall Grotto', height: 1.1, weight: 24.8, baseHappiness: 70 },
  pyrovanth: { regionalNumber: 6, category: 'Ridge Flame', description: 'A storm of fire follows every wingbeat from its blazing ridge crest.', habitat: 'Ember Ridge', height: 1.8, weight: 69.3, baseHappiness: 70 },
  jellume: { regionalNumber: 7, category: 'Glow Jelly', description: 'Its soft body shines brighter when it senses a friendly heartbeat.', habitat: 'Reedwater Crossing', height: .6, weight: 4.4, baseHappiness: 70 },
  prismedusa: { regionalNumber: 8, category: 'Prism Jelly', description: 'Crystalline fins split incoming light into protective color bands.', habitat: 'Reedwater Crossing', height: 1.2, weight: 18.6, baseHappiness: 70 },
  abyssara: { regionalNumber: 9, category: 'Deep Prism', description: 'Its abyssal glow can be seen through the deepest Tideglass channels.', habitat: 'Tideglass City', height: 2.1, weight: 88.7, baseHappiness: 70 },
  gildig: { regionalNumber: 10, category: 'Ore Digger', description: 'It can smell a useful mineral beneath a trail before anyone else can.', habitat: 'Verdant Path', height: .5, weight: 12.3, baseHappiness: 70 },
  oreclaw: { regionalNumber: 11, category: 'Ore Badger', description: 'Its reinforced claws tunnel through soft rock in search of bright seams.', habitat: 'Ashfall Grotto', height: 1.0, weight: 42.1, baseHappiness: 70 },
  auradger: { regionalNumber: 12, category: 'Aura Badger', description: 'Rare metal dust around its claws flashes in rhythm with its focused aura.', habitat: 'Ashfall Grotto', height: 1.5, weight: 86.9, baseHappiness: 70 },
  reedroll: { regionalNumber: 13, category: 'Reed Runner', description: 'It rolls through reeds so lightly that only a breeze gives it away.', habitat: 'Reedwater Crossing', height: .3, weight: 3.8, baseHappiness: 70 },
  wickerwhorl: { regionalNumber: 14, category: 'Woven Runner', description: 'Its woven body catches wind and turns every slope into a racetrack.', habitat: 'Reedwater Crossing', height: .8, weight: 11.6, baseHappiness: 70 },
  bramblecoil: { regionalNumber: 15, category: 'Bramble Runner', description: 'A living coil of reed and thorn that guards the quiet edges of the region.', habitat: 'Ember Ridge', height: 1.4, weight: 38.2, baseHappiness: 70 },
  spriglet: { regionalNumber: 16, category: 'Seedling', description: 'Its spiral seed mark warms in sunlight, helping it find the safest patch of soil.', habitat: 'Verdant Path', height: .3, weight: 4.1, baseHappiness: 70 },
  rootusk: { regionalNumber: 17, category: 'Root Grove', description: 'It grows a leafy mantle by sleeping with its paws tucked into soft earth.', habitat: 'Glimmerwood', height: .8, weight: 24.4, baseHappiness: 70 },
  canopaw: { regionalNumber: 18, category: 'Canopy', description: 'Its broad leaf canopy shelters smaller creatures during sudden woodland rain.', habitat: 'Glimmerwood', height: 1.5, weight: 78.2, baseHappiness: 70 },
  sootsqueak: { regionalNumber: 19, category: 'Coal Mouse', description: 'A warm ember in its cheek glows brighter whenever it is excited.', habitat: 'Cinderstep Town', height: .25, weight: 3.6, baseHappiness: 70 },
  kilnibble: { regionalNumber: 20, category: 'Kiln Mouse', description: 'Its back vents release tiny puffs of heat that keep it comfortable in cold caves.', habitat: 'Ashfall Grotto', height: .65, weight: 16.8, baseHappiness: 70 },
  hearthare: { regionalNumber: 21, category: 'Hearth Runner', description: 'It races along warm stone and leaves a gentle trail of heat behind its paws.', habitat: 'Ember Ridge', height: 1.2, weight: 48.5, baseHappiness: 70 },
  drizzlet: { regionalNumber: 22, category: 'Drop', description: 'It gathers in a small ripple when it hears rain approaching.', habitat: 'Reedwater Crossing', height: .35, weight: 2.8, baseHappiness: 70 },
  puddlefin: { regionalNumber: 23, category: 'Ripple', description: 'Its ring of fins lets it hover just above the surface of calm water.', habitat: 'Reedwater Crossing', height: .8, weight: 12.6, baseHappiness: 70 },
  rainquill: { regionalNumber: 24, category: 'Rain Current', description: 'The ribbons around its body trace the direction of distant storms.', habitat: 'Tideglass City', height: 1.6, weight: 52.2, baseHappiness: 70 },
  breezlet: { regionalNumber: 25, category: 'Puff', description: 'It rides warm air currents and collects light seeds in its curled tail.', habitat: 'Verdant Path', height: .3, weight: 2.2, baseHappiness: 70 },
  whifflit: { regionalNumber: 26, category: 'Fan Puff', description: 'Its broad fins let it hover in place even when the weather suddenly changes.', habitat: 'Ember Ridge', height: .7, weight: 8.4, baseHappiness: 70 },
  galegale: { regionalNumber: 27, category: 'Sail Puff', description: 'It can carry a gentle breeze across an entire valley with one sweeping turn.', habitat: 'Ember Ridge', height: 1.4, weight: 34.7, baseHappiness: 70 },
  tangletoad: { regionalNumber: 28, category: 'Marsh Bloom', description: 'The flower on its head opens whenever it finds clean water.', habitat: 'Reedwater Crossing', height: .35, weight: 5.2, baseHappiness: 70 },
  bogloom: { regionalNumber: 29, category: 'Pond Bloom', description: 'It stores cool droplets on its petals to stay comfortable through dry days.', habitat: 'Reedwater Crossing', height: .8, weight: 20.5, baseHappiness: 70 },
  mirebloom: { regionalNumber: 30, category: 'Wetland Bloom', description: 'Its reed-frill shelters young marsh creatures from strong currents and wind.', habitat: 'Tideglass City', height: 1.4, weight: 68.9, baseHappiness: 70 },
};

export const MOVES: Record<string, MoveDefinition> = {
  nudge: { id: 'nudge', name: 'Nudge', type: 'Neutral', power: 40, accuracy: 100, pp: 35, priority: 0, target: 'foe', category: 'Physical', effect: 'damage', animation: 'impact', audioCue: 'thud', description: 'A reliable body check.' },
  quickstep: { id: 'quickstep', name: 'Quickstep', type: 'Wind', power: 40, accuracy: 100, pp: 30, priority: 1, target: 'foe', category: 'Physical', effect: 'priority', animation: 'slash', audioCue: 'slice', description: 'A darting strike that acts first.' },
  harden: { id: 'harden', name: 'Stone Poise', type: 'Neutral', power: 0, accuracy: 0, pp: 30, priority: 0, target: 'self', category: 'Status', effect: 'raise', stat: 'defense', stages: 1, animation: 'guard', audioCue: 'shine', description: 'Raises Defense.' },
  focus: { id: 'focus', name: 'Focus Gleam', type: 'Neutral', power: 0, accuracy: 0, pp: 20, priority: 0, target: 'self', category: 'Status', effect: 'raise', stat: 'spAttack', stages: 1, animation: 'aura', audioCue: 'shine', description: 'Raises Special Attack.' },
  sandhush: { id: 'sandhush', name: 'Sandhush', type: 'Wind', power: 0, accuracy: 100, pp: 15, priority: 0, target: 'foe', category: 'Status', effect: 'lower', stat: 'accuracy', stages: -1, animation: 'dust', audioCue: 'gust', description: 'Whips grit into the foe’s eyes.' },

  leaflick: { id: 'leaflick', name: 'Leaf Flick', type: 'Verdant', power: 45, accuracy: 100, pp: 25, priority: 0, target: 'foe', category: 'Physical', effect: 'damage', animation: 'leaves', audioCue: 'leaf', description: 'Snaps a sharp leaf at the foe.' },
  vinebind: { id: 'vinebind', name: 'Vinebind', type: 'Verdant', power: 55, accuracy: 95, pp: 20, priority: 0, target: 'foe', category: 'Physical', effect: 'lower', stat: 'speed', stages: -1, animation: 'vines', audioCue: 'vine', description: 'Coiling vines slow the foe.' },
  sporeveil: { id: 'sporeveil', name: 'Spore Veil', type: 'Verdant', power: 0, accuracy: 80, pp: 15, priority: 0, target: 'foe', category: 'Status', effect: 'sleep', effectStatus: 'sleep', effectChance: 100, animation: 'spores', audioCue: 'spore', description: 'Drowsy spores may put the foe to sleep.' },
  rootdraw: { id: 'rootdraw', name: 'Rootdraw', type: 'Verdant', power: 65, accuracy: 100, pp: 15, priority: 0, target: 'foe', category: 'Physical', effect: 'drain', ratio: 0.5, animation: 'drain', audioCue: 'drain', description: 'Drains half the damage dealt.' },
  briarstorm: { id: 'briarstorm', name: 'Briarstorm', type: 'Verdant', power: 25, accuracy: 90, pp: 10, priority: 0, target: 'foe', category: 'Physical', effect: 'multiHit', minHits: 2, maxHits: 5, animation: 'briars', audioCue: 'leaf', description: 'A storm of thorns strikes 2–5 times.' },
  verdantmend: { id: 'verdantmend', name: 'Verdant Mend', type: 'Verdant', power: 0, accuracy: 0, pp: 10, priority: 0, target: 'self', category: 'Status', effect: 'heal', ratio: 0.5, animation: 'heal', audioCue: 'heal', description: 'Restores half of maximum HP.' },
  greencrown: { id: 'greencrown', name: 'Green Crown', type: 'Verdant', power: 90, accuracy: 100, pp: 10, priority: 0, target: 'foe', category: 'Physical', effect: 'damage', animation: 'crown', audioCue: 'leaf-heavy', description: 'A crushing bloom of ancient growth.' },

  embernip: { id: 'embernip', name: 'Ember Nip', type: 'Ember', power: 40, accuracy: 100, pp: 25, priority: 0, target: 'foe', category: 'Special', effect: 'burn', effectStatus: 'burn', effectChance: 10, animation: 'embers', audioCue: 'fire', description: 'A small flame that may burn.' },
  cinderspit: { id: 'cinderspit', name: 'Cinder Spit', type: 'Ember', power: 55, accuracy: 95, pp: 20, priority: 0, target: 'foe', category: 'Special', effect: 'burn', effectStatus: 'burn', effectChance: 20, animation: 'fireball', audioCue: 'fire', description: 'Hot cinders may leave a burn.' },
  smokeshroud: { id: 'smokeshroud', name: 'Smoke Shroud', type: 'Ember', power: 0, accuracy: 100, pp: 20, priority: 0, target: 'foe', category: 'Status', effect: 'lower', stat: 'accuracy', stages: -1, animation: 'smoke', audioCue: 'puff', description: 'Lowers the foe’s Accuracy.' },
  flarecoil: { id: 'flarecoil', name: 'Flare Coil', type: 'Ember', power: 75, accuracy: 100, pp: 15, priority: 0, target: 'foe', category: 'Special', effect: 'recoil', ratio: 0.25, animation: 'flare', audioCue: 'fire-heavy', description: 'A blazing charge with recoil.' },
  cinderfall: { id: 'cinderfall', name: 'Cinderfall', type: 'Ember', power: 0, accuracy: 0, pp: 10, priority: 0, target: 'self', category: 'Status', effect: 'weather', field: 'cinderfall', animation: 'cinder-rain', audioCue: 'rumble', description: 'Fills the field with falling embers.' },
  pyrehowl: { id: 'pyrehowl', name: 'Pyre Howl', type: 'Ember', power: 95, accuracy: 90, pp: 10, priority: 0, target: 'foe', category: 'Special', effect: 'burn', effectStatus: 'burn', effectChance: 30, animation: 'inferno', audioCue: 'fire-heavy', description: 'A roaring inferno that may burn.' },

  bubblepop: { id: 'bubblepop', name: 'Bubble Pop', type: 'Tide', power: 40, accuracy: 100, pp: 30, priority: 0, target: 'foe', category: 'Special', effect: 'damage', animation: 'bubbles', audioCue: 'bubble', description: 'Fires a burst of bubbles.' },
  prismsting: { id: 'prismsting', name: 'Prism Sting', type: 'Tide', power: 55, accuracy: 100, pp: 20, priority: 0, target: 'foe', category: 'Special', effect: 'poison', effectStatus: 'poison', effectChance: 20, animation: 'prism', audioCue: 'chime', description: 'A refracted sting that may poison.' },
  ebbguard: { id: 'ebbguard', name: 'Ebb Guard', type: 'Tide', power: 0, accuracy: 0, pp: 15, priority: 4, target: 'self', category: 'Status', effect: 'protect', animation: 'barrier', audioCue: 'barrier', description: 'Blocks attacks for one turn.' },
  undertow: { id: 'undertow', name: 'Undertow', type: 'Tide', power: 70, accuracy: 95, pp: 15, priority: 0, target: 'foe', category: 'Special', effect: 'lower', stat: 'speed', stages: -1, animation: 'wave', audioCue: 'wave', description: 'A pulling current slows the foe.' },
  cleansingrain: { id: 'cleansingrain', name: 'Cleansing Rain', type: 'Tide', power: 0, accuracy: 0, pp: 10, priority: 0, target: 'self', category: 'Status', effect: 'cleanse', ratio: 0.25, animation: 'rain', audioCue: 'heal', description: 'Cures status and restores some HP.' },
  abyssalbeam: { id: 'abyssalbeam', name: 'Abyssal Beam', type: 'Tide', power: 100, accuracy: 85, pp: 5, priority: 0, target: 'foe', category: 'Special', effect: 'damage', animation: 'beam', audioCue: 'beam', description: 'A deep-water ray of immense power.' },

  pebblejab: { id: 'pebblejab', name: 'Pebble Jab', type: 'Neutral', power: 45, accuracy: 100, pp: 30, priority: 0, target: 'foe', category: 'Physical', effect: 'damage', animation: 'rocks', audioCue: 'rock', description: 'A sharp mineral jab.' },
  goldrush: { id: 'goldrush', name: 'Gold Rush', type: 'Wind', power: 60, accuracy: 100, pp: 20, priority: 0, target: 'foe', category: 'Physical', effect: 'raise', stat: 'speed', stages: 1, animation: 'gold', audioCue: 'chime', description: 'A flashing rush that builds speed.' },
  orearmor: { id: 'orearmor', name: 'Ore Armor', type: 'Neutral', power: 0, accuracy: 0, pp: 20, priority: 0, target: 'self', category: 'Status', effect: 'raise', stat: 'defense', stages: 2, animation: 'guard', audioCue: 'rock', description: 'Sharply raises Defense.' },
  tunnelburst: { id: 'tunnelburst', name: 'Tunnel Burst', type: 'Wind', power: 80, accuracy: 90, pp: 15, priority: 0, target: 'foe', category: 'Physical', effect: 'damage', animation: 'dust-burst', audioCue: 'rumble', description: 'Bursts from below in a storm of grit.' },
  auraclaw: { id: 'auraclaw', name: 'Aura Claw', type: 'Neutral', power: 95, accuracy: 100, pp: 10, priority: 0, target: 'foe', category: 'Physical', effect: 'damage', animation: 'gold-slash', audioCue: 'slice-heavy', description: 'A brilliant claw strike.' },

  reedwhip: { id: 'reedwhip', name: 'Reed Whip', type: 'Verdant', power: 45, accuracy: 100, pp: 25, priority: 0, target: 'foe', category: 'Physical', effect: 'damage', animation: 'whip', audioCue: 'vine', description: 'A springy reed lashes the foe.' },
  rollrush: { id: 'rollrush', name: 'Rollrush', type: 'Wind', power: 60, accuracy: 95, pp: 20, priority: 0, target: 'foe', category: 'Physical', effect: 'recoil', ratio: 0.15, animation: 'roll', audioCue: 'thud', description: 'A tumbling rush with light recoil.' },
  wickertrap: { id: 'wickertrap', name: 'Wicker Trap', type: 'Verdant', power: 0, accuracy: 90, pp: 15, priority: 0, target: 'foe', category: 'Status', effect: 'paralyze', effectStatus: 'paralysis', effectChance: 100, animation: 'vines', audioCue: 'vine', description: 'A woven trap paralyzes the foe.' },
  tailwind: { id: 'tailwind', name: 'Tailwind', type: 'Wind', power: 0, accuracy: 0, pp: 10, priority: 0, target: 'self', category: 'Status', effect: 'weather', field: 'tailwind', animation: 'wind', audioCue: 'gust', description: 'Whips up a speed-favoring wind.' },
  bramblewheel: { id: 'bramblewheel', name: 'Bramble Wheel', type: 'Verdant', power: 90, accuracy: 90, pp: 10, priority: 0, target: 'foe', category: 'Physical', effect: 'recoil', ratio: 0.2, animation: 'bramble-wheel', audioCue: 'leaf-heavy', description: 'A thorned wheel crashes into the foe.' },
};

const line = (id: string, name: string, lineName: string, stage: 1 | 2 | 3, types: SpeciesDefinition['types'], baseStats: Stats, growthCurve: SpeciesDefinition['growthCurve'], captureRate: number, baseExp: number, abilities: string[], learnset: Array<[number, string]>, spriteUrl: string, evolution?: SpeciesDefinition['evolution'], assetRoot = A): SpeciesDefinition => {
  const meta = CREATURE_META[id];
  return {
    id, regionalNumber: meta.regionalNumber, name, line: lineName, stage, category: meta.category, description: meta.description, habitat: meta.habitat,
    height: meta.height, weight: meta.weight, baseHappiness: meta.baseHappiness, types, baseStats, growthCurve, captureRate, baseExp,
    evYield: stage === 1 ? { hp: 1 } : stage === 2 ? { defense: 2 } : { attack: 2, hp: 1 }, abilities, learnset, evolution, spriteKey: id, spriteUrl,
    spriteSheet: `${assetRoot}/sheets/${id}-battle-sheet.png`, animationKeys: ['idle','attack','hit','faint','status','select'],
  };
};

const A = '/assets/creatures';
export const SPECIES: Record<string, SpeciesDefinition> = {
  cragbud: line('cragbud', 'Cragbud', 'Glimmoss', 1, ['Verdant'], S(48, 52, 58, 38, 48, 36), 'medium', 180, 62, ['Rootwake', 'Stoneheart'], [[1,'nudge'],[3,'harden'],[6,'leaflick'],[9,'sandhush'],[13,'rootdraw']], `${A}/glimmoss/glimmoss-stage-1.png`, { level: 16, speciesId: 'mossolith' }),
  mossolith: line('mossolith', 'Mossolith', 'Glimmoss', 2, ['Verdant'], S(68, 72, 82, 53, 68, 46), 'medium', 90, 132, ['Rootwake', 'Stoneheart'], [[1,'nudge'],[6,'leaflick'],[9,'harden'],[13,'rootdraw'],[18,'briarstorm'],[24,'verdantmend']], `${A}/glimmoss/glimmoss-stage-2.png`, { level: 36, speciesId: 'glimmoss' }),
  glimmoss: line('glimmoss', 'Glimmoss', 'Glimmoss', 3, ['Verdant','Wind'], S(92, 104, 112, 72, 96, 64), 'medium', 45, 220, ['Rootwake', 'Stoneheart'], [[1,'leaflick'],[13,'rootdraw'],[18,'briarstorm'],[24,'verdantmend'],[36,'greencrown'],[42,'tailwind']], `${A}/glimmoss/glimmoss-stage-3.png`),

  cinderskink: line('cinderskink', 'Cinderskink', 'Pyrovanth', 1, ['Ember'], S(42, 48, 38, 60, 44, 58), 'medium', 180, 63, ['Flashkindle', 'Shedskin'], [[1,'nudge'],[3,'quickstep'],[6,'embernip'],[10,'smokeshroud'],[14,'cinderspit']], `${A}/cinderskink/cinderskink-stage-1.png`, { level: 16, speciesId: 'pyrograith' }),
  pyrograith: line('pyrograith', 'Pyrograith', 'Pyrovanth', 2, ['Ember','Wind'], S(60, 66, 50, 82, 60, 82), 'medium', 90, 134, ['Flashkindle', 'Shedskin'], [[1,'quickstep'],[6,'embernip'],[10,'smokeshroud'],[14,'cinderspit'],[20,'flarecoil'],[27,'cinderfall']], `${A}/pyrograith/pyrograith-stage-2.png`, { level: 36, speciesId: 'pyrovanth' }),
  pyrovanth: line('pyrovanth', 'Pyrovanth', 'Pyrovanth', 3, ['Ember','Wind'], S(78, 88, 66, 112, 82, 112), 'medium', 45, 223, ['Flashkindle', 'Shedskin'], [[1,'embernip'],[14,'cinderspit'],[20,'flarecoil'],[27,'cinderfall'],[36,'pyrehowl'],[43,'quickstep']], `${A}/pyrovanth/pyrovanth-stage-3.png`),

  jellume: line('jellume', 'Jellume', 'Abyssara', 1, ['Tide'], S(52, 34, 45, 60, 62, 42), 'slow', 180, 64, ['Clearbody', 'Tidewell'], [[1,'nudge'],[4,'bubblepop'],[8,'focus'],[11,'prismsting'],[15,'ebbguard']], `${A}/jellyfish/jellyfish-stage-1.png`, { level: 16, speciesId: 'prismedusa' }),
  prismedusa: line('prismedusa', 'Prismedusa', 'Abyssara', 2, ['Tide'], S(72, 45, 62, 84, 88, 57), 'slow', 90, 136, ['Clearbody', 'Tidewell'], [[1,'bubblepop'],[8,'focus'],[11,'prismsting'],[15,'ebbguard'],[21,'undertow'],[28,'cleansingrain']], `${A}/jellyfish/jellyfish-stage-2.png`, { level: 36, speciesId: 'abyssara' }),
  abyssara: line('abyssara', 'Abyssara', 'Abyssara', 3, ['Tide','Wind'], S(102, 60, 82, 116, 122, 76), 'slow', 45, 226, ['Clearbody', 'Tidewell'], [[1,'bubblepop'],[11,'prismsting'],[15,'ebbguard'],[21,'undertow'],[28,'cleansingrain'],[36,'abyssalbeam']], `${A}/jellyfish/jellyfish-stage-3.png`),

  gildig: line('gildig', 'Gildig', 'Auradger', 1, ['Neutral'], S(54, 57, 58, 32, 44, 48), 'fast', 200, 58, ['Prospector', 'Gritcoat'], [[1,'nudge'],[5,'pebblejab'],[9,'sandhush'],[13,'goldrush'],[17,'orearmor']], `${A}/honeybadger/honeybadger-stage-1.png`, { level: 18, speciesId: 'oreclaw' }),
  oreclaw: line('oreclaw', 'Oreclaw', 'Auradger', 2, ['Neutral','Wind'], S(74, 82, 84, 44, 62, 68), 'fast', 100, 128, ['Prospector', 'Gritcoat'], [[1,'pebblejab'],[9,'sandhush'],[13,'goldrush'],[18,'orearmor'],[24,'tunnelburst']], `${A}/honeybadger/honeybadger-stage-2.png`, { level: 32, speciesId: 'auradger' }),
  auradger: line('auradger', 'Auradger', 'Auradger', 3, ['Neutral','Wind'], S(94, 116, 108, 58, 82, 94), 'fast', 55, 214, ['Prospector', 'Gritcoat'], [[1,'pebblejab'],[13,'goldrush'],[18,'orearmor'],[24,'tunnelburst'],[32,'auraclaw']], `${A}/honeybadger/honeybadger-stage-3.png`),

  reedroll: line('reedroll', 'Reedroll', 'Bramblecoil', 1, ['Verdant','Wind'], S(46, 50, 48, 35, 45, 62), 'fast', 200, 59, ['Windweave', 'Thornhide'], [[1,'nudge'],[4,'reedwhip'],[8,'quickstep'],[12,'rollrush'],[16,'wickertrap']], `${A}/reedroll/reedroll-stage-1.png`, { level: 18, speciesId: 'wickerwhorl' }),
  wickerwhorl: line('wickerwhorl', 'Wickerwhorl', 'Bramblecoil', 2, ['Verdant','Wind'], S(66, 72, 68, 48, 62, 88), 'fast', 100, 130, ['Windweave', 'Thornhide'], [[1,'reedwhip'],[8,'quickstep'],[12,'rollrush'],[18,'wickertrap'],[24,'tailwind']], `${A}/reedroll/reedroll-stage-2.png`, { level: 32, speciesId: 'bramblecoil' }),
  bramblecoil: line('bramblecoil', 'Bramblecoil', 'Bramblecoil', 3, ['Verdant','Wind'], S(86, 104, 92, 64, 84, 118), 'fast', 55, 216, ['Windweave', 'Thornhide'], [[1,'reedwhip'],[12,'rollrush'],[18,'wickertrap'],[24,'tailwind'],[32,'bramblewheel']], `${A}/reedroll/reedroll-stage-3.png`),

  spriglet: line('spriglet', 'Spriglet', 'Canopaw', 1, ['Verdant'], S(46, 48, 50, 34, 44, 42), 'medium', 180, 60, ['Rootwake', 'Windweave'], [[1,'nudge'],[4,'leaflick'],[8,'harden'],[12,'vinebind']], `${A}/expansion/optimized/spriglet-front.png`, { level: 16, speciesId: 'rootusk' }, `${A}/expansion`),
  rootusk: line('rootusk', 'Rootusk', 'Canopaw', 2, ['Verdant'], S(68, 74, 78, 48, 64, 50), 'medium', 90, 130, ['Rootwake', 'Windweave'], [[1,'leaflick'],[8,'harden'],[12,'vinebind'],[18,'rootdraw'],[24,'verdantmend']], `${A}/expansion/optimized/rootusk-front.png`, { level: 36, speciesId: 'canopaw' }, `${A}/expansion`),
  canopaw: line('canopaw', 'Canopaw', 'Canopaw', 3, ['Verdant','Wind'], S(96, 106, 104, 70, 92, 68), 'medium', 45, 220, ['Rootwake', 'Windweave'], [[1,'leaflick'],[12,'rootdraw'],[18,'briarstorm'],[24,'verdantmend'],[36,'greencrown']], `${A}/expansion/optimized/canopaw-front.png`, undefined, `${A}/expansion`),

  sootsqueak: line('sootsqueak', 'Sootsqueak', 'Hearthare', 1, ['Ember'], S(40, 42, 36, 54, 42, 58), 'medium', 180, 61, ['Flashkindle', 'Shedskin'], [[1,'nudge'],[4,'embernip'],[8,'quickstep'],[12,'smokeshroud']], `${A}/expansion/optimized/sootsqueak-front.png`, { level: 16, speciesId: 'kilnibble' }, `${A}/expansion`),
  kilnibble: line('kilnibble', 'Kilnibble', 'Hearthare', 2, ['Ember'], S(62, 64, 52, 78, 58, 78), 'medium', 90, 132, ['Flashkindle', 'Shedskin'], [[1,'embernip'],[8,'quickstep'],[12,'smokeshroud'],[18,'cinderspit'],[24,'flarecoil']], `${A}/expansion/optimized/kilnibble-front.png`, { level: 36, speciesId: 'hearthare' }, `${A}/expansion`),
  hearthare: line('hearthare', 'Hearthare', 'Hearthare', 3, ['Ember','Wind'], S(82, 94, 68, 108, 80, 108), 'medium', 45, 224, ['Flashkindle', 'Shedskin'], [[1,'embernip'],[12,'cinderspit'],[18,'flarecoil'],[24,'cinderfall'],[36,'pyrehowl']], `${A}/expansion/optimized/hearthare-front.png`, undefined, `${A}/expansion`),

  drizzlet: line('drizzlet', 'Drizzlet', 'Rainquill', 1, ['Tide'], S(50, 30, 42, 56, 62, 40), 'slow', 180, 62, ['Clearbody', 'Tidewell'], [[1,'nudge'],[4,'bubblepop'],[8,'focus'],[12,'ebbguard']], `${A}/expansion/optimized/drizzlet-front.png`, { level: 16, speciesId: 'puddlefin' }, `${A}/expansion`),
  puddlefin: line('puddlefin', 'Puddlefin', 'Rainquill', 2, ['Tide'], S(70, 42, 60, 82, 86, 54), 'slow', 90, 134, ['Clearbody', 'Tidewell'], [[1,'bubblepop'],[8,'focus'],[12,'ebbguard'],[18,'prismsting'],[24,'undertow']], `${A}/expansion/optimized/puddlefin-front.png`, { level: 36, speciesId: 'rainquill' }, `${A}/expansion`),
  rainquill: line('rainquill', 'Rainquill', 'Rainquill', 3, ['Tide','Wind'], S(100, 58, 78, 112, 118, 78), 'slow', 45, 228, ['Clearbody', 'Tidewell'], [[1,'bubblepop'],[12,'prismsting'],[18,'undertow'],[24,'cleansingrain'],[36,'abyssalbeam']], `${A}/expansion/optimized/rainquill-front.png`, undefined, `${A}/expansion`),

  breezlet: line('breezlet', 'Breezlet', 'Galegale', 1, ['Wind'], S(42, 38, 38, 46, 50, 66), 'fast', 200, 59, ['Windweave', 'Clearbody'], [[1,'nudge'],[4,'quickstep'],[8,'sandhush'],[12,'tailwind']], `${A}/expansion/optimized/breezlet-front.png`, { level: 18, speciesId: 'whifflit' }, `${A}/expansion`),
  whifflit: line('whifflit', 'Whifflit', 'Galegale', 2, ['Wind'], S(64, 56, 54, 70, 70, 94), 'fast', 100, 130, ['Windweave', 'Clearbody'], [[1,'quickstep'],[8,'sandhush'],[12,'tailwind'],[18,'goldrush'],[24,'undertow']], `${A}/expansion/optimized/whifflit-front.png`, { level: 32, speciesId: 'galegale' }, `${A}/expansion`),
  galegale: line('galegale', 'Galegale', 'Galegale', 3, ['Wind','Tide'], S(86, 76, 72, 98, 92, 124), 'fast', 55, 218, ['Windweave', 'Clearbody'], [[1,'quickstep'],[12,'tailwind'],[18,'goldrush'],[24,'undertow'],[32,'tunnelburst']], `${A}/expansion/optimized/galegale-front.png`, undefined, `${A}/expansion`),

  tangletoad: line('tangletoad', 'Tangletoad', 'Mirebloom', 1, ['Verdant','Tide'], S(54, 48, 54, 42, 52, 34), 'slow', 200, 60, ['Tidewell', 'Thornhide'], [[1,'nudge'],[4,'bubblepop'],[8,'leaflick'],[12,'wickertrap']], `${A}/expansion/optimized/tangletoad-front.png`, { level: 18, speciesId: 'bogloom' }, `${A}/expansion`),
  bogloom: line('bogloom', 'Bogloom', 'Mirebloom', 2, ['Verdant','Tide'], S(76, 68, 72, 58, 74, 42), 'slow', 100, 132, ['Tidewell', 'Thornhide'], [[1,'bubblepop'],[8,'leaflick'],[12,'wickertrap'],[18,'vinebind'],[24,'cleansingrain']], `${A}/expansion/optimized/bogloom-front.png`, { level: 32, speciesId: 'mirebloom' }, `${A}/expansion`),
  mirebloom: line('mirebloom', 'Mirebloom', 'Mirebloom', 3, ['Verdant','Tide'], S(104, 98, 100, 78, 106, 56), 'slow', 55, 220, ['Tidewell', 'Thornhide'], [[1,'bubblepop'],[12,'vinebind'],[18,'wickertrap'],[24,'cleansingrain'],[32,'bramblewheel']], `${A}/expansion/optimized/mirebloom-front.png`, undefined, `${A}/expansion`),
};

export const ITEMS: Record<string, ItemDefinition> = {
  tonic: { id: 'tonic', name: 'Moss Tonic', category: 'recovery', price: 180, heal: 30, description: 'Restores 30 HP.' },
  superTonic: { id: 'superTonic', name: 'Bright Tonic', category: 'recovery', price: 520, heal: 80, description: 'Restores 80 HP.' },
  fullMend: { id: 'fullMend', name: 'Full Mend', category: 'recovery', price: 700, description: 'Cures all status.' },
  prismPod: { id: 'prismPod', name: 'Prism Pod', category: 'capture', price: 200, captureModifier: 1, description: 'A safe vessel for befriending wild creatures.' },
  greatPod: { id: 'greatPod', name: 'Lumen Pod', category: 'capture', price: 600, captureModifier: 1.5, description: 'A stronger capture vessel.' },
  emberCharm: { id: 'emberCharm', name: 'Ember Charm', category: 'held', price: 900, description: 'Slightly strengthens Ember moves.' },
  swiftBand: { id: 'swiftBand', name: 'Swift Band', category: 'held', price: 900, description: 'Slightly raises Speed.' },
  crestCase: { id: 'crestCase', name: 'Crest Case', category: 'key', price: 0, description: 'Holds the three Warden Crests.' },
  grottoLantern: { id: 'grottoLantern', name: 'Grotto Lantern', category: 'key', price: 0, description: 'Softens the darkness of Ashfall Grotto.' },
};

export function createCreature(speciesId: string, level: number, trainer: string, mapId: string, rng = new SeededRng()): CreatureInstance {
  const definition = SPECIES[speciesId];
  if (!definition) throw new Error(`Unknown species: ${speciesId}`);
  const randomStats = (): Stats => ({ hp: rng.int(0,31), attack: rng.int(0,31), defense: rng.int(0,31), spAttack: rng.int(0,31), spDefense: rng.int(0,31), speed: rng.int(0,31) });
  const learned = definition.learnset.filter(([learnLevel]) => learnLevel <= level).map(([, moveId]) => moveId);
  const typeFallback = definition.types[0] === 'Verdant' ? 'leaflick' : definition.types[0] === 'Ember' ? 'embernip' : definition.types[0] === 'Tide' ? 'bubblepop' : 'quickstep';
  const knownIds = [...learned, ...[typeFallback,'nudge','harden','focus','sandhush'].filter((moveId)=>!learned.includes(moveId))].slice(0,4);
  const creature: CreatureInstance = {
    uid: `${speciesId}-${Date.now().toString(36)}-${rng.int(1000,9999)}`,
    speciesId, level, experience: expForLevel(level, definition.growthCurve), nature: NATURES[rng.int(0, NATURES.length - 1)],
    ability: definition.abilities[rng.int(0, definition.abilities.length - 1)], gender: 'unknown', ivs: randomStats(), evs: { ...ZERO_STATS },
    calculatedStats: { ...ZERO_STATS }, currentHp: 1, status: null, sleepTurns: 0, friendship: definition.baseHappiness,
    moves: knownIds.map((moveId) => ({ moveId, pp: MOVES[moveId].pp, maxPp: MOVES[moveId].pp })), heldItem: null, nickname: null,
    capture: { mapId, originalTrainer: trainer, caughtAt: Date.now(), metLevel: level },
  };
  creature.calculatedStats = calculateStats(creature, definition); creature.currentHp = creature.calculatedStats.hp;
  return creature;
}

export function learnableMoveAt(speciesId: string, level: number) { return SPECIES[speciesId].learnset.find(([learnLevel]) => learnLevel === level)?.[1] ?? null; }
export function evolutionAt(speciesId: string, level: number) { const evolution = SPECIES[speciesId].evolution; return evolution && level >= evolution.level ? evolution.speciesId : null; }

export const REGIONAL_GUIDE = [
  'cragbud','mossolith','glimmoss','cinderskink','pyrograith','pyrovanth','jellume','prismedusa','abyssara','gildig','oreclaw','auradger','reedroll','wickerwhorl','bramblecoil',
  'spriglet','rootusk','canopaw','sootsqueak','kilnibble','hearthare','drizzlet','puddlefin','rainquill','breezlet','whifflit','galegale','tangletoad','bogloom','mirebloom',
];
