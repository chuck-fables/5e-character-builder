// ============================================================
// extras.js — loaded right after app.js (same script).
//  1. Roll mode toggle (Advantage / Normal / Disadvantage)
//  2. Spell casting: confirm, pick a slot, spend it, roll attack + damage (with upcasting)
//  3. Wild Shape: pick a form, art swap, temp HP, form stat block + attacks
//  4. Resources: a searchable compendium (spells, items, magic items, monsters, rules, …)
// ============================================================

const WS_ART = window.WILDSHAPE_ART || {};
const MONSTER_ART = window.MONSTER_ART || {};
const MONSTERS = DB.raw.monsters || [];
const MONSTER_BY_ID = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));
const WILDSHAPES = DB.raw.wildshapes || [];
const RULES = DB.raw.rules || [];

// ---------- 1. roll mode ----------
function rollModeBar() {
  return `<div class="rollbar" role="group" aria-label="Roll mode">${[["adv", "Advantage"], ["normal", "Normal"], ["dis", "Disadvantage"]]
    .map(([k, l]) => `<button class="${S.rollMode === k ? "on " + k : ""}" data-act="roll-mode" data-id="${k}" aria-pressed="${S.rollMode === k}">${l}</button>`).join("")}</div>`;
}

// ---------- shared: read "+5 … (1d8 + 3) Piercing" out of an attack's text ----------
function parseAttack(text) {
  // Stat blocks use typographic dashes ("1d4 – 1"); treat them as minus signs.
  const t = String(text || "").replace(/[\u2012-\u2015\u2212]/g, "-");
  const bonus = /Attack Roll:?_?\s*([+-]\d+)/i.exec(t);
  const dmgs = [];
  const re = /\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)\s*([A-Za-z]+)\s+damage/gi;
  for (let m; (m = re.exec(t)); ) dmgs.push({ expr: m[1].replace(/\s+/g, ""), type: m[2] });
  if (!dmgs.length) {                                   // damage with no type before "damage", e.g. "28 (8d6) damage of the type…"
    const bare = /\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)\s+damage/i.exec(t);
    if (bare) dmgs.push({ expr: bare[1].replace(/\s+/g, ""), type: "" });
  }
  if (!dmgs.length) {                                   // flat damage, e.g. "Hit: 1 Piercing damage"
    const flat = /Hit:_?\s*(\d+)\s+([A-Za-z]+)\s+damage/i.exec(t);
    if (flat) dmgs.push({ expr: flat[1], type: flat[2] });
  }
  const save = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+Saving Throw:?_?\s*DC\s*(\d+)/i.exec(t);
  return { bonus: bonus ? +bonus[1] : null, dmgs, save: save ? { ability: save[1], dc: +save[2] } : null,
    dmg: dmgs[0]?.expr || null, type: dmgs[0]?.type || "" };
}
function attackButtons(text, label) {
  const a = parseAttack(text);
  return (a.bonus !== null ? `<button class="btn small" data-act="roll" data-roll="${a.bonus}" data-label="${esc(label)} attack">Hit ${signed(a.bonus)}</button>` : "")
    + a.dmgs.map((d, i) => `<button class="btn small" data-act="roll-dmg" data-roll="${esc(d.expr)}" data-label="${esc(label)}${i ? " extra" : ""} damage">${i ? "+ " : ""}${esc(d.expr)} ${esc(d.type)}</button>`).join("")
    + (a.save ? `<span class="badge">DC ${a.save.dc} ${esc(a.save.ability)} save</span>` : "");
}
const hasRoll = (text) => { const a = parseAttack(text); return a.bonus !== null || a.dmgs.length > 0 || !!a.save; };

