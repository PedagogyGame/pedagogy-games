/* The Shed — corner bench tools. */
(function () {
  "use strict";

  var TOOLS = [
    { name: "Batten", note: "A thin lie-detector. If it kinks, the line is wrong, not the wood.",
      left: 16, top: 34, width: 78, height: 9 },
    { name: "Saws on the wall", note: "The ones that live here. Not a kit. A shed.",
      left: 60, top: 0, width: 32, height: 28 },
    { name: "Handsaw", note: "Moulds are cheap softwood. They are allowed to be crude. The keel is not.",
      left: 34, top: 55, width: 32, height: 10 },
    { name: "G-cramps", note: "The garboard will try to walk while you look for the next nail.",
      left: 70, top: 50, width: 22, height: 16 },
    { name: "Bench vice", note: "Holds the work. The boat is not the work, yet; a mould is, a hood end is.",
      left: 4, top: 52, width: 14, height: 42 },
    { name: "Jack plane", note: "Fairness is a long shaving, not a short one.",
      left: 20, top: 44, width: 14, height: 14 },
    { name: "Mallet", note: "Copper does not like steel hammers. Wood on the rove, then peen.",
      left: 54, top: 64, width: 14, height: 24 },
    { name: "Sliding bevel", note: "The stem rake is on the drawing. This takes it off the paper and onto the oak.",
      left: 10, top: 41, width: 14, height: 12 },
    { name: "Spokeshave", note: "For the places a plane will not follow. Stem, transom corners, the last of a land.",
      left: 34, top: 46, width: 14, height: 11 },
    { name: "Copper nails and roves", note: "No. 14. Through, roved, snug, peened. Two in the land between timbers besides the timber nail.",
      left: 33, top: 64, width: 12, height: 12 },
    { name: "Chisel", note: "The rabbet is a groove in the keel for the first plank. If the fit is poor, water has a place to live.",
      left: 47, top: 64, width: 10, height: 20 },
    { name: "Marking gauge", note: "The land is three-quarters of an inch. Keep saying it until the strake believes you.",
      left: 64, top: 68, width: 13, height: 16 },
    { name: "Dividers", note: "Sixteen stations on the floor. Seven of them will stand up.",
      left: 76, top: 72, width: 12, height: 18 }
  ];

  var overlay = null;
  var onCloseCb = null;

  function stop(e) { e.stopPropagation(); }

  function close() {
    if (!overlay) return;
    overlay.removeEventListener("click", stop, true);
    overlay.removeEventListener("keydown", stop, true);
    overlay.removeEventListener("keyup", stop, true);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  function open(onClose) {
    if (overlay) close();
    onCloseCb = typeof onClose === "function" ? onClose : null;

    overlay = document.createElement("div");
    overlay.setAttribute("data-shed-tools", "1");
    overlay.tabIndex = 0;
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:41;background:#f3eee4;outline:none;" +
      "font-family:'Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;color:#3c352c;";

    var style = document.createElement("style");
    style.textContent =
      ".shed-tools-back{position:absolute;top:1.1rem;right:1.4rem;background:none;border:none;cursor:pointer;" +
      "font-family:inherit;font-size:0.95rem;color:#9a5c38;padding:0;z-index:2;}" +
      ".shed-tools-back:hover{text-decoration:underline;}" +
      ".shed-tools-col{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;" +
      "padding:2.4rem 1.2rem 1.5rem;box-sizing:border-box;}" +
      ".shed-tools-frame{position:relative;display:inline-block;max-width:92vw;max-height:78vh;line-height:0;}" +
      ".shed-tools-frame img{display:block;max-width:92vw;max-height:78vh;width:auto;height:auto;}" +
      ".shed-hot{position:absolute;background:transparent;border:1px solid transparent;cursor:pointer;padding:0;}" +
      ".shed-hot:hover,.shed-hot.on{border-color:rgba(154,92,56,0.45);}" +
      ".shed-tools-note{max-width:36rem;margin:1.15rem auto 0;text-align:left;padding:0 0.6rem;}" +
      ".shed-tools-kicker{font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:#5c5348;margin-bottom:0.45rem;}" +
      ".shed-tools-body{font-size:1.05rem;line-height:1.5;color:#3c352c;}";
    overlay.appendChild(style);

    var back = document.createElement("button");
    back.type = "button";
    back.className = "shed-tools-back";
    back.textContent = "Back to the shed";
    back.addEventListener("click", function (e) {
      e.stopPropagation();
      var cb = onCloseCb;
      close();
      if (cb) cb();
    });
    overlay.appendChild(back);

    var col = document.createElement("div");
    col.className = "shed-tools-col";

    var frame = document.createElement("div");
    frame.className = "shed-tools-frame";

    var img = document.createElement("img");
    img.src = "img/tools-bench.jpg";
    img.alt = "";
    frame.appendChild(img);

    var note = document.createElement("div");
    note.className = "shed-tools-note";
    var kicker = document.createElement("div");
    kicker.className = "shed-tools-kicker";
    kicker.textContent = "The bench";
    var body = document.createElement("p");
    body.className = "shed-tools-body";
    body.textContent = "The corner bench. Click a tool.";
    note.appendChild(kicker);
    note.appendChild(body);

    var selected = null;
    TOOLS.forEach(function (tool) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shed-hot";
      btn.setAttribute("aria-label", tool.name);
      btn.style.left = tool.left + "%";
      btn.style.top = tool.top + "%";
      btn.style.width = tool.width + "%";
      btn.style.height = tool.height + "%";
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (selected) selected.classList.remove("on");
        selected = btn;
        btn.classList.add("on");
        kicker.textContent = tool.name;
        body.textContent = tool.note;
      });
      frame.appendChild(btn);
    });

    col.appendChild(frame);
    col.appendChild(note);
    overlay.appendChild(col);

    overlay.addEventListener("click", stop, true);
    overlay.addEventListener("keydown", stop, true);
    overlay.addEventListener("keyup", stop, true);
    document.body.appendChild(overlay);
    overlay.focus();
  }

  function isOpen() { return !!overlay; }

  window.ShedTools = { open: open, close: close, isOpen: isOpen };
})();
