"""Make 400 portrait prompts: 65% male / 35% female, classic D&D races, every class.
Writes portraits/prompts.json. Prompts never mention feet, legs or lower clothing, so the
model keeps a three-quarters framing."""
import json, random

random.seed(2024)
TOTAL = 400
MALE = round(TOTAL * 0.65)

RACES = {  # race key: (count, how the race reads in the prompt)
    "human": 92, "elf": 48, "dwarf": 44, "halfling": 32, "gnome": 24, "half-elf": 32,
    "half-orc": 32, "tiefling": 36, "dragonborn": 28, "goliath": 16, "aasimar": 16,
}
CLASSES = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger",
           "rogue", "sorcerer", "warlock", "wizard", "artificer"]
COLORS = ["crimson", "dark green", "deep blue", "black", "brown leather", "grey", "white and gold", "purple",
          "teal", "rust red", "silver", "earth-toned", "midnight blue", "bronze", "forest green", "ivory"]
LENGTH = ["short", "long", "shoulder-length", "braided", "wavy", "curly", "tied-back", "messy", "cropped", "flowing"]
HAIR = {
    "human": ["black", "brown", "dark brown", "auburn", "blond", "red", "grey", "chestnut", "copper", "ash blond"],
    "half-elf": ["black", "brown", "auburn", "blond", "silver", "chestnut", "copper", "platinum blond"],
    "elf": ["silver", "platinum blond", "golden", "black", "auburn", "white", "copper", "pale blond", "dark brown"],
    "dwarf": ["red", "brown", "black", "grey", "ginger", "blond", "copper", "white"],
    "halfling": ["brown", "sandy", "chestnut", "auburn", "black", "honey blond"],
    "gnome": ["white", "ginger", "brown", "teal", "pink", "lavender", "copper", "silver"],
    "half-orc": ["black", "dark brown", "grey", "white", "brown"],
    "tiefling": ["black", "dark purple", "crimson", "white", "midnight blue", "dark red"],
    "goliath": ["black", "dark brown", "grey"],
    "aasimar": ["golden", "white", "silver", "auburn", "platinum blond", "black"],
}
EYES = {
    "default": ["brown", "blue", "green", "hazel", "grey", "amber", "dark brown", "light blue"],
    "elf": ["green", "violet", "silver", "blue", "amber", "gold"],
    "tiefling": ["solid gold", "solid red", "glowing amber", "solid silver", "violet"],
    "dragonborn": ["gold", "amber", "red", "green", "silver", "copper"],
    "aasimar": ["glowing silver", "glowing gold", "pale blue", "luminous amber"],
    "gnome": ["bright blue", "green", "amber", "violet", "hazel"],
    "half-orc": ["brown", "amber", "yellow", "grey", "dark brown"],
}
DRAGON = ["red", "blue", "green", "black", "white", "gold", "silver", "bronze", "brass", "copper"]
TIEF_SKIN = ["red", "purple", "deep blue", "lavender", "crimson", "ash grey"]
HORNS = ["curved horns", "ram horns", "swept-back horns", "tall straight horns"]


def race_text(race, g):
    if race == "tiefling":
        return f"tiefling with {random.choice(TIEF_SKIN)} skin and {random.choice(HORNS)}"
    if race == "dragonborn":
        return f"dragonborn with {random.choice(DRAGON)} scales"
    if race == "half-orc":
        return f"half-orc with {random.choice(['grey-green', 'olive green', 'grey', 'mossy green'])} skin and small tusks"
    if race == "goliath":
        return "goliath with grey stone-marked skin"
    if race == "aasimar":
        return "aasimar with a faint radiant glow"
    if race == "elf":
        return random.choice(["elf", "high elf", "wood elf", "drow elf with dark grey skin"]) if g == "male" else random.choice(["elf", "high elf", "wood elf", "drow elf with dark grey skin"])
    if race == "halfling":
        return "halfling"
    return race


def hair_text(race, g):
    if race == "dragonborn":
        return random.choice(["swept-back horns and a scaled crest", "short horns and a frilled crest", "long backswept horns"])
    if race == "goliath":
        return random.choice(["bald head", "shaved head", "short dark hair", "long black braid"])
    if race == "half-orc" and random.random() < 0.3:
        return random.choice(["shaved head", "black topknot", "mohawk"])
    length = random.choice(LENGTH)
    color = random.choice(HAIR[race])
    text = f"{length} {color} hair"
    if g == "male" and race in ("dwarf",):
        text += f" and {random.choice(['a braided', 'a long', 'a thick', 'a forked'])} {color} beard"
    elif g == "male" and race in ("human", "half-elf", "half-orc") and random.random() < 0.3:
        text += random.choice([" and a short beard", " and stubble", " and a trimmed beard"])
    return text


races = [r for r, n in RACES.items() for _ in range(n)]
assert len(races) == TOTAL, len(races)
genders = ["male"] * MALE + ["female"] * (TOTAL - MALE)
random.shuffle(races); random.shuffle(genders)
classes = (CLASSES * (TOTAL // len(CLASSES) + 1))[:TOTAL]
random.shuffle(classes)

jobs = []
for i, (race, g, cls) in enumerate(zip(races, genders, classes), start=1):
    eyes = random.choice(EYES.get(race, EYES["default"]))
    clothing = f"{random.choice(COLORS)} {cls} garments"
    prompt = ", ".join(["fantasy painterly anime", "three quarters portrait", "centered character", "front facing",
                        g, race_text(race, g), hair_text(race, g), f"{eyes} eyes", clothing, "thematic background"])
    jobs.append({"id": f"p{i:03d}", "gender": g, "race": race, "class": cls, "prompt": prompt})

banned = ["feet", "foot", "boot", "leg", "pants", "trouser", "skirt", "full body", "shoe"]
assert not [j for j in jobs if any(b in j["prompt"] for b in banned)]
json.dump(jobs, open("prompts.json", "w"), indent=1)
from collections import Counter
print(Counter(j["gender"] for j in jobs), Counter(j["race"] for j in jobs).most_common(), sep="\n")
for j in jobs[:4]: print(j["prompt"])
