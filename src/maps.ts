import type { BuildingDefinition, Direction, MapDefinition, NpcDefinition, NpcSprite, TileKind, TrainerDefinition, WarpDefinition } from './types';

type Rect = { x: number; y: number; w: number; h: number; tile: TileKind };
const npc = (id: string, x: number, y: number, name: string, dialogue: string[], sprite: NpcSprite | 'b' = 'villager', facing: Direction = 'down'): NpcDefinition => ({ id, x, y, name, dialogue, sprite: sprite === 'b' ? 'traveler' : sprite, facing });
const trainer = (id: string, x: number, y: number, name: string, dialogue: string[], party: TrainerDefinition['party'], sight = 4, boss = false, reward = 320, facing: Direction = 'down'): TrainerDefinition => ({ id, x, y, name, dialogue, sprite: boss ? 'warden' : 'trainer', facing, party, sight, flag: `defeated:${id}`, boss, reward });
const warp = (id: string, x: number, y: number, toMap: string, toX: number, toY: number, reciprocal: string): WarpDefinition => ({ id, x, y, toMap, toX, toY, reciprocal });

function tileGrid(width: number, height: number, base: TileKind, rects: Rect[] = []) {
  const tiles = Array.from({ length: height }, () => Array<TileKind>(width).fill(base));
  for (let x = 0; x < width; x += 1) { tiles[0][x] = base === 'floor' ? 'wall' : 'tree'; tiles[height - 1][x] = base === 'floor' ? 'wall' : 'tree'; }
  for (let y = 0; y < height; y += 1) { tiles[y][0] = base === 'floor' ? 'wall' : 'tree'; tiles[y][width - 1] = base === 'floor' ? 'wall' : 'tree'; }
  for (const rect of rects) for (let y = rect.y; y < rect.y + rect.h; y += 1) for (let x = rect.x; x < rect.x + rect.w; x += 1) if (tiles[y]?.[x] !== undefined) tiles[y][x] = rect.tile;
  return tiles;
}

function markWarp(tiles: TileKind[][], x: number, y: number, kind: TileKind = 'path') { if (tiles[y]?.[x] !== undefined) tiles[y][x] = kind; }
function building(id: string, x: number, y: number, width: number, label: string, interiorMap: string): BuildingDefinition { return { id, x, y, width, height: 4, label, doorX: x + Math.floor(width / 2) - 1, interiorMap }; }

function interior(id: string, name: string, exit: { mapId: string; x: number; y: number; reciprocal: string }, role: 'home' | 'heal' | 'shop' | 'lodge' | 'hall', people: NpcDefinition[] = [], boss?: TrainerDefinition): MapDefinition {
  const tiles = tileGrid(15, 10, 'floor', [
    { x: 2, y: 2, w: 4, h: 1, tile: role === 'shop' ? 'counter' : 'floor' },
    { x: 9, y: 2, w: 3, h: 2, tile: role === 'home' ? 'counter' : 'floor' },
    { x: 7, y: 9, w: 1, h: 1, tile: 'door' },
  ]);
  markWarp(tiles, 7, 9, 'door');
  return {
    id, name, kind: 'interior', width: 15, height: 10, music: role === 'hall' ? 'dream' : 'village', palette: role,
    tiles, warps: [warp(`${id}:exit`, 7, 9, exit.mapId, exit.x, exit.y, exit.reciprocal)], npcs: people,
    trainers: boss ? [boss] : [], items: [], signs: [], buildings: [],
  };
}

const mossmereTiles = tileGrid(24, 20, 'grass', [
  { x: 2, y: 9, w: 20, h: 3, tile: 'path' }, { x: 11, y: 1, w: 3, h: 18, tile: 'path' },
  { x: 8, y: 13, w: 3, h: 4, tile: 'tallGrass' }, { x: 20, y: 13, w: 3, h: 5, tile: 'water' },
]);
const mossBuildings = [
  building('moss-home', 3, 4, 5, 'Your Home', 'moss-home'), building('research-lodge', 15, 3, 6, 'Research Lodge', 'research-lodge'),
  building('moss-heal', 3, 13, 5, 'Healing House', 'moss-heal'), building('moss-home-2', 15, 13, 5, 'Fern House', 'moss-home-2'),
];
const mossWarps = [
  warp('moss:verdant', 12, 0, 'verdant-path', 2, 8, 'verdant:moss'),
  ...mossBuildings.map((b) => warp(`moss:${b.id}`, b.doorX, b.y + b.height - 2, b.interiorMap, 7, 8, `${b.id}:exit`)),
];
mossWarps.forEach((w) => markWarp(mossmereTiles, w.x, w.y, w.id.includes('verdant') ? 'path' : 'door'));

