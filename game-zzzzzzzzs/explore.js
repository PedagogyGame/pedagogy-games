/* The Shed — canvas walkaround. No libraries. */
(function () {
  "use strict";

  var INK = "#3c352c";
  var PALE = "#8a8174";
  var OAK = "#5a4638";
  var LARCH = "#7a6248";
  var LAND = "#3c352c";
  var MOULD = "#a89478";
  var RIBBAND = "#6e6256";
  var COPPER = "#9a5c38";
  var GHOST = "#c9c1b3";
  var PAPER = "#f3eee4";
  var NEAR = 0.12;
  var HALF_B = [0, 0.20, 0.46, 0.64, 0.711, 0.69, 0.60, 0.50];
  var DEPTHS = [0.62, 0.57, 0.53, 0.521, 0.521, 0.50, 0.48, 0.45];
  var STEM_Z = 6.95;
  var LOA = 3.658;
  var KEEL_INV = 1.28;
  var KEEL_UP = 0.22;
  var KEEL_W = 0.056;
  var KEEL_H = 0.07;
  var KW = KEEL_W * 0.5;
  var CAPTION = {
    skeleton: "Day 24. Backbone inverted. Seven moulds in air.",
    planked: "Day 47. Twelve strakes a side. The lands closed.",
    upright: "Day 61. Right way up."
  };
  var COPY = {
    mould: "Cheap softwood, notched over the keel. They are the boat’s shadows. They will come out.",
    notch: "Cheap softwood, notched over the keel. They are the boat’s shadows. They will come out.",
    rabbet: "A groove in the keel and into the stem. The first plank sits in it. It does not rest on the keel.",
    garboard: "The forward end has to rotate to meet the stem. This is the slowest thing in the room.",
    land: "Three-quarters of an inch. Nail through, rove on, snug, peen. Two fastenings between timbers besides the timber nail.",
    copper: "No. 14. Through, roved, snug, peened. Copper, because it holds and it does not rot the oak.",
    "hood end": "The strake tucks into the stem. The wood is being asked something it would rather not do.",
    stem: "Rake taken off the drawing with the bevel.",
    keel: "Oak. The first thing that is the boat.",
    transom: "The after end of the argument.",
    "centreboard case": "On the spine before there is a hull. A slot a thousand millimetres long.",
    ribband: "Along the moulds. If station four is proud, you will see it here.",
    timber: "Nineteen, seven-inch centres. The moulds were never the structure. The ribs are.",
    gunwale: "Along the sheer, locking the frame heads.",
    knee: "The thwart does not trust the planking alone.",
    thwart: "Because a person has to sit.",
    "mast bench": "The hole sits four hundred and twenty millimetres from the stem.",
    breasthook: "The bow, closed.",
    hog: "A second oak longitudinal on the inboard face of the keel. The keelson, if you are being formal.",
    apron: "The inner stem. Sister to the face, taking the hood ends from inside.",
    scarf: "Where stem and keel agree to be one piece. A stopwater at the step, because water will try.",
    "transom knee": "Transom to keel. The after end would walk off without it.",
    sheer: "The top strake. The gunwale is the cap; this is the plank that makes the sheer.",
    rowlock: "The brief said it had to row as well as sail.",
    limber: "Water has to travel. The heel is not a dam.",
    spec: "June 1913. The numbers on the wall, now in the room."
  };
  var PLATE_SRC = {
    mould: "img/joint-mould.jpg",
    notch: "img/joint-mould.jpg",
    rabbet: "img/joint-rabbet.jpg",
    garboard: "img/joint-rabbet.jpg",
    land: "img/joint-land.jpg",
    copper: "img/joint-land.jpg",
    "hood end": "img/joint-hood.jpg",
    stem: "img/joint-hood.jpg",
    timber: "img/joint-timber.jpg",
    knee: "img/joint-timber.jpg",
    hog: "img/joint-rabbet.jpg",
    apron: "img/joint-hood.jpg",
    scarf: "img/joint-hood.jpg",
    "transom knee": "img/joint-timber.jpg",
    sheer: "img/joint-land.jpg",
    limber: "img/joint-timber.jpg"
  };
  var HINT = "The near side is drawn. Walk around for the other. Hover a name.";
  var W_OAK = 1.7;
  var W_LARCH = 1.05;
  var W_LAND = 1.45;
  var W_MOULD = 1.15;
  var W_RIB = 0.9;
  var W_COP = 1.4;

  var overlay = null;
  var canvas = null;
  var ctx = null;
  var calloutEl = null;
  var raf = 0;
  var mode = "skeleton";
  var onCloseCb = null;
  var cam = { x: 0, y: 1.55, z: 0.35, yaw: 0, pitch: -0.04 };
  var down = {};
  var dragging = false;
  var lastPX = 0;
  var lastPY = 0;
  var mouse = { x: -9999, y: -9999 };
  var lastT = 0;
  var geom = [];
  var tags = [];
  var tagHits = [];
  var hoverDrawn = [];
  var cssW = 1;
  var cssH = 1;
  var lastHover = "__init__";
  var copperI = 0;
  var plateCache = {};

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixHex(a, b, t) {
    t = clamp(t, 0, 1);
    function hex(c) {
      c = String(c).replace("#", "");
      return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
    }
    var A = hex(a), B = hex(b);
    var r = Math.round(A[0] + (B[0] - A[0]) * t);
    var g = Math.round(A[1] + (B[1] - A[1]) * t);
    var bl = Math.round(A[2] + (B[2] - A[2]) * t);
    function to(n) { var h = n.toString(16); return h.length < 2 ? "0" + h : h; }
    return "#" + to(r) + to(g) + to(bl);
  }
  function isFarSide(x) {
    if (Math.abs(cam.x) < 0.28 && x < -0.025) return true;
    if (cam.x * x < -0.008) return true;
    return false;
  }
  function lerpArr(arr, s) {
    var x = clamp(s, 0, 1) * 7;
    var i = Math.min(6, Math.floor(x));
    var t = x - i;
    return arr[i] * (1 - t) + arr[i + 1] * t;
  }

  function keelY() { return mode === "upright" ? KEEL_UP : KEEL_INV; }
  function inverted() { return mode !== "upright"; }
  function by(yOff) {
    return inverted() ? keelY() - yOff : keelY() + yOff;
  }
  function bz(s) { return STEM_Z - s * LOA; }

  function hullXY(s, t) {
    var halfB = lerpArr(HALF_B, s);
    var depth = lerpArr(DEPTHS, s);
    var ang = t * Math.PI * 0.5;
    var sn = Math.sin(ang);
    var cs = Math.cos(ang);
    var x = halfB * Math.pow(sn, 0.88);
    var yOff = depth * (1 - Math.pow(Math.abs(cs), 1.12));
    return { x: x, yOff: yOff, depth: depth, halfB: halfB };
  }

  function add(x0, y0, z0, x1, y1, z1, color, label, extra) {
    extra = extra || {};
    geom.push({
      x0: x0, y0: y0, z0: z0, x1: x1, y1: y1, z1: z1,
      color: color || INK,
      label: label || null,
      lod: !!extra.lod,
      w: extra.w == null ? 1 : extra.w,
      sparse: !!extra.sparse,
      si: extra.si || 0,
      layer: extra.layer || "boat"
    });
  }
  function poly(pts, color, label, extra) {
    var i, a, b;
    for (i = 1; i < pts.length; i++) {
      a = pts[i - 1];
      b = pts[i];
      add(a[0], a[1], a[2], b[0], b[1], b[2], color, label, extra);
    }
  }
  function box(x0, y0, z0, x1, y1, z1, color, label, extra) {
    add(x0, y0, z0, x1, y0, z0, color, label, extra);
    add(x1, y0, z0, x1, y0, z1, color, label, extra);
    add(x1, y0, z1, x0, y0, z1, color, label, extra);
    add(x0, y0, z1, x0, y0, z0, color, label, extra);
    add(x0, y1, z0, x1, y1, z0, color, label, extra);
    add(x1, y1, z0, x1, y1, z1, color, label, extra);
    add(x1, y1, z1, x0, y1, z1, color, label, extra);
    add(x0, y1, z1, x0, y1, z0, color, label, extra);
    add(x0, y0, z0, x0, y1, z0, color, label, extra);
    add(x1, y0, z0, x1, y1, z0, color, label, extra);
    add(x1, y0, z1, x1, y1, z1, color, label, extra);
    add(x0, y0, z1, x0, y1, z1, color, label, extra);
  }

  function pt(s, t, side) {
    var h = hullXY(s, t);
    return [side * h.x, by(h.yOff), bz(s)];
  }
  function ptIn(s, t, side, dist) {
    var h = hullXY(s, t);
    var px = side * h.x;
    var py = by(h.yOff);
    var cx = 0;
    var cy = by(h.depth * 0.42);
    var nx = cx - px;
    var ny = cy - py;
    var len = Math.hypot(nx, ny) || 1;
    return [px + nx / len * dist, py + ny / len * dist, bz(s)];
  }
  function alongT(s, t, side, dist) {
    var h0 = hullXY(s, t);
    var t1 = t + 0.03;
    if (t1 > 1) t1 = 1;
    var h1 = hullXY(s, t1);
    var ax = side * (h1.x - h0.x);
    var ay = by(h1.yOff) - by(h0.yOff);
    var len = Math.hypot(ax, ay) || 1;
    if (t1 === t) return [side * h0.x, by(h0.yOff), bz(s)];
    return [side * h0.x + ax / len * dist, by(h0.yOff) + ay / len * dist, bz(s)];
  }
  function inboardN(s, t, side) {
    var h = hullXY(s, t);
    var px = side * h.x;
    var py = by(h.yOff);
    var nx = 0 - px;
    var ny = by(h.depth * 0.42) - py;
    var len = Math.hypot(nx, ny) || 1;
    return { x: nx / len, y: ny / len, px: px, py: py, pz: bz(s) };
  }

  function squareMarker(x, y, z, size, color, label) {
    var h = size * 0.5;
    var extra = { w: W_COP };
    add(x - h, y, z - h, x + h, y, z - h, color, label, extra);
    add(x + h, y, z - h, x + h, y, z + h, color, label, extra);
    add(x + h, y, z + h, x - h, y, z + h, color, label, extra);
    add(x - h, y, z + h, x - h, y, z - h, color, label, extra);
    add(x - h, y - h * 0.4, z, x + h, y - h * 0.4, z, color, label, extra);
    add(x - h, y + h * 0.4, z, x + h, y + h * 0.4, z, color, label, extra);
  }

  function buildShed() {
    var x0 = -2.15, x1 = 2.15, yT = 0, yE = 2.72, yR = 3.15, z0 = 0, z1 = 9.2;
    var z, extraLod = { lod: true, w: 1, layer: "shed" };
    var shed = { layer: "shed" };
    for (z = 0; z <= z1 + 0.001; z += 0.55) {
      add(x0, 0, z, x1, 0, z, PALE, null, extraLod);
    }
    add(0, 0, z0, 0, 0, z1, PALE, null, extraLod);
    add(x0, 0, z0, x0, yE, z0, INK, null, shed);
    add(x1, 0, z0, x1, yE, z0, INK, null, shed);
    add(x0, 0, z1, x0, yE, z1, INK, null, shed);
    add(x1, 0, z1, x1, yE, z1, INK, null, shed);
    add(x0, 0, z0, x0, 0, z1, INK, null, shed);
    add(x1, 0, z0, x1, 0, z1, INK, null, shed);
    add(x0, 0, z1, x1, 0, z1, INK, null, shed);
    add(x0, yE, z0, x0, yE, z1, INK, null, shed);
    add(x1, yE, z0, x1, yE, z1, INK, null, shed);
    add(x0, yE, z1, x1, yE, z1, INK, null, shed);
    add(x0, yE, z0, x1, yE, z0, INK, null, shed);
    add(x0, 0, z0, -0.58, 0, z0, INK, null, shed);
    add(0.58, 0, z0, x1, 0, z0, INK, null, shed);
    add(-0.58, 0, z0, -0.58, 2.15, z0, INK, null, shed);
    add(0.58, 0, z0, 0.58, 2.15, z0, INK, null, shed);
    add(-0.58, 2.15, z0, 0.58, 2.15, z0, INK, null, shed);
    add(x0, yE, z0, x0, 0, z0, INK, null, shed);
    add(x1, yE, z0, x1, 0, z0, INK, null, shed);
    var wins = [1.55, 4.15, 6.75];
    var wi, w, zs, ze, ys, ye, c, gz, gy;
    var pale = { w: 1, layer: "shed" };
    for (wi = 0; wi < wins.length; wi++) {
      w = wins[wi];
      zs = w - 0.62; ze = w + 0.62;
      ys = 1.05; ye = 2.35;
      add(x0, ys, zs, x0, ye, zs, PALE, null, pale);
      add(x0, ye, zs, x0, ye, ze, PALE, null, pale);
      add(x0, ye, ze, x0, ys, ze, PALE, null, pale);
      add(x0, ys, ze, x0, ys, zs, PALE, null, pale);
      for (c = 1; c <= 2; c++) {
        gz = zs + (ze - zs) * c / 3;
        add(x0, ys, gz, x0, ye, gz, PALE, null, pale);
      }
      gy = (ys + ye) * 0.5;
      add(x0, gy, zs, x0, gy, ze, PALE, null, pale);
    }
    var dw = 0.82, dh = 2.18, gap = 0.04;
    box(-gap - dw, 0, z1, -gap, dh, z1, INK, null, shed);
    box(gap, 0, z1, gap + dw, dh, z1, INK, null, shed);
    add(-gap - dw * 0.5, 1.05, z1, -gap - dw * 0.5, 1.12, z1 - 0.02, INK, null, shed);
    add(gap + dw * 0.5, 1.05, z1, gap + dw * 0.5, 1.12, z1 - 0.02, INK, null, shed);
    for (z = 0.35; z <= 8.95; z += 1.1) {
      add(x0, yE, z, 0, yR, z, INK, null, shed);
      add(0, yR, z, x1, yE, z, INK, null, shed);
      add(x0, 2.48, z, x1, 2.48, z, INK, null, shed);
    }
    add(0, yR, 0.2, 0, yR, 9.0, INK, null, shed);
    box(-1.95, 0, 6.95, -1.45, 0.5, 9.15, INK, null, shed);
    add(-1.95, 0.5, 6.95, -1.45, 0.42, 6.95, INK, null, shed);
    box(1.45, 0, 1.15, 2.15, 0.85, 2.95, INK, null, shed);
    add(1.45, 0.85, 1.15, 1.45, 0.85, 2.95, INK, null, shed);
    add(1.55, 0.85, 1.35, 2.05, 0.85, 1.35, INK, null, shed);
    add(1.55, 0.85, 2.75, 2.05, 0.85, 2.75, INK, null, shed);
    if (mode !== "upright") {
      box(0.22, 0.79, 2.4, 0.34, 0.91, 7.6, INK, null, shed);
      box(-0.34, 0.79, 2.4, -0.22, 0.91, 7.6, INK, null, shed);
      for (z = 2.7; z <= 7.4; z += 0.82) {
        add(-0.28, 0.85, z, 0.28, 0.85, z, INK, null, shed);
        add(-0.28, 0.79, z, -0.28, 0.91, z, INK, null, shed);
        add(0.28, 0.79, z, 0.28, 0.91, z, INK, null, shed);
      }
    }
  }

  function stemPoint(t, xOff) {
    var h = hullXY(0, t);
    var s = 0.04 * (1 - t);
    return [xOff, by(h.yOff), bz(s) + 0.04 * t];
  }

  function buildKeelStemTransom(withKeelRabbet) {
    var i, s, z, oak = { w: W_OAK };
    var nL = 20;
    var bot = [], port = [], stbd = [];
    for (i = 0; i <= nL; i++) {
      s = 0.02 + 0.96 * (i / nL);
      z = bz(s);
      bot.push([0, by(0), z]);
      port.push([-KW, by(0), z]);
      stbd.push([KW, by(0), z]);
    }
    poly(bot, OAK, "keel", oak);
    poly(port, OAK, "keel", oak);
    poly(stbd, OAK, "keel", oak);
    var nSt = 12;
    for (i = 0; i <= nSt; i++) {
      s = 0.04 + 0.92 * (i / nSt);
      z = bz(s);
      add(-KW, by(0), z, KW, by(0), z, OAK, "keel", oak);
      add(KW, by(0), z, KW, by(KEEL_H), z, OAK, "keel", oak);
      add(KW, by(KEEL_H), z, -KW, by(KEEL_H), z, OAK, "keel", oak);
      add(-KW, by(KEEL_H), z, -KW, by(0), z, OAK, "keel", oak);
    }
    if (withKeelRabbet) {
      var rab = { w: W_OAK };
      var rp = [], rs = [], rpi = [], rsi = [];
      var inset = 0.012;
      for (i = 0; i <= nL; i++) {
        s = 0.02 + 0.96 * (i / nL);
        z = bz(s);
        rp.push([-(KW - inset), by(inset), z]);
        rs.push([(KW - inset), by(inset), z]);
        rpi.push([-(KW - inset), by(0), z]);
        rsi.push([(KW - inset), by(0), z]);
      }
      poly(rp, OAK, "rabbet", rab);
      poly(rs, OAK, "rabbet", rab);
      poly(rpi, OAK, "rabbet", rab);
      poly(rsi, OAK, "rabbet", rab);
      for (i = 0; i <= nL; i += 2) {
        s = 0.02 + 0.96 * (i / nL);
        z = bz(s);
        add(-(KW), by(0), z, -(KW - inset), by(inset), z, OAK, "rabbet", rab);
        add(KW, by(0), z, (KW - inset), by(inset), z, OAK, "rabbet", rab);
      }
    }

    var faceL = [], faceR = [], rabL = [], rabR = [];
    var stemT, sp;
    for (i = 0; i <= 12; i++) {
      stemT = i / 12;
      sp = stemPoint(stemT, 0.018);
      faceL.push(stemPoint(stemT, -0.018));
      faceR.push(sp);
      rabL.push(stemPoint(stemT, -0.006));
      rabR.push(stemPoint(stemT, 0.006));
    }
    poly(faceL, OAK, "stem", oak);
    poly(faceR, OAK, "stem", oak);
    poly(rabL, OAK, "rabbet", oak);
    poly(rabR, OAK, "rabbet", oak);
    for (i = 0; i <= 12; i += 2) {
      stemT = i / 12;
      var a = stemPoint(stemT, -0.018);
      var b = stemPoint(stemT, 0.018);
      add(a[0], a[1], a[2], b[0], b[1], b[2], OAK, "stem", oak);
      var c = stemPoint(stemT, -0.006);
      var d = stemPoint(stemT, 0.006);
      add(c[0], c[1], c[2], d[0], d[1], d[2], OAK, "rabbet", oak);
    }
    var heel = stemPoint(0, 0);
    add(0, by(0), bz(0.02), heel[0], heel[1], heel[2], OAK, "stem", oak);

    var zt = bz(1);
    var zt2 = zt - 0.02;
    function transomRing(zz, lab) {
      var tpts = [];
      var k, tt, hh;
      for (k = 0; k <= 10; k++) {
        tt = k / 10;
        hh = hullXY(1, tt);
        tpts.push([-hh.x, by(hh.yOff), zz]);
      }
      for (k = 10; k >= 0; k--) {
        tt = k / 10;
        hh = hullXY(1, tt);
        tpts.push([hh.x, by(hh.yOff), zz]);
      }
      tpts.push(tpts[0]);
      poly(tpts, OAK, lab, oak);
    }
    transomRing(zt, "transom");
    transomRing(zt2, "transom");
    var corners = [0, 0.35, 0.7, 1];
    for (i = 0; i < corners.length; i++) {
      var hh = hullXY(1, corners[i]);
      add(-hh.x, by(hh.yOff), zt, -hh.x, by(hh.yOff), zt2, OAK, "transom", oak);
      add(hh.x, by(hh.yOff), zt, hh.x, by(hh.yOff), zt2, OAK, "transom", oak);
    }
    add(-hullXY(1, 1).x, by(hullXY(1, 1).yOff), zt, hullXY(1, 1).x, by(hullXY(1, 1).yOff), zt, OAK, "transom", oak);
    add(0, by(0), zt, 0, by(hullXY(1, 1).yOff), zt, OAK, "transom", oak);
  }

  function buildCase() {
    var s0 = 1.1 / LOA, s1 = 2.1 / LOA;
    var h = 0.28, w = 0.045;
    var y0 = by(0.02), y1 = by(h);
    var z0 = bz(s0), z1 = bz(s1);
    var extra = { w: W_OAK };
    var ymin = Math.min(y0, y1), ymax = Math.max(y0, y1);
    var zmin = Math.min(z0, z1), zmax = Math.max(z0, z1);
    box(-w, ymin, zmin, w, ymax, zmax, OAK, "centreboard case", extra);
    var iw = 0.012;
    add(-iw, y0, z0, -iw, y0, z1, OAK, "centreboard case", extra);
    add(iw, y0, z0, iw, y0, z1, OAK, "centreboard case", extra);
    add(-iw, y1, z0, -iw, y1, z1, OAK, "centreboard case", extra);
    add(iw, y1, z0, iw, y1, z1, OAK, "centreboard case", extra);
    add(-iw, y0, z0, -iw, y1, z0, OAK, "centreboard case", extra);
    add(iw, y0, z0, iw, y1, z0, OAK, "centreboard case", extra);
    add(-iw, y0, z1, -iw, y1, z1, OAK, "centreboard case", extra);
    add(iw, y0, z1, iw, y1, z1, OAK, "centreboard case", extra);
    add(0, y0, z0, 0, y0, z1, OAK, "centreboard case", extra);
  }

  function mouldOutline(s, inset, zOff) {
    var z = bz(s) + (zOff || 0);
    var n = 16;
    var i, t, p, side;
    var pts = [];
    for (i = n; i >= 2; i--) {
      t = i / n;
      p = inset ? ptIn(s, t, -1, 0.018) : pt(s, t, -1);
      pts.push([p[0], p[1], z]);
    }
    var ySeat = by(KEEL_H);
    var yTop = by(0);
    var xN = KW + (inset ? 0.018 : 0);
    var pShoulder = inset ? ptIn(s, 0.12, -1, 0.018) : pt(s, 0.12, -1);
    pts.push([pShoulder[0], pShoulder[1], z]);
    pts.push([-xN, yTop, z]);
    pts.push([-xN, ySeat, z]);
    pts.push([xN, ySeat, z]);
    pts.push([xN, yTop, z]);
    pShoulder = inset ? ptIn(s, 0.12, 1, 0.018) : pt(s, 0.12, 1);
    pts.push([pShoulder[0], pShoulder[1], z]);
    for (i = 2; i <= n; i++) {
      t = i / n;
      p = inset ? ptIn(s, t, 1, 0.018) : pt(s, t, 1);
      pts.push([p[0], p[1], z]);
    }
    return pts;
  }

  function buildMoulds(faint) {
    var color = faint ? GHOST : MOULD;
    var extra = { w: faint ? 0.85 : W_MOULD };
    var lab = faint ? null : "mould";
    var mi, s, z, z2, i, t, h, n, p0, p1;
    n = faint ? 10 : 16;
    for (mi = 1; mi <= 7; mi++) {
      s = mi / 8;
      z = bz(s);
      z2 = z + 0.018;
      if (faint) {
        var port = [], stbd = [];
        for (i = 0; i <= n; i++) {
          t = i / n;
          h = hullXY(s, t);
          port.push([-h.x, by(h.yOff), z]);
          stbd.push([h.x, by(h.yOff), z]);
        }
        poly(port, color, null, extra);
        poly(stbd, color, null, extra);
        continue;
      }
      var outer0 = mouldOutline(s, false, 0);
      var inner0 = mouldOutline(s, true, 0);
      var outer1 = mouldOutline(s, false, 0.018);
      var inner1 = mouldOutline(s, true, 0.018);
      poly(outer0, color, lab, extra);
      poly(inner0, color, lab, extra);
      poly(outer1, color, lab, extra);
      poly(inner1, color, lab, extra);
      var keys = [0, Math.floor(outer0.length / 4), Math.floor(outer0.length / 2), Math.floor(outer0.length * 3 / 4), outer0.length - 1];
      for (i = 0; i < keys.length; i++) {
        p0 = outer0[keys[i]];
        p1 = outer1[keys[i]];
        add(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], color, lab, extra);
        p0 = inner0[keys[i]];
        p1 = inner1[keys[i]];
        add(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], color, lab, extra);
      }
      var ySeat = by(KEEL_H);
      var yTop = by(0);
      var notch = { w: W_MOULD };
      add(-KW, yTop, z, -KW, ySeat, z, color, "notch", notch);
      add(-KW, ySeat, z, KW, ySeat, z, color, "notch", notch);
      add(KW, ySeat, z, KW, yTop, z, color, "notch", notch);
      add(-KW, yTop, z2, -KW, ySeat, z2, color, "notch", notch);
      add(-KW, ySeat, z2, KW, ySeat, z2, color, "notch", notch);
      add(KW, ySeat, z2, KW, yTop, z2, color, "notch", notch);
      add(-KW, ySeat, z, -KW, ySeat, z2, color, "notch", notch);
      add(KW, ySeat, z, KW, ySeat, z2, color, "notch", notch);
      add(-KW, yTop, z, -KW, yTop, z2, color, "notch", notch);
      add(KW, yTop, z, KW, yTop, z2, color, "notch", notch);
      add(-KW, yTop, z, KW, yTop, z, color, "notch", notch);
      for (i = 0; i < 3; i++) {
        t = [0.35, 0.58, 0.82][i];
        h = hullXY(s, t);
        add(-h.x, by(h.yOff), z, h.x, by(h.yOff), z, color, lab, extra);
      }
      var yk = by(0);
      add(0, yk, z, 0, 3.12, z, INK);
      add(0, yk, z, -1.1, 2.85, z, INK);
      add(0, yk, z, 1.1, 2.85, z, INK);
      squareMarker(0, by(KEEL_H * 0.45), z + 0.009, 0.04, COPPER, "notch");
    }
  }

  function buildRibbands() {
    var ts = [0.25, 0.45, 0.65, 0.85, 1.0];
    var extra = { w: W_RIB };
    var ti, t, side, i, s, n, pts, pts2, p;
    n = 16;
    for (ti = 0; ti < ts.length; ti++) {
      t = ts[ti];
      for (side = -1; side <= 1; side += 2) {
        pts = [];
        pts2 = [];
        for (i = 0; i <= n; i++) {
          s = i / n;
          p = pt(s, t, side);
          pts.push(p);
          pts2.push(alongT(s, t, side, 0.012));
        }
        poly(pts, RIBBAND, "ribband", extra);
        poly(pts2, RIBBAND, "ribband", extra);
      }
    }
  }

  function addCopperT(s, t, side, sparse) {
    var nrm = inboardN(s, t, side);
    var extra = { w: W_COP, sparse: !!sparse, si: copperI++, lod: !!sparse };
    var px = nrm.px, py = nrm.py, pz = nrm.pz;
    add(px, py, pz, px + nrm.x * 0.008, py + nrm.y * 0.008, pz, COPPER, "copper", extra);
    var cx = px + nrm.x * 0.008, cy = py + nrm.y * 0.008;
    add(cx, cy, pz - 0.003, cx, cy, pz + 0.003, COPPER, "copper", extra);
    if (!sparse) {
      var ox = px - nrm.x * 0.0006, oy = py - nrm.y * 0.0006, oz = pz;
      var hx = -nrm.y * 0.002, hy = nrm.x * 0.002, hz = 0.002;
      add(ox, oy, oz - hz, ox + hx, oy + hy, oz, COPPER, "copper", extra);
      add(ox + hx, oy + hy, oz, ox, oy, oz + hz, COPPER, "copper", extra);
      add(ox, oy, oz + hz, ox - hx, oy - hy, oz, COPPER, "copper", extra);
      add(ox - hx, oy - hy, oz, ox, oy, oz - hz, COPPER, "copper", extra);
    }
  }

  function buildPlanking() {
    var k, side, i, s, t, tLand, n = 14, ptsIn, ptsOut, p;
    var larch = { w: W_LARCH };
    var landEx = { w: W_LAND };
    var hatchEx = { w: W_LAND, lod: true };
    var STRAKE_DT = 0.022;
    for (k = 0; k < 12; k++) {
      t = k / 12;
      var labEdge = k === 0 ? "garboard" : (k === 11 ? "sheer" : null);
      for (side = -1; side <= 1; side += 2) {
        ptsIn = [];
        ptsOut = [];
        for (i = 0; i <= n; i++) {
          s = i / n;
          if (k === 0) {
            var inset = 0.012;
            ptsIn.push([side * (KW - inset), by(inset), bz(s)]);
          } else {
            ptsIn.push(pt(s, t, side));
          }
          ptsOut.push(pt(s, t + STRAKE_DT, side));
        }
        poly(ptsIn, LARCH, labEdge, larch);
        poly(ptsOut, LARCH, labEdge, larch);
      }
    }
    for (k = 0; k < 11; k++) {
      tLand = (k + 1) / 12;
      for (side = -1; side <= 1; side += 2) {
        var a = [], b = [];
        for (i = 0; i <= n; i++) {
          s = i / n;
          a.push(alongT(s, tLand, side, -0.004));
          b.push(alongT(s, tLand, side, 0.004));
        }
        poly(a, LAND, "land", landEx);
        poly(b, LAND, "land", landEx);
        for (s = 0.06; s <= 0.96; s += 0.24) {
          p = alongT(s, tLand, side, -0.004);
          var q = alongT(s, tLand, side, 0.004);
          add(p[0], p[1], p[2], q[0], q[1], q[2], LAND, "land", hatchEx);
        }
        var dist, step = 0.178 / 3;
        var ci = 0;
        for (dist = 0.12; dist <= LOA - 0.12; dist += step) {
          s = dist / LOA;
          addCopperT(s, tLand, side, (ci % 4) !== 0);
          ci++;
        }
      }
    }
    buildHoodEnds();
  }

  function buildHoodEnds() {
    var k, side, t, h, i, p0, p1, sp, extra = { w: W_LARCH };
    var cop = { w: W_COP };
    for (k = 0; k < 12; k++) {
      t = (k + 0.45) / 12;
      for (side = -1; side <= 1; side += 2) {
        h = hullXY(0.08, t);
        p0 = [side * h.x, by(h.yOff), bz(0.08)];
        sp = stemPoint(t, side * 0.006);
        p1 = [side * hullXY(0.04, t).x * 0.45, lerp(by(h.yOff), sp[1], 0.55), lerp(bz(0.08), sp[2], 0.55)];
        add(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], LARCH, "hood end", extra);
        add(p1[0], p1[1], p1[2], sp[0], sp[1], sp[2], LARCH, "hood end", extra);
        var p2 = stemPoint(Math.min(1, t + 0.03), side * 0.006);
        add(sp[0], sp[1], sp[2], p2[0], p2[1], p2[2], LARCH, "hood end", extra);
        addCopperT(0.055, t, side, (k % 4) !== 0);
        add(sp[0], sp[1], sp[2], sp[0] + side * 0.008, sp[1], sp[2], COPPER, "copper", cop);

        h = hullXY(0.96, t);
        var zt = bz(1);
        var zt2 = zt - 0.02;
        p0 = [side * h.x, by(h.yOff), bz(0.96)];
        var ht = hullXY(1, t);
        p1 = [side * ht.x, by(ht.yOff), zt];
        add(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], LARCH, "hood end", extra);
        add(p1[0], p1[1], p1[2], p1[0], p1[1], zt2, LARCH, "hood end", extra);
      }
    }
  }

  function timberDist(t) {
    var land = t * 11;
    var nearest = Math.round(land);
    var d = Math.abs(land - nearest);
    var base = 0.010;
    if (d < 0.14) return base + 0.006 * (1 - d / 0.14);
    return base;
  }

  function buildTimbers() {
    var i, dist, s, t, k, n = 10, ptsA, ptsB, p, extra = { w: 1.25 };
    var slot0 = 1.1 / LOA, slot1 = 2.1 / LOA;
    for (i = 0; i < 19; i++) {
      dist = 0.16 + i * 0.178;
      if (dist > LOA - 0.1) continue;
      s = dist / LOA;
      var t0 = 0.035;
      if (s > slot0 && s < slot1) t0 = 0.09;
      function rib(sideSign) {
        ptsA = [];
        ptsB = [];
        for (k = 0; k <= n; k++) {
          t = t0 + (1 - t0) * (k / n);
          p = ptIn(s, t, sideSign, timberDist(t));
          ptsA.push(p);
          ptsB.push(ptIn(s, t, sideSign, timberDist(t) + 0.016));
        }
        poly(ptsA, OAK, "timber", extra);
        poly(ptsB, OAK, "timber", extra);
        add(ptsA[n][0], ptsA[n][1], ptsA[n][2], ptsB[n][0], ptsB[n][1], ptsB[n][2], OAK, "gunwale", extra);
      }
      rib(-1);
      rib(1);
      if (i === 9) {
        var pH = ptIn(s, t0, 1, timberDist(t0));
        var pG = ptIn(s, t0, 1, timberDist(t0) + 0.008);
        add(pH[0], pH[1], pH[2], pG[0], pG[1], pG[2], OAK, "limber", extra);
        add(pH[0], pH[1], pH[2] - 0.008, pH[0], pH[1], pH[2] + 0.008, OAK, "limber", extra);
      }
    }
  }

  function buildGunwale() {
    var extra = { w: W_OAK };
    var n = 16, i, s, side, a, b;
    for (side = -1; side <= 1; side += 2) {
      var outer = [], inner = [], cap = [];
      for (i = 0; i <= n; i++) {
        s = i / n;
        outer.push(pt(s, 1, side));
        inner.push(ptIn(s, 1, side, 0.022));
        a = pt(s, 1, side);
        cap.push([a[0], a[1] + (inverted() ? -0.016 : 0.016), a[2]]);
      }
      poly(outer, OAK, "gunwale", extra);
      poly(inner, OAK, "gunwale", extra);
      poly(cap, OAK, "gunwale", extra);
      for (i = 0; i <= n; i += 4) {
        a = outer[i];
        b = inner[i];
        add(a[0], a[1], a[2], b[0], b[1], b[2], OAK, "gunwale", extra);
        add(a[0], a[1], a[2], cap[i][0], cap[i][1], cap[i][2], OAK, "gunwale", extra);
      }
    }
  }

  function buildInterior() {
    var extra = { w: W_OAK };
    var larch = { w: W_LARCH, lod: true };
    function thwart(sPos) {
      var hh = hullXY(sPos, 0.82);
      var y = by(hh.yOff);
      var z = bz(sPos);
      var z2 = z - 0.09;
      var x = hh.x * 0.92;
      add(-x, y, z, x, y, z, OAK, "thwart", extra);
      add(-x, y, z2, x, y, z2, OAK, "thwart", extra);
      add(-x, y, z, -x, y, z2, OAK, "thwart", extra);
      add(x, y, z, x, y, z2, OAK, "thwart", extra);
      var y2 = y + (inverted() ? 0.02 : -0.02);
      add(-x, y2, z, x, y2, z, OAK, "thwart", extra);
      knee(sPos, -1, x, y, z);
      knee(sPos, 1, x, y, z);
    }
    function knee(sPos, side, xw, y, z) {
      var h2 = hullXY(sPos, 0.62);
      var px = side * xw;
      var qx = side * h2.x * 0.97;
      var qy = by(h2.yOff);
      add(px, y, z, qx, qy, z, OAK, "knee", extra);
      add(px, y, z, px - side * 0.09, y, z, OAK, "knee", extra);
      add(px - side * 0.09, y, z, qx, qy, z, OAK, "knee", extra);
      add(px, y, z - 0.09, qx, qy, z - 0.09, OAK, "knee", extra);
      add(px, y, z, px, y, z - 0.09, OAK, "knee", extra);
      add(qx, qy, z, qx, qy, z - 0.09, OAK, "knee", extra);
    }
    thwart(0.40);
    thwart(0.63);

    var s = 0.42 / LOA;
    var h = hullXY(s, 0.78);
    var yb = by(h.yOff);
    var xw = h.x * 0.9;
    var z = bz(s);
    var z2 = z - 0.11;
    add(-xw, yb, z, xw, yb, z, OAK, "mast bench", extra);
    add(-xw, yb, z2, xw, yb, z2, OAK, "mast bench", extra);
    add(-xw, yb, z, -xw, yb, z2, OAK, "mast bench", extra);
    add(xw, yb, z, xw, yb, z2, OAK, "mast bench", extra);
    var a, nn = 12, r = 0.016, cx = 0, cz = (z + z2) * 0.5;
    var circ = [];
    for (a = 0; a <= nn; a++) {
      var ang = (a / nn) * Math.PI * 2;
      circ.push([cx + Math.cos(ang) * r, yb + 0.002, cz + Math.sin(ang) * r]);
    }
    poly(circ, OAK, "mast bench", extra);

    var hb = hullXY(0.07, 0.88);
    var ybk = by(hb.yOff);
    add(-hb.x * 0.72, ybk, bz(0.08), 0, ybk, bz(0.015), OAK, "breasthook", extra);
    add(hb.x * 0.72, ybk, bz(0.08), 0, ybk, bz(0.015), OAK, "breasthook", extra);
    add(-hb.x * 0.72, ybk, bz(0.08), hb.x * 0.72, ybk, bz(0.08), OAK, "breasthook", extra);
    var ybk2 = ybk + (inverted() ? 0.016 : -0.016);
    add(-hb.x * 0.65, ybk2, bz(0.075), 0, ybk2, bz(0.02), OAK, "breasthook", extra);
    add(hb.x * 0.65, ybk2, bz(0.075), 0, ybk2, bz(0.02), OAK, "breasthook", extra);

    var yf = by(0.05);
    function floorPlank(x0, x1, s0, s1) {
      var za = bz(s0), zb = bz(s1);
      add(x0, yf, za, x1, yf, za, LARCH, null, larch);
      add(x0, yf, zb, x1, yf, zb, LARCH, null, larch);
      add(x0, yf, za, x0, yf, zb, LARCH, null, larch);
      add(x1, yf, za, x1, yf, zb, LARCH, null, larch);
    }
    floorPlank(-0.30, -0.14, 0.28, 0.72);
    floorPlank(0.14, 0.30, 0.28, 0.72);
    floorPlank(-0.08, 0.08, 0.58, 0.78);

    var zt = bz(1);
    var yk = by(0);
    var ys = by(0.32);
    var down = inverted() ? 0.12 : -0.12;
    add(0, yk, zt, 0, yk + down, zt - 0.32, OAK, null, extra);
    add(0, ys, zt, 0, yk + down, zt - 0.32, OAK, null, extra);
    add(-0.02, yk, zt, -0.02, ys, zt, OAK, null, extra);
    add(0.02, yk, zt, 0.02, ys, zt, OAK, null, extra);
    add(-0.12, yk, zt - 0.08, 0.12, yk, zt - 0.08, OAK, null, extra);
    add(-0.12, ys, zt - 0.08, 0.12, ys, zt - 0.08, OAK, null, extra);
    add(-0.12, yk, zt - 0.08, -0.12, ys, zt - 0.08, OAK, null, extra);
    add(0.12, yk, zt - 0.08, 0.12, ys, zt - 0.08, OAK, null, extra);
    add(-0.12, yk + down * 0.65, zt - 0.32, 0.12, yk + down * 0.65, zt - 0.32, OAK, null, extra);
  }

  function buildChocks() {
    box(-0.12, 0, bz(0.28) - 0.08, 0.12, KEEL_UP, bz(0.28) + 0.08, INK);
    box(-0.12, 0, bz(0.72) - 0.08, 0.12, KEEL_UP, bz(0.72) + 0.08, INK);
  }

  function buildHogApronScarf() {
    var i, s, z, oak = { w: W_OAK };
    var hw = 0.02;
    var hogH = 0.028;
    var y0 = by(KEEL_H);
    var y1 = by(KEEL_H + hogH);
    var nL = 10;
    var port = [], stbd = [], topP = [], topS = [];
    for (i = 0; i <= nL; i++) {
      s = 0.03 + 0.94 * (i / nL);
      z = bz(s);
      port.push([-hw, y0, z]);
      stbd.push([hw, y0, z]);
      topP.push([-hw, y1, z]);
      topS.push([hw, y1, z]);
    }
    poly(port, OAK, "hog", oak);
    poly(stbd, OAK, "hog", oak);
    poly(topP, OAK, "hog", oak);
    poly(topS, OAK, "hog", oak);
    for (i = 0; i <= nL; i += 4) {
      s = 0.03 + 0.94 * (i / nL);
      z = bz(s);
      add(-hw, y0, z, hw, y0, z, OAK, "hog", oak);
      add(-hw, y1, z, hw, y1, z, OAK, "hog", oak);
      add(-hw, y0, z, -hw, y1, z, OAK, "hog", oak);
      add(hw, y0, z, hw, y1, z, OAK, "hog", oak);
    }

    var faceL = [], faceR = [];
    var stemT, sl, sr;
    for (i = 0; i <= 12; i++) {
      stemT = i / 12;
      sl = stemPoint(stemT, -0.014);
      sr = stemPoint(stemT, 0.014);
      faceL.push([sl[0], sl[1], sl[2] - 0.02]);
      faceR.push([sr[0], sr[1], sr[2] - 0.02]);
    }
    poly(faceL, OAK, "apron", oak);
    poly(faceR, OAK, "apron", oak);
    for (i = 0; i <= 12; i += 3) {
      add(faceL[i][0], faceL[i][1], faceL[i][2], faceR[i][0], faceR[i][1], faceR[i][2], OAK, "apron", oak);
    }

    var xS = 0.024;
    var zs = [bz(0.035), bz(0.05), bz(0.05), bz(0.065), bz(0.065), bz(0.08)];
    var ys = [by(0), by(0), by(KEEL_H * 0.45), by(KEEL_H * 0.45), by(KEEL_H + hogH), by(KEEL_H + hogH)];
    var scarfEx = { w: W_OAK };
    var side, j;
    for (side = -1; side <= 1; side += 2) {
      for (j = 1; j < zs.length; j++) {
        add(side * xS, ys[j - 1], zs[j - 1], side * xS, ys[j], zs[j], OAK, "scarf", scarfEx);
      }
    }
    var zsw = bz(0.057);
    var ysw = by(KEEL_H * 0.45);
    add(-0.01, ysw, zsw, 0.01, ysw, zsw, COPPER, "scarf", { w: W_COP });
    add(0, ysw - 0.006, zsw, 0, ysw + 0.006, zsw, COPPER, "scarf", { w: W_COP });
  }

  function buildTransomKnee() {
    var extra = { w: mode === "upright" ? W_OAK : 0.9 };
    var zt = bz(1);
    var yk = by(0);
    var yTop = by(0.20);
    var zFwd = bz(0.90);
    var lab = "transom knee";
    var x = 0.012;
    add(x, yk, zt, x, yTop, zt, OAK, lab, extra);
    add(x, yk, zt, x, yk, zFwd, OAK, lab, extra);
    add(x, yTop, zt, x, yk, zFwd, OAK, lab, extra);
    if (mode === "upright") {
      add(-x, yk, zt, -x, yTop, zt, OAK, lab, extra);
      add(-x, yk, zt, -x, yk, zFwd, OAK, lab, extra);
      add(-x, yTop, zt, -x, yk, zFwd, OAK, lab, extra);
      add(x, yTop, zt, -x, yTop, zt, OAK, lab, extra);
      add(x, yk, zFwd, -x, yk, zFwd, OAK, lab, extra);
      var zt2 = zt - 0.02;
      add(x, yTop, zt, x, yTop, zt2, OAK, lab, extra);
      add(-x, yTop, zt, -x, yTop, zt2, OAK, lab, extra);
    }
  }

  function buildRowlocks() {
    var extra = { w: 1.35 };
    var ss = [0.38, 0.62];
    var si, side, s, p, up, out, x, y, z;
    for (si = 0; si < ss.length; si++) {
      s = ss[si];
      for (side = -1; side <= 1; side += 2) {
        p = pt(s, 1, side);
        up = inverted() ? -0.018 : 0.018;
        out = side * 0.012;
        x = p[0]; y = p[1]; z = p[2];
        add(x, y, z - 0.012, x + out, y, z - 0.012, INK, "rowlock", extra);
        add(x, y, z + 0.012, x + out, y, z + 0.012, INK, "rowlock", extra);
        add(x + out, y, z - 0.012, x + out, y + up, z - 0.012, INK, "rowlock", extra);
        add(x + out, y, z + 0.012, x + out, y + up, z + 0.012, INK, "rowlock", extra);
        add(x + out, y + up, z - 0.012, x + out, y + up, z + 0.012, INK, "rowlock", extra);
      }
    }
  }

  function buildSpecDimensions() {
    var extra = { w: 0.8 };
    var tick = 0.018;
    function specAdd(x0, y0, z0, x1, y1, z1) {
      add(x0, y0, z0, x1, y1, z1, INK, "spec", extra);
    }
    var xL = KW + 0.05;
    var yL = by(-0.02);
    var zStem = bz(0);
    var zTr = bz(1);
    specAdd(xL, yL, zStem, xL, yL, zTr);
    specAdd(xL, yL - tick, zStem, xL, yL + tick, zStem);
    specAdd(xL, yL - tick, zTr, xL, yL + tick, zTr);
    tag(xL + 0.02, yL, bz(0.5), "12′–0″ LOA", "spec");

    var sB = 0.55;
    var hB = hullXY(sB, 1);
    var yB = by(hB.yOff);
    var zB = bz(sB);
    specAdd(0.02, yB, zB, hB.x, yB, zB);
    specAdd(0.02, yB - tick, zB, 0.02, yB + tick, zB);
    specAdd(hB.x, yB - tick, zB, hB.x, yB + tick, zB);
    tag(hB.x * 0.55, yB, zB, "4′–8″ beam", "spec");

    var sD = 0.5;
    var hD = hullXY(sD, 1);
    var xD = hD.x + 0.04;
    specAdd(xD, by(0), bz(sD), xD, by(hD.yOff), bz(sD));
    specAdd(xD - tick, by(0), bz(sD), xD + tick, by(0), bz(sD));
    specAdd(xD - tick, by(hD.yOff), bz(sD), xD + tick, by(hD.yOff), bz(sD));
    tag(xD + 0.03, by(hD.yOff * 0.5), bz(sD), "1′–8½″", "spec");

    var s0 = 1.1 / LOA, s1 = 2.1 / LOA;
    var yC = by(0.30);
    specAdd(0.06, yC, bz(s0), 0.06, yC, bz(s1));
    specAdd(0.06 - tick * 0.6, yC, bz(s0), 0.06 + tick * 0.6, yC, bz(s0));
    specAdd(0.06 - tick * 0.6, yC, bz(s1), 0.06 + tick * 0.6, yC, bz(s1));
    tag(0.08, yC, bz((s0 + s1) * 0.5), "slot 1000 mm", "spec");

    var sM = 0.42 / LOA;
    var yM = by(-0.045);
    specAdd(xL, yM, bz(0), xL, yM, bz(sM));
    specAdd(xL, yM - tick * 0.7, bz(0), xL, yM + tick * 0.7, bz(0));
    specAdd(xL, yM - tick * 0.7, bz(sM), xL, yM + tick * 0.7, bz(sM));
    tag(xL + 0.03, yM, bz(sM * 0.5), "420 mm from stem", "spec");

    if (mode === "upright") {
      var d0 = 0.16 + 9 * 0.178;
      var d1 = d0 + 0.178;
      var sT0 = d0 / LOA, sT1 = d1 / LOA;
      var hT = hullXY((sT0 + sT1) * 0.5, 0.55);
      var xT = hT.x + 0.03;
      var yT = by(hT.yOff);
      specAdd(xT, yT, bz(sT0), xT, yT, bz(sT1));
      specAdd(xT, yT - tick * 0.5, bz(sT0), xT, yT + tick * 0.5, bz(sT0));
      specAdd(xT, yT - tick * 0.5, bz(sT1), xT, yT + tick * 0.5, bz(sT1));
      tag(xT + 0.02, yT, bz((sT0 + sT1) * 0.5), "7″ centres", "spec");
    }
    if (mode === "planked" || mode === "upright") {
      var tLand = 5 / 12;
      var pL0 = alongT(0.48, tLand, 1, -0.0095);
      var pL1 = alongT(0.48, tLand, 1, 0.0095);
      specAdd(pL0[0], pL0[1], pL0[2], pL1[0], pL1[1], pL1[2]);
      specAdd(pL0[0], pL0[1], pL0[2] - 0.008, pL0[0], pL0[1], pL0[2] + 0.008);
      specAdd(pL1[0], pL1[1], pL1[2] - 0.008, pL1[0], pL1[1], pL1[2] + 0.008);
      tag((pL0[0] + pL1[0]) * 0.5 + 0.02, (pL0[1] + pL1[1]) * 0.5, pL0[2], "¾″ land", "spec");

      var pP0 = alongT(0.52, 6 / 12, 1, 0);
      var pP1 = alongT(0.52, 6 / 12, 1, 0.008);
      specAdd(pP0[0], pP0[1], pP0[2], pP1[0], pP1[1], pP1[2]);
      specAdd(pP0[0], pP0[1], pP0[2] - 0.006, pP0[0], pP0[1], pP0[2] + 0.006);
      specAdd(pP1[0], pP1[1], pP1[2] - 0.006, pP1[0], pP1[1], pP1[2] + 0.006);
      tag((pP0[0] + pP1[0]) * 0.5 + 0.02, (pP0[1] + pP1[1]) * 0.5, pP0[2], "⁵⁄₁₆″ plank", "spec");
    }
  }

  function buildBoat() {
    copperI = 0;
    var withRabbet = mode !== "skeleton";
    buildKeelStemTransom(withRabbet);
    buildHogApronScarf();
    buildCase();
    buildTransomKnee();
    if (mode === "skeleton") {
      buildMoulds(false);
      buildRibbands();
    } else if (mode === "planked") {
      buildMoulds(true);
      buildPlanking();
    } else {
      buildPlanking();
      buildTimbers();
      buildGunwale();
      buildRowlocks();
      buildInterior();
      buildChocks();
    }
    buildSpecDimensions();
  }

  function tagKind(text, kind) {
    if (kind === null) return null;
    if (text.indexOf("mould") === 0) return "mould";
    if (text.indexOf("strake") === 0) return "land";
    if (text.indexOf("timber") === 0) return "timber";
    if (text.indexOf("copper") === 0) return "copper";
    if (text.indexOf("strongback") === 0) return null;
    return kind === undefined ? text : kind;
  }
  function tag(x, y, z, text, kind) {
    tags.push({ x: x, y: y, z: z, text: text, kind: tagKind(text, kind) });
  }
  function strakeT(k) { return (k + 0.5) / 12; }
  function placeTags() {
    var p, mi, k, i, s, dist, h, ks, tims, ti;
    tag(0, keelY(), bz(0.5), "keel");
    p = stemPoint(0.55, 0.04);
    tag(p[0], p[1], p[2], "stem");
    tag(0.2, by(0.25), bz(1), "transom");
    tag(0.08, by(0.14), bz(1.6 / LOA), "centreboard case");
    tag(KW + 0.02, by(0.015), bz(0.45), "rabbet");
    tag(0.03, by(KEEL_H + 0.012), bz(0.45), "hog");
    p = stemPoint(0.42, 0.04);
    tag(p[0], p[1], p[2] - 0.03, "apron");
    tag(0.04, by(KEEL_H * 0.4), bz(0.06), "scarf");
    tag(0.04, by(0.14), bz(0.94), "transom knee");
    if (mode === "skeleton") {
      for (mi = 1; mi <= 7; mi++) {
        p = pt(mi / 8, 1, 1);
        tag(p[0] + 0.05, p[1], p[2], "mould " + mi + " · sta. " + (2 * mi), "mould");
      }
      p = pt(0.5, 1.0, 1);
      tag(p[0] + 0.04, p[1], p[2], "ribband");
    }
    if (inverted()) {
      tag(0.4, 0.85, 4.2, "strongback", null);
    }
    if (mode === "planked" || mode === "upright") {
      p = pt(0.45, strakeT(0), 1);
      tag(p[0] + 0.03, p[1], p[2], "garboard");
      p = pt(0.5, strakeT(4), 1);
      tag(p[0] + 0.03, p[1], p[2], "land");
      ks = [2, 5, 8, 11];
      for (i = 0; i < ks.length; i++) {
        k = ks[i];
        p = pt(0.42, strakeT(k), 1);
        tag(p[0] + 0.03, p[1], p[2], "strake " + (k + 1), "land");
      }
      p = pt(0.04, 0.35, 1);
      tag(p[0] + 0.03, p[1], p[2], "hood end");
      p = pt(0.5, 1, 1);
      tag(p[0] + 0.04, p[1], p[2], "sheer strake", "sheer");
      p = pt(0.5, 5 / 12, 1);
      tag(p[0] + 0.02, p[1], p[2], "No. 14 copper", "copper");
    }
    if (mode === "upright") {
      tims = [1, 6, 10, 15, 19];
      for (i = 0; i < tims.length; i++) {
        ti = tims[i];
        dist = 0.16 + (ti - 1) * 0.178;
        if (dist > LOA - 0.1) continue;
        s = dist / LOA;
        p = ptIn(s, 0.5, 1, timberDist(0.5));
        tag(p[0] + 0.03, p[1], p[2], "timber " + ti, "timber");
      }
      p = pt(0.38, 1, 1);
      tag(p[0] + 0.03, p[1], p[2], "rowlock");
      p = ptIn((0.16 + 9 * 0.178) / LOA, 0.04, 1, timberDist(0.04));
      tag(p[0] + 0.02, p[1], p[2], "limber");
      p = pt(0.5, 1, 1);
      tag(p[0] + 0.04, p[1], p[2], "gunwale");
      s = 0.42 / LOA;
      h = hullXY(s, 0.78);
      tag(h.x * 0.45, by(h.yOff), bz(s), "mast bench");
      h = hullXY(0.40, 0.82);
      tag(h.x * 0.35, by(h.yOff), bz(0.40), "thwart");
      tag(h.x * 0.92, by(h.yOff), bz(0.40), "knee");
      h = hullXY(0.07, 0.88);
      tag(0.08, by(h.yOff), bz(0.05), "breasthook");
      tag(0.22, by(0.05), bz(0.5), "floorboards");
    }
  }

  function buildGeom() {
    geom = [];
    tags = [];
    buildShed();
    buildBoat();
    placeTags();
  }

  function toCam(x, y, z) {
    var dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    var x1 = dx * cy - dz * sy;
    var z1 = dx * sy + dz * cy;
    var y1 = dy;
    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    return {
      x: x1,
      y: y1 * cp - z1 * sp,
      z: y1 * sp + z1 * cp
    };
  }

  function distToSeg(px, py, x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0;
    var l2 = dx * dx + dy * dy;
    if (l2 < 1e-8) return Math.hypot(px - x0, py - y0);
    var t = ((px - x0) * dx + (py - y0) * dy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
  }

  function resize() {
    if (!overlay || !canvas) return;
    var dpr = window.devicePixelRatio || 1;
    cssW = overlay.clientWidth;
    cssH = overlay.clientHeight;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clampCam() {
    cam.x = clamp(cam.x, -2.15 + 0.25, 2.15 - 0.25);
    cam.z = clamp(cam.z, 0.25, 9.2 - 0.25);
    cam.y = clamp(cam.y, 0.4, 2.7);
  }

  function lookXZ() {
    return { x: Math.sin(cam.yaw), z: Math.cos(cam.yaw) };
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
    lastT = now;
    var sprint = down.shift ? 2 : 1;
    var sp = 1.8 * sprint;
    var vsp = 0.7 * sprint;
    var L = lookXZ();
    var rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    var mx = 0, mz = 0, my = 0;
    if (down.w) { mx += L.x; mz += L.z; }
    if (down.s) { mx -= L.x; mz -= L.z; }
    if (down.d) { mx += rx; mz += rz; }
    if (down.a) { mx -= rx; mz -= rz; }
    if (down.q || down.space) my += vsp;
    if (down.e || down.c) my -= vsp;
    var len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      cam.x += mx * sp * dt;
      cam.z += mz * sp * dt;
    }
    cam.y += my * dt;
    clampCam();
    draw();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setCallout(label, displayText) {
    if (!calloutEl) return;
    var key = label ? label + "\t" + (displayText || "") : "";
    if (key === lastHover) return;
    lastHover = key;
    if (!label) {
      calloutEl.style.opacity = "0.55";
      calloutEl.innerHTML =
        '<div style="font-size:0.85rem;line-height:1.45;color:#5c5348;">' + HINT + "</div>";
      return;
    }
    calloutEl.style.opacity = "1";
    var src = PLATE_SRC[label];
    var copy = COPY[label] || "";
    var kicker = displayText || label;
    var html = "";
    if (src) {
      html += '<img src="' + src + '" alt="" style="display:block;width:100%;max-width:280px;height:auto;object-fit:contain;border:1px solid #d4cbb8;margin:0 0 0.75rem;">';
    }
    html += '<div style="font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:#5c5348;margin-bottom:0.45rem;">' + escapeHtml(kicker) + "</div>";
    html += '<div style="font-size:0.95rem;line-height:1.5;color:#3c352c;">' + escapeHtml(copy) + "</div>";
    calloutEl.innerHTML = html;
  }

  function draw() {
    var w = cssW, h = cssH;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    var foc0 = 0.72 * Math.min(w, h);
    var cx = w * 0.5, cy = h * 0.5;
    var drawn = [];
    var i, g, a, b, p0, p1, t, depth, sx0, sy0, sx1, sy1, f0, f1;
    for (i = 0; i < geom.length; i++) {
      g = geom[i];
      a = toCam(g.x0, g.y0, g.z0);
      b = toCam(g.x1, g.y1, g.z1);
      if (a.z < NEAR && b.z < NEAR) continue;
      p0 = a; p1 = b;
      if (a.z < NEAR) {
        t = (NEAR - a.z) / (b.z - a.z);
        p0 = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR };
      } else if (b.z < NEAR) {
        t = (NEAR - a.z) / (b.z - a.z);
        p1 = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR };
      }
      depth = (p0.z + p1.z) * 0.5;
      var mx = (g.x0 + g.x1) / 2, my = (g.y0 + g.y1) / 2, mz = (g.z0 + g.z1) / 2;
      var layer = g.layer || "boat";
      if (layer === "boat" && isFarSide(mx)) continue;
      if (layer === "shed") {
        if (g.lod && depth > 3.5) continue;
        if (!g.lod && depth > 8) continue;
      } else if (g.lod && depth > 5) continue;
      if (g.sparse && depth > 3.2 && (g.si % 4)) continue;
      f0 = foc0 / p0.z;
      f1 = foc0 / p1.z;
      sx0 = cx + p0.x * f0;
      sy0 = cy - p0.y * f0;
      sx1 = cx + p1.x * f1;
      sy1 = cy - p1.y * f1;
      drawn.push({
        sx0: sx0, sy0: sy0, sx1: sx1, sy1: sy1,
        depth: depth, color: g.color, label: g.label, w: g.w,
        mx: mx, my: my, mz: mz, layer: layer
      });
    }
    drawn.sort(function (p, q) { return q.depth - p.depth; });
    hoverDrawn = drawn;
    var lastC = "", lastW = -1, col, lw, fade;
    ctx.globalAlpha = 1;
    for (i = 0; i < drawn.length; i++) {
      g = drawn[i];
      fade = clamp(g.depth / 9, 0, 0.65);
      col = mixHex(g.color, PAPER, fade);
      lw = g.w;
      if (g.layer === "shed") {
        col = mixHex(col, PAPER, 0.55);
        lw = g.w * 0.7;
      }
      if (col !== lastC) {
        ctx.strokeStyle = col;
        lastC = col;
      }
      if (lw !== lastW) {
        ctx.lineWidth = lw;
        lastW = lw;
      }
      ctx.beginPath();
      ctx.moveTo(g.sx0, g.sy0);
      ctx.lineTo(g.sx1, g.sy1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawTags();
    var lab = null, labText = null;
    if (!dragging && mouse.x > 0) {
      var best = 16, d, hit;
      for (i = 0; i < tagHits.length; i++) {
        hit = tagHits[i];
        if (!hit.kind) continue;
        d = distToRect(mouse.x, mouse.y, hit.chipX, hit.chipY, hit.chipW, hit.chipH);
        if (d < 14 && d < best) {
          best = d;
          lab = hit.kind;
          labText = hit.text;
        }
      }
      if (!lab) {
        for (i = 0; i < drawn.length; i++) {
          g = drawn[i];
          if (!g.label) continue;
          d = distToSeg(mouse.x, mouse.y, g.sx0, g.sy0, g.sx1, g.sy1);
          if (d < best) { best = d; lab = g.label; labText = g.label; }
        }
      }
      if (labText) {
        ctx.font = '13px Palatino, "Palatino Linotype", Georgia, serif';
        ctx.fillStyle = INK;
        ctx.textBaseline = "bottom";
        ctx.textAlign = "left";
        ctx.fillText(labText, mouse.x + 12, mouse.y - 6);
      }
    }
    if (!dragging) setCallout(lab, labText);
  }

  function distToRect(px, py, x, y, w, h) {
    var dx = 0, dy = 0;
    if (px < x) dx = x - px;
    else if (px > x + w) dx = px - (x + w);
    if (py < y) dy = y - py;
    else if (py > y + h) dy = py - (y + h);
    return Math.hypot(dx, dy);
  }

  function roundishRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTags() {
    var foc0 = 0.72 * Math.min(cssW, cssH);
    var cx = cssW * 0.5, cy = cssH * 0.5;
    var vis = [], i, j, t, c, f, sx, sy, ok, dx, dy, v, text, tw, padX, padY, chipX, chipY, chipW, chipH;
    tagHits = [];
    for (i = 0; i < tags.length; i++) {
      t = tags[i];
      if (isFarSide(t.x)) continue;
      c = toCam(t.x, t.y, t.z);
      if (c.z < 0.4 || c.z > 6.8) continue;
      f = foc0 / c.z;
      sx = cx + c.x * f;
      sy = cy - c.y * f;
      vis.push({ tag: t, sx: sx, sy: sy, z: c.z });
    }
    vis.sort(function (a, b) { return a.z - b.z; });
    var kept = [];
    for (i = 0; i < vis.length; i++) {
      ok = true;
      for (j = 0; j < kept.length; j++) {
        dx = vis[i].sx - kept[j].sx;
        dy = vis[i].sy - kept[j].sy;
        if (dx * dx + dy * dy < 22 * 22) { ok = false; break; }
      }
      if (ok) kept.push(vis[i]);
      if (kept.length >= 18) break;
    }
    kept.sort(function (a, b) { return b.z - a.z; });
    ctx.font = '12px Palatino, "Palatino Linotype", Georgia, serif';
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (i = 0; i < kept.length; i++) {
      v = kept[i];
      text = v.tag.text;
      tw = ctx.measureText(text).width;
      padX = 5;
      padY = 4;
      chipW = tw + padX * 2;
      chipH = 12 + padY * 2;
      chipX = v.sx + 10;
      chipY = v.sy - chipH * 0.5;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COPPER;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(v.sx, v.sy);
      ctx.lineTo(chipX, v.sy);
      ctx.stroke();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = PAPER;
      roundishRect(chipX, chipY, chipW, chipH, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#d4cbb8";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#3c352c";
      ctx.fillText(text, chipX + padX, chipY + chipH * 0.5);
      tagHits.push({
        kind: v.tag.kind,
        text: v.tag.text,
        chipX: chipX,
        chipY: chipY,
        chipW: chipW,
        chipH: chipH,
        z: v.z
      });
    }
    ctx.globalAlpha = 1;
  }

  function keyOf(e) {
    if (e.key === " ") return "space";
    if (e.key === "Shift") return "shift";
    if (e.key === "Escape") return "escape";
    if (e.key.length === 1) return e.key.toLowerCase();
    return e.key.toLowerCase();
  }

  function runClose() {
    var cb = onCloseCb;
    close();
    if (cb) cb();
  }

  function onKeyDown(e) {
    e.stopPropagation();
    var k = keyOf(e);
    if (k === "escape") {
      e.preventDefault();
      runClose();
      return;
    }
    down[k] = true;
    if ("wasdqe c".indexOf(k) >= 0 || k === "space" || k === "shift") e.preventDefault();
  }
  function onKeyUp(e) {
    e.stopPropagation();
    down[keyOf(e)] = false;
  }
  function onClick(e) { e.stopPropagation(); }
  function onPtrDown(e) {
    if (e.button !== 0) return;
    dragging = true;
    lastPX = e.clientX;
    lastPY = e.clientY;
    canvas.style.cursor = "grabbing";
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function onPtrMove(e) {
    var rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    if (!dragging) return;
    var dx = e.clientX - lastPX;
    var dy = e.clientY - lastPY;
    lastPX = e.clientX;
    lastPY = e.clientY;
    cam.yaw += dx * 0.005;
    cam.pitch = clamp(cam.pitch - dy * 0.004, -0.9, 0.9);
  }
  function onPtrUp(e) {
    dragging = false;
    canvas.style.cursor = "grab";
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  function onWheel(e) {
    e.preventDefault();
    e.stopPropagation();
    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    var lx = Math.sin(cam.yaw) * cp;
    var ly = sp;
    var lz = Math.cos(cam.yaw) * cp;
    var step = -e.deltaY * 0.0016;
    cam.x += lx * step;
    cam.y += ly * step;
    cam.z += lz * step;
    clampCam();
  }
  function onResize() { resize(); }

  function close() {
    if (!overlay) return;
    cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("resize", onResize);
    overlay.removeEventListener("click", onClick, true);
    overlay.removeEventListener("wheel", onWheel);
    if (canvas) {
      canvas.removeEventListener("pointerdown", onPtrDown);
      canvas.removeEventListener("pointermove", onPtrMove);
      canvas.removeEventListener("pointerup", onPtrUp);
      canvas.removeEventListener("pointercancel", onPtrUp);
    }
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    canvas = null;
    ctx = null;
    calloutEl = null;
    down = {};
    dragging = false;
    lastHover = "__init__";
  }

  function preloadPlates() {
    var srcs = [
      "img/joint-mould.jpg",
      "img/joint-rabbet.jpg",
      "img/joint-land.jpg",
      "img/joint-hood.jpg",
      "img/joint-timber.jpg"
    ];
    var i, im;
    for (i = 0; i < srcs.length; i++) {
      if (plateCache[srcs[i]]) continue;
      im = new Image();
      im.src = srcs[i];
      plateCache[srcs[i]] = im;
    }
  }

  function open(m, onClose) {
    if (overlay) close();
    mode = (m === "planked" || m === "upright") ? m : "skeleton";
    onCloseCb = typeof onClose === "function" ? onClose : null;
    cam = { x: 0.55, y: 1.42, z: 2.55, yaw: 0.18, pitch: -0.08 };
    down = {};
    lastT = 0;
    lastHover = "__init__";
    preloadPlates();
    overlay = document.createElement("div");
    overlay.setAttribute("data-shed-explore", "1");
    overlay.tabIndex = 0;
    overlay.style.cssText = "position:fixed;inset:0;z-index:40;background:#f3eee4;outline:none;";
    overlay.innerHTML =
      '<canvas style="position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none;"></canvas>' +
      '<div data-callout style="position:absolute;left:1.2rem;top:10%;width:min(280px,32vw);pointer-events:none;z-index:2;font-family:Palatino,\'Palatino Linotype\',\'Book Antiqua\',Georgia,serif;"></div>' +
      '<div style="position:absolute;left:0;right:0;bottom:0;display:grid;grid-template-columns:1fr auto 1fr;gap:1rem;align-items:end;padding:1rem 1.4rem 1.15rem;font-family:Palatino,\'Palatino Linotype\',\'Book Antiqua\',Georgia,serif;color:#5c5348;pointer-events:none;background:linear-gradient(transparent,rgba(243,238,228,0.94) 45%);">' +
      '<div style="justify-self:start;font-size:0.95rem;">' + (CAPTION[mode] || "") + '</div>' +
      '<div style="justify-self:center;font-size:0.72rem;letter-spacing:0.03em;opacity:0.9;">drag to look · WASD to walk · scroll to come close</div>' +
      '<button type="button" data-back style="justify-self:end;pointer-events:auto;background:none;border:none;cursor:pointer;font-family:inherit;font-size:0.95rem;color:#9a5c38;padding:0;">Back to the doorway</button>' +
      "</div>";
    canvas = overlay.querySelector("canvas");
    ctx = canvas.getContext("2d");
    calloutEl = overlay.querySelector("[data-callout]");
    overlay.querySelector("[data-back]").addEventListener("click", function (e) {
      e.stopPropagation();
      runClose();
    });
    document.body.appendChild(overlay);
    overlay.focus();
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("resize", onResize);
    overlay.addEventListener("click", onClick, true);
    overlay.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPtrDown);
    canvas.addEventListener("pointermove", onPtrMove);
    canvas.addEventListener("pointerup", onPtrUp);
    canvas.addEventListener("pointercancel", onPtrUp);
    buildGeom();
    resize();
    setCallout(null);
    raf = requestAnimationFrame(tick);
  }

  function isOpen() { return !!overlay; }

  window.ShedExplore = { open: open, close: close, isOpen: isOpen };
})();
