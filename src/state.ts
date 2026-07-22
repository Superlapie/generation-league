import { createCreature, ITEMS, MOVES, SPECIES, evolutionAt, learnableMoveAt } from './data';
import { calculateStats, clamp, expForLevel, expReward, sanitizeEvs, SeededRng, ZERO_STATS } from './rules';
import type { CreatureInstance, GameOptions, GameSaveV1, InventoryStack, NewGameChoices, Stats } from './types';

const MANUAL = 'generation-league:manual:v1';
const MANUAL_BACKUP = 'generation-league:manual:backup:v1';
const RECOVERY = ['generation-league:recovery:0:v1', 'generation-league:recovery:1:v1', 'generation-league:recovery:2:v1'];
const OPTIONS = 'generation-league:options:v1';

interface SaveEnvelope { checksum: string; payload: GameSaveV1 }
const defaultOptions: GameOptions = { musicVolume: 0.42, sfxVolume: 0.65, muted: false, textSpeed: 'normal', battleScene: true, battleStyle: 'shift', sound: 'stereo', buttonMode: 'normal', frame: 1 };

function hash(text: string) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) { value ^= text.charCodeAt(i); value = Math.imul(value, 16777619); }
  return (value >>> 0).toString(16).padStart(8, '0');
}

function envelope(save: GameSaveV1): string {
  const raw = JSON.stringify(save);
  return JSON.stringify({ checksum: hash(raw), payload: save } satisfies SaveEnvelope);
}

export function decodeSave(raw: string | null): GameSaveV1 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SaveEnvelope;
    if (!parsed?.payload || parsed.payload.schemaVersion !== 1) return null;
    if (hash(JSON.stringify(parsed.payload)) !== parsed.checksum) return null;
    if (parsed.payload.party.length > 6 || parsed.payload.storage.length > 120) return null;
    const party = parsed.payload.party.map((creature, index) => migrateCreature(creature, `party-${index}`));
    const storage = parsed.payload.storage.map((creature, index) => migrateCreature(creature, `storage-${index}`));
    if (!party.length) return null;
    return { ...parsed.payload, migrationVersion: 2, options: normalizeOptions(parsed.payload.options), party, storage };
  } catch { return null; }
}

function migrateCreature(input: CreatureInstance, fallbackId: string): CreatureInstance {
  const raw = input as unknown as Partial<CreatureInstance>;
  const species = SPECIES[raw.speciesId ?? ''];
  if (!species) throw new Error(`Unknown species in save: ${raw.speciesId ?? 'missing'}`);
  const level = clamp(Math.floor(raw.level ?? 1), 1, 100);
  const ivs = { ...ZERO_STATS, ...(raw.ivs ?? {}) } as Stats;
  (Object.keys(ivs) as Array<keyof Stats>).forEach((stat) => { ivs[stat] = clamp(Math.floor(ivs[stat] ?? 0), 0, 31); });
  const evs = sanitizeEvs({ ...ZERO_STATS, ...(raw.evs ?? {}) } as Stats);
  const moves = (raw.moves ?? []).filter((move) => Boolean(MOVES[move.moveId])).slice(0, 4).map((move) => {
    const maxPp = Math.max(1, move.maxPp ?? MOVES[move.moveId].pp);
    return { moveId: move.moveId, pp: clamp(Math.floor(move.pp ?? maxPp), 0, maxPp), maxPp };
  });
  const creature = {
    ...raw,
    uid: raw.uid ?? `${raw.speciesId}-${fallbackId}`,
    speciesId: raw.speciesId,
    level,
    experience: Math.max(0, Math.floor(raw.experience ?? expForLevel(level, species.growthCurve))),
    nature: raw.nature && raw.nature.length > 0 ? raw.nature : 'Hardy',
    ability: raw.ability && species.abilities.includes(raw.ability) ? raw.ability : species.abilities[0],
    gender: raw.gender ?? 'unknown', ivs, evs, calculatedStats: ZERO_STATS,
    currentHp: 1, status: raw.status ?? null, sleepTurns: Math.max(0, Math.floor(raw.sleepTurns ?? 0)),
    friendship: clamp(Math.floor(raw.friendship ?? species.baseHappiness), 0, 255), moves,
    heldItem: raw.heldItem && ITEMS[raw.heldItem] ? raw.heldItem : null, nickname: raw.nickname ?? null,
    capture: { mapId: raw.capture?.mapId ?? 'unknown', originalTrainer: raw.capture?.originalTrainer ?? 'Unknown', caughtAt: raw.capture?.caughtAt ?? 0, metLevel: raw.capture?.metLevel ?? level },
  } as CreatureInstance;
  creature.calculatedStats = calculateStats(creature, species);
  creature.currentHp = clamp(Math.floor(raw.currentHp ?? creature.calculatedStats.hp), 0, creature.calculatedStats.hp);
  return creature;
}

