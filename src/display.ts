import type Phaser from 'phaser';

/** 128px source frames rendered as 32px GBA-style cells (an exact 4:1 scale). */
export const OVERWORLD_CHARACTER_HEIGHT = 32;
export const OVERWORLD_NAMEPLATE_OFFSET = OVERWORLD_CHARACTER_HEIGHT + 2;

export type OverworldNameplate = {
  root: Phaser.GameObjects.Container;
  setDisplayName: (name: string) => void;
  setWorldPosition: (x: number, footY: number) => void;
  setDepth: (depth: number) => void;
  destroy: () => void;
};

export function overworldAvatarKey(avatar?: 'a' | 'b') {
  return `avatar-${avatar === 'b' ? 'b' : 'a'}`;
}

export function createOverworldNameplate(scene: Phaser.Scene, displayName: string): OverworldNameplate {
  const root = scene.add.container(0, 0);
  const text = scene.add.text(0, 0, '', {
    fontFamily: 'Arial, "Segoe UI", sans-serif',
    fontSize: '6px',
    color: '#b8c7ad',
    resolution: 2,
    stroke: '#101812',
    strokeThickness: 1,
  }).setOrigin(0.5, 1);
  root.add(text);
  root.setScale(0.45);

  const layout = (name: string) => {
    text.setText(name.trim().slice(0, 10) || 'Guest');
  };

  layout(displayName);

  return {
    root,
    setDisplayName: layout,
    setWorldPosition: (x, footY) => root.setPosition(Math.round(x), Math.round(footY - OVERWORLD_NAMEPLATE_OFFSET)),
    setDepth: (depth) => root.setDepth(depth),
    destroy: () => root.destroy(),
  };
}

export function configureGbaCamera(scene: Phaser.Scene) {
  scene.cameras.main.setZoom(2).centerOn(120, 80).setRoundPixels(true);
}

export function configureOverworldCharacter(sprite: Phaser.GameObjects.Sprite) {
  const { width, height } = sprite.frame;
  const displayHeight = OVERWORLD_CHARACTER_HEIGHT;
  const displayWidth = Math.round((width / height) * displayHeight);
  return sprite.setDisplaySize(displayWidth, displayHeight).setOrigin(0.5, 1);
}
