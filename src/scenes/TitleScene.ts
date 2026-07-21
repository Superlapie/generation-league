import Phaser from 'phaser';
import { configureGbaCamera } from '../display';
import { audio } from '../audio';
import { controls } from '../controls';
import { gameStore } from '../state';
import { button, COLORS, label, panel, textStyle } from '../ui';

export class TitleScene extends Phaser.Scene {
  private selected = 0;
  private options: ReturnType<typeof button>[] = [];
  constructor() { super('Title'); }
  create() {
    configureGbaCamera(this);
    this.options=[];this.selected=0;
    this.cameras.main.setBackgroundColor('#172519');
    this.add.image(120,80,'title-background').setDisplaySize(240,160);
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x07140d,0x07140d,0x13251a,0x13251a,.34).fillRect(0,0,240,160);
    bg.fillStyle(0x08130d,.6).fillRoundedRect(42,8,156,76,9);
    bg.fillStyle(0x08130d,.68).fillRoundedRect(59,89,122,63,7);
    this.add.text(120,23,'GENERATION',textStyle(23,'#f1f4d1')).setOrigin(.5).setShadow(2,2,'#101b13',3).setStroke('#426146',2);
    this.add.text(120,47,'LEAGUE',textStyle(30,'#e2c15d')).setOrigin(.5).setShadow(2,2,'#101b13',3).setStroke('#77503b',2);
    label(this,120,74,'A JOURNEY OF FIVE LINES',7,'#e3e9c4').setOrigin(.5);
    panel(this,63,94,114,54,COLORS.paper,10).setAlpha(.94);
    const names = gameStore.hasSave() ? ['CONTINUE','NEW JOURNEY'] : ['NEW JOURNEY'];
    this.options = names.map((name,index) => button(this,72,101+index*19,96,name,() => this.choose(index),20));
    this.selected = 0; this.refresh();
    label(this,120,151,'© 2026 ORIGINAL CREATURE RPG',6,'#8fa183').setOrigin(.5);
    this.input.once('pointerdown',() => { audio.unlock(); audio.playMusic(this,'village'); });
    controls.clear();
  }
  update() {
    if (controls.pressed('UP') || controls.pressed('DOWN')) { this.selected = (this.selected + 1) % this.options.length; audio.unlock(); audio.sfx('confirm'); this.refresh(); }
    if (controls.pressed('A')) this.choose(this.selected);
  }
  private refresh() { this.options.forEach((entry,index) => entry.setSelected(index===this.selected)); }
  private choose(index: number) {
    audio.unlock(); audio.sfx('confirm'); audio.playMusic(this,'village');
    if (gameStore.hasSave() && index===0) { gameStore.continueGame(); this.scene.start('Overworld'); }
    else this.scene.start('Intro');
  }
}
