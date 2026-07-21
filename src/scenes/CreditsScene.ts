import Phaser from 'phaser';
import { audio } from '../audio';
import { controls } from '../controls';
import { configureGbaCamera } from '../display';
import { gameStore } from '../state';
import { label, textStyle } from '../ui';

export class CreditsScene extends Phaser.Scene {
  private ending=false;private finished=false;
  constructor(){super('Credits');}
  create(){
    configureGbaCamera(this);
    this.ending=false;this.finished=false;
    this.cameras.main.setBackgroundColor('#0d1812');audio.stopMusic();audio.playMusic(this,'dream');controls.clear();
    const stars=this.add.graphics();for(let i=0;i<70;i+=1)stars.fillStyle(i%7===0?0xe9d98b:0xa6c3a3,Phaser.Math.FloatBetween(.2,.8)).fillRect(Phaser.Math.Between(0,239),Phaser.Math.Between(0,159),1,1);
    const lines=[
      'GENERATION LEAGUE','',`${gameStore.save?.player.name.toUpperCase()}`,'KEEPER OF THREE CRESTS','',
      'MOSS AND CINDER','TIDE AND WIND','FIVE LINES — ONE LIVING REGION','',
      'WARDEN LYRA','WARDEN KAEL','WARDEN SELENE','',
      'CREATURE ART','ORIGINAL GENERATION LEAGUE LINES','',
      'WORLD ART • MUSIC • UI','NINJA ADVENTURE ASSET PACK','PIXEL-BOY & AAA — CC0','',
      'ENGINE','PHASER 4 — MIT','',
      'THANK YOU FOR PLAYING','',
      'THE ROAD REMAINS OPEN','WARDENS NOW ACCEPT REMATCHES','',
      'PRESS A TO RETURN TO TIDEGLASS',
    ];
    const container=this.add.container(0,170);lines.forEach((line,index)=>container.add(this.add.text(120,index*16,line,textStyle(index===0?18:index===2?12:8,index===0?'#d8c46d':'#dce5c5')).setOrigin(.5,0)));
    this.tweens.add({targets:container,y:-lines.length*16+116,duration:32000,ease:'Linear',onComplete:()=>{this.ending=true;}});
    label(this,120,148,'A: SKIP / CONTINUE',6,'#71856e',5).setOrigin(.5,0).setScrollFactor(0);
  }
  update(){if(controls.pressed('A')||controls.pressed('B')||this.ending)this.finish();}
  private finish(){if(this.finished)return;this.finished=true;this.ending=true;gameStore.setLocation('tideglass',14,12);gameStore.autoSave();audio.stopMusic();this.scene.start('Overworld');}
}
