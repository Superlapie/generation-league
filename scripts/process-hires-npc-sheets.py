"""Pack generated 1024x1024 NPC sheets into crisp transparent 512x512 game sheets."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

SOURCE_DIR = Path('public/assets/characters/hires')
OUTPUT_DIR = Path('public/assets/characters')
NAMES = [
    'player-female', 'player-male', 'professor', 'assistant', 'healer',
    'merchant', 'elder', 'ranger', 'miner', 'rival',
]
CELL = 256
FRAME = 128
MARGIN = 16
MAX_CONTENT = FRAME - MARGIN * 2


def key_black(image: Image.Image) -> Image.Image:
    image = image.convert('RGBA')
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if r <= 18 and g <= 18 and b <= 18:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                pixels[x, y] = (r, g, b, 255)
    return image


def occupied_runs(occupied: list[bool], minimum: int = 16) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start: int | None = None
    for index, has_pixels in enumerate(occupied + [False]):
        if has_pixels and start is None:
            start = index
        elif not has_pixels and start is not None:
            if index - start >= minimum:
                runs.append((start, index))
            start = None
    return runs


def row_views(row: Image.Image) -> list[Image.Image]:
    """Extract the four silhouettes from a row, even when they cross 256px guides."""
    width, height = row.size
    pixels = row.load()
    occupied = [any(pixels[x, y][3] for y in range(height)) for x in range(width)]
    runs = occupied_runs(occupied)
    if len(runs) != 4:
        raise ValueError(f'expected 4 character silhouettes, found {len(runs)}')

    views: list[Image.Image] = []
    for left, right in runs:
        view = row.crop((left, 0, right, height))
        bbox = view.getchannel('A').getbbox()
        if bbox is None:
            raise ValueError('character silhouette is empty')
        views.append(view.crop(bbox))
    return views


def pack_view(view: Image.Image, scale: float) -> Image.Image:
    size = (max(1, round(view.width * scale)), max(1, round(view.height * scale)))
    if size[0] > MAX_CONTENT or size[1] > MAX_CONTENT:
        shrink = min(MAX_CONTENT / size[0], MAX_CONTENT / size[1])
        size = (max(1, round(size[0] * shrink)), max(1, round(size[1] * shrink)))
    scaled = view.resize(size, Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
    x = (FRAME - size[0]) // 2
    y = FRAME - MARGIN - size[1]
    x = min(max(MARGIN, x), FRAME - MARGIN - size[0])
    y = min(max(MARGIN, y), FRAME - MARGIN - size[1])
    canvas.alpha_composite(scaled, (x, y))
    return canvas


def assert_clean_frame(frame: Image.Image, label: str) -> None:
    bbox = frame.getchannel('A').getbbox()
    if bbox is None:
        raise ValueError(f'{label}: empty frame')
    left, top, right, bottom = bbox
    if left < MARGIN or top < MARGIN or right > FRAME - MARGIN or bottom > FRAME - MARGIN:
        raise ValueError(f'{label}: clips margin bbox={bbox}')

    pixels = frame.load()
    width, height = frame.size
    opaque = sum(1 for p in frame.getdata() if p[3] > 0)
    start = next(((x, y) for y in range(height) for x in range(width) if pixels[x, y][3] > 0), None)
    if start is None:
        raise ValueError(f'{label}: empty')
    visited = [[False] * width for _ in range(height)]
    queue: deque[tuple[int, int]] = deque([start])
    visited[start[1]][start[0]] = True
    count = 0
    while queue:
        x, y = queue.popleft()
        count += 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height:
                continue
            if visited[ny][nx] or pixels[nx, ny][3] == 0:
                continue
            visited[ny][nx] = True
            queue.append((nx, ny))
    if count < opaque * 0.85:
        print(f'  warn {label}: weak connectivity opaque={opaque} main={count}')
        return


def process(name: str) -> None:
    source = key_black(Image.open(SOURCE_DIR / f'{name}.png'))
    if source.size != (1024, 1024):
        raise ValueError(f'{name}: expected 1024x1024, got {source.size}')

    views: list[Image.Image | None] = []
    occupied_y = [any(source.getpixel((x, y))[3] for x in range(source.width)) for y in range(source.height)]
    rows = occupied_runs(occupied_y, minimum=32)
    if len(rows) != 4:
        raise ValueError(f'{name}: expected 4 character rows, found {len(rows)}')
    for top, bottom in rows:
        views.extend(row_views(source.crop((0, top, source.width, bottom))))

    usable = [view for view in views if view is not None]
    if not usable:
        raise ValueError(f'{name}: no opaque content')

    # Scale from the cleanest down-facing frames so side bleed can't dominate size.
    down_views = [view for view in views[0:4] if view is not None]
    basis = down_views if down_views else usable
    max_w = max(view.width for view in basis)
    max_h = max(view.height for view in basis)
    scale = min(MAX_CONTENT / max_w, MAX_CONTENT / max_h) * 0.92

    packed: list[Image.Image] = []
    for index, view in enumerate(views):
        if view is None:
            packed.append(Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0)))
        else:
            frame = pack_view(view, scale)
            assert_clean_frame(frame, f'{name} frame {index}')
            packed.append(frame)

    sheet = Image.new('RGBA', (FRAME * 4, FRAME * 4), (0, 0, 0, 0))
    for index, frame in enumerate(packed):
        row, column = divmod(index, 4)
        sheet.alpha_composite(frame, (column * FRAME, row * FRAME))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet.save(OUTPUT_DIR / f'{name}.png', optimize=True)
    print(f'wrote {OUTPUT_DIR / (name + ".png")} scale={scale:.4f}')


def main() -> None:
    for name in NAMES:
        process(name)


if __name__ == '__main__':
    main()
