/** Logical UI coordinate system — 240×160 at camera zoom 2 over 480×320 canvas. */

export const LOGIC_W = 240;
export const LOGIC_H = 160;

export const HEADER_Y = 0;
export const HEADER_H = 22;
export const CONTENT_Y = 23;
export const CONTENT_H = 119;
export const HELP_Y = 143;
export const HELP_H = 17;

export const ROOT_PASSPORT = { x: 6, y: 25, w: 72, h: 108 };
export const ROOT_GRID = { x: 82, y: 25, w: 152, h: 108, cols: 2, rows: 4 };

export const BAG_POCKETS_Y = 24;
export const BAG_LIST = { x: 5, y: 40, w: 112, h: 98 };
export const BAG_DETAIL = { x: 120, y: 40, w: 115, h: 98 };

export const BATTLE_DIALOGUE = { x: 3, y: 113, w: 234, h: 44 };
export const BATTLE_CMD_GRID = { x: 6, y: 116, w: 228, h: 42, cols: 2, rows: 2 };

export function gridCell(
  area: { x: number; y: number; w: number; h: number; cols: number; rows: number },
  index: number,
  gap = 3,
): { x: number; y: number; w: number; h: number } {
  const col = index % area.cols;
  const row = Math.floor(index / area.cols);
  const cellW = Math.floor((area.w - gap * (area.cols - 1)) / area.cols);
  const cellH = Math.floor((area.h - gap * (area.rows - 1)) / area.rows);
  return {
    x: area.x + col * (cellW + gap),
    y: area.y + row * (cellH + gap),
    w: cellW,
    h: cellH,
  };
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

export function pageWindow(selected: number, total: number, visible: number): { start: number; end: number } {
  if (total <= visible) return { start: 0, end: total };
  const start = Math.min(Math.max(0, selected - Math.floor(visible / 2)), total - visible);
  return { start, end: start + visible };
}
