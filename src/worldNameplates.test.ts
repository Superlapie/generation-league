import { describe, expect, it } from 'vitest';
import { projectWorldToDisplay } from './worldNameplates';

function rect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height };
}

describe('projectWorldToDisplay', () => {
  it('maps world coordinates through camera zoom and css scale', () => {
    const point = projectWorldToDisplay(
      60,
      80,
      0,
      0,
      2,
      rect(0, 0, 960, 640),
      { left: 0, top: 0 },
    );
    expect(point.x).toBe(240);
    expect(point.y).toBe(320);
  });

  it('accounts for camera scroll and canvas offset inside the frame', () => {
    const point = projectWorldToDisplay(
      80,
      100,
      40,
      20,
      2,
      rect(40, 30, 480, 320),
      { left: 0, top: 0 },
    );
    expect(point.x).toBe(120);
    expect(point.y).toBe(190);
  });
});
