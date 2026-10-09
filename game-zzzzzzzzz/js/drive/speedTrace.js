/**
 * logic5 — `&speedtrace=1` debug overlay (URL flag only; never built otherwise).
 * One screenshot proves the hold-W / coast curve in WALL-CLOCK time:
 *  • last ~3 s of per-rAF samples (performance.now stamps, km/h, W state, frame dt)
 *  • a mini graph (speed line, W-held shading, 13 km/h cruise line)
 *  • latched summary of the latest press/release: W↓→13 km/h time, speed at W↑,
 *    W↑→0 time, and any speed-zeroing events (respawn / crash / blur / visibility / key repeat).
 */
export class SpeedTrace {
  constructor(drive) {
    this.drive = drive;
    this.samples = []; // [tSec, kmh, w, dtMs]
    this.events = [];  // [tSec, text]
    this.press = null; // {tDown, tCruise, tUp, kmhUp, tZero, peak}
    this._fpsN = 0; this._fpsT0 = performance.now(); this.fps = 0;
    const el = document.createElement("div");
    el.id = "speedtrace";
    el.style.cssText = "position:fixed;right:10px;top:60px;z-index:10001;width:300px;padding:8px 10px;"
      + "background:rgba(6,10,20,.86);color:#e8f0ff;border:1px solid rgba(120,200,255,.45);border-radius:8px;"
      + "font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;white-space:pre;pointer-events:none";
    this.head = document.createElement("div");
    this.cv = document.createElement("canvas");
    this.cv.width = 280; this.cv.height = 70;
    this.cv.style.cssText = "display:block;margin:4px 0;background:#0b1224";
    this.body = document.createElement("div");
    el.append(this.head, this.cv, this.body);
    document.body.appendChild(el);
    this.el = el;
    const onKey = (e) => {
      if (e.code !== "KeyW" && e.code !== "ArrowUp") return;
      const t = performance.now() / 1000;
      if (e.type === "keydown") {
        if (e.repeat) { this._rep = (this._rep || 0) + 1; return; }
        this.events.push([t, "W↓"]);
        this.press = { tDown: t, tCruise: null, tUp: null, kmhUp: null, tZero: null, peak: 0 };
      } else {
        this.events.push([t, "W↑"]);
        if (this.press && this.press.tUp == null) {
          this.press.tUp = t;
          this.press.kmhUp = this.drive.car.getSpeedKmh();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("blur", () => this.events.push([performance.now() / 1000, "BLUR"]));
    document.addEventListener("visibilitychange", () => this.events.push([performance.now() / 1000, "VIS:" + document.visibilityState]));
    const prevCrash = drive.onCrash;
    drive.onCrash = (info) => { this.events.push([performance.now() / 1000, "CRASH:" + (info?.phase || "")]); if (prevCrash) prevCrash(info); };
    const origRespawn = drive._respawnAtStart?.bind(drive);
    if (origRespawn) drive._respawnAtStart = (...a) => { this.events.push([performance.now() / 1000, "RESPAWN"]); return origRespawn(...a); };
  }

  sample(rawDt) {
    const now = performance.now();
    const t = now / 1000;
    const d = this.drive;
    const kmh = d.car.getSpeedKmh();
    const w = d.keys.forward ? 1 : 0;
    const prev = this.samples[this.samples.length - 1];
    this.samples.push([t, kmh, w, rawDt * 1000]);
    while (this.samples.length && this.samples[0][0] < t - 12) this.samples.shift();
    if (prev && prev[1] > 3 && kmh < prev[1] * 0.4 && w) this.events.push([t, `DROP ${prev[1].toFixed(1)}→${kmh.toFixed(1)} walls=${d._frameWallHits || 0}`]);
    const pr = this.press;
    if (pr) {
      pr.peak = Math.max(pr.peak, kmh);
      if (pr.tCruise == null && pr.tUp == null && kmh >= 13) pr.tCruise = t;
      if (pr.tUp != null && pr.tZero == null && kmh < 0.5) pr.tZero = t;
    }
    while (this.events.length > 8) this.events.shift();
    this._fpsN++;
    if (now - this._fpsT0 > 1000) { this.fps = this._fpsN * 1000 / (now - this._fpsT0); this._fpsN = 0; this._fpsT0 = now; }
    this._render(t);
  }

  _render(t) {
    const pr = this.press;
    const f = (x) => (x == null ? "  -  " : x.toFixed(2) + "s");
    const sc = typeof window !== "undefined" && window.__MOTU_RSCALE__ ? window.__MOTU_RSCALE__() : 1;
    let h = `SPEEDTRACE  t=${t.toFixed(2)}s  fps=${this.fps.toFixed(1)}  scale=${sc.toFixed(2)}\n`;
    if (pr) {
      h += `W↓ @${pr.tDown.toFixed(2)}  →13km/h in ${pr.tCruise != null ? f(pr.tCruise - pr.tDown) : "  -  "}  peak ${pr.peak.toFixed(1)}\n`;
      h += pr.tUp != null
        ? `W↑ @${pr.tUp.toFixed(2)} at ${pr.kmhUp.toFixed(1)}km/h  →0 in ${pr.tZero != null ? f(pr.tZero - pr.tUp) : "  -  "}\n`
        : "W↑  (held)\n";
    } else h += "press W…\n\n";
    h += `repeats=${this._rep || 0}  ` + this.events.slice(-4).map((e) => `${e[1]}@${e[0].toFixed(2)}`).join(" ");
    this.head.textContent = h;

    // graph window: the LATEST press (W↓−0.3 s … coast-to-0 +0.4 s, latched so a later
    // screenshot still shows the whole curve); otherwise the last 3 s.
    let t0 = t - 3, t1 = t;
    if (pr && t - pr.tDown < 10) {
      t0 = pr.tDown - 0.3;
      t1 = pr.tZero != null ? pr.tZero + 0.4 : t;
      if (t1 - t0 > 6) t0 = t1 - 6;
      if (t1 - t0 < 3) t1 = t0 + 3;
    }
    const span = t1 - t0;
    const S = this.samples.filter((s) => s[0] >= t0 && s[0] <= t1);
    const g = this.cv.getContext("2d");
    const W = this.cv.width, H = this.cv.height;
    g.clearRect(0, 0, W, H);
    const X = (tt) => ((tt - t0) / span) * W, Y = (k) => H - 2 - (Math.min(16, k) / 16) * (H - 4);
    g.fillStyle = "rgba(61,255,138,.18)";
    for (let i = 1; i < S.length; i++) if (S[i - 1][2]) g.fillRect(X(S[i - 1][0]), 0, Math.max(1, X(S[i][0]) - X(S[i - 1][0])), H);
    g.strokeStyle = "rgba(255,210,90,.6)"; g.beginPath(); g.moveTo(0, Y(13)); g.lineTo(W, Y(13)); g.stroke();
    g.strokeStyle = "#7fd4ff"; g.lineWidth = 2; g.beginPath();
    S.forEach((s, i) => (i ? g.lineTo(X(s[0]), Y(s[1])) : g.moveTo(X(s[0]), Y(s[1]))));
    g.stroke();
    g.fillStyle = "#fff";
    for (const s of S) g.fillRect(X(s[0]) - 1, Y(s[1]) - 1, 3, 3);

    // sample table (same window, downsampled to ≤24 rows, newest last)
    let rows = S;
    if (rows.length > 24) { const step = rows.length / 24; rows = Array.from({ length: 24 }, (_, i) => S[Math.floor(i * step)]); rows.push(S[S.length - 1]); }
    this.body.textContent = rows.map((s) => `${s[0].toFixed(2)}  ${s[2] ? "W" : "·"}  ${s[1].toFixed(1).padStart(5)} km/h  dt ${s[3].toFixed(0)}ms`).join("\n");
  }
}
