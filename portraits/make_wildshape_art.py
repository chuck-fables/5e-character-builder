"""Download Wild Shape form art (from the SRD project) and pack it for the app.

    python3 portraits/make_wildshape_art.py

Saves 512px WebP copies to ~/Downloads/5e-builder-wildshapes/ and writes data/wildshape-art.json
(320px data URLs keyed by form id). Also includes the circle alternative forms (form-*.webp) found there."""
import base64, io, json, os, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.expanduser("~/Downloads/5e-builder-wildshapes")
os.makedirs(OUT_DIR, exist_ok=True)
forms = json.load(open(os.path.join(HERE, "..", "data", "srd", "wildshapes.json")))
for f in forms:
    path = os.path.join(OUT_DIR, f"{f['id']}.webp")
    if not os.path.exists(path) and f.get("image"):
        req = urllib.request.Request(f["image"], headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=60).read()
        Image.open(io.BytesIO(data)).convert("RGB").resize((512, 512), Image.LANCZOS).save(path, "WEBP", quality=78, method=6)
# Each beast form uses the same art as its Monster Manual entry (~/Downloads/5e-builder-monsters),
# so a druid turning into a Mastiff looks like the Mastiff in Resources. The older form art is only a fallback.
MONSTER_DIR = os.path.expanduser("~/Downloads/5e-builder-monsters")
def pack(path):
    img = Image.open(path).convert("RGB").resize((320, 320), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, "WEBP", quality=45, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
art, from_monster = {}, 0
for f in forms:
    mon = os.path.join(MONSTER_DIR, f"{f.get('monsterId') or f['id']}.webp")
    own = os.path.join(OUT_DIR, f"{f['id']}.webp")
    if os.path.exists(mon):
        art[f["id"]] = pack(mon); from_monster += 1
    elif os.path.exists(own):
        art[f["id"]] = pack(own)
# Every other Beast too (Circle of the Moon unlocks Beasts above CR 1)
for m in json.load(open(os.path.join(HERE, "..", "data", "srd", "monsters.json"))):
    mon = os.path.join(MONSTER_DIR, f"{m['id']}.webp")
    if m["type"] == "Beast" and m["id"] not in art and os.path.exists(mon):
        art[m["id"]] = pack(mon)
for name in sorted(os.listdir(OUT_DIR)):          # circle alternatives (Starry Form, Wrath of the Sea)
    if name.startswith("form-") and name.endswith(".webp"):
        art[name[:-5]] = pack(os.path.join(OUT_DIR, name))
print(f"{from_monster} of {len(forms)} beast forms use their Monster Manual art")
out = os.path.join(HERE, "..", "data", "wildshape-art.json")
json.dump(art, open(out, "w"), separators=(",", ":"))
print(f"{len(art)} form images -> data/wildshape-art.json ({os.path.getsize(out) / 1024 / 1024:.1f} MB)")