const verdantTiles = tileGrid(36, 16, 'grass', [
  { x: 1, y: 7, w: 34, h: 3, tile: 'path' }, { x: 8, y: 2, w: 8, h: 4, tile: 'tallGrass' },
  { x: 19, y: 10, w: 10, h: 4, tile: 'tallGrass' }, { x: 13, y: 12, w: 5, h: 1, tile: 'ledge' },
  { x: 24, y: 3, w: 2, h: 3, tile: 'water' },
]);
markWarp(verdantTiles, 0, 8); markWarp(verdantTiles, 35, 8, 'path');

const glimmerTiles = tileGrid(28, 24, 'tallGrass', [
  { x: 1, y: 11, w: 26, h: 2, tile: 'path' }, { x: 4, y: 3, w: 2, h: 16, tile: 'path' },
  { x: 11, y: 5, w: 12, h: 2, tile: 'path' }, { x: 18, y: 6, w: 2, h: 14, tile: 'path' },
  { x: 7, y: 15, w: 7, h: 4, tile: 'water' }, { x: 21, y: 16, w: 4, h: 3, tile: 'grass' },
]);
markWarp(glimmerTiles, 0, 12, 'path'); markWarp(glimmerTiles, 27, 12, 'path');

const reedwaterTiles = tileGrid(34, 18, 'grass', [
  { x: 1, y: 8, w: 32, h: 2, tile: 'path' }, { x: 7, y: 2, w: 3, h: 6, tile: 'path' },
  { x: 19, y: 10, w: 3, h: 6, tile: 'path' }, { x: 12, y: 2, w: 12, h: 4, tile: 'water' },
  { x: 3, y: 11, w: 10, h: 4, tile: 'tallGrass' }, { x: 25, y: 3, w: 6, h: 4, tile: 'tallGrass' },
]);
markWarp(reedwaterTiles, 0, 9); markWarp(reedwaterTiles, 33, 9);

const cinderTiles = tileGrid(24, 20, 'grass', [
  { x: 1, y: 9, w: 22, h: 3, tile: 'path' }, { x: 11, y: 1, w: 3, h: 18, tile: 'path' },
  { x: 20, y: 14, w: 3, h: 3, tile: 'rock' },
]);
const cinderBuildings = [
  building('cinder-heal', 2, 3, 4, 'Healing Lodge', 'cinder-heal'), building('cinder-shop', 7, 3, 4, 'Supply Shop', 'cinder-shop'),
  building('cinder-home', 16, 3, 5, 'Kiln House', 'cinder-home'), building('warden-hall', 4, 13, 7, 'Warden Hall', 'warden-hall'),
  building('cinder-home-2', 15, 13, 5, 'Ash House', 'cinder-home-2'),
];
const cinderWarps = [
  warp('cinder:reedwater', 0, 10, 'reedwater-crossing', 32, 9, 'reedwater:cinder'), warp('cinder:grotto', 23, 10, 'ashfall-grotto', 2, 12, 'grotto:cinder'),
  ...cinderBuildings.map((b) => warp(`cinder:${b.id}`, b.doorX, b.y + b.height - 2, b.interiorMap, 7, 8, `${b.id}:exit`)),
];
cinderWarps.forEach((w) => markWarp(cinderTiles, w.x, w.y, w.id.includes('grotto') ? 'cave' : w.id.includes('reedwater') ? 'path' : 'door'));

const grottoTiles = tileGrid(28, 24, 'rock', [
  { x: 1, y: 11, w: 26, h: 3, tile: 'path' }, { x: 6, y: 4, w: 3, h: 8, tile: 'path' },
  { x: 8, y: 4, w: 13, h: 3, tile: 'path' }, { x: 18, y: 6, w: 3, h: 13, tile: 'path' },
  { x: 4, y: 17, w: 14, h: 3, tile: 'path' }, { x: 11, y: 8, w: 4, h: 3, tile: 'water' },
]);
markWarp(grottoTiles, 0, 12, 'cave'); markWarp(grottoTiles, 27, 18, 'cave');

