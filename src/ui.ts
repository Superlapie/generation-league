import Phaser from 'phaser';

export const COLORS = { ink: 0x182017, paper: 0xf1f1d0, cream: 0xd7ddb8, dark: 0x293828, border: 0x59684f, accent: 0xb9ca68, red: 0xb74635, blue: 0x56868d };
export const textStyle = (size = 8, color = '#182017'): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'Arial, "Segoe UI", sans-serif',
  fontSize: `${Math.max(7, size)}px`,
  fontStyle: size <= 8 ? 'bold' : 'normal',
  color,
  resolution: 4,
  lineSpacing: 1,
});

export function panel(scene: Phaser.Scene, x: number, y: number, width: number, height: number, fill = COLORS.paper, depth = 20) {
  const graphics = scene.add.graphics().setDepth(depth);
  graphics.fillStyle(0x101610, .38).fillRect(x + 2, y + 2, width, height);
  graphics.fillStyle(COLORS.dark).fillRect(x, y, width, height);
  graphics.fillStyle(COLORS.cream).fillRect(x + 2, y + 2, width - 4, height - 4);
  graphics.fillStyle(fill).fillRect(x + 4, y + 4, width - 8, height - 8);
  return graphics;
}

export function label(scene: Phaser.Scene, x: number, y: number, value: string, size = 8, color = '#182017', depth = 21) {
  return scene.add.text(x, y, value, textStyle(size, color)).setDepth(depth).setOrigin(0, 0);
}

export function button(scene: Phaser.Scene, x: number, y: number, width: number, value: string, onClick: () => void, depth = 30) {
  const bg = scene.add.rectangle(x, y, width, 16, COLORS.dark).setOrigin(0).setDepth(depth).setInteractive({ useHandCursor: true });
  const text = label(scene, x + 5, y + 4, value, 8, '#f1f1d0', depth + 1);
  bg.on('pointerover', () => bg.setFillStyle(COLORS.border)).on('pointerout', () => bg.setFillStyle(COLORS.dark)).on('pointerdown', onClick);
  return { bg, text, setSelected(selected: boolean) { bg.setFillStyle(selected ? COLORS.blue : COLORS.dark); text.setColor(selected ? '#ffffff' : '#f1f1d0'); } };
}

export function hpColor(ratio: number) { return ratio > .5 ? 0x5ca85c : ratio > .2 ? 0xd2a73d : 0xb74635; }
