import Phaser from 'phaser';
import { audio } from '../audio';
import { controls } from '../controls';
import { createCreature, ITEMS, SPECIES } from '../data';
import { configureGbaCamera } from '../display';
import { MAPS } from '../maps';
import { gameStore } from '../state';
import type { Direction, MapDefinition, NpcDefinition, TileKind, TrainerDefinition } from '../types';
import { COLORS, label, panel, textStyle } from '../ui';
import { DIRECTION_DELTAS, facingFrame, oppositeDirection, terrain3x3Frame, trainerHasLineOfSight } from '../world';

const TILE = 16;
const BLOCKED = new Set<TileKind>(['tree','wall','water','rock','counter']);
const GRASS_FRAMES = [264,264,264,265,266];
const DEEP_GRASS_FRAMES = [275,275,275,276,277];
const ROCK_FRAMES = [364,364,365,386,387];
const PALETTE_TINT: Record<string,number> = { cinder:0xffd5a8,ember:0xffb879,ash:0xc9b8ad,tide:0xd6f4ef,reedwater:0xe0f4d4,glimmer:0xc2dba9 };

export class OverworldScene extends Phaser.Scene {
  private map!: MapDefinition;
  private player!: Phaser.GameObjects.Sprite;
  private position = { x: 0, y: 0 };
  private moving = false;
  private modal = false;
  private lastStep = 0;
  private dialogueLines: string[] = [];
  private dialogueDone?: () => void;
  private dialogueObjects: Phaser.GameObjects.GameObject[] = [];
  private actors = new Map<string, Phaser.GameObjects.Sprite>();
  private titleObjects: Phaser.GameObjects.GameObject[] = [];
  private cameraFx: Array<Phaser.GameObjects.Rectangle|Phaser.GameObjects.Arc|Phaser.GameObjects.TileSprite> = [];
  constructor() { super('Overworld'); }
  create() {
    configureGbaCamera(this);
    this.moving=false;this.modal=false;this.dialogueLines=[];this.dialogueDone=undefined;this.dialogueObjects=[];this.actors=new Map();this.titleObjects=[];this.cameraFx=[];
    const save = gameStore.save;
    if (!save) { this.scene.start('Title'); return; }
    this.map = MAPS[save.location.mapId] ?? MAPS.mossmere;
    this.position = { x: save.location.x, y: save.location.y };
    document.body.dataset.gameScene='overworld';document.body.dataset.map=this.map.id;document.body.dataset.position=`${this.position.x},${this.position.y}`;
    this.renderMap();
    this.player = this.add.sprite(this.position.x*TILE+8,this.position.y*TILE+16,`avatar-${save.player.avatar}`,facingFrame(save.location.facing)).setOrigin(.5,1).setDepth(this.worldDepth(this.position.y*TILE+16));
    this.player.setData('facing',save.location.facing);
    this.cameras.main.setBounds(0,0,this.map.width*TILE,this.map.height*TILE).setRoundPixels(true);
    this.cameras.main.startFollow(this.player,true,.18,.18);
    this.cameras.main.fadeIn(180,0,0,0);
    this.showMapTitle();
    audio.playMusic(this,this.map.music);
    controls.clear();
    if (this.map.id==='research-lodge' && gameStore.flag('tutorialReady') && !gameStore.flag('tutorialDone')) {
      this.time.delayedCall(450,()=>this.showDialogue(['PROFESSOR ASTER: A good partnership begins by listening.','Walk with the D-pad or arrow keys. Face someone and press A to talk.','Open MENU to see your Party, Bag, Guide, Player Card, Save, and Options.','Your first goal is Warden Lyra in Glimmerwood. The road begins north of Mossmere.'],()=>gameStore.addFlag('tutorialDone')));
    }
  }
  update(time: number) {
    if (!gameStore.save) return;
    this.updateCameraFx();
    if (this.modal) { if (controls.pressed('A')||controls.pressed('B')) this.advanceDialogue(); return; }
    if (this.moving) return;
    if (controls.pressed('MENU')) { audio.sfx('confirm'); this.scene.launch('Menu',{mode:'pause'}); this.scene.pause(); return; }
    if (controls.pressed('A')) { this.interact(); return; }
    if (time-this.lastStep<35) return;
    const direction: Direction | null = (controls.pressed('UP')||controls.isDown('UP'))?'up':(controls.pressed('DOWN')||controls.isDown('DOWN'))?'down':(controls.pressed('LEFT')||controls.isDown('LEFT'))?'left':(controls.pressed('RIGHT')||controls.isDown('RIGHT'))?'right':null;
    if (direction) this.tryMove(direction,time);
  }
  private renderMap() {
    const color = this.map.kind==='interior' ? 0x6b5a44 : this.map.palette==='ash'||this.map.palette==='ember' ? 0x4b4136 : 0x274d34;
    this.cameras.main.setBackgroundColor(color);
    for (let y=0;y<this.map.height;y+=1) for (let x=0;x<this.map.width;x+=1) {
      const kind=this.map.tiles[y][x];
      if (this.map.kind==='interior') {
        this.renderInteriorTile(x,y,kind);
      } else {
        this.renderTerrainTile(x,y,kind);
      }
    }
    this.map.buildings.forEach((b)=>{
      const x=b.x*TILE,y=b.y*TILE,w=b.width*TILE,h=b.height*TILE;
      const landmark=b.id.includes('hall')||b.id.includes('spire');
      const frame=landmark?'house-hall':'house-home';
      const building=this.add.image(x+w/2,y+h,'vendor-village',frame).setOrigin(.5,1).setDepth(this.worldDepth(y+h));
      building.setDisplaySize(landmark?Math.min(80,w-4):64,landmark?96:80);
      if(b.id.includes('heal'))building.setTint(0xdff3d5);
      else if(b.id.includes('shop')||b.id.includes('market'))building.setTint(0xffdfad);
      else if(b.id.includes('research')||b.id.includes('lodge'))building.setTint(0xe0edff);
      else if(this.map.palette==='cinder')building.setTint(0xffc69d);
    });
    if(this.map.kind!=='interior')this.renderWorldDetails();
    const people: Array<NpcDefinition|TrainerDefinition> = [...this.map.npcs,...this.map.trainers.filter((t)=>this.trainerActive(t))];
    people.forEach((person)=>{
      const sprite=this.add.sprite(person.x*TILE+8,person.y*TILE+16,`npc-${person.sprite}`,facingFrame(person.facing)).setOrigin(.5,1).setDepth(this.worldDepth(person.y*TILE+16));
      sprite.setData('id',person.id);this.actors.set(person.id,sprite);
      if ('party' in person && this.trainerActive(person)) this.add.image(person.x*TILE+8,person.y*TILE-7,'pixel-white').setDisplaySize(3,3).setTint(person.boss?0xffd34e:0xe8efc7).setDepth(11);
    });
    this.map.items.filter((item)=>!item.hidden&&!gameStore.hasCollected(item.id)).forEach((item)=>{
      const sparkle=this.add.image(item.x*TILE+8,item.y*TILE+8,'pixel-circle').setDisplaySize(6,6).setTint(0xf5d969).setDepth(this.worldDepth(item.y*TILE+8));
      this.tweens.add({targets:sparkle,angle:180,scale:.7,duration:700,yoyo:true,repeat:-1});
    });
    this.map.signs.forEach((sign)=>this.add.image(sign.x*TILE+8,sign.y*TILE+8,'field-sign').setDepth(this.worldDepth(sign.y*TILE+8)));
    if (this.map.dark && !gameStore.countItem('grottoLantern')) {
      const shade=this.add.rectangle(0,0,240,160,0x060808,.77).setOrigin(0).setDepth(50).setBlendMode(Phaser.BlendModes.MULTIPLY);
      const glow=this.add.circle(0,0,42,0xf2e6bd,.22).setDepth(51).setBlendMode(Phaser.BlendModes.ADD);
      this.cameraFx.push(shade,glow);
    } else if (this.map.dark) {
      const fog=this.add.tileSprite(0,0,240,160,'fx-fog').setOrigin(0).setAlpha(.08).setDepth(30);
      this.cameraFx.push(fog);
      this.tweens.add({targets:fog,tilePositionX:64,duration:8000,repeat:-1});
    }
  }
  private updateCameraFx(){
    if(!this.cameraFx.length)return;
    const view=this.cameras.main.worldView;
    this.cameraFx.forEach((effect,index)=>{
      if(effect instanceof Phaser.GameObjects.Arc)effect.setPosition(this.player?.x??view.x+120,this.player?.y??view.y+80);
      else effect.setPosition(view.x,view.y);
      if(index===0&&effect instanceof Phaser.GameObjects.Rectangle)effect.setDisplaySize(view.width,view.height);
    });
  }
  private worldDepth(pixelY:number){return 10+pixelY/1000;}
  private renderInteriorTile(x:number,y:number,kind:TileKind){
    const px=x*TILE+8,py=y*TILE+8;
    const floorBase=this.map.palette==='hall'?[11,6]:this.map.palette==='lodge'?[0,6]:this.map.palette==='heal'?[0,0]:[11,0];
    const floorFrame=(floorBase[1]+y%5)*22+floorBase[0]+x%5;
    this.add.image(px,py,'tile-floor').setDepth(0);
    this.add.image(px,py,'interior-sheet',floorFrame).setDepth(1);
    if(kind==='wall'){
      const wallBaseX=this.map.palette==='hall'?5:0;
      const wallBaseY=this.map.palette==='hall'?6:0;
      const frameX=x===0?0:x===this.map.width-1?4:1+(x%3);
      const frameY=y===0?0:y===this.map.height-1?4:1+(y%3);
      this.add.image(px,py,'wall-sheet',(wallBaseY+frameY)*10+wallBaseX+frameX).setDepth(2);
    } else if(kind==='counter')this.add.image(px,py,'tile-counter').setDepth(2);
    else if(kind==='door'){
      this.add.rectangle(px,py+5,12,4,0x6c4834).setDepth(2);
      this.add.rectangle(px,py+7,12,2,0x3b2d27).setDepth(3);
    }
  }
  private renderTerrainTile(x:number,y:number,kind:TileKind){
    const px=x*TILE+8,py=y*TILE+8;
    const tint=PALETTE_TINT[this.map.palette]??0xffffff;
    const variant=(x*17+y*29)%5;
    const lushFrames=this.map.palette==='glimmer'?DEEP_GRASS_FRAMES:GRASS_FRAMES;
    if(kind==='path'||kind==='door'){
      const connected=(tx:number,ty:number)=>{const tile=this.map.tiles[ty]?.[tx];return tile==='path'||tile==='door';};
      const frame=terrain3x3Frame(this.map.palette==='glimmer'?11:0,7,{up:connected(x,y-1),right:connected(x+1,y),down:connected(x,y+1),left:connected(x-1,y)});
      if(this.map.palette==='ash'||this.map.palette==='ember')this.add.image(px,py,'tile-path').setTint(0x9a7c68).setDepth(0);
      else this.add.image(px,py,'terrain-sheet',frame).setTint(tint).setDepth(0);
      return;
    }
    if(kind==='water'){
      this.add.image(px,py,'tile-water').setTint(this.map.palette==='tide'?0xbfe8e8:0xffffff).setDepth(0);
      const g=this.add.graphics().setDepth(1);g.fillStyle(0xd9f4df,.28);
      if(this.map.tiles[y-1]?.[x]!=='water')g.fillRect(x*TILE,y*TILE,16,1);
      if(this.map.tiles[y+1]?.[x]!=='water')g.fillRect(x*TILE,y*TILE+15,16,1);
      if(this.map.tiles[y]?.[x-1]!=='water')g.fillRect(x*TILE,y*TILE,1,16);
      if(this.map.tiles[y]?.[x+1]!=='water')g.fillRect(x*TILE+15,y*TILE,1,16);
      return;
    }
    if(kind==='rock')this.add.image(px,py,'terrain-sheet',ROCK_FRAMES[variant]).setTint(tint).setDepth(0);
    else if(kind==='ledge')this.add.image(px,py,'tile-ledge').setTint(this.map.palette==='ember'?0xd4875f:0xffffff).setDepth(0);
    else if(kind==='cave'){
      this.add.image(px,py,'terrain-sheet',ROCK_FRAMES[variant]).setTint(tint).setDepth(0);
      const portal=this.add.graphics().setDepth(this.worldDepth(py+8));
      const left=x===0,right=x===this.map.width-1;
      portal.fillStyle(0x342d2a,1);
      if(left)portal.fillRect(0,y*TILE+2,10,12);
      else if(right)portal.fillRect(x*TILE+6,y*TILE+2,10,12);
      else portal.fillRoundedRect(x*TILE-5,y*TILE-7,26,28,8);
      portal.lineStyle(2,this.map.palette==='ember'?0x9b624c:0x75665d,1);
      if(left)portal.strokeRect(0,y*TILE+1,11,14);
      else if(right)portal.strokeRect(x*TILE+5,y*TILE+1,11,14);
      else portal.strokeRoundedRect(x*TILE-6,y*TILE-8,28,30,8);
    } else {
      this.add.image(px,py,'terrain-sheet',lushFrames[variant]).setTint(tint).setDepth(0);
      if(kind==='tallGrass'){
        this.add.image(px,py,'tile-tallGrass').setAlpha(.55).setTint(this.map.palette==='glimmer'?0x6f9f68:0x8bbb58).setDepth(1);
        if((x*3+y)%4===0)this.add.image(px,py+2,'prop-grass').setTint(this.map.palette==='glimmer'?0x8fbf82:0xa5d170).setDepth(2);
      }
    }
  }
  private renderWorldDetails(){
    for(let y=0;y<this.map.height;y+=1)for(let x=0;x<this.map.width;x+=1){
      const kind=this.map.tiles[y][x];
      if(kind==='tree'&&(x+y)%2===0){
        const frame=this.map.palette==='cinder'||this.map.palette==='ember'?'tree-autumn':this.map.palette==='glimmer'?'tree-deep':this.map.palette==='ash'?'tree-olive':'tree-spring';
        this.add.image(x*TILE+8,y*TILE+14,'vendor-village',frame).setOrigin(.5,1).setDisplaySize(30,30).setDepth(this.worldDepth(y*TILE+14));
      }
      if(kind==='grass'&&(x*13+y*7)%53===0)this.add.image(x*TILE+8,y*TILE+8,'prop-grass').setTint(0xb3d65f).setDepth(2);
    }
  }
  private showMapTitle() {
    const view=this.cameras.main.worldView;
    const bg=this.add.rectangle(view.x+120,view.y+16,Math.min(180,this.map.name.length*8+22),18,0x182017,.88).setDepth(80);
    const text=label(this,view.x+120,view.y+12,this.map.name.toUpperCase(),8,'#eef1d5',81).setOrigin(.5,0);
    this.titleObjects=[bg,text]; this.tweens.add({targets:this.titleObjects,alpha:0,delay:1100,duration:450,onComplete:()=>this.titleObjects.forEach((o)=>o.destroy())});
  }
  private tryMove(direction: Direction,time:number) {
    const save=gameStore.save!;save.location.facing=direction;this.player.setData('facing',direction);
    const [dx,dy]=DIRECTION_DELTAS[direction];let tx=this.position.x+dx,ty=this.position.y+dy;
    const target=this.map.tiles[ty]?.[tx];
    if (target==='ledge' && direction==='down' && this.passable(tx,ty+1)) { ty+=1; }
    if (!this.passable(tx,ty)) { this.bump(direction);this.lastStep=time;return; }
    if (this.map.storyGate && !gameStore.flag(this.map.storyGate.flag) && tx===this.map.storyGate.x&&ty===this.map.storyGate.y) { this.showDialogue([this.map.storyGate.message]);return; }
    this.moving=true;this.lastStep=time;this.position={x:tx,y:ty};gameStore.setLocation(this.map.id,tx,ty);
    this.player.setDepth(this.worldDepth(ty*TILE+16));
    document.body.dataset.position=`${tx},${ty}`;
    const running=controls.isDown('RUN')||controls.isDown('B');const duration=target==='ledge'?170:running?68:112;
    this.player.play(`${save.player.avatar}-${direction}`,true);audio.sfx(target==='tallGrass'?'grass':'step');
    this.tweens.add({targets:this.player,x:tx*TILE+8,y:ty*TILE+16,duration,ease:'Linear',onComplete:()=>{
      this.player.stop();this.player.setFrame(facingFrame(direction));this.moving=false;
      this.afterStep(target);
    }});
  }
  private passable(x:number,y:number) {
    const tile=this.map.tiles[y]?.[x];if(!tile||BLOCKED.has(tile))return false;
    if(this.map.buildings.some((b)=>x>=b.x&&x<b.x+b.width&&y>=b.y&&y<b.y+b.height&&!(x===b.doorX&&y>=b.y+b.height-2)))return false;
    if(this.map.signs.some((sign)=>sign.x===x&&sign.y===y))return false;
    if([...this.map.npcs,...this.map.trainers.filter((t)=>this.trainerActive(t))].some((person)=>person.x===x&&person.y===y))return false;
    return true;
  }
  private bump(direction:Direction){const[dx,dy]=DIRECTION_DELTAS[direction];this.player.setFrame(facingFrame(direction));this.tweens.add({targets:this.player,x:this.player.x+dx*2,y:this.player.y+dy*2,duration:45,yoyo:true});}
  private afterStep(tile?:TileKind) {
    const warp=this.map.warps.find((entry)=>entry.x===this.position.x&&entry.y===this.position.y);
    if(warp){audio.sfx(warp.id.includes('exit')?'door':'door');this.transitionMap(warp.toMap,warp.toX,warp.toY);return;}
    const pickup=this.map.items.find((item)=>item.x===this.position.x&&item.y===this.position.y&&!item.hidden&&!gameStore.hasCollected(item.id));
    if(pickup){this.collectItem(pickup.id,pickup.itemId,pickup.count);return;}
    const trainer=this.findSightTrainer();if(trainer){this.startTrainer(trainer);return;}
    if(tile==='tallGrass'&&this.map.encounters&&Math.random()<(this.map.encounterRate??.1)){this.startWild();}
  }
  private transitionMap(mapId:string,x:number,y:number){
    this.moving=true;gameStore.setLocation(mapId,x,y);gameStore.autoSave();this.cameras.main.fadeOut(180,0,0,0);this.time.delayedCall(190,()=>this.scene.restart());
  }
  private frontPosition(){const direction=(this.player.getData('facing')||'down') as Direction;const[dx,dy]=DIRECTION_DELTAS[direction];return{x:this.position.x+dx,y:this.position.y+dy};}
  private interact(){
    const front=this.frontPosition();
    const person=[...this.map.npcs,...this.map.trainers.filter((t)=>this.trainerActive(t))].find((entry)=>entry.x===front.x&&entry.y===front.y);
    if(person){
      this.actors.get(person.id)?.setFrame(facingFrame(oppositeDirection(this.player.getData('facing') as Direction)));
      if('party' in person){this.startTrainer(person as TrainerDefinition);return;}
      if(person.id.includes('healer')){this.showDialogue([`${person.name}: ${person.dialogue[0]}`,'Your party was restored to full health.'],()=>{gameStore.healAll();audio.sfx('heal');});return;}
      if(person.id.includes('clerk')){this.showDialogue([`${person.name}: ${person.dialogue[0]}`],()=>{this.scene.launch('Menu',{mode:'shop'});this.scene.pause();});return;}
      this.showDialogue(person.dialogue.map((line,index)=>index===0?`${person.name}: ${line}`:line));return;
    }
    const trainer=this.map.trainers.find((entry)=>entry.x===front.x&&entry.y===front.y&&this.trainerActive(entry));if(trainer){this.startTrainer(trainer);return;}
    const sign=this.map.signs.find((entry)=>entry.x===front.x&&entry.y===front.y);if(sign){this.showDialogue(sign.text);return;}
    const item=this.map.items.find((entry)=>entry.x===front.x&&entry.y===front.y&&!gameStore.hasCollected(entry.id));if(item){this.collectItem(item.id,item.itemId,item.count);return;}
    const building=this.map.buildings.find((b)=>front.x===b.doorX&&front.y===b.y+b.height-2);if(building)this.showDialogue([building.label.toUpperCase()]);
  }
  private collectItem(id:string,itemId:string,count:number){gameStore.addItem(itemId,count);gameStore.collect(id);audio.sfx('confirm');this.showDialogue([`You found ${count>1?`${count} × `:''}${ITEMS[itemId].name}!`]);}
  private findSightTrainer(){
    return this.map.trainers.find((trainer)=>{
      if(!this.trainerActive(trainer))return false;
      return trainerHasLineOfSight(trainer,this.position.x,this.position.y,(x,y)=>{
        const tile=this.map.tiles[y]?.[x];
        return !tile||BLOCKED.has(tile)||this.map.buildings.some((b)=>x>=b.x&&x<b.x+b.width&&y>=b.y&&y<b.y+b.height);
      });
    });
  }
  private trainerActive(trainer:TrainerDefinition){return !gameStore.hasDefeated(trainer.flag)||(Boolean(trainer.boss)&&gameStore.flag('champion'));}
  private startTrainer(trainer:TrainerDefinition){
    if(this.modal||this.moving)return;const actor=this.actors.get(trainer.id);if(actor){const mark=this.add.text(actor.x,actor.y-18,'!',textStyle(15,'#f2d25f')).setOrigin(.5).setDepth(60).setStroke('#301f18',2);this.tweens.add({targets:mark,y:mark.y-5,duration:180,yoyo:true});}
    this.showDialogue(trainer.dialogue.map((line,index)=>index===0?`${trainer.name}: ${line}`:line),()=>this.encounterTransition(()=>this.scene.start('Battle',{kind:'trainer',trainer,mapId:this.map.id})));
  }
  private startWild(){
    const entries=this.map.encounters!;const total=entries.reduce((sum,e)=>sum+e.weight,0);let roll=Math.random()*total;let chosen=entries[0];for(const entry of entries){roll-=entry.weight;if(roll<=0){chosen=entry;break;}}
    const level=Phaser.Math.Between(chosen.minLevel,chosen.maxLevel);const creature=createCreature(chosen.speciesId,level,'Wild',this.map.id,gameStore.rng);gameStore.see(chosen.speciesId);
    this.encounterTransition(()=>this.scene.start('Battle',{kind:'wild',wild:creature,mapId:this.map.id}));
  }
  private encounterTransition(done:()=>void){
    audio.stopMusic();this.moving=true;const view=this.cameras.main.worldView;const g=this.add.graphics().setPosition(view.x,view.y).setDepth(100);for(let i=0;i<10;i+=1)g.fillStyle(i%2?0xe9edc8:0x233324).fillRect(i%2?240:-240,i*16,240,16);
    const bars=g.getData('none');void bars;this.tweens.add({targets:g,x:240,duration:360,ease:'Cubic.In',onComplete:done});this.cameras.main.flash(180,235,240,205);
  }
  private showDialogue(lines:string[],done?:()=>void){
    this.modal=true;this.dialogueLines=[...lines];this.dialogueDone=done;this.drawDialogue();
  }
  private drawDialogue(){
    this.dialogueObjects.forEach((object)=>object.destroy());this.dialogueObjects=[];
    const view=this.cameras.main.worldView;const box=panel(this,view.x+5,view.y+111,230,45,COLORS.paper,90);const value=this.dialogueLines[0]??'';
    const text=this.add.text(view.x+13,view.y+119,value,textStyle(8,'#182017')).setDepth(91).setWordWrapWidth(212);
    const arrow=label(this,view.x+222,view.y+145,'▼',7,'#182017',92);
    this.dialogueObjects.push(box,text,arrow);box.setInteractive(new Phaser.Geom.Rectangle(0,0,230,45),Phaser.Geom.Rectangle.Contains).on('pointerdown',()=>this.advanceDialogue());
  }
  private advanceDialogue(){
    audio.sfx('confirm');this.dialogueLines.shift();if(this.dialogueLines.length){this.drawDialogue();return;}
    this.dialogueObjects.forEach((object)=>object.destroy());this.dialogueObjects=[];this.modal=false;const done=this.dialogueDone;this.dialogueDone=undefined;done?.();
  }
}
