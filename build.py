#!/usr/bin/env python3
"""Build the single-file app.

    python3 build.py

Merges data/srd/*.json and data/wiki/*.json, checks the links between them,
and writes "dist/5e Character Builder [2024].html" (one file, works offline, no server).
"""
import glob
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
KINDS = ["classes", "subclasses", "species", "backgrounds", "feats", "spells", "options", "magic-items"]

# Book name → SRD name, where the SRD renamed a spell instead of just dropping the wizard's name.
SPELL_ALIASES = {
    "Bigby's Hand": "Arcane Hand",
    "Mordenkainen's Sword": "Arcane Sword",
    "Nystul's Magic Aura": "Arcanist's Magic Aura",
}


def slug(s):
    s = re.sub(r"['’]", "", str(s).lower())
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def wiki_files(kind):
    # e.g. subclasses-1.json, subclasses-artificer.json, subclasses-extra.json ("extra" last)
    files = glob.glob(os.path.join(ROOT, "data/wiki", f"{kind}*.json"))
    files += glob.glob(os.path.join(ROOT, "data/wiki", f"{kind[:-1]}*.json")) if kind == "options" else []
    files = sorted(set(files), key=lambda p: ("extra" in p, p))
    return [f for f in files if "spell-list" not in f]


def merge():
    data = {}
    for kind in KINDS:
        merged = {}
        for path in wiki_files(kind):           # wiki first, later files override earlier ones
            for x in load(path):
                if x.get("id"):
                    merged[x["id"]] = x
        srd_path = os.path.join(ROOT, "data/srd", f"{kind}.json")
        if os.path.exists(srd_path):             # SRD always wins: full licensed text
            for x in load(srd_path):
                merged[x["id"]] = x
        if os.path.exists(srd_path):
            # Drop wiki copies of SRD things that only differ by a wizard's name
            # ("Quaal's Feather Token" is the SRD's "Feather Token").
            srd_names = {x["name"].lower() for x in load(srd_path)}
            short = lambda n: re.sub(r"^[A-Z][a-z]+['’]s\s+", "", n).lower()
            merged = {k: x for k, x in merged.items()
                      if x.get("source") == "SRD 5.2" or (x["name"].lower() not in srd_names and short(x["name"]) not in srd_names)}
        data[kind] = sorted(merged.values(), key=lambda x: x.get("name", ""))
    data["equipment"] = load(os.path.join(ROOT, "data/srd/equipment.json"))
    extra_gear = os.path.join(ROOT, "data/extra-gear.json")
    if os.path.exists(extra_gear):  # consumables, ammunition, Spellbook… that starting gear refers to
        have = {g["name"] for g in data["equipment"]["gear"]}
        data["equipment"]["gear"] += [g for g in load(extra_gear) if g["name"] not in have]
        data["equipment"]["gear"].sort(key=lambda g: g["name"])

    # The SRD drops wizard names ("Tasha's Hideous Laughter" → "Hideous Laughter").
    # Rewrite spell references so either spelling finds the same spell.
    data["spells"] = [x for x in data["spells"] if x["name"] not in SPELL_ALIASES or x.get("source") == "SRD 5.2"]
    spell_ids = {x["id"]: x["name"] for x in data["spells"]}

    def canonical(name):
        name = SPELL_ALIASES.get(name, name)
        if slug(name) in spell_ids:
            return name
        short = re.sub(r"^[A-Z][a-z]+['’]s\s+", "", name)
        return spell_ids.get(slug(short), name)

    for s in data["subclasses"]:
        for lvl, names in (s.get("spells") or {}).items():
            s["spells"][lvl] = [canonical(n) for n in names]
    for sp in data["species"]:
        for m in [sp.get("spells") or {}] + [l.get("spells") or {} for l in (sp.get("lineages") or [])]:
            for lvl, names in m.items():
                m[lvl] = [canonical(n) for n in names]

    # Artificer spell list → add "artificer" to those spells
    art = os.path.join(ROOT, "data/wiki/artificer-spell-list.json")
    if os.path.exists(art):
        ids = set()
        alias_ids = {slug(k): slug(v) for k, v in SPELL_ALIASES.items()}
        for i in load(art):  # "melfs-acid-arrow" → "acid-arrow" when only the short id exists
            i = alias_ids.get(i, i)
            short = re.sub(r"^[a-z]+s-", "", i)
            ids.add(i if i in spell_ids or short not in spell_ids else short)
        missing = sorted(i for i in ids if i not in spell_ids)
        if missing:
            print("Artificer list spells not found:", ", ".join(missing))
        for sp in data["spells"]:
            sp["classes"] = sorted({c.lower() for c in sp.get("classes", [])})
            if sp["id"] in ids and "artificer" not in sp["classes"]:
                sp["classes"].append("artificer")
    # Reference data used as-is from the SRD export
    for key in ("monsters", "wildshapes", "rules"):
        path = os.path.join(ROOT, "data/srd", f"{key}.json")
        data[key] = load(path) if os.path.exists(path) else []
    for r in data["rules"]:  # the primer's last section describes the Craft app, not the game
        if r["id"] == "core-rules-primer":
            cut = r["text"].find("Level drives proficiency")
            if cut > 0:
                r["text"] = r["text"][: r["text"].rfind("\n#", 0, cut)].rstrip() if r["text"].rfind("\n#", 0, cut) > 0 else r["text"][:cut].rstrip()
    return data


