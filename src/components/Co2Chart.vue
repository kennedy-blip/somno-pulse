<template>
  <div>
    <canvas ref="canvasRef" class="chart" style="height: 240px"></canvas>
    <div class="row" style="margin-top: 8px">
      <span class="badge ok">&lt;800 ppm Optimal</span>
      <span class="badge warn">800–1,400 Stuffy</span>
      <span class="badge danger">&gt;1,500 Severe</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({ points: { type: Array, default: () => [] } });
const canvasRef = ref(null);
let raf = null;

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const pts = props.points.length ? props.points : [{ tH: 0, ppm: 420 }, { tH: 8, ppm: 420 }];
  const maxPpm = Math.max(1000, ...pts.map((p) => p.ppm)) * 1.1;
  const xFor = (t) => 36 * dpr + (t / 8) * (w - 44 * dpr);
  const yFor = (ppm) => h - 22 * dpr - (ppm / maxPpm) * (h - 40 * dpr);
  // zones
  ctx.fillStyle = 'rgba(20,184,166,0.10)';
  ctx.fillRect(36 * dpr, yFor(800), w - 44 * dpr, yFor(0) - yFor(800));
  ctx.fillStyle = 'rgba(245,158,11,0.10)';
  ctx.fillRect(36 * dpr, yFor(1400), w - 44 * dpr, yFor(800) - yFor(1400));
  ctx.fillStyle = 'rgba(239,68,68,0.10)';
  ctx.fillRect(36 * dpr, yFor(maxPpm), w - 44 * dpr, yFor(1400) - yFor(maxPpm));
  ctx.strokeStyle = '#F59E0B';
  ctx.setLineDash([4 * dpr, 4 * dpr]);
  ctx.beginPath(); ctx.moveTo(36 * dpr, yFor(900)); ctx.lineTo(w - 8 * dpr, yFor(900)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#06B6D4';
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  pts.forEach((p, i) => { i === 0 ? ctx.moveTo(xFor(p.tH), yFor(p.ppm)) : ctx.lineTo(xFor(p.tH), yFor(p.ppm)); });
  ctx.stroke();
  ctx.fillStyle = '#E6EDF7';
  ctx.font = `${10 * dpr}px sans-serif`;
  ctx.fillText('0h', 36 * dpr, h - 6 * dpr);
  ctx.fillText('8h', w - 30 * dpr, h - 6 * dpr);
  ctx.fillText(`${Math.round(maxPpm)} ppm`, 2 * dpr, 12 * dpr);
}

onMounted(() => {
  const loop = () => { draw(); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
});
onUnmounted(() => { if (raf) cancelAnimationFrame(raf); });
watch(() => props.points, draw);
</script>