const emberTiles = tileGrid(34, 18, 'rock', [
  { x: 1, y: 8, w: 32, h: 3, tile: 'path' }, { x: 6, y: 3, w: 1, h: 5, tile: 'ledge' },
  { x: 14, y: 11, w: 1, h: 5, tile: 'ledge' }, { x: 22, y: 3, w: 1, h: 5, tile: 'ledge' },
  { x: 25, y: 12, w: 6, h: 3, tile: 'tallGrass' }, { x: 9, y: 3, w: 6, h: 3, tile: 'tallGrass' },
]);
markWarp(emberTiles, 0, 9, 'cave'); markWarp(emberTiles, 33, 9, 'path');

const tideTiles = tileGrid(28, 22, 'grass', [
  { x: 1, y: 10, w: 26, h: 3, tile: 'path' }, { x: 13, y: 1, w: 3, h: 20, tile: 'path' },
  { x: 8, y: 3, w: 4, h: 5, tile: 'water' }, { x: 24, y: 14, w: 3, h: 5, tile: 'water' },
]);
const tideBuildings = [
  building('tide-heal', 3, 13, 5, 'Healing Lodge', 'tide-heal'), building('tide-shop', 8, 13, 5, 'Glass Market', 'tide-shop'),
  building('tide-home', 19, 13, 5, 'Canal House', 'tide-home'), building('tide-home-2', 3, 4, 5, 'Harbor House', 'tide-home-2'),
  building('league-spire', 17, 2, 8, 'League Spire', 'league-spire'),
];
const tideWarps = [warp('tide:ember', 0, 11, 'ember-ridge', 32, 9, 'ember:tide'), ...tideBuildings.map((b) => warp(`tide:${b.id}`, b.doorX, b.y + b.height - 2, b.interiorMap, 7, 8, `${b.id}:exit`))];
tideWarps.forEach((w) => markWarp(tideTiles, w.x, w.y, w.id.includes('ember') ? 'path' : 'door'));

