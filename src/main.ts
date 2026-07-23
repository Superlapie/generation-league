import Phaser from 'phaser';
import './style.css';
import { controls } from './controls';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { IntroScene } from './scenes/IntroScene';
import { OverworldScene } from './scenes/OverworldScene';
import { BattleScene } from './scenes/BattleScene';
import { MenuScene } from './scenes/MenuScene';
import { CreditsScene } from './scenes/CreditsScene';
import { gameStore } from './state';

controls.init();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 480,
  height: 320,
  backgroundColor: '#101810',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  antialiasGL: false,
  render: { roundPixels: true, antialias: false, antialiasGL: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 480, height: 320 },
  input: { keyboard: false, mouse: true, touch: true },
  audio: { disableWebAudio: false },
  scene: [BootScene,TitleScene,IntroScene,OverworldScene,BattleScene,MenuScene,CreditsScene],
});

window.addEventListener('beforeunload',()=>{
  const scene=game.scene.getScene('Overworld');
  if(scene?.scene.isActive()) gameStore.autoSave();
});

declare global { interface Window { __GENERATION_LEAGUE__?: Phaser.Game } }
window.__GENERATION_LEAGUE__=game;
