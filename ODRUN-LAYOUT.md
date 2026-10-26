# Odrun Fell character sheet: design spec (for the phone web app)

Source: `.../odrun-fell/.craft/file-types/character.json` -> `layout` (flat `elements` map, 3641 nodes, root `page`).
Screenshots (reference, Bannick Coiljaw L12 Fighter + a L6 wizard):
`/Users/chuck/alpha craft cli/craft-alpha/_upgrade-notes/odrun-fell/sheet-restyle/screens/` -> `1-hero.png`, `2-overview-stats.png`,
`3-class-features.png`, `4-spells-prepared.png`, `5-no-portrait-hero.png` (+ `all-*.png` for other file types).
Component counts: Stack 1716, Text 911, Badge 224, Collapsible 179, Avatar 139, FileReferenceGrid 123, Stepper 71, ConditionToggles 54,
Heading 52, Grid 28, Toggle 17, Progress 10, Dots 7, Tabs 6, ImageHeader 3, Card 1.

## 1. Top-level structure (one long vertical page)
`page` = one Card (bg `#150806`, no padding, `border-red-950/70`, big shadow). Inside, bottom layer is a tiled SVG texture
(dark ember/topographic contour lines in `#a8927b` at ~7-9% opacity, orange `#ff7a1a`/`#e0912e` lightning cracks) behind `content`.
`content` stacks, in order, with 12-16px padding:
1. **Hero** (`hero-wrap`): ImageHeader, square aspect, 80% width, centered, `rounded-xl`, gold ring + glow
   (`ring-primary/30`, `shadow 0 0 26px rgba(233,196,120,.28)`). Title is blank; text is an overlay pinned to the bottom (fades out on hover):
   - status chips row (only when active, each pulsing with a colored glow): Heroic Inspiration (gold `#d4af37`), Bardic Inspiration + die
     (solid purple `rgba(124,58,237,.75)`, white text), Concentrating (sky `#38bdf8`), Raging (red `#dc2626`), Wild Shape (green `#16a34a`),
     Innate Sorcery (violet `#8b5cf6`). Chips sit on `rgba(10,4,3,.6)` pills.
   - kicker: "✦  ODRUN FELL  ✦" `#e0912e`, 10px, letter-spacing .35em, semibold
   - **name**: H1, `#F8F8FC`, font `font-medievalsharp` (the only custom font), centered, drop shadow
   - build line: "Level 12 · Human · Fighter" `#d4af37` caption
   - XP row (80% wide): thin Progress `#b08d2e` on track `rgba(10,4,3,.7)` + pill with "XP 100000 / 120000" `#e7d9a8`
   - Variants: Wild Shape and Polymorph swap the portrait for the beast/creature art, add "❦ Wolf form" (green `#4ade80`) /
     "⟡ X form" (violet `#c4b5fd`) and a round temp-HP badge (w-16, dark `rgba(10,4,3,.75)`, green or violet glow) at top-right.
2. **Vitals card** (`vitals`; rounded-xl, `bg-background/80`, blur, `ring-white/5`, p-3). Details in section 3.
3. **Tab bar** (`tabs`, bg `rgba(20,7,6,.85)`), exact labels in order:
   `◈ Overview`, `⚔︎ Loadout`, `✦ Features`, `✴ Spells`. Each panel is its own rounded-xl card.
   Every tab has a second-level Tabs bar in the same style (see section 2).
4. **Party** Collapsible (closed by default): FileReferenceGrid of party characters and monsters, 5 columns, small portraits, title overlay.

Vitals card contents, top to bottom (thin `border-t border-red-950/70` between groups):
- **HP**: full-width Progress, fill `#b93a4e`, track `#450a0a`, label "Hit Points", right-aligned "112 / 112" with a +/- stepper (editable).
- Row (wraps): Temp HP Stepper (sky `#38bdf8`, min 0) | Exhaustion Dots (6 pips, red `#dc2626`, shows "0 / 6") | chip Toggles:
  ★ Heroic Inspiration (gold), ◎ Concentrating (sky, casters only), ◇ Mage Armor (sky, casters), ♪ Bardic Inspiration (violet) + d6/d8/d10/d12 Select
  when on, ✹ Raging (red, barbarian), ❦ Wild Shape (green, druid), ✦ Innate Sorcery (violet, sorcerer).
