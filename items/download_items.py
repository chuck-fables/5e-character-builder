"""Download finished item images into ~/Downloads/5e-builder-items/ as 512x512 WebP named by item.

    python3 download_items.py results-1.json
    python3 download_items.py magic-results-1.json --magic   (magic items go in a "magic" subfolder)"""
import io, json, os, sys, urllib.request
from PIL import Image

OUT = os.path.expanduser("~/Downloads/5e-builder-items")
if "--magic" in sys.argv:
    OUT = os.path.join(OUT, "magic")
os.makedirs(OUT, exist_ok=True)
ok = bad = 0
for iid, url in sorted(json.load(open(sys.argv[1])).items()):
    if not url.startswith("https://") or ".fal.media/" not in url:
        bad += 1; print("skip", iid, url[:60]); continue
    path = os.path.join(OUT, f"{iid}.webp")
    if not os.path.exists(path) or "--force" in sys.argv:
        data = urllib.request.urlopen(url, timeout=60).read()
        Image.open(io.BytesIO(data)).convert("RGB").resize((512, 512), Image.LANCZOS).save(path, "WEBP", quality=78, method=6)
    ok += 1
print(f"saved {ok}, skipped {bad} -> {OUT}")
