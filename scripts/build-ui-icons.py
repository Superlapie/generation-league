"""Slice the approved ImageGen sheets into compact, transparent runtime icons."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art" / "ui-icons"
OUTPUT = ROOT / "public" / "assets" / "ui" / "icons"

SHEETS = {
    "core-transparent.png": [
        "creatures", "bag", "guide", "card",
        "link", "account", "save", "options",
        "fight", "battle-bag", "party", "run",
        "move-physical", "move-special", "move-status", "medicine",
    ],
    "system-transparent.png": [
        "capture", "held", "key", "seen",
        "caught", "unknown", "warning", "success",
        "empty", "crest-empty", "crest-filled",
    ],
}


def fit_icon(cell: Image.Image, size: int = 64, art_size: int = 56) -> Image.Image:
    alpha = cell.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        return Image.new("RGBA", (size, size))
    art = cell.crop(bounds)
    art.thumbnail((art_size, art_size), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (size, size))
    result.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for sheet_name, names in SHEETS.items():
        sheet = Image.open(SOURCE / sheet_name).convert("RGBA")
        for index, name in enumerate(names):
            column, row = index % 4, index // 4
            box = (
                round(column * sheet.width / 4),
                round(row * sheet.height / 4),
                round((column + 1) * sheet.width / 4),
                round((row + 1) * sheet.height / 4),
            )
            fit_icon(sheet.crop(box)).save(OUTPUT / f"{name}.png", optimize=True)
    print(f"Built {sum(map(len, SHEETS.values()))} UI icons in {OUTPUT}")


if __name__ == "__main__":
    main()
