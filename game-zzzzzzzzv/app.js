(function () {
  const DATA = window.PLAYABLE;
  const SPECIES = (DATA && DATA.species) || [];
  const N = SPECIES.length;
  const LETTERS = "ABCDEFG".split("");

  const PART_LABEL = {
    bark: "bark",
    leaves: "leaves",
    needles: "needles",
    cones: "seed cones",
    fruit: "fruit",
    acorns: "acorns",
    samaras: "samaras",
    fronds: "fronds",
    flowers: "flowers",
    habit: "form",
  };

  const state = {
    view: "home",
    short: false,
    queue: [],
    i: 0,
    correct: 0,
    streak: 0,
    known: new Set(),
    answered: false,
    pick: null,
  };

  function $(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function others(sp, n) {
    const pool = SPECIES.filter((s) => s.id !== sp.id);
    const same = pool.filter((s) => s.type === sp.type);
    const rest = pool.filter((s) => s.type !== sp.type);
    return shuffle(same).concat(shuffle(rest)).slice(0, n);
  }

  function plateOf(sp) {
    const plates = sp.plates || [];
    const preferred = ["leaves", "needles", "bark", "cones", "fruit", "acorns", "samaras", "fronds", "habit", "flowers"];
    const ranked = preferred
      .map((p) => plates.find((x) => x.part === p))
      .filter(Boolean);
    const all = ranked.concat(plates.filter((p) => !ranked.includes(p)));
    if (!all.length) return null;
    return all[Math.floor(Math.random() * Math.min(all.length, 3))] || all[0];
  }

  function imgSrc(plate) {
    return (plate && (plate.path || plate.fileUrl)) || "";
  }

  function marksText(sp) {
    const f = sp.idFeatures || {};
    const bits = [];
    if (f.bark) bits.push("Bark: " + f.bark);
    if (f.needles) bits.push("Needles: " + f.needles);
    else if (f.leaves) bits.push("Leaves: " + f.leaves);
    else if (f.fronds) bits.push("Fronds: " + f.fronds);
    if (f.cones) bits.push("Cones: " + f.cones);
    else if (f.fruit) bits.push("Fruit: " + f.fruit);
    else if (f.acorns) bits.push("Acorns: " + f.acorns);
    else if (f.samaras) bits.push("Samaras: " + f.samaras);
    return bits.slice(0, 3).join(" ");
  }

  function originText(sp) {
    return [sp.nativeRange, sp.biome, sp.whyCommon].filter(Boolean).join(" · ");
  }

  function buildRound() {
    const size = state.short ? Math.min(20, N) : N;
    const picked = shuffle(SPECIES).slice(0, size);
    const types = ["photo", "marks", "origin"];
    state.queue = picked.map((sp, idx) => {
      const kind = types[idx % 3];
      const plate = plateOf(sp);
      if (kind === "photo") {
        const opts = shuffle([sp, ...others(sp, 3)]);
        return {
          kind,
          sp,
          plate,
          question: "Identify this tree.",
          help: "Study the photograph, then select its common name.",
          kicker: "SELECT THE MATCHING TREE NAME",
          options: opts.map((s) => ({ id: s.id, text: s.commonName })),
        };
      }
      if (kind === "marks") {
        const distractors = others(sp, 3).map((s) => ({ id: s.id, text: marksText(s) }));
        const opts = shuffle([{ id: sp.id, text: marksText(sp) }, ...distractors]);
        return {
          kind,
          sp,
          plate,
          question: sp.commonName,
          help: "Which clearly distinct profile matches this tree’s field marks?",
          kicker: "SELECT THE MATCHING FIELD MARKS",
          options: opts,
        };
      }
      const distractors = others(sp, 3).map((s) => ({ id: s.id, text: originText(s) }));
      const opts = shuffle([{ id: sp.id, text: originText(sp) }, ...distractors]);
      return {
        kind,
        sp,
        plate,
        question: sp.commonName,
        help: "Which historical range or ecological role is correct for this tree?",
        kicker: "SELECT THE CORRECT RANGE OR ROLE",
        options: opts,
      };
    });
    state.i = 0;
    state.correct = 0;
    state.streak = 0;
    state.known = new Set();
    state.answered = false;
    state.pick = null;
    state.view = "quiz";
  }

  function statsBar(qIndex, total) {
    return (
      '<div class="stats">' +
      chip("QUESTION", (qIndex + 1) + "/" + total) +
      chip("CORRECT", String(state.correct)) +
      chip("STREAK", String(state.streak)) +
      chip("KNOWN", state.known.size + "/" + N) +
      "</div>"
    );
  }

  function chip(k, v) {
    return '<div class="chip"><span>' + k + "</span><b>" + v + "</b></div>";
  }

  function header(sub) {
    return (
      '<header class="top"><div>' +
      '<p class="kicker">FOREST FIELD STATION // ' + N + "</p>" +
      "<h1>Grove Bench</h1>" +
      '<p class="subtitle">' +
      (sub ||
        "Identify the world’s most common trees. Photograph first, then the tree’s range, traits, and field marks.") +
      "</p></div>" +
      (state.view === "quiz" ? statsBar(state.i, state.queue.length) : statsBar(-1 + 1, state.queue.length || N)) +
      "</header>"
    );
  }

  function renderHome() {
    const app = document.getElementById("app");
    app.innerHTML =
      header("Identify the world’s most common trees. Photograph first, then the tree’s range, traits, and field marks.") +
      '<section class="panel">' +
      "<p>A bench of " +
      N +
      " trees with confirmed photographs — bark, leaves, needles, cones, and fruit. Sixteen species with no usable plates were left off.</p>" +
      '<div class="home-actions">' +
      '<button class="primary go" id="full">Take the bench →</button>' +
      '<button class="ghost" id="short">Short bench (20)</button>' +
      "</div>" +
      '<p class="home-note">Commons photographs, checked for the right organ and species. Watermarked or mislabeled plates were dropped.</p>' +
      "</section>" +
      footer();
    document.getElementById("full").onclick = function () {
      state.short = false;
      buildRound();
      render();
    };
    document.getElementById("short").onclick = function () {
      state.short = true;
      buildRound();
      render();
    };
  }

  function footer() {
    return (
      "<footer>Photographs from <a href=\"https://commons.wikimedia.org/\">Wikimedia Commons</a> contributors, used under their stated licenses (typically CC0, Public Domain, CC BY, or CC BY-SA). Grove Bench is for identification practice.</footer>"
    );
  }

  function identityHtml(item, revealed) {
    if (!revealed) {
      return (
        '<div class="identity"><h2>Specimen identity</h2>' +
        '<p class="placeholder">Choose a name to reveal the tree’s identity, then go on to the next specimen.</p></div>'
      );
    }
    const sp = item.sp;
    const f = sp.idFeatures || {};
    const notes = [f.bark, f.needles || f.leaves || f.fronds, f.cones || f.fruit || f.acorns || f.samaras]
      .filter(Boolean)
      .slice(0, 3)
      .map((t) => "<p>" + escapeHtml(t) + "</p>")
      .join("");
    const pl = item.plate || {};
    const credit = [pl.artist, pl.license, pl.commonsTitle].filter(Boolean).join(" · ");
    const link = pl.pageUrl
      ? '<div class="attrib"><a href="' + pl.pageUrl + '" target="_blank" rel="noopener">Commons file</a> · ' +
        escapeHtml(credit) +
        "</div>"
      : credit
      ? '<div class="attrib">' + escapeHtml(credit) + "</div>"
      : "";
    return (
      '<div class="identity"><h2>Specimen identity</h2>' +
      '<p class="name">' +
      escapeHtml(sp.commonName) +
      "</p>" +
      '<p class="sci">' +
      escapeHtml(sp.scientificName) +
      " · " +
      escapeHtml(sp.family || "") +
      "</p>" +
      "<p>" +
      escapeHtml([sp.type, sp.biome, sp.nativeRange].filter(Boolean).join(" · ")) +
      "</p>" +
      notes +
      link +
      "</div>"
    );
  }

  function renderQuiz() {
    const item = state.queue[state.i];
    if (!item) {
      state.view = "done";
      render();
      return;
    }
    const total = state.queue.length;
    const src = imgSrc(item.plate);
    const alt = state.answered
      ? ((item.plate && PART_LABEL[item.plate.part]) || "specimen")
      : "Unidentified tree specimen";
    const partHint =
      item.kind === "photo" && item.plate
        ? "This plate shows " + (PART_LABEL[item.plate.part] || item.plate.part) + "."
        : item.help;

    const choices = item.options
      .map(function (opt, idx) {
        let cls = "choice";
        if (state.answered && state.pick === opt.id) cls += " selected";
        if (state.answered && opt.id === item.sp.id) cls += " good";
        if (state.answered && state.pick === opt.id && opt.id !== item.sp.id) cls += " bad";
        return (
          '<button class="' +
          cls +
          '" data-id="' +
          opt.id +
          '"' +
          (state.answered ? " disabled" : "") +
          '><span class="letter">' +
          LETTERS[idx] +
          '</span><span class="label">' +
          escapeHtml(opt.text) +
          "</span></button>"
        );
      })
      .join("");

    const photoLeft = item.kind === "photo" && false;
    const qPanel =
      '<section class="panel">' +
      '<p class="q-kicker">SPECIMEN ' +
      (state.i + 1) +
      " OF " +
      total +
      " · " +
      item.kicker +
      "</p>" +
      '<h2 class="q-title">' +
      (item.kind === "photo" ? item.question : escapeHtml(item.question)) +
      "</h2>" +
      '<p class="q-help">' +
      escapeHtml(partHint) +
      "</p>" +
      '<div class="choices">' +
      choices +
      "</div>" +
      '<div class="nav"><button class="ghost" id="leave">Leave bench</button>' +
      '<button class="primary' +
      (state.answered ? " go" : "") +
      '" id="next"' +
      (state.answered ? "" : " disabled") +
      ">Next specimen →</button></div></section>";

    const photoPanel =
      '<section class="panel photo-col"><div class="photo-wrap">' +
      (src ? '<img src="' + src + '" alt="' + escapeHtml(alt) + '">' : "") +
      "</div>" +
      identityHtml(item, state.answered) +
      "</section>";

    const app = document.getElementById("app");
    app.innerHTML =
      '<header class="top"><div>' +
      '<p class="kicker">FOREST FIELD STATION // ' +
      N +
      "</p>" +
      "<h1>Grove Bench</h1>" +
      '<p class="subtitle">Identify the world’s most common trees. Photograph first, then the tree’s range, traits, and field marks.</p></div>' +
      statsBar(state.i, total) +
      "</header>" +
      '<div class="bench">' +
      (photoLeft ? photoPanel + qPanel : qPanel + photoPanel) +
      "</div>" +
      footer();

    app.querySelectorAll(".choice").forEach(function (btn) {
      btn.onclick = function () {
        if (state.answered) return;
        const id = btn.getAttribute("data-id");
        state.pick = id;
        state.answered = true;
        if (id === item.sp.id) {
          state.correct += 1;
          state.streak += 1;
          state.known.add(item.sp.id);
        } else {
          state.streak = 0;
        }
        render();
      };
    });
    document.getElementById("leave").onclick = function () {
      state.view = "home";
      render();
    };
    document.getElementById("next").onclick = function () {
      if (!state.answered) return;
      state.i += 1;
      state.answered = false;
      state.pick = null;
      if (state.i >= state.queue.length) state.view = "done";
      render();
    };
  }

  function renderDone() {
    const total = state.queue.length;
    const app = document.getElementById("app");
    app.innerHTML =
      header() +
      '<section class="panel">' +
      '<p class="q-kicker">BENCH COMPLETE</p>' +
      '<h2 class="q-title">' +
      state.correct +
      " of " +
      total +
      "</h2>" +
      "<p class=\"q-help\">Known this sitting: " +
      state.known.size +
      " of " +
      N +
      " trees.</p>" +
      '<div class="home-actions"><button class="primary go" id="again">Take the bench again</button>' +
      '<button class="ghost" id="home">Leave bench</button></div></section>' +
      footer();
    document.getElementById("again").onclick = function () {
      buildRound();
      render();
    };
    document.getElementById("home").onclick = function () {
      state.view = "home";
      render();
    };
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    if (!N) {
      document.getElementById("app").textContent = "No playable species.";
      return;
    }
    if (state.view === "home") renderHome();
    else if (state.view === "quiz") renderQuiz();
    else renderDone();
  }

  render();
})();
