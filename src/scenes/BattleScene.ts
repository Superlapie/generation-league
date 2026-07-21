import Phaser from 'phaser';
import { configureGbaCamera } from '../display';
import { audio } from '../audio';
import { controls } from '../controls';
import { createCreature, ITEMS, MOVES, SPECIES } from '../data';
import { BASE_STAGES, calculateStats, captureChance, chooseTrainerAction, resolveTurn } from '../rules';
import { gameStore } from '../state';
import type { BattleAction, BattleContext, BattleEvent, CreatureInstance, TrainerDefinition } from '../types';
import { COLORS, hpColor, label, panel, textStyle } from '../ui';

type BattleMode='command'|'moves'|'party'|'bag'|'locked';
interface BattleInit { kind:'wild'|'trainer'; wild?:CreatureInstance; trainer?:TrainerDefinition; mapId:string }

export class BattleScene extends Phaser.Scene {
  private initData!:BattleInit;private context!:BattleContext;private trainer?:TrainerDefinition;private mode:BattleMode='locked';private cursor=0;
  private playerSprite!:Phaser.GameObjects.Image;private enemySprite!:Phaser.GameObjects.Image;private uiObjects:Phaser.GameObjects.GameObject[]=[];
  private dialogue!:Phaser.GameObjects.Text;private playerHp!:Phaser.GameObjects.Rectangle;private enemyHp!:Phaser.GameObjects.Rectangle;private playerNameText!:Phaser.GameObjects.Text;private enemyNameText!:Phaser.GameObjects.Text;private locked=true;private rewarded=new Set<string>();
  constructor(){super('Battle');}
  init(data:BattleInit){this.initData=data;this.trainer=data.trainer;}
  create(){
    configureGbaCamera(this);
    this.locked=true;this.mode='locked';this.cursor=0;this.rewarded.clear();this.uiObjects=[];
    if(!gameStore.save){this.scene.start('Title');return;}
    const enemyParty=this.initData.kind==='wild'?[this.initData.wild!]:this.trainer!.party.map((entry)=>createCreature(entry.speciesId,entry.level,this.trainer!.name,this.initData.mapId,gameStore.rng));
    this.context={player:{party:gameStore.save.party,active:Math.max(0,gameStore.save.party.findIndex((c)=>c.currentHp>0)),stages:{...BASE_STAGES},protected:false},enemy:{party:enemyParty,active:0,stages:{...BASE_STAGES},protected:false},kind:this.initData.kind,field:{effect:null,turns:0},turn:0,ended:false,winner:null};
    document.body.dataset.gameScene='battle';document.body.dataset.battleMode='locked';document.body.dataset.battleLocked='true';
    enemyParty.forEach((c)=>gameStore.see(c.speciesId));
    this.renderArena();this.renderCombatants();this.renderStatus();this.renderDialogue();controls.clear();
    audio.playMusic(this,this.trainer?.boss?'dream':'plain');
    const opening=this.initData.kind==='wild'?`A wild ${this.enemySpecies().name} appeared!`:`${this.trainer!.name} challenges you!`;
    this.showText(opening);this.cameras.main.flash(220,238,242,207);this.time.delayedCall(650,()=>{this.locked=false;this.openCommand();});
  }
  update(){
    if(this.locked||this.mode==='locked')return;
    const count=this.mode==='command'?4:this.mode==='moves'?4:this.mode==='party'?this.context.player.party.length:this.availableBag().length;
    if(controls.pressed('LEFT')){this.cursor=(this.cursor+count-1)%count;audio.sfx('confirm');this.renderMenu();}
    if(controls.pressed('RIGHT')){this.cursor=(this.cursor+1)%count;audio.sfx('confirm');this.renderMenu();}
    if(controls.pressed('UP')){this.cursor=(this.cursor+(this.mode==='command'||this.mode==='moves'?2:count-1))%count;audio.sfx('confirm');this.renderMenu();}
    if(controls.pressed('DOWN')){this.cursor=(this.cursor+(this.mode==='command'||this.mode==='moves'?2:1))%count;audio.sfx('confirm');this.renderMenu();}
    if(controls.pressed('B')){if(this.mode!=='command'){audio.sfx('cancel');this.openCommand();}}
    if(controls.pressed('A'))this.choose();
  }
  private player(){return this.context.player.party[this.context.player.active];}private enemy(){return this.context.enemy.party[this.context.enemy.active];}
  private playerSpecies(){return SPECIES[this.player().speciesId];}private enemySpecies(){return SPECIES[this.enemy().speciesId];}
  private renderArena(){
    const g=this.add.graphics();g.fillGradientStyle(0x9fd1be,0x9fd1be,0xe7edbd,0xe7edbd,1).fillRect(0,0,240,111);g.fillStyle(0xf1efd2).fillRect(0,111,240,49);
    for(let y=4;y<108;y+=5)g.fillStyle(0xffffff,.08).fillRect(0,y,240,1);
    g.fillStyle(0x7fb987,.36).fillEllipse(180,68,90,20);g.fillStyle(0x709c67,.45).fillEllipse(64,118,122,28);
    g.fillStyle(0x4c5849).fillRect(0,110,240,2);
  }
  private renderCombatants(){
    this.enemySprite=this.add.image(181,49,`${this.enemy().speciesId}-front`).setDisplaySize(68,68).setOrigin(.5,.6).setFlipX(false).setDepth(4);
    this.playerSprite=this.add.image(62,104,`${this.player().speciesId}-back`).setDisplaySize(84,84).setOrigin(.5,.72).setFlipX(false).setDepth(5);
    this.enemySprite.setData('home',{x:181,y:49});this.playerSprite.setData('home',{x:62,y:104});
    this.tweens.add({targets:this.enemySprite,y:'-=2',duration:920,yoyo:true,repeat:-1,ease:'Sine.InOut'});
    this.tweens.add({targets:this.playerSprite,y:'+=2',duration:1040,yoyo:true,repeat:-1,ease:'Sine.InOut'});
  }
  private renderStatus(){
    panel(this,7,7,111,33,COLORS.paper,8);panel(this,127,77,106,34,COLORS.paper,8);
    this.enemyNameText=label(this,14,12,`${this.enemySpecies().name.toUpperCase()}  Lv${this.enemy().level}`,8,'#182017',9);this.playerNameText=label(this,134,82,`${(this.player().nickname||this.playerSpecies().name).toUpperCase()}  Lv${this.player().level}`,8,'#182017',9);
    label(this,17,27,'HP',6,'#aa4b35',9);label(this,137,97,'HP',6,'#aa4b35',9);
    this.add.rectangle(35,28,76,5,0x263226).setOrigin(0).setDepth(9);this.add.rectangle(155,98,69,5,0x263226).setOrigin(0).setDepth(9);
    this.enemyHp=this.add.rectangle(36,29,74,3,0x5ca85c).setOrigin(0).setDepth(10);this.playerHp=this.add.rectangle(156,99,67,3,0x5ca85c).setOrigin(0).setDepth(10);
    this.updateHpBars();
  }
  private renderDialogue(){panel(this,3,113,234,44,COLORS.paper,15);this.dialogue=this.add.text(11,121,'',textStyle(8,'#182017')).setDepth(16).setWordWrapWidth(214);}
  private showText(value:string){this.dialogue.setText(value);}
  private clearMenu(){this.uiObjects.forEach((object)=>object.destroy());this.uiObjects=[];}
  private openCommand(){this.mode='command';this.cursor=0;this.showText('What will you do?');this.renderMenu();}
  private renderMenu(){
    document.body.dataset.battleMode=this.mode;document.body.dataset.battleLocked=String(this.locked);
    this.clearMenu();if(this.mode==='locked'||this.mode==='command'&&this.locked)return;
    if(this.mode==='command'){this.drawGrid(['FIGHT','BAG','PARTY',this.context.kind==='wild'?'RUN':'FORFEIT']);return;}
    if(this.mode==='moves'){
      const known=this.player().moves;const names=Array.from({length:4},(_,i)=>known[i]?MOVES[known[i].moveId].name:'—');this.drawGrid(names);
      const selected=known[this.cursor];if(selected){const move=MOVES[selected.moveId];const info=label(this,133,147,`PP ${selected.pp}/${move.pp}  ${move.type.toUpperCase()}`,6,'#59684f',30);this.uiObjects.push(info);}return;
    }
    if(this.mode==='party'){
      this.context.player.party.forEach((creature,index)=>{const species=SPECIES[creature.speciesId],max=calculateStats(creature,species).hp;this.drawRow(index,`${creature.nickname||species.name} Lv${creature.level}  ${creature.currentHp}/${max}`,index===this.context.player.active?'ACTIVE':'');});return;
    }
    this.availableBag().forEach((entry,index)=>this.drawRow(index,`${ITEMS[entry.itemId].name} ×${entry.count}`,ITEMS[entry.itemId].category.toUpperCase()));
  }
  private drawGrid(values:string[]){values.forEach((value,index)=>{const x=9+(index%2)*110,y=118+Math.floor(index/2)*17;const selected=index===this.cursor;const bg=this.add.rectangle(x,y,106,15,selected?COLORS.blue:0xe5e6c7).setOrigin(0).setDepth(20).setInteractive();const text=label(this,x+5,y+4,`${selected?'▶ ':''}${value.toUpperCase()}`,7,selected?'#fff':'#182017',21);bg.on('pointerdown',()=>{this.cursor=index;this.choose();});this.uiObjects.push(bg,text);});}
  private drawRow(index:number,value:string,note:string){const x=8,y=116+index*7.2;const selected=index===this.cursor;const bg=this.add.rectangle(x,y,224,7,selected?COLORS.blue:0xe5e6c7).setOrigin(0).setDepth(20).setInteractive();const text=label(this,x+4,y+1,`${selected?'▶ ':''}${value}`,5,selected?'#fff':'#182017',21);const extra=label(this,228,y+1,note,5,selected?'#fff':'#59684f',21).setOrigin(1,0);bg.on('pointerdown',()=>{this.cursor=index;this.choose();});this.uiObjects.push(bg,text,extra);}
  private availableBag(){return gameStore.save!.inventory.filter((s)=>s.count>0&&(ITEMS[s.itemId].category==='recovery'||ITEMS[s.itemId].category==='capture'));}
  private choose(){
    audio.unlock();audio.sfx('confirm');
    if(this.mode==='command'){
      if(this.cursor===0){this.mode='moves';this.cursor=0;this.showText('Choose a move.');this.renderMenu();}
      else if(this.cursor===1){this.mode='bag';this.cursor=0;this.showText('Choose an item.');this.renderMenu();}
      else if(this.cursor===2){this.mode='party';this.cursor=0;this.showText('Choose a party member.');this.renderMenu();}
      else if(this.context.kind==='wild')void this.perform({kind:'flee'});else this.showText('You cannot flee from a Warden or trainer!');return;
    }
    if(this.mode==='moves'){const known=this.player().moves[this.cursor];if(!known||known.pp<=0){this.showText('That move has no PP left.');return;}void this.perform({kind:'move',moveIndex:this.cursor});return;}
    if(this.mode==='party'){const target=this.context.player.party[this.cursor];if(!target||target.currentHp<=0||this.cursor===this.context.player.active){this.showText('That creature cannot switch in.');return;}void this.perform({kind:'switch',partyIndex:this.cursor});return;}
    if(this.mode==='bag'){
      const stack=this.availableBag()[this.cursor],item=stack&&ITEMS[stack.itemId];if(!item)return;
      if(item.category==='capture'){if(this.context.kind!=='wild'){this.showText('Capture Pods only work in wild battles.');return;}void this.capture(stack.itemId);}
      else void this.useItem(stack.itemId);
    }
  }
  private async capture(itemId:string){
    this.locked=true;this.mode='locked';this.clearMenu();gameStore.useItem(itemId);const item=ITEMS[itemId],enemy=this.enemy(),species=this.enemySpecies(),max=calculateStats(enemy,species).hp;
    this.showText(`You threw a ${item.name}!`);audio.sfx('capture');await this.captureAnimation();
    if(captureChance(enemy,species,max,item.captureModifier??1,gameStore.rng)){
      this.context.ended=true;this.context.winner='captured';const placed=gameStore.addCreature(enemy);this.showText(`${species.name} joined you! Sent to ${placed==='party'?'your party':'storage'}.`);audio.sfx('victory');gameStore.autoSave();await this.wait(1300);this.returnToWorld();return;
    }
    this.showText(`${species.name} broke free!`);await this.wait(700);await this.perform({kind:'capture',itemId},true);
  }
  private async useItem(itemId:string){
    const item=ITEMS[itemId],creature=this.player();if(item.heal){const max=calculateStats(creature,this.playerSpecies()).hp;if(creature.currentHp>=max){this.showText('It would have no effect.');return;}gameStore.useItem(itemId);const amount=Math.min(item.heal,max-creature.currentHp);creature.currentHp+=amount;this.showText(`${item.name} restored ${amount} HP!`);audio.sfx('heal');this.updateHpBars();await this.wait(550);await this.perform({kind:'item',itemId},true);return;}
    if(item.id==='fullMend'){if(!creature.status){this.showText('It would have no effect.');return;}gameStore.useItem(itemId);creature.status=null;this.showText(`${creature.nickname||this.playerSpecies().name} was cured!`);await this.wait(500);await this.perform({kind:'item',itemId},true);}
  }
  private async perform(action:BattleAction,alreadyLocked=false){
    if(!alreadyLocked){this.locked=true;this.mode='locked';this.clearMenu();}
    document.body.dataset.battleMode=this.mode;document.body.dataset.battleLocked=String(this.locked);
    if(action.kind==='flee'){
      if(gameStore.rng.next()<.72){this.showText('You got away safely!');audio.sfx('confirm');await this.wait(700);gameStore.autoSave();this.returnToWorld();return;}
      this.showText('Could not escape!');await this.wait(550);
    }
    const enemyAction=chooseTrainerAction(this.context,SPECIES,MOVES,gameStore.rng);const events=resolveTurn(this.context,action,enemyAction,SPECIES,MOVES,gameStore.rng);
    for(const event of events)await this.playEvent(event);
    await this.afterTurn();
  }
  private async playEvent(event:BattleEvent){
    if(event.kind==='move'&&event.side){this.showText(event.text);await this.animateMove(event.side,event.moveId!);return;}
    if(event.kind==='damage'&&event.side){if(event.text)this.showText(event.text);await this.damageFlash(event.side);this.updateHpBars();if(event.text)await this.wait(350);return;}
    if(event.kind==='heal'&&event.side){this.showText(event.text);await this.healAnimation(event.side);this.updateHpBars();return;}
    if(event.kind==='status'||event.kind==='stage'||event.kind==='miss'||event.kind==='field'||event.kind==='switch'){this.showText(event.text);if(event.kind==='switch')this.swapSprite(event.side!);await this.wait(650);return;}
    if(event.kind==='faint'&&event.side){this.showText(event.text);const sprite=event.side==='player'?this.playerSprite:this.enemySprite;await this.tween({targets:sprite,y:sprite.y+30,alpha:0,duration:420,ease:'Quad.In'});this.updateHpBars();await this.wait(350);return;}
    if(event.kind==='text'&&event.text){this.showText(event.text);await this.wait(600);}
  }
  private async afterTurn(){
    for(const enemy of this.context.enemy.party){if(enemy.currentHp<=0&&!this.rewarded.has(enemy.uid)){this.rewarded.add(enemy.uid);const messages=gameStore.awardExperience(this.player(),enemy.speciesId,enemy.level,this.context.kind==='trainer');for(const message of messages){this.showText(message);await this.wait(750);}}}
    if(this.context.ended){if(this.context.winner==='player')await this.victory();else await this.defeat();return;}
    if(this.enemy().currentHp<=0){const next=this.context.enemy.party.findIndex((c)=>c.currentHp>0);if(next>=0){this.context.enemy.active=next;this.context.enemy.stages={...BASE_STAGES};this.swapSprite('enemy');this.showText(`${this.trainer?.name??'The foe'} sent out ${this.enemySpecies().name}!`);await this.wait(850);}}
    if(this.player().currentHp<=0){const next=this.context.player.party.findIndex((c)=>c.currentHp>0);if(next>=0){this.mode='party';this.cursor=next;this.locked=false;this.showText('Choose a creature to continue.');this.renderMenu();return;}}
    this.locked=false;this.openCommand();
  }
  private async victory(){
    audio.sfx('victory');if(this.trainer){gameStore.defeat(this.trainer.flag);const reward=Math.floor(this.trainer.reward*(this.player().ability==='Prospector'?1.2:1));gameStore.save!.money+=reward;this.showText(`Victory! You received ${reward} Lumen.`);if(this.trainer.id==='warden-lyra'){gameStore.awardCrest('glimmer');this.showText('Warden Lyra awarded the Glimmer Crest!');}if(this.trainer.id==='warden-kael'){gameStore.awardCrest('cinder');this.showText('Warden Kael awarded the Cinder Crest!');}if(this.trainer.id==='warden-selene'){gameStore.awardCrest('tide');gameStore.addFlag('champion');this.showText('Warden Selene awarded the Tide Crest!');}await this.wait(1300);}else{this.showText('The wild creature was overcome.');await this.wait(650);}
    gameStore.autoSave();if(this.trainer?.id==='warden-selene'){this.scene.start('Credits');return;}this.returnToWorld();
  }
  private async defeat(){audio.stopMusic();this.showText('Your party is exhausted… You return to Mossmere.');await this.wait(1100);gameStore.healAll();gameStore.setLocation('mossmere',12,10);gameStore.autoSave();this.scene.start('Overworld');}
  private returnToWorld(){audio.stopMusic();this.cameras.main.fadeOut(180,0,0,0);this.time.delayedCall(190,()=>this.scene.start('Overworld'));}
  private swapSprite(side:'player'|'enemy'){
    const old=side==='player'?this.playerSprite:this.enemySprite;old.destroy();if(side==='player'){this.playerSprite=this.add.image(62,104,`${this.player().speciesId}-back`).setDisplaySize(84,84).setOrigin(.5,.72).setFlipX(false).setDepth(5);}else{this.enemySprite=this.add.image(181,49,`${this.enemy().speciesId}-front`).setDisplaySize(68,68).setOrigin(.5,.6).setFlipX(false).setDepth(4);}this.updateStatusText();
  }
  private updateStatusText(){this.enemyNameText?.setText(`${this.enemySpecies().name.toUpperCase()}  Lv${this.enemy().level}`);this.playerNameText?.setText(`${(this.player().nickname||this.playerSpecies().name).toUpperCase()}  Lv${this.player().level}`);this.updateHpBars();}
  private updateHpBars(){
    if(!this.playerHp||!this.enemyHp)return;const pMax=calculateStats(this.player(),this.playerSpecies()).hp,eMax=calculateStats(this.enemy(),this.enemySpecies()).hp,pRatio=Math.max(0,this.player().currentHp/pMax),eRatio=Math.max(0,this.enemy().currentHp/eMax);
    this.playerHp.width=67*pRatio;this.playerHp.setFillStyle(hpColor(pRatio));this.enemyHp.width=74*eRatio;this.enemyHp.setFillStyle(hpColor(eRatio));
    document.body.dataset.battleHp=`${this.player().currentHp}/${pMax}:${this.enemy().currentHp}/${eMax}`;
  }
  private async animateMove(side:'player'|'enemy',moveId:string){
    const move=MOVES[moveId],attacker=side==='player'?this.playerSprite:this.enemySprite,target=side==='player'?this.enemySprite:this.playerSprite;audio.sfx(move.audioCue);
    const home={x:attacker.x,y:attacker.y};await this.tween({targets:attacker,x:attacker.x+(side==='player'?14:-14),y:attacker.y+(side==='player'?-7:7),duration:110,ease:'Quad.Out'});
    const color=move.type==='Ember'?0xf16b3a:move.type==='Tide'?0x56b9ca:move.type==='Verdant'?0x72b64b:move.type==='Wind'?0xe7e5ad:0xd1b47b;
    const burst=this.add.particles(target.x,target.y,'pixel-circle',{speed:{min:25,max:75},angle:{min:0,max:360},lifespan:280,quantity:12,scale:{start:.42,end:0},tint:color,blendMode:'ADD'}).setDepth(12);burst.explode(14);
    if(move.animation.includes('beam')||move.animation.includes('wave')||move.animation.includes('fire')||move.animation.includes('leaf')||move.power>0){const bolt=this.add.rectangle(attacker.x,attacker.y,move.type==='Wind'?26:8,move.type==='Wind'?2:8,color,.9).setDepth(11).setAngle(move.type==='Wind'?-25:0);await this.tween({targets:bolt,x:target.x,y:target.y,duration:220,ease:'Quad.In'});bolt.destroy();}
    this.cameras.main.shake(move.power>=90?150:80,move.power>=90?.012:.006);target.setAlpha(.28);await this.wait(70);target.setAlpha(1);await this.tween({targets:attacker,x:home.x,y:home.y,duration:130,ease:'Quad.In'});this.time.delayedCall(320,()=>burst.destroy());
  }
  private async damageFlash(side:'player'|'enemy'){const target=side==='player'?this.playerSprite:this.enemySprite;await this.tween({targets:target,alpha:.2,duration:55,yoyo:true,repeat:2});}
  private async healAnimation(side:'player'|'enemy'){audio.sfx('heal');const target=side==='player'?this.playerSprite:this.enemySprite;const particles=this.add.particles(target.x,target.y+18,'pixel-circle',{speedY:{min:-45,max:-18},speedX:{min:-12,max:12},lifespan:650,quantity:8,scale:{start:.28,end:0},tint:0x8de56d,blendMode:'ADD'}).setDepth(12);particles.explode(12);await this.wait(520);particles.destroy();}
  private async captureAnimation(){const pod=this.add.circle(35,104,5,0xe8d46b).setStrokeStyle(2,0x2c392d).setDepth(20);await this.tween({targets:pod,x:this.enemySprite.x,y:this.enemySprite.y-8,angle:540,duration:430,ease:'Quad.Out'});this.enemySprite.setVisible(false);for(let i=0;i<3;i+=1){await this.tween({targets:pod,x:pod.x+(i%2?5:-5),duration:130,yoyo:true});}pod.destroy();this.enemySprite.setVisible(true);}
  private tween(config:Phaser.Types.Tweens.TweenBuilderConfig){return new Promise<void>((resolve)=>this.tweens.add({...config,onComplete:()=>resolve()}));}
  private wait(ms:number){return new Promise<void>((resolve)=>this.time.delayedCall(ms,()=>resolve()));}
}
