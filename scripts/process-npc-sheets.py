from pathlib import Path
from PIL import Image

source_dir = Path('tmp/npc-sources')
output_dir = Path('public/assets/ninja-adventure/characters')
names = [
    'player-female', 'player-male', 'professor', 'assistant', 'healer',
    'merchant', 'elder', 'ranger', 'miner',
]

for name in names:
    image = Image.open(source_dir / f'{name}.png').convert('RGBA')
    width, height = image.size
    sheet = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for row in range(4):
        for column in range(4):
            frame = image.crop((
                column * width // 4,
                row * height // 4,
                (column + 1) * width // 4,
                (row + 1) * height // 4,
            )).resize((16, 16), Image.Resampling.LANCZOS)
            sheet.alpha_composite(frame, (column * 16, row * 16))
    sheet.save(output_dir / f'{name}.png', optimize=True)
    print(f'wrote {output_dir / (name + ".png")}')
