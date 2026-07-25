import type Phaser from 'phaser';
import { OVERWORLD_CHARACTER_HEIGHT } from './display';

export const OVERWORLD_NAMEPLATE_OFFSET = OVERWORLD_CHARACTER_HEIGHT + 4;

export type WorldNameplate = {
  setDisplayName: (name: string) => void;
  setWorldPosition: (x: number, footY: number) => void;
  destroy: () => void;
};

let layer: HTMLElement | null = null;

function ensureLayer() {
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'world-nameplates';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  return layer;
}

export function removeWorldNameplateLayer() {
  layer?.remove();
  layer = null;
}

export function worldToViewport(scene: Phaser.Scene, worldX: number, worldY: number) {
  const camera = scene.cameras.main;
  const canvas = scene.game.canvas;
  const rect = canvas.getBoundingClientRect();
  const screenX = (worldX - camera.scrollX) * camera.zoom;
  const screenY = (worldY - camera.scrollY) * camera.zoom;
  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;
  return {
    x: rect.left + screenX * scaleX,
    y: rect.top + screenY * scaleY,
  };
}

export function createWorldNameplate(scene: Phaser.Scene, displayName: string): WorldNameplate {
  const root = document.createElement('span');
  root.className = 'world-nameplate';
  ensureLayer().append(root);

  let worldX = 0;
  let footY = 0;

  const layout = (name: string) => {
    root.textContent = name.trim().slice(0, 12) || 'Guest';
  };

  const reposition = () => {
    const { x, y } = worldToViewport(scene, worldX, footY - OVERWORLD_NAMEPLATE_OFFSET);
    root.style.left = `${x}px`;
    root.style.top = `${y}px`;
  };

  layout(displayName);
  reposition();

  return {
    setDisplayName: layout,
    setWorldPosition: (x, fy) => {
      worldX = x;
      footY = fy;
      reposition();
    },
    destroy: () => root.remove(),
  };
}
