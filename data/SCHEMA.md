# Data format for the D&D 2024 Character Creator

Every data file is a JSON **array** of objects (except `equipment.json`, see below).
The app merges `data/srd/*.json` and `data/wiki/*.json`. When two entries share an `id`, the SRD one wins.

## Conventions
- `id`: lowercase kebab-case of the name (`"path-of-the-zealot"`, `"magic-initiate"`, `"fireball"`).
  Subclass ids are prefixed with the class id: `"barbarian-path-of-the-zealot"`.
- `source`: `"SRD 5.2"` for SRD content, otherwise the book name as the wiki gives it
  (`"Player's Handbook"`, `"Eberron: Forge of the Artificer"`, `"Forgotten Realms: Heroes of Faerûn"`, ...).
  Skip Unearthed Arcana and homebrew entirely.
- Abilities are always the short codes `"str" "dex" "con" "int" "wis" "cha"`.
- Skills use the standard names: `"Acrobatics" "Animal Handling" "Arcana" "Athletics" "Deception" "History" "Insight"
  "Intimidation" "Investigation" "Medicine" "Nature" "Perception" "Performance" "Persuasion" "Religion"
  "Sleight of Hand" "Stealth" "Survival"`.
- "By level" arrays always have **20 numbers**, index 0 = level 1. Use 0 where the feature isn't available yet.
- `text` fields are Markdown.

## Text rule (important)
- **SRD content** (from the local SRD project): copy the full text, since it is CC-BY-4.0.
- **Non-SRD content** (from the wiki): copy names, numbers, levels, dice, ranges, durations, prerequisites and lists
  exactly. Write every `text` in your **own words**: a short summary (1–3 sentences) of what the feature or spell
  does mechanically. Never paste or closely paraphrase the book wording. Include the numbers a player needs at
  the table (damage dice, DCs, uses, range).

---

## classes.json
```json
{
  "id": "fighter", "name": "Fighter", "source": "SRD 5.2",
  "description": "One line in own words.",
  "hitDie": 10,
  "primaryAbility": ["str", "dex"],
  "saves": ["str", "con"],
  "skills": { "choose": 2, "from": ["Acrobatics", "Athletics"] },
  "weapons": "Simple and Martial weapons",
  "armor": "Light, Medium, and Heavy armor and Shields",
  "tools": "",
  "equipment": [
    { "option": "A", "items": ["Chain Mail", "Greatsword", "Flail", "8 Javelins", "Dungeoneer's Pack"], "gp": 4 },
    { "option": "B", "items": ["Studded Leather Armor", "Scimitar", "Shortsword", "Longbow", "20 Arrows", "Quiver", "Dungeoneer's Pack"], "gp": 11 },
    { "option": "C", "items": [], "gp": 155 }
  ],
  "subclassLevel": 3,
  "asiLevels": [4, 8, 12, 16],
  "epicBoonLevel": 19,
  "spellcasting": null,
  "weaponMastery": [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,6,6,6,6,6],
  "resources": [
    { "key": "second-wind", "name": "Second Wind", "recharge": "short", "max": [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4] }
  ],
  "features": [ { "level": 1, "name": "Second Wind", "text": "..." } ],
  "multiclass": { "prereq": "Strength or Dexterity 13", "gains": "Martial weapons, Light and Medium armor, Shields" }
}
```
- `resources[].recharge`: `"short"` (refills on Short or Long Rest), `"long"`, or `"special"`.
  `max` may be the string `"cha"`/`"wis"`/... to mean "equal to that ability modifier (min 1)", or `"pb"` for proficiency bonus.
- `spellcasting` for casters:
```json
{ "ability": "wis", "progression": "full", "cantrips": [3,3,3,4,...], "prepared": [4,5,6,7,...], "ritual": true, "focus": "Holy Symbol" }
```
  `progression` is `"full"`, `"half"`, `"third"` or `"pact"`. The app computes spell slots from the progression.

## subclasses.json
```json
{
  "id": "fighter-battle-master", "classId": "fighter", "name": "Battle Master", "source": "Player's Handbook",
  "description": "One line in own words.",
  "features": [ { "level": 3, "name": "Combat Superiority", "text": "..." } ],
  "spells": { "3": ["Bless", "Cure Wounds"], "5": ["..."] },
  "spellcasting": null,
  "resources": [ { "key": "superiority-dice", "name": "Superiority Dice (d8)", "recharge": "short", "max": [0,0,4,...] } ]
}
```
- `spells` = always-prepared subclass spells by the class level they unlock (omit or `{}` if none).
- `spellcasting` only for subclasses that add casting to a non-caster (Eldritch Knight, Arcane Trickster):
  same shape as the class one, with `"progression": "third"`.

## species.json
```json
{
  "id": "tiefling", "name": "Tiefling", "source": "SRD 5.2",
  "creatureType": "Humanoid", "size": ["Small", "Medium"], "speed": 30, "darkvision": 60,
  "traits": [ { "name": "Otherworldly Presence", "text": "..." } ],
  "lineages": [
    { "name": "Infernal", "text": "Resistance to Fire damage; you know Fire Bolt.",
      "spells": { "1": ["Fire Bolt"], "3": ["Hellish Rebuke"], "5": ["Darkness"] } }
  ],
  "spellAbilityChoice": ["int", "wis", "cha"]
}
```
- `lineages` is `null` when the species has no lineage/legacy/ancestry choice. Dragonborn ancestries,
  Elf lineages, Gnome lineages, Goliath giant ancestries and Tiefling legacies all go in `lineages`.
