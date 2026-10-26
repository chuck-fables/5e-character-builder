// ============================================================
// engine.js — the D&D 2024 rules math.
// Every function here is "pure": it takes a character (c) plus
// the rules database (DB) and returns a number or list. No UI.
// ============================================================

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };

const SKILLS = {
  "Acrobatics": "dex", "Animal Handling": "wis", "Arcana": "int", "Athletics": "str",
  "Deception": "cha", "History": "int", "Insight": "wis", "Intimidation": "cha",
  "Investigation": "int", "Medicine": "wis", "Nature": "int", "Perception": "wis",
  "Performance": "cha", "Persuasion": "cha", "Religion": "int", "Sleight of Hand": "dex",
  "Stealth": "dex", "Survival": "wis",
};

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

// Spell slots by "caster level" (index 0 = caster level 1). Each row lists slots for spell levels 1..9.
const SLOT_TABLE = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
// Warlock Pact Magic: number of slots and their level, by Warlock level.
const PACT_SLOTS = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4];
const PACT_LEVEL = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];

const CONDITIONS = ["Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible",
  "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"];

// ---------- small helpers ----------
const mod = (score) => Math.floor((score - 10) / 2);
const signed = (n) => (n >= 0 ? "+" + n : "" + n);
const atLevel = (arr, level) => (Array.isArray(arr) ? arr[Math.min(Math.max(level, 1), 20) - 1] ?? 0 : 0);
const slug = (s) => String(s).toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function totalLevel(c) {
  return c.classes.reduce((sum, k) => sum + (k.level || 0), 0) || 1;
}
function profBonus(c) {
  return Math.ceil(totalLevel(c) / 4) + 1;
}
function classLevel(c, classId) {
  const k = c.classes.find((k) => k.id === classId);
  return k ? k.level : 0;
}
function hasSubclass(c, subclassId) {
  return c.classes.some((k) => k.subclass === subclassId);
}
function hasFeat(c, featId) {
  return c.feats.some((f) => f.id === featId);
}

// ---------- ability scores ----------
// Final score = base + background bonus + feat increases. Normal cap 20; Epic Boons may push to 30.
function abilityScores(c, DB) {
  const out = {};
  for (const a of ABILITIES) {
    let score = (c.base[a] || 8) + (c.bgBonus[a] || 0) + (c.scoreBonus?.[a] || 0);
    let boon = 0;
    for (const f of c.feats) {
      const inc = f.asi?.[a] || 0;
      if (DB.feats[f.id]?.category === "epic-boon") boon += inc;
      else score += inc;
    }
    score = Math.min(score, 20);
    out[a] = Math.min(score + boon, 30);
  }
  return out;
}
function abilityMods(c, DB) {
  const s = abilityScores(c, DB);
  const out = {};
  for (const a of ABILITIES) out[a] = mod(s[a]);
  return out;
}

// ---------- saves & skills ----------
function saveProficiencies(c, DB) {
  const first = DB.classes[c.classes[0]?.id];
  const set = new Set(first?.saves || []);
  for (const f of c.feats) if (f.id === "resilient" && f.asi) Object.keys(f.asi).forEach((a) => set.add(a));
  if (classLevel(c, "monk") >= 14) ABILITIES.forEach((a) => set.add(a)); // Disciplined Survivor
  if (classLevel(c, "rogue") >= 15) { set.add("wis"); set.add("cha"); } // Slippery Mind
  (c.extraSaves || []).forEach((a) => set.add(a));
  return set;
}
function saveBonus(c, DB, a) {
  const m = abilityMods(c, DB)[a];
  return m + (saveProficiencies(c, DB).has(a) ? profBonus(c) : 0) + (c.saveBonus || 0);
}
function jackOfAllTrades(c) {
  return classLevel(c, "bard") >= 2 ? Math.floor(profBonus(c) / 2) : 0;
}
function skillBonus(c, DB, skill) {
  const m = abilityMods(c, DB)[SKILLS[skill]];
  const pb = profBonus(c);
  if (c.expertise.includes(skill)) return m + pb * 2;
  if (c.skills.includes(skill)) return m + pb;
  return m + jackOfAllTrades(c);
}
function passive(c, DB, skill) {
  return 10 + skillBonus(c, DB, skill);
}
// How many skill proficiencies this character should have picked (a guide, not a hard rule).
function expectedSkillCount(c, DB) {
  let n = 0;
  const first = DB.classes[c.classes[0]?.id];
  if (first) n += first.skills?.choose || 0;
  c.classes.slice(1).forEach((k) => { if (["bard", "ranger", "rogue"].includes(k.id)) n += 1; });
  const bg = DB.backgrounds[c.background];
  if (bg) n += (bg.skills || []).length;
  if (c.species === "human") n += 1;
  if (c.species === "elf") n += 1;
  n += c.feats.filter((f) => f.id === "skilled").length * 3;
  return n;
}