// ---------- 2. spells: what to roll ----------
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const DMG_TYPES = "Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder";
function spellMath(sp) {
  const t = String(sp.text || "").replace(/\n/g, " "), hl = String(sp.higherLevels || "").replace(/\n/g, " ");
  const out = { attack: /spell attack/i.test(t), save: (t.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/) || [])[1] || null };
  const dm = t.match(new RegExp(`(\\d+d\\d+)(?:\\s*\\+\\s*(\\d+))?\\s+(${DMG_TYPES})\\s+damage`, "i"));
  const hm = !dm && /regains?\b|restores?\b/i.test(t) && t.match(/(\d+d\d+)/);
  if (dm) Object.assign(out, { dice: dm[1], flat: +(dm[2] || 0), type: dm[3], heal: false });
  else if (hm) Object.assign(out, { dice: hm[1], flat: 0, type: "healing", heal: true });
  if (out.dice) {
    const at = t.indexOf(out.dice);
    out.addMod = /spellcasting ability modifier/i.test(t.slice(at, at + 90));
  }
  const per = hl.match(/(\d+d\d+)\s+for each (?:spell )?slot level above/i);
  if (per) out.perLevel = per[1];
  const proj = t.match(/\b(two|three|four|five)\s+(?:glowing\s+|fiery\s+|crackling\s+)?(darts|rays|beams|bolts|motes)\b/i);
  if (proj) out.count = WORDNUM[proj[1].toLowerCase()];
  if (/(one more|one additional|an additional)\s+\w+\s+for each (?:spell )?slot level above/i.test(hl)) out.countPerLevel = 1;
  if (sp.level === 0 && /levels? 5\b/i.test(hl)) out.cantripScale = /beams?\s+at level|beams at/i.test(hl) ? "count" : "dice";
  return out;
}
// The roll for a cast at slot level `slot`. Returns { expr, times, … } (expr null if the spell has no dice).
function spellPlan(sp, slot, c, ability) {
  const m = spellMath(sp);
  if (!m.dice) return { ...m, expr: null, times: 1 };
  let [n, d] = m.dice.split("d").map(Number);
  const extra = Math.max(0, slot - sp.level);
  let times = m.count || 1, bonusDice = "";
  if (m.perLevel && extra) {
    const [pn, pd] = m.perLevel.split("d").map(Number);
    if (pd === d) n += pn * extra; else bonusDice = `+${pn * extra}d${pd}`;
  }
  if (m.countPerLevel) times += extra;
  if (m.cantripScale) {
    const L = totalLevel(c), tier = L >= 17 ? 4 : L >= 11 ? 3 : L >= 5 ? 2 : 1;
    if (m.cantripScale === "count") times = tier; else n *= tier;
  }
  const flat = m.flat + (m.addMod && ability ? abilityMods(c, DB)[ability] : 0);
  return { ...m, times, expr: `${n}d${d}${bonusDice}${flat ? (flat > 0 ? "+" + flat : flat) : ""}` };
}
// Which ability a spell uses for this character.
function spellAbilityFor(c, from) {
  const cs = casters(c, DB);
  const hit = cs.find((x) => x.name === from) || cs[0];
  if (hit) return hit.ability;
  if (c.speciesAbility) return c.speciesAbility;
  const m = abilityMods(c, DB);
  return ["int", "wis", "cha"].sort((a, b) => m[b] - m[a])[0];
}
function spellActions(c, sp, ability) {
  const plan = spellPlan(sp, sp.level, c, ability);
  return `<div class="spell-actions">
    <button class="btn small primary" data-act="cast-ask" data-id="${sp.id}|${ability}">✴ Cast</button>
    ${plan.attack ? `<button class="btn small" data-act="roll" data-roll="${spellAttack(c, DB, ability)}" data-label="${esc(sp.name)} attack">Attack ${signed(spellAttack(c, DB, ability))}</button>` : ""}
    ${plan.expr ? `<button class="btn small" data-act="roll-spell" data-id="${sp.id}|${ability}|${sp.level}">${plan.times > 1 ? plan.times + " × " : ""}${esc(plan.expr)} ${esc(plan.type)}</button>` : ""}
    ${plan.save ? `<span class="badge">DC ${spellDC(c, DB, ability)} ${esc(plan.save)} save</span>` : ""}
  </div>`;
}
// Roll a spell's dice (each projectile separately) and show it.
function spellRollToast(c, sp, slot, ability, note) {
  const plan = spellPlan(sp, slot, c, ability);
  const parts = [];
  let attackLine = "";
  if (plan.attack) {
    const a = rollDie(20), b = rollDie(20), mode = S.rollMode;
    const pick = mode === "adv" ? Math.max(a, b) : mode === "dis" ? Math.min(a, b) : a;
    const bonus = spellAttack(c, DB, ability);
    attackLine = `Attack <b>${pick + bonus}</b> (d20 [${mode === "normal" ? a : a + ", " + b}] ${signed(bonus)})${pick === 20 ? " · Natural 20!" : pick === 1 ? " · Natural 1" : ""}`;
  }
  let total = 0;
  if (plan.expr) for (let i = 0; i < plan.times; i++) { const r = rollExpr(plan.expr); total += r.total; parts.push(`${plan.times > 1 ? "#" + (i + 1) + " " : ""}${r.total} ${esc(r.text)}`); }
  const head = `${sp.name}${sp.level ? ` · level ${slot}` : ""}`;
  if (!plan.expr) {
    toast(rollCard({ label: head, total: "✴", detail: [note, attackLine, plan.save ? `DC ${spellDC(c, DB, ability)} ${plan.save} save` : ""].filter(Boolean).join("<br>") || "Spell cast." }), 7000);
    return;
  }
  toast(rollCard({
    label: head, total, tone: plan.heal ? "" : "",
    detail: [attackLine, `${plan.times > 1 ? plan.times + " × " : ""}${esc(plan.expr)} ${esc(plan.type)}: ${parts.join(" · ")}`, plan.save ? `Targets make a DC ${spellDC(c, DB, ability)} ${plan.save} save` : ""].filter(Boolean).join("<br>"),
    note: note || "",
    actions: [{ label: "Roll again", attrs: `data-act="roll-spell" data-id="${sp.id}|${ability}|${slot}"` },
      ...(plan.attack && !plan.heal ? [{ label: "Critical (double dice)", attrs: `data-act="roll-crit" data-roll="${esc(plan.expr)}" data-label="${esc(sp.name)} damage"`, primary: true }] : [])],
  }), 12000);
}

