(function () {
  const DATA = window.PLAYABLE;
  const SPECIES = (DATA && DATA.species) || [];
  const N = SPECIES.length;
  const LETTERS = "ABCD".split("");

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
    if (!plates.length) return null;
    return plates[Math.floor(Math.random() * plates.length)];
  }

  function imgSrc(plate) {
    return (plate && (plate.path || plate.fileUrl)) || "";
  }

  function buildRound() {
    const size = state.short ? Math.min(20, N) : N;
    const picked = shuffle(SPECIES).slice(0, size);
    state.queue = picked.map(function (sp) {
      const opts = shuffle([sp].concat(others(sp, 3)));
      return {
        sp: sp,
        plate: plateOf(sp),
        options: opts.map(function (s) {
          return { id: s.id, text: s.commonName };
        }),
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
    const q = state.view === "quiz" ? qIndex + 1 + "/" + total : "—";
    return (
      '<div class="stats">' +
      chip("QUESTION", q) +
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
      (sub || "Study the photograph, pick the common name. Range and field marks come after you answer.") +
      "</p></div>" +
      statsBar(state.i, state.queue.length || N) +
      "</header>"
    );
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
        '<p class="placeholder">Choose a name. The range, role, and field marks appear next.</p></div>'
      );
    }
    const sp = item.sp;
    const f = sp.idFeatures || {};
    const rows = [];
    if (sp.nativeRange) rows.push(["Range", sp.nativeRange]);
    if (sp.biome) rows.push(["Biome", sp.biome]);
    if (sp.whyCommon) rows.push(["Why it is common", sp.whyCommon]);
    if (f.bark) rows.push(["Bark", f.bark]);
    if (f.needles) rows.push(["Needles", f.needles]);
    else if (f.leaves) rows.push(["Leaves", f.leaves]);
    else if (f.fronds) rows.push(["Fronds", f.fronds]);
    if (f.cones) rows.push(["Cones", f.cones]);
    if (f.fruit) rows.push(["Fruit", f.fruit]);
    if (f.acorns) rows.push(["Acorns", f.acorns]);
    if (f.samaras) rows.push(["Samaras", f.samaras]);
    if (f.habit) rows.push(["Form", f.habit]);
    const body = rows
      .map(function (pair) {
        return (
          "<p><strong>" +
          escapeHtml(pair[0]) +
          ".</strong> " +
          escapeHtml(pair[1]) +
          "</p>"
        );
      })
      .join("");
    const pl = item.plate || {};
    const credit = [pl.artist, pl.license].filter(Boolean).join(" · ");
    const link = pl.pageUrl
      ? '<div class="attrib"><a href="' +
        pl.pageUrl +
        '" target="_blank" rel="noopener">Commons file</a>' +
        (credit ? " · " + escapeHtml(credit) : "") +
        "</div>"
      : credit
      ? '<div class="attrib">' + escapeHtml(credit) + "</div>"
      : "";
    const ok = state.pick === sp.id;
    return (
      '<div class="identity"><h2>Specimen identity</h2>' +
      '<p class="verdict-line">' +
      (ok ? "Correct." : "The tree is " + escapeHtml(sp.commonName) + ".") +
      "</p>" +
      '<p class="name">' +
      escapeHtml(sp.commonName) +
      "</p>" +
      '<p class="sci">' +
      escapeHtml(sp.scientificName) +
      (sp.family ? " · " + escapeHtml(sp.family) : "") +
      "</p>" +
      body +
      link +
      "</div>"
    );
  }

  function renderHome() {
    const app = document.getElementById("app");
    app.innerHTML =
      header() +
      '<section class="panel">' +
      "<p>A bench of " +
      N +
      " trees. Each question is a photograph: pick the common name. After you answer, you get the range, role, and field marks, then Next.</p>" +
      '<div class="home-actions">' +
      '<button class="primary go" id="full">Take the bench →</button>' +
      '<button class="ghost" id="short">Short bench (20)</button>' +
      "</div></section>" +
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

  function renderQuiz() {
    const item = state.queue[state.i];
    if (!item) {
      state.view = "done";
      render();
      return;
    }
    const total = state.queue.length;
    const src = imgSrc(item.plate);
    const part = item.plate && item.plate.part;
    const partHint = part
      ? "This plate shows " + (PART_LABEL[part] || part) + "."
      : "Study the photograph, then select its common name.";
    const alt = state.answered
      ? item.sp.commonName + (part ? " " + (PART_LABEL[part] || part) : "")
      : "Unidentified tree specimen";

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

    const qPanel =
      '<section class="panel">' +
      '<p class="q-kicker">SPECIMEN ' +
      (state.i + 1) +
      " OF " +
      total +
      " · IDENTIFY THIS TREE</p>" +
      '<h2 class="q-title">Identify this tree.</h2>' +
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
      header() +
      '<div class="bench">' +
      qPanel +
      photoPanel +
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
      '<p class="q-help">Known this sitting: ' +
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
