import Phaser from 'phaser';
import { audio } from '../audio';
import { controls } from '../controls';
import { ITEMS, MOVES, REGIONAL_GUIDE, SPECIES } from '../data';
import { configureGbaCamera } from '../display';
import { calculateStats } from '../rules';
import { gameStore } from '../state';
import type { CreatureInstance, ItemDefinition } from '../types';
import { COLORS, hpColor, label, panel, textStyle } from '../ui';

type MenuMode = 'pause'|'shop';
type Page = 'root'|'party'|'bag'|'guide'|'card'|'options'|'shop';
type Pocket = ItemDefinition['category'];

const ROOT = ['PARTY','BAG','FIELD GUIDE','PLAYER CARD','SAVE','OPTIONS','CLOSE'];
const POCKETS: Array<{id:Pocket;label:string}> = [
  {id:'recovery',label:'MED'}, {id:'capture',label:'PODS'}, {id:'battle',label:'BATTLE'}, {id:'held',label:'HELD'}, {id:'key',label:'KEY'},
];
const TYPE_COLORS:Record<string,number>={Verdant:0x5d9b52,Ember:0xc65b3e,Tide:0x4b8fa6,Wind:0x8ca7a1,Neutral:0x8b8375};

export class MenuScene extends Phaser.Scene {
  private mode:MenuMode='pause';
  private page:Page='root';
  private cursor=0;
  private rows:string[]=[];
  private objects:Phaser.GameObjects.GameObject[]=[];
  private note='';
  private pocket=0;
  private storage=false;
  constructor(){super('Menu');}
  init(data:{mode?:MenuMode}){this.mode=data.mode??'pause';this.page=this.mode==='shop'?'shop':'root';this.cursor=0;this.pocket=0;this.storage=false;}
  create(){configureGbaCamera(this);this.cameras.main.setBackgroundColor('#172219');controls.clear();this.render();}
  update(){
    if(controls.pressed('UP'))this.move(-1);
    if(controls.pressed('DOWN'))this.move(1);
    if(controls.pressed('LEFT'))this.horizontal(-1);
    if(controls.pressed('RIGHT'))this.horizontal(1);
    if(controls.pressed('A'))this.choose();
    if(controls.pressed('B')||controls.pressed('MENU'))this.back();
  }
  private move(amount:number){if(!this.rows.length)return;this.cursor=(this.cursor+amount+this.rows.length)%this.rows.length;audio.sfx('confirm');this.render();}
  private horizontal(amount:number){
    if(this.page==='bag'){this.pocket=(this.pocket+amount+POCKETS.length)%POCKETS.length;this.cursor=0;audio.sfx('confirm');this.render();return;}
    if(this.page==='party'&&gameStore.save!.storage.length){this.storage=!this.storage;this.cursor=0;audio.sfx('confirm');this.render();return;}
    if(this.page==='guide'){this.cursor=Phaser.Math.Clamp(this.cursor+amount*8,0,REGIONAL_GUIDE.length-1);audio.sfx('confirm');this.render();return;}
    if(this.page==='options'){this.adjustOption(amount);}
  }
  private clear(){this.objects.forEach((o)=>o.destroy());this.objects=[];}
  private keep<T extends Phaser.GameObjects.GameObject>(object:T){this.objects.push(object);return object;}
  private render(){
    this.clear();
    const bg=this.keep(this.add.graphics());
    bg.fillGradientStyle(0x203f42,0x203f42,0x102124,0x102124,1).fillRect(0,0,240,160);
    for(let y=0;y<160;y+=8)bg.fillStyle(0xffffff,.018).fillRect(0,y,240,1);
    if(this.page==='root')this.renderRoot();else if(this.page==='party')this.renderParty();else if(this.page==='bag')this.renderBag();else if(this.page==='guide')this.renderGuide();else if(this.page==='card')this.renderCard();else if(this.page==='options')this.renderOptions();else this.renderShop();
  }
  private header(title:string,subtitle=''){
    const bar=this.keep(this.add.graphics().setDepth(1));bar.fillStyle(0xf1f1d0,1).fillRect(0,0,240,21);bar.fillStyle(0x6d8f82,1).fillRect(0,18,240,3);bar.fillStyle(0xb9ca68,1).fillRect(0,18,72,3);
    this.keep(label(this,8,5,title,11,'#182c2c',2));if(subtitle)this.keep(label(this,232,7,subtitle,7,'#52665c',2)).setOrigin(1,0);
  }
  private box(x:number,y:number,width:number,height:number,fill=COLORS.paper){return this.keep(panel(this,x,y,width,height,fill,1));}
  private list(rows:string[],x:number,y:number,width:number,rowHeight=16){
    this.rows=rows;
    rows.forEach((row,index)=>{
      const selected=index===this.cursor;
      const bg=this.keep(this.add.rectangle(x,y+index*rowHeight,width,rowHeight-2,selected?0x5b8f94:0x2c4543).setOrigin(0).setDepth(2).setInteractive());
      if(selected)this.keep(this.add.rectangle(x,y+index*rowHeight,3,rowHeight-2,0xd8d968).setOrigin(0).setDepth(3));
      this.keep(label(this,x+7,y+index*rowHeight+3,`${selected?'> ':''}${row}`,8,selected?'#ffffff':'#dbe5cf',4));
      bg.on('pointerdown',()=>{this.cursor=index;this.choose();});
    });
  }
  private renderRoot(){
    const save=gameStore.save!;this.header('FIELD MENU',save.location.mapId.replaceAll('-',' ').toUpperCase());
    this.box(7,27,61,106,0xdce7ca);this.keep(this.add.sprite(37,53,`avatar-${save.player.avatar}`,0).setScale(2.8).setDepth(3));
    this.keep(label(this,12,75,save.player.name.toUpperCase(),9,'#20342f',3));
    this.keep(label(this,12,90,`CRESTS ${save.player.crests.length}/3`,7,'#59684f',3));
    this.keep(label(this,12,103,`${save.money} L`,7,'#59684f',3));
    this.keep(label(this,12,116,`${save.guide.caught.length}/15 CAUGHT`,7,'#59684f',3));
    this.list(ROOT,76,27,157,15);
    this.box(7,137,226,18,0xe8edcf);this.keep(label(this,13,143,this.note||'Choose a command.',7,'#30433a',3));
  }
  private renderParty(){
    const save=gameStore.save!;const source=this.storage?save.storage:save.party;this.rows=source.map((creature)=>creature.uid);
    this.header('CREATURES',this.storage?`STORAGE ${save.storage.length}/120`:`PARTY ${save.party.length}/6`);
    this.keep(label(this,8,23,this.storage?'[ BOX ]   PARTY':'[ PARTY ]   BOX',6,'#d7e4c8',2));
    if(!source.length){this.box(8,39,224,91);this.keep(label(this,120,76,'NO CREATURES STORED',8,'#52665c',3)).setOrigin(.5);return;}
    const start=Math.floor(this.cursor/6)*6;source.slice(start,start+6).forEach((creature,index)=>this.partySlot(creature,start+index,index));
    const selected=source[this.cursor];if(selected)this.partyFooter(selected);
  }
  private partySlot(creature:CreatureInstance,absolute:number,visible:number){
    const species=SPECIES[creature.speciesId],stats=calculateStats(creature,species),col=visible%2,row=Math.floor(visible/2),x=6+col*116,y=34+row*31,selected=absolute===this.cursor;
    const g=this.keep(this.add.graphics().setDepth(1));g.fillStyle(selected?0xeaf0ce:0xcbd8bd,1).fillRoundedRect(x,y,112,28,4);g.lineStyle(selected?2:1,selected?0xd5b64d:0x52665c,1).strokeRoundedRect(x,y,112,28,4);
    this.keep(this.add.image(x+15,y+14,`${species.id}-front`).setDisplaySize(25,25).setDepth(2));
    this.keep(label(this,x+31,y+4,creature.nickname||species.name,7,'#1b2d28',3));this.keep(label(this,x+91,y+4,`Lv${creature.level}`,6,'#52665c',3));
    const ratio=creature.currentHp/stats.hp;this.keep(label(this,x+32,y+16,creature.status?creature.status.slice(0,3).toUpperCase():'HP',6,creature.status?'#9f4034':'#52665c',3));
    const hp=this.keep(this.add.graphics().setDepth(3));hp.fillStyle(0x34443c,1).fillRect(x+49,y+17,54,5);hp.fillStyle(hpColor(ratio),1).fillRect(x+50,y+18,Math.max(0,52*ratio),3);
  }
  private partyFooter(creature:CreatureInstance){
    const species=SPECIES[creature.speciesId];this.box(6,130,228,26,0xe8edcf);
    this.keep(label(this,11,135,`${species.types.join('/')}  ${creature.nature}  ${creature.ability}`,6,'#30433a',3));
    this.keep(label(this,11,145,creature.moves.map((move)=>`${MOVES[move.moveId].name} ${move.pp}`).join('  '),6,'#52665c',3));
  }
  private bagStacks(){const pocket=POCKETS[this.pocket].id;return gameStore.save!.inventory.filter((stack)=>stack.count>0&&ITEMS[stack.itemId].category===pocket);}
  private renderBag(){
    const stacks=this.bagStacks();this.rows=stacks.map((stack)=>stack.itemId);this.header('BAG',`${gameStore.save!.money} LUMEN`);
    POCKETS.forEach((entry,index)=>{const selected=index===this.pocket,x=5+index*46;this.keep(this.add.rectangle(x,24,43,13,selected?0xd7c45c:0x31514e).setOrigin(0).setDepth(2));this.keep(label(this,x+4,27,entry.label,6,selected?'#24342d':'#d6e0cc',3));});
    this.box(5,40,113,98,0xe6ead0);this.box(121,40,114,98,0xd7e2cb);
    if(!stacks.length){this.keep(label(this,61,80,'POCKET EMPTY',7,'#59684f',3)).setOrigin(.5);}
    stacks.slice(0,7).forEach((stack,index)=>{const selected=index===this.cursor,y=46+index*12;if(selected)this.keep(this.add.rectangle(9,y-1,105,11,0x6b9693).setOrigin(0).setDepth(2));this.keep(label(this,13,y,`${selected?'> ':''}${ITEMS[stack.itemId].name}`,7,selected?'#fff':'#263a32',3));this.keep(label(this,109,y,`x${stack.count}`,6,selected?'#fff':'#59684f',3)).setOrigin(1,0);});
    const item=stacks[this.cursor]&&ITEMS[stacks[this.cursor].itemId];if(item)this.itemDetails(item);
    this.keep(label(this,8,144,'LEFT/RIGHT: POCKET   A: USE   B: BACK',6,'#c9d8bd',2));
  }
  private itemDetails(item:ItemDefinition){
    const tint=TYPE_COLORS[item.category==='capture'?'Tide':item.category==='held'?'Wind':'Neutral'];
    this.keep(this.add.circle(178,65,14,tint).setDepth(2));this.keep(label(this,178,59,item.category==='capture'?'P':item.category==='key'?'K':'I',10,'#fff',3)).setOrigin(.5,0);
    this.keep(label(this,128,84,item.name.toUpperCase(),7,'#253830',3));
    this.keep(this.add.text(128,98,item.description,textStyle(7,'#52665c')).setDepth(3).setWordWrapWidth(98));
    this.keep(label(this,128,124,item.price?`VALUE ${item.price} L`:'KEY ITEM',6,'#7b6843',3));
  }
  private renderGuide(){
    const save=gameStore.save!;this.rows=REGIONAL_GUIDE;this.header('FIELD GUIDE',`${save.guide.seen.length} SEEN  ${save.guide.caught.length} CAUGHT`);
    this.box(5,25,106,129,0xe4e9cf);this.box(114,25,121,129,0xd8e3ce);
    const start=Math.min(Math.max(0,this.cursor-3),REGIONAL_GUIDE.length-8);
    REGIONAL_GUIDE.slice(start,start+8).forEach((id,index)=>{const absolute=start+index,y=30+index*14,selected=absolute===this.cursor,seen=save.guide.seen.includes(id),caught=save.guide.caught.includes(id);if(selected)this.keep(this.add.rectangle(9,y-1,98,13,0x638f91).setOrigin(0).setDepth(2));this.keep(label(this,12,y,`${selected?'> ':''}${String(absolute+1).padStart(3,'0')} ${seen?SPECIES[id].name:'----------'}`,7,selected?'#fff':'#263a32',3));if(caught)this.keep(this.add.circle(102,y+4,2,0xd2af42).setDepth(3));});
    const id=REGIONAL_GUIDE[this.cursor],species=SPECIES[id],seen=save.guide.seen.includes(id),caught=save.guide.caught.includes(id);
    const art=this.keep(this.add.image(175,64,`${id}-front`).setDisplaySize(70,70).setDepth(2));if(!seen)art.setTint(0x172219);
    this.keep(label(this,120,30,`No. ${String(this.cursor+1).padStart(3,'0')}`,7,'#52665c',3));
    this.keep(label(this,120,92,seen?species.name.toUpperCase():'UNKNOWN',9,'#20342f',3));
    if(seen){species.types.forEach((type,index)=>{if(!type)return;this.keep(this.add.rectangle(122+index*50,107,46,11,TYPE_COLORS[type]).setOrigin(0).setDepth(2));this.keep(label(this,145+index*50,109,type.toUpperCase(),6,'#fff',3)).setOrigin(.5,0);});this.keep(label(this,120,123,`LINE  ${species.line}`,6,'#52665c',3));this.keep(label(this,120,134,`STAGE ${species.stage}/3  ${caught?'CAPTURED':'SEEN'}`,6,caught?'#8b6b25':'#52665c',3));}
    this.keep(label(this,120,145,'LEFT/RIGHT: PAGE',6,'#52665c',3));
  }
  private renderCard(){
    const save=gameStore.save!;this.header('PLAYER CARD','GENERATION LEAGUE');
    const card=this.keep(this.add.graphics().setDepth(1));card.fillStyle(0xd8dfb8,1).fillRoundedRect(12,28,216,112,7);card.lineStyle(3,0x6f805e,1).strokeRoundedRect(12,28,216,112,7);card.fillStyle(0x789a79,1).fillRect(15,31,210,19);card.fillStyle(0xe9edcf,1).fillRoundedRect(20,57,55,66,4);
    this.keep(this.add.sprite(47,83,`avatar-${save.player.avatar}`,0).setScale(3.2).setDepth(2));
    this.keep(label(this,84,35,save.player.name.toUpperCase(),11,'#f7f8df',3));this.keep(label(this,84,58,`ID  ${String(save.startedAt).slice(-6)}`,7,'#283a32',3));
    this.keep(label(this,84,72,`MONEY   ${save.money} L`,7,'#283a32',3));this.keep(label(this,84,86,`GUIDE   ${save.guide.caught.length} / 15`,7,'#283a32',3));this.keep(label(this,84,100,`CRESTS  ${save.player.crests.length} / 3`,7,'#283a32',3));
    ['glimmer','cinder','tide'].forEach((crest,index)=>{const owned=save.player.crests.includes(crest);this.keep(this.add.circle(99+index*31,124,8,owned?[0x73a96b,0xc76a43,0x5a9eb0][index]:0x9ca58e).setDepth(2));this.keep(label(this,99+index*31,120,owned?'*':'-',7,'#fff',3)).setOrigin(.5,0);});
    this.rows=['BACK'];this.keep(label(this,18,147,'A / B: RETURN',6,'#c9d8bd',2));
  }
  private renderOptions(){
    const options=gameStore.save!.options;this.header('OPTIONS','LEFT/RIGHT TO CHANGE');this.rows=['MUSIC','SFX','MUTE','TEXT','BACK'];
    const values=[`${Math.round(options.musicVolume*100)}%`,`${Math.round(options.sfxVolume*100)}%`,options.muted?'ON':'OFF',options.textSpeed.toUpperCase(),''];
    this.box(21,31,198,112,0xe4e9cf);
    this.rows.forEach((row,index)=>{const selected=index===this.cursor,y=39+index*19;if(selected)this.keep(this.add.rectangle(27,y-3,186,17,0x638f91).setOrigin(0).setDepth(2));this.keep(label(this,34,y,`${selected?'> ':''}${row}`,8,selected?'#fff':'#263a32',3));if(index<2){const amount=index===0?options.musicVolume:options.sfxVolume;const meter=this.keep(this.add.graphics().setDepth(3));meter.fillStyle(0x52665c,1).fillRect(124,y+2,67,6);meter.fillStyle(0xd4bf52,1).fillRect(125,y+3,65*amount,4);}else this.keep(label(this,195,y,values[index],7,selected?'#fff':'#52665c',3)).setOrigin(1,0);});
  }
  private renderShop(){
    const save=gameStore.save!,crests=save.player.crests.length,ids=['tonic','prismPod',...(crests>=1?['superTonic','greatPod']:[]),...(crests>=2?['fullMend','swiftBand','emberCharm']:[])];this.rows=[...ids,'LEAVE'];this.header('SUPPLY SHOP',`${save.money} LUMEN`);
    this.box(6,27,133,113,0xe4e9cf);this.box(142,27,92,113,0xd8e3ce);
    this.rows.forEach((id,index)=>{const selected=index===this.cursor,y=34+index*14;if(selected)this.keep(this.add.rectangle(10,y-2,125,13,0x638f91).setOrigin(0).setDepth(2));const item=ITEMS[id];this.keep(label(this,14,y,`${selected?'> ':''}${item?.name??'LEAVE'}`,7,selected?'#fff':'#263a32',3));if(item)this.keep(label(this,131,y,`${item.price}`,6,selected?'#fff':'#52665c',3)).setOrigin(1,0);});
    const item=ITEMS[ids[this.cursor]];if(item){this.keep(label(this,149,35,item.name.toUpperCase(),7,'#283a32',3));this.keep(this.add.text(149,52,item.description,textStyle(7,'#52665c')).setDepth(3).setWordWrapWidth(77));this.keep(label(this,149,112,this.note||`OWNED ${save.inventory.find((s)=>s.itemId===item.id)?.count??0}`,6,'#7b6843',3));}
  }
  private choose(){
    audio.sfx('confirm');const save=gameStore.save!;
    if(this.page==='root'){const pick=ROOT[this.cursor];if(pick==='PARTY')this.open('party');else if(pick==='BAG')this.open('bag');else if(pick==='FIELD GUIDE')this.open('guide');else if(pick==='PLAYER CARD')this.open('card');else if(pick==='OPTIONS')this.open('options');else if(pick==='SAVE'){this.note=gameStore.manualSave()?'Game saved safely.':'Save failed.';this.render();}else this.close();return;}
    if(this.page==='party'){
      const source=this.storage?save.storage:save.party,creature=source[this.cursor];if(!creature)return;
      if(this.storage){save.storage.splice(this.cursor,1);if(save.party.length<6)save.party.push(creature);else save.storage.push(save.party.splice(0,1,creature)[0]);this.cursor=0;}
      else if(this.cursor>0){save.party.splice(this.cursor,1);save.party.unshift(creature);this.cursor=0;this.note=`${creature.nickname||SPECIES[creature.speciesId].name} is now leading.`;}
      this.render();return;
    }
    if(this.page==='bag'){
      const stack=this.bagStacks()[this.cursor];if(!stack)return;const item=ITEMS[stack.itemId],lead=save.party[0];
      if(item.heal){const max=calculateStats(lead,SPECIES[lead.speciesId]).hp;if(lead.currentHp<max&&gameStore.useItem(stack.itemId)){lead.currentHp=Math.min(max,lead.currentHp+item.heal);this.note=`${lead.nickname||SPECIES[lead.speciesId].name} recovered.`;audio.sfx('heal');}}
      else if(item.category==='held'){lead.heldItem=item.id;this.note=`${lead.nickname||SPECIES[lead.speciesId].name} holds ${item.name}.`;}
      this.render();return;
    }
    if(this.page==='guide')return;
    if(this.page==='card'){this.back();return;}
    if(this.page==='options'){if(this.cursor===4)this.back();else this.adjustOption(1);return;}
    if(this.page==='shop'){
      if(this.rows[this.cursor]==='LEAVE'){this.close();return;}const id=this.rows[this.cursor],item=ITEMS[id];if(save.money<item.price)this.note='Not enough Lumen.';else{save.money-=item.price;gameStore.addItem(id);this.note=`Bought ${item.name}.`;audio.sfx('confirm');}this.render();
    }
  }
  private adjustOption(amount:number){
    const options=gameStore.save!.options;if(this.cursor===0)gameStore.setOptions({musicVolume:Phaser.Math.Clamp(options.musicVolume+amount*.1,0,1)});else if(this.cursor===1)gameStore.setOptions({sfxVolume:Phaser.Math.Clamp(options.sfxVolume+amount*.1,0,1)});else if(this.cursor===2)gameStore.setOptions({muted:!options.muted});else if(this.cursor===3){const speeds=['slow','normal','fast'] as const,index=speeds.indexOf(options.textSpeed);gameStore.setOptions({textSpeed:speeds[(index+amount+speeds.length)%speeds.length]});}else return;audio.sfx('confirm');audio.refreshMusic();this.render();
  }
  private open(page:Page){this.page=page;this.cursor=0;this.note='';this.render();}
  private back(){audio.sfx('cancel');if(this.page==='root'||this.page==='shop')this.close();else this.open('root');}
  private close(){this.scene.stop();this.scene.resume('Overworld');controls.clear();}
}
