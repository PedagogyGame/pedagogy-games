(() => {
  const TERMS = window.GLOSSARY || [];
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CHAPTERS = [
    { id: "field", title: "Field care", blurb: "What happens before the hide ever reaches the shop.", stages: ["field"] },
    { id: "skinning", title: "Caping & skinning", blurb: "Incisions that you will later have to hide.", stages: ["skinning"] },
    { id: "prep", title: "Turning, splitting, fleshing", blurb: "Inside-out work: ears, lips, fat, membrane.", stages: ["prep"] },
    { id: "preserve", title: "Salting & preservation", blurb: "Stabilize the hide so it waits without rotting.", stages: ["preserve"] },
    { id: "tanning", title: "Pickle, tan, shave, relax", blurb: "Chemistry that turns a skin into leather you can mount.", stages: ["tanning"] },
    { id: "form", title: "Measurements & the form", blurb: "Numbers, then the manikin those numbers buy.", stages: ["form"] },
    { id: "reconstruction", title: "Clay, armature, rebuild", blurb: "What the form does not give you, you sculpt.", stages: ["reconstruction"] },
    { id: "mounting", title: "Hide paste, taxiing, tucking, sewing", blurb: "The skin goes on. Landmarks have to land.", stages: ["mounting"] },
    { id: "drying", title: "Drying", blurb: "Pins, cards, and the slow wait for shrinkage.", stages: ["drying"] },
    { id: "finish", title: "Finish work", blurb: "Paint, groom, blend. This is what the client sees.", stages: ["finish"] },
    { id: "birds", title: "Birds", blurb: "Tracts, primaries, bills, and the wrapped body.", stages: ["birds"] },
    { id: "fish", title: "Fish", blurb: "Skinning cuts, fins, and scale alignment.", stages: ["fish"] },
    { id: "skull", title: "Skulls & horns", blurb: "European mounts, pedicles, beetles, maceration.", stages: ["skull"] },
    { id: "habitat", title: "Habitat & shop", blurb: "The world around the animal, and the clock on the wall.", stages: ["habitat", "shop", "reference"] }
  ];

  const WORKFLOW = [
    "Field care", "caping/skinning", "turning and splitting", "fleshing/degreasing",
    "salting/rehydration", "pickling and tanning", "shaving",
    "measurements and form selection", "form alteration",
    "clay and anatomical reconstruction", "hide paste and mounting",
    "taxiing/tucking/sewing", "drying", "rebuilding, grooming, and finish work"
  ];

  const COACH = {
    field: "This is decided in the field. A ruined cape cannot be talked back into a mount.",
    skinning: "Every incision you make now is a seam you will sew and hide later.",
    prep: "If tissue stays in the ear, lip, or hide, it will grease, slip, or drum when it dries.",
    preserve: "Salt and dry preservative buy you time. They are not a tan.",
    tanning: "pH, pickle, tan, oil, shave, relax — this is how a raw hide becomes workable leather.",
    form: "The form is a commercial guess. Measurements tell you whether it fits this animal.",
    reconstruction: "Clay, epoxy, liners, and armatures put anatomy back where the foam is mute.",
    mounting: "Taxi the skin until hair pattern and landmarks agree, then tuck and sew.",
    drying: "Pins and cards hold the pose while shrinkage tries to steal it.",
    finish: "Rebuilding, paint, and grooming are how a dried mount becomes a living one.",
    birds: "Feather tracts and wing bones have their own grammar. Fight them and it shows.",
    fish: "Fins and scale rows read true or they read fake. There is no middle.",
    skull: "Bone work is chemistry and patience: flesh off, grease out, then the plaque.",
    habitat: "Habitat is a sentence about the animal, not a pile of props.",
    shop: "Turnaround is the shop clock. Reference is how you stay honest to the living animal.",
    reference: "Reference is how you stay honest to the living animal."
  };

  const state = {
    mode: "apprentice",
    campaign: false,
    chapterIndex: 0,
    queue: [],
    index: 0,
    integrity: 100,
    missed: [],
    correct: 0,
    startedAt: 0,
    allotted: 15,
    timerId: null,
    remaining: 15,
    paused: false,
    current: null,
    locked: false,
    revealing: false,
    advanceId: null,
    bannerId: null
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function termsForChapter(ch) {
    return TERMS.filter((t) => ch.stages.includes(t.stage));
  }

  function pickQueue(ch, cap = 12) {
    const pool = shuffle(termsForChapter(ch));
    return pool.slice(0, Math.min(cap, pool.length));
  }

  function allottedTime(term) {
    const len = (term.term || "").length;
    let t = 15 + Math.max(0, Math.ceil((len - 10) / 4));
    if (term.diff === 3) t = Math.max(t, 18);
    return Math.min(20, t);
  }

  function penalty(term) {
    return term.diff === 3 ? 30 : term.diff === 2 ? 25 : 20;
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => i);
    for (let j = 1; j <= n; j++) {
      let prev = dp[0];
      dp[0] = j;
      for (let i = 1; i <= m; i++) {
        const tmp = dp[i];
        dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
        prev = tmp;
      }
    }
    return dp[m];
  }

  function acceptedNames(term) {
    return [term.term, ...(term.aliases || [])];
  }

  function isCorrect(guess, term) {
    const g = normalize(guess);
    if (!g) return false;
    for (const name of acceptedNames(term)) {
      const n = normalize(name);
      if (!n) continue;
      if (g === n) return true;
      if (n.length > 8 && levenshtein(g, n) <= 1) return true;
    }
    return false;
  }

  function distractors(term, n = 3) {
    const same = TERMS.filter((t) => t.id !== term.id && t.stage === term.stage);
    const rest = TERMS.filter((t) => t.id !== term.id && t.stage !== term.stage);
    const pool = shuffle(same.concat(shuffle(rest)));
    const out = [];
    const seen = new Set([normalize(term.term)]);
    for (const t of pool) {
      const key = normalize(t.term);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= n) break;
    }
    return out;
  }

  function show(id) {
    document.querySelectorAll(".screen").forEach((el) => el.classList.add("hidden"));
    $(id).classList.remove("hidden");
  }

  function setPlate(name) {
    $("scene").dataset.plate = name;
  }

  function setIntegrity(v) {
    state.integrity = Math.max(0, Math.min(100, v));
    $("integrity").textContent = `${Math.round(state.integrity)}%`;
    $("integrity-bar").style.transform = `scaleX(${state.integrity / 100})`;
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function clearAdvance() {
    if (state.advanceId) {
      clearTimeout(state.advanceId);
      state.advanceId = null;
    }
  }

  function startTimer() {
    stopTimer();
    state.remaining = state.allotted;
    renderTimer();
    state.timerId = setInterval(() => {
      if (state.paused || state.revealing) return;
      state.remaining -= 0.1;
      renderTimer();
      if (state.remaining <= 0) {
        stopTimer();
        resolveAnswer(null, true);
      }
    }, 100);
  }

  function renderTimer() {
    const s = Math.max(0, Math.ceil(state.remaining));
    $("timer").textContent = String(s);
    $("timer-bar").style.transform = `scaleX(${Math.max(0, state.remaining / state.allotted)})`;
    const dial = $("timer").closest(".dial");
    dial.classList.toggle("warn", s <= 8 && s > 4);
    dial.classList.toggle("danger", s <= 4);
  }

  function flashBanner(text) {
    const el = $("chapter-banner");
    el.textContent = text;
    el.classList.remove("hidden");
    if (state.bannerId) clearTimeout(state.bannerId);
    state.bannerId = setTimeout(() => el.classList.add("hidden"), 1800);
  }

  function buildChapterGrid() {
    const grid = $("chapter-grid");
    grid.innerHTML = "";
    CHAPTERS.forEach((ch, i) => {
      const count = termsForChapter(ch).length;
      const btn = document.createElement("button");
      btn.className = "chapter-btn";
      btn.innerHTML = `<strong>${ch.title}</strong><small>${count} terms · ${ch.blurb}</small>`;
      btn.addEventListener("click", () => startChapter(i, false));
      grid.appendChild(btn);
    });
  }

  function startFromTitle(mode) {
    state.mode = mode;
    if (mode === "notes") {
      openNotes();
      return;
    }
    if (mode === "master") {
      startMaster();
      return;
    }
    startCampaign();
  }

  function openPractice() {
    if (state.mode === "master" || state.mode === "notes") state.mode = "apprentice";
    $("chapters-mode-label").textContent =
      state.mode === "journeyman" ? "Journeyman · one stage" : "Apprentice · one stage";
    buildChapterGrid();
    show("screen-chapters");
    setPlate("empty");
  }

  function resetScore() {
    state.missed = [];
    state.correct = 0;
    setIntegrity(100);
  }

  function startCampaign() {
    state.campaign = true;
    state.chapterIndex = 0;
    resetScore();
    loadChapter(0, { announce: true });
  }

  function startChapter(i, campaign) {
    state.campaign = !!campaign;
    state.chapterIndex = i;
    resetScore();
    loadChapter(i, { announce: true });
  }

  function startMaster() {
    state.mode = "journeyman";
    state.campaign = false;
    state.chapterIndex = -1;
    state.queue = shuffle(TERMS);
    state.index = 0;
    resetScore();
    setPlate("empty");
    playCurrent({ announce: false });
  }

  function loadChapter(i, { announce } = {}) {
    state.chapterIndex = i;
    state.queue = pickQueue(CHAPTERS[i], 12);
    state.index = 0;
    setPlate("empty");
    playCurrent({ announce });
  }

  function chapterTitle() {
    if (state.chapterIndex < 0) return "Master run";
    return CHAPTERS[state.chapterIndex].title;
  }

  function swapCard(fn) {
    const card = $("card");
    const run = () => {
      fn();
      card.classList.remove("busy");
    };
    if (reduceMotion) {
      run();
      return;
    }
    card.classList.add("busy");
    setTimeout(run, 160);
  }

  function playCurrent({ announce } = {}) {
    const term = state.queue[state.index];
    if (!term) {
      finishRun(true);
      return;
    }
    state.current = term;
    state.locked = false;
    state.revealing = false;
    state.allotted = allottedTime(term);
    state.startedAt = performance.now();
    $("play-chapter").textContent = chapterTitle();
    const chapterLen = state.queue.length;
    const globalHint = state.campaign
      ? `Stage ${state.chapterIndex + 1} of ${CHAPTERS.length} · ${state.index + 1} / ${chapterLen}`
      : `${state.index + 1} / ${chapterLen}`;
    $("play-progress").textContent = globalHint;
    if (announce) flashBanner(`Now: ${chapterTitle()}`);

    show("screen-play");
    $("pause-overlay").classList.add("hidden");
    swapCard(() => {
      const card = $("card");
      card.classList.remove("good", "bad");
      $("prompt").classList.remove("hidden");
      $("feedback").classList.add("hidden");
      $("definition").textContent = term.def;
      $("card-kicker").textContent = state.mode === "apprentice" ? "Choose the term" : "Name the term";
      const typeForm = $("type-form");
      const choices = $("choices");
      if (state.mode === "apprentice") {
        typeForm.classList.add("hidden");
        choices.classList.remove("hidden");
        renderChoices(term);
      } else {
        choices.classList.add("hidden");
        typeForm.classList.remove("hidden");
        $("answer").value = "";
      }
      startTimer();
      if (state.mode !== "apprentice") {
        requestAnimationFrame(() => $("answer").focus());
      }
    });
  }

  function renderChoices(term) {
    const opts = shuffle([term, ...distractors(term, 3)]);
    const box = $("choices");
    box.innerHTML = "";
    opts.forEach((t, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.innerHTML = `<b>${i + 1}</b>${escapeHtml(t.term)}`;
      btn.addEventListener("click", () => resolveAnswer(t.term, false));
      box.appendChild(btn);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function resolveAnswer(guess, timedOut) {
    if (state.locked || state.paused) return;
    state.locked = true;
    stopTimer();
    const term = state.current;
    const elapsed = (performance.now() - state.startedAt) / 1000;
    const ok = !timedOut && isCorrect(guess, term);
    const fast = ok && elapsed <= 10;
    let delta = 0;
    if (ok) {
      state.correct += 1;
      if (fast) {
        delta = 10;
        setIntegrity(state.integrity + 10);
      }
    } else {
      delta = -penalty(term);
      setIntegrity(state.integrity + delta);
      state.missed.push(term);
    }
    showFeedback(term, ok, fast, timedOut, delta);
  }

  function showFeedback(term, ok, fast, timedOut, delta) {
    state.revealing = true;
    const card = $("card");
    card.classList.toggle("good", ok);
    card.classList.toggle("bad", !ok);
    $("prompt").classList.add("hidden");
    $("feedback").classList.remove("hidden");
    $("reveal-kicker").textContent = timedOut
      ? "The lamp went out"
      : ok
        ? (fast ? "Clean and quick" : "That's the term")
        : "Not that term";
    $("reveal-term").textContent = term.term;
    const aliases = (term.aliases || []).filter(Boolean);
    $("reveal-aliases").textContent = aliases.length ? `Also: ${aliases.join(" · ")}` : "";
    $("reveal-coach").textContent = COACH[term.stage] || "";
    $("reveal-delta").textContent = timedOut
      ? `Timeout · ${delta}%`
      : ok && fast
        ? `First ten seconds · +${delta}%`
        : ok
          ? "On the clock"
          : `${delta}%`;
    const wait = ok ? (fast ? 1100 : 1400) : 2200;
    clearAdvance();
    state.advanceId = setTimeout(nextAfterReveal, reduceMotion ? 400 : wait);
  }

  function nextAfterReveal() {
    clearAdvance();
    if (!state.revealing) return;
    state.revealing = false;
    if (state.integrity <= 0) {
      finishRun(false);
      return;
    }
    state.index += 1;
    if (state.index >= state.queue.length) {
      if (state.campaign && state.chapterIndex >= 0 && state.chapterIndex < CHAPTERS.length - 1) {
        loadChapter(state.chapterIndex + 1, { announce: true });
        return;
      }
      finishRun(true);
      return;
    }
    playCurrent({ announce: false });
  }

  function finishRun(won) {
    stopTimer();
    clearAdvance();
    state.revealing = false;
    setPlate("wall");
    $("end-kicker").textContent = won ? "On the wall" : "On the floor";
    $("end-title").textContent = won
      ? (state.chapterIndex < 0
        ? "The whole glossary, still standing"
        : state.campaign
          ? "Field to finish, still standing"
          : "Chapter held")
      : "Integrity gone — the mount is ruined";
    const total = state.correct + state.missed.length;
    $("end-lede").textContent = won
      ? `${state.correct} of ${total} named. Integrity ${Math.round(state.integrity)}%.`
      : `${state.correct} named before the hide failed. Missed terms stay below.`;
    const ul = $("missed");
    ul.innerHTML = "";
    state.missed.slice(0, 24).forEach((t) => {
      const li = document.createElement("li");
      li.textContent = `${t.term} — ${t.def}`;
      ul.appendChild(li);
    });
    $("btn-retry").textContent = state.chapterIndex < 0
      ? "Retry master run"
      : state.campaign
        ? "Walk it again"
        : "Retry this chapter";
    show("screen-end");
  }

  function openNotes() {
    setPlate("full");
    $("workflow").innerHTML = WORKFLOW.map((w) => `<li>${escapeHtml(w)}</li>`).join("");
    const nav = $("notes-nav");
    nav.innerHTML = "";
    CHAPTERS.forEach((ch, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = ch.title;
      b.addEventListener("click", () => {
        nav.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        renderNotes(ch);
      });
      if (i === 0) b.classList.add("active");
      nav.appendChild(b);
    });
    renderNotes(CHAPTERS[0]);
    show("screen-notes");
  }

  function renderNotes(ch) {
    const items = termsForChapter(ch);
    $("notes-list").innerHTML = items.map((t) => {
      const al = (t.aliases || []).length ? `<em>Also ${escapeHtml(t.aliases.join(", "))}</em><br/>` : "";
      return `<article class="note-item"><h3>${escapeHtml(t.term)}</h3>${al}<p>${escapeHtml(t.def)}</p></article>`;
    }).join("");
  }

  function goHome() {
    stopTimer();
    clearAdvance();
    state.paused = false;
    state.revealing = false;
    state.locked = false;
    $("pause-overlay").classList.add("hidden");
    setPlate("full");
    show("screen-title");
  }

  function pause() {
    if ($("screen-play").classList.contains("hidden")) return;
    state.paused = true;
    $("pause-overlay").classList.remove("hidden");
  }

  function resume() {
    state.paused = false;
    $("pause-overlay").classList.add("hidden");
    if (state.mode !== "apprentice" && !state.revealing) $("answer").focus();
  }

  function startDust() {
    const canvas = $("dust");
    const ctx = canvas.getContext("2d");
    const bits = [];
    function resize() {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 48; i++) {
      bits.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.4 + 0.3,
        s: Math.random() * 0.00025 + 0.00008,
        drift: (Math.random() - 0.5) * 0.00012
      });
    }
    function tick() {
      if (!reduceMotion) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(243,230,200,0.55)";
        bits.forEach((p) => {
          p.y -= p.s;
          p.x += p.drift;
          if (p.y < 0) p.y = 1;
          if (p.x < 0 || p.x > 1) p.x = Math.random();
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, p.r, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      requestAnimationFrame(tick);
    }
    if (!reduceMotion) tick();
  }

  function startParallax() {
    if (reduceMotion) return;
    const scene = $("scene");
    window.addEventListener("pointermove", (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 16;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      scene.style.transform = `translate(${x}px, ${y}px)`;
    });
  }

  document.querySelectorAll("[data-start]").forEach((btn) => {
    btn.addEventListener("click", () => startFromTitle(btn.dataset.start));
  });
  $("btn-practice").addEventListener("click", openPractice);
  $("chapters-back").addEventListener("click", goHome);
  $("notes-back").addEventListener("click", goHome);
  $("type-form").addEventListener("submit", (e) => {
    e.preventDefault();
    resolveAnswer($("answer").value, false);
  });
  $("btn-pause").addEventListener("click", pause);
  $("btn-resume").addEventListener("click", resume);
  $("btn-quit").addEventListener("click", goHome);
  $("btn-home").addEventListener("click", goHome);
  $("btn-retry").addEventListener("click", () => {
    if (state.chapterIndex < 0) startMaster();
    else if (state.campaign) startCampaign();
    else startChapter(state.chapterIndex, false);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("screen-play").classList.contains("hidden")) {
        if (state.paused) resume();
        else pause();
      }
      return;
    }
    if (state.revealing && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      nextAfterReveal();
      return;
    }
    if ($("screen-play").classList.contains("hidden") || state.paused || state.revealing) return;
    if (state.mode === "apprentice" && ["1", "2", "3", "4"].includes(e.key)) {
      const btn = $("choices").children[Number(e.key) - 1];
      if (btn) btn.click();
    }
  });

  if (!TERMS.length) {
    $("screen-title").insertAdjacentHTML("beforeend", "<p class='fine'>Glossary failed to load.</p>");
  }
  startDust();
  startParallax();
})();
