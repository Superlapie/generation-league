import Phaser from 'phaser';
import { configureGbaCamera } from '../display';
import { audio } from '../audio';
import { controls } from '../controls';
import { ITEMS, MOVES, REGIONAL_GUIDE, SPECIES } from '../data';
import { calculateStats } from '../rules';
import { gameStore } from '../state';
import { COLORS, hpColor, label, panel, textStyle } from '../ui';

type MenuMode = 'pause'|'shop';
type Page = 'root'|'party'|'bag'|'guide'|'card'|'options'|'shop';
const ROOT = ['PARTY','BAG','FIELD GUIDE','PLAYER CARD','SAVE','OPTIONS','CLOSE'];

export class MenuScene extends Phaser.Scene {
  private mode:MenuMode='pause';private page:Page='root';private cursor=0;private rows:string[]=[];private objects:Phaser.GameObjects.GameObject[]=[];private note='';
  constructor(){super('Menu');}
  init(data:{mode?:MenuMode}){this.mode=data.mode??'pause';this.page=this.mode==='shop'?'shop':'root';this.cursor=0;}
  create(){configureGbaCamera(this);this.cameras.main.setBackgroundColor('#172219');controls.clear();this.render();}
  update(){
    if(controls.pressed('UP')){this.cursor=(this.cursor+this.rows.length-1)%Math.max(1,this.rows.length);audio.sfx('confirm');this.render();}
    if(controls.pressed('DOWN')){this.cursor=(this.cursor+1)%Math.max(1,this.rows.length);audio.sfx('confirm');this.render();}
    if(controls.pressed('A'))this.choose();
    if(controls.pressed('B')||controls.pressed('MENU'))this.back();
  }
  private clear(){this.objects.forEach((o)=>o.destroy());this.objects=[];}
  private keep<T extends Phaser.GameObjects.GameObject>(o:T){this.objects.push(o);return o;}
  private render(){
    this.clear();this.keep(this.add.rectangle(0,0,240,160,0x172219).setOrigin(0));
    if(this.page==='root')this.renderRoot();else if(this.page==='party')this.renderParty();else if(this.page==='bag')this.renderBag();else if(this.page==='guide')this.renderGuide();else if(this.page==='card')this.renderCard();else if(this.page==='options')this.renderOptions();else this.renderShop();
  }
  private header(title:string,subtitle=''){this.keep(label(this,10,8,title,12,'#eef0cf',2));if(subtitle)this.keep(label(this,230,11,subtitle,7,'#aab78e',2)).setOrigin(1,0);}
  private list(rows:string[],x=12,y=31,width=216){
    this.rows=rows;rows.forEach((row,index)=>{const selected=index===this.cursor;const bg=this.keep(this.add.rectangle(x,y+index*16,width,14,selected?COLORS.blue:0x2a392c).setOrigin(0).setInteractive());this.keep(label(this,x+6,y+index*16+3,`${selected?'▶ ':''}${row}`,8,selected?'#ffffff':'#dfe5c5',3));bg.on('pointerdown',()=>{this.cursor=index;this.choose();});});
  }
  private renderRoot(){this.header('MENU',gameStore.save?.location.mapId.toUpperCase());this.list(ROOT,74,31,154);this.keep(label(this,9,140,this.note||'Choose an option.',7,'#9dad91',2));}
  private renderParty(){
    const save=gameStore.save!;this.header('PARTY',`${save.party.length}/6  STORAGE ${save.storage.length}/120`);
    const rows=[...save.party.map((c)=>{const s=SPECIES[c.speciesId],max=calculateStats(c,s).hp;return`${c.nickname||s.name}  Lv${c.level}  ${c.currentHp}/${max}`;}),...save.storage.slice(0,3).map((c)=>`BOX: ${c.nickname||SPECIES[c.speciesId].name} Lv${c.level}`)];
    this.list(rows,7,27,226);
    const creature=this.cursor<save.party.length?save.party[this.cursor]:save.storage[this.cursor-save.party.length];
    if(creature){const s=SPECIES[creature.speciesId];this.keep(label(this,10,118,`${s.types.join('/')} • ${creature.nature} • ${creature.ability}`,7,'#c4d0aa',2));this.keep(label(this,10,130,creature.moves.map((m)=>MOVES[m.moveId].name).join(' / '),6,'#9dad91',2));}
    this.keep(label(this,10,148,'A: make lead / move from storage   B: back',6,'#9dad91',2));
  }
  private renderBag(){
    const stacks=gameStore.save!.inventory.filter((s)=>s.count>0);this.header('BAG',`${stacks.length} KINDS`);this.list(stacks.map((s)=>`${ITEMS[s.itemId].name}  ×${s.count}`),9,28,222);
    const item=stacks[this.cursor]&&ITEMS[stacks[this.cursor].itemId];if(item)this.keep(this.add.text(11,120,item.description,textStyle(7,'#c4d0aa')).setWordWrapWidth(216));this.keep(label(this,10,148,'A: use/equip on lead   B: back',6,'#9dad91',2));
  }
  private renderGuide(){
    const save=gameStore.save!;this.header('FIELD GUIDE',`${save.guide.caught.length}/15 CAUGHT`);this.rows=REGIONAL_GUIDE;
    REGIONAL_GUIDE.forEach((id,index)=>{const y=29+(index%8)*15,x=index<8?7:122;const seen=save.guide.seen.includes(id),caught=save.guide.caught.includes(id),selected=index===this.cursor;this.keep(this.add.rectangle(x,y,111,13,selected?COLORS.blue:0x2a392c).setOrigin(0));this.keep(label(this,x+4,y+3,`${String(index+1).padStart(2,'0')} ${seen?SPECIES[id].name:'──────'} ${caught?'◆':''}`,7,selected?'#fff':'#dfe5c5',2));});
    this.keep(label(this,10,151,'◆ caught   B: back',6,'#9dad91',2));
  }
  private renderCard(){
    const s=gameStore.save!;this.header('PLAYER CARD');this.keep(panel(this,12,28,216,109,COLORS.paper,1));this.keep(this.add.sprite(43,63,`avatar-${s.player.avatar}`,0).setScale(3).setDepth(2));
    this.keep(label(this,75,38,s.player.name,12,'#182017',2));this.keep(label(this,75,57,`CRESTS  ${s.player.crests.length}/3`,8,'#59684f',2));
    this.keep(label(this,75,73,s.player.crests.length?s.player.crests.map((c)=>c.toUpperCase()).join(' • '):'NONE YET',7,'#8d623d',2));
    this.keep(label(this,22,104,`MONEY  ${s.money} LUMEN`,8,'#182017',2));this.keep(label(this,22,119,`GUIDE  ${s.guide.caught.length} CAUGHT / ${s.guide.seen.length} SEEN`,8,'#182017',2));this.rows=['BACK'];
  }
  private renderOptions(){
    const o=gameStore.save!.options;this.header('OPTIONS');this.list([`MUSIC  ${Math.round(o.musicVolume*100)}%`,`SFX  ${Math.round(o.sfxVolume*100)}%`,`MUTE  ${o.muted?'ON':'OFF'}`,`TEXT  ${o.textSpeed.toUpperCase()}`,'BACK'],28,35,184);
  }
  private renderShop(){
    const crests=gameStore.save!.player.crests.length;const ids=['tonic','prismPod',...(crests>=1?['superTonic','greatPod']:[]),...(crests>=2?['fullMend','swiftBand','emberCharm']:[])];this.header('SUPPLY SHOP',`${gameStore.save!.money} LUMEN`);this.list([...ids.map((id)=>`${ITEMS[id].name}   ${ITEMS[id].price}`),'LEAVE'],18,31,204);
    const item=ITEMS[ids[this.cursor]];if(item)this.keep(label(this,12,143,this.note||item.description,6,'#aebc97',2));this.rows=[...ids,'LEAVE'];
  }
  private choose(){
    audio.sfx('confirm');const save=gameStore.save!;
    if(this.page==='root'){
      const pick=ROOT[this.cursor];if(pick==='PARTY')this.open('party');else if(pick==='BAG')this.open('bag');else if(pick==='FIELD GUIDE')this.open('guide');else if(pick==='PLAYER CARD')this.open('card');else if(pick==='OPTIONS')this.open('options');else if(pick==='SAVE'){this.note=gameStore.manualSave()?'Game saved safely.':'Save failed.';this.render();}else this.close();return;
    }
    if(this.page==='party'){
      if(this.cursor<save.party.length&&this.cursor>0){const chosen=save.party.splice(this.cursor,1)[0];save.party.unshift(chosen);this.cursor=0;this.note=`${chosen.nickname||SPECIES[chosen.speciesId].name} is now leading.`;}
      else if(this.cursor>=save.party.length){const index=this.cursor-save.party.length;const stored=save.storage[index];if(stored){save.storage.splice(index,1);if(save.party.length<6)save.party.push(stored);else save.storage.push(save.party.splice(0,1,stored)[0]);this.cursor=0;}}
      this.render();return;
    }
    if(this.page==='bag'){
      const stack=save.inventory.filter((s)=>s.count>0)[this.cursor];if(!stack)return;const item=ITEMS[stack.itemId],lead=save.party[0];
      if(item.heal){const max=calculateStats(lead,SPECIES[lead.speciesId]).hp;if(lead.currentHp<max&&gameStore.useItem(stack.itemId)){lead.currentHp=Math.min(max,lead.currentHp+item.heal);this.note=`${lead.nickname||SPECIES[lead.speciesId].name} recovered.`;audio.sfx('heal');}}
      else if(item.category==='held'){lead.heldItem=item.id;this.note=`${lead.nickname||SPECIES[lead.speciesId].name} holds ${item.name}.`;}
      this.render();return;
    }
    if(this.page==='guide'){return;}
    if(this.page==='card'){this.back();return;}
    if(this.page==='options'){
      const o=save.options;if(this.cursor===0)gameStore.setOptions({musicVolume:(o.musicVolume+.2)%1.2});else if(this.cursor===1)gameStore.setOptions({sfxVolume:(o.sfxVolume+.2)%1.2});else if(this.cursor===2)gameStore.setOptions({muted:!o.muted});else if(this.cursor===3)gameStore.setOptions({textSpeed:o.textSpeed==='slow'?'normal':o.textSpeed==='normal'?'fast':'slow'});else{this.back();return;}audio.refreshMusic();this.render();return;
    }
    if(this.page==='shop'){
      if(this.rows[this.cursor]==='LEAVE'){this.close();return;}const id=this.rows[this.cursor],item=ITEMS[id];if(save.money<item.price){this.note='Not enough Lumen.';}else{save.money-=item.price;gameStore.addItem(id);this.note=`Bought ${item.name}.`;audio.sfx('confirm');}this.render();
    }
  }
  private open(page:Page){this.page=page;this.cursor=0;this.note='';this.render();}
  private back(){audio.sfx('cancel');if(this.page==='root'||this.page==='shop')this.close();else this.open('root');}
  private close(){this.scene.stop();this.scene.resume('Overworld');controls.clear();}
}
