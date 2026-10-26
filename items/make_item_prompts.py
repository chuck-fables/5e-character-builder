"""Make one image prompt per equipment item. Writes items/prompts.json and the runner batches.

Format: fantasy painterly anime, [item type], centered [item name], [facing], solid black background
Weapons face side profile; armor, shields and clothing face front; everything else has no direction."""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
eq = json.load(open(os.path.join(HERE, "..", "data", "srd", "equipment.json")))
SKIP = {"Feed (per day)", "Stabling (per day)"}             # services, not objects
CLOTHING = {"Clothes, Fine", "Clothes, Traveler's", "Costume", "Robe"}
RENAME = {"Ammunition": "arrows and crossbow bolts", "Book": "leather-bound book", "Map": "rolled map"}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r"['’]", "", s.lower())).strip("-")


def readable(name):
    if name in RENAME:
        return RENAME[name]
    name = re.sub(r"\s*\(.*?\)", "", name)                 # drop "(per day)" style notes
    if ", " in name:                                       # "Bottle, Glass" -> "glass bottle"
        head, tail = name.split(", ", 1)
        name = f"{tail} {head}"
    return re.sub(r"['’]", "", name).lower()


jobs = []
def add(item, kind, facing=None):
    if item["name"] in SKIP:
        return
    parts = ["fantasy painterly anime", kind, f"centered {readable(item['name'])}"]
    if facing:
        parts.append(facing)
    parts += ["no character, item only", "solid black background"]
    jobs.append({"id": slug(item["name"]), "name": item["name"], "prompt": ", ".join(parts)})

for w in eq["weapons"]:
    add(w, "fantasy weapon", "side profile")
for a in eq["armor"]:
    add(a, "fantasy shield" if a["category"] == "shield" else "fantasy armor", "front facing")
for g in eq["gear"]:
    if g["name"] in CLOTHING:
        add(g, "fantasy clothing", "front facing")
    elif g["name"].endswith("'s Pack"):
        add(g, "fantasy equipment pack")
    else:
        add(g, "fantasy item")
for t in eq["tools"]:
    add(t, "fantasy tools")

assert len({j["id"] for j in jobs}) == len(jobs)
json.dump(jobs, open(os.path.join(HERE, "prompts.json"), "w"), indent=1)

src = open(os.path.join(HERE, "..", "portraits", "runner.js")).read()
body = src[src.index("(async () => {"):]
half = (len(jobs) + 1) // 2
for n, batch in enumerate([jobs[:half], jobs[half:]], 1):
    js = "await " + body.replace("__KEY__", f"hf_items_{n}").replace("__JOBS__", json.dumps([{"id": j["id"], "prompt": j["prompt"]} for j in batch]))
    open(os.path.join(HERE, f"batch-{n}.js"), "w").write(js)
    print(f"batch-{n}.js: {len(batch)} items ({batch[0]['id']} … {batch[-1]['id']})")
print(len(jobs), "items")
for j in jobs[:2] + jobs[38:40] + [j for j in jobs if j["id"] in ("explorers-pack", "component-pouch", "clothes-fine", "thieves-tools", "bottle-glass")]:
    print(" ", j["prompt"])