// ---------- 2b. casting: confirm + slot choice + spend ----------
let CAST = null;
function castOptions(c, sp) {
  const opts = [];
  if (sp.level > 0) {
    const slots = spellSlots(c, DB), pact = pactMagic(c);
    for (let l = sp.level; l <= 9; l++) if (slots[l - 1]) opts.push({ id: "s" + l, level: l, label: `Level ${l} slot`, left: slots[l - 1] - (c.slotsSpent[l - 1] || 0) });
    if (pact && pact.level >= sp.level) opts.push({ id: "p", level: pact.level, label: `Pact Magic slot (level ${pact.level})`, left: pact.slots - (c.pactSpent || 0) });
    if (sp.ritual) opts.push({ id: "ritual", level: sp.level, label: "As a ritual (takes 10 minutes longer, no slot)", left: Infinity });
    opts.push({ id: "free", level: sp.level, label: "Without a slot (scroll, item or free cast)", left: Infinity });
  }
  return opts;
}
function showCast() {
  const c = C(), sp = DB.spells[CAST.spId];
  const opts = castOptions(c, sp);
  const chosen = opts.find((o) => o.id === CAST.choice);
  const plan = spellPlan(sp, chosen ? chosen.level : sp.level, c, CAST.ability);
  modal(`<h2>Cast ${esc(sp.name)}?</h2>
    <p class="small soft">${esc(sp.level ? "Level " + sp.level + " " : "Cantrip · ")}${esc(sp.school)} · ${esc(sp.castingTime)} · ${esc(sp.range)}${sp.concentration ? " · Concentration" : ""}</p>
    ${opts.length ? `<div class="label">What level spell slot?</div>
      <div class="list">${opts.map((o) => `<button class="pick ${CAST.choice === o.id ? "on" : ""} ${o.left <= 0 ? "locked" : ""}" ${o.left > 0 ? `data-act="cast-pick" data-id="${o.id}"` : ""}>
        <span class="check"></span><span class="grow"><b>${esc(o.label)}</b>
        <span class="small soft" style="display:block">${o.left === Infinity ? (o.id === "ritual" ? "Ritual" : "No slot used") : o.left > 0 ? `${o.left} left` : "None left"}${o.level > sp.level && o.left > 0 ? ` · upcast +${o.level - sp.level}` : ""}</span></span></button>`).join("")}</div>` : ""}
    ${plan.expr ? `<p class="small">At this level: <b>${plan.times > 1 ? plan.times + " × " : ""}${esc(plan.expr)} ${esc(plan.type)}</b>${plan.attack ? ` · Attack ${signed(spellAttack(c, DB, CAST.ability))}` : ""}${plan.save ? ` · DC ${spellDC(c, DB, CAST.ability)} ${plan.save} save` : ""}</p>` : ""}
    ${sp.concentration && c.states?.concentrating ? `<p class="small" style="color:var(--orange)">You're already concentrating. Casting this ends your other concentration spell.</p>` : ""}
    <button class="btn primary" data-act="cast-go" ${opts.length && !chosen ? "disabled" : ""}>Cast ${esc(sp.name)}</button>
    <button class="btn" data-act="close-modal">Cancel</button>`);
}
function doCast() {
  const sp = DB.spells[CAST.spId];
  const c = C();
  const opt = castOptions(c, sp).find((o) => o.id === CAST.choice);
  const level = opt ? opt.level : sp.level;
  let note = "";
  S.keepScroll = true;
  update((c) => {
    if (opt?.id?.startsWith("s")) { c.slotsSpent[opt.level - 1] = (c.slotsSpent[opt.level - 1] || 0) + 1; note = `Used a level ${opt.level} slot.`; }
    else if (opt?.id === "p") { c.pactSpent = (c.pactSpent || 0) + 1; note = `Used a Pact Magic slot.`; }
    else if (opt?.id === "ritual") note = "Cast as a ritual.";
    else if (opt?.id === "free") note = "No slot used.";
    if (sp.concentration) { c.states = c.states || {}; c.states.concentrating = true; note += " Concentrating."; }
  });
  closeModal();
  spellRollToast(C(), sp, level, CAST.ability, note.trim());
}

// ---------- 3. Wild Shape ----------
const ALT_FORMS = [
  { id: "form-starry-archer", name: "Starry Form: Archer", sub: "druid-circle-of-the-stars", minLevel: 3,
    text: "As a Bonus Action when you take the form and on later turns, make a ranged spell attack against a creature within 60 feet: Radiant damage 1d8 + your Wisdom modifier (2d8 from Druid level 10).", roll: "archer" },
  { id: "form-starry-chalice", name: "Starry Form: Chalice", sub: "druid-circle-of-the-stars", minLevel: 3,
    text: "Whenever you cast a spell with a slot that restores Hit Points, you or a creature within 30 feet regains 1d8 + your Wisdom modifier (2d8 from Druid level 10).", roll: "chalice" },
  { id: "form-starry-dragon", name: "Starry Form: Dragon", sub: "druid-circle-of-the-stars", minLevel: 3,
    text: "When you make an Intelligence or Wisdom check or a Constitution save to keep Concentration, you can treat a d20 roll of 9 or lower as a 10. From Druid level 10 you also have a Fly Speed of 20 feet and can hover." },
  { id: "form-wrath-of-the-sea", name: "Wrath of the Sea", sub: "druid-circle-of-the-sea", minLevel: 3,
    text: "A 5-foot Emanation of ocean spray surrounds you for 10 minutes (10 feet from Druid level 6). As a Bonus Action, force a creature in it to make a Constitution save: on a failure it takes Cold damage (a number of d6 equal to your Wisdom modifier, minimum 1) and is pushed up to 15 feet away.", roll: "sea" },
];
function wsInfo(c) {
  const L = classLevel(c, "druid");
  const moon = hasSubclass(c, "druid-circle-of-the-moon") && L >= 3;
  return {
    L, moon,
    maxCR: moon ? Math.max(1, Math.floor(L / 3)) : L >= 8 ? 1 : L >= 4 ? 0.5 : 0.25, // Circle Forms: Druid level ÷ 3
    fly: L >= 8, known: L >= 8 ? 8 : L >= 4 ? 6 : 4,
    temp: moon ? 3 * L : L,                                     // 2024: Temp HP = Druid level (×3 for Circle of the Moon)
    alts: ALT_FORMS.filter((f) => hasSubclass(c, f.sub) && L >= f.minLevel),
  };
}
// Every Beast in the Monster Manual is a possible form. The prepared Wild Shape list is used where it
// exists; any other Beast (the bigger ones Moon druids unlock) is built from its stat block.
function beastToForm(m) {
  const fly = (m.speeds?.fly || 0) > 0;
  return { id: m.id, name: m.name, monsterId: m.id, size: m.size, cr: m.cr, crText: m.crText, ac: m.ac, hp: m.hp, speed: m.speed,
    fly, swim: (m.speeds?.swim || 0) > 0, speeds: m.speeds, abilities: { str: m.abilities.str, dex: m.abilities.dex, con: m.abilities.con },
    senses: m.senses, skills: m.skills, defenses: m.defenses, attacks: [...(m.actions || []), ...(m.bonusActions || [])], traits: m.traits || [] };
}
const BEAST_FORMS = (() => {
  const byId = Object.fromEntries(WILDSHAPES.map((f) => [f.id, f]));
  for (const m of MONSTERS) if (m.type === "Beast" && !byId[m.id]) byId[m.id] = beastToForm(m);
  return Object.values(byId).sort((a, b) => (a.cr - b.cr) || a.name.localeCompare(b.name));
})();
const formOf = (id) => BEAST_FORMS.find((w) => w.id === id) || ALT_FORMS.find((f) => f.id === id) || null;
const isAltForm = (id) => ALT_FORMS.some((f) => f.id === id);
// The Druid level at which this character can first take this form (Infinity = never).
//   Regular druid: CR 1/4 at 2, CR 1/2 at 4, CR 1 at 8. Circle of the Moon (from 3): CR = level ÷ 3 (CR 1 at 3).
//   Any form with a Fly Speed needs Druid level 8.
function unlockLevel(c, f) {
  const moon = hasSubclass(c, "druid-circle-of-the-moon");
  const cr = f.cr || 0;
  let lvl = cr <= 0.25 ? 2 : cr <= 0.5 ? 4 : cr <= 1 ? 8 : Infinity;
  if (moon) lvl = Math.min(lvl, cr <= 1 ? 3 : cr * 3);
  if (f.fly) lvl = Math.max(lvl, 8);
  return lvl > 20 ? Infinity : lvl;
}
function eligibleForms(c) {
  const L = classLevel(c, "druid");
  return BEAST_FORMS.filter((f) => unlockLevel(c, f) <= L);
}
function wsPath(c) {
  return hasSubclass(c, "druid-circle-of-the-moon")
    ? "Circle of the Moon: CR 1 at Druid 3 · CR 2 at 6 · CR 3 at 9 · CR 4 at 12 · CR 5 at 15 · CR 6 at 18. Flying forms from Druid 8."
    : "Wild Shape: CR 1/4 at Druid 2 · CR 1/2 at 4 · CR 1 and flying forms at 8.";
}
let WSF = { known: true };
function showWildShapePicker() {
  const c = C();
  const w = wsInfo(c);
  const known = c.wsKnown || [];
  const all = eligibleForms(c);
  const reachable = BEAST_FORMS.filter((f) => unlockLevel(c, f) !== Infinity);
  const list = WSF.known && known.length ? all.filter((f) => known.includes(f.id)) : WSF.locked ? reachable : all;
  const res = resources(c, DB).find((r) => /wild shape/i.test(r.name));
  const usesLeft = res ? res.max - res.spent : null;
  const tile = (f, alt) => {
    const at = alt ? 0 : unlockLevel(c, f);
    const locked = at > w.L;
    return `<div class="ws-tile ${c.wildShape?.form === f.id ? "on" : ""} ${locked ? "locked" : ""}">
      <button class="gimg" ${locked ? "" : `data-act="ws-go" data-id="${f.id}"`} aria-label="${locked ? esc(f.name) + " (locked)" : "Turn into " + esc(f.name)}"><img src="${WS_ART[f.id] || MONSTER_ART[f.monsterId] || ""}" alt="" loading="lazy"><span class="tag">${esc(f.name)}${alt ? "" : ` · CR ${esc(f.crText || f.cr)}`}${f.fly ? " · ✈" : ""}</span></button>
      ${alt ? "" : locked ? `<span class="chip" style="cursor:default">🔒 Druid ${at}</span>`
        : `<button class="chip ${known.includes(f.id) ? "on" : ""}" style="--c:#16a34a" data-act="ws-known" data-id="${f.id}">${known.includes(f.id) ? "★ Known" : "☆ Learn"}</button>`}</div>`;
  };
  const crGroups = (forms) => [...new Set(forms.map((f) => f.crText || String(f.cr)))].map((cr) => {
    const group = forms.filter((f) => (f.crText || String(f.cr)) === cr);
    return `<div class="sub-head">CR ${esc(cr)} <span class="soft">${group.length}</span></div><div class="gallery">${group.map((f) => tile(f, false)).join("")}</div>`;
  }).join("");
  modal(`<div class="row"><h2 class="grow">Wild Shape</h2><button class="btn small" data-act="close-modal">Close</button></div>
    <p class="small soft">Druid ${w.L}${w.moon ? " · Circle of the Moon" : ""}: Beasts up to CR ${w.maxCR < 1 ? (w.maxCR === 0.5 ? "1/2" : "1/4") : w.maxCR}${w.fly ? "" : ", no Fly Speed"}. You know ${known.length}/${w.known} forms.
      <br><span class="soft">${esc(wsPath(c))}</span>
      You gain <b>${w.temp} Temporary Hit Points</b> when you shift.${usesLeft !== null ? ` Wild Shape uses left: <b>${usesLeft}</b>.` : ""}</p>
    ${c.wildShape ? `<button class="btn" data-act="ws-end">Return to your normal form</button>` : ""}
    ${w.alts.length ? `<div class="label">Your circle's alternatives (spend a Wild Shape use, no beast form)</div><div class="gallery">${w.alts.map((f) => tile(f, true)).join("")}</div>` : ""}
    ${chips([{ id: "known", label: `Known forms (${known.length})`, on: WSF.known && known.length > 0 }, { id: "all", label: `Available now (${all.length})`, on: (!WSF.known || !known.length) && !WSF.locked },
      { id: "locked", label: `Every form, with unlock levels (${reachable.length})`, on: !WSF.known && WSF.locked }], "ws-filter")}
    ${known.length > w.known ? `<p class="small" style="color:var(--orange)">You've marked more known forms than Druid ${w.L} allows (${w.known}).</p>` : ""}
    ${list.length ? crGroups(list) : '<p class="muted">No forms yet. Switch to “Available now” and tap ☆ Learn.</p>'}`);
}
function startWildShape(c, id) {
  const w = wsInfo(c);
  const alt = isAltForm(id);
  const res = resources(c, DB).find((r) => /wild shape/i.test(r.name));
  if (res && !c.wildShape) c.resSpent[res.key] = Math.min(res.max, (c.resSpent[res.key] || 0) + 1);
  const grant = alt ? 0 : w.temp;
  if (!alt) c.hp.temp = Math.max(c.hp.temp || 0, grant);      // Temporary HP don't stack: keep the higher
  c.wildShape = { form: id, temp: grant };
  c.states = c.states || {};
  c.states.wildshape = true;
}
function endWildShape(c) {
  if (c.wildShape?.temp) c.hp.temp = 0;                       // the Wild Shape temp HP go away with the form
  c.wildShape = null;
  if (c.states) c.states.wildshape = false;
}
function panelWildShape(c) {
  const ws = c.wildShape;
  const f = ws && formOf(ws.form);
  if (!f) return `<p class="muted">You're not in Wild Shape.</p>`;
  const w = wsInfo(c);
  const art = WS_ART[f.id] || MONSTER_ART[f.monsterId];
  if (isAltForm(f.id)) {
    const wis = abilityMods(c, DB).wis, big = w.L >= 10;
    const rolls = { archer: `<button class="btn small" data-act="roll" data-roll="${spellAttack(c, DB, "wis")}" data-label="Archer attack">Attack ${signed(spellAttack(c, DB, "wis"))}</button>
        <button class="btn small" data-act="roll-dmg" data-roll="${big ? "2d8" : "1d8"}${signed(wis)}" data-label="Archer radiant damage">${big ? "2d8" : "1d8"}${signed(wis)} Radiant</button>`,
      chalice: `<button class="btn small" data-act="roll-dmg" data-roll="${big ? "2d8" : "1d8"}${signed(wis)}" data-label="Chalice healing">Heal ${big ? "2d8" : "1d8"}${signed(wis)}</button>`,
      sea: `<span class="badge">DC ${spellDC(c, DB, "wis")} Con save</span><button class="btn small" data-act="roll-dmg" data-roll="${Math.max(1, wis)}d6" data-label="Wrath of the Sea cold damage">${Math.max(1, wis)}d6 Cold</button>` }[f.roll] || "";
    return `${art ? `<div class="ws-art" style="background-image:url(${art})"></div>` : ""}
      <div class="head"><h4>${esc(f.name)}</h4></div><div class="small">${md(f.text)}</div>
      <div class="spell-actions">${rolls}</div>
      <button class="btn" data-act="ws-end">End ${esc(f.name.split(":")[0])}</button>`;
  }
  const m = MONSTER_BY_ID[f.monsterId] || {};
  const mine = abilityMods(c, DB);
  const ac = w.moon ? Math.max(f.ac, 13 + mine.wis) : f.ac;
  const ab = { str: f.abilities?.str ?? m.abilities?.str, dex: f.abilities?.dex ?? m.abilities?.dex, con: f.abilities?.con ?? m.abilities?.con };
  const scores = abilityScores(c, DB);
  return `${art ? `<div class="ws-art" style="background-image:url(${art})"></div>` : ""}
    <div class="head"><h4>${esc(f.name)}</h4><span class="legend">${esc(f.size)} Beast · CR ${esc(f.crText || f.cr)}</span></div>
    <div class="band" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <div><span class="k">AC</span><span class="v num">${ac}</span></div>
      <div><span class="k">Temp HP</span><span class="v num" style="color:var(--sky)">${c.hp.temp || 0}</span></div>
      <div><span class="k">Your HP</span><span class="v num">${c.hp.current ?? maxHP(c, DB)}</span></div>
      <div><span class="k">Speed</span><span class="v num" style="font-size:.95rem">${esc(String(f.speed).replace(/ ft\./g, "").split(",")[0])}</span></div>
    </div>
    <p class="small soft">${esc(f.speed)}${f.senses ? " · " + esc(f.senses) : ""}${f.skills ? " · Skills: " + esc(f.skills) : ""}${f.defenses ? " · " + esc(f.defenses) : ""}</p>
    <div class="cols">${[["str", ab.str], ["dex", ab.dex], ["con", ab.con], ["int", scores.int], ["wis", scores.wis], ["cha", scores.cha]].map(([a, v]) => `
      <div class="srow" data-act="roll" data-roll="${mod(v)}" data-label="${ABILITY_NAMES[a]} check (${esc(f.name)})"><span class="n">${ABILITY_NAMES[a]}${["int", "wis", "cha"].includes(a) ? " (yours)" : ""}</span><span class="score num">${v}</span><span class="mod num">${signed(mod(v))}</span></div>`).join("")}</div>
    <div class="head"><h4>Attacks & Actions</h4></div>
    ${(f.attacks || []).map((x) => `<div class="card stack" style="gap:6px"><b>${esc(x.name)}</b><div class="small">${md(x.text)}</div>${hasRoll(x.text) ? `<div class="spell-actions">${attackButtons(x.text, x.name)}</div>` : ""}</div>`).join("")}
    ${[...(f.traits || []), ...(f.features || [])].length ? `<div class="head"><h4>Traits</h4></div><div>${[...(f.traits || []), ...(f.features || [])].map((x) => featureBlock(x.name, "", x.text)).join("")}</div>` : ""}
    ${w.moon && w.L >= 6 ? `<p class="small soft">Improved Circle Forms: your attacks can deal Radiant damage instead, and you add your Wisdom modifier to Constitution saves.</p>` : ""}
    <p class="small soft">You keep your HP, Hit Dice, Intelligence, Wisdom, Charisma, class features and feats. You can't cast spells${w.moon ? " (except your Circle of the Moon spells)" : ""}. The form ends if you drop to 0 HP, after ${Math.floor(w.L / 2)} hours, or when you end it as a Bonus Action.</p>
    <div class="row"><button class="btn grow" data-act="ws-open">Change form</button><button class="btn grow" data-act="ws-end">Return to normal</button></div>`;
}

// ---------- 4. Resources (compendium) ----------
const RES_TABS = [["spells", "Spells"], ["items", "Gear"], ["magic", "Magic Items"], ["monsters", "Monsters"], ["rules", "Rules"],
  ["feats", "Feats"], ["species", "Species"], ["classes", "Classes"], ["backgrounds", "Backgrounds"]];
const RF = { limit: 60, lvl: "all", cls: "all", school: "all", cat: "all", rarity: "all", cr: "all", type: "all", rcat: "all", fcat: "all" };
const CR_BANDS = [["all", "Any CR"], ["0-0.25", "CR 0–1/4"], ["0.5-1", "1/2–1"], ["2-4", "2–4"], ["5-10", "5–10"], ["11-16", "11–16"], ["17-30", "17+"]];
function entry(key, title, sub, body, extra = "") {
  const open = S.open[key];
  return `<div class="entry ${open ? "open" : ""}">
    <button class="entry-head" data-act="toggle-open" data-id="${esc(key)}">${extra}<span class="grow"><b>${esc(title)}</b>${sub ? `<span class="small soft" style="display:block">${sub}</span>` : ""}</span><span class="soft">${open ? "−" : "+"}</span></button>
    ${open ? `<div class="entry-body small">${body()}</div>` : ""}</div>`;
}
function statBlock(m) {
  const line = (k, v) => (v ? `<p><b>${k}</b> ${esc(v)}</p>` : "");
  const list = (title, arr) => (arr?.length ? `<div class="sub-head">${title}</div>${arr.map((x) => `<div class="sb-item"><b>${esc(x.name)}.</b> ${md(x.text)}${hasRoll(x.text) ? `<div class="spell-actions">${attackButtons(x.text, m.name + " " + x.name)}</div>` : ""}</div>`).join("")}` : "");
  return `${MONSTER_ART[m.id] ? `<div class="monster-art" style="background-image:url(${MONSTER_ART[m.id]})"></div>` : ""}<p class="soft"><i>${esc(m.size)} ${esc(m.type)}${m.subtype ? " (" + esc(m.subtype) + ")" : ""}, ${esc(m.alignment || "")}</i></p>
    <div class="statgrid"><div><span class="k">AC</span><b>${m.ac}</b></div><div><span class="k">HP</span><b>${m.hp}</b><span class="soft"> ${esc(m.hpFormula || "")}</span></div><div><span class="k">CR</span><b>${esc(m.crText)}</b><span class="soft"> ${m.xp ? m.xp.toLocaleString() + " XP" : ""}</span></div></div>
    <p><b>Speed</b> ${esc(m.speed)}</p>
    <div class="abil6">${ABILITIES.map((a) => `<div><span class="k">${a.toUpperCase()}</span><b>${m.abilities[a]}</b><span class="soft">${signed(mod(m.abilities[a]))}</span></div>`).join("")}</div>
    ${line("Saves", m.saves)}${line("Skills", m.skills)}${line("Defenses", m.defenses)}${line("Senses", m.senses)}${line("Languages", m.languages)}
    ${list("Traits", m.traits)}${list("Actions", m.actions)}${list("Bonus Actions", m.bonusActions)}${list("Reactions", m.reactions)}
    ${m.legendary?.length ? `<div class="sub-head">Legendary Actions</div>${m.legendaryIntro ? md(m.legendaryIntro) : ""}${m.legendary.map((x) => `<div class="sb-item"><b>${esc(x.name)}.</b> ${md(x.text)}</div>`).join("")}` : ""}`;
}
function addButton(kind, id) {
  return S.charId && C() ? `<button class="btn small" data-act="res-add" data-id="${kind}|${esc(id)}">＋ Add to ${esc(C().name || "character")}</button>` : "";
}
function viewResources() {
  const tab = S.resTab || "spells";
  const limitNote = (n) => (n > RF.limit ? `<button class="btn ghost" data-act="res-more">Show more (${n - RF.limit} left)</button>` : "");
  const cap = (s) => String(s).replace(/(^|[\s-])\w/g, (x) => x.toUpperCase());
  let filters = "", list = [], rows = "";
  if (tab === "spells") {
    const classes = [...new Set(Object.values(DB.spells).flatMap((s) => s.classes))].sort();
    const schools = [...new Set(Object.values(DB.spells).map((s) => s.school))].sort();
    list = search(Object.values(DB.spells).filter((s) => allowed(s) && (RF.lvl === "all" || s.level === +RF.lvl) && (RF.cls === "all" || s.classes.includes(RF.cls)) && (RF.school === "all" || s.school === RF.school))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)), (s) => `${s.school} ${s.castingTime} ${s.range} ${s.text}`);
    filters = chips([{ id: "lvl|all", label: "All levels", on: RF.lvl === "all" }, ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => ({ id: "lvl|" + l, label: l ? ordinal(l) : "Cantrip", on: RF.lvl === String(l) }))], "rf")
      + chips([{ id: "cls|all", label: "Any class", on: RF.cls === "all" }, ...classes.map((x) => ({ id: "cls|" + x, label: cap(x), on: RF.cls === x }))], "rf")
      + chips([{ id: "school|all", label: "Any school", on: RF.school === "all" }, ...schools.map((x) => ({ id: "school|" + x, label: x, on: RF.school === x }))], "rf");
    rows = list.slice(0, RF.limit).map((s) => entry("rs:" + s.id, s.name, `${s.level ? ordinal(s.level) + " level" : "Cantrip"} ${esc(s.school)} · ${esc(s.castingTime)} · ${esc(s.range)}${s.concentration ? " · Conc." : ""}${s.ritual ? " · Ritual" : ""} ${sourceBadge(s.source)}`,
      () => `${md(s.text + (s.higherLevels ? "\n\n**Higher levels.** " + s.higherLevels : ""))}<p class="soft">${esc(s.components)} · ${esc(s.duration)} · ${esc(s.classes.map(cap).join(", "))}</p>`)).join("");
  } else if (tab === "items") {
    const eq = DB.raw.equipment;
    const cats = [["weapons", "Weapons", eq.weapons], ["armor", "Armor", eq.armor], ["gear", "Gear", eq.gear], ["tools", "Tools", eq.tools]];
    list = search(cats.filter(([k]) => RF.cat === "all" || RF.cat === k).flatMap(([k, , items]) => items.map((x) => ({ ...x, _k: k }))).sort(byName), (x) => itemMeta(x._k, x));
    filters = chips([["all", "All"], ...cats.map(([k, l]) => [k, l])].map(([id, l]) => ({ id: "cat|" + id, label: l, on: RF.cat === id })), "rf");
    rows = list.slice(0, RF.limit).map((x) => entry("ri:" + x.name, x.name, `${esc(itemMeta(x._k, x).slice(0, 90))}${x.cost ? " · " + esc(x.cost) : ""}`,
      () => `${ITEM_ART[slug(x.name)] ? `<div class="item-hero" style="background-image:url(${ITEM_ART[slug(x.name)]})"></div>` : ""}<p style="color:var(--gold)">${esc(itemMeta(x._k, x))}</p>${x.text ? md(x.text) : ""}<p class="soft">${x.weight ? x.weight + " lb · " : ""}${esc(x.cost || "")}</p>${addButton("gear", x.name)}`,
      `<span class="thumb" ${ITEM_ART[slug(x.name)] ? `style="background-image:url(${ITEM_ART[slug(x.name)]})"` : ""}></span>`)).join("");
  } else if (tab === "magic") {
    const cats = [...new Set(MAGIC.map((m) => m.category))].sort();
    list = search(MAGIC.filter((m) => allowed(m) && (RF.rarity === "all" || m.rarity === RF.rarity) && (RF.cat === "all" || m.category === RF.cat)).sort(byName), (m) => `${m.category} ${m.rarity} ${m.text}`);
    filters = chips([{ id: "rarity|all", label: "Any rarity", on: RF.rarity === "all" }, ...RARITIES.map((r) => ({ id: "rarity|" + r, label: r, on: RF.rarity === r }))], "rf")
      + chips([{ id: "cat|all", label: "Any type", on: RF.cat === "all" }, ...cats.map((x) => ({ id: "cat|" + x, label: x, on: RF.cat === x }))], "rf");
    rows = list.slice(0, RF.limit).map((m) => entry("rm:" + m.id, m.name, `<span class="rar rar-${rarityKey(m.rarity)}">${esc(m.rarity)}</span> · ${esc(m.category)}${m.attunement ? " · Attunement" : ""} ${sourceBadge(m.source)}`,
      () => `${ITEM_ART["m:" + m.id] ? `<div class="item-hero" style="background-image:url(${ITEM_ART["m:" + m.id]})"></div>` : ""}${md(m.text)}${typeof m.attunement === "string" ? `<p class="soft">Requires attunement ${esc(m.attunement)}</p>` : ""}${addButton("magic", m.id)}`,
      `<span class="thumb" ${ITEM_ART["m:" + m.id] ? `style="background-image:url(${ITEM_ART["m:" + m.id]})"` : ""}></span>`)).join("");
  } else if (tab === "monsters") {
    const types = [...new Set(MONSTERS.map((m) => m.type))].sort();
    const [lo, hi] = RF.cr === "all" ? [0, 99] : RF.cr.split("-").map(Number);
    list = search(MONSTERS.filter((m) => m.cr >= lo && m.cr <= hi && (RF.type === "all" || m.type === RF.type)).sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name)),
      (m) => `${m.type} ${m.size} ${m.alignment} ${(m.traits || []).map((t) => t.name).join(" ")}`);
    filters = chips(CR_BANDS.map(([id, l]) => ({ id: "cr|" + id, label: l, on: RF.cr === id })), "rf")
      + chips([{ id: "type|all", label: "Any type", on: RF.type === "all" }, ...types.map((x) => ({ id: "type|" + x, label: x, on: RF.type === x }))], "rf");
    rows = list.slice(0, RF.limit).map((m) => entry("rmo:" + m.id, m.name, `CR ${esc(m.crText)} · ${esc(m.size)} ${esc(m.type)} · AC ${m.ac} · HP ${m.hp}`, () => statBlock(m),
      `<span class="thumb" ${MONSTER_ART[m.id] ? `style="background-image:url(${MONSTER_ART[m.id]})"` : ""}></span>`)).join("");
  } else if (tab === "rules") {
    const cats = [...new Set(RULES.map((r) => r.category))];
    list = search(RULES.filter((r) => RF.rcat === "all" || r.category === RF.rcat).map((r) => ({ ...r, name: r.title })).sort(byName), (r) => r.text);
    filters = chips([{ id: "rcat|all", label: "All", on: RF.rcat === "all" }, ...cats.map((x) => ({ id: "rcat|" + x, label: x, on: RF.rcat === x }))], "rf");
    rows = list.slice(0, RF.limit).map((r) => entry("rr:" + r.id, r.title, esc(r.category), () => md(r.text))).join("");
  } else if (tab === "feats") {
    const label = { origin: "Origin", general: "General", "fighting-style": "Fighting Style", "epic-boon": "Epic Boon" };
    list = search(Object.values(DB.feats).filter((f) => allowed(f) && (RF.fcat === "all" || f.category === RF.fcat)).sort(byName), (f) => `${f.prereq?.text || ""} ${f.text} ${f.group || ""}`);
    filters = chips([{ id: "fcat|all", label: "All", on: RF.fcat === "all" }, ...Object.entries(label).map(([k, l]) => ({ id: "fcat|" + k, label: l, on: RF.fcat === k }))], "rf");
    rows = list.slice(0, RF.limit).map((f) => entry("rf:" + f.id, f.name, `${esc(f.group || label[f.category] || "")}${f.prereq?.text ? " · " + esc(f.prereq.text) : ""} ${sourceBadge(f.source)}`, () => md(f.text))).join("");
  } else if (tab === "species") {
    list = search(Object.values(DB.species).filter(allowed).sort(byName), (s) => (s.traits || []).map((t) => t.name + " " + t.text).join(" "));
    rows = list.slice(0, RF.limit).map((s) => entry("rsp:" + s.id, s.name, `Speed ${s.speed}${s.darkvision ? " · Darkvision " + s.darkvision : ""} · ${(s.size || []).join(" or ")} ${sourceBadge(s.source)}`,
      () => (s.traits || []).map((t) => `<p><b>${esc(t.name)}.</b></p>${md(t.text)}`).join("") + (s.lineages?.length ? `<div class="sub-head">Lineages</div>${s.lineages.map((l) => `<p><b>${esc(l.name)}.</b></p>${md(l.text)}`).join("")}` : ""))).join("");
  } else if (tab === "classes") {
    list = search(Object.values(DB.classes).filter(allowed).sort(byName), (c) => (c.features || []).map((f) => f.name).join(" "));
    rows = list.map((k) => entry("rc:" + k.id, k.name, `d${k.hitDie} · ${(k.primaryAbility || []).map((a) => ABILITY_NAMES[a]).join(" or ")} ${sourceBadge(k.source)}`,
      () => `<p>${esc(k.description || "")}</p><p><b>Saves</b> ${(k.saves || []).map((a) => ABILITY_NAMES[a]).join(", ")} · <b>Armor</b> ${esc(k.armor || "None")} · <b>Weapons</b> ${esc(k.weapons || "")}</p>
        ${(k.features || []).map((f) => `<p><b>Level ${f.level}: ${esc(f.name)}.</b></p>${md(f.text)}`).join("")}
        <div class="sub-head">Subclasses</div>${Object.values(DB.subclasses).filter((s) => s.classId === k.id && allowed(s)).sort(byName).map((s) => `<p><b>${esc(s.name)}</b> ${sourceBadge(s.source)}<br><span class="soft">${esc(s.description || "")}</span></p>`).join("")}`)).join("");
  } else if (tab === "backgrounds") {
    list = search(Object.values(DB.backgrounds).filter(allowed).sort(byName), (b) => `${b.text} ${(b.skills || []).join(" ")} ${b.tool}`);
    rows = list.slice(0, RF.limit).map((b) => entry("rb:" + b.id, b.name, `${b.abilities.map((a) => a.toUpperCase()).join(" · ")} · ${esc(DB.feats[b.feat]?.name || b.feat || "")} ${sourceBadge(b.source)}`,
      () => `${b.text ? md(b.text) : ""}<p><b>Skills</b> ${esc((b.skills || []).join(", "))} · <b>Tool</b> ${esc(b.tool || "—")}</p><p><b>Equipment</b> ${esc((b.equipment || []).map((o) => `(${o.option}) ${[...o.items, o.gp ? o.gp + " GP" : ""].filter(Boolean).join(", ")}`).join("; "))}</p>`)).join("");
  }
  return `
    <div class="topbar">
      <button class="btn icon ghost" data-act="res-back" aria-label="Back">←</button>
      <h1>Resources</h1>
    </div>
    <nav class="steps">${RES_TABS.map(([k, l]) => `<button class="${k === tab ? "on" : ""}" data-act="res-tab" data-id="${k}">${l}</button>`).join("")}</nav>
    <div class="section">
      ${searchBox(`Search ${RES_TABS.find((t) => t[0] === tab)[1].toLowerCase()}`, list.length)}
      ${filters}
      <div class="list">${rows || '<p class="muted">Nothing matches. Try fewer words or clear a filter.</p>'}</div>
      ${tab !== "classes" ? limitNote(list.length) : ""}
    </div>`;
}

