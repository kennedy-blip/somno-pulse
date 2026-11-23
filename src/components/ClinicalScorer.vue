<template>
  <section>
    <h3>STOP-BANG questionnaire</h3>
    <p class="muted">Select each statement that applies. This educational screen is not a diagnosis; a low score does not rule out sleep apnea.</p>
    <div class="grid grid-2">
      <div v-for="q in stopBang" :key="q.id">
        <label style="display:flex; gap:8px; align-items:center">
          <input type="checkbox" v-model="answers[q.id]" />
          <span>{{ q.label }}</span>
        </label>
      </div>
    </div>
    <div class="row" style="margin-top: 12px">
      <span class="badge info">STOP-BANG: {{ score }} / 8</span>
      <span class="badge" :class="risk === 'HIGH' ? 'danger' : risk === 'INTERMEDIATE' ? 'warn' : 'ok'">{{ risk }} score category</span>
    </div>
    <h3>Epworth Sleepiness Scale</h3>
    <p class="muted">Rate your usual chance of dozing in each situation. Select all eight for a total. Results are not diagnostic.</p>
    <div class="grid grid-2">
      <div v-for="(situation, i) in situations" :key="situation">
        <label :for="`epworth-${i}`">{{ situation }}</label>
        <select :id="`epworth-${i}`" v-model="epworth[i]">
          <option :value="null">Choose a response</option>
          <option :value="0">0 — would never doze</option>
          <option :value="1">1 — slight chance</option>
          <option :value="2">2 — moderate chance</option>
          <option :value="3">3 — high chance</option>
        </select>
      </div>
    </div>
    <p class="muted" role="status">{{ epworthTotal === null ? 'Complete all eight situations for a total.' : `Epworth total: ${epworthTotal} / 24. Discuss persistent sleepiness with a clinician.` }}</p>
    <button class="btn" @click="reset">Reset questionnaires</button>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue';
import { stopBangScore, stopBangRisk, epworthScore } from '../engines/clinicalScoring.js';

const stopBang = [
  { id: 's', label: 'S — Snoring loudly?' },
  { id: 't', label: 'T — Tired or sleepy during daytime?' },
  { id: 'o', label: 'O — Has someone observed you stop breathing during sleep?' },
  { id: 'p', label: 'P — High blood pressure or treatment for it?' },
  { id: 'b', label: 'B — BMI greater than 35 kg/m²?' },
  { id: 'a', label: 'A — Age over 50?' },
  { id: 'n', label: 'N — Neck circumference greater than 40 cm?' },
  { id: 'g', label: 'G — Male sex?' },
];
const situations = [
  'Sitting and reading',
  'Watching television',
  'Sitting inactive in a public place',
  'As a passenger in a car for an hour without a break',
  'Lying down to rest in the afternoon',
  'Sitting and talking to someone',
  'Sitting quietly after lunch without alcohol',
  'In a car while stopped in traffic for a few minutes',
];
const answers = ref({});
const epworth = ref(Array(8).fill(null));
const score = computed(() => stopBangScore(answers.value));
const risk = computed(() => stopBangRisk(answers.value));
const epworthTotal = computed(() => epworthScore(epworth.value));
function reset() { answers.value = {}; epworth.value = Array(8).fill(null); }
</script>
