<template>
  <div>
    <canvas ref="canvasRef" class="chart" style="height: 340px" role="img"
      aria-label="Audio level, logarithmic frequency spectrogram and optional device motion history"></canvas>
    <div class="row" style="margin-top: 10px">
      <span class="badge info">Audio RMS · relative, not dBA</span>
      <span class="badge warn">Spectrum · 40 Hz–5 kHz</span>
      <span class="badge ok">Device motion · mG</span>
    </div>
    <div class="row" style="margin-top: 10px">
      <button class="btn" @click="toggleMotion">{{ motionRequested ? 'Stop motion sensor' : 'Enable motion sensor' }}</button>
      <span class="muted" role="status">{{ motionStatus }}</span>
    </div>
    <p class="muted">Latest ~24 seconds when visible (~48 seconds in Eco mode). Motion is optional and requires a supported device and permission; it is not validated actigraphy or sleep staging. Audio and motion remain on this device.</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { MotionEngine } from '../engines/motionEngine.js';
import { rmsLevel, spectrumBands } from '../engines/chartSignal.js';

const props = defineProps({ engine: { type: Object, default: null } });
const canvasRef = ref(null);
const motionStatus = ref('Motion sensor off.');
const motionRequested = ref(false);
const motion = new MotionEngine(window, (message) => { motionStatus.value = message; });
const MAX = 240;
const history = [];
let raf = null;
let previousMode = '';
let previousSample = 0;
let disposed = false;
let motionRequest = 0;

async function toggleMotion() {
  const request = ++motionRequest;
  if (motionRequested.value) {
    motion.stop();
    motionRequested.value = false;
    motionStatus.value = 'Motion sensor off.';
    return;
  }
  motionRequested.value = true;
  await motion.start();
  if (!disposed && request === motionRequest && !motion.active) motionRequested.value = false;
}

function collect() {
  const engine = props.engine;
  const mode = engine ? `${engine.mode}:${engine.simId || ''}` : 'idle';
  if (mode !== previousMode) {
    history.length = 0;
    previousMode = mode;
  }
  let level = 0;
  let bands = null;
  if (engine && engine.mode !== 'idle' && engine.ctx && engine.analyser) {
    const { freq, time } = engine.getSpectrum();
    level = rmsLevel(time);
    bands = spectrumBands(freq, engine.ctx.sampleRate, engine.analyser.fftSize);
  }
  history.push({ level, bands, motion: motion.sample() });
  if (history.length > MAX) history.shift();
}

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue('--ink').trim() || '#E6EDF7';
  const accent = css.getPropertyValue('--accent').trim() || '#06B6D4';
  const scotopic = document.documentElement.dataset.theme === 'scotopic';
  const trackH = h / 3;
  const left = 52 * dpr;
  const plotW = Math.max(1, w - left - 8 * dpr);
  const col = plotW / MAX;
  const bottom = (row) => (row + 1) * trackH - 8 * dpr;

  // Spectral history: frequency increases bottom to top, logarithmic scale.
  history.forEach((entry, index) => {
    if (!entry.bands) return;
    entry.bands.forEach((value, band) => {
      if (value < 0.03) return;
      const hue = scotopic ? 8 + value * 30 : 245 - value * 210;
      ctx.fillStyle = `hsla(${hue}, 95%, ${20 + value * 45}%, ${0.3 + value * 0.7})`;
      const bh = (trackH - 20 * dpr) / entry.bands.length;
      ctx.fillRect(left + index * col, bottom(1) - (band + 1) * bh, col + 0.5, bh + 0.5);
    });
  });

  const line = (key, row, color, scale) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    let drawing = false;
    history.forEach((entry, i) => {
      if (entry[key] === null) { drawing = false; return; }
      const x = left + i * col;
      const y = bottom(row) - Math.min(1, entry[key] * scale) * (trackH - 25 * dpr);
      if (drawing) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      drawing = true;
    });
    ctx.stroke();
  };
  line('level', 0, accent, 5);
  line('motion', 2, scotopic ? '#f59e0b' : '#14b8a6', 1 / 500);
  ctx.font = `${11 * dpr}px sans-serif`;
  ctx.fillStyle = ink;
  ctx.fillText('RMS', 6 * dpr, 15 * dpr);
  ctx.fillText('5 kHz', 6 * dpr, trackH + 15 * dpr);
  ctx.fillText('40 Hz', 6 * dpr, bottom(1));
  ctx.fillText('500 mG', 6 * dpr, trackH * 2 + 15 * dpr);
  ctx.fillText('0 mG', 6 * dpr, bottom(2));
  ctx.strokeStyle = 'rgba(150,150,150,0.35)';
  [trackH, trackH * 2].forEach((y) => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); });
}

onMounted(() => {
  const loop = (now) => {
    // Sampling interval is independent of screen refresh; skip work while hidden.
    const interval = document.documentElement.dataset.theme === 'eco' ? 200 : 100;
    if (!document.hidden && now - previousSample >= interval) {
      collect();
      draw();
      previousSample = now;
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
});
onUnmounted(() => {
  disposed = true;
  motionRequest++;
  motion.stop();
  if (raf) cancelAnimationFrame(raf);
});
</script>
