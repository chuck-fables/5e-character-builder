"""Pack item art into data/item-art.json for the app.

    python3 items/make_item_art.py

Reads ~/Downloads/5e-builder-items/<item-id>.webp (gear) and .../magic/<magic-id>.webp,
shrinks each to a small WebP data URL. Keys: gear by item id, magic items as "m:<id>"."""
import base64, io, json, os
from PIL import Image

SIZE, QUALITY = 144, 50
SRC = os.path.expanduser("~/Downloads/5e-builder-items")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "item-art.json")


def pack(path):
    img = Image.open(path).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, "WEBP", quality=QUALITY, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


art = {}
for folder, prefix in [(SRC, ""), (os.path.join(SRC, "magic"), "m:")]:
    if not os.path.isdir(folder):
        continue
    for name in sorted(os.listdir(folder)):
        if name.endswith(".webp"):
            art[prefix + name[:-5]] = pack(os.path.join(folder, name))
json.dump(art, open(OUT, "w"), separators=(",", ":"))
gear = sum(1 for k in art if not k.startswith("m:"))
print(f"{gear} gear + {len(art) - gear} magic images -> data/item-art.json ({os.path.getsize(OUT) / 1024 / 1024:.1f} MB)")
