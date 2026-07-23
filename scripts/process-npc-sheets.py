from pathlib import Path
from PIL import Image

source_dir = Path('tmp/npc-sources')
output_dir = Path('public/assets/ninja-adventure/characters')
names = [
    'player-female', 'player-male', 'professor', 'assistant', 'healer',
    'merchant', 'elder', 'ranger', 'miner', 'rival',
]

for name in names:
    image = Image.open(source_dir / f'{name}.png').convert('RGBA')
    width, height = image.size
    sheet = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    frames = []
    bounds = []
    for row in range(4):
        for column in range(4):
            frame = image.crop((
                column * width // 4,
                row * height // 4,
                (column + 1) * width // 4,
                (row + 1) * height // 4,
            ))
            bbox = frame.getchannel('A').getbbox()
            if bbox is None:
                raise ValueError(f'{name}: frame {row},{column} has no opaque pixels')
            frames.append((row, column, frame))
            bounds.append(bbox)

    left = min(b[0] for b in bounds)
    top = min(b[1] for b in bounds)
    right = max(b[2] for b in bounds)
    bottom = max(b[3] for b in bounds)
    crop_width = right - left
    crop_height = bottom - top
    scale = min(29 / crop_height, 26 / crop_width)
    scaled_size = (max(1, round(crop_width * scale)), max(1, round(crop_height * scale)))

    for row, column, frame in frames:
        character = frame.crop((left, top, right, bottom)).resize(scaled_size, Image.Resampling.NEAREST)
        x = column * 32 + (32 - scaled_size[0]) // 2
        y = row * 32 + 31 - scaled_size[1]
        sheet.alpha_composite(character, (x, y))
    sheet.save(output_dir / f'{name}.png', optimize=True)
    print(f'wrote {output_dir / (name + ".png")}')
