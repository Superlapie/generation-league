import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

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

function readRgbaPng(file) {
  const bytes = fs.readFileSync(file);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    if (type === 'IDAT') idat.push(data);
    offset += length + 12;
  }
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`${file}: expected 8-bit RGBA PNG`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const pixels = Buffer.alloc(width * height * bpp);
  let input = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[input++];
    const row = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[input++];
      const left = x >= bpp ? pixels[row + x - bpp] : 0;
      const up = y > 0 ? pixels[row - stride + x] : 0;
      const upLeft = y > 0 && x >= bpp ? pixels[row - stride + x - bpp] : 0;
      let reconstructed = value;
      if (filter === 1) reconstructed += left;
      else if (filter === 2) reconstructed += up;
      else if (filter === 3) reconstructed += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left); const pb = Math.abs(p - up); const pc = Math.abs(p - upLeft);
        reconstructed += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if (filter !== 0) throw new Error(`${file}: unsupported PNG filter ${filter}`);
      pixels[row + x] = reconstructed & 255;
    }
  }
  return { width, height, pixels };
}

function validatePixels(file) {
  const { width, height, pixels } = readRgbaPng(file);
  const alphaAt = (x, y) => pixels[(y * width + x) * 4 + 3];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const index = (y * width + x) * 4;
    const r = pixels[index]; const g = pixels[index + 1]; const b = pixels[index + 2]; const a = pixels[index + 3];
    if (a !== 0 && a !== 255) throw new Error(`${file}: semi-transparent pixel at ${x},${y}`);
    if (a && r === 255 && g === 0 && b === 255) throw new Error(`${file}: opaque chroma-key pixel at ${x},${y}`);
    const nearKey = a === 255 && r >= 235 && b >= 190 && g <= 40;
    if (nearKey) throw new Error(`${file}: residual magenta pixel at ${x},${y}`);
  }
  for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) if (alphaAt(x, y) !== 0) throw new Error(`${file}: opaque corner pixel`);
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
  for (const file of [sheet, front, back]) validatePixels(file);
}

console.log(`Validated ${ids.length} expansion creature sheets and ${ids.length * 2} runtime views.`);
