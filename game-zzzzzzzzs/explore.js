/* The Shed — canvas walkaround. No libraries. */
(function () {
  "use strict";

  var INK = "#3c352c";
  var PALE = "#8a8174";
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
  var CAPTION = {
    skeleton: "Day 24. Backbone inverted. Seven moulds in air.",
    planked: "Day 47. Twelve strakes a side. The lands closed.",
    upright: "Day 61. Right way up."
  };

  var overlay = null;
  var canvas = null;
  var ctx = null;
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

  function add(x0, y0, z0, x1, y1, z1, color, label, lod) {
    geom.push({
      x0: x0, y0: y0, z0: z0, x1: x1, y1: y1, z1: z1,
      color: color || INK, label: label || null, lod: !!lod
    });
  }
  function poly(pts, color, label) {
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      add(a[0], a[1], a[2], b[0], b[1], b[2], color, label);
    }
  }
  function box(x0, y0, z0, x1, y1, z1, color, label) {
    add(x0, y0, z0, x1, y0, z0, color, label);
    add(x1, y0, z0, x1, y0, z1, color, label);
    add(x1, y0, z1, x0, y0, z1, color, label);
    add(x0, y0, z1, x0, y0, z0, color, label);
    add(x0, y1, z0, x1, y1, z0, color, label);
    add(x1, y1, z0, x1, y1, z1, color, label);
    add(x1, y1, z1, x0, y1, z1, color, label);
    add(x0, y1, z1, x0, y1, z0, color, label);
    add(x0, y0, z0, x0, y1, z0, color, label);
    add(x1, y0, z0, x1, y1, z0, color, label);
    add(x1, y0, z1, x1, y1, z1, color, label);
    add(x0, y0, z1, x0, y1, z1, color, label);
  }

  function buildShed() {
    var x0 = -2.15, x1 = 2.15, yT = 0, yE = 2.72, yR = 3.15, z0 = 0, z1 = 9.2;
    // Floor planks
    var z, x;
    for (z = 0; z <= z1 + 0.001; z += 0.18) {
      add(x0, 0, z, x1, 0, z, INK, null, true);
    }
    for (x = -1.65; x <= 1.66; x += 0.55) {
      add(x, 0, z0, x, 0, z1, INK, null, true);
    }
    // Room box
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
    // Doorway wall at z=0, opening
    add(x0, 0, z0, -0.58, 0, z0, INK);
    add(0.58, 0, z0, x1, 0, z0, INK);
    add(-0.58, 0, z0, -0.58, 2.15, z0, INK);
    add(0.58, 0, z0, 0.58, 2.15, z0, INK);
    add(-0.58, 2.15, z0, 0.58, 2.15, z0, INK);
    add(x0, yE, z0, x0, 0, z0, INK);
    add(x1, yE, z0, x1, 0, z0, INK);
    // North windows (6-pane)
    var wins = [1.55, 4.15, 6.75];
    var wi, w, zs, ze, ys, ye, c, r, gx, gz, gy;
    for (wi = 0; wi < wins.length; wi++) {
      w = wins[wi];
      zs = w - 0.62; ze = w + 0.62;
      ys = 1.05; ye = 2.35;
      add(x0, ys, zs, x0, ye, zs, PALE);
      add(x0, ye, zs, x0, ye, ze, PALE);
      add(x0, ye, ze, x0, ys, ze, PALE);
      add(x0, ys, ze, x0, ys, zs, PALE);
      for (c = 1; c <= 2; c++) {
        gz = zs + (ze - zs) * c / 3;
        add(x0, ys, gz, x0, ye, gz, PALE);
      }
      gy = (ys + ye) * 0.5;
      add(x0, gy, zs, x0, gy, ze, PALE);
    }
    // Far doors, a pair
    var dw = 0.82, dh = 2.18, gap = 0.04;
    box(-gap - dw, 0, z1, -gap, dh, z1, INK);
    box(gap, 0, z1, gap + dw, dh, z1, INK);
    add(-gap - dw * 0.5, 1.05, z1, -gap - dw * 0.5, 1.12, z1 - 0.02, INK);
    add(gap + dw * 0.5, 1.05, z1, gap + dw * 0.5, 1.12, z1 - 0.02, INK);
    // Roof rafters and tie beams
    for (z = 0.35; z <= 8.95; z += 1.1) {
      add(x0, yE, z, 0, yR, z, INK);
      add(0, yR, z, x1, yE, z, INK);
      add(x0, 2.48, z, x1, 2.48, z, INK);
    }
    add(0, yR, 0.2, 0, yR, 9.0, INK);
    // Steam box, far left
    box(-1.95, 0, 6.95, -1.45, 0.5, 9.15, INK);
    add(-1.95, 0.5, 6.95, -1.45, 0.42, 6.95, INK);
    // Corner bench against south wall
    box(1.45, 0, 1.15, 2.15, 0.85, 2.95, INK);
    add(1.45, 0.85, 1.15, 1.45, 0.85, 2.95, INK);
    add(1.55, 0.85, 1.35, 2.05, 0.85, 1.35, INK);
    add(1.55, 0.85, 2.75, 2.05, 0.85, 2.75, INK);
    // Strongback (skeleton + planked)
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

  function sectionCurve(s, t0, t1, n, side) {
    var pts = [];
    var i, t, h;
    for (i = 0; i <= n; i++) {
      t = t0 + (t1 - t0) * (i / n);
      h = hullXY(s, t);
      pts.push([side * h.x, by(h.yOff), bz(s)]);
    }
    return pts;
  }

  function buildKeelStemTransom() {
    var i, s, pts, h, t;
    pts = [];
    for (i = 0; i <= 16; i++) {
      s = 0.02 + 0.98 * (i / 16);
      pts.push([0, by(0), bz(s)]);
    }
    poly(pts, INK, "keel");
    pts = [];
    for (i = 0; i <= 16; i++) {
      s = 0.02 + 0.98 * (i / 16);
      pts.push([0.028, by(0.01), bz(s)]);
    }
    poly(pts, INK, "keel");
    pts = [];
    for (i = 0; i <= 16; i++) {
      s = 0.02 + 0.98 * (i / 16);
      pts.push([-0.028, by(0.01), bz(s)]);
    }
    poly(pts, INK, "keel");
    // Stem rake in the centreline
    pts = [];
    for (i = 0; i <= 8; i++) {
      t = i / 8;
      s = 0.04 * (1 - t);
      h = hullXY(0, t);
      pts.push([0, by(h.yOff), bz(s) + 0.04 * t]);
    }
    poly(pts, INK, "stem");
    pts = [];
    for (i = 0; i <= 8; i++) {
      t = i / 8;
      s = 0.04 * (1 - t);
      h = hullXY(0, t);
      pts.push([0.018, by(h.yOff), bz(s) + 0.03 * t]);
    }
    poly(pts, INK, "stem");
    // Transom board
    var tpts = [];
    for (i = 0; i <= 10; i++) {
      t = i / 10;
      h = hullXY(1, t);
      tpts.push([-h.x, by(h.yOff), bz(1)]);
    }
    for (i = 10; i >= 0; i--) {
      t = i / 10;
      h = hullXY(1, t);
      tpts.push([h.x, by(h.yOff), bz(1)]);
    }
    tpts.push(tpts[0]);
    poly(tpts, INK, "transom");
    add(-hullXY(1, 1).x, by(hullXY(1, 1).yOff), bz(1), hullXY(1, 1).x, by(hullXY(1, 1).yOff), bz(1), INK, "transom");
    add(0, by(0), bz(1), 0, by(hullXY(1, 1).yOff), bz(1), INK, "transom");
  }

  function buildCase() {
    var s0 = 1.1 / LOA, s1 = 2.1 / LOA;
    var h = 0.28, w = 0.045;
    var y0 = by(0.02), y1 = by(h);
    var z0 = bz(s0), z1 = bz(s1);
    box(-w, Math.min(y0, y1), Math.min(z0, z1), w, Math.max(y0, y1), Math.max(z0, z1), INK, "centreboard case");
    add(0, y0, z0, 0, y0, z1, INK, "centreboard case");
  }

  function buildMoulds(faint) {
    var color = faint ? GHOST : INK;
    var mi, s, n, i, t, h, z, yk, ys, braceZ;
    for (mi = 1; mi <= 7; mi++) {
      s = mi / 8;
      z = bz(s);
      n = 14;
      var port = [], stbd = [];
      for (i = 0; i <= n; i++) {
        t = i / n;
        h = hullXY(s, t);
        port.push([-h.x, by(h.yOff), z]);
        stbd.push([h.x, by(h.yOff), z]);
      }
      poly(port, color, faint ? null : "mould");
      poly(stbd, color, faint ? null : "mould");
      // thickness
      poly(port.map(function (p) { return [p[0], p[1], p[2] + 0.018]; }), color, faint ? null : "mould");
      poly(stbd.map(function (p) { return [p[0], p[1], p[2] + 0.018]; }), color, faint ? null : "mould");
      h = hullXY(s, 1);
      add(-h.x, by(h.yOff), z, -h.x, by(h.yOff), z + 0.018, color, faint ? null : "mould");
      add(h.x, by(h.yOff), z, h.x, by(h.yOff), z + 0.018, color, faint ? null : "mould");
      add(0, by(0), z, 0, by(0), z + 0.018, color, faint ? null : "mould");
      // a few chords
      for (i = 3; i <= 12; i += 3) {
        t = i / n;
        h = hullXY(s, t);
        add(-h.x, by(h.yOff), z, h.x, by(h.yOff), z, color, faint ? null : "mould");
      }
      if (!faint) {
        yk = by(0);
        braceZ = z;
        add(0, yk, braceZ, 0, 3.12, braceZ, INK);
        add(0, yk, braceZ, -1.1, 2.85, braceZ, INK);
        add(0, yk, braceZ, 1.1, 2.85, braceZ, INK);
      }
    }
  }

  function strakeT(k) {
    return (k + 1) / 12;
  }

  function buildPlanking() {
    var k, side, i, s, t, h, pts, t2, h2, j, ss, tick, nx, ny, nz, px, py, pz, len;
    for (k = 0; k < 12; k++) {
      t = strakeT(k);
      for (side = -1; side <= 1; side += 2) {
        pts = [];
        for (i = 0; i <= 7; i++) {
          s = i / 7;
          h = hullXY(s, t);
          pts.push([side * h.x, by(h.yOff), bz(s)]);
        }
        poly(pts, INK, k === 0 ? "garboard" : (k === 11 ? "gunwale" : null));
        if (k < 11) {
          t2 = t + 0.012;
          pts = [];
          for (i = 0; i <= 7; i++) {
            s = i / 7;
            h2 = hullXY(s, t2);
            pts.push([side * h2.x, by(h2.yOff), bz(s)]);
          }
          poly(pts, INK, "land");
        }
      }
    }
    // sparse copper ticks on a few lands
    var lands = [1, 4, 7, 10];
    for (j = 0; j < lands.length; j++) {
      t = strakeT(lands[j]);
      for (side = -1; side <= 1; side += 2) {
        for (ss = 0.12; ss <= 0.92; ss += 0.55) {
          h = hullXY(ss, t);
          h2 = hullXY(ss, t + 0.08);
          px = side * h.x; py = by(h.yOff); pz = bz(ss);
          nx = side * h2.x - px; ny = by(h2.yOff) - py; nz = 0;
          len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          nx /= len; ny /= len;
          add(px, py, pz, px + nx * 0.012, py + ny * 0.012, pz, COPPER, null);
        }
      }
    }
  }

  function buildTimbers() {
    var i, dist, s, n, t, h, pts, inSlot, k;
    n = 12;
    for (i = 0; i < 19; i++) {
      dist = 0.16 + i * 0.178;
      if (dist > LOA - 0.1) continue;
      s = dist / LOA;
      inSlot = dist > 1.05 && dist < 2.15;
      pts = [];
      for (k = n; k >= 0; k--) {
        t = k / n;
        h = hullXY(s, t);
        pts.push([-h.x, by(h.yOff), bz(s)]);
      }
      if (inSlot) {
        poly(pts, INK, "timber");
        pts = [];
        for (k = 0; k <= n; k++) {
          t = k / n;
          h = hullXY(s, t);
          pts.push([h.x, by(h.yOff), bz(s)]);
        }
        poly(pts, INK, "timber");
      } else {
        for (k = 1; k <= n; k++) {
          t = k / n;
          h = hullXY(s, t);
          pts.push([h.x, by(h.yOff), bz(s)]);
        }
        poly(pts, INK, "timber");
      }
    }
  }

  function buildInterior() {
    var s, h, yb, xw;
    function thwart(sPos, label) {
      var hh = hullXY(sPos, 0.82);
      var y = by(hh.yOff);
      add(-hh.x * 0.92, y, bz(sPos), hh.x * 0.92, y, bz(sPos), INK, label);
      add(-hh.x * 0.92, y, bz(sPos) - 0.09, hh.x * 0.92, y, bz(sPos) - 0.09, INK, label);
      add(-hh.x * 0.92, y, bz(sPos), -hh.x * 0.92, y, bz(sPos) - 0.09, INK, label);
      add(hh.x * 0.92, y, bz(sPos), hh.x * 0.92, y, bz(sPos) - 0.09, INK, label);
    }
    thwart(0.40, null);
    thwart(0.63, null);
    s = 0.42 / LOA;
    h = hullXY(s, 0.78);
    yb = by(h.yOff);
    xw = h.x * 0.9;
    add(-xw, yb, bz(s), xw, yb, bz(s), INK, "mast bench");
    add(-xw, yb, bz(s) - 0.11, xw, yb, bz(s) - 0.11, INK, "mast bench");
    add(-xw, yb, bz(s), -xw, yb, bz(s) - 0.11, INK, "mast bench");
    add(xw, yb, bz(s), xw, yb, bz(s) - 0.11, INK, "mast bench");
    var a, n = 10, r = 0.032, cx = 0, cz = bz(s) - 0.055;
    var circ = [];
    for (a = 0; a <= n; a++) {
      var ang = (a / n) * Math.PI * 2;
      circ.push([cx + Math.cos(ang) * r, yb + 0.002, cz + Math.sin(ang) * r]);
    }
    poly(circ, INK, "mast bench");
    // simple rudder, unlabeled
    var zt = bz(1);
    var yk = by(0);
    var ys = by(0.32);
    add(0, yk, zt, 0, yk - (inverted() ? -0.12 : 0.12), zt - 0.32, INK);
    add(0, ys, zt, 0, yk - (inverted() ? -0.12 : 0.12), zt - 0.32, INK);
    add(-0.02, yk, zt, -0.02, ys, zt, INK);
    add(0.02, yk, zt, 0.02, ys, zt, INK);
    add(-0.12, yk + (inverted() ? 0 : 0.02), zt - 0.08, 0.12, yk + (inverted() ? 0 : 0.02), zt - 0.08, INK);
    add(-0.12, ys, zt - 0.08, 0.12, ys, zt - 0.08, INK);
    add(-0.12, yk, zt - 0.08, -0.12, ys, zt - 0.08, INK);
    add(0.12, yk, zt - 0.08, 0.12, ys, zt - 0.08, INK);
    add(-0.12, yk - (inverted() ? -0.08 : 0.08), zt - 0.32, 0.12, yk - (inverted() ? -0.08 : 0.08), zt - 0.32, INK);
  }

  function buildChocks() {
    box(-0.12, 0, bz(0.28) - 0.08, 0.12, KEEL_UP, bz(0.28) + 0.08, INK);
    box(-0.12, 0, bz(0.72) - 0.08, 0.12, KEEL_UP, bz(0.72) + 0.08, INK);
  }

  function buildBoat() {
    buildKeelStemTransom();
    buildCase();
    if (mode === "skeleton") {
      buildMoulds(false);
    } else if (mode === "planked") {
      buildMoulds(true);
      buildPlanking();
    } else {
      buildPlanking();
      buildTimbers();
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

  function draw() {
    var w = cssW, h = cssH;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
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
      if (g.lod && depth > 5.2 && (i % 2)) continue;
      f0 = foc0 / p0.z;
      f1 = foc0 / p1.z;
      sx0 = cx + p0.x * f0;
      sy0 = cy - p0.y * f0;
      sx1 = cx + p1.x * f1;
      sy1 = cy - p1.y * f1;
      drawn.push({
        sx0: sx0, sy0: sy0, sx1: sx1, sy1: sy1,
        depth: depth, color: g.color, label: g.label
      });
    }
    drawn.sort(function (p, q) { return q.depth - p.depth; });
    hoverDrawn = drawn;
    var last = "";
    for (i = 0; i < drawn.length; i++) {
      g = drawn[i];
      if (g.color !== last) {
        ctx.strokeStyle = g.color;
        last = g.color;
      }
      ctx.beginPath();
      ctx.moveTo(g.sx0, g.sy0);
      ctx.lineTo(g.sx1, g.sy1);
      ctx.stroke();
    }
    if (!dragging && mouse.x > 0) {
      var best = 15, lab = null, d;
      for (i = 0; i < drawn.length; i++) {
        g = drawn[i];
        if (!g.label) continue;
        d = distToSeg(mouse.x, mouse.y, g.sx0, g.sy0, g.sx1, g.sy1);
        if (d < best) { best = d; lab = g.label; }
      }
      if (lab) {
        ctx.font = '14px Palatino, "Palatino Linotype", Georgia, serif';
        ctx.fillStyle = INK;
        ctx.textBaseline = "bottom";
        ctx.fillText(lab, mouse.x + 12, mouse.y - 6);
      }
    }
  }

  function keyOf(e) {
    if (e.key === " ") return "space";
    if (e.key === "Shift") return "shift";
    if (e.key.length === 1) return e.key.toLowerCase();
    return e.key.toLowerCase();
  }

  function onKeyDown(e) {
    e.stopPropagation();
    var k = keyOf(e);
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
    down = {};
    dragging = false;
  }

  function open(m, onClose) {
    if (overlay) close();
    mode = (m === "planked" || m === "upright") ? m : "skeleton";
    onCloseCb = typeof onClose === "function" ? onClose : null;
    cam = { x: 0, y: 1.55, z: 0.35, yaw: 0, pitch: -0.04 };
    down = {};
    lastT = 0;
    overlay = document.createElement("div");
    overlay.setAttribute("data-shed-explore", "1");
    overlay.tabIndex = 0;
    overlay.style.cssText = "position:fixed;inset:0;z-index:40;background:#f3eee4;outline:none;";
    overlay.innerHTML =
      '<canvas style="position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none;"></canvas>' +
      '<div style="position:absolute;left:0;right:0;bottom:0;display:grid;grid-template-columns:1fr auto 1fr;gap:1rem;align-items:end;padding:1rem 1.4rem 1.15rem;font-family:Palatino,\'Palatino Linotype\',\'Book Antiqua\',Georgia,serif;color:#5c5348;pointer-events:none;background:linear-gradient(transparent,rgba(243,238,228,0.94) 45%);">' +
      '<div style="justify-self:start;font-size:0.95rem;">' + (CAPTION[mode] || "") + '</div>' +
      '<div style="justify-self:center;font-size:0.72rem;letter-spacing:0.03em;opacity:0.9;">drag to look · WASD to walk · scroll to come close</div>' +
      '<button type="button" data-back style="justify-self:end;pointer-events:auto;background:none;border:none;cursor:pointer;font-family:inherit;font-size:0.95rem;color:#9a5c38;padding:0;">Back to the doorway</button>' +
      "</div>";
    canvas = overlay.querySelector("canvas");
    ctx = canvas.getContext("2d");
    overlay.querySelector("[data-back]").addEventListener("click", function (e) {
      e.stopPropagation();
      var cb = onCloseCb;
      close();
      if (cb) cb();
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
    raf = requestAnimationFrame(tick);
  }

  function isOpen() { return !!overlay; }

  window.ShedExplore = { open: open, close: close, isOpen: isOpen };
})();