- **Conditions**: small caps label "CONDITIONS" `#c9bda4` + BadgeList (destructive style) with add-on-hover; also shows class chips like "† Weapon Masteries 5".
- **Resources** (only if any): "SPELL SLOTS" row of "1st ●●●● 2nd ●●● 3rd ●●●" (level label gold `#d4af37`, purple `#8b5cf6` pips);
  Pact Magic row (`#a855f7` pips); per-class resource rows (icon glyph, bold name, pips or progress bar, italic recharge text, e.g.
  "≋ Second Wind ●●●● Regain 1 on a Short Rest, all on a Long Rest", "↯ Action Surge ●(orange) Short or Long Rest", "⛨ Indomitable ●(blue) Long Rest").
  `kind: "pool"` = Dots, `kind: "bar"` = Progress with +/- stepper. Each row has its own color; rows separated by `border-red-950/40`.
- **Death saves** (only when HP <= 0): Successes 3 pips green `#4ade80`, Failures 3 pips red `#dc2626`, tappable.
- "Ready to level up" success Alert when XP reached.
- **Stat band** (5-col grid, `bg-black/35`, `ring-primary/20`, big shadow): `LVL 12` | `AC 19` | `INIT +2` | `SPEED 30` | `PROF +4`.
  Label tiny uppercase tracking-widest `#c9bda4`, value text-xl `#f5f0e6`. Level sits in a small input box.

## 2. Tabs and sections
Section headings everywhere: H4, `#d4af37`, uppercase, `tracking-widest`, text-sm, with a 2px gold left bar (`border-l-2 border-primary/60 pl-2`);
optional right-aligned legend caption in `#c9bda4` (e.g. "base · score · mod").

**◈ Overview** (sub-tabs: `◈ Stats`, `◉ Persona`, `♥ Relationships`)
- *Stats*: (a) **Ability Scores**: 2-col grid, 3 rows each (STR DEX CON | INT WIS CHA). Not cards: plain rows with hairline divider
  `border-red-950/40`: name (left, `#c9bda4`), base score (dim, 60% opacity, in a small box = editable), score `#f5f0e6`, modifier bold gold `+5`.
  (b) **Saving Throws**: 2-col rows, name + signed total; proficient rows are green (`#4ade80`), others cream. Legend "green = proficient".
  (c) **Skills**: 2-col, grouped under tiny uppercase gold ability headers (Strength/Dexterity/Intelligence | Wisdom/Charisma); row = skill name + total;
  proficient green, expertise orange (`#ea580c`). Collapsible "Set Proficiencies" with two ConditionToggles chip groups (Proficient green, Expertise orange).
  (d) **Senses & Frame** 2x2 label/value pairs: Passive Perception, (more fields), Size, Carrying Capacity.
- *Persona*: Identity card (FieldList: alignment, XP, etc. + Dialogue Voice select), Persona card (Markdown blocks with small headings: Description,
  Appearance, Personality Traits, Ideals, Bonds, Flaws, Backstory, Notes; each hidden when empty).
- *Relationships*: legend badges (green Positive / slate Neutral / red Negative), 4-col grid of NPC portraits, then per-person row:
  name + relation, mood text, a 0-10 Progress bar colored by mood, note.

**⚔︎ Loadout** (sub-tabs: `▤ Inventory`, `⚔︎ Combat`)
- *Inventory*: (a) Attunement Collapsible (closed): 3 round slots "Attuned 1/2/3" for magic items + status line "x/3 attuned".
  (b) **Equipped paper doll** (section 4). (c) **Inventory** gallery + "✎ Add or remove items" Collapsible. (d) **Coin**: 3-col grid PP GP EP | SP CP | Total (GP).
