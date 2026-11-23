// audioEngine.js — Web Audio API nocturnal respiratory analyzer + entrainment synth.
// Pure ES2024 JavaScript — zero TypeScript.
// No echoCancellation / noiseSuppression / autoGainControl so quiet breathing
// (25 dBA), apneic silences and 3.5 kHz grinding are never distorted.

export const SIMULATORS = [
  { id: 'nasal', label: 'Healthy Nasal Breathing', meta: '14 breaths/min | 32 dBA | AHI 1.2/hr [OPTIMAL AIRWAY]' },
  { id: 'palatal', label: 'Palatal Snoring', meta: '92 Hz fundamental | AHI 3.4/hr [NASAL STRIP CANDIDATE]' },
  { id: 'osa', label: 'OSA Event + Gasp', meta: '15s silence → 620 Hz gasp | AHI 28.5/hr [MODERATE-SEVERE]' },
  { id: 'bruxism', label: 'Bruxism Grinding', meta: '2,800–4,100 Hz bursts [NIGHTGUARD ALERT]' },
  { id: 'plmd', label: 'PLMD / Toss & Turn', meta: 'Actigraphy surge + sheet rustle' },
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.stream = null;
    this.liveSource = null;
    this.generation = 0;
    this.simNodes = [];
    this.entrainNodes = null;
    this.mode = 'idle'; // idle | live | sim
    this.simId = null;
    this.simTimer = null;
    this.phase = 0;
  }

  async ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.82;
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  async startLive() {
    this.stopAll();
    const generation = this.generation;
    await this.ensureCtx();
    if (generation !== this.generation) return null;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone API unavailable; use HTTPS and a supported browser.');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    if (generation !== this.generation) {
      for (const track of stream.getTracks()) track.stop();
      return null;
    }
    this.stream = stream;
    this.liveSource = this.ctx.createMediaStreamSource(stream);
    this.liveSource.connect(this.analyser);
    this.mode = 'live';
    return this.analyser;
  }

  startSimulator(id) {
    if (!SIMULATORS.some((sim) => sim.id === id)) return Promise.reject(new Error('Unknown simulator'));
    this.stopAll();
    const generation = this.generation;
    return this.ensureCtx().then(() => {
      if (generation !== this.generation) return null;
      this.mode = 'sim';
      this.simId = id;
      const ctx = this.ctx;
      const master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(this.analyser);
      master.connect(ctx.destination); // Simulator only; never play microphone input back.
      this.simNodes.push(master);
      const t0 = ctx.currentTime;

      const noiseBuffer = makeNoiseBuffer(ctx, 2);
      const breath = (freq, gain, type = 'sine') => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = gain;
        o.connect(g).connect(master);
        o.start(t0);
        this.simNodes.push(o, g);
        return { o, g };
      };
      const noise = (gain, filterFreq, type = 'bandpass') => {
        const s = ctx.createBufferSource();
        s.buffer = noiseBuffer;
        s.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = filterFreq;
        f.Q.value = 0.8;
        const g = ctx.createGain();
        g.gain.value = gain;
        s.connect(f).connect(g).connect(master);
        s.start(t0);
        this.simNodes.push(s, f, g);
        return { s, g };
      };

      if (id === 'nasal') {
        // 14 breaths/min ≈ 0.233 Hz laminar flow swell
        const { g } = noise(0.5, 600, 'lowpass');
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.233;
        const lg = ctx.createGain();
        lg.gain.value = 0.28;
        lfo.connect(lg).connect(g.gain);
        lfo.start(t0);
        this.simNodes.push(lfo, lg);
      } else if (id === 'palatal') {
        const { o, g } = breath(92, 0.5, 'sawtooth');
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 500;
        o.disconnect();
        o.connect(f).connect(g).connect(master);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.25;
        const lg = ctx.createGain();
        lg.gain.value = 0.22;
        lfo.connect(lg).connect(g.gain);
        lfo.start(t0);
        this.simNodes.push(lfo, lg, f);
      } else if (id === 'osa') {
        // Cycle: 15s silence → gasp. Implement as repeating gain envelope.
        const { o, g } = breath(620, 0.0, 'sawtooth');
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 620;
        o.disconnect();
        o.connect(f).connect(g).connect(master);
        this.simNodes.push(f);
        const cycle = () => {
          if (this.simId !== 'osa') return;
          const now = ctx.currentTime;
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(0.0, now);
          g.gain.setValueAtTime(0.0, now + 15);
          g.gain.linearRampToValueAtTime(0.9, now + 15.4);
          g.gain.exponentialRampToValueAtTime(0.001, now + 17.5);
          this.simTimer = setTimeout(cycle, 20000);
        };
        cycle();
      } else if (id === 'bruxism') {
        const { g } = noise(0.0, 3200, 'highpass');
        const burst = () => {
          if (this.simId !== 'bruxism') return;
          const now = ctx.currentTime;
          const dur = 0.25 + Math.random() * 0.5;
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(0.0, now);
          g.gain.linearRampToValueAtTime(0.55, now + 0.03);
          g.gain.setValueAtTime(0.55, now + dur);
          g.gain.linearRampToValueAtTime(0.0, now + dur + 0.05);
          this.simTimer = setTimeout(burst, 1200 + Math.random() * 1800);
        };
        burst();
      } else if (id === 'plmd') {
        const { g } = noise(0.12, 300, 'lowpass');
        const surge = () => {
          if (this.simId !== 'plmd') return;
          const now = ctx.currentTime;
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(0.12, now);
          g.gain.linearRampToValueAtTime(0.85, now + 0.4);
          g.gain.linearRampToValueAtTime(0.12, now + 1.2);
          this.simTimer = setTimeout(surge, 4000 + Math.random() * 5000);
        };
        surge();
      }
      return this.analyser;
    });
  }

  // Entrainment synth: pink noise + binaural delta/theta + snore-mask curtain.
  startEntrainment({ mode = 'pink', volume = 0.3 } = {}) {
    return this.ensureCtx().then(() => {
      this.stopEntrainment();
      const ctx = this.ctx;
      const out = ctx.createGain();
      out.gain.value = volume;
      out.connect(ctx.destination);
      const nodes = { out };
      if (mode === 'pink' || mode === 'mask') {
        const buf = pinkNoiseBuffer(ctx, 4);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = mode === 'mask' ? 'bandpass' : 'lowpass';
        f.frequency.value = mode === 'mask' ? 180 : 1200;
        src.connect(f).connect(out);
        src.start();
        nodes.src = src;
        nodes.filter = f;
      }
      if (mode === 'delta' || mode === 'theta') {
        const carrier = mode === 'delta' ? 1.5 : 5.0;
        const base = 200;
        const l = ctx.createOscillator();
        l.frequency.value = base;
        const r = ctx.createOscillator();
        r.frequency.value = base + carrier;
        const lg = ctx.createGain();
        lg.gain.value = 0.06;
        const rg = ctx.createGain();
        rg.gain.value = 0.06;
        const merger = ctx.createChannelMerger(2);
        l.connect(lg).connect(merger, 0, 0);
        r.connect(rg).connect(merger, 0, 1);
        merger.connect(out);
        l.start();
        r.start();
        nodes.l = l;
        nodes.r = r;
      }
      this.entrainNodes = nodes;
      return nodes;
    });
  }

  stopEntrainment() {
    if (!this.entrainNodes) return;
    const n = this.entrainNodes;
    try { n.src?.stop(); } catch { /* noop */ }
    try { n.l?.stop(); } catch { /* noop */ }
    try { n.r?.stop(); } catch { /* noop */ }
    try { n.out?.disconnect(); } catch { /* noop */ }
    this.entrainNodes = null;
  }

  getSpectrum() {
    if (!this.analyser) return { freq: new Float32Array(0), time: new Float32Array(0) };
    const n = this.analyser.frequencyBinCount;
    const freq = new Float32Array(n);
    const time = new Float32Array(n);
    this.analyser.getFloatFrequencyData(freq);
    this.analyser.getFloatTimeDomainData(time);
    return { freq, time };
  }

  stopAll() {
    this.generation++;
    if (this.liveSource) this.liveSource.disconnect();
    this.liveSource = null;
    if (this.simTimer) clearTimeout(this.simTimer);
    this.simTimer = null;
    for (const n of this.simNodes) {
      try { n.stop?.(); } catch { /* noop */ }
      try { n.disconnect?.(); } catch { /* noop */ }
    }
    this.simNodes = [];
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = null;
    }
    this.mode = 'idle';
    this.simId = null;
  }
}

function makeNoiseBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function pinkNoiseBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + 0.029591 * w;
    b1 = 0.985 * b1 + 0.032534 * w;
    b2 = 0.95 * b2 + 0.048056 * w;
    d[i] = (b0 + b1 + b2 + w * 0.05) * 0.35;
  }
  return buf;
}