export const MAPS: Record<string, MapDefinition> = {
  mossmere: {
    id: 'mossmere', name: 'Mossmere Village', kind: 'town', width: 24, height: 20, music: 'village', palette: 'moss', tiles: mossmereTiles, warps: mossWarps, buildings: mossBuildings,
    npcs: [
      npc('moss-elder',10,9,'Elder Rowan',['Mossmere is small, but every great journey begins somewhere.']),
      npc('moss-child',8,12,'Pip',['Hold B while walking to run!']), npc('moss-gardener',18,9,'Talla',['Tall grass rustles when wild creatures are near.'],'b'),
      npc('moss-reader',5,18,'Mika',['The Field Guide records every creature you meet.']), npc('moss-fisher',19,18,'Orin',['Reedroll race the wind at dusk.'],'b','right'),
      npc('moss-keeper',14,16,'Sela',['Healing Houses restore your whole party for free.']),
    ], trainers: [], items: [{ id:'moss-tonic',x:20,y:5,itemId:'tonic',count:1 }], signs: [{ id:'moss-sign',x:11,y:7,text:['MOSSMERE VILLAGE','Where young roots find the road.'] }],
  },
  'verdant-path': {
    id:'verdant-path',name:'Verdant Path',kind:'route',width:36,height:16,music:'plain',palette:'verdant',tiles:verdantTiles,
    warps:[warp('verdant:moss',0,8,'mossmere',12,1,'moss:verdant'),warp('verdant:glimmer',35,8,'glimmerwood',1,12,'glimmer:verdant')],buildings:[],
    npcs:[npc('verdant-hiker',4,5,'Hiker Nao',['Ledges are one-way drops. They make quick return paths.']),npc('verdant-herbalist',29,12,'Herbalist Sol',['Wild Gildig hide where the soil sparkles.'],'b'),npc('verdant-runner',17,4,'Runner Emi',['Speed decides who moves first—unless a move has priority.'])],
    trainers:[trainer('trainer-ivy',11,8,'Scout Ivy',['Eyes forward! Let’s see how your partner moves.'],[{speciesId:'gildig',level:4}],4,false,320,'left'),trainer('trainer-bo',22,9,'Camper Bo',['My Cragbud and I trained under that old oak.'],[{speciesId:'cragbud',level:6}],3,false,320,'left'),trainer('trainer-sia',31,8,'Pathkeeper Sia',['Glimmerwood tests more than strength.'],[{speciesId:'gildig',level:7},{speciesId:'reedroll',level:6}],4,false,320,'left')],
    items:[{id:'verdant-pod',x:14,y:3,itemId:'prismPod',count:2},{id:'verdant-hidden',x:27,y:5,itemId:'tonic',count:1,hidden:true}],signs:[{id:'verdant-sign',x:3,y:7,text:['VERDANT PATH','Mossmere ←  → Glimmerwood']}],
    encounters:[{speciesId:'reedroll',minLevel:3,maxLevel:6,weight:45},{speciesId:'gildig',minLevel:3,maxLevel:6,weight:35},{speciesId:'cragbud',minLevel:4,maxLevel:6,weight:15},{speciesId:'jellume',minLevel:5,maxLevel:6,weight:5}],encounterRate:.11,
  },
  glimmerwood: {
    id:'glimmerwood',name:'Glimmerwood',kind:'dungeon',width:28,height:24,music:'swamp',palette:'glimmer',tiles:glimmerTiles,
    warps:[warp('glimmer:verdant',0,12,'verdant-path',34,8,'verdant:glimmer'),warp('glimmer:reedwater',27,12,'reedwater-crossing',1,9,'reedwater:glimmer')],buildings:[],
    npcs:[npc('glimmer-scholar',7,6,'Scholar Fen',['The glowing caps turn toward honest hearts.']),npc('glimmer-lost',23,18,'Lost Courier',['I followed three blue mushrooms and ended up here. Again.'],'b')],
    trainers:[trainer('trainer-myr',4,15,'Forager Myr',['The forest rewards patience.'],[{speciesId:'cragbud',level:8},{speciesId:'reedroll',level:8}],4,false,320,'up'),trainer('trainer-wisp',18,9,'Glimmer Wisp',['Can you keep your footing in the glow?'],[{speciesId:'jellume',level:9}],5,false,320,'down'),trainer('warden-lyra',23,12,'Warden Lyra',['A Crest is a promise: power guided by care. Show me yours.'],[{speciesId:'mossolith',level:12},{speciesId:'prismedusa',level:13}],3,true,1200,'left')],
    items:[{id:'glimmer-charm',x:22,y:17,itemId:'swiftBand',count:1},{id:'glimmer-pods',x:10,y:20,itemId:'greatPod',count:2}],signs:[{id:'glimmer-riddle',x:12,y:6,text:['When the pale caps face east,','the quiet trail opens.']}],storyGate:{flag:'crest:glimmer',x:26,y:12,message:'Lyra’s woven seal bars the eastern trail.'},
    encounters:[{speciesId:'cragbud',minLevel:7,maxLevel:10,weight:35},{speciesId:'reedroll',minLevel:7,maxLevel:10,weight:35},{speciesId:'gildig',minLevel:8,maxLevel:10,weight:20},{speciesId:'mossolith',minLevel:11,maxLevel:12,weight:3},{speciesId:'wickerwhorl',minLevel:11,maxLevel:12,weight:7}],encounterRate:.13,
  },
  'reedwater-crossing': {
    id:'reedwater-crossing',name:'Reedwater Crossing',kind:'route',width:34,height:18,music:'plain',palette:'reedwater',tiles:reedwaterTiles,
    warps:[warp('reedwater:glimmer',0,9,'glimmerwood',26,12,'glimmer:reedwater'),warp('reedwater:cinder',33,9,'cinderstep',1,10,'cinder:reedwater')],buildings:[],
    npcs:[npc('reedwater-ranger',9,5,'Ranger Vale',['The northern fork is scenic; the southern grass hides supplies.']),npc('reedwater-artist',17,14,'Artist Rue',['Water changes every color it reflects.'],'b'),npc('reedwater-merchant',27,7,'Peddler Bram',['Cinderstep’s market stocks stronger Pods after a Crest.'])],
    trainers:[trainer('trainer-tam',8,10,'Ranger Tam',['Branching roads build flexible teams.'],[{speciesId:'gildig',level:11},{speciesId:'jellume',level:10}],4,false,320,'up'),trainer('trainer-ori',25,9,'Sailor Ori',['The current taught my Jellume timing.'],[{speciesId:'prismedusa',level:13},{speciesId:'reedroll',level:12}],4,false,320,'left')],
    items:[{id:'reedwater-tonics',x:5,y:13,itemId:'superTonic',count:2},{id:'reedwater-hidden',x:30,y:4,itemId:'greatPod',count:1,hidden:true}],signs:[{id:'reedwater-sign',x:2,y:8,text:['REEDWATER CROSSING','Glimmerwood ←  → Cinderstep']}],
    encounters:[{speciesId:'jellume',minLevel:10,maxLevel:13,weight:38},{speciesId:'reedroll',minLevel:10,maxLevel:13,weight:30},{speciesId:'gildig',minLevel:11,maxLevel:14,weight:27},{speciesId:'prismedusa',minLevel:14,maxLevel:15,weight:5}],encounterRate:.11,
  },
  cinderstep: {
    id:'cinderstep',name:'Cinderstep Town',kind:'town',width:24,height:20,music:'village',palette:'cinder',tiles:cinderTiles,warps:cinderWarps,buildings:cinderBuildings,
    npcs:[npc('cinder-smith',15,10,'Smith Cor',['Ashfall ore sings when struck just right.']),npc('cinder-kid',8,10,'Nia',['Warden Kael never wastes a move!'],'b'),npc('cinder-watch',21,8,'Watchman Pell',['The Grotto is dark. A lantern helps, but courage helps more.']),npc('cinder-baker',3,18,'Baker Iona',['A warm bun after a cold cave—nothing better.'],'b'),npc('cinder-traveler',19,18,'Traveler Dex',['Tideglass sits where the ridge meets the sea.'])],trainers:[],items:[{id:'cinder-lantern',x:21,y:11,itemId:'grottoLantern',count:1}],signs:[{id:'cinder-sign',x:11,y:8,text:['CINDERSTEP TOWN','Built bright beneath the ridge.']}],storyGate:{flag:'crest:cinder',x:22,y:10,message:'The Grotto watch requires Kael’s Cinder Crest.'},
  },
  'ashfall-grotto': {
    id:'ashfall-grotto',name:'Ashfall Grotto',kind:'dungeon',width:28,height:24,music:'dream',palette:'ash',tiles:grottoTiles,dark:true,
    warps:[warp('grotto:cinder',0,12,'cinderstep',22,10,'cinder:grotto'),warp('grotto:ember',27,18,'ember-ridge',1,9,'ember:grotto')],buildings:[],
    npcs:[npc('grotto-miner',6,20,'Miner Una',['Tap the walls. Hollow echoes point toward hidden caches.'])],
    trainers:[trainer('trainer-cavo',8,6,'Delver Cavo',['Down here, sound reaches you before light.'],[{speciesId:'oreclaw',level:18},{speciesId:'cinderskink',level:17}],4,false,320,'down'),trainer('trainer-emi',19,16,'Lantern Emi',['A steady flame beats a wild blaze.'],[{speciesId:'pyrograith',level:20},{speciesId:'gildig',level:18}],3,false,320,'up')],
    items:[{id:'grotto-ember',x:13,y:9,itemId:'emberCharm',count:1},{id:'grotto-hidden',x:4,y:18,itemId:'greatPod',count:3,hidden:true}],signs:[{id:'grotto-mark',x:17,y:6,text:['MINER’S MARK','Three taps means a safe tunnel.']}],
    encounters:[{speciesId:'gildig',minLevel:16,maxLevel:20,weight:45},{speciesId:'cinderskink',minLevel:16,maxLevel:20,weight:35},{speciesId:'oreclaw',minLevel:20,maxLevel:22,weight:12},{speciesId:'pyrograith',minLevel:21,maxLevel:22,weight:8}],encounterRate:.13,
  },
  'ember-ridge': {
    id:'ember-ridge',name:'Ember Ridge',kind:'route',width:34,height:18,music:'plain',palette:'ember',tiles:emberTiles,
    warps:[warp('ember:grotto',0,9,'ashfall-grotto',26,18,'grotto:ember'),warp('ember:tide',33,9,'tideglass',1,11,'tide:ember')],buildings:[],
    npcs:[npc('ember-ranger',11,14,'Ranger Lio',['Use the ledges to loop back without crossing every trainer.']),npc('ember-sage',27,5,'Sage Marn',['A balanced party answers more questions than raw levels.'],'b')],
    trainers:[trainer('trainer-kai',10,9,'Ace Kai',['Two Crests? Then you can handle my fastest team.'],[{speciesId:'wickerwhorl',level:23},{speciesId:'pyrograith',level:23}],5,false,320,'left'),trainer('trainer-vela',25,10,'Ace Vela',['I trained for the League wind.'],[{speciesId:'prismedusa',level:24},{speciesId:'oreclaw',level:24},{speciesId:'mossolith',level:23}],4,false,320,'left')],
    items:[{id:'ember-tonics',x:11,y:4,itemId:'superTonic',count:3},{id:'ember-pods',x:29,y:13,itemId:'greatPod',count:3}],signs:[{id:'ember-sign',x:2,y:8,text:['EMBER RIDGE','Ashfall ←  → Tideglass City']}],
    encounters:[{speciesId:'cinderskink',minLevel:20,maxLevel:24,weight:30},{speciesId:'gildig',minLevel:20,maxLevel:24,weight:25},{speciesId:'reedroll',minLevel:20,maxLevel:24,weight:25},{speciesId:'pyrograith',minLevel:24,maxLevel:26,weight:10},{speciesId:'wickerwhorl',minLevel:24,maxLevel:26,weight:10}],encounterRate:.11,
  },
  tideglass: {
    id:'tideglass',name:'Tideglass City',kind:'town',width:28,height:22,music:'village',palette:'tide',tiles:tideTiles,warps:tideWarps,buildings:tideBuildings,
    npcs:[npc('tide-greeter',10,11,'Greeter Aya',['Three roads meet here: river, ridge, and dream.']),npc('tide-sailor',7,19,'Sailor Finn',['The Spire’s bell rings for every new Champion.'],'b'),npc('tide-vendor',18,18,'Vendor Tess',['Stock up before the Spire. Warden Selene changes tactics often.']),npc('tide-child',24,10,'Lumi',['I’m making my own Crest out of sea glass!'],'b'),npc('tide-historian',14,7,'Historian Odo',['The Wardens protect balance, not a throne.']),npc('tide-runner',3,9,'Courier Beck',['After the ceremony, every old road stays open.'])],trainers:[],items:[{id:'tide-fullmend',x:25,y:18,itemId:'fullMend',count:2}],signs:[{id:'tide-sign',x:13,y:9,text:['TIDEGLASS CITY','Where every journey finds its reflection.']}],
  },
};