function normalizeOptions(input: Partial<GameOptions> | null | undefined): GameOptions {
  const raw = input ?? {};
  return {
    ...defaultOptions,
    ...raw,
    musicVolume: clamp(Number(raw.musicVolume ?? defaultOptions.musicVolume), 0, 1),
    sfxVolume: clamp(Number(raw.sfxVolume ?? defaultOptions.sfxVolume), 0, 1),
    textSpeed: raw.textSpeed === 'slow' || raw.textSpeed === 'fast' ? raw.textSpeed : 'normal',
    battleScene: raw.battleScene !== false,
    battleStyle: raw.battleStyle === 'set' ? 'set' : 'shift',
    sound: raw.sound === 'mono' ? 'mono' : 'stereo',
    buttonMode: raw.buttonMode === 'lr' || raw.buttonMode === 'lEqualsA' ? raw.buttonMode : 'normal',
    frame: clamp(Math.floor(Number(raw.frame ?? 1)), 1, 20),
  };
}

function loadOptions(): GameOptions {
  try { return normalizeOptions(JSON.parse(localStorage.getItem(OPTIONS) || '{}')); } catch { return { ...defaultOptions }; }
}

function starterInventory(): InventoryStack[] {
  return [{ itemId:'tonic',count:4 },{ itemId:'prismPod',count:6 },{ itemId:'crestCase',count:1 }];
}

export class GameStore {
  save: GameSaveV1 | null = null;
  private recoveryIndex = 0;
  rng = new SeededRng();

