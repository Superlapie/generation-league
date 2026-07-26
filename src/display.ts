import type Phaser from 'phaser';

/** 128px source frames rendered as 32px GBA-style cells (an exact 4:1 scale). */
export const OVERWORLD_CHARACTER_HEIGHT = 32;

export function overworldAvatarKey(avatar?: 'a' | 'b') {
  return `avatar-${avatar === 'b' ? 'b' : 'a'}`;
}

/** Camera for the 240x160 pixel world, displayed at an exact 2x scale. */
export function configureWorldCamera(scene: Phaser.Scene) {
  scene.cameras.main.setZoom(2).centerOn(120, 80).setRoundPixels(true);
}

/** Camera for native 480x320 interface work. Never use this for world sprites. */
export function configureUiCamera(scene: Phaser.Scene) {
  scene.cameras.main.setZoom(1).centerOn(240, 160).setRoundPixels(true);
}

/** @deprecated World-only compatibility alias. New UI must use configureUiCamera. */
export const configureGbaCamera = configureWorldCamera;

export function configureOverworldCharacter(sprite: Phaser.GameObjects.Sprite) {
  const { width, height } = sprite.frame;
  const displayHeight = OVERWORLD_CHARACTER_HEIGHT;
  const displayWidth = Math.round((width / height) * displayHeight);
  return sprite.setDisplaySize(displayWidth, displayHeight).setOrigin(0.5, 1);
}