const addInterior = (map: MapDefinition) => { MAPS[map.id] = map; };
addInterior(interior('moss-home','Your Home',{mapId:'mossmere',x:5,y:9,reciprocal:'moss:moss-home'},'home',[npc('home-parent',7,4,'Mara',['Whatever road you choose, this will always be home.'],'b')]));
addInterior(interior('research-lodge','Research Lodge',{mapId:'mossmere',x:18,y:8,reciprocal:'moss:research-lodge'},'lodge',[npc('professor',7,3,'Professor Aster',['Creatures grow through trust, experience, and change.']),npc('assistant',11,6,'Assistant Lark',['The regional guide has fifteen known forms.'],'b')]));
addInterior(interior('moss-heal','Mossmere Healing House',{mapId:'mossmere',x:5,y:18,reciprocal:'moss:moss-heal'},'heal',[npc('moss-healer',7,3,'Healer Wren',['Rest a while. I will restore your party.'],'b')]));
addInterior(interior('moss-home-2','Fern House',{mapId:'mossmere',x:17,y:18,reciprocal:'moss:moss-home-2'},'home',[npc('fern-resident',7,4,'Fern',['A starter is a partner, never a prize.'])]));
addInterior(interior('cinder-heal','Cinderstep Healing Lodge',{mapId:'cinderstep',x:4,y:8,reciprocal:'cinder:cinder-heal'},'heal',[npc('cinder-healer',7,3,'Healer Fia',['The ridge air is hard on tired travelers.'],'b')]));
addInterior(interior('cinder-shop','Cinderstep Supply Shop',{mapId:'cinderstep',x:9,y:8,reciprocal:'cinder:cinder-shop'},'shop',[npc('cinder-clerk',7,3,'Clerk Noll',['We carry tonics and capture Pods.'])]));
addInterior(interior('cinder-home','Kiln House',{mapId:'cinderstep',x:18,y:8,reciprocal:'cinder:cinder-home'},'home',[npc('kiln-resident',7,4,'Potter Ema',['Clay remembers every careful hand.'],'b')]));
addInterior(interior('warden-hall','Cinderstep Warden Hall',{mapId:'cinderstep',x:7,y:18,reciprocal:'cinder:warden-hall'},'hall',[npc('kael-aide',3,4,'Aide Tor',['Kael studies the opening turn closely.'])],trainer('warden-kael',7,3,'Warden Kael',['Fire is choice: warmth, warning, or ruin. Show me your control.'],[{speciesId:'pyrograith',level:19},{speciesId:'oreclaw',level:20},{speciesId:'mossolith',level:21}],2,true,2200)));
addInterior(interior('cinder-home-2','Ash House',{mapId:'cinderstep',x:17,y:18,reciprocal:'cinder:cinder-home-2'},'home',[npc('ash-resident',7,4,'Ash',['My Gildig found a bright stone beneath the Hall.'])]));
addInterior(interior('tide-heal','Tideglass Healing Lodge',{mapId:'tideglass',x:5,y:18,reciprocal:'tide:tide-heal'},'heal',[npc('tide-healer',7,3,'Healer Mira',['The sea teaches us to begin again.'],'b')]));
addInterior(interior('tide-shop','Glass Market',{mapId:'tideglass',x:10,y:18,reciprocal:'tide:tide-shop'},'shop',[npc('tide-clerk',7,3,'Clerk Venn',['Lumen Pods are made from stormglass.'])]));
addInterior(interior('tide-home','Canal House',{mapId:'tideglass',x:21,y:18,reciprocal:'tide:tide-home'},'home',[npc('canal-resident',7,4,'Canal Keeper Jo',['The canals shine brightest after rain.'],'b')]));
addInterior(interior('tide-home-2','Harbor House',{mapId:'tideglass',x:5,y:9,reciprocal:'tide:tide-home-2'},'home',[npc('harbor-resident',7,4,'Harbor Master Rin',['A good captain knows when to switch.'])]));
addInterior(interior('league-spire','League Spire',{mapId:'tideglass',x:21,y:7,reciprocal:'tide:league-spire'},'hall',[npc('spire-aide',3,4,'Spire Keeper',['Beyond Selene is no throne—only the road you choose next.'],'b')],trainer('warden-selene',7,3,'Warden Selene',['Three Crests are three lessons. Let your whole journey speak.'],[{speciesId:'bramblecoil',level:30},{speciesId:'auradger',level:30},{speciesId:'abyssara',level:31},{speciesId:'pyrovanth',level:32},{speciesId:'glimmoss',level:33}],2,true,5000)));

