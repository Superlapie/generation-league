import Phaser from 'phaser';
import { configureGbaCamera } from '../display';
import { audio } from '../audio';
import { controls } from '../controls';
import { SPECIES } from '../data';
import { gameStore } from '../state';
import { COLORS, label, panel, textStyle } from '../ui';

type Phase = 'name'|'avatar'|'intro'|'starter';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ⌫✓'.split('');
const STARTERS = ['cragbud','cinderskink','jellume'];

export class IntroScene extends Phaser.Scene {
  private phase: Phase = 'name';
  private nameValue = '';
  private avatar: 'a'|'b' = 'a';
  private cursor = 0;
  private starter = 0;
  private objects: Phaser.GameObjects.GameObject[] = [];
  constructor() { super('Intro'); }
  create() { configureGbaCamera(this);this.phase='name';this.nameValue='';this.avatar='a';this.cursor=0;this.starter=0;this.objects=[];this.cameras.main.setBackgroundColor('#d9dfbd'); controls.clear(); this.render(); }
  update() {
    if (this.phase==='name') {
      if (controls.pressed('LEFT')) this.cursor=(this.cursor+LETTERS.length-1)%LETTERS.length;
      if (controls.pressed('RIGHT')) this.cursor=(this.cursor+1)%LETTERS.length;
      if (controls.pressed('UP')) this.cursor=(this.cursor+LETTERS.length-7)%LETTERS.length;
      if (controls.pressed('DOWN')) this.cursor=(this.cursor+7)%LETTERS.length;
      if (controls.pressed('B') && this.nameValue) this.nameValue=this.nameValue.slice(0,-1);
      if (controls.pressed('A')) this.nameKey(LETTERS[this.cursor]);
    } else if (this.phase==='avatar') {
      if (controls.pressed('LEFT')||controls.pressed('RIGHT')) { this.avatar=this.avatar==='a'?'b':'a'; audio.sfx('confirm'); this.render(); }
      if (controls.pressed('A')) { this.phase='intro'; audio.sfx('confirm'); this.render(); }
      if (controls.pressed('B')) { this.phase='name'; this.render(); }
    } else if (this.phase==='intro') {
      if (controls.pressed('A')) { this.phase='starter'; audio.sfx('confirm'); this.render(); }
      if (controls.pressed('B')) { this.phase='avatar'; this.render(); }
    } else {
      if (controls.pressed('LEFT')) { this.starter=(this.starter+2)%3; audio.sfx('confirm'); this.render(); }
      if (controls.pressed('RIGHT')) { this.starter=(this.starter+1)%3; audio.sfx('confirm'); this.render(); }
      if (controls.pressed('A')) this.begin();
      if (controls.pressed('B')) { this.phase='intro'; this.render(); }
    }
  }
  private clear() { this.objects.forEach((object) => object.destroy()); this.objects=[]; }
  private keep<T extends Phaser.GameObjects.GameObject>(object:T){this.objects.push(object);return object;}
  private render() {
    this.clear();
    this.keep(this.add.rectangle(0,0,240,160,0xd9dfbd).setOrigin(0));
    if (this.phase==='name') this.renderName(); else if (this.phase==='avatar') this.renderAvatar(); else if (this.phase==='intro') this.renderIntro(); else this.renderStarter();
  }
  private renderName() {
    this.keep(label(this,12,10,'WHAT IS YOUR NAME?',11,'#182017',2));
    this.keep(panel(this,12,29,216,26,COLORS.paper,1));
    this.keep(label(this,20,37,(this.nameValue||'_')+(this.nameValue.length<10?'▮':''),10,'#182017',2));
    LETTERS.forEach((char,index)=>{
      const x=20+(index%7)*30,y=65+Math.floor(index/7)*20;
      const selected=index===this.cursor;
      const box=this.keep(this.add.rectangle(x-3,y-2,22,15,selected?COLORS.blue:0xc6cfaa).setOrigin(0).setInteractive());
      this.keep(label(this,x+5,y+2,char,8,selected?'#ffffff':'#182017',2)).setOrigin(.5,0);
      box.on('pointerdown',()=>{this.cursor=index;this.nameKey(char);});
    });
    this.keep(label(this,12,148,'A: choose   B: erase',7,'#59684f',2));
  }
  private nameKey(char:string){
    audio.unlock();audio.sfx('confirm');
    if(char==='⌫')this.nameValue=this.nameValue.slice(0,-1);else if(char==='✓'){if(this.nameValue){this.phase='avatar';this.cursor=0;}}else if(this.nameValue.length<10)this.nameValue+=char;
    this.render();
  }
  private renderAvatar(){
    this.keep(label(this,120,14,'CHOOSE YOUR LOOK',12,'#182017',2)).setOrigin(.5,0);
    this.keep(panel(this,31,39,178,86,COLORS.paper,1));
    (['a','b'] as const).forEach((id,index)=>{
      const selected=this.avatar===id;
      const bg=this.keep(this.add.rectangle(54+index*94,51,66,62,selected?0x7f9f88:0xb9c29f).setOrigin(0).setInteractive());
      const sprite=this.keep(this.add.sprite(87+index*94,78,`avatar-${id}`,0).setScale(2));
      this.keep(this.add.rectangle(87+index*94,108,54,11,selected?0x6f8f78:0xc6cfaa).setDepth(2));
      this.keep(label(this,87+index*94,105,id==='a'?'TRAIL':'TIDE',7,selected?'#ffffff':'#59684f',3)).setOrigin(.5,0);
      bg.on('pointerdown',()=>{this.avatar=id;this.render();});sprite.setDepth(2);
    });
    this.keep(label(this,120,139,'← → choose   A: confirm',8,'#59684f',2)).setOrigin(.5);
  }
  private renderIntro(){
    this.keep(this.add.rectangle(0,0,240,160,0x172519).setOrigin(0));
    this.keep(this.add.circle(120,52,34,0x87a966));
    this.keep(this.add.sprite(120,54,'avatar-b',0).setScale(2));
    this.keep(panel(this,8,91,224,61,COLORS.paper,3));
    this.keep(this.add.text(16,99,`PROFESSOR ASTER:\nWelcome, ${this.nameValue}. Five creature lines share our region.\nEarn three Crests—not for glory, but to learn what strength protects.`,textStyle(8,'#182017')).setDepth(4).setWordWrapWidth(208));
    this.keep(label(this,219,139,'▼',8,'#182017',5));
  }
  private renderStarter(){
    const id=STARTERS[this.starter],species=SPECIES[id];
    this.keep(this.add.rectangle(0,0,240,160,0x35543a).setOrigin(0));
    this.keep(label(this,120,9,'CHOOSE YOUR FIRST PARTNER',10,'#edf1d4',2)).setOrigin(.5,0);
    this.keep(this.add.ellipse(120,92,118,25,0x9bb872,.45));
    this.keep(this.add.image(120,72,`${id}-front`).setDisplaySize(82,82));
    this.keep(panel(this,43,108,154,38,COLORS.paper,2));
    this.keep(label(this,120,114,species.name.toUpperCase(),11,'#182017',3)).setOrigin(.5,0);
    this.keep(label(this,120,130,`${species.types.join(' / ')}  •  ${this.starter+1} OF 3`,7,'#59684f',3)).setOrigin(.5,0);
    this.keep(label(this,12,68,'◀',14,'#edf1d4',3));this.keep(label(this,220,68,'▶',14,'#edf1d4',3));
  }
  private begin(){
    audio.sfx('confirm');gameStore.newGame({name:this.nameValue,avatar:this.avatar,starter:STARTERS[this.starter]});this.scene.start('Overworld');
  }
}
