import type Phaser from 'phaser';
import { OVERWORLD_CHARACTER_HEIGHT } from './display';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from './online/gameScale';

export const OVERWORLD_NAMEPLATE_OFFSET = OVERWORLD_CHARACTER_HEIGHT + 4;

export type WorldNameplate = {
  setDisplayName: (name: string) => void;
  setWorldPosition: (x: number, footY: number) => void;
  destroy: () => void;
};

let layer: HTMLElement | null = null;

function mountElement() {
  return document.getElementById('game-shell');
}

function ensureLayer() {
  if (layer) return layer;
  const mount = mountElement();
  if (!mount) throw new Error('Missing #game-frame mount for world nameplates');
  layer = document.createElement('div');
  layer.className = 'world-nameplates';
  layer.setAttribute('aria-hidden', 'true');
  mount.append(layer);
  return layer;
}

export function removeWorldNameplateLayer() {
  layer?.remove();
  layer = null;
}

export function projectWorldToDisplay(
  worldX: number,
  worldY: number,
  scrollX: number,
  scrollY: number,
  zoom: number,
  canvasRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  mountRect: Pick<DOMRect, 'left' | 'top'>,
) {
  const screenX = (worldX - scrollX) * zoom;
  const screenY = (worldY - scrollY) * zoom;
  const scaleX = canvasRect.width / INTERNAL_WIDTH;
  const scaleY = canvasRect.height / INTERNAL_HEIGHT;
  return {
    x: canvasRect.left - mountRect.left + screenX * scaleX,
    y: canvasRect.top - mountRect.top + screenY * scaleY,
  };
}

export function worldToViewport(scene: Phaser.Scene, worldX: number, worldY: number) {
  const camera = scene.cameras.main;
  const canvas = scene.game.canvas;
  const mount = mountElement();
  if (!mount) return { x: 0, y: 0 };

  return projectWorldToDisplay(
    worldX,
    worldY,
    camera.scrollX,
    camera.scrollY,
    camera.zoom,
    canvas.getBoundingClientRect(),
    mount.getBoundingClientRect(),
  );
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
    root.style.left = `${Math.round(x)}px`;
    root.style.top = `${Math.round(y)}px`;
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