export function validateWorld(maps = MAPS) {
  const errors: string[] = [];
  for (const map of Object.values(maps)) {
    if (map.tiles.length !== map.height || map.tiles.some((row) => row.length !== map.width)) errors.push(`${map.id}: tile dimensions do not match`);
    for (const entry of map.warps) {
      const destination = maps[entry.toMap];
      if (!destination) { errors.push(`${map.id}/${entry.id}: missing destination ${entry.toMap}`); continue; }
      const reciprocal = destination.warps.find((candidate) => candidate.id === entry.reciprocal);
      if (!reciprocal) errors.push(`${map.id}/${entry.id}: missing reciprocal ${entry.reciprocal}`);
      else if (reciprocal.toMap !== map.id || reciprocal.reciprocal !== entry.id) errors.push(`${map.id}/${entry.id}: reciprocal points elsewhere`);
    }
    for (const building of map.buildings) {
      if (!maps[building.interiorMap]) errors.push(`${map.id}/${building.id}: missing interior`);
      for(let y=building.y;y<building.y+building.height;y+=1)for(let x=building.x;x<building.x+building.width;x+=1)if(map.tiles[y]?.[x]!=='grass'&&!(x===building.doorX&&y===building.y+building.height-2&&map.tiles[y]?.[x]==='door'))errors.push(`${map.id}/${building.id}: building overlaps ${map.tiles[y]?.[x]??'void'} at ${x},${y}`);
      if([...map.npcs,...map.trainers].some((person)=>person.x>=building.x&&person.x<building.x+building.width&&person.y>=building.y&&person.y<building.y+building.height))errors.push(`${map.id}/${building.id}: character placed inside building footprint`);
    }
  }
  return errors;
}