- *Combat*: Polymorph chip toggle (violet card `#140b20` with creature slot, name, sub line). Druid-only Wild Shape card (dark green `#0b1a0f`:
  round form slot, 4 stat tiles AC/STR/DEX/CON, movement badges, senses, attack/trait/ability lists on `rgba(22,163,74,.12)`, Known Forms 4-col grid,
  amber/blue warnings). **Attacks** card: 2 columns Main Hand / Off Hand, each a Select + rows Attack Bonus, Damage Bonus, Damage Dice, Mastery;
  Weapon Mastery Markdown; Misc AC note. **Hit Dice** card: "Hit Dice 12d10" + Dots (gold `#b08d2e`, tappable), d20 penalty (red) when exhausted.

**✦ Features** (sub-tabs: `◇ Origin & Feats`, `✦ Class Features`, `▲ Feat/ASI`)
- *Origin & Feats*: Origin card (2x2 Selects: Class, Subclass, Species, Background; Multiclass Collapsible with 3 inputs); Class Choices
  (BadgeList multi-pick chips: Eldritch Invocations purple, Metamagic violet, Weapon Masteries slate; Selects for dragon ancestry / land terrain);
  Training & Proficiencies FieldList; Feats FileReferenceGrid (5 cols).
- *Class Features*: "Class & Subclass Features"; repeat of "LEVEL N · CLASS" gold sub-headings, each followed by Markdown (bold lead-in names, cream `#f5f0e6`).
- *Feat/ASI*: kicker "ODRUN FELL // FEATS & ABILITY SCORES"; 3-stat bank (Level-Up Choices | Feat Picks Left gold | ASI Points Left green);
  warning alerts; per-level slot rows (gold dot, text, `✓ On sheet` badge or chip Toggle); inner tabs `✦ Feat Selection` (Collapsible categories:
  Origin 24, General 16, Fighting Style 5, Epic Boon 7) and `▲ ASI Upgrades` (6 ability rows: colored dot + name + Stepper + progress bar to 20).

**✴ Spells** (sub-tabs: `✴ Casting`, `✦ Prepared`, `✦ Bonus Spells`, `✦ Second Class`; "Not a spellcaster" info Alert otherwise)
- *Casting*: Spellcasting card, 2x2: Spellcasting Mod, Spell Save DC, Spell Attack, Caster Level; Prepared Max.
- *Prepared*: "Cantrips (Main Class)" then "Prepared Spells (Main Class)". Table rows (12-col grid, hairline divider): round spell-art Avatar |
  name (bold, colored) | level number | school | cast time (colored: green Action, orange longer) | components "V, S, M (...)".
  Each list has a closed Collapsible "Add / Remove ..." (pickers) and "Browse as cards" (FileReferenceGrid, 5 cols, titled "1st-Level Spells" etc.).
- *Bonus*: Subclass Spells, Feat Spells, Bonus Spells (same table + add/remove). *Second Class*: "<Class> Spells" for multiclass.

## 3. Visual language
- Theme: dark ember/forge. Page `#150806` (blackened red-brown), card tint `bg-background/80` + blur + `ring-white/5`, inner hero/stat panels `bg-black/35`.
- Text: primary `#f5f0e6` (cream), labels/secondary `#c9bda4` (parchment), links/headings/accents `#d4af37` (gold), bright `#e5e9f2`, muted `#98a3bf`/`#94a3b8`.
- Status: red `#dc2626` / HP `#b93a4e` on `#450a0a`; green `#4ade80` (proficient, success) / `#16a34a`; orange `#ea580c`; sky `#38bdf8`; violet `#8b5cf6`, `#a855f7`;
  ember orange `#e0912e`; dim gold `#b08d2e`. Dividers `border-red-950/40` (rows) and `/70` (sections). Empty pip `rgba(245,240,230,.15)`.
