<template>
  <div>
    <p class="muted">A simple clock-based illustration, not measured sleep stages. This does not schedule an alarm.</p>
    <div class="grid grid-3">
      <div>
        <label>Bedtime</label>
        <input type="time" v-model="bedtime" />
      </div>
      <div>
        <label>Target wake</label>
        <input type="time" v-model="wake" />
      </div>
      <div>
        <label>Wake window (mins)</label>
        <select v-model.number="windowMin">
          <option :value="15">15 mins</option>
          <option :value="20">20 mins</option>
          <option :value="30">30 mins</option>
        </select>
      </div>
    </div>
    <div class="stat" style="margin-top: 14px">
      <div class="num">{{ result.idealWake }}</div>
      <div class="lbl">90-minute cycle estimate · {{ result.cycles }} cycles</div>
      <p class="muted">{{ result.note }}</p>
      <span class="badge" :class="result.inWindow ? 'ok' : 'danger'">{{ result.inWindow ? 'WITHIN WINDOW' : 'OUTSIDE WINDOW' }}</span>
    </div>
    <div class="row" style="margin-top: 12px">
      <button class="btn primary" @click="testChime">▶ Test Sunrise Chime + Haptic Ramp</button>
      <span class="muted">{{ chimeMsg }}</span>
    </div>
    <div style="margin-top: 12px">
      <h3>90-Minute Ultradian Boundaries</h3>
      <div class="row">
        <span v-for="b in boundaries" :key="b.cycle" class="badge" :class="b.stage === 'N3_DEEP' ? 'danger' : 'ok'">
          Cycle {{ b.cycle }} → {{ b.endLabel }} ({{ b.stage }})
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ultradianBoundaries, smartWakeOptions } from '../engines/rustSomnoBridge.js';

const bedtime = ref('22:30');
const wake = ref('06:42');
const windowMin = ref(20);
const chimeMsg = ref('');

function toMin(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}
const boundaries = computed(() => ultradianBoundaries(toMin(bedtime.value), 6));
const result = computed(() => smartWakeOptions(toMin(bedtime.value), toMin(wake.value), windowMin.value));

async function testChime() {
  chimeMsg.value = 'Playing progressive harmonic sunrise ramp…';
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const out = ctx.createGain();
    out.gain.value = 0.0;
    out.connect(ctx.destination);
    const now = ctx.currentTime;
    out.gain.linearRampToValueAtTime(0.25, now + 6);
    out.gain.linearRampToValueAtTime(0.0, now + 8);
    [261.6, 329.6, 392.0, 523.3].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.12;
      o.connect(g).connect(out);
      o.start(now + i * 0.4);
      o.stop(now + 7);
    });
    if (navigator.vibrate) navigator.vibrate([0, 200, 100, 400, 100, 600]);
    setTimeout(() => { chimeMsg.value = 'Chime complete. Haptic ramp delivered (if supported).'; ctx.close(); }, 8200);
  } catch (e) {
    chimeMsg.value = 'Audio unavailable: ' + e.message;
  }
}
</script>
