import { describe, expect, it } from 'vitest';
import { createCreature, evolutionAt, ITEMS, MOVES, REGIONAL_GUIDE, SPECIES } from './data';
import { MAPS, validateWorld } from './maps';
import { BASE_STAGES, calculateStats, captureChance, chooseTrainerAction, damageRoll, expForLevel, resolveTurn, sanitizeEvs, SeededRng, typeEffectiveness } from './rules';
import type { Rng } from './rules';
import type { BattleContext } from './types';

const fixedRng = (value:number):Rng => ({next:()=>value,int:(min)=>min});
const contextFor = (playerId='cragbud',enemyId='jellume'):BattleContext => ({
  player:{party:[createCreature(playerId,20,'Test','test',new SeededRng(1))],active:0,stages:{...BASE_STAGES},protected:false},
  enemy:{party:[createCreature(enemyId,20,'Test','test',new SeededRng(2))],active:0,stages:{...BASE_STAGES},protected:false},
  kind:'wild',field:{effect:null,turns:0},turn:0,ended:false,winner:null,
});

describe('campaign data',()=>{
  it('defines the original fifteen-species guide plus the fifteen-species expansion and valid references',()=>{
    expect(REGIONAL_GUIDE).toHaveLength(30);expect(new Set(REGIONAL_GUIDE).size).toBe(30);
    for(const species of Object.values(SPECIES)){
      expect(species.learnset.length).toBeGreaterThanOrEqual(4);
      species.learnset.forEach(([,moveId])=>expect(MOVES[moveId],`${species.id}/${moveId}`).toBeTruthy());
      if(species.evolution)expect(SPECIES[species.evolution.speciesId]).toBeTruthy();
    }
    expect(Object.keys(MOVES).length).toBeGreaterThanOrEqual(30);
    expect(Object.values(ITEMS).some((item)=>item.category==='capture')).toBe(true);
  });
  it('contains the complete connected campaign with reciprocal exits',()=>{
    expect(validateWorld()).toEqual([]);
    const outdoor=Object.values(MAPS).filter((map)=>map.kind!=='interior');
    expect(outdoor.filter((map)=>map.kind==='town')).toHaveLength(3);
    expect(outdoor.filter((map)=>map.kind==='route')).toHaveLength(3);
    expect(outdoor.filter((map)=>map.kind==='dungeon')).toHaveLength(2);
    expect(Object.values(MAPS).flatMap((map)=>map.trainers)).toHaveLength(14);
    expect(outdoor.flatMap((map)=>map.npcs).length).toBeGreaterThanOrEqual(28);
    expect(Object.values(MAPS).flatMap((map)=>map.buildings).every((building)=>MAPS[building.interiorMap]?.kind==='interior')).toBe(true);
    for(const map of outdoor)for(const building of map.buildings){
      const entrance=map.warps.find((entry)=>entry.toMap===building.interiorMap);
      expect(entrance).toMatchObject({x:building.doorX,y:building.y+building.height-2});
      expect(map.tiles[building.y+building.height-2][building.doorX]).toBe('door');
    }
  });
});

