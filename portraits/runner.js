// Hero Forge portrait runner — paste into the fal.ai playground tab for
// openai/gpt-image-2.5/flare/text-to-image, after replacing __KEY__ and __JOBS__.
// It fills the JSON editor, presses Run, waits for the finished image, records its URL,
// and moves on. Results live in window.__hf.results and localStorage[__KEY__] (resumable).
(async () => {
  const KEY = "__KEY__";
  const jobs = __JOBS__;
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
          // fal's "You're about to run the example" notice: never press "Run anyway" (it runs fal's example
          // prompt). Stop instead; a person makes one real keystroke in the editor and re-runs this script.
          if (document.querySelector('[role="alertdialog"]')) return "ERR example notice";
          const s = status();
          if (/failed|error/i.test(s)) return "ERR " + s;
          const u = latestImg();
          return u && u !== before && /completed/i.test(s) ? u : null;
        }, 240000);
        hf.results[job.id] = res || "ERR timed out";
        save();
        hf.log.push(`${job.id} try${attempt} ${hf.results[job.id].slice(0, 70)}`);
        if (res && !res.startsWith("ERR")) break;
        if (res === "ERR example notice") { hf.stopped = true; hf.running = false; return; }
        await sleep(3000);
      }
    }
    hf.running = false;
    hf.finished = true;
  })();
  return `started ${jobs.length} jobs (${Object.values(hf.results).filter((v) => !v.startsWith("ERR")).length} already done)`;
})()
