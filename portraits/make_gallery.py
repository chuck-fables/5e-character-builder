"""Pack the portrait library into data/portraits.json for the app.

    python3 portraits/make_gallery.py

Reads ~/Downloads/hero-forge-portraits/p###-gender-race-class.webp, shrinks each one,
and stores it as a small WebP data URL with its tags. build.py embeds the result."""
import base64, io, json, os, sys
from PIL import Image

SIZE, QUALITY = 320, 45          # what goes into the HTML (the 512px originals stay in Downloads)
SRC = os.path.expanduser("~/Downloads/hero-forge-portraits")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "portraits.json")
CLASSES = {"barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue",
           "sorcerer", "warlock", "wizard", "artificer"}

items = []
for name in sorted(os.listdir(SRC)):
    if not name.endswith(".webp"):
        continue
    parts = name[:-5].split("-")
    pid, gender, cls, race = parts[0], parts[1], parts[-1], "-".join(parts[2:-1])
    if cls not in CLASSES or gender not in ("male", "female"):
        print("skip (unexpected name):", name); continue
    img = Image.open(os.path.join(SRC, name)).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, "WEBP", quality=QUALITY, method=6)
    items.append({"id": pid, "gender": gender, "race": race, "class": cls,
                  "src": "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()})
json.dump(items, open(OUT, "w"), separators=(",", ":"))
print(f"{len(items)} portraits -> data/portraits.json ({os.path.getsize(OUT) / 1024 / 1024:.1f} MB)")
