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
    breasthook: "The bow, closed."
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
    knee: "img/joint-timber.jpg"
  };
  var HINT = "Walk up to a meeting — land, rabbet, mould, hood end.";
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
  var hoverDrawn = [];
  var cssW = 1;
  var cssH = 1;
  var lastHover = "__init__";
  var copperI = 0;
  var plateCache = {};

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
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
      si: extra.si || 0
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
    var z, x, extraLod = { lod: true, w: 1 };
    for (z = 0; z <= z1 + 0.001; z += 0.18) {
      add(x0, 0, z, x1, 0, z, INK, null, extraLod);
    }
    for (x = -1.65; x <= 1.66; x += 0.55) {
      add(x, 0, z0, x, 0, z1, INK, null, extraLod);
    }
    add(x0, 0, z0, x0, yE, z0, INK);
    add(x1, 0, z0, x1, yE, z0, INK);
    add(x0, 0, z1, x0, yE, z1, INK);
    add(x1, 0, z1, x1, yE, z1, INK);
    add(x0, 0, z0, x0, 0, z1, INK);
    add(x1, 0, z0, x1, 0, z1, INK);
    add(x0, 0, z1, x1, 0, z1, INK);
    add(x0, yE, z0, x0, yE, z1, INK);
    add(x1, yE, z0, x1, yE, z1, INK);
    add(x0, yE, z1, x1, yE, z1, INK);
    add(x0, yE, z0, x1, yE, z0, INK);
    add(x0, 0, z0, -0.58, 0, z0, INK);
    add(0.58, 0, z0, x1, 0, z0, INK);
    add(-0.58, 0, z0, -0.58, 2.15, z0, INK);
    add(0.58, 0, z0, 0.58, 2.15, z0, INK);
    add(-0.58, 2.15, z0, 0.58, 2.15, z0, INK);
    add(x0, yE, z0, x0, 0, z0, INK);
    add(x1, yE, z0, x1, 0, z0, INK);
    var wins = [1.55, 4.15, 6.75];
    var wi, w, zs, ze, ys, ye, c, gz, gy;
    var pale = { w: 1 };
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
    box(-gap - dw, 0, z1, -gap, dh, z1, INK);
    box(gap, 0, z1, gap + dw, dh, z1, INK);
    add(-gap - dw * 0.5, 1.05, z1, -gap - dw * 0.5, 1.12, z1 - 0.02, INK);
    add(gap + dw * 0.5, 1.05, z1, gap + dw * 0.5, 1.12, z1 - 0.02, INK);
    for (z = 0.35; z <= 8.95; z += 1.1) {
      add(x0, yE, z, 0, yR, z, INK);
      add(0, yR, z, x1, yE, z, INK);
      add(x0, 2.48, z, x1, 2.48, z, INK);
    }
    add(0, yR, 0.2, 0, yR, 9.0, INK);
    box(-1.95, 0, 6.95, -1.45, 0.5, 9.15, INK);
    add(-1.95, 0.5, 6.95, -1.45, 0.42, 6.95, INK);
    box(1.45, 0, 1.15, 2.15, 0.85, 2.95, INK);
    add(1.45, 0.85, 1.15, 1.45, 0.85, 2.95, INK);
    add(1.55, 0.85, 1.35, 2.05, 0.85, 1.35, INK);
    add(1.55, 0.85, 2.75, 2.05, 0.85, 2.75, INK);
    if (mode !== "upright") {
      box(0.22, 0.79, 2.4, 0.34, 0.91, 7.6, INK);
      box(-0.34, 0.79, 2.4, -0.22, 0.91, 7.6, INK);
      for (z = 2.7; z <= 7.4; z += 0.82) {
        add(-0.28, 0.85, z, 0.28, 0.85, z, INK);
        add(-0.28, 0.79, z, -0.28, 0.91, z, INK);
        add(0.28, 0.79, z, 0.28, 0.91, z, INK);
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
  }

  function buildPlanking() {
    var k, side, i, s, t, tLand, n = 15, ptsIn, ptsOut, p;
    var larch = { w: W_LARCH };
    var landEx = { w: W_LAND };
    var hatchEx = { w: W_LAND, lod: true };
    var STRAKE_DT = 0.022;
    for (k = 0; k < 12; k++) {
      t = k / 12;
      var labEdge = k === 0 ? "garboard" : null;
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
        for (s = 0.06; s <= 0.96; s += 0.12) {
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
        addCopperT(0.055, t, side, false);
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
    var i, dist, s, t, k, n = 12, ptsA, ptsB, p, extra = { w: 1.25 };
    for (i = 0; i < 19; i++) {
      dist = 0.16 + i * 0.178;
      if (dist > LOA - 0.1) continue;
      s = dist / LOA;
      function rib(sideSign) {
        ptsA = [];
        ptsB = [];
        for (k = 0; k <= n; k++) {
          t = k / n;
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

  function buildBoat() {
    copperI = 0;
    var withRabbet = mode !== "skeleton";
    buildKeelStemTransom(withRabbet);
    buildCase();
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
      buildInterior();
      buildChocks();
    }
  }

  function buildGeom() {
    geom = [];
    buildShed();
    buildBoat();
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

  function setCallout(label) {
    if (!calloutEl) return;
    if (label === lastHover) return;
    lastHover = label;
    if (!label) {
      calloutEl.style.opacity = "0.55";
      calloutEl.innerHTML =
        '<div style="font-size:0.85rem;line-height:1.45;color:#5c5348;">' + HINT + "</div>";
      return;
    }
    calloutEl.style.opacity = "1";
    var src = PLATE_SRC[label];
    var copy = COPY[label] || "";
    var html = "";
    if (src) {
      html += '<img src="' + src + '" alt="" style="display:block;width:100%;max-width:280px;height:auto;object-fit:contain;border:1px solid #d4cbb8;margin:0 0 0.75rem;">';
    }
    html += '<div style="font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;color:#5c5348;margin-bottom:0.45rem;">' + escapeHtml(label) + "</div>";
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
      if (g.lod && depth > 5) continue;
      if (g.sparse && depth > 3.2 && (g.si % 4)) continue;
      f0 = foc0 / p0.z;
      f1 = foc0 / p1.z;
      sx0 = cx + p0.x * f0;
      sy0 = cy - p0.y * f0;
      sx1 = cx + p1.x * f1;
      sy1 = cy - p1.y * f1;
      drawn.push({
        sx0: sx0, sy0: sy0, sx1: sx1, sy1: sy1,
        depth: depth, color: g.color, label: g.label, w: g.w
      });
    }
    drawn.sort(function (p, q) { return q.depth - p.depth; });
    hoverDrawn = drawn;
    var lastC = "", lastW = -1;
    for (i = 0; i < drawn.length; i++) {
      g = drawn[i];
      if (g.color !== lastC) {
        ctx.strokeStyle = g.color;
        lastC = g.color;
      }
      if (g.w !== lastW) {
        ctx.lineWidth = g.w;
        lastW = g.w;
      }
      ctx.beginPath();
      ctx.moveTo(g.sx0, g.sy0);
      ctx.lineTo(g.sx1, g.sy1);
      ctx.stroke();
    }
    var lab = null;
    if (!dragging && mouse.x > 0) {
      var best = 16, d;
      for (i = 0; i < drawn.length; i++) {
        g = drawn[i];
        if (!g.label) continue;
        d = distToSeg(mouse.x, mouse.y, g.sx0, g.sy0, g.sx1, g.sy1);
        if (d < best) { best = d; lab = g.label; }
      }
      if (lab) {
        ctx.font = '13px Palatino, "Palatino Linotype", Georgia, serif';
        ctx.fillStyle = INK;
        ctx.textBaseline = "bottom";
        ctx.fillText(lab, mouse.x + 12, mouse.y - 6);
      }
    }
    if (!dragging) setCallout(lab);
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
    cam = { x: 0, y: 1.55, z: 0.35, yaw: 0, pitch: -0.04 };
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
