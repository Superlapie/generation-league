import { createCreature, ITEMS, MOVES, SPECIES, evolutionAt, learnableMoveAt } from './data';
import { calculateStats, expForLevel, expReward, SeededRng } from './rules';
import type { CreatureInstance, GameOptions, GameSaveV1, InventoryStack, NewGameChoices } from './types';

const MANUAL = 'generation-league:manual:v1';
const MANUAL_BACKUP = 'generation-league:manual:backup:v1';
const RECOVERY = ['generation-league:recovery:0:v1', 'generation-league:recovery:1:v1', 'generation-league:recovery:2:v1'];
const OPTIONS = 'generation-league:options:v1';

interface SaveEnvelope { checksum: string; payload: GameSaveV1 }
const defaultOptions: GameOptions = { musicVolume: 0.42, sfxVolume: 0.65, muted: false, textSpeed: 'normal' };

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
    if (!SPECIES[parsed.payload.party[0]?.speciesId] || parsed.payload.party.length > 6 || parsed.payload.storage.length > 120) return null;
    return parsed.payload;
  } catch { return null; }
}

function loadOptions(): GameOptions {
  try { return { ...defaultOptions, ...JSON.parse(localStorage.getItem(OPTIONS) || '{}') }; } catch { return { ...defaultOptions }; }
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
      schemaVersion: 1, savedAt: Date.now(), player: { name: choices.name.slice(0, 10) || 'Aster', avatar: choices.avatar, crests: [] },
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
    this.save.options = { ...this.save.options, ...next };
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
  awardExperience(creature: CreatureInstance, defeatedSpeciesId: string, defeatedLevel: number, trainerBattle: boolean) {
    const defeated = SPECIES[defeatedSpeciesId];
    const amount = expReward(defeated, defeatedLevel, 1, trainerBattle);
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
        if (creature.moves.length < 4) { creature.moves.push({ moveId, pp: MOVES[moveId].pp }); messages.push(`It learned ${MOVES[moveId].name}!`); }
        else { creature.moves.shift(); creature.moves.push({ moveId, pp: MOVES[moveId].pp }); messages.push(`It replaced its oldest move with ${MOVES[moveId].name}!`); }
      }
      const next = evolutionAt(creature.speciesId, creature.level);
      if (next) { const oldName = SPECIES[creature.speciesId].name; creature.speciesId = next; this.see(next); if (!this.save!.guide.caught.includes(next)) this.save!.guide.caught.push(next); messages.push(`${oldName} evolved into ${SPECIES[next].name}!`); }
    }
    return messages;
  }
}

export const gameStore = new GameStore();