// ---------- combat numbers ----------
function initiative(c, DB) {
  const m = abilityMods(c, DB).dex;
  return m + (hasFeat(c, "alert") ? profBonus(c) : jackOfAllTrades(c)) + (c.initBonus || 0);
}

// An inventory item's stats: custom items carry their own, standard ones come from the rules.
// `bonus` is a magic +1/+2/+3 on the item.
function itemWeapon(i, DB) {
  return i.stats?.weapon || DB.weaponByName[i.ref || i.name] || null;
}
function itemArmor(i, DB) {
  const a = i.stats?.armor || DB.armorByName[i.ref || i.name];
  return a ? { ...a, name: i.name, bonus: Number(i.bonus) || 0 } : null;
}
function equippedArmor(c, DB) {
  const it = c.inventory.find((i) => i.equipped && i.kind === "armor");
  return it ? itemArmor(it, DB) : null;
}
function equippedShield(c, DB) {
  const it = c.inventory.find((i) => i.equipped && i.kind === "shield");
  return it ? itemArmor(it, DB) || { name: it.name, baseAC: 2, bonus: Number(it.bonus) || 0 } : null;
}

// Returns { value, note } — note explains which formula won.
function armorClass(c, DB) {
  const m = abilityMods(c, DB);
  const armor = equippedArmor(c, DB);
  const shield = equippedShield(c, DB);
  const options = [];
  if (armor) {
    const dex = armor.dexCap === null || armor.dexCap === undefined ? m.dex : Math.min(m.dex, armor.dexCap);
    let v = armor.baseAC + dex + armor.bonus;
    if (hasFeat(c, "defense")) v += 1;
    options.push({ value: v, note: armor.name });
  } else {
    options.push({ value: 10 + m.dex, note: "Unarmored" });
    if (classLevel(c, "barbarian") >= 1) options.push({ value: 10 + m.dex + m.con, note: "Unarmored Defense" });
    if (classLevel(c, "monk") >= 1 && !shield) options.push({ value: 10 + m.dex + m.wis, note: "Unarmored Defense" });
    if (hasSubclass(c, "sorcerer-draconic-sorcery") && classLevel(c, "sorcerer") >= 3)
      options.push({ value: 10 + m.dex + m.cha, note: "Draconic Resilience" });
  }
  const best = options.reduce((a, b) => (b.value > a.value ? b : a));
  let value = best.value + (shield ? (shield.baseAC || 2) + (shield.bonus || 0) : 0) + (c.acBonus || 0);
  return { value, note: best.note + (shield ? " + Shield" : "") };
}

function speed(c, DB) {
  const sp = DB.species[c.species];
  let v = sp?.speed || 30;
  const armor = equippedArmor(c, DB);
  const shield = equippedShield(c, DB);
  const monk = classLevel(c, "monk");
  if (monk >= 2 && !armor && !shield) v += monk >= 18 ? 30 : monk >= 14 ? 25 : monk >= 10 ? 20 : monk >= 6 ? 15 : 10;
  if (classLevel(c, "barbarian") >= 5 && armor?.category !== "heavy") v += 10;
  if (hasFeat(c, "speedy") || hasFeat(c, "mobile")) v += 10;
  if (hasFeat(c, "boon-of-speed")) v += 30;
  return v + (c.speedBonus || 0);
}

