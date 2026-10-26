# 5e Character Builder [2024]

A D&D 2024 character creator and sheet for phones. One HTML file, no server, no accounts.

**Play it:** https://chuck-fables.github.io/5e-character-builder/ (open on a phone, then Share → Add to Home Screen)

**The file to share:** `dist/5e Character Builder [2024].html` (the same app as one HTML file; `docs/index.html` is the hosted copy)

## What's in it
- Step-by-step creator: class (with multiclassing and starting level 1–20), background, species and lineage,
  ability scores (standard array, point buy or rolled), skills, Weapon Mastery, feats, starting gear and spells.
- A live sheet styled after the Odrun Fell sheet. Everything is calculated for you: modifiers, saves, skills, AC, HP, initiative,
  spell DC and attack, spell slots (including multiclass and Pact Magic), and class resources.
- Table tracking: HP / temp HP, death saves, exhaustion, conditions, inspiration, spell slots, resources, hit dice,
  short and long rests, tap-to-roll dice (with advantage, disadvantage and crits), and level up.
- **Save to phone:** each character can be saved as a `.json` file and imported again later.
- **Books:** turn off any book your table doesn't use.

Content: SRD 5.2 (full text, CC-BY-4.0) plus the other 2024 books listed on dnd2024.wikidot.com, with names, numbers and
mechanics only, and descriptions summarized in our own words.

## Sharing with friends
- **Android:** send the file. Open it in Chrome.
- **iPhone:** opening an .html file from the Files app shows a preview that doesn't run apps. Put the file online instead
  (free options: drag it onto https://app.netlify.com/drop, or use GitHub Pages). Friends open the link in Safari, then
  tap **Share → Add to Home Screen**.
- Characters live in the browser that opened the file. Use **More → Save to phone** to keep a backup. Use it before
  switching to a new version of the file, too, because a new copy of the file starts with an empty character list.

## Portrait library
400 character portraits made with fal.ai (GPT Image 2.5 Flare, low quality). The 512×512 WebP files are in
`~/Downloads/hero-forge-portraits/`, named like `p001-male-tiefling-ranger.webp`. The app embeds 320px copies;
players pick one from the portrait frame, or upload their own photo.

- `portraits/make_prompts.py` makes the 400 prompts (65% male, 35% female, classic races, every class).
- `portraits/runner.js` is the in-browser script that generated them on the fal.ai playground.
- After changing the images, repack them, then rebuild:

```bash
python3 portraits/make_gallery.py
```

## Changing it
- Rules math: `src/engine.js`. Screens: `src/app.js`. Look: `src/template.html`.
- Game data: `data/srd/*.json` (from the SRD project) and `data/wiki/*.json` (from the wiki). Format: `data/SCHEMA.md`.
- Rebuild after any change:

```bash
python3 build.py
```

The build merges the data (SRD wins when both have the same thing), checks the links between files, and prints any problems.