def check(data):
    ids = {k: {x["id"] for x in data[k]} for k in KINDS}
    problems = []
    for b in data["backgrounds"]:
        if b.get("feat") and b["feat"] not in ids["feats"]:
            problems.append(f"background {b['id']}: feat '{b['feat']}' not found")
    for s in data["subclasses"]:
        if s.get("classId") not in ids["classes"]:
            problems.append(f"subclass {s['id']}: class '{s.get('classId')}' not found")
        for names in (s.get("spells") or {}).values():
            for n in names:
                if slug(n) not in ids["spells"]:
                    problems.append(f"subclass {s['id']}: spell '{n}' not found")
    for sp in data["species"]:
        maps = [sp.get("spells") or {}] + [l.get("spells") or {} for l in (sp.get("lineages") or [])]
        for m in maps:
            for names in m.values():
                for n in names:
                    if slug(n) not in ids["spells"]:
                        problems.append(f"species {sp['id']}: spell '{n}' not found")
    for c in data["classes"]:
        for key in ("cantrips", "prepared"):
            arr = (c.get("spellcasting") or {}).get(key)
            if arr is not None and len(arr) != 20:
                problems.append(f"class {c['id']}: spellcasting.{key} has {len(arr)} entries")
    return problems


def build():
    data = merge()
    problems = check(data)
    src = lambda name: open(os.path.join(ROOT, "src", name), encoding="utf-8").read()
    page = src("template.html")
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    page = page.replace("/*__DATA__*/", "window.DND_DATA = " + payload + ";")
    gallery = os.path.join(ROOT, "data", "portraits.json")
    portraits = load(gallery) if os.path.exists(gallery) else []
    page = page.replace("/*__PORTRAITS__*/", "window.PORTRAITS = " + json.dumps(portraits, separators=(",", ":")) + ";")
    art_path = os.path.join(ROOT, "data", "item-art.json")
    item_art = load(art_path) if os.path.exists(art_path) else {}
    page = page.replace("/*__ITEMART__*/", "window.ITEM_ART = " + json.dumps(item_art, separators=(",", ":")) + ";")
    page = page.replace("/*__ENGINE__*/", src("engine.js"))
    page = page.replace("/*__APP__*/", src("app.js") + "\n" + src("extras.js"))
    mon_path = os.path.join(ROOT, "data", "monster-art.json")
    mon_art = load(mon_path) if os.path.exists(mon_path) else {}
    page = page.replace("/*__MONART__*/", "window.MONSTER_ART = " + json.dumps(mon_art, separators=(",", ":")) + ";")
    ws_path = os.path.join(ROOT, "data", "wildshape-art.json")
    ws_art = load(ws_path) if os.path.exists(ws_path) else {}
    page = page.replace("/*__WSART__*/", "window.WILDSHAPE_ART = " + json.dumps(ws_art, separators=(",", ":")) + ";")
    head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n')
    # template starts with <title>/<style> (head content) then the body markup
    split = page.index('<div id="app">')
    html = head + page[:split] + "</head>\n<body>\n" + page[split:] + "\n</body>\n</html>\n"
    os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
    out = os.path.join(ROOT, "dist", "5e Character Builder [2024].html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    # GitHub Pages serves the docs/ folder
    os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
    with open(os.path.join(ROOT, "docs", "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    open(os.path.join(ROOT, "docs", ".nojekyll"), "w").close()
    artifact = os.path.join(ROOT, "dist", "artifact.html")
    with open(artifact, "w", encoding="utf-8") as f:
        f.write(page)

    print("Built", out, f"({os.path.getsize(out) / 1024:.0f} KB)")
    print(f"  portraits    {len(portraits)}")
    print(f"  item art     {len(item_art)}")
    print(f"  form art     {len(ws_art)}  monster art {len(mon_art)}")
    print(f"  monsters     {len(data['monsters'])}  wildshapes {len(data['wildshapes'])}  rules {len(data['rules'])}")
    for k in KINDS:
        print(f"  {k:12} {len(data[k])}")
    if problems:
        print(f"\n{len(problems)} link problems:")
        for p in problems[:60]:
            print("  -", p)


if __name__ == "__main__":
    build()
