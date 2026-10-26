// ============================================================
// app.js — the phone UI. Renders screens as HTML strings and
// handles taps through `data-act` attributes (one click handler).
// ============================================================

// ---------- rules database ----------
const DB = (() => {
  const raw = window.DND_DATA;
  const byId = (arr) => Object.fromEntries((arr || []).map((x) => [x.id, x]));
  const db = {
    raw,
    classes: byId(raw.classes), subclasses: byId(raw.subclasses), species: byId(raw.species),
    backgrounds: byId(raw.backgrounds), feats: byId(raw.feats), spells: byId(raw.spells), options: byId(raw.options),
    armorByName: {}, weaponByName: {}, gearByName: {},
  };
  for (const a of raw.equipment.armor) db.armorByName[a.name] = a;
  for (const w of raw.equipment.weapons) db.weaponByName[w.name] = w;
  for (const g of [...raw.equipment.gear, ...raw.equipment.tools]) db.gearByName[g.name] = g;
  return db;
})();
const BOOKS = [...new Set(Object.values(DB.raw).filter(Array.isArray).flat().map((x) => x.source).filter(Boolean))].sort((a, b) =>
  a === "SRD 5.2" ? -1 : b === "SRD 5.2" ? 1 : a === "Player's Handbook" ? -1 : b === "Player's Handbook" ? 1 : a.localeCompare(b));

// ---------- saved state (lives in this phone's browser) ----------
// ---------- portrait library ----------
const PORTRAITS = window.PORTRAITS || [];
const PORTRAIT_BY_ID = Object.fromEntries(PORTRAITS.map((p) => [p.id, p]));
const ART_RACES = { human: ["human", "half-elf"], elf: ["elf", "half-elf"], dwarf: ["dwarf"], halfling: ["halfling"], gnome: ["gnome"],
  orc: ["half-orc"], tiefling: ["tiefling"], dragonborn: ["dragonborn"], goliath: ["goliath"], aasimar: ["aasimar"] };
// A character's picture: their own upload wins, then the gallery portrait they picked.
const portraitSrc = (c) => c?.portrait || PORTRAIT_BY_ID[c?.portraitId]?.src || null;

// ---------- item art & magic items ----------
const ITEM_ART = window.ITEM_ART || {};
const MAGIC = (DB.raw["magic-items"] || []);
const MAGIC_BY_ID = Object.fromEntries(MAGIC.map((m) => [m.id, m]));
const RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact", "Varies"];
const RARITY_COLOR = { common: "#b4b4b4", uncommon: "#3fd16a", rare: "#4aa3ff", "very-rare": "#b46cff", legendary: "#f0a43c", artifact: "#ff5a5a", varies: "#c8aa6e" };
const rarityKey = (r) => slug(r || "varies");
// Picture for an inventory item: its own upload, then magic item art, then the base item's art.
// Generic "+1 Weapon"-style items show their base item's art (a +2 Greataxe looks like a greataxe).
const GENERIC_MAGIC = /^plus-\d-(weapon|armor|shield|ammunition)$/;
const itemArt = (i) => i.img || (i.magicId && GENERIC_MAGIC.test(i.magicId) && i.ref && ITEM_ART[slug(i.ref)])
  || (i.magicId && ITEM_ART["m:" + i.magicId]) || ITEM_ART[slug(i.name)] || (i.ref && ITEM_ART[slug(i.ref)])
  || (/\b(arrows?|bolts?|bullets?|needles?)\b/i.test(i.name) ? ITEM_ART["ammunition"] : null) || null;

// Keep the browser storage key from the app's first name, so nobody loses saved characters.
const STORE_KEY = "heroforge2024";
function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch { return null; }
}
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ chars: S.chars, books: S.books })); S.storageWarned = false; }
  catch {
    // Storage blocked or full: keep working in memory, and say so once.
    if (!S.storageWarned && typeof toast === "function") toast("This phone's browser storage is full, so changes aren't being saved. Remove a portrait or delete an old character, then Save to phone.", 8000);
    S.storageWarned = true;
  }
}
const stored = loadStore();
const S = {
  chars: stored?.chars || [],
  books: stored?.books || Object.fromEntries(BOOKS.map((b) => [b, true])),
  view: "list", charId: null, step: "basics", tab: "overview", sub: {}, editing: false,
  open: {}, filter: "", spellTab: null, rollMode: "normal",
};
for (const b of BOOKS) if (!(b in S.books)) S.books[b] = true;
const allowed = (x) => !x?.source || S.books[x.source] !== false;
const C = () => S.chars.find((c) => c.id === S.charId);

// ---------- new character ----------
const uid = () => Math.random().toString(36).slice(2, 10);
function newCharacter() {
  return {
    id: uid(), created: Date.now(), name: "", player: "", alignment: "",
    classes: [{ id: "fighter", level: 1, subclass: null }],
    species: null, lineage: null, size: null, speciesAbility: null,
    background: null, bgBonus: {}, bgEquip: "A", classEquip: "A",
    scoreMethod: "standard", base: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }, rolls: [], rollAssign: {}, overOk: {},
    feats: [], skills: [], expertise: [], masteries: [], options: [],
    languages: "Common", tools: "", spells: {},
    inventory: [], coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, equipApplied: false,
    hp: { current: null, temp: 0, maxOverride: null }, hitDiceSpent: {}, deathSaves: { s: 0, f: 0 },
    slotsSpent: [0, 0, 0, 0, 0, 0, 0, 0, 0], pactSpent: 0, resSpent: {},
    conditions: [], exhaustion: 0, inspiration: false,
    acBonus: 0, speedBonus: 0, hpBonus: 0, initBonus: 0,
    notes: "", appearance: "", backstory: "",
  };
}
function exampleCharacter() {
  const c = newCharacter();
  Object.assign(c, {
    example: true, name: "Brenna Ashfall", player: "Example", alignment: "Neutral Good",
    classes: [{ id: "fighter", level: 3, subclass: "fighter-champion" }],
    species: "dwarf", background: "soldier", bgBonus: { str: 2, con: 1 },
    base: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    feats: [{ id: "savage-attacker", slot: "background" }, { id: "great-weapon-fighting", slot: "fighter:style" }],
    skills: ["Athletics", "Intimidation", "Perception", "Survival"], masteries: ["Greatsword", "Javelin", "Flail"],
    languages: "Common, Dwarvish, Orc", tools: "Gaming Set (dice)",
    backstory: "Held the Ironhold gate for eleven days. Still counts the names of the ones who didn't come home.",
  });
  applyEquipment(c);
  return c;
}
// First visit: add an example character (called once everything has loaded; see the end of extras.js).
function ensureExample() {
  if (S.chars.length || !DB.classes.fighter || !DB.species.dwarf) return;
  try { S.chars.push(exampleCharacter()); } catch (e) { console.warn("Example character skipped", e); }
}

