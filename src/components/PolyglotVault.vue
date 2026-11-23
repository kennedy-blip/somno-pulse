<template>
  <div>
    <div class="row">
      <button v-for="f in files" :key="f.id" class="chip" :class="{ active: active === f.id }" @click="active = f.id">
        {{ f.label }}
      </button>
    </div>
    <pre class="code">{{ currentSource }}</pre>
    <div class="grid grid-3" style="margin-top: 12px">
      <div class="stat"><div class="num">Rust</div><div class="lbl">AHI + Bruxism crate</div></div>
      <div class="stat"><div class="num">Go 1.22</div><div class="lbl">Clinical + CO₂ engine</div></div>
      <div class="stat"><div class="num">Java 17</div><div class="lbl">Android plugins</div></div>
    </div>
    <p class="muted">Live source viewer for the 5-language polyglot stack. Admin tier required.</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import libRs from '../../rust-somnology/src/lib.rs?raw';
import apneaRs from '../../rust-somnology/src/apnea_ahi_detector.rs?raw';
import bruxRs from '../../rust-somnology/src/bruxism_tribology.rs?raw';
import formantRs from '../../rust-somnology/src/snore_formant.rs?raw';
import ultradianRs from '../../rust-somnology/src/ultradian.rs?raw';
import goClinical from '../../api/somno_clinical.go?raw';
import goCo2 from '../../go_somnology/co2_mass_balance.go?raw';
import javaAct from '../../android/app/src/main/java/com/somnopulse/sleep/MattressActigraphyPlugin.java?raw';
import javaAudio from '../../android/app/src/main/java/com/somnopulse/sleep/NocturnalAudioMonitorPlugin.java?raw';
import glsl from '../shaders/hypnagogic_delta_waves.glsl?raw';

const files = [
  { id: 'lib', label: 'lib.rs', src: libRs },
  { id: 'apnea', label: 'apnea_ahi_detector.rs', src: apneaRs },
  { id: 'brux', label: 'bruxism_tribology.rs', src: bruxRs },
  { id: 'formant', label: 'snore_formant.rs', src: formantRs },
  { id: 'ultradian', label: 'ultradian.rs', src: ultradianRs },
  { id: 'go', label: 'somno_clinical.go', src: goClinical },
  { id: 'co2', label: 'co2_mass_balance.go', src: goCo2 },
  { id: 'java1', label: 'MattressActigraphyPlugin.java', src: javaAct },
  { id: 'java2', label: 'NocturnalAudioMonitorPlugin.java', src: javaAudio },
  { id: 'glsl', label: 'hypnagogic_delta_waves.glsl', src: glsl },
];
const active = ref('lib');
const currentSource = computed(() => files.find((f) => f.id === active.value)?.src || '');
</script>
