await (async () => {
  const KEY = "hf_redo_gear";
  const jobs = [{"id": "breastplate", "prompt": "fantasy painterly anime, fantasy armor, centered empty breastplate on its own, front facing, no character, item only, solid black background"}, {"id": "chain-mail", "prompt": "fantasy painterly anime, fantasy armor, centered empty chain mail on its own, front facing, no character, item only, solid black background"}, {"id": "chain-shirt", "prompt": "fantasy painterly anime, fantasy armor, centered empty chain shirt on its own, front facing, no character, item only, solid black background"}, {"id": "clothes-fine", "prompt": "fantasy painterly anime, fantasy clothing, centered empty fine clothes on its own, front facing, no character, item only, solid black background"}, {"id": "clothes-travelers", "prompt": "fantasy painterly anime, fantasy clothing, centered empty travelers clothes on its own, front facing, no character, item only, solid black background"}, {"id": "costume", "prompt": "fantasy painterly anime, fantasy clothing, centered empty costume on its own, front facing, no character, item only, solid black background"}, {"id": "diplomats-pack", "prompt": "fantasy painterly anime, fantasy equipment pack, centered diplomats pack contents laid out, no character, item only, solid black background"}, {"id": "entertainers-pack", "prompt": "fantasy painterly anime, fantasy equipment pack, centered entertainers pack contents laid out, no character, item only, solid black background"}, {"id": "half-plate-armor", "prompt": "fantasy painterly anime, fantasy armor, centered empty half plate armor on its own, front facing, no character, item only, solid black background"}, {"id": "hide-armor", "prompt": "fantasy painterly anime, fantasy armor, centered empty hide armor on its own, front facing, no character, item only, solid black background"}, {"id": "leather-armor", "prompt": "fantasy painterly anime, fantasy armor, centered empty leather armor on its own, front facing, no character, item only, solid black background"}, {"id": "padded-armor", "prompt": "fantasy painterly anime, fantasy armor, centered empty padded armor on its own, front facing, no character, item only, solid black background"}, {"id": "plate-armor", "prompt": "fantasy painterly anime, fantasy armor, centered empty plate armor on its own, front facing, no character, item only, solid black background"}, {"id": "priests-pack", "prompt": "fantasy painterly anime, fantasy equipment pack, centered priests pack contents laid out, no character, item only, solid black background"}, {"id": "ring-mail", "prompt": "fantasy painterly anime, fantasy armor, centered empty ring mail on its own, front facing, no character, item only, solid black background"}, {"id": "robe", "prompt": "fantasy painterly anime, fantasy clothing, centered empty robe on its own, front facing, no character, item only, solid black background"}, {"id": "scale-mail", "prompt": "fantasy painterly anime, fantasy armor, centered empty scale mail on its own, front facing, no character, item only, solid black background"}, {"id": "splint-armor", "prompt": "fantasy painterly anime, fantasy armor, centered empty splint armor on its own, front facing, no character, item only, solid black background"}, {"id": "studded-leather-armor", "prompt": "fantasy painterly anime, fantasy armor, centered empty studded leather armor on its own, front facing, no character, item only, solid black background"}];
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
