"""One art prompt per magic item (same format as the gear prompts), plus runner batches.

fantasy painterly anime, [item type], centered [item name], [facing], solid black background
Weapons: side profile. Armor, shields and worn clothing: front facing. Everything else: no direction."""
import json, os, re, glob

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
items = {}
for f in sorted(glob.glob(os.path.join(ROOT, "data/wiki/magic-items-*.json"))) + [os.path.join(ROOT, "data/srd/magic-items.json")]:
    for x in json.load(open(f)):
        items[x["id"]] = x                      # SRD last, so it wins
srd = {x["name"].lower() for x in json.load(open(os.path.join(ROOT, "data/srd/magic-items.json")))}
short = lambda n: re.sub(r"^[A-Z][a-z]+['’]s\s+", "", n).lower()
items = {k: x for k, x in items.items() if x.get("source") == "SRD 5.2" or (x["name"].lower() not in srd and short(x["name"]) not in srd)}

WORN = re.compile(r"\b(cloak|robe|boots|slippers|gloves|gauntlets|bracers|belt|hat|helm|circlet|cap|mantle|vestments|wraps|cape|mask|goggles|eyes of|headband|crown|armband)\b", re.I)
GLOW = {1: "faint blue glow", 2: "violet glow", 3: "radiant golden glow"}
WEAPON_WORDS = re.compile(r"\b(sword|blade|axe|bow|hammer|mace|dagger|spear|scimitar|rapier|trident|whip|club|staff|lance|pick|maul|glaive|halberd|flail|javelin|sling|crossbow|scythe|sickle|weapon|arrow|bolt)s?\b", re.I)


def subject(m):
    name = re.sub(r"['’]", "", m["name"]).lower()
    b = m.get("bonus") or 0
    if re.match(r"^\+\d (weapon|armor|shield|ammunition)$", name):
        kind = name.split()[1]
        thing = {"weapon": "longsword", "armor": "plate armor", "shield": "shield", "ammunition": "arrows"}[kind]
        return f"enchanted {thing} with {GLOW.get(b, 'faint blue glow')}"
    if m.get("baseKind") == "weapon" and not WEAPON_WORDS.search(name):
        base = (m.get("bases") or ["Longsword"])[0].lower() if len(m.get("bases") or []) <= 3 else "longsword"
        return f"{name} {base}"
    if m.get("baseKind") == "armor" and "armor" not in name and "mail" not in name and "plate" not in name:
        return f"{name} armor"
    return name


jobs = []
for m in sorted(items.values(), key=lambda x: x["name"]):
    cat = m.get("category", "Wondrous Item")
    if cat == "Weapon" or m.get("baseKind") == "weapon" and cat not in ("Staff",):
        kind, facing = "fantasy magic weapon", "side profile"
    elif cat == "Armor" or m.get("baseKind") == "armor":
        kind, facing = "fantasy magic armor", "front facing"
    elif cat == "Shield" or m.get("baseKind") == "shield":
        kind, facing = "fantasy magic shield", "front facing"
    elif cat == "Wondrous Item" and WORN.search(m["name"]):
        kind, facing = "fantasy magic clothing", "front facing"
    else:
        kind, facing = {"Potion": "fantasy potion", "Ring": "fantasy magic ring", "Rod": "fantasy magic rod", "Scroll": "fantasy spell scroll",
                        "Staff": "fantasy magic staff", "Wand": "fantasy magic wand", "Ammunition": "fantasy magic ammunition"}.get(cat, "fantasy wondrous item"), None
    parts = ["fantasy painterly anime", kind, f"centered {subject(m)}"] + ([facing] if facing else []) + ["no character, item only", "solid black background"]
    jobs.append({"id": m["id"], "name": m["name"], "prompt": ", ".join(parts)})

banned = ["feet", "foot", "leg", "pants", "full body"]
for j in jobs:
    if any(w in j["prompt"] for w in banned):
        print("note:", j["prompt"])
json.dump(jobs, open(os.path.join(HERE, "magic-prompts.json"), "w"), indent=1)
src = open(os.path.join(ROOT, "portraits", "runner.js")).read()
body = src[src.index("(async () => {"):]
n = 4
size = (len(jobs) + n - 1) // n
for k in range(n):
    batch = jobs[k * size:(k + 1) * size]
    js = "await " + body.replace("__KEY__", f"hf_magic_{k + 1}").replace("__JOBS__", json.dumps([{"id": j["id"], "prompt": j["prompt"]} for j in batch]))
    open(os.path.join(HERE, f"magic-batch-{k + 1}.js"), "w").write(js)
    print(f"magic-batch-{k + 1}.js: {len(batch)} ({batch[0]['id']} … {batch[-1]['id']})")
print(len(jobs), "magic items")
import random; random.seed(1)
for j in random.sample(jobs, 8): print(" ", j["prompt"])
for j in jobs:
    if j["id"] in ("plus-1-weapon", "plus-2-armor", "flame-tongue", "cloak-of-protection", "boots-of-speed", "potion-of-healing", "ring-of-protection"):
        print(" *", j["prompt"])
