export type ElementType = 'Verdant' | 'Ember' | 'Tide' | 'Wind' | 'Neutral';
export type MoveCategory = 'Physical' | 'Special' | 'Status';
export type StatName = 'hp' | 'attack' | 'defense' | 'spAttack' | 'spDefense' | 'speed';
export type BattleStat = Exclude<StatName, 'hp'> | 'accuracy' | 'evasion';
export type MajorStatus = 'burn' | 'poison' | 'paralysis' | 'sleep' | null;
export type GrowthCurve = 'fast' | 'medium' | 'slow';

export interface Stats {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

export interface EvolutionRule { level: number; speciesId: string }

export interface SpeciesDefinition {
  id: string;
  name: string;
  line: string;
  stage: 1 | 2 | 3;
  types: [ElementType, ElementType?];
  baseStats: Stats;
  growthCurve: GrowthCurve;
  captureRate: number;
  baseExp: number;
  evYield: Partial<Stats>;
  abilities: string[];
  learnset: Array<[number, string]>;
  evolution?: EvolutionRule;
  spriteKey: string;
  spriteUrl: string;
}

export type MoveEffect =
  | 'damage' | 'burn' | 'poison' | 'paralyze' | 'sleep'
  | 'heal' | 'drain' | 'recoil' | 'raise' | 'lower'
  | 'multiHit' | 'weather' | 'protect' | 'priority' | 'cleanse';

export interface MoveDefinition {
  id: string;
  name: string;
  type: ElementType;
  power: number;
  accuracy: number;
  pp: number;
  priority: number;
  target: 'self' | 'foe';
  category: MoveCategory;
  effect: MoveEffect;
  effectChance?: number;
  effectStatus?: Exclude<MajorStatus, null>;
  stat?: BattleStat;
  stages?: number;
  minHits?: number;
  maxHits?: number;
  ratio?: number;
  field?: 'sunshower' | 'tailwind' | 'monsoon' | 'cinderfall';
  animation: string;
  audioCue: string;
  description: string;
}

export interface KnownMove { moveId: string; pp: number }

export interface CaptureMetadata { mapId: string; originalTrainer: string; caughtAt: number }

export interface CreatureInstance {
  uid: string;
  speciesId: string;
  level: number;
  experience: number;
  nature: string;
  ability: string;
  ivs: Stats;
  evs: Stats;
  currentHp: number;
  status: MajorStatus;
  sleepTurns: number;
  moves: KnownMove[];
  heldItem: string | null;
  nickname: string | null;
  capture: CaptureMetadata;
}

export interface StatStages {
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
  accuracy: number;
  evasion: number;
}

export interface BattleSide {
  party: CreatureInstance[];
  active: number;
  stages: StatStages;
  protected: boolean;
}

export type BattleAction =
  | { kind: 'move'; moveIndex: number }
  | { kind: 'switch'; partyIndex: number }
  | { kind: 'item'; itemId: string; targetIndex?: number }
  | { kind: 'capture'; itemId: string }
  | { kind: 'flee' };

export interface BattleContext {
  player: BattleSide;
  enemy: BattleSide;
  kind: 'wild' | 'trainer';
  field: { effect: MoveDefinition['field'] | null; turns: number };
  turn: number;
  ended: boolean;
  winner: 'player' | 'enemy' | 'fled' | 'captured' | null;
}

export interface BattleEvent {
  kind: 'text' | 'move' | 'damage' | 'heal' | 'status' | 'stage' | 'miss' | 'faint' | 'switch' | 'capture' | 'field' | 'end';
  side?: 'player' | 'enemy';
  text: string;
  amount?: number;
  moveId?: string;
  effectiveness?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  category: 'recovery' | 'capture' | 'battle' | 'held' | 'key';
  price: number;
  description: string;
  heal?: number;
  captureModifier?: number;
}

export interface InventoryStack { itemId: string; count: number }

export interface WarpDefinition { id: string; x: number; y: number; toMap: string; toX: number; toY: number; reciprocal: string }
export type NpcSprite = 'villager' | 'traveler' | 'trainer' | 'warden';
export interface NpcDefinition { id: string; x: number; y: number; name: string; dialogue: string[]; sprite: NpcSprite; facing: Direction }
export interface TrainerDefinition extends NpcDefinition { party: Array<{ speciesId: string; level: number }>; sight: number; flag: string; boss?: boolean; reward: number }
export interface ItemPickup { id: string; x: number; y: number; itemId: string; count: number; hidden?: boolean }
export interface SignDefinition { id: string; x: number; y: number; text: string[] }
export interface EncounterEntry { speciesId: string; minLevel: number; maxLevel: number; weight: number }
export type Direction = 'up' | 'down' | 'left' | 'right';
export type TileKind = 'grass' | 'path' | 'water' | 'wall' | 'tree' | 'tallGrass' | 'floor' | 'door' | 'cave' | 'ledge' | 'counter' | 'rock';

export interface BuildingDefinition { id: string; x: number; y: number; width: number; height: number; label: string; doorX: number; interiorMap: string }
export interface MapDefinition {
  id: string;
  name: string;
  kind: 'town' | 'route' | 'dungeon' | 'interior';
  width: number;
  height: number;
  music: string;
  palette: string;
  tiles: TileKind[][];
  warps: WarpDefinition[];
  npcs: NpcDefinition[];
  trainers: TrainerDefinition[];
  items: ItemPickup[];
  signs: SignDefinition[];
  buildings: BuildingDefinition[];
  encounters?: EncounterEntry[];
  encounterRate?: number;
  dark?: boolean;
  storyGate?: { flag: string; x: number; y: number; message: string };
}

export interface GameOptions { musicVolume: number; sfxVolume: number; muted: boolean; textSpeed: 'slow' | 'normal' | 'fast' }
export interface GameSaveV1 {
  schemaVersion: 1;
  savedAt: number;
  player: { name: string; avatar: 'a' | 'b'; crests: string[] };
  location: { mapId: string; x: number; y: number; facing: Direction };
  party: CreatureInstance[];
  storage: CreatureInstance[];
  inventory: InventoryStack[];
  money: number;
  guide: { seen: string[]; caught: string[] };
  storyFlags: string[];
  defeatedTrainers: string[];
  collectedItems: string[];
  options: GameOptions;
  playTimeSeconds: number;
  startedAt: number;
  pendingEvolution?: string | null;
}

export interface NewGameChoices { name: string; avatar: 'a' | 'b'; starter: string }
