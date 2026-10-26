await (async () => {
  const KEY = "hf_mon_redo";
  const jobs = [{"id": "air-elemental", "prompt": "fantasy painterly anime, three quarters portrait, centered air elemental, front facing, no humanoid face, no person, creature only, a large swirling whirlwind of translucent air and crackling wisps, thematic background"}, {"id": "animated-flying-sword", "prompt": "fantasy painterly anime, three quarters portrait, centered animated flying sword, front facing, no humanoid face, no person, creature only, a small enchanted longsword hovering in the air with a faint magical glow, thematic background"}, {"id": "scorpion", "prompt": "fantasy painterly anime, three quarters portrait, centered scorpion, front facing, no humanoid face, no person, creature only, a tiny scorpion with a tan armored shell and small pincers, thematic background"}, {"id": "swarm-of-bats", "prompt": "fantasy painterly anime, three quarters portrait, centered swarm of bats, front facing, no humanoid face, no person, creature only, a large swarm of dark bats with flapping wings and glinting eyes, thematic background"}, {"id": "swarm-of-crawling-claws", "prompt": "fantasy painterly anime, three quarters portrait, centered swarm of crawling claws, front facing, no humanoid face, no person, creature only, a swarm of severed skeletal hands crawling over each other, thematic background"}, {"id": "swarm-of-insects", "prompt": "fantasy painterly anime, three quarters portrait, centered swarm of insects, front facing, no humanoid face, no person, creature only, a swarm of buzzing black insects with glinting wings, thematic background"}, {"id": "swarm-of-piranhas", "prompt": "fantasy painterly anime, three quarters portrait, centered swarm of piranhas, front facing, no humanoid face, no person, creature only, a swarm of silver piranhas with snapping teeth in churning water, thematic background"}, {"id": "swarm-of-rats", "prompt": "fantasy painterly anime, three quarters portrait, centered swarm of rats, front facing, no humanoid face, no person, creature only, a swarm of gray rats with gleaming eyes and bared teeth, thematic background"}, {"id": "swarm-of-ravens", "prompt": "fantasy painterly anime, three quarters portrait, centered swarm of ravens, front facing, no humanoid face, no person, creature only, a swarm of black ravens with flapping wings, thematic background"}, {"id": "swarm-of-venomous-snakes", "prompt": "fantasy painterly anime, three quarters portrait, centered swarm of venomous snakes, front facing, no humanoid face, no person, creature only, a writhing swarm of tangled snakes with striped scales and bared fangs, thematic background"}, {"id": "troll-limb", "prompt": "fantasy painterly anime, three quarters portrait, centered troll limb, front facing, no humanoid face, no person, creature only, a small severed green troll hand with warty skin and long claws, thematic background"}, {"id": "venomous-snake", "prompt": "fantasy painterly anime, three quarters portrait, centered venomous snake, front facing, no humanoid face, no person, creature only, a tiny snake with green and tan scales and a forked tongue, thematic background"}, {"id": "violet-fungus", "prompt": "fantasy painterly anime, three quarters portrait, centered violet fungus, front facing, no humanoid face, no person, creature only, a purple fungus with tentacle-like violet tendrils and a mottled cap, thematic background"}, {"id": "water-elemental", "prompt": "fantasy painterly anime, three quarters portrait, centered water elemental, front facing, no humanoid face, no person, creature only, a towering swirling column of blue water with crashing foam and spray, thematic background"}, {"id": "will-o-wisp", "prompt": "fantasy painterly anime, three quarters portrait, centered will-o-wisp, front facing, no humanoid face, no person, creature only, a tiny floating orb of pale spectral light with a flickering ghostly glow, thematic background"}, {"id": "ochre-jelly", "prompt": "fantasy painterly anime, three quarters portrait, centered ochre jelly, front facing, no humanoid face, no person, creature only, a large oozing mass of yellow-orange jelly with a shiny surface, thematic background"}, {"id": "raven", "prompt": "fantasy painterly anime, three quarters portrait, centered raven, front facing, no humanoid face, no person, creature only, a tiny raven with glossy black feathers and a sharp beak, thematic background"}, {"id": "riding-horse", "prompt": "fantasy painterly anime, three quarters portrait, centered riding horse, front facing, no humanoid face, no person, creature only, a large chestnut horse with a flowing dark mane and a saddle, thematic background"}, {"id": "invisible-stalker", "prompt": "fantasy painterly anime, three quarters portrait, centered invisible stalker, front facing, no humanoid face, no person, creature only, a swirling vortex of faint translucent air with two pale glowing eyes, thematic background"}, {"id": "giant-centipede", "prompt": "fantasy painterly anime, three quarters portrait, centered giant centipede, front facing, no humanoid face, no person, creature only, a small centipede with a segmented orange-brown body and large venomous pincers, thematic background"}, {"id": "succubus", "prompt": "fantasy painterly anime, three quarters portrait, centered succubus, front facing, female, an alluring fiend with curling horns and folded bat wings in a modest high-collared dark gown, thematic background"}, {"id": "fire-elemental", "prompt": "fantasy painterly anime, three quarters portrait, centered fire elemental, front facing, no humanoid face, no person, creature only, a large living blaze shaped like a whirling pillar of orange flames with glowing ember eyes, thematic background"}, {"id": "gelatinous-cube", "prompt": "fantasy painterly anime, three quarters portrait, centered gelatinous cube, front facing, no humanoid face, no person, creature only, a large transparent green cube of jelly with bones and debris suspended inside, thematic background"}, {"id": "gray-ooze", "prompt": "fantasy painterly anime, three quarters portrait, centered gray ooze, front facing, no humanoid face, no person, creature only, a medium puddle of dull gray slime rising into a glistening mound, thematic background"}, {"id": "harpy", "prompt": "fantasy painterly anime, three quarters portrait, centered harpy, front facing, female, a winged creature with the top half of a human in a modest feathered tunic and the bottom half of a bird, thematic background"}, {"id": "lamia", "prompt": "fantasy painterly anime, three quarters portrait, centered lamia, front facing, female, a regal desert fiend with a lion-like lower body and golden jewelry in a modest flowing desert robe, thematic background"}];
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