- Ability colors (Feat/ASI tab): STR `#c2554d`, DEX `#4f9a6a`, CON `#c47a3a`, INT `#4f7fc2`, WIS `#3f9a95`, CHA `#a65a96`.
- Item card top bars / dark popups use `#d4af37` bar on `#0d0f15`; slot rings `#150806`.
- Typography: body is the app font (serif-leaning in screenshots); only the hero name uses MedievalSharp. Section heads and stat-band labels are
  small, uppercase, widely letter-spaced; numbers are tabular-nums; modifiers bold.
- Glyph icons instead of an icon set: ◈ ⚔︎ ✦ ✴ ▤ ◇ ▲ ◉ ♥ ★ ♪ ◎ ✹ ❦ ⟡ † ≋ ↯ ⛨ ↻ ⌬ ⁂ ✎ ⋯. Tab labels start with one.
- Pips (Dots): sm/md sizes, filled = state color, empty = faint cream; used for exhaustion, spell slots, pact slots, resource pools, hit dice, death saves.
  Progress bars: HP (red), XP (dim gold), resources (per-row color), relationship mood, ASI stat (to 20). Chips (Toggle variant "chip"): rounded outline pills
  that light up in their color. Badges: outline pills (`variant outline`) or solid color.
- Animation: active-state chips use `animate-pulse` plus colored box-shadow glow.

## 4. Equipment / paper doll
Heading "Equipped", then a 12-column grid, `aspect-[3/4]` (12 cols x 16 rows), full width, over a full-bleed body illustration (male/female
image chosen by `abilityMods/paperDoll`, cover-fit, behind the grid). Slots are round (`rounded-full`) dark-`#150806` discs with a gold `#d4af37` double ring;
empty = shaded disc, filled = item art in the disc. Under each slot: label (gold for hands, cream for others) and a read-out caption.
Rows (left | 8-col empty gap showing the body | right):
- Row 1 (rows 1-4): **Main Hand** (4x4 cols, "+N to hit" and damage dice under it) | **Shield** | **Off Hand** (same read-outs).
- Then six rows of 2x2 slots at the left/right edges: Head | Face; Armor ("AC 19") | Neck; Belt | Back; Hands | Clothing; Ring | Ring; Feet | Ring.
  (slots: mainHand, shield, offHand, head, face, armor, neck, belt, back, hands, clothing, ring1-3, feet; plus attuned 1-3 in Attunement.)
- Interaction: tap a disc -> an invisible full-cover Select opens a dropdown of eligible inventory items (`equipOptions/<slot>`). Hover/long-press shows a floating
  quick card: gold top bar, art (4:3), name (white), type (`#c3cbe0`), stats line (`#e5b85c`), 2-line effect text on `#0d0f15`.
- Note under it: "Tap a slot to equip something from your Inventory."
- **Inventory** below: horizontal-wrapping grid of item cards: 56px rounded-lg tile with gold `#d4af37` 2px border and art (or dark initial if no art), name
  (xs semibold, 80px wide, 2-line), quantity under it (`#98a3bf`); group header captions in gold between sections (gear, magic). Edit mode: "Use − / + for how many".

## 5. Distinctive things worth copying
- Portrait-first hero with name/kicker/build/XP overlaid at the bottom; status chips glow and pulse right on the portrait.
- Compact vitals card that stays above the tabs, so HP, temp HP, conditions, slots, resources, death saves and AC/Init/Speed are always visible.
- HP bar with built-in +/- stepper; every pip row is tap-to-toggle; resources carry their own icon, color and recharge text.
- Two-level tabs, each as a flat segmented control; sections are hairline-divided rows rather than boxed cards (dense, phone friendly).
- Color semantics: green = proficient, orange = expertise, gold = headings/modifiers, red = damage/exhaustion, purple = magic.
- Paper doll with round gold-ringed slots, tap-to-equip dropdown, live attack/AC read-outs; item cards as gold-bordered thumbnails.
- Spell lists as one-line table rows with round art, color-coded casting time; add/remove and card browsing tucked into closed Collapsibles.
- Alt forms (Wild Shape / Polymorph) restyle the hero and add a themed card (green / violet) instead of a separate sheet.
