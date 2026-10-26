"""Pack monster art into data/monster-art.json (small WebP data URLs keyed by monster id).

    python3 portraits/make_monster_art.py"""
import base64, io, json, os
from PIL import Image

SIZE, QUALITY = 224, 45
SRC = os.path.expanduser("~/Downloads/5e-builder-monsters")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "monster-art.json")
art = {}
for name in sorted(os.listdir(SRC)) if os.path.isdir(SRC) else []:
    if name.endswith(".webp"):
        img = Image.open(os.path.join(SRC, name)).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
        buf = io.BytesIO(); img.save(buf, "WEBP", quality=QUALITY, method=6)
        art[name[:-5]] = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
json.dump(art, open(OUT, "w"), separators=(",", ":"))
print(f"{len(art)} monster images -> data/monster-art.json ({os.path.getsize(OUT) / 1024 / 1024:.1f} MB)")
