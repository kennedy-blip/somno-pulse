<template>
  <div>
    <div class="row">
      <button v-for="m in modes" :key="m.id" class="chip" :class="{ active: mode === m.id }" @click="mode = m.id">
        {{ m.label }}
      </button>
    </div>
    <label>Volume</label>
    <input type="range" min="0" max="100" v-model.number="volume" />
    <div class="row" style="margin-top: 10px">
      <button class="btn primary" @click="toggle">{{ playing ? '⏹ Stop' : '▶ Start Entrainment' }}</button>
      <span class="muted">{{ status }}</span>
    </div>
    <p class="muted" style="margin-top: 10px">
      Procedural audio for experimentation, not a validated sleep therapy. Noise buffers repeat; the mask is not adaptive. Keep volume comfortable and avoid using headphones at high volume.
    </p>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue';
import { AudioEngine } from '../engines/audioEngine.js';

const modes = [
  { id: 'pink', label: 'Pink Noise' },
  { id: 'delta', label: 'Delta 1.5 Hz' },
  { id: 'theta', label: 'Theta 5.0 Hz' },
  { id: 'mask', label: 'Snore Mask' },
];
const mode = ref('pink');
const volume = ref(30);
const playing = ref(false);
const status = ref('Idle');
const engine = new AudioEngine();

async function toggle() {
  if (playing.value) {
    engine.stopEntrainment();
    playing.value = false;
    status.value = 'Stopped';
    return;
  }
  try {
    await engine.startEntrainment({ mode: mode.value, volume: volume.value / 100 });
    playing.value = true;
    status.value = `Playing: ${modes.find((m) => m.id === mode.value).label}`;
  } catch (e) {
    status.value = 'Error: ' + e.message;
  }
}
onUnmounted(() => engine.stopEntrainment());
</script>
