import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('public/assets/creatures/expansion');
const ids = [
  'spriglet', 'rootusk', 'canopaw', 'sootsqueak', 'kilnibble', 'hearthare',
  'drizzlet', 'puddlefin', 'rainquill', 'breezlet', 'whifflit', 'galegale',
  'tangletoad', 'bogloom', 'mirebloom',
];

function pngSize(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.readUInt32BE(0) !== 0x89504e47 || bytes.readUInt32BE(4) !== 0x0d0a1a0a) throw new Error(`${file}: invalid PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

for (const id of ids) {
  const sheet = path.join(root, 'sheets', `${id}-battle-sheet.png`);
  const front = path.join(root, 'optimized', `${id}-front.png`);
  const back = path.join(root, 'optimized', `${id}-back.png`);
  for (const file of [sheet, front, back]) if (!fs.existsSync(file)) throw new Error(`Missing creature asset: ${file}`);
  const sheetSize = pngSize(sheet);
  const frontSize = pngSize(front);
  const backSize = pngSize(back);
  if (sheetSize.width !== 128 || sheetSize.height !== 64) throw new Error(`${id}: sheet must be 128x64`);
  if (frontSize.width !== 64 || frontSize.height !== 64 || backSize.width !== 64 || backSize.height !== 64) throw new Error(`${id}: runtime sprites must be 64x64`);
}

console.log(`Validated ${ids.length} expansion creature sheets and ${ids.length * 2} runtime views.`);
