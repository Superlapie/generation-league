import type Phaser from 'phaser';

export function configureGbaCamera(scene: Phaser.Scene) {
  scene.cameras.main.setZoom(2).centerOn(120, 80).setRoundPixels(true);
}
