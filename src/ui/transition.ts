import Phaser from 'phaser';
import { gameStore } from '../state';

export function prefersReducedMotion(): boolean {
  return gameStore.save?.options.reducedMotion === true
    || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

export function fadeInContent(
  scene: Phaser.Scene,
  objects: Phaser.GameObjects.GameObject[],
  offsetY = 4,
): void {
  if (prefersReducedMotion()) return;
  objects.forEach((obj) => {
    if ('setAlpha' in obj && typeof (obj as Phaser.GameObjects.Text).setAlpha === 'function') {
      const target = obj as Phaser.GameObjects.Text & { y: number };
      const homeY = target.y;
      target.setAlpha(0);
      target.y = homeY + offsetY;
      scene.tweens.add({
        targets: target,
        alpha: 1,
        y: homeY,
        duration: 110,
        ease: 'Quad.Out',
      });
    }
  });
}

export function popModal(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha,
): void {
  if (prefersReducedMotion()) return;
  container.setScale(0.92).setAlpha(0);
  scene.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 100, ease: 'Back.Out' });
}
