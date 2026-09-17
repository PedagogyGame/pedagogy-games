/**
 * Procedural Web Audio engine — warm layered rumble/idle, smooth RPM with speed,
 * quiet scrape. No harsh sawtooth. Mute cleanly on Explore.
 */
export class EngineAudio {
  constructor() {
    this._ctx = null;
    this._master = null;
    this._engGain = null;
    this._oscIdle = null;
    this._oscMid = null;
    this._oscHigh = null;
    this._idleLP = null;
    this._midLP = null;
    this._rumble = null;
    this._rumbleGain = null;
    this._rumbleFilter = null;
    this._noise = null;
    this._noiseGain = null;
    this._noiseFilter = null;
    this._scrapeGain = null;
    this._scrapeFilter = null;
    this._scrapeSrc = null;
    this._lfo = null;
    this._lfoGain = null;
    this._started = false;
    this._muted = true;
    this._rpm = 0;
    this._boostAmt = 0;
    this._scrapeAmt = 0;
  }

  /** Call on Drive enter (after user gesture via Enter/Drive click). */
  start() {
    if (typeof window === "undefined") return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this._ctx) {
        this._ctx = new AC();
        this._buildGraph();
      }
      if (this._ctx.state === "suspended") {
        this._ctx.resume().catch(() => { this._muted = true; this._started = false; });
      }
      this._muted = false;
      this._started = true;
      try {
        if (this._master) this._master.gain.setTargetAtTime(0.20, this._ctx.currentTime, 0.06);
      } catch (_) {
        try { if (this._master) this._master.gain.value = 0.20; } catch (_) {}
      }
    } catch (_) {
      this._muted = true;
      this._started = false;
    }
  }

  /** Mute on Explore / exit — keep graph warm for re-enter. */
  stop() {
    this._muted = true;
    this._started = false;
    if (this._ctx && this._master) {
      try {
        this._master.gain.setTargetAtTime(0, this._ctx.currentTime, 0.05);
      } catch (_) {}
    }
  }

  /**
   * @param {{ speed: number, maxSpeed?: number, throttle?: number, boost?: boolean, scrape?: number, impact?: boolean }} s
   */
  update(s = {}) {
    if (!this._ctx || this._muted || !this._started) return;
    if (!this._oscIdle || !this._master) { this._muted = true; return; }
    try {
      if (this._ctx.state === "suspended") {
        this._ctx.resume().catch(() => { this._muted = true; });
        return;
      }
    } catch (_) {
      this._muted = true;
      return;
    }
    const spd = Math.abs(s.speed || 0);
    const maxV = Math.max(0.4, s.maxSpeed || 1.4);
    const thr = Math.max(0, Math.min(1, Math.abs(s.throttle != null ? s.throttle : (spd > 0.05 ? 0.5 : 0))));
    const boost = s.boost ? 1 : 0;
    const scrape = Math.max(0, Math.min(1, s.scrape || 0));

    try {
    // Smooth RPM — idle present, rises with speed (not throttle spikes)
    const speedNorm = Math.min(1, spd / maxV);
    const wantRpm = Math.min(1, 0.10 + speedNorm * 0.78 + thr * 0.14 + boost * 0.12);
    this._rpm += (wantRpm - this._rpm) * 0.12; // slower = smoother pitch glide
    this._boostAmt += (boost - this._boostAmt) * 0.10;
    this._scrapeAmt += (scrape - this._scrapeAmt) * 0.22;

    const t = this._ctx.currentTime;
    const rpm = this._rpm;
    // Warm idle ~42 Hz → cruise ~78 → boost ~95 (triangle/sine, not saw)
    const baseHz = 40 + rpm * 42 + this._boostAmt * 16;
    const midHz = baseHz * 1.98;
    const highHz = baseHz * 2.97 + this._boostAmt * 6;

    this._safeSet(this._oscIdle.frequency, baseHz, t, 0.08);
    this._safeSet(this._oscMid.frequency, midHz, t, 0.08);
    this._safeSet(this._oscHigh.frequency, highHz, t, 0.09);

    // Body loudness: quiet idle, gentle rise
    const engVol = 0.07 + rpm * 0.20 + this._boostAmt * 0.06;
    this._safeSet(this._engGain.gain, engVol, t, 0.05);

    // Warm rumble bed (filtered noise) — the "engine mass"
    const rumbleVol = 0.028 + rpm * 0.048 + this._boostAmt * 0.02;
    this._safeSet(this._rumbleGain.gain, rumbleVol, t, 0.06);
    this._safeSet(this._rumbleFilter.frequency, 90 + rpm * 160 + this._boostAmt * 40, t);

    // Soft exhaust hiss (bandpass noise, kept quiet)
    const nVol = 0.008 + rpm * 0.028 + this._boostAmt * 0.018;
    this._safeSet(this._noiseGain.gain, nVol, t, 0.06);
    this._safeSet(this._noiseFilter.frequency, 380 + rpm * 900 + this._boostAmt * 280, t);

    // Gentle idle unevenness (very small)
    this._safeSet(this._lfo.frequency, 3.2 + rpm * 3.5, t);
    this._safeSet(this._lfoGain.gain, 1.1 + rpm * 1.8, t);

    // Quiet scrape
    const scVol = this._scrapeAmt * 0.055;
    this._safeSet(this._scrapeGain.gain, scVol, t, 0.04);
    this._safeSet(this._scrapeFilter.frequency, 700 + this._scrapeAmt * 1400, t);

    // Tone filters open slightly with RPM (still warm)
    this._safeSet(this._idleLP.frequency, 280 + rpm * 220, t);
    this._safeSet(this._midLP.frequency, 520 + rpm * 480 + this._boostAmt * 120, t);

    if (s.impact) this._blipImpact();
    } catch (_) {
      this._muted = true;
    }
  }

  _safeSet(param, value, t, tau = 0.07) {
    if (!param) return;
    try {
      param.setTargetAtTime(value, t, tau);
    } catch (_) {
      try { param.value = value; } catch (_) {}
    }
  }

  _buildGraph() {
    const ctx = this._ctx;
    this._master = ctx.createGain();
    this._master.gain.value = 0;
    this._master.connect(ctx.destination);

    this._engGain = ctx.createGain();
    this._engGain.gain.value = 0;
    this._engGain.connect(this._master);

    // Idle fundamental — triangle through warm lowpass
    this._idleLP = ctx.createBiquadFilter();
    this._idleLP.type = "lowpass";
    this._idleLP.frequency.value = 320;
    this._idleLP.Q.value = 0.55;
    this._idleLP.connect(this._engGain);

    this._oscIdle = ctx.createOscillator();
    this._oscIdle.type = "triangle";
    this._oscIdle.frequency.value = 42;
    this._oscIdle.connect(this._idleLP);
    this._oscIdle.start();

    // Mid harmonic — sine (smooth)
    this._midLP = ctx.createBiquadFilter();
    this._midLP.type = "lowpass";
    this._midLP.frequency.value = 600;
    this._midLP.Q.value = 0.6;
    const midGain = ctx.createGain();
    midGain.gain.value = 0.55;
    this._midLP.connect(midGain);
    midGain.connect(this._engGain);

    this._oscMid = ctx.createOscillator();
    this._oscMid.type = "sine";
    this._oscMid.frequency.value = 84;
    this._oscMid.detune.value = 4;
    this._oscMid.connect(this._midLP);
    this._oscMid.start();

    // Soft high shimmer — sine, quiet
    const highGain = ctx.createGain();
    highGain.gain.value = 0.18;
    highGain.connect(this._engGain);
    this._oscHigh = ctx.createOscillator();
    this._oscHigh.type = "sine";
    this._oscHigh.frequency.value = 126;
    this._oscHigh.detune.value = -3;
    this._oscHigh.connect(highGain);
    this._oscHigh.start();

    // Tiny LFO on idle pitch only
    this._lfo = ctx.createOscillator();
    this._lfo.type = "sine";
    this._lfo.frequency.value = 3.5;
    this._lfoGain = ctx.createGain();
    this._lfoGain.gain.value = 1.2;
    this._lfo.connect(this._lfoGain);
    this._lfoGain.connect(this._oscIdle.frequency);
    this._lfo.start();

    // Shared noise buffer
    const bufLen = Math.floor(ctx.sampleRate * 2.0);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Brown-ish noise (warmer than white)
    let last = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }

    // Rumble bed — lowpass brown noise
    this._rumble = ctx.createBufferSource();
    this._rumble.buffer = buf;
    this._rumble.loop = true;
    this._rumbleFilter = ctx.createBiquadFilter();
    this._rumbleFilter.type = "lowpass";
    this._rumbleFilter.frequency.value = 120;
    this._rumbleFilter.Q.value = 0.7;
    this._rumbleGain = ctx.createGain();
    this._rumbleGain.gain.value = 0;
    this._rumble.connect(this._rumbleFilter);
    this._rumbleFilter.connect(this._rumbleGain);
    this._rumbleGain.connect(this._master);
    this._rumble.start();

    // Quiet exhaust hiss
    this._noise = ctx.createBufferSource();
    this._noise.buffer = buf;
    this._noise.loop = true;
    this._noiseFilter = ctx.createBiquadFilter();
    this._noiseFilter.type = "bandpass";
    this._noiseFilter.frequency.value = 500;
    this._noiseFilter.Q.value = 0.7;
    this._noiseGain = ctx.createGain();
    this._noiseGain.gain.value = 0;
    this._noise.connect(this._noiseFilter);
    this._noiseFilter.connect(this._noiseGain);
    this._noiseGain.connect(this._master);
    this._noise.start();

    // Soft scrape (highpass, quiet)
    this._scrapeSrc = ctx.createBufferSource();
    this._scrapeSrc.buffer = buf;
    this._scrapeSrc.loop = true;
    this._scrapeFilter = ctx.createBiquadFilter();
    this._scrapeFilter.type = "highpass";
    this._scrapeFilter.frequency.value = 900;
    this._scrapeGain = ctx.createGain();
    this._scrapeGain.gain.value = 0;
    this._scrapeSrc.connect(this._scrapeFilter);
    this._scrapeFilter.connect(this._scrapeGain);
    this._scrapeGain.connect(this._master);
    this._scrapeSrc.start();
  }

  _blipImpact() {
    if (!this._ctx || this._muted) return;
    const ctx = this._ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 400;
    o.connect(lp);
    lp.connect(g);
    g.connect(this._master);
    o.start(t);
    o.stop(t + 0.14);
  }
}
