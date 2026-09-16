/**
 * Procedural Web Audio engine — idle hum, RPM with |speed|/throttle, soft boost pitch.
 * Optional scrape/impact blips. No asset files.
 */
export class EngineAudio {
  constructor() {
    this._ctx = null;
    this._master = null;
    this._engGain = null;
    this._oscA = null;
    this._oscB = null;
    this._oscC = null;
    this._lfo = null;
    this._lfoGain = null;
    this._noise = null;
    this._noiseGain = null;
    this._noiseFilter = null;
    this._scrapeGain = null;
    this._scrapeFilter = null;
    this._scrapeSrc = null;
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
      if (this._master) this._master.gain.setTargetAtTime(0.22, this._ctx.currentTime, 0.05);
    } catch (_) {
      // Autoplay / user-gesture / policy blocks — Drive stays silent, no throw
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
        this._master.gain.setTargetAtTime(0, this._ctx.currentTime, 0.04);
      } catch (_) {}
    }
  }

  /**
   * @param {{ speed: number, maxSpeed?: number, throttle?: number, boost?: boolean, scrape?: number, impact?: boolean }} s
   */
  update(s = {}) {
    if (!this._ctx || this._muted || !this._started) return;
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

    // RPM 0..1 from speed + throttle intent
    const speedNorm = Math.min(1, spd / maxV);
    const wantRpm = Math.min(1, 0.12 + speedNorm * 0.72 + thr * 0.22 + boost * 0.14);
    this._rpm += (wantRpm - this._rpm) * 0.18;
    this._boostAmt += (boost - this._boostAmt) * 0.12;
    this._scrapeAmt += (scrape - this._scrapeAmt) * 0.25;

    const t = this._ctx.currentTime;
    const rpm = this._rpm;
    // Idle ~55 Hz → cruise ~95 → boost ~120
    const baseHz = 52 + rpm * 55 + this._boostAmt * 22;
    const harm2 = baseHz * 2.01;
    const harm3 = baseHz * 3.02 + this._boostAmt * 8;

    this._safeSet(this._oscA.frequency, baseHz, t);
    this._safeSet(this._oscB.frequency, harm2, t);
    this._safeSet(this._oscC.frequency, harm3, t);

    // Engine body loudness: idle present, rises with RPM
    const engVol = 0.10 + rpm * 0.28 + this._boostAmt * 0.08;
    this._safeSet(this._engGain.gain, engVol, t, 0.04);

    // Exhaust noise / grit
    const nVol = 0.015 + rpm * 0.055 + this._boostAmt * 0.03;
    this._safeSet(this._noiseGain.gain, nVol, t, 0.05);
    this._safeSet(this._noiseFilter.frequency, 420 + rpm * 1400 + this._boostAmt * 500, t);

    // Subtle LFO wobble on pitch (idle unevenness)
    this._safeSet(this._lfo.frequency, 4.5 + rpm * 6, t);
    this._safeSet(this._lfoGain.gain, 2.2 + rpm * 4, t);

    // Soft scrape
    const scVol = this._scrapeAmt * 0.09;
    this._safeSet(this._scrapeGain.gain, scVol, t, 0.03);
    this._safeSet(this._scrapeFilter.frequency, 900 + this._scrapeAmt * 2200, t);

    if (s.impact) this._blipImpact();
  }

  _safeSet(param, value, t, tau = 0.06) {
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

    const mkOsc = (type, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = 55;
      o.detune.value = detune;
      o.connect(this._engGain);
      o.start();
      return o;
    };
    this._oscA = mkOsc("sawtooth", 0);
    this._oscB = mkOsc("triangle", 7);
    this._oscC = mkOsc("sine", -5);
    // Soften harsh saw: route A through a lowpass
    const engLP = ctx.createBiquadFilter();
    engLP.type = "lowpass";
    engLP.frequency.value = 900;
    engLP.Q.value = 0.7;
    this._oscA.disconnect();
    this._oscA.connect(engLP);
    engLP.connect(this._engGain);

    this._lfo = ctx.createOscillator();
    this._lfo.type = "sine";
    this._lfo.frequency.value = 5;
    this._lfoGain = ctx.createGain();
    this._lfoGain.gain.value = 3;
    this._lfo.connect(this._lfoGain);
    this._lfoGain.connect(this._oscA.frequency);
    this._lfo.start();

    // Broadband exhaust
    const bufLen = Math.floor(ctx.sampleRate * 1.5);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    this._noise = ctx.createBufferSource();
    this._noise.buffer = buf;
    this._noise.loop = true;
    this._noiseFilter = ctx.createBiquadFilter();
    this._noiseFilter.type = "bandpass";
    this._noiseFilter.frequency.value = 600;
    this._noiseFilter.Q.value = 0.8;
    this._noiseGain = ctx.createGain();
    this._noiseGain.gain.value = 0;
    this._noise.connect(this._noiseFilter);
    this._noiseFilter.connect(this._noiseGain);
    this._noiseGain.connect(this._master);
    this._noise.start();

    // Scrape bed (filtered noise)
    this._scrapeSrc = ctx.createBufferSource();
    this._scrapeSrc.buffer = buf;
    this._scrapeSrc.loop = true;
    this._scrapeFilter = ctx.createBiquadFilter();
    this._scrapeFilter.type = "highpass";
    this._scrapeFilter.frequency.value = 1200;
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
    o.type = "triangle";
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g);
    g.connect(this._master);
    o.start(t);
    o.stop(t + 0.16);
  }
}
