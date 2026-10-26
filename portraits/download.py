"""Download finished portraits into ~/Downloads/hero-forge-portraits/ as 512x512 WebP.

    python3 download.py results-1.json

Names files like p001-male-tiefling-ranger.webp. Skips files that already exist."""
import io, json, os, sys, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.expanduser("~/Downloads/hero-forge-portraits")
os.makedirs(OUT, exist_ok=True)
jobs = {j["id"]: j for j in json.load(open(os.path.join(HERE, "prompts.json")))}
results = json.load(open(sys.argv[1]))
ok = bad = 0
for pid, url in sorted(results.items()):
    if not url.startswith("https://") or ".fal.media/" not in url:
        bad += 1; print("skip", pid, url[:60]); continue
    j = jobs[pid]
    path = os.path.join(OUT, f"{pid}-{j['gender']}-{j['race']}-{j['class']}.webp")
    if os.path.exists(path):
        ok += 1; continue
    data = urllib.request.urlopen(url, timeout=60).read()
    img = Image.open(io.BytesIO(data)).convert("RGB").resize((512, 512), Image.LANCZOS)
    img.save(path, "WEBP", quality=78, method=6)
    ok += 1
print(f"saved {ok}, skipped {bad} -> {OUT}")