// ---------- actions for all of the above ----------
Object.assign(ACTIONS, {
  "roll-mode": (el) => { S.rollMode = el.dataset.id; S.keepScroll = true; render(); },
  "cast-ask": (el) => {
    const [id, ability] = idParts(el);
    const c = C(), sp = DB.spells[id];
    const first = castOptions(c, sp).find((o) => o.left > 0);
    CAST = { spId: id, ability, choice: first ? first.id : null };
    showCast();
  },
  "cast-pick": (el) => { CAST.choice = el.dataset.id; showCast(); },
  "cast-go": () => doCast(),
  "roll-spell": (el) => { const [id, ability, lvl] = idParts(el); spellRollToast(C(), DB.spells[id], +lvl, ability); },
  "ws-open": () => showWildShapePicker(),
  "ws-filter": (el) => { WSF.known = el.dataset.id === "known"; WSF.locked = el.dataset.id === "locked"; showWildShapePicker(); },
  "ws-known": (el) => { S.keepScroll = true; update((c) => { c.wsKnown = c.wsKnown || []; toggleIn(c.wsKnown, el.dataset.id); }); showWildShapePicker(); },
  "ws-go": (el) => {
    const id = el.dataset.id;
    const c = C();
    const res = resources(c, DB).find((r) => /wild shape/i.test(r.name));
    const go = () => { closeModal(); S.tab = "wildshape"; S.keepScroll = false; update((c) => { if (c.wildShape) c.wildShape.form = id; else startWildShape(c, id); });
      window.scrollTo(0, 0); toast(`${isAltForm(id) ? "" : "You shift into a "}${esc(formOf(id).name)}.${isAltForm(id) ? "" : ` +${wsInfo(C()).temp} temp HP.`}`, 2500); };
    if (!c.wildShape && res && res.max - res.spent <= 0) {
      modal(`<h2>No Wild Shape uses left</h2><p>You've used all ${res.max}. They come back on a Long Rest (one on a Short Rest).</p>
        <button class="btn primary" data-act="ws-force" data-id="${id}">Shift anyway</button><button class="btn" data-act="close-modal">Cancel</button>`);
      return;
    }
    go();
  },
  "ws-force": (el) => { const id = el.dataset.id; closeModal(); S.tab = "wildshape"; update((c) => startWildShape(c, id)); window.scrollTo(0, 0); },
  "ws-end": () => { closeModal(); S.tab = "overview"; S.keepScroll = true; update((c) => endWildShape(c)); toast("You return to your normal form. Wild Shape temp HP removed.", 2500); },
  "res-open": () => { S.prevView = S.view; S.view = "resources"; S.filter = ""; RF.limit = 60; render(); window.scrollTo(0, 0); },
  "res-back": () => { S.view = S.prevView && S.prevView !== "resources" ? S.prevView : "list"; S.filter = ""; render(); window.scrollTo(0, 0); },
  "res-tab": (el) => { S.resTab = el.dataset.id; S.filter = ""; RF.limit = 60; RF.cat = "all"; render(); window.scrollTo(0, 0); },
  "rf": (el) => { const [k, v] = idParts(el); RF[k] = v; RF.limit = 60; S.keepScroll = true; render(); },
  "res-more": () => { RF.limit += 60; S.keepScroll = true; render(); },
  "res-add": (el) => {
    const [kind, id] = idParts(el);
    if (kind === "gear") { S.keepScroll = true; update((c) => addToPack(c, id)); toast(`Added ${esc(id)} to ${esc(C().name)}.`, 1800); }
    if (kind === "magic") {
      const m = MAGIC_BY_ID[id];
      CI = customFromMagic(m);
      if (m.baseKind && m.bases?.length !== 1) { showCustomItem(); return; }
      S.keepScroll = true; update((c) => saveCustomItem(c)); toast(`Added ${esc(m.name)} to ${esc(C().name)}.`, 1800);
    }
  },
});

ensureExample();
render();
