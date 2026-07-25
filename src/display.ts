import type Phaser from 'phaser';

/** 128px source frames rendered as 32px GBA-style cells (an exact 4:1 scale). */
export const OVERWORLD_CHARACTER_HEIGHT = 32;

export function configureGbaCamera(scene: Phaser.Scene) {
  scene.cameras.main.setZoom(2).centerOn(120, 80).setRoundPixels(true);
}

export function configureOverworldCharacter(sprite: Phaser.GameObjects.Sprite) {
  const { width, height } = sprite.frame;
  const displayHeight = OVERWORLD_CHARACTER_HEIGHT;
  const displayWidth = Math.round((width / height) * displayHeight);
  return sprite.setDisplaySize(displayWidth, displayHeight).setOrigin(0.5, 1);
}
