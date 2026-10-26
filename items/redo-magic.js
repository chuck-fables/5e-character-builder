await (async () => {
  const KEY = "hf_redo_magic";
  const jobs = [{"id": "adamantine-armor", "prompt": "fantasy painterly anime, fantasy magic armor, centered empty adamantine armor on its own, front facing, no character, item only, solid black background"}, {"id": "adventurers-ring", "prompt": "fantasy painterly anime, fantasy magic ring, centered adventurers ring on its own, no character, item only, solid black background"}, {"id": "armor-of-vulnerability", "prompt": "fantasy painterly anime, fantasy magic armor, centered empty armor of vulnerability on its own, front facing, no character, item only, solid black background"}, {"id": "belt-of-dwarvenkind", "prompt": "fantasy painterly anime, fantasy magic clothing, centered belt of dwarvenkind on its own, front facing, no character, item only, solid black background"}, {"id": "belt-of-giant-strength", "prompt": "fantasy painterly anime, fantasy magic clothing, centered belt of giant strength on its own, front facing, no character, item only, solid black background"}, {"id": "boon-companions-bands", "prompt": "fantasy painterly anime, fantasy magic ring, centered boon companions bands on its own, no character, item only, solid black background"}, {"id": "cap-of-vanishing", "prompt": "fantasy painterly anime, fantasy magic clothing, centered cap of vanishing on its own, front facing, no character, item only, solid black background"}, {"id": "cap-of-water-breathing", "prompt": "fantasy painterly anime, fantasy magic clothing, centered cap of water breathing on its own, front facing, no character, item only, solid black background"}, {"id": "circlet-of-blasting", "prompt": "fantasy painterly anime, fantasy magic clothing, centered circlet of blasting on its own, front facing, no character, item only, solid black background"}, {"id": "dust-of-disappearance", "prompt": "fantasy painterly anime, fantasy wondrous item, centered dust of disappearance, no character, item only, solid black background"}, {"id": "dwarven-plate", "prompt": "fantasy painterly anime, fantasy magic armor, centered empty dwarven plate on its own, front facing, no character, item only, solid black background"}, {"id": "efreeti-chain", "prompt": "fantasy painterly anime, fantasy magic armor, centered empty efreeti chain armor on its own, front facing, no character, item only, solid black background"}, {"id": "elven-chain", "prompt": "fantasy painterly anime, fantasy magic armor, centered empty elven chain armor on its own, front facing, no character, item only, solid black background"}, {"id": "energy-bow", "prompt": "fantasy painterly anime, fantasy magic weapon, centered energy bow, side profile, no character, item only, solid black background"}, {"id": "enspelled-armor", "prompt": "fantasy painterly anime, fantasy magic armor, centered empty enspelled armor on its own, front facing, no character, item only, solid black background"}, {"id": "eyes-of-charming", "prompt": "fantasy painterly anime, fantasy magic clothing, centered eyes of charming crystal lenses on their own, front facing, no character, item only, solid black background"}, {"id": "eyes-of-deceit", "prompt": "fantasy painterly anime, fantasy magic clothing, centered eyes of deceit crystal lenses on their own, front facing, no character, item only, solid black background"}, {"id": "eyes-of-minute-seeing", "prompt": "fantasy painterly anime, fantasy magic clothing, centered eyes of minute seeing crystal lenses on their own, front facing, no character, item only, solid black background"}, {"id": "eyes-of-the-eagle", "prompt": "fantasy painterly anime, fantasy magic clothing, centered eyes of the eagle crystal lenses on their own, front facing, no character, item only, solid black background"}, {"id": "glamoured-studded-leather", "prompt": "fantasy painterly anime, fantasy magic armor, centered empty glamoured studded leather armor on its own, front facing, no character, item only, solid black background"}, {"id": "goggles-of-night", "prompt": "fantasy painterly anime, fantasy magic clothing, centered goggles of night on its own, front facing, no character, item only, solid black background"}, {"id": "hat-of-disguise", "prompt": "fantasy painterly anime, fantasy magic clothing, centered hat of disguise on its own, front facing, no character, item only, solid black background"}, {"id": "hat-of-many-spells", "prompt": "fantasy painterly anime, fantasy magic clothing, centered hat of many spells on its own, front facing, no character, item only, solid black background"}, {"id": "hat-of-vermin", "prompt": "fantasy painterly anime, fantasy magic clothing, centered hat of vermin on its own, front facing, no character, item only, solid black background"}, {"id": "hat-of-vortexes", "prompt": "fantasy painterly anime, fantasy magic clothing, centered hat of vortexes on its own, front facing, no character, item only, solid black background"}, {"id": "hat-of-wizardry", "prompt": "fantasy painterly anime, fantasy magic clothing, centered hat of wizardry on its own, front facing, no character, item only, solid black background"}, {"id": "headband-of-intellect", "prompt": "fantasy painterly anime, fantasy magic clothing, centered headband of intellect on its own, front facing, no character, item only, solid black background"}, {"id": "helm-of-awareness", "prompt": "fantasy painterly anime, fantasy magic clothing, centered helm of awareness on its own, front facing, no character, item only, solid black background"}, {"id": "helm-of-brilliance", "prompt": "fantasy painterly anime, fantasy magic clothing, centered helm of brilliance on its own, front facing, no character, item only, solid black background"}, {"id": "helm-of-telepathy", "prompt": "fantasy painterly anime, fantasy magic clothing, centered helm of telepathy on its own, front facing, no character, item only, solid black background"}, {"id": "helm-of-teleportation", "prompt": "fantasy painterly anime, fantasy magic clothing, centered helm of teleportation on its own, front facing, no character, item only, solid black background"}, {"id": "mythallar-cloak", "prompt": "fantasy painterly anime, fantasy magic clothing, centered empty mythallar cloak on its own, front facing, no character, item only, solid black background"}, {"id": "natures-mantle", "prompt": "fantasy painterly anime, fantasy magic clothing, centered empty natures mantle on its own, front facing, no character, item only, solid black background"}, {"id": "repulsion-shield", "prompt": "fantasy painterly anime, fantasy magic shield, centered repulsion shield, front facing, no character, item only, solid black background"}, {"id": "scholars-anchoring-bangle", "prompt": "fantasy painterly anime, fantasy wondrous item, centered scholars anchoring bangle on its own, no character, item only, solid black background"}, {"id": "secret-keepers-circlet", "prompt": "fantasy painterly anime, fantasy magic clothing, centered secret keepers circlet on its own, front facing, no character, item only, solid black background"}, {"id": "spell-fuelling-armor", "prompt": "fantasy painterly anime, fantasy magic armor, centered empty spell-fuelling armor on its own, front facing, no character, item only, solid black background"}, {"id": "stormwalkers-cloak", "prompt": "fantasy painterly anime, fantasy magic clothing, centered empty stormwalkers cloak on its own, front facing, no character, item only, solid black background"}, {"id": "tramontane-armor", "prompt": "fantasy painterly anime, fantasy magic armor, centered empty tramontane armor on its own, front facing, no character, item only, solid black background"}];
  const hf = (window.__hf = window.__hf || { results: JSON.parse(localStorage.getItem(KEY) || "{}"), log: [] });
  if (hf.running) return "already running: " + Object.keys(hf.results).length + " done";
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(hf.results)); } catch (e) {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pointerClick = (el) => {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"])
      el.dispatchEvent(new (type.startsWith("pointer") ? PointerEvent : MouseEvent)(type, { bubbles: true, cancelable: true, button: 0, pointerType: "mouse" }));
  };
  // Resolve when cond() returns something truthy (checks on every DOM change and every second).
  const waitFor = (cond, ms) => new Promise((res) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; obs.disconnect(); clearInterval(iv); clearTimeout(to); res(v); };
    const check = () => { try { const v = cond(); if (v) finish(v); } catch (e) {} };
    const obs = new MutationObserver(check);
    obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    const iv = setInterval(check, 1000);
    const to = setTimeout(() => finish(null), ms);
    check();
  });
  const editor = () => window.monaco?.editor?.getModels?.()[0];
  const latestImg = () => [...document.querySelectorAll("img")].map((i) => i.src).filter((s) => /^https:\/\/v\d+\w*\.fal\.media\/files\//.test(s)).pop() || null;
  const status = () => {
    const el = [...document.querySelectorAll("span,div,p")].find((e) => e.children.length === 0 && /^(Completed|In progress|In queue|Queued|Idle|Failed|Error)$/i.test(e.textContent.trim()));
    return el ? el.textContent.trim() : "";
  };
  const runBtn = () => [...document.querySelectorAll("button")].find((b) => /^Run/.test(b.textContent.trim()) && !b.disabled);

  // 1. Make sure the JSON editor is showing.
  // The page may still be loading, so try the Form → JSON switch a few times.
  for (let i = 0; i < 4 && !editor(); i++) {
    const modeBtn = await waitFor(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Form"), 10000);
    if (modeBtn) {
      pointerClick(modeBtn);
      const item = await waitFor(() => [...document.querySelectorAll('[role="option"]')].find((e) => e.textContent.trim() === "JSON"), 4000);
      if (item) pointerClick(item);
    }
    await waitFor(editor, 5000);
  }
  if (!editor()) return "ERROR: could not open the JSON editor. Switch Input to JSON by hand, then run this again.";

  hf.running = true;
  hf.total = jobs.length;
  (async () => {
    for (const job of jobs) {
      if (hf.results[job.id] && !hf.results[job.id].startsWith("ERR")) continue;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const before = latestImg();
        editor().setValue(JSON.stringify({ prompt: job.prompt, image_size: { width: 512, height: 512 }, quality: "low",
          output_format: "webp", output_compression: 60, num_images: 1 }, null, 2));
        await sleep(400);
        const btn = await waitFor(runBtn, 60000);
        if (!btn) { hf.results[job.id] = "ERR run button never came back"; break; }
        btn.click();
        const res = await waitFor(() => {
          const s = status();
          if (/failed|error/i.test(s)) return "ERR " + s;
          const u = latestImg();
          return u && u !== before && /completed/i.test(s) ? u : null;
        }, 240000);
        hf.results[job.id] = res || "ERR timed out";
        save();
        hf.log.push(`${job.id} try${attempt} ${hf.results[job.id].slice(0, 70)}`);
        if (res && !res.startsWith("ERR")) break;
        await sleep(3000);
      }
    }
    hf.running = false;
    hf.finished = true;
  })();
  return `started ${jobs.length} jobs (${Object.values(hf.results).filter((v) => !v.startsWith("ERR")).length} already done)`;
})()