// ---------- hit points ----------
function maxHP(c, DB) {
  if (c.hp.maxOverride) return c.hp.maxOverride;
  const con = abilityMods(c, DB).con;
  let hp = 0;
  c.classes.forEach((k, i) => {
    const die = DB.classes[k.id]?.hitDie || 8;
    for (let lvl = 1; lvl <= k.level; lvl++) {
      hp += i === 0 && lvl === 1 ? die : die / 2 + 1; // full die at level 1, average after
    }
  });
  const lvl = totalLevel(c);
  hp += con * lvl;
  if (hasFeat(c, "tough")) hp += 2 * lvl;
  if (c.species === "dwarf") hp += lvl; // Dwarven Toughness
  if (hasSubclass(c, "sorcerer-draconic-sorcery")) {
    const s = classLevel(c, "sorcerer");
    if (s >= 3) hp += s; // Draconic Resilience: +3 at level 3, +1 per Sorcerer level after
  }
  if (hasFeat(c, "boon-of-fortitude")) hp += 40;
  return Math.max(hp + (c.hpBonus || 0), 1);
}
// Hit dice pool, e.g. [{ die: 10, total: 3, spent: 1 }]
function hitDice(c, DB) {
  const pool = {};
  for (const k of c.classes) {
    const die = DB.classes[k.id]?.hitDie || 8;
    pool[die] = (pool[die] || 0) + k.level;
  }
  return Object.keys(pool).map(Number).sort((a, b) => b - a)
    .map((die) => ({ die, total: pool[die], spent: Math.min(c.hitDiceSpent[die] || 0, pool[die]) }));
}

// ---------- spellcasting ----------
// Every source of spellcasting this character has: classes and subclasses that cast.
function casters(c, DB) {
  const list = [];
  for (const k of c.classes) {
    const cls = DB.classes[k.id];
    const sub = DB.subclasses[k.subclass];
    const sc = cls?.spellcasting || (sub?.spellcasting && k.level >= (cls?.subclassLevel || 3) ? sub.spellcasting : null);
    if (!sc) continue;
    list.push({ key: k.id, classId: k.id, name: cls.name, level: k.level, ...sc, listClass: sub?.spellcasting && !cls.spellcasting ? (sub.spellcasting.list || "wizard") : k.id });
  }
  return list;
}
function progressionLevel(prog, level, multiclass) {
  if (prog === "full") return level;
  if (prog === "half" || prog === "artificer") return Math.ceil(level / 2);
  if (prog === "third") return multiclass ? Math.floor(level / 3) : Math.ceil(level / 3);
  return 0;
}
// Shared spell slots (not Pact Magic). Returns an array of 9 numbers.
function spellSlots(c, DB) {
  const cs = casters(c, DB).filter((x) => x.progression !== "pact");
  const multi = cs.length > 1;
  let lvl = 0;
  for (const x of cs) lvl += progressionLevel(x.progression, x.level, multi);
  const row = lvl > 0 ? SLOT_TABLE[Math.min(lvl, 20) - 1] : [];
  return Array.from({ length: 9 }, (_, i) => row[i] || 0);
}
function pactMagic(c) {
  const w = classLevel(c, "warlock");
  return w ? { slots: atLevel(PACT_SLOTS, w), level: atLevel(PACT_LEVEL, w) } : null;
}
// Highest spell level a given caster can prepare, judged on that class alone.
function maxSpellLevel(caster) {
  if (caster.progression === "pact") return atLevel(PACT_LEVEL, caster.level);
  const lvl = progressionLevel(caster.progression, caster.level, false);
  return lvl ? SLOT_TABLE[lvl - 1].length : 0;
}
function spellDC(c, DB, ability) {
  return 8 + profBonus(c) + abilityMods(c, DB)[ability];
}
function spellAttack(c, DB, ability) {
  return profBonus(c) + abilityMods(c, DB)[ability];
}
// Always-prepared spells from subclass, species and lineage, as [{ id, source }]
function grantedSpells(c, DB) {
  const out = [];
  const add = (names, source) => (names || []).forEach((n) => out.push({ id: slug(n), name: n, source }));
  for (const k of c.classes) {
    const sub = DB.subclasses[k.subclass];
    if (!sub?.spells) continue;
    for (const [lvl, names] of Object.entries(sub.spells)) if (k.level >= +lvl) add(names, sub.name);
  }
  const sp = DB.species[c.species];
  const lvl = totalLevel(c);
  const fromMap = (map, source) => { for (const [l, names] of Object.entries(map || {})) if (lvl >= +l) add(names, source); };
  if (sp) fromMap(sp.spells, sp.name);
  const lin = sp?.lineages?.find((l) => l.name === c.lineage);
  if (lin) fromMap(lin.spells, lin.name);
  return out;
}

