from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


def is_key_candidate(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, _ = pixel
    # The generator's magenta key can be softened by edge antialiasing. Keep
    # the test broad, but only remove pixels connected to the image boundary so
    # pink creature markings are never mistaken for the background.
    return r >= 150 and b >= 140 and g <= 165


def remove_edge_key(image: Image.Image) -> Image.Image:
    image = image.convert('RGBA')
    width, height = image.size
    pixels = image.load()
    background: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))

    while queue:
        x, y = queue.popleft()
        if (x, y) in background or not is_key_candidate(pixels[x, y]):
            continue
        background.add((x, y))
        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    for y in range(height):
        for x in range(width):
            r, g, b, _ = pixels[x, y]
            pixels[x, y] = (255, 0, 255, 0) if (x, y) in background else (r, g, b, 255)
    return image


def normalize_view(view: Image.Image) -> Image.Image:
    view = remove_edge_key(view)
    bbox = view.getchannel('A').getbbox()
    if bbox is None:
        raise ValueError('sprite view contains no opaque pixels')
    view = view.crop(bbox)
    scale = min(58 / view.width, 58 / view.height)
    size = (max(1, round(view.width * scale)), max(1, round(view.height * scale)))
    view = view.resize(size, Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', (64, 64), (255, 0, 255, 0))
    canvas.alpha_composite(view, ((64 - size[0]) // 2, (64 - size[1]) // 2))
    pixels = canvas.load()
    for y in range(64):
        for x in range(64):
            r, g, b, a = pixels[x, y]
            pixels[x, y] = (255, 0, 255, 0) if a < 128 or (r >= 235 and b >= 190 and g <= 40) else (r, g, b, 255)
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--id', required=True)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()

    source = remove_edge_key(Image.open(args.input))
    half = source.width // 2
    front = normalize_view(source.crop((0, 0, half, source.height)))
    back = normalize_view(source.crop((half, 0, half * 2, source.height)))
    (args.output / 'sheets').mkdir(parents=True, exist_ok=True)
    (args.output / 'optimized').mkdir(parents=True, exist_ok=True)
    sheet = Image.new('RGBA', (128, 64), (255, 0, 255, 0))
    sheet.alpha_composite(front, (0, 0))
    sheet.alpha_composite(back, (64, 0))
    sheet.save(args.output / 'sheets' / f'{args.id}-battle-sheet.png', optimize=True)
    front.save(args.output / 'optimized' / f'{args.id}-front.png', optimize=True)
    back.save(args.output / 'optimized' / f'{args.id}-back.png', optimize=True)


if __name__ == '__main__':
    main()
