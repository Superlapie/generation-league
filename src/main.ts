import Phaser from 'phaser';
import './style.css';
import { controls } from './controls';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { IntroScene } from './scenes/IntroScene';
import { OverworldScene } from './scenes/OverworldScene';
import { BattleScene } from './scenes/BattleScene';
import { DoubleBattleScene } from './scenes/DoubleBattleScene';
import { MenuScene } from './scenes/MenuScene';
import { CreditsScene } from './scenes/CreditsScene';
import { gameStore } from './state';
import { initGameScale } from './online/gameScale';
import { initLeagueLink } from './online/LeagueLink';
import { initTouchControls } from './ui/touchControls';

controls.init();
initLeagueLink();
initTouchControls();

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
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER, width: 480, height: 320 },
  input: { keyboard: false, mouse: true, touch: true },
  audio: { disableWebAudio: false },
  dom: { createContainer: true },
  scene: [BootScene, TitleScene, IntroScene, OverworldScene, BattleScene, DoubleBattleScene, MenuScene, CreditsScene],
});

const gameFrame = document.getElementById('game-frame');
let gameScaleReady = false;

const bootGameScale = () => {
  if (!gameFrame || !game.canvas) {
    requestAnimationFrame(bootGameScale);
    return;
  }
  if (gameScaleReady) return;
  gameScaleReady = true;
  initGameScale(gameFrame, game);
};

bootGameScale();
window.addEventListener('load', bootGameScale, { once: true });

window.addEventListener('beforeunload', () => {
  const scene = game.scene.getScene('Overworld');
  if (scene?.scene.isActive()) gameStore.autoSave();
});

declare global { interface Window { __GENERATION_LEAGUE__?: Phaser.Game } }
window.__GENERATION_LEAGUE__ = game;
