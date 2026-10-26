"""Download finished monster art into ~/Downloads/5e-builder-monsters/<id>.webp (512x512).

    python3 download_monsters.py monster-results-1.json [--force]"""
import io, json, os, sys, urllib.request
from PIL import Image

OUT = os.path.expanduser("~/Downloads/5e-builder-monsters")
os.makedirs(OUT, exist_ok=True)
ok = bad = 0
for mid, url in sorted(json.load(open(sys.argv[1])).items()):
    if not url.startswith("https://") or ".fal.media/" not in url:
        bad += 1; print("skip", mid, url[:60]); continue
    path = os.path.join(OUT, f"{mid}.webp")
    if not os.path.exists(path) or "--force" in sys.argv:
        data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read()
        Image.open(io.BytesIO(data)).convert("RGB").resize((512, 512), Image.LANCZOS).save(path, "WEBP", quality=78, method=6)
    ok += 1
print(f"saved {ok}, skipped {bad} -> {OUT}")