// ---------- tiny helpers ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const byName = (a, b) => a.name.localeCompare(b.name);
function md(text) {
  // Small Markdown renderer: paragraphs, **bold**, _italic_, bullet lists and tables.
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|\W)[_*](.+?)[_*](?=\W|$)/g, "$1<i>$2</i>");
  const out = [];
  const blocks = String(text || "").replace(/\r/g, "").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (!lines.length) continue;
    if (lines.every((l) => l.trim().startsWith("|"))) {
      const rows = lines.filter((l) => !/^\|\s*:?-+/.test(l.trim())).map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((x) => x.trim()));
      out.push(`<div class="tablewrap"><table>${rows.map((r, i) => `<tr>${r.map((x) => (i ? `<td>${inline(x)}</td>` : `<th>${inline(x)}</th>`)).join("")}</tr>`).join("")}</table></div>`);
    } else if (lines.every((l) => /^\s*[-•o*]\s|^\s*o\t/.test(l))) {
      out.push(`<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*([-•*]|o)\s+/, ""))}</li>`).join("")}</ul>`);
    } else {
      out.push(`<p>${lines.map(inline).join("<br>")}</p>`);
    }
  }
  return `<div class="md">${out.join("")}</div>`;
}
const sourceBadge = (src) => src ? `<span class="badge ${src === "SRD 5.2" ? "srd" : ""}">${esc(src === "SRD 5.2" ? "SRD" : src)}</span>` : "";
const icon = (name) => ({
  main: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/></svg>',
  skills: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  actions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 19L19 5M14 5h5v5M5 14l5 5M3 21l3-3"/></svg>',
  spells: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 016 0v2"/></svg>',
  features: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h3"/></svg>',
}[name]);

function persist() { saveStore(); }
function update(fn) { const c = C(); if (c) fn(c); persist(); render(); }

// ============================================================
// RENDER
// ============================================================
const app = document.getElementById("app");
const layer = document.getElementById("layer");
function render() {
  const keepScroll = window.scrollY;
  if (S.view === "list") app.innerHTML = viewList();
  else if (S.view === "build") app.innerHTML = viewBuild();
  else if (S.view === "sheet") app.innerHTML = viewSheet();
  else if (S.view === "resources") app.innerHTML = viewResources();
  if (S.keepScroll) window.scrollTo(0, keepScroll);
  S.keepScroll = false;
}

// ---------- character list ----------
function summaryLine(c) {
  const sp = DB.species[c.species]?.name || "No species";
  const cls = c.classes.map((k) => `${DB.classes[k.id]?.name || k.id} ${k.level}`).join(" / ");
  return `${sp} · ${cls}`;
}
function viewList() {
  const cards = S.chars.map((c) => `
    <button class="champ" data-act="open" data-id="${c.id}">
      <span class="art" ${portraitSrc(c) ? `style="background-image:url(${portraitSrc(c)})"` : ""}>${portraitSrc(c) ? "" : esc((c.name || "?")[0])}</span>
      <span class="cap"><b>${esc(c.name || "Unnamed hero")}</b><span>${esc(summaryLine(c))}</span>
        <span class="row" style="gap:6px;margin-top:4px"><span class="badge srd">Level ${totalLevel(c)}</span>${c.example ? '<span class="badge warn">Example</span>' : ""}</span></span>
    </button>`).join("");
  return `
    <div class="topbar"><h1>5e Character Builder</h1>
      <button class="nav-link" data-act="res-open">Resources</button>
      <button class="nav-link" data-act="settings">Books</button>
      <button class="nav-link" data-act="import">Import</button></div>
    <div class="splash">${boltsSVG()}
      <div class="logo"><small>[2024]</small>5e Character<br>Builder</div>
      <p>Build a character step by step, then track HP, spell slots and gear at the table. Everything stays on this phone.</p>
      <button class="btn primary" data-act="new">Create a character</button>
    </div>
    <div class="section"><div class="head"><h4>Your characters</h4><span class="legend">${S.chars.length}</span></div>
      ${cards ? `<div class="roster">${cards}</div>` : '<p class="muted">No characters yet. Tap Create a character to forge your first.</p>'}
    </div>
    <div class="section small soft"><p>Characters stay in this browser. Open one and tap <b>More → Save to phone</b> to keep a .json copy in your Files.</p>
      <p>Rules text from the SRD 5.2 (CC-BY-4.0); other books are short summaries.</p></div>`;
}

// ============================================================
// BUILDER (used for creating AND editing)
// ============================================================
const STEPS = [
  ["basics", "Basics"], ["class", "Class"], ["background", "Background"], ["species", "Species"], ["abilities", "Abilities"],
  ["skills", "Skills"], ["feats", "Feats"], ["equipment", "Equipment"], ["spells", "Spells"], ["review", "Review"],
];
function viewBuild() {
  const c = C();
  const todo = pendingChoices(c, DB);
  const todoSections = new Set(todo.map((t) => t.section));
  const idx = STEPS.findIndex((s) => s[0] === S.step);
  const body = {
    basics: stepBasics, class: stepClass, background: stepBackground, species: stepSpecies, abilities: stepAbilities,
    skills: stepSkills, feats: stepFeats, equipment: stepEquipment, spells: stepSpells, review: stepReview,
  }[S.step](c, todo);
  return `
    <div class="topbar">
      <button class="btn icon ghost" data-act="${S.editing ? "done-edit" : "home"}" aria-label="Back">←</button>
      <h1>${S.editing ? "Edit " + esc(c.name || "character") : "New character"}</h1>
      ${S.editing ? '<button class="btn small primary" data-act="done-edit">Done</button>' : ""}
    </div>
    <nav class="steps">${STEPS.map(([k, label]) => `<button class="${k === S.step ? "on" : ""} ${todoSections.has(k) ? "todo" : ""}" data-act="step" data-step="${k}">${label}</button>`).join("")}</nav>
    ${body}
    ${S.editing ? "" : `<div class="footer"><div class="inner">
      <button class="btn" data-act="step" data-step="${STEPS[Math.max(idx - 1, 0)][0]}" ${idx === 0 ? "disabled" : ""}>Back</button>
      ${idx < STEPS.length - 1
        ? `<button class="btn primary" data-act="step" data-step="${STEPS[idx + 1][0]}">Next: ${STEPS[idx + 1][1]}</button>`
        : `<button class="btn primary" data-act="finish">Create character</button>`}
    </div></div>`}`;
}

// A selectable card with an expandable description.
function pickCard({ act, id, on, title, sub, text, src, multi, locked, extra }) {
  const key = act + ":" + id;
  const open = S.open[key];
  return `<div class="stack" style="gap:0">
    <button class="pick ${on ? "on" : ""} ${multi ? "multi" : ""} ${locked ? "locked" : ""}" data-act="${locked ? "" : act}" data-id="${esc(id)}">
      <span class="check"></span>
      <span class="grow"><span class="row" style="gap:6px"><b>${esc(title)}</b> ${sourceBadge(src)} ${extra || ""}</span>
        ${sub ? `<span class="muted small" style="display:block">${esc(sub)}</span>` : ""}</span>
      ${text ? `<span class="btn small ghost" data-act="toggle-open" data-id="${esc(key)}" role="button" aria-label="Details">${open ? "Less" : "More"}</span>` : ""}
    </button>
    ${open && text ? `<div class="card small" style="border-top:0;border-radius:0 0 10px 10px">${md(text)}</div>` : ""}
  </div>`;
}
// ---------- search ----------
// Every typed word must appear in the name or the entry's text (so "fire 60 feet" works).
// Name matches rank first, then text-only matches.
function search(list, textOf = () => "") {
  const q = S.filter.trim().toLowerCase();
  if (!q) return list;
  const words = q.split(/\s+/);
  return list.map((x) => {
    const name = x.name.toLowerCase();
    if (!wordsMatch(name, textOf(x).toLowerCase(), words)) return null;
    return [x, name.startsWith(q) ? 3 : words.every((w) => name.includes(w)) ? 2 : 1];
  }).filter(Boolean).sort((a, b) => b[1] - a[1]).map(([x]) => x);
}
function searchBox(placeholder, count, id = "filter", value = S.filter, bind = "data-bind-filter") {
  return `<div class="search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.5-4.5"/></svg>
    <input type="search" id="${id}" placeholder="${placeholder}" value="${esc(value)}" ${bind} autocomplete="off" aria-label="${placeholder}">
    ${value ? `<button class="clear" data-act="clear-filter" data-id="${id}" aria-label="Clear search">✕</button>` : ""}
    <span class="count num">${count}</span>
  </div>`;
}
// Each typed word must be inside the name ("sword" finds Longsword), or start a word in the
// description ("ac 16" finds "AC 16" but not "reach").
function wordsMatch(name, text, words) {
  return words.every((w) => name.includes(w) || new RegExp("(^|[^a-z0-9])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(text));
}
// A row of filter chips. items: [{ id, label, on }]
function chips(items, act) {
  return `<div class="chips">${items.map((i) => `<button class="chip ${i.on ? "on" : ""}" data-act="${act}" data-id="${esc(i.id)}">${esc(i.label)}</button>`).join("")}</div>`;
}
const F = { bgAb: null, sp: {}, featGroup: "all", hideUnavail: false, onlyChosen: false, lvl: "all", school: "all", conc: false, ritual: false, chosen: false };

// ---------- step: basics ----------
function stepBasics(c) {
  return `<div class="section">
    <div class="field"><label class="label" for="f-name">Character name</label><input type="text" id="f-name" data-bind="name" value="${esc(c.name)}" placeholder="e.g. Brenna Ashfall"></div>
    <div class="field"><label class="label" for="f-player">Player</label><input type="text" id="f-player" data-bind="player" value="${esc(c.player)}"></div>
    <div class="field"><label class="label" for="f-align">Alignment</label>
      <select id="f-align" data-bind="alignment">${["", "Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "Neutral", "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil", "Unaligned"]
        .map((a) => `<option ${a === c.alignment ? "selected" : ""} value="${a}">${a || "Choose…"}</option>`).join("")}</select></div>
    <div class="field"><span class="label">Portrait</span>
      <div class="portrait-pick"><span class="thumb" ${portraitSrc(c) ? `style="background-image:url(${portraitSrc(c)})"` : ""}>${portraitSrc(c) ? "" : "?"}</span>
        <div class="stack" style="gap:6px"><button class="btn small" data-act="portrait">${portraitSrc(c) ? "Change portrait" : "Choose a portrait"}</button>
        <span class="small soft">${PORTRAITS.length} portraits to pick from, or upload your own. Pick your species first to see matching art.</span></div></div></div>
    <p class="muted small">The 2024 order: pick a class, then your origin (background and species), then ability scores. You can come back to any step.</p>
  </div>`;
}

// ---------- step: class ----------
function stepClass(c) {
  const classes = Object.values(DB.classes).filter(allowed).sort(byName);
  const rows = c.classes.map((k, i) => {
    const cls = DB.classes[k.id];
    const subs = Object.values(DB.subclasses).filter((s) => s.classId === k.id && allowed(s)).sort(byName);
    const subOpen = k.level >= (cls?.subclassLevel || 3);
    return `<div class="section">
      <div class="row"><h2 class="grow">${i === 0 ? "Starting class" : "Multiclass"}</h2>
        ${i > 0 ? `<button class="btn small danger" data-act="remove-class" data-i="${i}">Remove</button>` : ""}</div>
      <div class="row">
        <div class="field grow"><label class="label" for="cls-${i}">Class</label>
          <select id="cls-${i}" data-act-change="set-class" data-i="${i}">${classes.map((x) => `<option value="${x.id}" ${x.id === k.id ? "selected" : ""}>${esc(x.name)}${x.source !== "SRD 5.2" ? " · " + esc(x.source) : ""}</option>`).join("")}</select></div>
        <div class="field" style="width:96px"><label class="label" for="lvl-${i}">Level</label>
          <select id="lvl-${i}" data-act-change="set-level" data-i="${i}">${Array.from({ length: 20 }, (_, n) => `<option ${n + 1 === k.level ? "selected" : ""}>${n + 1}</option>`).join("")}</select></div>
      </div>
      ${cls ? `<div class="card small stack" style="gap:6px">
        <p>${esc(cls.description || "")}</p>
        <p><b>Hit Die</b> d${cls.hitDie} · <b>Saves</b> ${(cls.saves || []).map((a) => ABILITY_NAMES[a]).join(", ")}</p>
        <p><b>Primary</b> ${(cls.primaryAbility || []).map((a) => ABILITY_NAMES[a]).join(" or ")}</p>
        <p><b>Armor</b> ${esc(cls.armor || "None")} · <b>Weapons</b> ${esc(cls.weapons || "")}</p>
        ${cls.spellcasting ? `<p><b>Spellcasting</b> ${ABILITY_NAMES[cls.spellcasting.ability]} (${cls.spellcasting.progression} caster)</p>` : ""}
      </div>` : ""}
      ${subs.length ? `<div class="label">Subclass ${subOpen ? "" : `(chosen at level ${cls?.subclassLevel || 3})`}</div>
        <div class="list">${subs.map((s) => pickCard({ act: "set-subclass", id: i + "|" + s.id, on: k.subclass === s.id, title: s.name, sub: s.description, src: s.source,
          text: (s.features || []).map((f) => `**Level ${f.level}: ${f.name}.** ${f.text}`).join("\n\n"), locked: !subOpen })).join("")}</div>` : ""}
    </div>`;
  }).join("");
  const canAdd = Object.values(DB.classes).filter((x) => allowed(x) && !c.classes.some((k) => k.id === x.id));
  return `${rows}
    <div class="section">
      <div class="label">Add a multiclass</div>
      <p class="muted small">Needs 13+ in the class's main ability (and in your first class's). Total level is the sum of your class levels.</p>
      <div class="row"><select id="add-class" class="grow" style="flex:1">${canAdd.sort(byName).map((x) => `<option value="${x.id}">${esc(x.name)}${multiclassOK(c, DB, x.id) ? "" : " (needs " + esc(x.multiclass?.prereq || "13") + ")"}</option>`).join("")}</select>
      <button class="btn" data-act="add-class">Add</button></div>
    </div>`;
}

// ---------- step: background ----------
function stepBackground(c) {
  const list = search(Object.values(DB.backgrounds).filter((b) => allowed(b) && (!F.bgAb || b.abilities.includes(F.bgAb))).sort(byName),
    (b) => [b.text, ...(b.skills || []), b.tool, DB.feats[b.feat]?.name, ...b.abilities.map((a) => ABILITY_NAMES[a]), b.source].join(" "));
  const bg = DB.backgrounds[c.background];
  let bonus = "";
  if (bg) {
    const total = Object.values(c.bgBonus).reduce((a, b) => a + b, 0);
    bonus = `<div class="card stack">
      <div class="label">Ability score increases from ${esc(bg.name)}</div>
      <p class="small muted">Give +2 to one and +1 to another, or +1 to all three. (${total}/3 assigned)</p>
      ${bg.abilities.map((a) => `<div class="row"><span class="grow">${ABILITY_NAMES[a]}</span>
        <div class="seg" style="width:160px">${[0, 1, 2].map((n) => `<button class="${(c.bgBonus[a] || 0) === n ? "on" : ""}" data-act="bg-bonus" data-id="${a}|${n}">+${n}</button>`).join("")}</div></div>`).join("")}
      <p class="small"><b>Skills</b> ${esc((bg.skills || []).join(", "))} · <b>Tool</b> ${esc(bg.tool || "—")} · <b>Feat</b> ${esc(DB.feats[bg.feat]?.name || bg.feat || "—")}</p>
    </div>`;
  }
  return `<div class="section">${bonus}${searchBox("Search by name, skill, tool or feat", list.length)}
    ${chips([{ id: "", label: "Any ability", on: !F.bgAb }, ...ABILITIES.map((a) => ({ id: a, label: "+" + a.toUpperCase(), on: F.bgAb === a }))], "f-bgab")}
    <div class="list">${list.map((b) => pickCard({ act: "set-background", id: b.id, on: c.background === b.id, title: b.name, src: b.source,
      sub: `${b.abilities.map((a) => a.toUpperCase()).join(" · ")} — ${DB.feats[b.feat]?.name || b.feat}`,
      text: `${b.text || ""}\n\n**Skills:** ${(b.skills || []).join(", ")}\n\n**Tool:** ${b.tool || "—"}\n\n**Equipment:** ${(b.equipment || []).map((o) => `(${o.option}) ${[...o.items, o.gp ? o.gp + " GP" : ""].filter(Boolean).join(", ")}`).join("; ")}` })).join("")}</div></div>`;
}

// ---------- step: species ----------
function stepSpecies(c) {
  const hasSpells = (s) => !!(s.spells || s.lineages?.some((l) => l.spells && Object.keys(l.spells).length));
  const list = search(Object.values(DB.species).filter((s) => allowed(s) && (!F.sp.dark || s.darkvision) && (!F.sp.small || (s.size || []).includes("Small")) && (!F.sp.magic || hasSpells(s))).sort(byName),
    (s) => [...(s.traits || []).map((t) => t.name + " " + t.text), ...(s.lineages || []).map((l) => l.name + " " + l.text), s.creatureType, s.source].join(" "));
  const sp = DB.species[c.species];
  let extra = "";
  if (sp) {
    const sizes = sp.size || ["Medium"];
    extra = `<div class="card stack">
      <h3>${esc(sp.name)}</h3>
      <p class="small">Speed ${sp.speed} ft${sp.darkvision ? ` · Darkvision ${sp.darkvision} ft` : ""} · ${esc(sp.creatureType || "Humanoid")}</p>
      ${sizes.length > 1 ? `<div class="field"><span class="label">Size</span><div class="seg">${sizes.map((z) => `<button class="${(c.size || sizes[0]) === z ? "on" : ""}" data-act="set-size" data-id="${z}">${z}</button>`).join("")}</div></div>` : ""}
      ${sp.lineages?.length ? `<div class="label">Lineage</div><div class="list">${sp.lineages.map((l) => pickCard({ act: "set-lineage", id: l.name, on: c.lineage === l.name, title: l.name, text: l.text })).join("")}</div>` : ""}
      ${sp.spellAbilityChoice?.length > 1 ? `<div class="field"><span class="label">Spellcasting ability for species spells</span><div class="seg">${sp.spellAbilityChoice.map((a) => `<button class="${c.speciesAbility === a ? "on" : ""}" data-act="set-species-ability" data-id="${a}">${a.toUpperCase()}</button>`).join("")}</div></div>` : ""}
    </div>`;
  }
  return `<div class="section">${extra}${searchBox("Search by name or trait (e.g. flight, poison)", list.length)}
    ${chips([{ id: "dark", label: "Darkvision", on: F.sp.dark }, { id: "small", label: "Can be Small", on: F.sp.small }, { id: "magic", label: "Innate spells", on: F.sp.magic }], "f-sp")}
    <div class="list">${list.map((s) => pickCard({ act: "set-species", id: s.id, on: c.species === s.id, title: s.name, src: s.source,
      sub: `Speed ${s.speed}${s.darkvision ? " · Darkvision " + s.darkvision : ""} · ${(s.size || []).join(" or ")}`,
      text: (s.traits || []).map((t) => `**${t.name}.** ${t.text}`).join("\n\n") })).join("")}</div></div>`;
}

// ---------- step: ability scores ----------
function stepAbilities(c) {
  const m = c.scoreMethod;
  const spent = ABILITIES.reduce((s, a) => s + (POINT_BUY_COST[c.base[a]] ?? 0), 0);
  const final = abilityScores(c, DB);
  const rolls = c.rolls || [];
  const assign = c.rollAssign || {};
  const owner = (i) => ABILITIES.find((a) => assign[a] === i);
  const picking = m === "rolled" && S.pickRoll != null;
  const cls = DB.classes[c.classes[0].id];
  const rows = ABILITIES.map((a) => {
    let control;
    if (m === "standard") {
      control = `<select id="ab-${a}" data-act-change="set-base" data-i="${a}">${STANDARD_ARRAY.map((v) => `<option ${c.base[a] === v ? "selected" : ""}>${v}</option>`).join("")}</select>`;
    } else if (m === "pointbuy") {
      control = `<div class="row" style="flex-wrap:nowrap;justify-content:flex-end"><button class="btn icon" data-act="pb" data-id="${a}|-1" ${c.base[a] <= 8 ? "disabled" : ""}>−</button>
        <span class="num" style="width:26px;text-align:center;font-family:var(--font-head);font-size:1.2rem">${c.base[a]}</span>
        <button class="btn icon" data-act="pb" data-id="${a}|1" ${c.base[a] >= 15 ? "disabled" : ""}>+</button></div>`;
    } else if (m === "rolled") {
      control = rolls.length ? `<select id="ab-${a}" data-act-change="assign-roll" data-i="${a}"><option value="">—</option>${rolls.map((r, i) => {
        const o = owner(i);
        return `<option value="${i}" ${assign[a] === i ? "selected" : ""}>${r.total}${o && o !== a ? " (" + o.toUpperCase() + ")" : ""}</option>`;
      }).join("")}</select>` : `<span class="muted" style="text-align:right">—</span>`;
    } else {
      control = `<input type="number" id="ab-${a}" min="3" max="20" value="${c.base[a]}" data-act-change="set-base" data-i="${a}">`;
    }
    const plus = final[a] - c.base[a];
    const unassigned = m === "rolled" && assign[a] === undefined;
    return `<div class="ab-row ${picking ? "target" : ""}" ${picking ? `data-act="assign-to" data-id="${a}"` : ""}>
      <span><b>${ABILITY_NAMES[a]}</b>${(cls?.primaryAbility || []).includes(a) ? ' <span class="badge srd">Primary</span>' : ""}<br>
        <span class="fin">${unassigned ? "Not assigned yet" : `${plus ? `${c.base[a]} +${plus} → ` : ""}<strong>${final[a]}</strong> (${signed(mod(final[a]))})`}</span></span>${control}</div>`;
  }).join("");
  const dupes = m === "standard" && new Set(ABILITIES.map((a) => c.base[a])).size !== 6;
  const rollBlock = m !== "rolled" ? "" : rolls.length ? `
    <p class="soft small">${picking ? "Now tap the ability that gets this roll." : "Tap a roll, then tap an ability to put it there. Or use the menus on the right. Picking a roll that's already used swaps them."}</p>
    <div class="rolls">${rolls.map((r, i) => { const o = owner(i); return `<button class="roll ${o ? "used" : ""} ${S.pickRoll === i ? "sel" : ""}" data-act="pick-roll" data-id="${i}">
      <span class="total num">${r.total}</span><span class="dice">${r.dice.map((d, j) => (j === r.drop ? `<s>${d}</s>` : d)).join(" · ")}</span>
      <span class="to">${o ? "→ " + ABILITY_NAMES[o] : S.pickRoll === i ? "Choose ability" : "Unassigned"}</span></button>`; }).join("")}</div>
    <div class="row"><button class="btn small grow" data-act="auto-assign">Best rolls to ${esc(cls?.name || "class")} abilities</button><button class="btn small ghost" data-act="reroll-ask">Roll again</button></div>`
    : `<p class="soft small">Roll four six-sided dice and drop the lowest, six times. Then you choose which ability gets each result.</p>
       <button class="btn primary" data-act="roll-stats">Roll 4d6 × 6</button>`;
  return `<div class="section">
    <div class="seg">${[["standard", "Standard"], ["pointbuy", "Point buy"], ["rolled", "Roll 4d6"], ["manual", "Manual"]].map(([k, l]) => `<button class="${m === k ? "on" : ""}" data-act="score-method" data-id="${k}">${l}</button>`).join("")}</div>
    ${m === "pointbuy" ? `<p class="num ${spent > 27 ? "badge warn" : "soft"}">${27 - spent} of 27 points left</p>` : ""}
    ${m === "standard" ? `<p class="soft small">Assign 15, 14, 13, 12, 10 and 8, once each. Picking a number that's already used swaps the two.${dupes ? ' <span class="badge warn">A number is used twice</span>' : ""}</p>` : ""}
    ${m === "manual" ? `<p class="soft small">Type your scores (for rolls made at the table, or your DM's method).</p>` : ""}
    ${rollBlock}
    <div class="stack" style="gap:6px">${rows}</div>
    ${cls ? `<p class="soft small">${esc(cls.name)} relies most on ${(cls.primaryAbility || []).map((a) => ABILITY_NAMES[a]).join(" or ")}. Your background adds +2/+1 or +1/+1/+1 on top.</p>` : ""}
  </div>`;
}
function rollAbilitySet() {
  return Array.from({ length: 6 }, () => {
    const dice = [1, 2, 3, 4].map(() => rollDie(6));
    const drop = dice.indexOf(Math.min(...dice));
    return { dice, drop, total: dice.reduce((x, y) => x + y, 0) - dice[drop] };
  }).sort((x, y) => y.total - x.total);
}
// Put roll i on ability a. If another ability has that roll, the two swap.
function assignRoll(c, a, i) {
  c.rollAssign = c.rollAssign || {};
  const prev = c.rollAssign[a];
  const other = ABILITIES.find((b) => b !== a && c.rollAssign[b] === i);
  if (other) { if (prev === undefined) delete c.rollAssign[other]; else c.rollAssign[other] = prev; }
  if (i === null) delete c.rollAssign[a]; else c.rollAssign[a] = i;
  syncRolledBase(c);
}
function syncRolledBase(c) {
  for (const a of ABILITIES) c.base[a] = c.rollAssign?.[a] !== undefined ? c.rolls[c.rollAssign[a]].total : 8;
}

// Ask once per limit (per character) before going over what the rules allow.
function guardLimit(c, key, count, limit, what, apply) {
  c.overOk = c.overOk || {};
  if (count < limit || c.overOk[key]) return apply();
  S.pendingOver = { key, apply };
  modal(`<h2>Over the limit</h2>
    <p>You can have <b>${limit}</b> ${esc(what)} right now. Taking this one makes <b>${count + 1}</b>, which is more than the rules allow.</p>
    <p class="soft small">Your DM may allow it (a magic item, a house rule). If you continue, you won't be asked about ${esc(what)} again for this character.</p>
    <button class="btn primary" data-act="over-yes">Take it anyway</button>
    <button class="btn" data-act="close-modal">Cancel</button>`);
}

// ---------- step: skills & weapon masteries ----------
function stepSkills(c) {
  const first = DB.classes[c.classes[0].id];
  const bg = DB.backgrounds[c.background];
  const bgSkills = bg?.skills || [];
  const classList = first?.skills?.from || [];
  const want = expectedSkillCount(c, DB);
  const skillRows = Object.keys(SKILLS).map((sk) => {
    const fromBg = bgSkills.includes(sk);
    const on = c.skills.includes(sk);
    const exp = c.expertise.includes(sk);
    const hint = fromBg ? "Background" : classList.includes(sk) ? (first?.name || "Class") + " list" : "";
    return `<div class="row"><button class="pick multi ${on ? "on" : ""} grow" data-act="toggle-skill" data-id="${sk}" style="padding:8px 12px">
        <span class="check"></span><span class="grow">${sk} <span class="muted small">${SKILLS[sk].toUpperCase()}</span></span>
        <span class="muted small">${hint}</span></button>
      <button class="btn small ${exp ? "primary" : ""}" data-act="toggle-expertise" data-id="${sk}" ${on ? "" : "disabled"} title="Expertise">2×</button></div>`;
  }).join("");
  const masteries = masteryCount(c, DB);
  const weapons = DB.raw.equipment.weapons.filter((w) => w.mastery).sort(byName);
  return `<div class="section">
    <p class="muted small">Choose <b>${first?.skills?.choose || 0}</b> from the ${esc(first?.name || "")} list; your background gives ${esc(bgSkills.join(" and ") || "two more")}.
      Some species and feats add more. Tap <b>2×</b> for Expertise. <span class="badge ${c.skills.length >= want ? "srd" : "warn"}">${c.skills.length}/${want}</span></p>
    <div class="list">${skillRows}</div>
  </div>
  ${masteries ? `<div class="section"><h2>Weapon Mastery</h2>
    <p class="muted small">Pick ${masteries} weapon kinds whose mastery property you can use. <span class="badge ${c.masteries.length >= masteries ? "srd" : "warn"}">${c.masteries.length}/${masteries}</span></p>
    <div class="list">${weapons.map((w) => pickCard({ act: "toggle-mastery", id: w.name, multi: true, on: c.masteries.includes(w.name), title: w.name, sub: `${w.mastery} · ${w.damage} ${w.damageType} · ${w.category}` })).join("")}</div></div>` : ""}
  <div class="section">
    <div class="field"><label class="label" for="f-lang">Languages</label><input type="text" id="f-lang" data-bind="languages" value="${esc(c.languages)}"><span class="muted small">Everyone knows Common plus two more of their choice.</span></div>
    <div class="field"><label class="label" for="f-tools">Other tool &amp; weapon proficiencies</label><input type="text" id="f-tools" data-bind="tools" value="${esc(c.tools)}" placeholder="${esc(bg?.tool || "")}"></div>
  </div>`;
}

// ---------- step: feats & class options ----------
function featSlots(c) {
  const slots = [];
  const bg = DB.backgrounds[c.background];
  if (bg) slots.push({ slot: "background", title: `Background: ${bg.name}`, cats: ["origin"], fixed: bg.feat || null });
  if (c.species === "human") slots.push({ slot: "species", title: "Human: Versatile", cats: ["origin"] });
  for (const k of c.classes) {
    const cls = DB.classes[k.id];
    if (!cls) continue;
    if ((cls.features || []).some((f) => /^fighting style$/i.test(f.name) && k.level >= f.level))
      slots.push({ slot: `${k.id}:style`, title: `${cls.name}: Fighting Style`, cats: ["fighting-style"] });
    for (const lvl of cls.asiLevels || []) if (k.level >= lvl) slots.push({ slot: `${k.id}:${lvl}`, title: `${cls.name} level ${lvl}`, cats: ["general"], level: totalLevel(c) });
    if (cls.epicBoonLevel && k.level >= cls.epicBoonLevel) slots.push({ slot: `${k.id}:boon`, title: `${cls.name} level ${cls.epicBoonLevel}: Epic Boon`, cats: ["epic-boon", "general"] });
  }
  return slots;
}
function stepFeats(c) {
  const slots = featSlots(c);
  const active = S.featSlot && slots.find((s) => s.slot === S.featSlot);
  if (active) return featPicker(c, active);
  const scores = abilityScores(c, DB);
  const slotRows = slots.map((s) => {
    const chosen = c.feats.find((f) => f.slot === s.slot);
    const feat = DB.feats[chosen?.id];
    const asiPick = feat?.asi ? `<div class="row" style="margin-top:8px">${feat.asi.from.map((a) => {
      const v = chosen.asi?.[a] || 0;
      return `<button class="chip ${v ? "on" : ""}" data-act="feat-asi" data-id="${s.slot}|${a}" ${scores[a] >= 20 && !v && feat.category !== "epic-boon" ? "disabled" : ""}>${a.toUpperCase()} ${v ? "+" + v : ""}</button>`;
    }).join("")}</div><p class="muted small">${feat.asi.amount === 2 ? "Tap one ability twice for +2, or two abilities for +1 each." : "Tap the ability to increase by 1."}</p>` : "";
    return `<div class="card stack" style="gap:6px">
      <div class="row"><span class="label grow">${esc(s.title)}</span>
        ${s.fixed ? "" : `<button class="btn small" data-act="feat-slot" data-id="${s.slot}">${feat ? "Change" : "Choose"}</button>`}</div>
      ${feat ? `<b>${esc(feat.name)}</b> ${sourceBadge(feat.source)}<div class="small">${md(feat.text)}</div>${asiPick}` : `<p class="muted">Not chosen yet</p>`}
    </div>`;
  }).join("");
  // class option lists: invocations, metamagic, maneuvers, artificer plans
  const opts = Object.values(DB.options).filter((o) => allowed(o) && c.classes.some((k) => k.id === o.classId &&
    (o.type !== "maneuver" || k.subclass === "fighter-battle-master")));
  const types = [...new Set(opts.map((o) => o.type))];
  const optHtml = types.map((t) => {
    const label = { invocation: "Eldritch Invocations", metamagic: "Metamagic", maneuver: "Maneuvers", other: "Artificer Plans" }[t] || t;
    const list = search(opts.filter((o) => o.type === t && (!F.onlyChosen || c.options.includes(o.id))).sort(byName), (o) => `${o.prereq || ""} ${o.text}`);
    return `<div class="section"><h2>${label} <span class="badge">${c.options.filter((id) => DB.options[id]?.type === t).length} chosen</span></h2>
      <div class="list">${list.map((o) => pickCard({ act: "toggle-option", id: o.id, multi: true, on: c.options.includes(o.id), title: o.name, src: o.source, sub: o.prereq || "", text: o.text })).join("")}</div></div>`;
  }).join("");
  return `<div class="section"><p class="muted small">Feats come from your background, some species, and class levels 4, 8, 12, 16 (more for Fighters and Rogues). Fighting Styles are feats too.</p>
    ${slotRows || '<p class="muted">Choose a background first.</p>'}</div>
    ${types.length ? `<div class="section">${searchBox("Search options and their effects", search(opts, (o) => `${o.prereq || ""} ${o.text}`).length)}
      ${chips([{ id: "chosen", label: "Chosen only", on: F.onlyChosen }], "f-chosen")}</div>` : ""}${optHtml}`;
}
function featPicker(c, slot) {
  const chosen = c.feats.find((f) => f.slot === slot.slot);
  const s = abilityScores(c, DB);
  const why = (f) => {
    const taken = c.feats.some((x) => x.id === f.id && x.slot !== slot.slot) && !f.repeatable;
    const lvlLow = f.prereq?.level && totalLevel(c) < f.prereq.level;
    const abilityReq = (f.prereq?.text || "").match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) 13/g) || [];
    const failsAbility = abilityReq.length && !abilityReq.some((r) => s[ABILITIES.find((a) => ABILITY_NAMES[a] === r.split(" ")[0])] >= 13);
    return taken ? "Already taken" : lvlLow ? `Needs level ${f.prereq.level}` : failsAbility ? "Prerequisite not met" : "";
  };
  const pool = Object.values(DB.feats).filter((f) => allowed(f) && slot.cats.includes(f.category)).sort(byName);
  const groupOf = (f) => f.group || { origin: "Origin", general: "General", "fighting-style": "Fighting Style", "epic-boon": "Epic Boon" }[f.category];
  const groups = [...new Set(pool.map(groupOf))];
  const list = search(pool.filter((f) => (F.featGroup === "all" || groupOf(f) === F.featGroup) && (!F.hideUnavail || !why(f))),
    (f) => `${f.prereq?.text || ""} ${f.text} ${f.group || ""} ${(f.asi?.from || []).map((a) => ABILITY_NAMES[a]).join(" ")}`);
  return `<div class="section">
    <div class="row"><button class="btn small" data-act="feat-slot" data-id="">← Back</button><h2 class="grow">${esc(slot.title)}</h2></div>
    ${searchBox("Search feats (e.g. Strength, spell, reaction)", list.length)}
    ${chips([...(groups.length > 1 ? [{ id: "all", label: "All", on: F.featGroup === "all" }, ...groups.map((g) => ({ id: g, label: g, on: F.featGroup === g }))] : []),
      { id: "__avail", label: "Only ones I can take", on: F.hideUnavail }], "f-feat")}
    <div class="list">${list.map((f) => {
      const warn = why(f);
      return pickCard({ act: "choose-feat", id: slot.slot + "|" + f.id, on: chosen?.id === f.id, title: f.name, src: f.source, sub: f.prereq?.text || "",
        text: f.text, extra: warn ? `<span class="badge warn">${warn}</span>` : "" });
    }).join("")}</div></div>`;
}

// ---------- step: equipment ----------
function stepEquipment(c) {
  const cls = DB.classes[c.classes[0].id];
  const bg = DB.backgrounds[c.background];
  const opt = (o) => [...(o.items || []), o.gp ? `${o.gp} GP` : ""].filter(Boolean).join(", ");
  return `<div class="section">
    <h2>${esc(cls?.name || "Class")} starting gear</h2>
    <div class="list">${(cls?.equipment || []).map((o) => pickCard({ act: "class-equip", id: o.option, on: c.classEquip === o.option, title: "Option " + o.option, sub: opt(o) })).join("")}</div>
    ${bg ? `<h2>${esc(bg.name)} gear</h2><div class="list">${(bg.equipment || []).map((o) => pickCard({ act: "bg-equip", id: o.option, on: c.bgEquip === o.option, title: "Option " + o.option, sub: opt(o) })).join("")}</div>` : ""}
    <button class="btn primary" data-act="apply-equip">${c.equipApplied ? "Replace inventory with these choices" : "Add this gear to my inventory"}</button>
    ${c.equipApplied ? `<p class="muted small">Gear added. You can add, equip and remove items on the sheet's Gear tab.</p>` : ""}
  </div>`;
}
// Starting gear is written the way people say it ("Traveler's Clothes"); the item list uses
// "Clothes, Traveler's". These aliases connect the two.
const ITEM_ALIASES = {
  "traveler's clothes": "Clothes, Traveler's", "fine clothes": "Clothes, Fine", "hooded lantern": "Lantern, Hooded",
  "bullseye lantern": "Lantern, Bullseye", "iron spikes": "Spikes, Iron", "iron pot": "Pot, Iron", "map or scroll case": "Case, Map or Scroll",
  "crossbow bolt case": "Case, Crossbow Bolt", "glass bottle": "Bottle, Glass", "glass bottles": "Bottle, Glass", "portable ram": "Ram, Portable",
  "bolts": "Crossbow Bolts", "crossbow bolt": "Crossbow Bolts", "arrow": "Arrows", "needles": "Blowgun Needles", "bullets": "Sling Bullets",
  "poison": "Basic Poison", "basic poison": "Basic Poison", "poison, basic": "Basic Poison", "musical instrument": "Musical Instrument",
};
function lookupItem(t) {
  if (DB.weaponByName[t]) return { kind: "weapon", weight: DB.weaponByName[t].weight };
  if (DB.armorByName[t]) return { kind: DB.armorByName[t].category === "shield" ? "shield" : "armor", weight: DB.armorByName[t].weight };
  if (DB.gearByName[t]) return { kind: "gear", weight: DB.gearByName[t].weight };
  return null;
}
function parseItem(text) {
  // "8 Javelins" → 8 × Javelin; "Oil (3 flasks)" → 3 × Oil; "Traveler’s Clothes" → Clothes, Traveler's
  let qty = 1, name = String(text).trim().replace(/[’‘]/g, "'");
  const m = /^(\d+)\s+(.+)$/.exec(name);
  if (m) { qty = +m[1]; name = m[2]; }
  const pq = /\(\s*(\d+)\s*(flasks?|days?|sheets?|vials?|pieces?|bottles?|feet)\b[^)]*\)/i.exec(name);
  if (pq && !/feet/i.test(pq[2])) qty *= +pq[1];
  name = name.replace(/\s*\((as |same as|\d+\s|your choice|chosen)[^)]*\)/gi, "").replace(/\s+(of your choice|chosen for .*)$/i, "").trim();
  const display = name;
  const find = (n) => {
    const alias = ITEM_ALIASES[n.toLowerCase()];
    const tries = [alias, n, n.replace(/s$/, ""), n.replace(/es$/, ""), n + "s", n.replace(/\s*\(.*\)$/, "")].filter(Boolean);
    for (const t of tries) { const hit = lookupItem(t); if (hit) return { ref: t, ...hit }; }
    return null;
  };
  let hit = find(name);
  if (!hit && / or /i.test(name)) hit = find(name.split(/ or /i)[0].trim()); // "Artisan's Tools or Musical Instrument" → the first
  if (!hit) return { name: display, qty, kind: "gear", weight: 0 };
  const shown = hit.ref.includes(", ") || hit.ref === display.replace(/\s*\(.*\)$/, "") ? display : display; // keep the friendly wording
  const it = { name: shown, qty, kind: hit.kind, weight: hit.weight };
  if (hit.ref !== shown) it.ref = hit.ref;
  return it;
}
function applyEquipment(c) {
  const cls = DB.classes[c.classes[0].id];
  const bg = DB.backgrounds[c.background];
  const pickOpt = (list, key) => (list || []).find((o) => o.option === key) || (list || [])[0];
  const co = pickOpt(cls?.equipment, c.classEquip);
  const bo = pickOpt(bg?.equipment, c.bgEquip);
  c.inventory = [];
  c.coins = { cp: 0, sp: 0, ep: 0, gp: (co?.gp || 0) + (bo?.gp || 0), pp: 0 };
  let armorOn = false, shieldOn = false;
  for (const text of [...(co?.items || []), ...(bo?.items || [])]) {
    const it = parseItem(text);
    const same = c.inventory.find((i) => i.name === it.name);
    if (same) { same.qty += it.qty; continue; } // stack duplicates (e.g. two Holy Symbols)
    let equipped = false;
    if (it.kind === "armor" && !armorOn) equipped = armorOn = true;
    if (it.kind === "shield" && !shieldOn) equipped = shieldOn = true;
    if (it.kind === "weapon") equipped = true;
    c.inventory.push({ uid: uid(), ...it, equipped });
  }
  c.equipApplied = true;
}

// ---------- step: spells ----------
function spellSources(c) {
  // Every place this character picks spells from.
  const out = casters(c, DB).map((x) => ({ key: x.key, title: x.name, list: x.listClass, cantrips: atLevel(x.cantrips, x.level), prepared: atLevel(x.prepared, x.level), maxLevel: maxSpellLevel(x), ability: x.ability }));
  for (const f of c.feats) {
    const cls = magicInitiateClass(f.id);
    if (cls) out.push({ key: "feat:" + f.slot, title: DB.feats[f.id]?.name || "Magic Initiate", list: cls, cantrips: 2, prepared: 1, maxLevel: 1, ability: null });
  }
  return out;
}
function stepSpells(c) {
  const sources = spellSources(c);
  const granted = grantedSpells(c, DB);
  if (!sources.length && !granted.length) return `<div class="section"><p class="muted">Your class doesn't cast spells at this level. Skip ahead.</p></div>`;
  const src = sources.find((s) => s.key === S.spellTab) || sources[0];
  let picker = "";
  if (src) {
    const pick = c.spells[src.key] || { cantrips: [], prepared: [] };
    const pool = Object.values(DB.spells).filter((sp) => allowed(sp) && sp.classes.includes(src.list) && sp.level <= src.maxLevel)
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const chosenIds = [...pick.cantrips, ...pick.prepared];
    const list = search(pool.filter((sp) => (F.lvl === "all" || sp.level === +F.lvl) && (F.school === "all" || sp.school === F.school)
        && (!F.conc || sp.concentration) && (!F.ritual || sp.ritual) && (!F.chosen || chosenIds.includes(sp.id))),
      (sp) => `${sp.school} ${sp.castingTime} ${sp.range} ${sp.duration} ${sp.components} ${sp.text} ${sp.higherLevels}`)
      .sort((a, b) => a.level - b.level);
    const schools = [...new Set(pool.map((sp) => sp.school))].sort();
    const lvls = [...new Set(pool.map((sp) => sp.level))];
    const group = (lvl) => list.filter((sp) => sp.level === lvl);
    const levels = [...new Set(list.map((sp) => sp.level))];
    picker = `
      ${sources.length > 1 ? `<div class="seg">${sources.map((s) => `<button class="${s.key === src.key ? "on" : ""}" data-act="spell-tab" data-id="${s.key}">${esc(s.title)}</button>`).join("")}</div>` : ""}
      <p class="muted small">Cantrips <span class="badge ${pick.cantrips.length >= src.cantrips ? "srd" : "warn"}">${pick.cantrips.length}/${src.cantrips}</span>
        ${src.maxLevel ? `· Prepared spells (up to level ${src.maxLevel}) <span class="badge ${pick.prepared.length >= src.prepared ? "srd" : "warn"}">${pick.prepared.length}/${src.prepared}</span>` : ""}</p>
      ${searchBox("Search spells (e.g. fire, heal, 60 feet, reaction)", list.length)}
      ${chips([{ id: "all", label: "All levels", on: F.lvl === "all" }, ...lvls.map((l) => ({ id: String(l), label: l ? ordinal(l) : "Cantrips", on: F.lvl === String(l) }))], "f-lvl")}
      ${chips([{ id: "all", label: "Any school", on: F.school === "all" }, ...schools.map((x) => ({ id: x, label: x, on: F.school === x }))], "f-school")}
      ${chips([{ id: "chosen", label: "Chosen", on: F.chosen }, { id: "conc", label: "Concentration", on: F.conc }, { id: "ritual", label: "Ritual", on: F.ritual }], "f-spflag")}
      ${list.length ? "" : `<p class="muted">No spells match. Try fewer words or clear a filter.</p>`}
      ${levels.map((lvl) => `<div class="label">${lvl === 0 ? "Cantrips" : "Level " + lvl}</div><div class="list">${group(lvl).map((sp) => spellCard(sp, src.key, lvl === 0 ? pick.cantrips : pick.prepared, true)).join("")}</div>`).join("")}`;
  }
  return `<div class="section">
    ${granted.length ? `<div class="card small"><div class="label">Always prepared</div>${granted.map((g) => `${esc(g.name)} <span class="muted">(${esc(g.source)})</span>`).join(", ")}</div>` : ""}
    ${picker}</div>`;
}
function spellCard(sp, sourceKey, chosen, pickable) {
  const sub = `${sp.level ? "Level " + sp.level : "Cantrip"} ${sp.school} · ${sp.castingTime} · ${sp.range}${sp.concentration ? " · Conc." : ""}${sp.ritual ? " · Ritual" : ""}`;
  const text = `${sp.text}${sp.higherLevels ? "\n\n**Higher levels.** " + sp.higherLevels : ""}\n\n_${sp.components} · ${sp.duration}_`;
  return pickCard({ act: pickable ? "toggle-spell" : "", id: sourceKey + "|" + sp.id, multi: true, on: chosen.includes(sp.id), title: sp.name, src: sp.source, sub, text });
}