// ---------- class resources (Rage, Ki/Focus, Channel Divinity, ...) ----------
function resolveMax(max, level, c, DB) {
  if (typeof max === "number") return max;
  if (Array.isArray(max)) return atLevel(max, level);
  if (max === "pb") return profBonus(c);
  if (ABILITIES.includes(max)) return Math.max(1, abilityMods(c, DB)[max]);
  return 0;
}
function resources(c, DB) {
  const out = [];
  for (const k of c.classes) {
    const lists = [DB.classes[k.id]?.resources || [], DB.subclasses[k.subclass]?.resources || []];
    for (const list of lists) {
      for (const r of list) {
        if (k.level < (r.level || r.minLevel || 1)) continue; // not unlocked yet
        const max = resolveMax(r.max, k.level, c, DB);
        if (max > 0) out.push({ key: r.key, name: r.name, max, recharge: r.recharge || "long", spent: Math.min(c.resSpent[r.key] || 0, max) });
      }
    }
  }
  return out;
}

// ---------- weapons ----------
function weaponProficient(c, DB, w) {
  const text = c.classes.map((k) => DB.classes[k.id]?.weapons || "").join(" ").toLowerCase();
  if (w.category === "simple" && text.includes("simple")) return true;
  if (w.category === "martial") {
    const m = text.match(/martial weapons that have the ([a-z ]+?) propert/);
    if (text.replace(/martial weapons that have[^.;]*/g, "").includes("martial")) return true;
    if (m) return m[1].split(/ or | and /).some((p) => w.properties.some((x) => x.toLowerCase().startsWith(p.trim())));
  }
  return (c.weaponProfs || "").toLowerCase().includes(w.name.toLowerCase());
}
function weaponAttacks(c, DB) {
  const m = abilityMods(c, DB);
  const pb = profBonus(c);
  return c.inventory.filter((i) => i.kind === "weapon").map((i) => {
    const w = itemWeapon(i, DB);
    if (!w) return null;
    const magic = Number(i.bonus) || 0;
    const props = w.properties.map((p) => p.toLowerCase());
    let ability = w.kind === "ranged" ? "dex" : "str";
    if (props.some((p) => p.startsWith("finesse")) && m.dex > m.str) ability = "dex";
    if (classLevel(c, "monk") >= 1 && (w.category === "simple" || props.some((p) => p.startsWith("light"))) && m.dex > m[ability]) ability = "dex";
    const prof = weaponProficient(c, DB, w);
    const bonus = m[ability] + (prof ? pb : 0) + magic + (hasFeat(c, "archery") && w.kind === "ranged" ? 2 : 0);
    const dmgMod = m[ability] + magic;
    return {
      uid: i.uid, name: i.name, equipped: i.equipped, ability, prof,
      attack: bonus, damage: `${w.damage}${dmgMod ? signed(dmgMod) : ""}`, damageType: w.damageType,
      properties: w.properties || [], mastery: c.masteries.includes(w.name) ? w.mastery : null,
    };
  }).filter(Boolean);
}

// ---------- carrying ----------
function carryCapacity(c, DB) {
  return abilityScores(c, DB).str * 15;
}
function carriedWeight(c) {
  return c.inventory.reduce((s, i) => s + (Number(i.weight) || 0) * (Number(i.qty) || 1), 0)
    + Object.values(c.coins).reduce((s, n) => s + (Number(n) || 0), 0) / 50;
}