- `spellAbilityChoice` is `null` when the species grants no spells.

## backgrounds.json
```json
{
  "id": "acolyte", "name": "Acolyte", "source": "SRD 5.2",
  "abilities": ["int", "wis", "cha"],
  "feat": "magic-initiate-cleric",
  "skills": ["Insight", "Religion"],
  "tool": "Calligrapher's Supplies",
  "equipment": [ { "option": "A", "items": ["Calligrapher's Supplies", "Book (prayers)", "Holy Symbol", "Parchment (10 sheets)", "Robe"], "gp": 8 },
                 { "option": "B", "items": [], "gp": 50 } ],
  "text": "Short flavour line."
}
```
- `feat` is a feat `id`. Magic Initiate variants use `magic-initiate-cleric`, `magic-initiate-wizard`, etc.

## feats.json
```json
{
  "id": "great-weapon-master", "name": "Great Weapon Master", "source": "Player's Handbook",
  "category": "general",
  "prereq": { "level": 4, "text": "Level 4+, Strength 13+" },
  "repeatable": false,
  "asi": { "from": ["str"], "amount": 1 },
  "text": "..."
}
```
- `category`: `"origin"`, `"general"`, `"fighting-style"`, `"epic-boon"`.
- `prereq` is `null` when there is none. `asi` is `null` when the feat gives no ability increase.
  Ability Score Improvement itself: `{ "from": ["str","dex","con","int","wis","cha"], "amount": 2, "split": true }`.

## spells.json
```json
{
  "id": "fireball", "name": "Fireball", "source": "SRD 5.2",
  "level": 3, "school": "Evocation",
  "castingTime": "Action", "ritual": false,
  "range": "150 feet",
  "components": "V, S, M (a ball of bat guano and sulfur)",
  "duration": "Instantaneous", "concentration": false,
  "classes": ["sorcerer", "wizard"],
  "text": "...",
  "higherLevels": "..."
}
```
- `level` 0 = cantrip. `classes` are class ids. `higherLevels` is `""` when none.

## options.json (class option lists)
```json
{ "id": "agonizing-blast", "type": "invocation", "classId": "warlock", "name": "Agonizing Blast",
  "source": "Player's Handbook", "prereq": "Level 2+, a Warlock cantrip that deals damage", "repeatable": true, "text": "..." }
```
- `type`: `"invocation"`, `"metamagic"`, `"maneuver"`, `"other"`.

## equipment.json (an object, not an array)
```json
{
  "weapons": [ { "name": "Longsword", "category": "martial", "kind": "melee", "damage": "1d8", "damageType": "Slashing",
                 "properties": ["Versatile (1d10)"], "mastery": "Sap", "weight": 3, "cost": "15 GP" } ],
  "armor": [ { "name": "Chain Mail", "category": "heavy", "baseAC": 16, "dexCap": 0, "strength": 13,
               "stealthDisadvantage": true, "weight": 55, "cost": "75 GP" } ],
  "gear":  [ { "name": "Rope", "cost": "1 GP", "weight": 5, "text": "..." } ],
  "tools": [ { "name": "Thieves' Tools", "ability": "dex", "cost": "25 GP", "weight": 1 } ]
}
```
- Armor `category`: `"light"` (`dexCap: null` = full Dex), `"medium"` (`dexCap: 2`), `"heavy"` (`dexCap: 0`), `"shield"` (`baseAC: 2`).

## magic-items.json
```json
{
  "id": "flame-tongue", "name": "Flame Tongue", "source": "SRD 5.2",
  "category": "Weapon",
  "rarity": "Rare",
  "attunement": true,
  "baseKind": "weapon",
  "bases": [],
  "bonus": 0,
  "text": "..."
}
```
- One entry per item, NOT per base item. The SRD lists "+1 Longsword", "+1 Shortsword", … separately; collapse those into
  one "+1 Weapon" entry (`baseKind: "weapon"`, `bonus: 1`, `bases: []`). Same for "+1 Armor", "+2 Shield", "Flame Tongue"
  variants, "Armor of Resistance", etc.
- `category`: `"Armor"`, `"Weapon"`, `"Shield"`, `"Ammunition"`, `"Potion"`, `"Ring"`, `"Rod"`, `"Scroll"`, `"Staff"`,
  `"Wand"`, `"Wondrous Item"`.
- `rarity`: `"Common"`, `"Uncommon"`, `"Rare"`, `"Very Rare"`, `"Legendary"`, `"Artifact"`, or `"Varies"`.
- `attunement`: `false`, `true`, or a string with the requirement (e.g. `"by a Wizard"`).
- `baseKind`: `"weapon"`, `"armor"`, `"shield"` or `null` (for everything that isn't built on a mundane weapon/armor).
  `bases`: the allowed base items by their standard names (e.g. `["Longsword", "Shortsword", "Greatsword", "Scimitar", "Rapier"]`
  for "any sword"); empty array = any of that kind.
- `bonus`: the item's +X to attack/damage (weapons) or AC (armor/shields); 0 if none.
