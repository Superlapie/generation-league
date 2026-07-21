import { beforeEach, describe, expect, it } from 'vitest';
import { GameStore } from './state';

class MemoryStorage implements Storage {
  private values=new Map<string,string>();
  get length(){return this.values.size;}
  clear(){this.values.clear();}
  getItem(key:string){return this.values.get(key)??null;}
  key(index:number){return [...this.values.keys()][index]??null;}
  removeItem(key:string){this.values.delete(key);}
  setItem(key:string,value:string){this.values.set(key,String(value));}
}

describe('versioned save recovery',()=>{
  beforeEach(()=>{Object.defineProperty(globalThis,'localStorage',{value:new MemoryStorage(),configurable:true});});
  it('continues from a validated rotating recovery snapshot',()=>{
    const first=new GameStore();first.newGame({name:'ACE',avatar:'a',starter:'cragbud'});expect(first.hasSave()).toBe(true);
    const second=new GameStore();expect(second.continueGame()).toBe(true);expect(second.save?.player.name).toBe('ACE');expect(second.save?.schemaVersion).toBe(1);
  });
  it('keeps the previous valid manual save when the primary is corrupted',()=>{
    const store=new GameStore();store.newGame({name:'MIRA',avatar:'b',starter:'jellume'});expect(store.manualSave()).toBe(true);
    store.save!.money=999;expect(store.manualSave()).toBe(true);localStorage.setItem('generation-league:manual:v1','{corrupted');
    const restored=new GameStore();expect(restored.continueGame()).toBe(true);expect(restored.save?.player.name).toBe('MIRA');
  });
});