  hasSave() { return Boolean(this.bestSave(true)); }
  bestSave(includeRecovery = true) {
    const candidates = [decodeSave(localStorage.getItem(MANUAL)), decodeSave(localStorage.getItem(MANUAL_BACKUP))];
    if (includeRecovery) candidates.push(...RECOVERY.map((key) => decodeSave(localStorage.getItem(key))));
    return candidates.filter((entry): entry is GameSaveV1 => Boolean(entry)).sort((a,b) => b.savedAt - a.savedAt)[0] ?? null;
  }
  continueGame() { const found = this.bestSave(true); if (!found) return false; this.save = structuredClone(found); return true; }
  newGame(choices: NewGameChoices) {
    const starter = createCreature(choices.starter, 5, choices.name, 'research-lodge', this.rng);
    this.save = {
      schemaVersion: 1, migrationVersion: 2, savedAt: Date.now(), player: { name: choices.name.slice(0, 10) || 'Aster', avatar: choices.avatar, crests: [] },
      location: { mapId: 'research-lodge', x: 7, y: 6, facing: 'up' }, party: [starter], storage: [], inventory: starterInventory(), money: 1200,
      guide: { seen: [choices.starter], caught: [choices.starter] }, storyFlags: ['starterChosen','tutorialReady'], defeatedTrainers: [], collectedItems: [],
      options: loadOptions(), playTimeSeconds: 0, startedAt: Date.now(), pendingEvolution: null,
    };
    this.autoSave();
  }
  manualSave() {
    if (!this.save) return false;
    const current = localStorage.getItem(MANUAL);
    if (decodeSave(current)) localStorage.setItem(MANUAL_BACKUP, current!);
    this.save.savedAt = Date.now();
    const serialized = envelope(this.save);
    localStorage.setItem(`${MANUAL}:pending`, serialized);
    if (!decodeSave(localStorage.getItem(`${MANUAL}:pending`))) return false;
    localStorage.setItem(MANUAL, serialized);
    localStorage.removeItem(`${MANUAL}:pending`);
    return Boolean(decodeSave(localStorage.getItem(MANUAL)));
  }
  autoSave() {
    if (!this.save) return;
    this.save.savedAt = Date.now();
    localStorage.setItem(RECOVERY[this.recoveryIndex], envelope(this.save));
    this.recoveryIndex = (this.recoveryIndex + 1) % RECOVERY.length;
  }
  setOptions(next: Partial<GameOptions>) {
    if (!this.save) return;
    this.save.options = normalizeOptions({ ...this.save.options, ...next });
    localStorage.setItem(OPTIONS, JSON.stringify(this.save.options));
  }
  flag(flag: string) { return this.save?.storyFlags.includes(flag) ?? false; }
  addFlag(flag: string) { if (this.save && !this.flag(flag)) this.save.storyFlags.push(flag); }
  defeat(flag: string) { if (this.save && !this.save.defeatedTrainers.includes(flag)) this.save.defeatedTrainers.push(flag); }
  hasDefeated(flag: string) { return this.save?.defeatedTrainers.includes(flag) ?? false; }
  countItem(itemId: string) { return this.save?.inventory.find((stack) => stack.itemId === itemId)?.count ?? 0; }
  addItem(itemId: string, count = 1) {
    if (!this.save || !ITEMS[itemId]) return;
    const stack = this.save.inventory.find((entry) => entry.itemId === itemId);
    if (stack) stack.count += count; else this.save.inventory.push({ itemId, count });
  }
  useItem(itemId: string, count = 1) {
    const stack = this.save?.inventory.find((entry) => entry.itemId === itemId);
    if (!stack || stack.count < count) return false;
    stack.count -= count;
    if (stack.count === 0) this.save!.inventory = this.save!.inventory.filter((entry) => entry !== stack);
    return true;
  }
  collect(id: string) { if (this.save && !this.save.collectedItems.includes(id)) this.save.collectedItems.push(id); }
  hasCollected(id: string) { return this.save?.collectedItems.includes(id) ?? false; }
  see(speciesId: string) { if (this.save && !this.save.guide.seen.includes(speciesId)) this.save.guide.seen.push(speciesId); }
  addCreature(creature: CreatureInstance) {
    if (!this.save) return 'none';
    this.see(creature.speciesId);
    if (!this.save.guide.caught.includes(creature.speciesId)) this.save.guide.caught.push(creature.speciesId);
    if (this.save.party.length < 6) { this.save.party.push(creature); return 'party'; }
    if (this.save.storage.length < 120) { this.save.storage.push(creature); return 'storage'; }
    return 'full';
  }
  healAll() {
    this.save?.party.forEach((creature) => {
      creature.currentHp = calculateStats(creature, SPECIES[creature.speciesId]).hp; creature.status = null; creature.sleepTurns = 0;
      creature.moves.forEach((move) => { move.pp = MOVES[move.moveId].pp; });
    });
  }
  setLocation(mapId: string, x: number, y: number) { if (this.save) this.save.location = { ...this.save.location, mapId, x, y }; }
  awardCrest(id: string) { if (this.save && !this.save.player.crests.includes(id)) { this.save.player.crests.push(id); this.addFlag(`crest:${id}`); } }
  awardExperience(creature: CreatureInstance, defeatedSpeciesId: string, defeatedLevel: number, participants = 1, trainerBattle = false) {
    const defeated = SPECIES[defeatedSpeciesId];
    const amount = expReward(defeated, defeatedLevel, participants, trainerBattle);
    creature.experience += amount;
    const messages = [`${creature.nickname || SPECIES[creature.speciesId].name} gained ${amount} EXP!`];
    while (creature.level < 100 && creature.experience >= expForLevel(creature.level + 1, SPECIES[creature.speciesId].growthCurve)) {
      const oldMax = calculateStats(creature, SPECIES[creature.speciesId]).hp;
      creature.level += 1;
      const newMax = calculateStats(creature, SPECIES[creature.speciesId]).hp;
      creature.currentHp += newMax - oldMax;
      messages.push(`${creature.nickname || SPECIES[creature.speciesId].name} grew to Lv.${creature.level}!`);
      const moveId = learnableMoveAt(creature.speciesId, creature.level);
      if (moveId) {
          if (creature.moves.length < 4) { creature.moves.push({ moveId, pp: MOVES[moveId].pp, maxPp: MOVES[moveId].pp }); messages.push(`It learned ${MOVES[moveId].name}!`); }
          else { creature.moves.shift(); creature.moves.push({ moveId, pp: MOVES[moveId].pp, maxPp: MOVES[moveId].pp }); messages.push(`It replaced its oldest move with ${MOVES[moveId].name}!`); }
      }
      const next = evolutionAt(creature.speciesId, creature.level);
      if (next) { const oldName = SPECIES[creature.speciesId].name; creature.speciesId = next; this.see(next); if (!this.save!.guide.caught.includes(next)) this.save!.guide.caught.push(next); messages.push(`${oldName} evolved into ${SPECIES[next].name}!`); }
    }
    creature.calculatedStats = calculateStats(creature, SPECIES[creature.speciesId]);
    return messages;
  }
}

export const gameStore = new GameStore();