describe('generation-style progression rules',()=>{
  it('enforces 31 IV, 255 per-stat EV, and 510 total EV limits',()=>{
    const creature=createCreature('cragbud',50,'Test','test',new SeededRng(3));creature.ivs.hp=99;creature.evs={hp:255,attack:255,defense:255,spAttack:255,spDefense:255,speed:255};
    const evs=sanitizeEvs(creature.evs);expect(Math.max(...Object.values(evs))).toBeLessThanOrEqual(255);expect(Object.values(evs).reduce((a,b)=>a+b,0)).toBe(510);
    expect(calculateStats(creature,SPECIES.cragbud).hp).toBeGreaterThan(100);
  });
  it('uses nature profiles, growth curves, and exact evolution thresholds',()=>{
    const neutral=createCreature('cinderskink',20,'Test','test',new SeededRng(4));neutral.nature='Hardy';
    const boosted=structuredClone(neutral);boosted.nature='Mighty';
    expect(calculateStats(boosted,SPECIES.cinderskink).spAttack).toBeGreaterThan(calculateStats(neutral,SPECIES.cinderskink).spAttack);
    expect(expForLevel(20,'fast')).toBeLessThan(expForLevel(20,'slow'));
    expect(evolutionAt('cragbud',15)).toBeNull();expect(evolutionAt('cragbud',16)).toBe('mossolith');expect(evolutionAt('gildig',18)).toBe('oreclaw');
  });
  it('applies the original type chart and stable damage ranges',()=>{
    expect(typeEffectiveness('Verdant',SPECIES.jellume)).toBe(2);expect(typeEffectiveness('Ember',SPECIES.cragbud)).toBe(2);expect(typeEffectiveness('Tide',SPECIES.cinderskink)).toBe(2);
    const a=createCreature('cinderskink',25,'A','test',new SeededRng(5)),d=createCreature('cragbud',25,'B','test',new SeededRng(6));
    const low=damageRoll(a,d,MOVES.cinderspit,SPECIES.cinderskink,SPECIES.cragbud,{...BASE_STAGES},{...BASE_STAGES},fixedRng(.1));
    const high=damageRoll(a,d,MOVES.cinderspit,SPECIES.cinderskink,SPECIES.cragbud,{...BASE_STAGES},{...BASE_STAGES},fixedRng(.99));
    expect(low.effectiveness).toBe(2);expect(high.damage).toBeGreaterThan(low.damage);
  });
  it('resolves priority, PP, damage, status and end-of-turn timing through one engine',()=>{
    const battle=contextFor('cragbud','jellume');battle.player.party[0].moves=[{moveId:'quickstep',pp:5,maxPp:5}];battle.enemy.party[0].moves=[{moveId:'prismsting',pp:5,maxPp:5}];
    const events=resolveTurn(battle,{kind:'move',moveIndex:0},{kind:'move',moveIndex:0},SPECIES,MOVES,fixedRng(.01));
    expect(events.find((event)=>event.kind==='move')?.side).toBe('player');expect(battle.player.party[0].moves[0].pp).toBe(4);expect(battle.enemy.party[0].currentHp).toBeLessThan(calculateStats(battle.enemy.party[0],SPECIES.jellume).hp);
  });
  it('replaces a fainted player creature without granting the enemy another attack',()=>{
    const battle=contextFor('cragbud','jellume'),replacement=createCreature('cinderskink',20,'Test','test',new SeededRng(8));battle.player.party.push(replacement);battle.player.party[0].currentHp=0;battle.enemy.party[0].moves=[{moveId:'prismsting',pp:5,maxPp:5}];battle.field={effect:'monsoon',turns:3};
    const hp=replacement.currentHp,events=resolveTurn(battle,{kind:'switch',partyIndex:1},{kind:'move',moveIndex:0},SPECIES,MOVES,fixedRng(.01));
    expect(events.map((event)=>event.kind)).toEqual(['switch']);expect(battle.player.active).toBe(1);expect(replacement.currentHp).toBe(hp);expect(battle.enemy.party[0].moves[0].pp).toBe(5);expect(battle.turn).toBe(0);expect(battle.field.turns).toBe(3);
  });
  it('supports healing, recoil, drain, multi-hit, stat stages and field effects',()=>{
    const effects=['heal','recoil','drain','multiHit','raise','lower','weather'];
    effects.forEach((effect)=>expect(Object.values(MOVES).some((move)=>move.effect===effect),effect).toBe(true));
    const battle=contextFor();battle.player.party[0].moves=[{moveId:'tailwind',pp:2,maxPp:2}];resolveTurn(battle,{kind:'move',moveIndex:0},{kind:'switch',partyIndex:0},SPECIES,MOVES,fixedRng(.2));expect(battle.field.effect).toBe('tailwind');expect(battle.field.turns).toBe(4);
  });
  it('uses HP, status, capture rate and item modifier for capture probability',()=>{
    const creature=createCreature('gildig',8,'Wild','route',new SeededRng(7)),max=calculateStats(creature,SPECIES.gildig).hp;creature.currentHp=1;creature.status='sleep';
    expect(captureChance(creature,SPECIES.gildig,max,1.5,fixedRng(.01))).toBe(true);expect(captureChance(creature,SPECIES.gildig,max,1,fixedRng(.99))).toBe(false);
  });
  it('trainer AI evaluates available damage and does not choose exhausted moves',()=>{
    const battle=contextFor('cragbud','cinderskink');battle.enemy.party[0].moves=[{moveId:'embernip',pp:0,maxPp:25},{moveId:'cinderspit',pp:10,maxPp:20},{moveId:'smokeshroud',pp:10,maxPp:20}];
    const action=chooseTrainerAction(battle,SPECIES,MOVES,fixedRng(.5));expect(action.kind).toBe('move');if(action.kind==='move')expect(action.moveIndex).not.toBe(0);
  });
});