// ---------- step: review ----------
function stepReview(c, todo) {
  return `<div class="section">
    <h2>${esc(c.name || "Unnamed hero")}</h2><p class="muted">${esc(summaryLine(c))}</p>
    ${todo.length ? `<div class="label">Still to choose</div><div class="todo-list">${todo.map((t) => `<button class="todo-item" data-act="step" data-step="${t.section}">${esc(t.text)}</button>`).join("")}</div>
      <p class="muted small">You can create the character now and finish these later from the sheet.</p>`
      : `<p class="badge srd">Everything is chosen.</p>`}
    ${(() => { const s = abilityScores(c, DB); return `<div class="kv">${ABILITIES.map((a) => `<div><span class="k">${ABILITY_NAMES[a]}</span><b class="num">${s[a]} (${signed(mod(s[a]))})</b></div>`).join("")}</div>`; })()}
  </div>`;
}

// ============================================================
// CHARACTER SHEET (laid out like the Odrun Fell sheet)
// hero portrait → vitals card → tabs (Overview, Loadout, Features, Spells)
// ============================================================
const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
const TABS = [["overview", "◈ Overview"], ["loadout", "⚔︎ Loadout"], ["features", "✦ Features"], ["spells", "✴ Spells"]];
const SUBTABS = {
  overview: [["stats", "◈ Stats"], ["persona", "◉ Persona"]],
  loadout: [["inventory", "▤ Inventory"], ["combat", "⚔︎ Combat"]],
  features: [["origin", "◇ Origin & Feats"], ["class", "✦ Class Features"]],
  spells: [["prepared", "✦ Prepared"], ["casting", "✴ Casting"]],
};
const RES_STYLE = [ // glyph + color by resource name
  [/second wind/i, "≋", "#94a3b8"], [/action surge/i, "↯", "#f59e0b"], [/indomitable/i, "⛨", "#38bdf8"], [/rage/i, "✹", "#dc2626"],
  [/bardic/i, "♪", "#a855f7"], [/channel divinity/i, "☼", "#facc15"], [/wild shape/i, "❦", "#16a34a"], [/focus|ki/i, "☯", "#38bdf8"],
  [/lay on hands/i, "✚", "#f472b6"], [/sorcery/i, "✦", "#8b5cf6"], [/superiority/i, "⚔", "#f59e0b"], [/recovery/i, "↻", "#38bdf8"],
];
const resStyle = (name) => (RES_STYLE.find(([re]) => re.test(name)) || [null, "◆", "#c9bda4"]).slice(1);
const STATES = [ // chips that light up on the vitals card and the portrait
  { key: "concentrating", label: "◎ Concentrating", color: "#38bdf8", show: (c) => casters(c, DB).length || grantedSpells(c, DB).length },
  { key: "raging", label: "✹ Raging", color: "#dc2626", show: (c) => classLevel(c, "barbarian") },
  { key: "wildshape", label: "❦ Wild Shape", color: "#16a34a", show: (c) => classLevel(c, "druid") >= 2 }, // tapping opens the form picker
  { key: "innate", label: "✦ Innate Sorcery", color: "#8b5cf6", show: (c) => classLevel(c, "sorcerer") },
  { key: "bardic", label: "♪ Bardic Inspiration", color: "#a855f7", show: () => true },
];
const ordinal = (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");

function viewSheet() {
  const c = C();
  c.states = c.states || {};
  const tabs = c.wildShape ? [...TABS, ["wildshape", "❦ Shape"]] : TABS;
  const tab = S.tab === "wildshape" && c.wildShape ? "wildshape" : S.tab in SUBTABS ? S.tab : "overview";
  const sub = tab === "wildshape" ? "" : S.sub[tab] || SUBTABS[tab][0][0];
  const panels = {
    overview: { stats: panelStats, persona: panelPersona }, loadout: { inventory: panelInventory, combat: panelCombat },
    features: { origin: panelOrigin, class: panelClassFeatures }, spells: { prepared: panelSpells, casting: panelCasting },
  };
  const todo = pendingChoices(c, DB);
  return `
    <div class="topbar">
      <button class="btn icon ghost" data-act="home" aria-label="All characters">←</button>
      <h1>${esc(c.name || "Unnamed hero")}</h1>
      <button class="btn icon ghost" data-act="res-open" aria-label="Resources" title="Resources"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2zM4 5v16M8 7h7M8 11h7"/></svg></button>
      <button class="btn small primary" data-act="level-up">Level up</button>
      <button class="nav-link" data-act="menu">More</button>
    </div>
    ${heroBlock(c)}
    ${todo.length ? `<button class="todo-item" data-act="edit" data-step="${todo[0].section}" style="margin-bottom:12px">${todo.length} choice${todo.length > 1 ? "s" : ""} left: ${esc(todo[0].text)} →</button>` : ""}
    ${vitalsCard(c)}
    <div class="sticky-bar">
      <nav class="tabbar" style="grid-template-columns:repeat(${tabs.length},1fr)">${tabs.map(([k, l]) => `<button class="${k === tab ? "on" : ""} ${k === "wildshape" ? "ws" : ""}" data-act="tab" data-id="${k}">${l}</button>`).join("")}</nav>
      ${rollModeBar()}
    </div>
    <div class="panel">
      ${tab === "wildshape" ? panelWildShape(c) : `<div class="subtabs">${SUBTABS[tab].map(([k, l]) => `<button class="${k === sub ? "on" : ""}" data-act="subtab" data-id="${tab}|${k}">${l}</button>`).join("")}</div>
      ${panels[tab][sub](c)}`}
    </div>`;
}

function heroBlock(c) {
  const lvl = totalLevel(c);
  const next = XP_TABLE[lvl] ?? null;
  const xp = c.xp || 0;
  const pct = next ? Math.min(100, (xp / next) * 100) : 100;
  const chips = [
    c.inspiration ? `<span class="status" style="color:#d4af37">★ Heroic Inspiration</span>` : "",
    ...STATES.filter((s) => c.states[s.key]).map((s) => `<span class="status" style="color:${s.color}">${s.label}</span>`),
  ].join("");
  const build = `Level ${lvl} · ${esc(DB.species[c.species]?.name || "—")} · ${esc(c.classes.map((k) => DB.classes[k.id]?.name).join(" / "))}`;
  return `<div class="hero-wrap"><div class="hero ${c.wildShape ? "wild" : ""}" data-act="${c.wildShape ? "ws-open" : "portrait"}" role="button" aria-label="${c.wildShape ? "Wild Shape" : "Change portrait"}">
    ${c.wildShape && WS_ART[c.wildShape.form] ? `<img src="${WS_ART[c.wildShape.form]}" alt="${esc(formOf(c.wildShape.form)?.name || "Wild Shape")}"><span class="add-photo" style="color:#4ade80;border-color:#16a34a">❦ ${esc(formOf(c.wildShape.form)?.name || "")} form</span>`
      : portraitSrc(c) ? `<img src="${portraitSrc(c)}" alt="Portrait of ${esc(c.name)}">` : `${boltsSVG()}<span class="add-photo">＋ Choose portrait</span>`}
    <div class="overlay">
      ${chips ? `<div class="status-row">${chips}</div>` : ""}
      <div class="kicker">✦ ${esc(c.subtitle || DB.backgrounds[c.background]?.name || "Adventurer")} ✦</div>
      <div class="hero-name">${esc(c.name || "Unnamed hero")}</div>
      <div class="build">${build}</div>
      <div class="xp"><div class="bar"><div style="width:${pct}%"></div></div><span class="num">XP ${xp}${next ? " / " + next : ""}</span></div>
      ${next && xp >= next ? `<span class="badge srd" style="background:rgba(10,4,3,.7)">Ready to level up</span>` : ""}
    </div></div></div>`;
}
function boltsSVG() {
  // Jagged hextech lightning; the glow comes from the .bolts CSS filter.
  const bolt = (pts, w) => `<path d="M${pts.join(" L")}" stroke="#9ffaf2" stroke-width="${w}" fill="none" vector-effect="non-scaling-stroke"/>`;
  return `<svg class="bolts" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    ${bolt(["-2 22", "8 26", "12 18", "22 27", "28 22", "35 33", "44 29", "48 38"], 2)}${bolt(["12 18", "14 9", "21 4"], 1.2)}${bolt(["28 22", "31 14"], 1)}
    ${bolt(["102 80", "92 76", "88 85", "78 79", "72 88", "63 84", "58 96"], 2)}${bolt(["88 85", "90 93", "84 99"], 1.2)}${bolt(["72 88", "70 97"], 1)}
    ${bolt(["64 -2", "61 9", "67 14", "60 23"], 1.2)}${bolt(["-2 78", "7 74", "10 83", "18 80"], 1.2)}
  </svg>`;
}

function vitalsCard(c) {
  const max = maxHP(c, DB);
  const cur = c.hp.current ?? max;
  const total = Math.max(max, cur + c.hp.temp);
  const slots = spellSlots(c, DB);
  const pact = pactMagic(c);
  const res = resources(c, DB);
  const ac = armorClass(c, DB);
  const mastery = masteryCount(c, DB);
  const states = STATES.filter((s) => s.show(c));
  return `<div class="panel">
    <div class="stack" style="gap:8px">
      <div class="hp-top"><span class="label">Hit Points</span><span class="hp-val num"><b>${cur}</b> / ${max}${c.hp.temp ? ` <span style="color:var(--sky)">+${c.hp.temp}</span>` : ""}</span></div>
      <div class="bar"><div class="fill" style="width:${(cur / total) * 100}%"></div><div class="temp" style="width:${(c.hp.temp / total) * 100}%"></div><div class="ticks" style="--t:${(10 / total) * 100}%"></div></div>
      <div class="hp-ctrl"><input type="number" id="hp-amt" inputmode="numeric" placeholder="0" aria-label="Amount">
        <button class="btn danger" data-act="hp" data-id="dmg">Damage</button><button class="btn" data-act="hp" data-id="heal" style="color:var(--green)">Heal</button><button class="btn" data-act="hp" data-id="temp" style="color:var(--sky)">Temp</button></div>
    </div>
    ${cur === 0 ? `<div class="row"><span class="label grow">Death saves</span>
      <span class="small soft">Saved</span><span class="pips">${[0, 1, 2].map((i) => `<button class="pip lg ${c.deathSaves.s > i ? "" : "used"}" style="--c:var(--green)" data-act="death" data-id="s|${i}" aria-label="Success ${i + 1}"></button>`).join("")}</span>
      <span class="small soft">Failed</span><span class="pips">${[0, 1, 2].map((i) => `<button class="pip lg ${c.deathSaves.f > i ? "" : "used"}" style="--c:var(--red)" data-act="death" data-id="f|${i}" aria-label="Failure ${i + 1}"></button>`).join("")}</span>
      <button class="btn small" data-act="roll" data-roll="0" data-label="Death save">Roll</button></div>` : ""}
    <div class="divider"></div>
    <div class="row" style="gap:14px;align-items:flex-start">
      <div class="stack" style="gap:2px"><span class="soft">Temp HP</span><div class="stepper"><button class="btn icon" data-act="temp" data-id="-1">−</button><span class="v num">${c.hp.temp}</span><button class="btn icon" data-act="temp" data-id="1">+</button></div></div>
      <div class="stack" style="gap:4px"><span class="soft">Exhaustion <b class="num" style="color:var(--fg)">${c.exhaustion} / 6</b></span>
        <span class="pips">${Array.from({ length: 6 }, (_, i) => `<button class="pip sm ${i < c.exhaustion ? "" : "used"}" style="--c:var(--red)" data-act="exhaust-dot" data-id="${i}" aria-label="Exhaustion ${i + 1}"></button>`).join("")}</span></div>
    </div>
    <div class="row" style="gap:6px">
      <button class="chip ${c.inspiration ? "on" : ""}" style="--c:#d4af37" data-act="inspiration">★ Heroic Inspiration</button>
      ${states.map((s) => `<button class="chip ${c.states[s.key] ? "on" : ""}" style="--c:${s.color}" data-act="state" data-id="${s.key}">${s.label}</button>`).join("")}
    </div>
    ${c.exhaustion ? `<p class="small" style="color:#f87171">Exhaustion ${c.exhaustion}: −${c.exhaustion * 2} to every d20 Test, −${c.exhaustion * 5} ft Speed${c.exhaustion >= 6 ? ". At 6 you die." : ""}</p>` : ""}
    <div class="stack" style="gap:6px"><div class="row"><span class="label grow">Conditions</span><button class="chip" data-act="cond-open">${S.condOpen ? "Done" : "＋ Add"}</button></div>
      <div class="row" style="gap:6px">${(S.condOpen ? CONDITIONS : c.conditions).map((x) => `<button class="chip cond ${c.conditions.includes(x) ? "on" : ""}" data-act="condition" data-id="${x}">${x}</button>`).join("") || '<span class="small muted">None</span>'}</div></div>
    ${mastery ? `<div><span class="chip" style="cursor:default">† Weapon Masteries ${mastery}</span></div>` : ""}
    ${slots.some(Boolean) || pact ? `<div class="divider"></div><div class="stack" style="gap:8px"><span class="label">Spell slots</span>
      <div class="slot-row">${slots.map((n, i) => n ? `<span class="row" style="gap:4px;flex-wrap:nowrap"><span class="lvl">${ordinal(i + 1)}</span><span class="pips">${Array.from({ length: n }, (_, j) => `<button class="pip ${j >= n - (c.slotsSpent[i] || 0) ? "used" : ""}" style="--c:var(--violet)" data-act="slot" data-id="${i}|${j}|${n}" aria-label="${ordinal(i + 1)} level slot ${j + 1}"></button>`).join("")}</span></span>` : "").join("")}
      ${pact ? `<span class="row" style="gap:4px;flex-wrap:nowrap"><span class="lvl">Pact ${ordinal(pact.level)}</span><span class="pips">${Array.from({ length: pact.slots }, (_, j) => `<button class="pip ${j >= pact.slots - (c.pactSpent || 0) ? "used" : ""}" style="--c:var(--purple)" data-act="pact" data-id="${j}|${pact.slots}" aria-label="Pact slot ${j + 1}"></button>`).join("")}</span></span>` : ""}</div></div>` : ""}
    ${res.length ? `<div>${res.map((r) => { const [g, col] = resStyle(r.name); return `<div class="res-row"><span class="glyph">${g}</span><span class="name">${esc(r.name)}</span>
      ${r.max <= 10 ? `<span class="pips">${Array.from({ length: r.max }, (_, i) => `<button class="pip ${i >= r.max - r.spent ? "used" : ""}" style="--c:${col}" data-act="res" data-id="${r.key}|${i}|${r.max}" aria-label="${esc(r.name)} ${i + 1}"></button>`).join("")}</span>`
        : `<span class="stepper"><button class="btn icon" data-act="res-n" data-id="${r.key}|1">−</button><span class="v num" style="color:${col}">${r.max - r.spent}</span><button class="btn icon" data-act="res-n" data-id="${r.key}|-1">+</button></span><span class="small soft num">of ${r.max}</span>`}
      <span class="note">${r.recharge === "short" ? "Short or Long Rest" : r.recharge === "long" ? "Long Rest" : "See feature"}</span></div>`; }).join("")}</div>` : ""}
    <div class="band">
      <div data-act="level-up"><span class="k">Lvl</span><span class="v boxed num">${totalLevel(c)}</span></div>
      <div data-act="ac-info" title="${esc(ac.note)}"><span class="k">AC</span><span class="v num">${ac.value}</span></div>
      <div data-act="roll" data-roll="${initiative(c, DB)}" data-label="Initiative"><span class="k">Init</span><span class="v num">${signed(initiative(c, DB))}</span></div>
      <div><span class="k">Speed</span><span class="v num">${Math.max(0, speed(c, DB) - c.exhaustion * 5)}</span></div>
      <div><span class="k">Prof</span><span class="v num">+${profBonus(c)}</span></div>
    </div>
    <div class="row"><button class="btn grow" data-act="short-rest">☾ Short rest</button><button class="btn grow" data-act="long-rest">✧ Long rest</button></div>
  </div>`;
}

// ---------- ◈ Overview ----------
function panelStats(c) {
  const s = abilityScores(c, DB);
  const saves = saveProficiencies(c, DB);
  const abRow = (a) => `<div class="srow" data-act="roll" data-roll="${mod(s[a])}" data-label="${ABILITY_NAMES[a]} check">
    <span class="n">${ABILITY_NAMES[a]}</span><span class="base num">${c.base[a]}</span><span class="score num">${s[a]}</span><span class="mod num">${signed(mod(s[a]))}</span></div>`;
  const saveRow = (a) => `<div class="srow ${saves.has(a) ? "prof" : ""}" data-act="roll" data-roll="${saveBonus(c, DB, a)}" data-label="${ABILITY_NAMES[a]} save">
    <span class="n">${ABILITY_NAMES[a]}</span><span class="t num">${signed(saveBonus(c, DB, a))}</span></div>`;
  const skillRow = (sk) => `<div class="srow ${c.expertise.includes(sk) ? "exp" : c.skills.includes(sk) ? "prof" : ""}" data-act="roll" data-roll="${skillBonus(c, DB, sk)}" data-label="${sk}">
    <span class="n">${sk}</span><span class="t num">${signed(skillBonus(c, DB, sk))}</span></div>`;
  const group = (abs) => abs.map((a) => { const list = Object.keys(SKILLS).filter((k) => SKILLS[k] === a); return list.length ? `<div class="sub-head">${ABILITY_NAMES[a]}</div>${list.map(skillRow).join("")}` : ""; }).join("");
  const sp = DB.species[c.species];
  const sizes = sp?.size || ["Medium"];
  return `
    <div class="head"><h4>Ability Scores</h4><span class="legend">base · score · mod</span></div>
    <div class="cols"><div>${["str", "dex", "con"].map(abRow).join("")}</div><div>${["int", "wis", "cha"].map(abRow).join("")}</div></div>
    <div class="head"><h4>Saving Throws</h4><span class="legend">◆ proficient</span></div>
    <div class="cols"><div>${["str", "dex", "con"].map(saveRow).join("")}</div><div>${["int", "wis", "cha"].map(saveRow).join("")}</div></div>
    <div class="head"><h4>Skills</h4><span class="legend">◆ proficient · ◆◆ expertise</span></div>
    <div class="cols"><div>${group(["str", "dex", "int"])}</div><div>${group(["wis", "cha"])}</div></div>
    <button class="btn small" data-act="edit" data-step="skills">Set proficiencies</button>
    <div class="head"><h4>Senses &amp; Frame</h4></div>
    <div class="kv">
      <div><span class="k">Passive Perception</span><b class="num">${passive(c, DB, "Perception")}</b></div>
      <div><span class="k">Passive Insight</span><b class="num">${passive(c, DB, "Insight")}</b></div>
      <div><span class="k">Darkvision</span><b>${sp?.darkvision ? sp.darkvision + " ft" : "—"}</b></div>
      <div><span class="k">Passive Investigation</span><b class="num">${passive(c, DB, "Investigation")}</b></div>
      <div><span class="k">Size</span><b>${esc(c.size || sizes[0])}</b></div>
      <div><span class="k">Carrying Capacity</span><b class="num">${carryCapacity(c, DB)} lb</b></div>
    </div>
    <p class="small muted">Tap any row to roll it.</p>`;
}
function panelPersona(c) {
  const f = (id, key, label, ph = "") => `<div class="field"><label class="label" for="${id}">${label}</label><input type="text" id="${id}" data-bind="${key}" value="${esc(c[key] || "")}" placeholder="${ph}"></div>`;
  const t = (id, key, label, ph = "") => `<div class="field"><label class="label" for="${id}">${label}</label><textarea id="${id}" data-bind="${key}" placeholder="${ph}">${esc(c[key] || "")}</textarea></div>`;
  return `<div class="head"><h4>Identity</h4></div>
    <div class="kv">
      <div class="field"><label class="label" for="p-xp">Experience points</label><input type="number" inputmode="numeric" id="p-xp" data-xp value="${c.xp || 0}"></div>
      ${f("p-sub", "subtitle", "Title on portrait", DB.backgrounds[c.background]?.name || "e.g. The Ashen Shield")}
      ${f("p-align", "alignment", "Alignment")}${f("p-player", "player", "Player")}
    </div>
    ${f("p-lang", "languages", "Languages")}
    <div class="head"><h4>Persona</h4></div>
    ${t("p-appear", "appearance", "Appearance", "Scar over the left eye, braided red beard…")}
    ${t("p-traits", "traits", "Personality, ideals, bonds & flaws")}
    ${t("p-back", "backstory", "Backstory")}
    ${t("p-notes", "notes", "Notes", "Quests, NPCs, loot, debts…")}
    <div class="row"><button class="btn" data-act="portrait">${portraitSrc(c) ? "Change portrait" : "Choose portrait"}</button>${portraitSrc(c) ? '<button class="btn danger" data-act="portrait-clear">Remove portrait</button>' : ""}</div>`;
}

// ---------- ⚔ Loadout ----------
function equipSlots(c) {
  const weapons = c.inventory.filter((i) => i.kind === "weapon" && i.equipped);
  const atk = weaponAttacks(c, DB);
  const armor = c.inventory.find((i) => i.kind === "armor" && i.equipped);
  const shield = c.inventory.find((i) => i.kind === "shield" && i.equipped);
  const slot = (key, label, item, read) => `<button class="slot" data-act="slot-pick" data-id="${key}">
    <span class="disc ${item ? "" : "empty"}">${item ? (itemArt(item) ? `<img src="${itemArt(item)}" alt="">` : esc(item.name[0])) : "＋"}</span><span class="lab">${label}</span>
    <span class="read">${item ? esc(item.name) + (read ? "<br>" + read : "") : "Empty"}</span></button>`;
  const wRead = (it) => { const a = it && atk.find((x) => x.uid === it.uid); return a ? `${signed(a.attack)} · ${esc(a.damage)}` : ""; };
  return `<div class="slots">
    ${slot("main", "Main Hand", weapons[0], wRead(weapons[0]))}${slot("off", "Off Hand", weapons[1], wRead(weapons[1]))}
    ${slot("armor", "Armor", armor, armor ? "AC " + armorClass(c, DB).value : "")}${slot("shield", "Shield", shield, shield ? "+2 AC" : "")}
  </div><p class="small muted">Tap a slot to equip something from your inventory.</p>`;
}
function panelInventory(c) {
  const cap = carryCapacity(c, DB);
  const w = carriedWeight(c);
  const totalGP = (c.coins.pp || 0) * 10 + (c.coins.gp || 0) + (c.coins.ep || 0) / 2 + (c.coins.sp || 0) / 10 + (c.coins.cp || 0) / 100;
  const groups = [["Weapons", (i) => i.kind === "weapon"], ["Armor", (i) => i.kind === "armor" || i.kind === "shield"],
    ["Magic items", (i) => i.kind === "gear" && i.magic], ["Gear", (i) => i.kind === "gear" && !i.magic]];
  const attuned = c.inventory.filter((i) => i.attuned).length;
  return `<div class="head"><h4>Equipped</h4></div>${equipSlots(c)}
    <div class="head"><h4>Inventory</h4><span class="legend num">${Math.round(w)} / ${cap} lb</span></div>
    ${groups.map(([label, test]) => { const list = c.inventory.filter(test); return list.length ? `<div class="sub-head">${label}</div><div class="items">${list.map((i) => `
      <button class="item" data-act="item" data-id="${i.uid}"><span class="tile ${i.magic || i.bonus ? "magic" : ""}" style="${i.rarity ? `--c:${RARITY_COLOR[rarityKey(i.rarity)]}` : ""}">${itemArt(i) ? `<img src="${itemArt(i)}" alt="" loading="lazy">` : esc(i.name[0])}${i.equipped || i.attuned ? '<span class="eq"></span>' : ""}</span><span class="nm">${esc(i.name)}</span><span class="q">×${i.qty}</span></button>`).join("")}</div>` : ""; }).join("") || '<p class="muted">Empty.</p>'}
    <div class="row"><button class="btn primary grow" data-act="armory">＋ Add items</button><button class="btn grow" data-act="ci-new">✎ Custom item</button></div>
    ${attuned || c.inventory.some((i) => i.attune) ? `<p class="small soft">Attuned: <b class="num" style="color:${attuned > 3 ? "var(--red)" : "var(--cyan)"}">${attuned} / 3</b>${attuned > 3 ? " (more than the rules allow)" : ""}</p>` : ""}
    <div class="head"><h4>Coin</h4><span class="legend num">≈ ${Math.round(totalGP * 100) / 100} GP total</span></div>
    <div class="coins">${["pp", "gp", "ep", "sp", "cp"].map((k) => `<label>${k.toUpperCase()}<input type="number" inputmode="numeric" id="coin-${k}" data-coin="${k}" value="${c.coins[k] || 0}"></label>`).join("")}</div>`;
}
function panelCombat(c) {
  const atks = weaponAttacks(c, DB).sort((a, b) => b.equipped - a.equipped);
  const m = abilityMods(c, DB);
  const hd = hitDice(c, DB);
  return `<div class="head"><h4>Attacks</h4></div>
    ${atks.map((a) => `<div class="card stack" style="gap:8px">
      <div class="row"><b class="grow">${esc(a.name)}</b>${a.mastery ? `<span class="badge srd">${esc(a.mastery)}</span>` : ""}${a.prof ? "" : '<span class="badge warn">Not proficient</span>'}${a.equipped ? "" : '<span class="badge">Not equipped</span>'}</div>
      <div class="row"><button class="btn grow" data-act="roll" data-roll="${a.attack}" data-label="${esc(a.name)} attack">Hit ${signed(a.attack)}</button>
        <button class="btn grow" data-act="roll-dmg" data-roll="${esc(a.damage)}" data-label="${esc(a.name)} damage">${esc(a.damage)} ${esc(a.damageType)}</button></div>
      <p class="small soft">${esc(a.properties.join(", ") || "—")}</p></div>`).join("") || '<p class="muted">No weapons yet. Add some under Inventory.</p>'}
    <div class="card row"><b class="grow">Unarmed Strike</b><button class="btn small" data-act="roll" data-roll="${m.str + profBonus(c)}" data-label="Unarmed Strike">Hit ${signed(m.str + profBonus(c))}</button>
      <span class="small soft">${classLevel(c, "monk") ? "Martial Arts die + Dex" : `${Math.max(1, 1 + m.str)} Bludgeoning`}</span></div>
    <div class="head"><h4>Hit Dice</h4><span class="legend">spend on a Short Rest</span></div>
    ${hd.map((h) => `<div class="row"><span class="num" style="width:70px">${h.total}d${h.die}</span><span class="pips">${Array.from({ length: h.total }, (_, i) => `<span class="pip sm ${i < h.total - h.spent ? "" : "used"}" style="--c:var(--gold-dim)"></span>`).join("")}</span></div>`).join("")}
    <div class="head"><h4>On your turn</h4></div>
    <p class="small soft">Move up to your Speed, take one Action (Attack, Dash, Disengage, Dodge, Help, Hide, Influence, Magic, Ready, Search, Study, Utilize), one Bonus Action if something gives you one, and one Reaction per round.</p>`;
}

// ---------- ✦ Features ----------
function panelOrigin(c) {
  const sp = DB.species[c.species];
  const bg = DB.backgrounds[c.background];
  const rowEdit = (label, value, step) => `<div class="srow" data-act="edit" data-step="${step}"><span class="n">${label}</span><span class="t">${esc(value || "—")}</span><span class="soft">›</span></div>`;
  const featList = c.feats.map((f) => ({ f, feat: DB.feats[f.id] })).filter((x) => x.feat);
  const opts = c.options.map((id) => DB.options[id]).filter(Boolean);
  const optColor = { invocation: "#a855f7", metamagic: "#8b5cf6", maneuver: "#f59e0b", other: "#38bdf8" };
  const armorT = [...new Set(c.classes.map((k) => DB.classes[k.id]?.armor).filter(Boolean))].join("; ");
  const weaponT = [...new Set(c.classes.map((k) => DB.classes[k.id]?.weapons).filter(Boolean))].join("; ");
  return `<div class="head"><h4>Origin</h4></div>
    <div>${c.classes.map((k) => rowEdit("Class", `${DB.classes[k.id]?.name} ${k.level}${k.subclass ? " · " + (DB.subclasses[k.subclass]?.name || "") : ""}`, "class")).join("")}
      ${rowEdit("Species", (sp?.name || "") + (c.lineage ? " · " + c.lineage : ""), "species")}${rowEdit("Background", bg?.name, "background")}</div>
    ${opts.length || c.masteries.length ? `<div class="head"><h4>Class Choices</h4></div>
      <div class="row" style="gap:6px">${opts.map((o) => `<span class="chip on" style="--c:${optColor[o.type] || "#c9bda4"};cursor:default">${esc(o.name)}</span>`).join("")}
      ${c.masteries.map((w) => `<span class="chip" style="cursor:default">† ${esc(w)}</span>`).join("")}</div>` : ""}
    <div class="head"><h4>Training &amp; Proficiencies</h4></div>
    <div class="stack small" style="gap:4px"><p><b>Armor</b> <span class="soft">${esc(armorT || "None")}</span></p><p><b>Weapons</b> <span class="soft">${esc(weaponT)}</span></p>
      <p><b>Tools</b> <span class="soft">${esc([bg?.tool, c.tools].filter(Boolean).join(", ") || "—")}</span></p><p><b>Languages</b> <span class="soft">${esc(c.languages)}</span></p></div>
    <div class="head"><h4>Feats</h4></div>
    <div>${featList.map(({ f, feat }) => featureBlock(feat.name, { origin: "Origin", general: "General", "fighting-style": "Fighting Style", "epic-boon": "Epic Boon" }[feat.category] || feat.category,
      feat.text + (Object.keys(f.asi || {}).length ? `\n\n**Increase:** ${Object.entries(f.asi).map(([a, n]) => `${ABILITY_NAMES[a]} +${n}`).join(", ")}` : ""))).join("") || '<p class="muted small">None yet.</p>'}</div>
    ${opts.length ? `<div class="head"><h4>Options</h4></div><div>${opts.map((o) => featureBlock(o.name, o.prereq || "", o.text)).join("")}</div>` : ""}
    ${sp ? `<div class="head"><h4>${esc(sp.name)} Traits</h4></div><div>${(sp.traits || []).map((t) => featureBlock(t.name, "", t.text)).join("")}
      ${(() => { const lin = sp.lineages?.find((l) => l.name === c.lineage); return lin ? featureBlock(lin.name, "Lineage", lin.text) : ""; })()}</div>` : ""}
    <button class="btn" data-act="edit" data-step="feats">Change feats &amp; options</button>`;
}
function panelClassFeatures(c) {
  const out = [];
  for (const k of c.classes) {
    const cls = DB.classes[k.id];
    if (!cls) continue;
    const sub = DB.subclasses[k.subclass];
    const all = [...(cls.features || []).map((f) => ({ ...f, from: cls.name })), ...(sub?.features || []).map((f) => ({ ...f, from: sub.name }))]
      .filter((f) => f.level <= k.level).sort((a, b) => a.level - b.level);
    const byLevel = {};
    all.forEach((f) => (byLevel[f.level] = byLevel[f.level] || []).push(f));
    out.push(`<div class="head"><h4>${esc(cls.name)}${sub ? " · " + esc(sub.name) : ""}</h4><span class="legend">level ${k.level}</span></div>
      ${Object.entries(byLevel).map(([lvl, list]) => `<div class="sub-head">Level ${lvl} · ${esc([...new Set(list.map((f) => f.from))].join(" / "))}</div>
        <div>${list.map((f) => featureBlock(f.name, "", f.text)).join("")}</div>`).join("")}`);
  }
  return out.join("") || '<p class="muted">Choose a class first.</p>';
}
function featureBlock(name, sub, text) {
  return `<details class="feature"><summary><b>${esc(name)}</b><span class="soft small">${esc(sub || "")}</span></summary><div class="body small">${md(text)}</div></details>`;
}

// ---------- ✴ Spells ----------
function castClass(ct) {
  const t = (ct || "").toLowerCase();
  return t.startsWith("bonus") ? "bonus" : t.startsWith("reaction") ? "react" : t.startsWith("action") ? "action" : "long";
}
function spellRow(sp, from, always, c = C()) {
  const ability = spellAbilityFor(c, from);
  return `<details class="spell"><summary><span class="sn">${esc(sp.name)}</span><span class="lv">${sp.level ? ordinal(sp.level) : "Cantrip"}</span>
    <span class="meta"><span>${esc(sp.school)}</span><span class="ct ${castClass(sp.castingTime)}">${esc(sp.castingTime)}</span><span>${esc(sp.range)}</span>
      ${sp.concentration ? '<span class="tag" style="color:var(--sky)">Conc.</span>' : ""}${sp.ritual ? '<span class="tag" style="color:var(--gold)">Ritual</span>' : ""}${always ? '<span class="tag" style="color:var(--green)">Always</span>' : ""}</span></summary>
    <div class="body small">${spellActions(c, sp, ability)}${md(sp.text + (sp.higherLevels ? "\n\n**Higher levels.** " + sp.higherLevels : ""))}<p class="soft" style="margin-top:6px">${esc(sp.components)} · ${esc(sp.duration)} · ${esc(from)}</p></div></details>`;
}
function panelSpells(c) {
  const sources = spellSources(c);
  const granted = grantedSpells(c, DB);
  if (!sources.length && !granted.length) return `<p class="muted">Not a spellcaster (yet). Some feats like Magic Initiate add spells.</p>`;
  const html = [];
  for (const s of sources) {
    const pick = c.spells[s.key] || { cantrips: [], prepared: [] };
    const cantrips = pick.cantrips.map((id) => DB.spells[id]).filter(Boolean).sort(byName);
    const prepared = pick.prepared.map((id) => DB.spells[id]).filter(Boolean).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    html.push(`<div class="head"><h4>Cantrips (${esc(s.title)})</h4><span class="legend">${cantrips.length}/${s.cantrips}</span></div>
      <div>${cantrips.map((sp) => spellRow(sp, s.title)).join("") || '<p class="small muted">None chosen.</p>'}</div>
      ${s.maxLevel ? `<div class="head"><h4>Prepared (${esc(s.title)})</h4><span class="legend">${prepared.length}/${s.prepared}</span></div>
      <div>${prepared.map((sp) => spellRow(sp, s.title)).join("") || '<p class="small muted">None prepared.</p>'}</div>` : ""}`);
  }
  if (granted.length) {
    html.push(`<div class="head"><h4>Bonus Spells</h4><span class="legend">always prepared</span></div>
      <div>${granted.map((g) => DB.spells[g.id] ? spellRow(DB.spells[g.id], g.source, true) : `<p class="small">${esc(g.name)} <span class="muted">(${esc(g.source)})</span></p>`).join("")}</div>`);
  }
  return html.join("") + `<button class="btn" data-act="edit" data-step="spells">Add / remove spells</button>`;
}
function panelCasting(c) {
  const cs = casters(c, DB);
  const sources = spellSources(c);
  if (!cs.length && !sources.length) return `<p class="muted">Not a spellcaster.</p>`;
  return cs.map((x) => `<div class="head"><h4>${esc(x.name)} Spellcasting</h4><span class="legend">${esc(ABILITY_NAMES[x.ability])}</span></div>
    <div class="casting">
      <div><div class="v num">${signed(abilityMods(c, DB)[x.ability])}</div><div class="k">Modifier</div></div>
      <div><div class="v num">${spellDC(c, DB, x.ability)}</div><div class="k">Save DC</div></div>
      <div data-act="roll" data-roll="${spellAttack(c, DB, x.ability)}" data-label="Spell attack" style="cursor:pointer"><div class="v num">${signed(spellAttack(c, DB, x.ability))}</div><div class="k">Attack</div></div>
      <div><div class="v num">${atLevel(x.prepared, x.level)}</div><div class="k">Prepared</div></div>
    </div>
    <p class="small soft">${x.progression === "pact" ? "Pact Magic: slots come back on a Short Rest." : `Highest spell level: ${maxSpellLevel(x)}.`} ${x.ritual ? "Can cast prepared Ritual spells as rituals." : ""} ${x.focus ? "Focus: " + esc(x.focus) + "." : ""}</p>`).join("")
    + (cs.length > 1 ? `<p class="small soft">Multiclass: your shared spell slots combine your caster levels.</p>` : "");
}

// ============================================================
// MODALS & TOASTS
// ============================================================
function modal(html) { layer.innerHTML = `<div class="scrim" data-act="close-modal"><div class="sheet-modal" data-stop>${html}</div></div>`; }
function closeModal() { layer.innerHTML = ""; }
let toastTimer;
function toast(html, ms = 6000) {
  clearTimeout(toastTimer);
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.innerHTML = `<button class="toast-x" data-act="toast-close" aria-label="Close">✕</button>${html}`;
  toastTimer = setTimeout(() => el.remove(), ms);
}
// A roll result: the total inside a glowing hexagon, the breakdown beside it, buttons underneath.
function rollCard({ label, total, detail, note = "", tone = "", actions = [] }) {
  return `<div class="roll-card ${tone}">
      <div class="die"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,3 92,27 92,73 50,97 8,73 8,27"/><polygon class="inner" points="50,18 79,35 79,65 50,82 21,65 21,35"/></svg><span class="num">${total}</span></div>
      <div class="grow"><div class="roll-label">${esc(label)}</div><div class="roll-detail num">${detail}</div>${note ? `<div class="roll-note">${note}</div>` : ""}</div>
    </div>
    ${actions.length ? `<div class="roll-actions">${actions.map((x) => `<button class="${x.primary ? "go" : ""}" ${x.attrs}>${x.label}</button>`).join("")}</div>` : ""}`;
}
function rollD20(bonus, label, mode = S.rollMode) {
  const a = rollDie(20), b = rollDie(20);
  const pick = mode === "adv" ? Math.max(a, b) : mode === "dis" ? Math.min(a, b) : a;
  const c = C();
  const ex = c ? c.exhaustion * 2 : 0;
  const total = pick + Number(bonus) - ex;
  const dice = mode === "normal" ? `[${a}]` : `[${pick === a ? `<b>${a}</b>, <s>${b}</s>` : `<s>${a}</s>, <b>${b}</b>`}]`;
  const attrs = (m) => `data-act="reroll" data-roll="${bonus}" data-label="${esc(label)}" data-mode="${m}"`;
  toast(rollCard({
    label, total, tone: pick === 20 ? "crit" : pick === 1 ? "fumble" : "",
    detail: `d20 ${dice} ${signed(Number(bonus))}${ex ? ` −${ex} exhaustion` : ""}`,
    note: [mode === "adv" ? "Advantage" : mode === "dis" ? "Disadvantage" : "", pick === 20 ? "Natural 20!" : pick === 1 ? "Natural 1" : ""].filter(Boolean).join(" · "),
    actions: [{ label: "Advantage", attrs: attrs("adv") }, { label: "Disadvantage", attrs: attrs("dis") }, { label: "Roll again", attrs: attrs("normal") }],
  }), 9000);
}

function showShortRest() {
  const c = C();
  const con = abilityMods(c, DB).con;
  modal(`<h2>Short rest</h2><p class="muted small">Spend Hit Dice to heal: each one heals its roll + ${con} (your Constitution modifier).</p>
    <div class="list">${hitDice(c, DB).map((h) => `<div class="row"><span class="grow num">d${h.die}: ${h.total - h.spent} left</span><button class="btn" data-act="spend-hd" data-id="${h.die}" ${h.total - h.spent ? "" : "disabled"}>Spend 1</button></div>`).join("")}</div>
    <p class="num">HP ${c.hp.current ?? maxHP(c, DB)} / ${maxHP(c, DB)}</p>
    <button class="btn primary" data-act="finish-short">Finish short rest</button>
    <p class="muted small">Finishing refills Warlock Pact Magic slots and short-rest resources.</p>`);
}
function showMenu() {
  const c = C();
  modal(`<h2>${esc(c.name || "Character")}</h2>
    <button class="btn primary" data-act="level-up">Level up</button>
    <button class="btn" data-act="edit" data-step="basics">Edit character</button>
    <button class="btn" data-act="adjust">Adjust HP max, AC, speed</button>
    <button class="btn" data-act="export">Save to phone (.json)</button>
    <button class="btn" data-act="duplicate">Duplicate</button>
    <button class="btn danger" data-act="delete-ask">Delete character</button>
    <button class="btn ghost" data-act="close-modal">Close</button>`);
}
function showLevelUp() {
  const c = C();
  const existing = c.classes.map((k) => `<button class="btn" data-act="level-class" data-id="${k.id}">${esc(DB.classes[k.id]?.name)} ${k.level} → ${k.level + 1}</button>`).join("");
  const others = Object.values(DB.classes).filter((x) => allowed(x) && !c.classes.some((k) => k.id === x.id)).sort(byName);
  modal(`<h2>Level up to ${totalLevel(c) + 1}</h2>
    ${totalLevel(c) >= 20 ? '<p class="muted">You are already level 20.</p>' : `${existing}
    <div class="label">Or multiclass</div>
    <div class="list">${others.map((x) => `<button class="btn ${multiclassOK(c, DB, x.id) ? "" : "ghost"}" data-act="level-class" data-id="${x.id}">${esc(x.name)} 1 ${multiclassOK(c, DB, x.id) ? "" : `<span class="badge warn">needs ${esc(x.multiclass?.prereq || "13")}</span>`}</button>`).join("")}</div>`}
    <button class="btn ghost" data-act="close-modal">Cancel</button>`);
}
function showAdjust() {
  const c = C();
  modal(`<h2>Adjustments</h2><p class="muted small">For magic items, rolled HP, or anything the app doesn't calculate.</p>
    <div class="field"><label class="label" for="adj-hpmax">HP maximum override (blank = calculate)</label><input type="number" id="adj-hpmax" value="${c.hp.maxOverride || ""}"></div>
    <div class="field"><label class="label" for="adj-hp">Bonus HP</label><input type="number" id="adj-hp" value="${c.hpBonus || 0}"></div>
    <div class="field"><label class="label" for="adj-ac">Bonus AC (e.g. +1 armor, Ring of Protection)</label><input type="number" id="adj-ac" value="${c.acBonus || 0}"></div>
    <div class="field"><label class="label" for="adj-speed">Bonus speed</label><input type="number" id="adj-speed" value="${c.speedBonus || 0}"></div>
    <div class="field"><label class="label" for="adj-init">Bonus initiative</label><input type="number" id="adj-init" value="${c.initBonus || 0}"></div>
    <button class="btn primary" data-act="save-adjust">Save</button>`);
}
// ---------- saving characters as .json files ----------
function exportPayload(all) {
  const data = all ? S.chars : [C()];
  const name = all ? "5e-builder-all-characters" : slug(C().name || "character") + "-lv" + totalLevel(C());
  return { name: name + ".json", text: JSON.stringify({ heroforge: 1, saved: new Date().toISOString(), characters: data }, null, 1) };
}
// Inside a Claude artifact, plain downloads are blocked; the artifact "downloads" capability asks the viewer
// to confirm and then saves the file. As a downloaded HTML file, normal download/share is used instead.
const ARTIFACT_DOWNLOADS = window.claude?.use ? window.claude.use("downloads").catch(() => null) : Promise.resolve(null);
async function showExport(all) {
  const { name, text } = exportPayload(all);
  S.exportAll = all;
  const dl = await ARTIFACT_DOWNLOADS;
  const canShare = !dl && !!(navigator.canShare && navigator.canShare({ files: [new File([text], name, { type: "application/json" })] }));
  modal(`<h2>Save to your phone</h2>
    <p class="muted small">Saves <b>${esc(name)}</b>. Keep it in Files (iPhone) or Downloads (Android). To restore, tap <b>Import</b> on the home screen and pick the file.</p>
    ${dl ? `<button class="btn primary" data-act="artifact-save">Save ${esc(name)}</button>` : `
    ${canShare ? `<button class="btn primary" data-act="share-file">Share or Save to Files…</button>` : ""}
    <button class="btn ${canShare ? "" : "primary"}" data-act="download-file">Download ${esc(name)}</button>`}
    <details class="feature"><summary><b>Copy as text instead</b></summary><div class="body stack">
      <textarea id="export-text" readonly style="min-height:160px;font-family:ui-monospace,monospace;font-size:.72rem">${esc(text)}</textarea>
      <button class="btn" data-act="copy-export">Copy to clipboard</button></div></details>
    <button class="btn ghost" data-act="close-modal">Close</button>`);
}
function downloadFile() {
  const { name, text } = exportPayload(S.exportAll);
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(`Saved ${esc(name)}. Check your Downloads.`, 3000);
}
async function artifactSave() {
  const dl = await ARTIFACT_DOWNLOADS;
  const { name, text } = exportPayload(S.exportAll);
  if (!dl) return downloadFile();
  try {
    await dl.save({ filename: name, data: text });
    toast(`Saved ${esc(name)}.`, 3000);
  } catch (e) {
    if (e?.code === "declined") return;
    if (e?.code === "rate_limited") return toast("A save prompt is already open. Finish that one first.", 3500);
    toast("Saving files isn't available here. Use “Copy as text instead” below.", 4500);
  }
}
async function shareFile() {
  const { name, text } = exportPayload(S.exportAll);
  try {
    await navigator.share({ files: [new File([text], name, { type: "application/json" })], title: name });
  } catch (e) {
    if (e?.name !== "AbortError") downloadFile();
  }
}
function showImport() {
  modal(`<h2>Import characters</h2><p class="muted small">Pick a saved <b>.json</b> character file, or paste a backup's text.</p>
    <input type="file" id="import-file" accept=".json,.txt,application/json,text/plain">
    <textarea id="import-text" placeholder='or paste {"heroforge":1,"characters":[…]}'></textarea>
    <button class="btn primary" data-act="do-import">Import</button>
    <button class="btn" data-act="export-all">Back up all characters</button>
    <button class="btn ghost" data-act="close-modal">Close</button>`);
}
function showSettings() {
  modal(`<h2>Books</h2><p class="muted small">Turn off books your table doesn't use. Their options disappear from the pickers. Existing characters keep what they have.</p>
    <div class="list">${BOOKS.map((b) => `<button class="pick multi ${S.books[b] !== false ? "on" : ""}" data-act="toggle-book" data-id="${esc(b)}"><span class="check"></span><span class="grow">${esc(b)}</span></button>`).join("")}</div>
    <button class="btn ghost" data-act="close-modal">Done</button>`);
}

function equipToSlot(c, slot, u) {
  if (slot === "armor" || slot === "shield") {
    c.inventory.forEach((i) => { if (i.kind === slot) i.equipped = i.uid === u; });
    return;
  }
  // hands: main = first equipped weapon, off = second
  const held = c.inventory.filter((i) => i.kind === "weapon" && i.equipped);
  const replace = slot === "main" ? held[0] : held[1];
  if (replace) replace.equipped = false;
  const it = c.inventory.find((i) => i.uid === u);
  if (it) {
    it.equipped = true;
    if (slot === "main") { c.inventory = [it, ...c.inventory.filter((i) => i !== it)]; } // keep it first so it shows as Main Hand
  }
}
function showSlotPicker(slot) {
  const c = C();
  const kind = slot === "main" || slot === "off" ? "weapon" : slot;
  const list = c.inventory.filter((i) => i.kind === kind);
  const label = { main: "Main Hand", off: "Off Hand", armor: "Armor", shield: "Shield" }[slot];
  modal(`<h2>${label}</h2>
    ${list.length ? `<div class="list">${list.map((i) => `<button class="pick ${i.equipped ? "on" : ""}" data-act="equip-to" data-id="${slot}|${i.uid}"><span class="check"></span><span class="grow"><b>${esc(i.name)}</b>
      <span class="small soft" style="display:block">${esc(kind === "weapon" ? (DB.weaponByName[i.name] ? DB.weaponByName[i.name].damage + " " + DB.weaponByName[i.name].damageType : "") : DB.armorByName[i.name] ? "AC " + DB.armorByName[i.name].baseAC : "")}</span></span></button>`).join("")}</div>
      <button class="btn" data-act="equip-to" data-id="${slot}|none">Leave empty</button>` : `<p class="muted">Nothing in your inventory fits here. Add one under Inventory.</p>`}
    <button class="btn ghost" data-act="close-modal">Close</button>`);
}
// ---------- portrait gallery ----------
const GAL = { gender: "all", race: "all", cls: "all" };
function showGallery() {
  const c = C();
  const matchRaces = ART_RACES[c.species] || null;
  const raceOk = (p) => GAL.race === "all" || (GAL.race === "match" ? !matchRaces || matchRaces.includes(p.race) : p.race === GAL.race);
  const myClass = c.classes[0]?.id;
  const list = PORTRAITS.filter((p) => (GAL.gender === "all" || p.gender === GAL.gender) && raceOk(p) && (GAL.cls === "all" || p.class === GAL.cls))
    .sort((a, b) => (b.class === myClass) - (a.class === myClass)); // their class first
  const races = [...new Set(PORTRAITS.map((p) => p.race))].sort();
  const classes = [...new Set(PORTRAITS.map((p) => p.class))].sort();
  const cap = (s) => s.replace(/(^|-)\w/g, (m) => m.toUpperCase());
  const prev = layer.querySelector(".sheet-modal")?.scrollTop || 0;
  modal(`<div class="row"><h2 class="grow">Choose a portrait</h2><button class="btn small" data-act="close-modal">Close</button></div>
    <div class="row"><button class="btn small grow" data-act="portrait-upload">Upload your own</button>${portraitSrc(c) ? '<button class="btn small danger" data-act="portrait-clear">Remove</button>' : ""}</div>
    ${chips([["all", "Any gender"], ["male", "Male"], ["female", "Female"]].map(([v, l]) => ({ id: "gender|" + v, label: l, on: GAL.gender === v })), "gal-f")}
    ${chips([...(matchRaces ? [{ id: "race|match", label: `Matches ${DB.species[c.species]?.name}`, on: GAL.race === "match" }] : []), { id: "race|all", label: "All races", on: GAL.race === "all" },
      ...races.map((r) => ({ id: "race|" + r, label: cap(r), on: GAL.race === r }))], "gal-f")}
    ${chips([{ id: "cls|all", label: "All classes", on: GAL.cls === "all" }, ...classes.map((x) => ({ id: "cls|" + x, label: cap(x), on: GAL.cls === x }))], "gal-f")}
    <p class="small soft">${list.length} portrait${list.length === 1 ? "" : "s"}${myClass ? `. ${esc(DB.classes[myClass]?.name || "")} art first.` : ""}</p>
    ${PORTRAITS.length ? `<div class="gallery">${list.map((p) => `<button class="gimg ${c.portraitId === p.id && !c.portrait ? "on" : ""}" data-act="gal-pick" data-id="${p.id}" aria-label="${esc(cap(p.race) + " " + p.class)}">
      <img src="${p.src}" alt="" loading="lazy" decoding="async"><span class="tag">${esc(cap(p.race))} · ${esc(p.class)}</span></button>`).join("")}</div>`
      : `<p class="muted">The portrait library isn't included in this copy. Upload your own instead.</p>`}`);
  const box = layer.querySelector(".sheet-modal");
  if (box) box.scrollTop = prev;
}

// ---------- item browser ----------
const ARM = { q: "", cat: "all", rarity: "all" };
function itemMeta(cat, x) {
  if (cat === "weapons") return `${x.damage} ${x.damageType} · ${x.category} ${x.kind}${x.properties.length ? " · " + x.properties.join(", ") : ""}${x.mastery ? " · Mastery: " + x.mastery : ""}`;
  if (cat === "armor") return x.category === "shield" ? `+${x.baseAC} AC · Shield`
    : `AC ${x.baseAC}${x.dexCap === 0 ? "" : x.dexCap ? " + Dex (max " + x.dexCap + ")" : " + Dex"} · ${x.category}${x.strength ? " · Str " + x.strength : ""}${x.stealthDisadvantage ? " · Stealth disadvantage" : ""}`;
  if (cat === "tools") return `${x.ability ? ABILITY_NAMES[x.ability] + " · " : ""}Tool`;
  if (cat === "magic") return String(x.text || "").replace(/[*_#]/g, "").slice(0, 120);
  return String(x.text || "").replace(/[*_]/g, "").slice(0, 110);
}
function showArmory(keepFocus) {
  const c = C();
  const eq = DB.raw.equipment;
  const magic = MAGIC.filter((m) => allowed(m) && (ARM.rarity === "all" || m.rarity === ARM.rarity));
  const cats = [["weapons", "Weapons", eq.weapons], ["armor", "Armor", eq.armor], ["gear", "Gear", eq.gear], ["tools", "Tools", eq.tools], ["magic", "Magic items", magic]];
  const q = ARM.q.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const owned = (name) => c.inventory.filter((i) => i.name === name).reduce((n, i) => n + i.qty, 0);
  let total = 0, exact = false;
  const sections = cats.filter(([k]) => ARM.cat === "all" || ARM.cat === k).map(([k, label, items]) => {
    const hits = items.filter((x) => { return wordsMatch(x.name.toLowerCase(), itemMeta(k, x).toLowerCase(), words); })
      .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name));
    if (hits.some((x) => x.name.toLowerCase() === q)) exact = true;
    total += hits.length;
    const shown = hits.slice(0, k === "magic" && !q && ARM.cat !== "magic" ? 30 : 400);
    return hits.length ? `<div class="sub-head">${label} <span class="soft">${hits.length}</span></div>${shown.map((x) => {
      const n = owned(x.name);
      const art = k === "magic" ? ITEM_ART["m:" + x.id] : ITEM_ART[slug(x.name)];
      return `
      <div class="arm-row"><span class="thumb" ${art ? `style="background-image:url(${art})"` : ""}></span><div class="grow"><b>${esc(x.name)}</b>${n ? ` <span class="own">×${n} in pack</span>` : ""}
        ${k === "magic" ? `<span class="meta"><span class="rar rar-${rarityKey(x.rarity)}">${esc(x.rarity)}</span> · ${esc(x.category)}${x.attunement ? " · Attunement" + (typeof x.attunement === "string" ? " " + esc(x.attunement) : "") : ""}</span>` : ""}
        <span class="meta">${esc(itemMeta(k, x))}</span></div>
        ${k === "magic" ? "" : `<span class="cost num">${esc(x.cost || "")}${x.weight ? `<br>${x.weight} lb` : ""}</span>`}
        <button class="btn icon add" data-act="${k === "magic" ? "armory-magic" : "armory-add"}" data-id="${esc(k === "magic" ? x.id : x.name)}" aria-label="Add ${esc(x.name)}">+</button></div>`; }).join("")}
      ${shown.length < hits.length ? `<button class="btn small ghost" data-act="armory-cat" data-id="magic">Show all ${hits.length} magic items</button>` : ""}` : "";
  }).join("");
  const prevScroll = layer.querySelector(".sheet-modal")?.scrollTop || 0;
  modal(`<div class="row"><h2 class="grow">Add items</h2><button class="btn small" data-act="close-modal">Done</button></div>
    ${searchBox("Search gear (e.g. sword, rope, AC 16, finesse)", total, "armory-q", ARM.q, "data-armory")}
    ${chips([["all", "All"], ...cats.map(([k, l]) => [k, l])].map(([id, label]) => ({ id, label, on: ARM.cat === id })), "armory-cat")}
    ${ARM.cat === "magic" ? chips([{ id: "all", label: "Any rarity", on: ARM.rarity === "all" }, ...RARITIES.filter((r) => MAGIC.some((m) => m.rarity === r)).map((r) => ({ id: r, label: r, on: ARM.rarity === r }))], "armory-rarity") : ""}
    <button class="btn small" data-act="ci-new">✎ Create a custom item</button>
    <div>${sections || `<p class="muted">Nothing in the rules matches “${esc(ARM.q.trim())}”.</p>`}</div>
    ${q && !exact ? `<button class="btn ${sections ? "ghost" : ""}" data-act="armory-custom">✎ Create “${esc(ARM.q.trim())}” as a custom item</button>` : ""}`);
  const box = layer.querySelector(".sheet-modal");
  if (box) box.scrollTop = prevScroll;
  if (keepFocus) { const inp = document.getElementById("armory-q"); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
function addToPack(c, name, custom) {
  const it = custom ? { name, qty: 1, kind: "gear", weight: 0 } : parseItem(name);
  const same = c.inventory.find((i) => i.name === it.name);
  if (same) same.qty += 1; else c.inventory.push({ uid: uid(), ...it, equipped: false });
}

function showItem(u) {
  const c = C();
  const i = c.inventory.find((x) => x.uid === u);
  if (!i) return closeModal();
  const w = itemWeapon(i, DB), a = itemArmor(i, DB), g = DB.gearByName[i.ref || i.name];
  const mi = MAGIC_BY_ID[i.magicId];
  const plus = Number(i.bonus) ? ` · +${i.bonus} magic bonus` : "";
  const stats = i.kind === "weapon" && w ? `${w.damage}${Number(i.bonus) ? "+" + i.bonus : ""} ${w.damageType} · ${w.category} ${w.kind}${w.properties?.length ? " · " + w.properties.join(", ") : ""}${w.mastery ? " · Mastery: " + w.mastery : ""}`
    : (i.kind === "armor" || i.kind === "shield") && a ? `${a.category === "shield" ? "+" + a.baseAC + " AC" : "AC " + a.baseAC + (a.dexCap === 0 ? "" : a.dexCap ? " + Dex (max " + a.dexCap + ")" : " + Dex")}${plus}${a.strength ? " · Str " + a.strength : ""}${a.stealthDisadvantage ? " · Stealth disadvantage" : ""}` : "";
  const text = i.text || mi?.text || g?.text || "";
  const rarity = i.rarity || mi?.rarity;
  modal(`<div style="height:4px;background:var(--gold)"></div>
    ${itemArt(i) ? `<div class="item-hero" style="background-image:url(${itemArt(i)})"></div>` : ""}
    <h2 style="text-align:center">${esc(i.name)}</h2>
    ${rarity ? `<p style="text-align:center"><span class="rar rar-${rarityKey(rarity)}">${esc(rarity)}</span>${i.attune ? ' <span class="badge">Requires attunement</span>' : ""}${i.custom ? ' <span class="badge">Custom</span>' : ""}</p>` : i.custom ? '<p style="text-align:center"><span class="badge">Custom</span></p>' : ""}
    ${stats ? `<p style="color:var(--gold);text-align:center">${esc(stats)}</p>` : ""}
    ${text ? `<div class="small" style="color:#d8d2c4">${md(text)}</div>` : ""}
    <p class="small soft">${i.weight ? i.weight + " lb each" : ""}${i.cost || g?.cost || w?.cost || a?.cost ? " · " + esc(i.cost || g?.cost || w?.cost || a?.cost) : ""}</p>
    <div class="row"><span class="grow">Quantity</span><div class="stepper"><button class="btn icon" data-act="item-qty" data-id="${u}|-1">−</button><span class="v num">${i.qty}</span><button class="btn icon" data-act="item-qty" data-id="${u}|1">+</button></div></div>
    ${["weapon", "armor", "shield"].includes(i.kind) ? `<button class="btn primary" data-act="item-equip" data-id="${u}">${i.equipped ? "Unequip" : "Equip"}</button>` : ""}
    ${i.attune ? `<button class="btn ${i.attuned ? "" : "primary"}" data-act="item-attune" data-id="${u}">${i.attuned ? "End attunement" : "Attune (short rest)"}</button>` : ""}
    <button class="btn" data-act="ci-edit" data-id="${u}">✎ Edit${i.custom ? "" : " / make it magic"}</button>
    <button class="btn danger" data-act="item-remove" data-id="${u}">Remove from inventory</button>
    <button class="btn ghost" data-act="close-modal">Close</button>`);
}

// ---------- custom items (create & edit) ----------
const CI_TYPES = [["weapon", "Weapon"], ["armor", "Armor"], ["shield", "Shield"], ["gear", "Gear"], ["magic", "Magic item"]];
const DAMAGE_TYPES = ["Slashing", "Piercing", "Bludgeoning", "Fire", "Cold", "Lightning", "Thunder", "Acid", "Poison", "Necrotic", "Radiant", "Force", "Psychic"];
let CI = null;
function blankCustom(name = "") {
  return { uid: null, name, kind: "gear", base: "", qty: 1, weight: 0, cost: "", bonus: 0, attune: false, rarity: "", text: "", img: null, magicId: null,
    weapon: { damage: "1d8", damageType: "Slashing", category: "martial", kind: "melee", properties: "" },
    armor: { baseAC: 12, category: "light" }, shieldAC: 2 };
}
// Fill the form from a standard weapon/armor (the Weapon / Armor / Shield Type picker).
function applyBase(ci, name) {
  const generic = ci.magicId && GENERIC_MAGIC.test(ci.magicId);
  if (generic && (!ci.name || /^\+\d /.test(ci.name))) ci.name = `+${ci.bonus || ci.magicId.match(/\d/)[0]} ${name}`;
  ci.base = name;
  const w = DB.weaponByName[name], a = DB.armorByName[name];
  if (w) ci.weapon = { damage: w.damage, damageType: w.damageType, category: w.category, kind: w.kind, properties: (w.properties || []).join(", ") };
  if (a && a.category !== "shield") ci.armor = { baseAC: a.baseAC, category: a.category };
  if (a?.category === "shield") ci.shieldAC = a.baseAC;
  const src = w || a;
  if (src) { ci.weight = src.weight || 0; if (!ci.cost) ci.cost = src.cost || ""; }
}
function customFromItem(i) {
  const ci = blankCustom(i.name);
  Object.assign(ci, { uid: i.uid, qty: i.qty, weight: i.weight || 0, cost: i.cost || "", bonus: Number(i.bonus) || 0, attune: !!i.attune, rarity: i.rarity || "",
    text: i.text || "", img: i.img || null, magicId: i.magicId || null, kind: i.magic && i.kind === "gear" ? "magic" : i.kind });
  const base = i.ref || (DB.weaponByName[i.name] || DB.armorByName[i.name] ? i.name : "");
  if (base) applyBase(ci, base);
  const w = i.stats?.weapon, a = i.stats?.armor;
  if (w) ci.weapon = { damage: w.damage, damageType: w.damageType, category: w.category, kind: w.kind, properties: (w.properties || []).join(", ") };
  if (a && a.category !== "shield") ci.armor = { baseAC: a.baseAC, category: a.category };
  if (a?.category === "shield") ci.shieldAC = a.baseAC;
  ci.weight = i.weight || ci.weight;
  return ci;
}
function customFromMagic(m) {
  const ci = blankCustom(m.name);
  Object.assign(ci, { kind: m.baseKind || (["Weapon", "Armor", "Shield"].includes(m.category) ? m.category.toLowerCase() : "magic"), bonus: m.bonus || 0,
    attune: !!m.attunement, rarity: m.rarity, text: m.text, magicId: m.id });
  if (m.bases?.length) applyBase(ci, m.bases[0]);
  return ci;
}
function readCustomForm() {
  const v = (id) => document.getElementById(id)?.value ?? "";
  if (!document.getElementById("ci-name")) return;
  CI.name = v("ci-name").trim(); CI.qty = Math.max(1, parseInt(v("ci-qty"), 10) || 1); CI.weight = parseFloat(v("ci-weight")) || 0; CI.cost = v("ci-cost").trim();
  CI.text = v("ci-text"); CI.attune = !!document.getElementById("ci-attune")?.checked; CI.rarity = v("ci-rarity");
  if (document.getElementById("ci-bonus")) CI.bonus = parseInt(v("ci-bonus"), 10) || 0;
  if (CI.kind === "weapon") CI.weapon = { damage: v("ci-dmg").trim() || "1d6", damageType: v("ci-dtype"), category: v("ci-wcat"), kind: v("ci-wkind"), properties: v("ci-props") };
  if (CI.kind === "armor") CI.armor = { baseAC: parseInt(v("ci-ac"), 10) || 10, category: v("ci-acat") };
  if (CI.kind === "shield") CI.shieldAC = parseInt(v("ci-sac"), 10) || 2;
}
function customArt(ci) {
  return ci.img || (ci.magicId && GENERIC_MAGIC.test(ci.magicId) && ci.base && ITEM_ART[slug(ci.base)])
    || (ci.magicId && ITEM_ART["m:" + ci.magicId]) || (ci.base && ITEM_ART[slug(ci.base)]) || null;
}
function showCustomItem() {
  const ci = CI;
  const art = customArt(ci);
  const opt = (list, cur) => list.map(([val, label]) => `<option value="${esc(val)}" ${String(cur) === String(val) ? "selected" : ""}>${esc(label)}</option>`).join("");
  const bases = ci.kind === "weapon" ? DB.raw.equipment.weapons : ci.kind === "armor" ? DB.raw.equipment.armor.filter((a) => a.category !== "shield")
    : ci.kind === "shield" ? DB.raw.equipment.armor.filter((a) => a.category === "shield") : [];
  const allowedBases = ci.magicId && MAGIC_BY_ID[ci.magicId]?.bases?.length ? bases.filter((b) => MAGIC_BY_ID[ci.magicId].bases.includes(b.name)) : bases;
  modal(`<div class="row"><h2 class="grow">${ci.uid ? "Edit item" : "Custom item"}</h2><button class="btn small" data-act="close-modal">Cancel</button></div>
    <div class="portrait-pick"><span class="thumb" style="${art ? `background-image:url(${art})` : ""}">${art ? "" : "?"}</span>
      <div class="stack" style="gap:6px"><button class="btn small" data-act="ci-img">${ci.img ? "Change picture" : "Add a picture"}</button>${ci.img ? '<button class="btn small ghost" data-act="ci-img-clear">Remove picture</button>' : ""}</div></div>
    <div class="field"><label class="label" for="ci-name">Name</label><input type="text" id="ci-name" value="${esc(ci.name)}" placeholder="e.g. Grandfather's Lucky Axe"></div>
    <div class="seg">${CI_TYPES.map(([k, l]) => `<button class="${ci.kind === k ? "on" : ""}" data-act="ci-type" data-id="${k}">${l}</button>`).join("")}</div>
    ${bases.length ? `<div class="field"><label class="label" for="ci-base">${{ weapon: "Weapon Type", armor: "Armor Type", shield: "Shield Type" }[ci.kind]}</label><select id="ci-base"><option value="">${ci.kind === "weapon" ? "Custom weapon" : ci.kind === "armor" ? "Custom armor" : "Custom shield"}</option>${opt(allowedBases.map((b) => [b.name, b.name]), ci.base)}</select>
      ${ci.magicId && MAGIC_BY_ID[ci.magicId]?.bases?.length ? `<span class="small soft">This item can be: ${esc(MAGIC_BY_ID[ci.magicId].bases.join(", "))}.</span>` : ""}</div>` : ""}
    ${ci.kind === "weapon" ? `<div class="form-grid two">
      <div class="field"><label class="label" for="ci-dmg">Damage</label><input type="text" id="ci-dmg" value="${esc(ci.weapon.damage)}" placeholder="1d8"></div>
      <div class="field"><label class="label" for="ci-dtype">Damage type</label><select id="ci-dtype">${opt(DAMAGE_TYPES.map((d) => [d, d]), ci.weapon.damageType)}</select></div>
      <div class="field"><label class="label" for="ci-wcat">Category</label><select id="ci-wcat">${opt([["simple", "Simple"], ["martial", "Martial"]], ci.weapon.category)}</select></div>
      <div class="field"><label class="label" for="ci-wkind">Range</label><select id="ci-wkind">${opt([["melee", "Melee"], ["ranged", "Ranged"]], ci.weapon.kind)}</select></div></div>
      <div class="field"><label class="label" for="ci-props">Properties (comma separated)</label><input type="text" id="ci-props" value="${esc(ci.weapon.properties)}" placeholder="Finesse, Light, Thrown (Range 20/60)"></div>` : ""}
    ${ci.kind === "armor" ? `<div class="form-grid two">
      <div class="field"><label class="label" for="ci-ac">Base AC</label><input type="number" id="ci-ac" value="${ci.armor.baseAC}"></div>
      <div class="field"><label class="label" for="ci-acat">Armor type</label><select id="ci-acat">${opt([["light", "Light (+ full Dex)"], ["medium", "Medium (+ Dex, max 2)"], ["heavy", "Heavy (no Dex)"]], ci.armor.category)}</select></div></div>` : ""}
    ${ci.kind === "shield" ? `<div class="field"><label class="label" for="ci-sac">Shield AC</label><input type="number" id="ci-sac" value="${ci.shieldAC}"></div>` : ""}
    <div class="form-grid two">
      ${["weapon", "armor", "shield"].includes(ci.kind) ? `<div class="field"><label class="label" for="ci-bonus">Magic bonus</label><select id="ci-bonus">${opt([[0, "None"], [1, "+1"], [2, "+2"], [3, "+3"]], ci.bonus)}</select></div>` : ""}
      <div class="field"><label class="label" for="ci-rarity">Rarity</label><select id="ci-rarity">${opt([["", "Not magic"], ...RARITIES.map((r) => [r, r])], ci.rarity)}</select></div></div>
    <div class="form-grid">
      <div class="field"><label class="label" for="ci-qty">Quantity</label><input type="number" id="ci-qty" min="1" value="${ci.qty}"></div>
      <div class="field"><label class="label" for="ci-weight">Weight (lb)</label><input type="number" id="ci-weight" step="0.25" value="${ci.weight}"></div>
      <div class="field"><label class="label" for="ci-cost">Value</label><input type="text" id="ci-cost" value="${esc(ci.cost)}" placeholder="10 GP"></div></div>
    <label class="check-row" for="ci-attune"><input type="checkbox" id="ci-attune" ${ci.attune ? "checked" : ""}> Requires attunement</label>
    <div class="field"><label class="label" for="ci-text">What it does</label><textarea id="ci-text" placeholder="Glows faintly near goblins. Once per day, reroll a missed attack.">${esc(ci.text)}</textarea></div>
    <button class="btn primary" data-act="ci-save">${ci.uid ? "Save changes" : "Add to inventory"}</button>`);
}
function saveCustomItem(c) {
  const ci = CI;
  const existing = c.inventory.find((i) => i.uid === ci.uid);
  const it = { uid: ci.uid || uid(), name: ci.name, qty: ci.qty, weight: ci.weight, cost: ci.cost, kind: ci.kind === "magic" ? "gear" : ci.kind,
    custom: true, magic: !!ci.rarity || ci.kind === "magic" || ci.bonus > 0, rarity: ci.rarity || (ci.bonus > 0 ? "" : ""), bonus: ci.bonus || 0,
    attune: ci.attune, attuned: existing?.attuned && ci.attune, text: ci.text, img: ci.img || undefined, magicId: ci.magicId || undefined,
    ref: ci.base || undefined, equipped: existing?.equipped || false };
  if (ci.kind === "weapon") {
    const base = DB.weaponByName[ci.base];
    it.stats = { weapon: { name: ci.base || ci.name, category: ci.weapon.category, kind: ci.weapon.kind, damage: ci.weapon.damage, damageType: ci.weapon.damageType,
      properties: ci.weapon.properties.split(",").map((x) => x.trim()).filter(Boolean), mastery: base?.mastery || null } };
  }
  if (ci.kind === "armor") {
    const base = DB.armorByName[ci.base];
    it.stats = { armor: { name: ci.name, category: ci.armor.category, baseAC: ci.armor.baseAC, dexCap: { light: null, medium: 2, heavy: 0 }[ci.armor.category],
      strength: base?.strength || 0, stealthDisadvantage: base?.stealthDisadvantage || false } };
  }
  if (ci.kind === "shield") it.stats = { armor: { name: ci.name, category: "shield", baseAC: ci.shieldAC } };
  if (existing) Object.assign(existing, it); else c.inventory.push(it);
}

// ============================================================
// ACTIONS (every data-act value is handled here)
// ============================================================
// New "spent" count after tapping pip j of n (remaining pips are the left-most ones).
function spendTo(j, n, spent) { return j < n - spent ? n - j : n - j - 1; }
function idParts(el) { return (el.dataset.id || "").split("|"); }
function toggleIn(arr, v) { const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); }
function changeHP(kind) {
  const amt = Math.abs(parseInt(document.getElementById("hp-amt")?.value, 10) || 0);
  if (!amt) return toast("Type a number first, then tap Damage, Heal or Temp HP.", 3000);
  update((c) => {
    const max = maxHP(c, DB);
    let cur = c.hp.current ?? max;
    if (kind === "dmg") {
      const fromTemp = Math.min(c.hp.temp, amt);
      c.hp.temp -= fromTemp;
      cur = Math.max(0, cur - (amt - fromTemp));
    } else if (kind === "heal") {
      if (cur === 0) c.deathSaves = { s: 0, f: 0 };
      cur = Math.min(max, cur + amt);
    } else c.hp.temp = Math.max(c.hp.temp, amt); // temp HP doesn't stack: keep the higher
    c.hp.current = cur;
  });
}
const ACTIONS = {
  "new": () => { const c = newCharacter(); S.chars.unshift(c); S.charId = c.id; S.view = "build"; S.step = "basics"; S.editing = false; persist(); render(); window.scrollTo(0, 0); },
  "open": (el) => { S.charId = el.dataset.id; S.view = "sheet"; S.tab = "overview"; render(); window.scrollTo(0, 0); },
  "home": () => { S.view = "list"; S.featSlot = null; persist(); render(); window.scrollTo(0, 0); },
  "step": (el) => { S.step = el.dataset.step; S.filter = ""; S.featSlot = null; render(); window.scrollTo(0, 0); },
  "finish": () => { S.view = "sheet"; S.tab = "overview"; const c = C(); if (!c.equipApplied) applyEquipment(c); persist(); render(); window.scrollTo(0, 0); },
  "edit": (el) => { closeModal(); S.view = "build"; S.editing = true; S.step = el.dataset.step || "basics"; S.filter = ""; render(); window.scrollTo(0, 0); },
  "done-edit": () => { S.view = "sheet"; S.featSlot = null; persist(); render(); window.scrollTo(0, 0); },
  "toggle-open": (el) => { S.open[el.dataset.id] = !S.open[el.dataset.id]; S.keepScroll = true; render(); },
  "tab": (el) => { S.tab = el.dataset.id; S.keepScroll = true; render(); },
  "subtab": (el) => { const [t, k] = idParts(el); S.sub[t] = k; S.keepScroll = true; render(); },
  // builder choices
  "add-class": () => update((c) => { const id = document.getElementById("add-class")?.value; if (id) c.classes.push({ id, level: 1, subclass: null }); }),
  "remove-class": (el) => update((c) => c.classes.splice(+el.dataset.i, 1)),
  "set-subclass": (el) => { S.keepScroll = true; update((c) => { const [i, id] = idParts(el); c.classes[+i].subclass = c.classes[+i].subclass === id ? null : id; }); },
  "set-background": (el) => { S.keepScroll = true; update((c) => {
    if (c.background === el.dataset.id) return;
    c.background = el.dataset.id; c.bgBonus = {};
    const bg = DB.backgrounds[c.background];
    c.feats = c.feats.filter((f) => f.slot !== "background");
    if (bg?.feat) c.feats.push({ id: bg.feat, slot: "background" });
    for (const sk of bg?.skills || []) if (!c.skills.includes(sk)) c.skills.push(sk);
  }); },
  "bg-bonus": (el) => { S.keepScroll = true; update((c) => {
    const [a, n] = idParts(el);
    c.bgBonus[a] = +n;
    if (+n === 2) for (const k in c.bgBonus) if (k !== a && c.bgBonus[k] === 2) c.bgBonus[k] = 1;
    for (const k in c.bgBonus) if (!c.bgBonus[k]) delete c.bgBonus[k];
  }); },
  "set-species": (el) => { S.keepScroll = true; update((c) => { if (c.species !== el.dataset.id) { c.species = el.dataset.id; c.lineage = null; c.size = null; c.speciesAbility = DB.species[c.species]?.spellAbilityChoice?.[0] || null; } }); },
  "set-lineage": (el) => { S.keepScroll = true; update((c) => { c.lineage = el.dataset.id; }); },
  "set-size": (el) => { S.keepScroll = true; update((c) => { c.size = el.dataset.id; }); },
  "set-species-ability": (el) => { S.keepScroll = true; update((c) => { c.speciesAbility = el.dataset.id; }); },
  "score-method": (el) => update((c) => {
    c.scoreMethod = el.dataset.id;
    if (c.scoreMethod === "standard") c.base = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
    if (c.scoreMethod === "pointbuy") c.base = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
    if (c.scoreMethod === "rolled") { c.rollAssign = c.rollAssign || {}; if (c.rolls?.length) syncRolledBase(c); else c.base = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }; }
  }),
  "pb": (el) => { S.keepScroll = true; update((c) => { const [a, d] = idParts(el); c.base[a] = Math.min(15, Math.max(8, c.base[a] + +d)); }); },
  "roll-stats": () => { closeModal(); S.pickRoll = null; S.keepScroll = true; update((c) => { c.rolls = rollAbilitySet(); c.rollAssign = {}; syncRolledBase(c); }); },
  "reroll-ask": () => modal(`<h2>Roll again?</h2><p>Your six current rolls and their assignments will be replaced. Check with your DM first.</p>
      <button class="btn primary" data-act="roll-stats">Roll again</button><button class="btn" data-act="close-modal">Keep my rolls</button>`),
  "pick-roll": (el) => { const i = +el.dataset.id; S.pickRoll = S.pickRoll === i ? null : i; S.keepScroll = true; render(); },
  "assign-to": (el) => { const i = S.pickRoll; S.pickRoll = null; S.keepScroll = true; update((c) => assignRoll(c, el.dataset.id, i)); },
  "auto-assign": () => { S.keepScroll = true; update((c) => {
    const cls = DB.classes[c.classes[0].id];
    const order = [...new Set([...(cls?.primaryAbility || []), "con", "dex", "wis", "str", "cha", "int"])];
    c.rollAssign = {}; order.forEach((a, i) => { c.rollAssign[a] = i; }); syncRolledBase(c);
  }); },
  "over-yes": () => { const p = S.pendingOver; const c = C(); if (!p || !c) return closeModal(); c.overOk[p.key] = true; S.pendingOver = null; closeModal(); p.apply(); },
  "toggle-skill": (el) => {
    const c = C(), sk = el.dataset.id;
    const apply = () => { S.keepScroll = true; update((c) => { toggleIn(c.skills, sk); if (!c.skills.includes(sk)) c.expertise = c.expertise.filter((s) => s !== sk); }); };
    if (c.skills.includes(sk)) return apply();
    guardLimit(c, "skills", c.skills.length, expectedSkillCount(c, DB), "skill proficiencies", apply);
  },
  "toggle-expertise": (el) => { S.keepScroll = true; update((c) => toggleIn(c.expertise, el.dataset.id)); },
  "toggle-mastery": (el) => {
    const c = C(), w = el.dataset.id;
    const apply = () => { S.keepScroll = true; update((c) => toggleIn(c.masteries, w)); };
    if (c.masteries.includes(w)) return apply();
    guardLimit(c, "masteries", c.masteries.length, masteryCount(c, DB), "Weapon Masteries", apply);
  },
  "toggle-option": (el) => { S.keepScroll = true; update((c) => toggleIn(c.options, el.dataset.id)); },
  "feat-slot": (el) => { S.featSlot = el.dataset.id || null; S.filter = ""; render(); window.scrollTo(0, 0); },
  "choose-feat": (el) => update((c) => {
    const [slot, id] = idParts(el);
    c.feats = c.feats.filter((f) => f.slot !== slot);
    c.feats.push({ id, slot, asi: {} });
    delete c.spells["feat:" + slot];
    S.featSlot = null;
  }),
  "feat-asi": (el) => { S.keepScroll = true; update((c) => {
    const [slot, a] = idParts(el);
    const f = c.feats.find((x) => x.slot === slot);
    const feat = DB.feats[f.id];
    f.asi = f.asi || {};
    const used = Object.values(f.asi).reduce((x, y) => x + y, 0);
    if (used >= feat.asi.amount) { if (f.asi[a]) delete f.asi[a]; else f.asi = { [a]: 1 }; }
    else if (f.asi[a] && !feat.asi.split && feat.asi.amount === 1) delete f.asi[a];
    else f.asi[a] = (f.asi[a] || 0) + 1;
  }); },
  "class-equip": (el) => { S.keepScroll = true; update((c) => { c.classEquip = el.dataset.id; }); },
  "bg-equip": (el) => { S.keepScroll = true; update((c) => { c.bgEquip = el.dataset.id; }); },
  "apply-equip": () => { S.keepScroll = true; update((c) => applyEquipment(c)); toast("Gear added to your inventory.", 2500); },
  "spell-tab": (el) => { S.spellTab = el.dataset.id; render(); },
  "toggle-spell": (el) => {
    const c = C();
    const [key, id] = idParts(el);
    const pick = (c.spells[key] = c.spells[key] || { cantrips: [], prepared: [] });
    const cantrip = DB.spells[id]?.level === 0;
    const list = cantrip ? pick.cantrips : pick.prepared;
    const apply = () => { S.keepScroll = true; update(() => toggleIn(list, id)); };
    if (list.includes(id)) return apply();
    const src = spellSources(c).find((x) => x.key === key);
    if (!src) return apply();
    guardLimit(c, `${key}:${cantrip ? "cantrips" : "prepared"}`, list.length, cantrip ? src.cantrips : src.prepared,
      cantrip ? `${src.title} cantrips` : `prepared ${src.title} spells`, apply);
  },
  // sheet
  "roll": (el) => rollD20(el.dataset.roll, el.dataset.label),
  "reroll": (el) => rollD20(el.dataset.roll, el.dataset.label, el.dataset.mode),
  "roll-dmg": (el) => {
    const r = rollExpr(el.dataset.roll);
    const attrs = (act) => `data-act="${act}" data-roll="${esc(el.dataset.roll)}" data-label="${esc(el.dataset.label)}"`;
    toast(rollCard({ label: el.dataset.label, total: r.total, detail: `${esc(el.dataset.roll)} → ${esc(r.text)}`,
      actions: [{ label: "Critical hit (double dice)", attrs: attrs("roll-crit"), primary: true }, { label: "Roll again", attrs: attrs("roll-dmg") }] }), 9000);
  },
  "roll-crit": (el) => {
    const expr = el.dataset.roll.replace(/(\d*)d(\d+)/g, (_, n, s) => `${2 * (+n || 1)}d${s}`);
    const r = rollExpr(expr);
    toast(rollCard({ label: el.dataset.label, total: r.total, tone: "crit", detail: `${esc(expr)} → ${esc(r.text)}`, note: "Critical hit: dice doubled" }), 9000);
  },
  "toast-close": () => { clearTimeout(toastTimer); document.querySelector(".toast")?.remove(); },
  "hp": (el) => { S.keepScroll = true; changeHP(el.dataset.id); },
  "death": (el) => { S.keepScroll = true; update((c) => { const [k, i] = idParts(el); c.deathSaves[k] = c.deathSaves[k] > +i ? +i : +i + 1; }); },
  "inspiration": () => { S.keepScroll = true; update((c) => { c.inspiration = !c.inspiration; }); },
  "exhaustion": (el) => { S.keepScroll = true; update((c) => { c.exhaustion = Math.min(6, Math.max(0, c.exhaustion + +el.dataset.id)); }); },
  "cond-open": () => { S.condOpen = !S.condOpen; S.keepScroll = true; render(); },
  "temp": (el) => { S.keepScroll = true; update((c) => { c.hp.temp = Math.max(0, c.hp.temp + +el.dataset.id); }); },
  "exhaust-dot": (el) => { S.keepScroll = true; update((c) => { const i = +el.dataset.id; c.exhaustion = c.exhaustion > i ? i : i + 1; }); },
  "state": (el) => {
    if (el.dataset.id === "wildshape") return showWildShapePicker();
    S.keepScroll = true; update((c) => { c.states = c.states || {}; c.states[el.dataset.id] = !c.states[el.dataset.id]; });
  },
  "ac-info": () => { const c = C(); const ac = armorClass(c, DB); toast(rollCard({ label: "Armor Class", total: ac.value, detail: esc(ac.note) + (c.acBonus ? ` ${signed(c.acBonus)} bonus` : "") }), 4000); },
  "portrait": () => { const c = C(); GAL.race = ART_RACES[c.species] ? "match" : "all"; GAL.gender = "all"; GAL.cls = "all"; showGallery(); },
  "portrait-upload": () => { closeModal(); document.getElementById("portrait-input").click(); },
  "portrait-clear": () => { closeModal(); S.keepScroll = true; update((c) => { delete c.portrait; delete c.portraitId; }); },
  "gal-pick": (el) => { closeModal(); S.keepScroll = true; update((c) => { delete c.portrait; c.portraitId = el.dataset.id; }); toast("Portrait set.", 1500); },
  "gal-f": (el) => { const [k, v] = idParts(el); GAL[k] = v; showGallery(); },
  "slot-pick": (el) => showSlotPicker(el.dataset.id),
  "equip-to": (el) => { const [slot, u] = idParts(el); S.keepScroll = true; update((c) => equipToSlot(c, slot, u)); closeModal(); },
  "item": (el) => showItem(el.dataset.id),
  "item-equip": (el) => { S.keepScroll = true; update((c) => { const it = c.inventory.find((i) => i.uid === el.dataset.id); if (!it.equipped && (it.kind === "armor" || it.kind === "shield")) c.inventory.forEach((o) => { if (o.kind === it.kind) o.equipped = false; }); it.equipped = !it.equipped; }); closeModal(); },
  "item-qty": (el) => { const [u, d] = idParts(el); S.keepScroll = true; update((c) => { const it = c.inventory.find((i) => i.uid === u); it.qty = Math.max(1, it.qty + +d); }); showItem(u); },
  "item-remove": (el) => { S.keepScroll = true; update((c) => { c.inventory = c.inventory.filter((i) => i.uid !== el.dataset.id); }); closeModal(); },
  "condition": (el) => { S.keepScroll = true; update((c) => toggleIn(c.conditions, el.dataset.id)); },
  // Pips: remaining uses sit on the left. Tap a full one to spend from there to the right; tap an empty one to get it back.
  "res": (el) => { S.keepScroll = true; update((c) => { const [k, i, n] = idParts(el); c.resSpent[k] = spendTo(+i, +n, c.resSpent[k] || 0); }); },
  "res-n": (el) => { S.keepScroll = true; update((c) => { const [k, d] = idParts(el); const r = resources(c, DB).find((x) => x.key === k); c.resSpent[k] = Math.min(r.max, Math.max(0, (c.resSpent[k] || 0) + +d)); }); },
  "slot": (el) => { S.keepScroll = true; update((c) => { const [l, i, n] = idParts(el).map(Number); c.slotsSpent[l] = spendTo(i, n, c.slotsSpent[l] || 0); }); },
  "pact": (el) => { S.keepScroll = true; update((c) => { const [i, n] = idParts(el).map(Number); c.pactSpent = spendTo(i, n, c.pactSpent || 0); }); },
  "equip": (el) => { S.keepScroll = true; update((c) => {
    const it = c.inventory.find((i) => i.uid === el.dataset.id);
    if (!it.equipped && (it.kind === "armor" || it.kind === "shield")) c.inventory.forEach((o) => { if (o.kind === it.kind) o.equipped = false; });
    it.equipped = !it.equipped;
  }); },
  "qty": (el) => { S.keepScroll = true; update((c) => { const [u, d] = idParts(el); const it = c.inventory.find((i) => i.uid === u); it.qty += +d; if (it.qty <= 0) c.inventory = c.inventory.filter((i) => i.uid !== u); }); },
  "armory": () => { ARM.q = ""; showArmory(); },
  "armory-cat": (el) => { ARM.cat = el.dataset.id; showArmory(); },
  "armory-add": (el) => { const name = el.dataset.id; S.keepScroll = true; update((c) => addToPack(c, name)); toast(`Added ${esc(name)}`, 1400); showArmory(); },
  "armory-custom": () => { CI = blankCustom(ARM.q.trim()); ARM.q = ""; showCustomItem(); },
  "armory-rarity": (el) => { ARM.rarity = el.dataset.id; showArmory(); },
  "armory-magic": (el) => {
    const m = MAGIC_BY_ID[el.dataset.id];
    if (!m) return;
    if (m.baseKind && (m.bases?.length !== 1)) { CI = customFromMagic(m); showCustomItem(); toast(`Pick which ${m.baseKind} your ${esc(m.name)} is, then tap Add.`, 3500); return; }
    CI = customFromMagic(m); S.keepScroll = true; update((c) => saveCustomItem(c)); toast(`Added ${esc(m.name)}`, 1400); showArmory();
  },
  "ci-new": () => { CI = blankCustom(); showCustomItem(); },
  "ci-edit": (el) => { const i = C().inventory.find((x) => x.uid === el.dataset.id); if (!i) return; CI = customFromItem(i); showCustomItem(); },
  "ci-type": (el) => { readCustomForm(); CI.kind = el.dataset.id; CI.base = ""; showCustomItem(); },
  "ci-img": () => { readCustomForm(); document.getElementById("item-img-input").click(); },
  "ci-img-clear": () => { readCustomForm(); CI.img = null; showCustomItem(); },
  "ci-save": () => {
    readCustomForm();
    if (!CI.name) { toast("Give the item a name first.", 2500); document.getElementById("ci-name")?.focus(); return; }
    const name = CI.name;
    S.keepScroll = true; update((c) => saveCustomItem(c)); closeModal(); toast(`Saved ${esc(name)}`, 1600);
  },
  "item-attune": (el) => {
    const c = C(), i = c.inventory.find((x) => x.uid === el.dataset.id);
    const apply = () => { S.keepScroll = true; update((c) => { const it = c.inventory.find((x) => x.uid === el.dataset.id); it.attuned = !it.attuned; }); showItem(el.dataset.id); };
    if (i.attuned) return apply();
    guardLimit(c, "attunement", c.inventory.filter((x) => x.attuned).length, 3, "attuned magic items", apply);
  },
  "clear-filter": (el) => { if (el.dataset.id === "armory-q") { ARM.q = ""; showArmory(true); return; } S.filter = ""; S.keepScroll = true; render(); document.getElementById("filter")?.focus(); },
  "f-bgab": (el) => { F.bgAb = el.dataset.id || null; S.keepScroll = true; render(); },
  "f-sp": (el) => { F.sp[el.dataset.id] = !F.sp[el.dataset.id]; S.keepScroll = true; render(); },
  "f-chosen": () => { F.onlyChosen = !F.onlyChosen; S.keepScroll = true; render(); },
  "f-feat": (el) => { if (el.dataset.id === "__avail") F.hideUnavail = !F.hideUnavail; else F.featGroup = el.dataset.id; S.keepScroll = true; render(); },
  "f-lvl": (el) => { F.lvl = el.dataset.id; S.keepScroll = true; render(); },
  "f-school": (el) => { F.school = el.dataset.id; S.keepScroll = true; render(); },
  "f-spflag": (el) => { F[el.dataset.id] = !F[el.dataset.id]; S.keepScroll = true; render(); },
  "add-item": () => { const v = document.getElementById("add-item")?.value.trim(); if (!v) return; S.keepScroll = true; update((c) => c.inventory.push({ uid: uid(), ...parseItem(v), equipped: false })); },
  "short-rest": showShortRest,
  "spend-hd": (el) => { const die = +el.dataset.id; const c = C(); const r = rollDie(die) + abilityMods(c, DB).con; update((c) => { c.hitDiceSpent[die] = (c.hitDiceSpent[die] || 0) + 1; c.hp.current = Math.min(maxHP(c, DB), (c.hp.current ?? maxHP(c, DB)) + Math.max(r, 1)); }); toast(`Hit Die d${die}: healed ${Math.max(r, 1)}`, 2500); showShortRest(); },
  "finish-short": () => { update((c) => { c.pactSpent = 0; for (const r of resources(c, DB)) if (r.recharge === "short") c.resSpent[r.key] = 0; }); closeModal(); toast("Short rest done. Pact slots and short-rest resources refilled.", 3000); },
  "long-rest": () => { update((c) => { if (c.wildShape) endWildShape(c); c.hp.current = maxHP(c, DB); c.hp.temp = 0; c.hitDiceSpent = {}; c.slotsSpent = [0, 0, 0, 0, 0, 0, 0, 0, 0]; c.pactSpent = 0; c.resSpent = {}; c.deathSaves = { s: 0, f: 0 }; c.exhaustion = Math.max(0, c.exhaustion - 1); }); toast("Long rest done. HP, Hit Dice, spell slots and resources restored.", 3000); },
  "menu": showMenu,
  "close-modal": closeModal,
  "level-up": showLevelUp,
  "level-class": (el) => {
    const id = el.dataset.id;
    update((c) => {
      const before = maxHP(c, DB);
      const k = c.classes.find((x) => x.id === id);
      if (k) k.level += 1; else c.classes.push({ id, level: 1, subclass: null });
      if (c.hp.current !== null) c.hp.current += maxHP(c, DB) - before;
    });
    closeModal();
    const t = pendingChoices(C(), DB);
    toast(`Level ${totalLevel(C())}! ${t.length ? "New choices are waiting at the top of the sheet." : "Check the Features tab for what's new."}`, 4000);
  },
  "adjust": showAdjust,
  "save-adjust": () => { const n = (id) => parseInt(document.getElementById(id).value, 10) || 0; update((c) => { c.hp.maxOverride = n("adj-hpmax") || null; c.hpBonus = n("adj-hp"); c.acBonus = n("adj-ac"); c.speedBonus = n("adj-speed"); c.initBonus = n("adj-init"); }); closeModal(); },
  "download-file": downloadFile,
  "artifact-save": () => artifactSave(),
  "share-file": shareFile,
  "export": () => showExport(false),
  "export-all": () => showExport(true),
  "copy-export": () => {
    const ta = document.getElementById("export-text");
    navigator.clipboard?.writeText(ta.value).then(() => toast("Copied. Paste it somewhere safe.", 2500)).catch(() => { ta.select(); toast("Select-all is on. Use your phone's Copy.", 3000); })
      ?? (ta.select(), toast("Select-all is on. Use your phone's Copy.", 3000));
  },
  "import": showImport,
  "do-import": async () => {
    let text = document.getElementById("import-text").value.trim();
    const file = document.getElementById("import-file").files?.[0];
    if (!text && file) text = await file.text();
    try {
      const data = JSON.parse(text);
      const list = data.characters || (Array.isArray(data) ? data : [data]);
      let n = 0;
      for (const ch of list) {
        if (!ch?.classes) continue;
        const fresh = Object.assign(newCharacter(), ch, { id: uid(), example: false });
        S.chars.unshift(fresh); n++;
      }
      persist(); closeModal(); render();
      toast(n ? `Imported ${n} character${n > 1 ? "s" : ""}.` : "No characters found in that text.", 3000);
    } catch { toast("That doesn't look like a character backup. Copy the whole text and try again.", 4000); }
  },
  "duplicate": () => { const c = JSON.parse(JSON.stringify(C())); c.id = uid(); c.name += " (copy)"; c.example = false; S.chars.unshift(c); S.charId = c.id; persist(); closeModal(); render(); },
  "delete-ask": () => modal(`<h2>Delete ${esc(C().name || "this character")}?</h2><p class="muted">This can't be undone. Make a backup first if you might want them back.</p>
      <button class="btn danger" data-act="delete-yes">Delete</button><button class="btn" data-act="close-modal">Keep</button>`),
  "delete-yes": () => { S.chars = S.chars.filter((c) => c.id !== S.charId); S.view = "list"; persist(); closeModal(); render(); },
  "settings": showSettings,
  "toggle-book": (el) => { S.books[el.dataset.id] = S.books[el.dataset.id] === false; persist(); showSettings(); },
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || !el.dataset.act) return;
  const act = el.dataset.act;
  if (act === "close-modal" && el.classList.contains("scrim") && e.target !== el) return; // tap inside the sheet, not the backdrop
  if (act === "toggle-open") e.stopPropagation();
  e.preventDefault();
  const fn = ACTIONS[act];
  if (fn) fn(el);
});
// Selects and number inputs that change rules (class, level, scores)
document.addEventListener("change", (e) => {
  const el = e.target;
  const act = el.dataset.actChange;
  if (act) {
    update((c) => {
      const i = el.dataset.i;
      if (act === "set-class") { c.classes[+i] = { id: el.value, level: c.classes[+i].level, subclass: null }; }
      if (act === "set-level") { c.classes[+i].level = +el.value; }
      if (act === "set-base") {
        const v = Math.max(3, Math.min(20, parseInt(el.value, 10) || 8));
        if (c.scoreMethod === "standard") { const other = ABILITIES.find((b) => b !== i && c.base[b] === v); if (other) c.base[other] = c.base[i]; }
        c.base[i] = v;
      }
      if (act === "assign-roll") assignRoll(c, i, el.value === "" ? null : +el.value);
    });
  }
  if ("xp" in el.dataset) { const c = C(); c.xp = Math.max(0, parseInt(el.value, 10) || 0); persist(); }
  if (el.id === "portrait-input" && el.files?.[0]) loadPortrait(el.files[0]).then(() => { el.value = ""; });
  if (el.id === "ci-base" && CI) { readCustomForm(); if (el.value) applyBase(CI, el.value); else CI.base = ""; showCustomItem(); }
  if (el.id === "item-img-input" && el.files?.[0] && CI) shrinkImage(el.files[0], 256).then((src) => { el.value = ""; if (src) { CI.img = src; showCustomItem(); } });
  if (el.dataset.coin) { const c = C(); c.coins[el.dataset.coin] = Math.max(0, parseInt(el.value, 10) || 0); persist(); }
});
// Text fields: save as you type without redrawing (so the keyboard stays open)
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.bind) { const c = C(); c[el.dataset.bind] = el.value; persist(); }
  if ("armory" in el.dataset) { ARM.q = el.value; showArmory(true); return; }
  if ("bindFilter" in el.dataset) {
    S.filter = el.value;
    const pos = el.selectionStart;
    S.keepScroll = true; render();
    const again = document.getElementById("filter");
    if (again) { again.focus(); again.setSelectionRange(pos, pos); }
  }
});

// Shrink a photo to 512px so it fits comfortably in phone storage.
// Shrink any photo to fit inside size×size and return a JPEG data URL (null if it can't be read).
function shrinkImage(file, size) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, size / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      resolve(cv.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { toast("That image couldn't be opened. Try a JPG or PNG.", 3000); resolve(null); };
    img.src = URL.createObjectURL(file);
  });
}
function loadPortrait(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 512, scale = Math.min(1, size / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      S.keepScroll = true;
      update((c) => { c.portrait = cv.toDataURL("image/jpeg", 0.82); });
      resolve();
    };
    img.onerror = () => { toast("That image couldn't be opened. Try a JPG or PNG.", 3000); resolve(); };
    img.src = URL.createObjectURL(file);
  });
}
