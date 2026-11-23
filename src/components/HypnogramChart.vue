<template>
  <div>
    <canvas ref="canvasRef" class="chart" style="height: 240px"></canvas>
    <div class="row" style="margin-top: 8px">
      <span class="badge info">Wake</span>
      <span class="badge warn">REM</span>
      <span class="badge ok">N1 Light</span>
      <span class="badge ok">N2 Spindle</span>
      <span class="badge danger">N3 Deep Delta</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({ stages: { type: Array, default: () => [] } });
const canvasRef = ref(null);
let raf = null;

// stages: [{t: 0..1, stage: 0..4}] 0=Wake 1=REM 2=N1 3=N2 4=N3
function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue('--ink') || '#E6EDF7';
  const colors = ['#F59E0B', '#8B5CF6', '#14B8A6', '#3B82F6', '#06B6D4'];
  const labels = ['Wake', 'REM', 'N1', 'N2', 'N3'];
  const stages = props.stages.length ? props.stages : defaultNight();
  const yFor = (s) => h * 0.12 + (4 - s) * (h * 0.72) / 4;
  ctx.font = `${10 * dpr}px sans-serif`;
  labels.forEach((l, i) => {
    ctx.fillStyle = ink;
    ctx.fillText(l, 6 * dpr, yFor(i) + 3 * dpr);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(40 * dpr, yFor(i));
    ctx.lineTo(w - 8 * dpr, yFor(i));
    ctx.stroke();
  });
  ctx.strokeStyle = colors[3];
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  stages.forEach((p, i) => {
    const x = 40 * dpr + p.t * (w - 48 * dpr);
    const y = yFor(p.stage);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  // event pins
  stages.forEach((p) => {
    if (p.event) {
      const x = 40 * dpr + p.t * (w - 48 * dpr);
      ctx.fillStyle = p.event === 'apnea' ? '#EF4444' : p.event === 'bruxism' ? '#F97316' : '#F59E0B';
      ctx.beginPath();
      ctx.arc(x, yFor(p.stage) - 8 * dpr, 4 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function defaultNight() {
  // 8h synthetic night: cycles of 90min
  const out = [];
  const N = 96;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const cyc = (t * 8 * 60) % 90;
    let stage = 3;
    if (cyc < 12) stage = 2;
    else if (cyc < 30) stage = 4;
    else if (cyc < 55) stage = 3;
    else if (cyc < 75) stage = 1;
    else stage = 2;
    if (i < 3) stage = 0;
    const event = i === 30 || i === 62 ? 'apnea' : i === 48 ? 'bruxism' : i === 78 ? 'snore' : null;
    out.push({ t, stage, event });
  }
  return out;
}

onMounted(() => {
  const loop = () => { draw(); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
});
onUnmounted(() => { if (raf) cancelAnimationFrame(raf); });
watch(() => props.stages, draw);
</script>