// ---------- what still needs choosing ----------
// Returns a list of { section, text } describing unfinished choices.
function pendingChoices(c, DB) {
  const todo = [];
  if (!c.name.trim()) todo.push({ section: "basics", text: "Give your character a name" });
  if (!c.species) todo.push({ section: "species", text: "Choose a species" });
  else if (DB.species[c.species]?.lineages?.length && !c.lineage) todo.push({ section: "species", text: "Choose a lineage for your species" });
  if (c.scoreMethod === "rolled" && Object.keys(c.rollAssign || {}).length < 6)
    todo.push({ section: "abilities", text: c.rolls?.length ? "Assign all six rolled ability scores" : "Roll your ability scores" });
  if (!c.background) todo.push({ section: "background", text: "Choose a background" });
  else {
    const total = Object.values(c.bgBonus).reduce((a, b) => a + b, 0);
    if (total !== 3) todo.push({ section: "background", text: "Assign your background's ability score increases (+2/+1 or +1/+1/+1)" });
  }
  for (const k of c.classes) {
    const cls = DB.classes[k.id];
    if (!cls) continue;
    if (k.level >= (cls.subclassLevel || 3) && !k.subclass) todo.push({ section: "class", text: `Choose a ${cls.name} subclass` });
    for (const lvl of cls.asiLevels || []) {
      if (k.level >= lvl && !c.feats.some((f) => f.slot === `${k.id}:${lvl}`))
        todo.push({ section: "feats", text: `${cls.name} level ${lvl}: choose a feat or Ability Score Improvement` });
    }
    if (cls.epicBoonLevel && k.level >= cls.epicBoonLevel && !c.feats.some((f) => f.slot === `${k.id}:boon`))
      todo.push({ section: "feats", text: `${cls.name} level ${cls.epicBoonLevel}: choose an Epic Boon` });
    const fs = (cls.features || []).filter((f) => /^fighting style$/i.test(f.name) && k.level >= f.level);
    if (fs.length && !c.feats.some((f) => f.slot === `${k.id}:style`))
      todo.push({ section: "feats", text: `${cls.name}: choose a Fighting Style feat` });
  }
  if (c.species === "human" && !c.feats.some((f) => f.slot === "species")) todo.push({ section: "feats", text: "Human (Versatile): choose an Origin feat" });
  for (const f of c.feats) {
    const feat = DB.feats[f.id];
    if (feat?.asi && !Object.keys(f.asi || {}).length) todo.push({ section: "feats", text: `${feat.name}: choose which ability to increase` });
  }
  const skillsWanted = expectedSkillCount(c, DB);
  const skillsHave = c.skills.length;
  if (skillsHave < skillsWanted) todo.push({ section: "skills", text: `Choose ${skillsWanted - skillsHave} more skill proficienc${skillsWanted - skillsHave === 1 ? "y" : "ies"}` });
  const mastery = masteryCount(c, DB);
  if (c.masteries.length < mastery) todo.push({ section: "skills", text: `Choose ${mastery - c.masteries.length} more Weapon Master${mastery - c.masteries.length === 1 ? "y" : "ies"}` });
  for (const x of casters(c, DB)) {
    const pick = c.spells[x.key] || { cantrips: [], prepared: [] };
    const can = atLevel(x.cantrips, x.level), prep = atLevel(x.prepared, x.level);
    if (pick.cantrips.length < can) todo.push({ section: "spells", text: `${x.name}: choose ${can - pick.cantrips.length} more cantrip${can - pick.cantrips.length === 1 ? "" : "s"}` });
    if (pick.prepared.length < prep) todo.push({ section: "spells", text: `${x.name}: prepare ${prep - pick.prepared.length} more spell${prep - pick.prepared.length === 1 ? "" : "s"}` });
  }
  for (const f of c.feats) {
    const cls = magicInitiateClass(f.id);
    if (!cls) continue;
    const pick = c.spells["feat:" + f.slot] || { cantrips: [], prepared: [] };
    if (pick.cantrips.length < 2 || pick.prepared.length < 1) todo.push({ section: "spells", text: `${DB.feats[f.id]?.name || "Magic Initiate"}: choose 2 cantrips and 1 level 1 spell` });
  }
  return todo;
}
function masteryCount(c, DB) {
  return c.classes.reduce((n, k) => n + atLevel(DB.classes[k.id]?.weaponMastery, k.level), 0);
}
function magicInitiateClass(featId) {
  const m = /^magic-initiate-(\w+)$/.exec(featId || "");
  return m ? m[1] : null;
}

// ---------- multiclass prerequisites ----------
function multiclassOK(c, DB, classId) {
  const req = DB.classes[classId]?.multiclass?.prereq || "";
  const s = abilityScores(c, DB);
  const needs = ABILITIES.filter((a) => req.includes(ABILITY_NAMES[a]));
  if (!needs.length) return true;
  return req.includes(" or ") ? needs.some((a) => s[a] >= 13) : needs.every((a) => s[a] >= 13);
}

// ---------- dice ----------
function rollDie(sides) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % sides) + 1;
}
// Rolls an expression like "2d6+3" or "1d20+5". Returns { total, rolls, text }.
function rollExpr(expr) {
  const parts = String(expr).replace(/\s/g, "").match(/[+-]?[^+-]+/g) || [];
  let total = 0;
  const shown = [];
  for (const p of parts) {
    const sign = p[0] === "-" ? -1 : 1;
    const body = p.replace(/^[+-]/, "");
    const d = /^(\d*)d(\d+)$/i.exec(body);
    if (d) {
      const n = +(d[1] || 1), sides = +d[2];
      const rolls = Array.from({ length: n }, () => rollDie(sides));
      total += sign * rolls.reduce((a, b) => a + b, 0);
      shown.push(`${sign < 0 ? "−" : ""}[${rolls.join(", ")}]`);
    } else if (!isNaN(+body)) {
      total += sign * +body;
      shown.push(`${sign < 0 ? "−" : "+"}${body}`);
    }
  }
  return { total, text: shown.join(" ") };
}
