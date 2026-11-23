<template>
  <NeuralWaveCanvas :stage="neuralStage" />
  <svg class="noise-overlay" xmlns="http://www.w3.org/2000/svg">
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" /></filter>
    <rect width="100%" height="100%" filter="url(#n)" />
  </svg>

  <div class="specular" aria-hidden="true"></div>

  <div class="shell" :class="{ 'depth-push': depthPush }">
    <div class="stat" role="note">Research prototype · Not a medical device. Simulations are illustrative; microphone audio does not provide a validated AHI, sleep stage, airway location, or dental force. Consult a clinician for symptoms or testing.</div>
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">◉</div>
        <div>
          <h1>SOMNO-PULSE</h1>
          <p>Acoustic PSG · AHI · Bruxism · CO₂ Architect</p>
        </div>
      </div>
      <div class="controls">
        <button v-for="t in themes" :key="t.id" class="chip" :class="{ active: theme === t.id }" @click="theme = t.id">
          {{ t.label }}
        </button>
        <button class="chip" :class="{ active: viewport === 'desktop' }" @click="viewport = 'desktop'">Desktop PSG Lab</button>
        <button class="chip" :class="{ active: viewport === 'mobile' }" @click="viewport = 'mobile'">Mobile Bedside</button>
        <button class="chip" @click="openPrivileges">Privileges</button>
        <button class="btn primary" @click="openApk">⬇ Download Android .APK</button>
      </div>
    </header>

    <div :class="{ 'phone-frame': viewport === 'mobile' }">
      <nav class="row" style="margin-top: 16px">
        <span class="badge info">{{ roleLabel }}</span>
        <span class="badge ok">{{ engineStatus }}</span>
        <span class="badge warn">Sync queue: {{ syncCount }}</span>
        <span class="muted">0% TypeScript · Vue 3.5 + Rust + Java 17 + Go 1.22 + JS + GLSL</span>
      </nav>

      <!-- MODULE 1: Acoustic PSG -->
      <section v-if="module === 'psg'" class="glass">
        <h2>Acoustic PSG &amp; Apnea (AHI) Screener</h2>
        <p class="muted">Audio visualization or synthesized examples. Browser voice-processing filters are requested off. Optional device motion is not validated actigraphy; live clinical scoring is not implemented.</p>
        <div class="chest-wrap">
          <div class="chest-ring" :style="{ width: chestSize, height: chestSize }"></div>
          <div class="chest-core"></div>
          <span class="chest-label">Audio activity · illustration</span>
        </div>
        <PsgStripChart :engine="engine" />
        <div class="row" style="margin-top: 12px">
          <button class="btn primary" @click="startLive">🎙 Start microphone</button>
          <button class="btn" @click="stopEngine">⏹ Stop</button>
          <span class="muted">{{ engineMsg }}</span>
        </div>
        <h3>Synthesized Nocturnal Simulators</h3>
        <div class="row">
          <button v-for="s in SIMULATORS" :key="s.id" class="chip" :class="{ active: simId === s.id }" @click="startSim(s.id)">
            {{ s.label }}
          </button>
        </div>
        <p class="muted">{{ simMeta }}</p>
        <p class="muted">{{ simId ? "Illustrative simulator values — not measured or diagnostic." : "No clinical results available: choose a simulator to see illustrative values." }}</p>
        <div v-if="simId" class="grid grid-3" style="margin-top: 10px">
          <div class="stat"><div class="num">{{ ahiResult.ahi }}</div><div class="lbl">AHI / hr</div><span class="badge" :class="ahiBadge">{{ ahiResult.grade }}</span></div>
          <div class="stat"><div class="num">{{ formant.f1Hz }} Hz</div><div class="lbl">F1 · {{ formant.site }}</div><span class="badge" :class="formant.severity === 'DANGEROUS' ? 'danger' : 'ok'">{{ formant.severity }}</span></div>
          <div class="stat"><div class="num">{{ brux.peakHz }} Hz</div><div class="lbl">Bruxism · {{ brux.grade }}</div><span class="badge" :class="brux.inBand ? 'danger' : 'ok'">{{ brux.estimatedForceN }} N</span></div>
        </div>
        <div class="row" style="margin-top: 10px">
          <button class="btn" @click="saveCurrentReport">💾 Save Night Report (IndexedDB)</button>
          <button class="btn" @click="openReport">📋 Simulator report</button>
          <span class="muted">{{ saveMsg }}</span>
        </div>
      </section>

      <!-- MODULE 2: Hypnogram + Alarm -->
      <section v-if="module === 'hypnogram'" class="glass">
        <h2>Hypnogram &amp; Smart Ultradian Alarm</h2>
        <p class="muted">Illustrative synthetic night, not recorded sleep or measured sleep stages.</p>
        <HypnogramChart :stages="[]" />
        <SmartAlarm />
        <ClinicalScorer />
      </section>

      <!-- MODULE 3: CO2 -->
      <section v-if="module === 'co2'" class="glass">
        <h2>Bedroom CO₂ &amp; Thermal Microclimate Architect</h2>
        <label for="dimension-unit">Dimensions unit</label>
        <select id="dimension-unit" v-model="dimensionUnit"><option value="m">Meters</option><option value="ft">Feet</option></select>
        <div class="grid grid-3">
          <div><label for="room-length">Length ({{ dimensionUnit }})</label><input id="room-length" type="number" min="0" step="0.1" v-model.number="roomLength" /></div>
          <div><label for="room-width">Width ({{ dimensionUnit }})</label><input id="room-width" type="number" min="0" step="0.1" v-model.number="roomWidth" /></div>
          <div><label for="room-height">Height ({{ dimensionUnit }})</label><input id="room-height" type="number" min="0" step="0.1" v-model.number="roomHeight" /></div>
          <div><label>Occupants</label><input type="number" min="1" max="6" v-model.number="co2.occupants" /></div>
          <div><label>Pets</label><input type="number" min="0" max="4" v-model.number="co2.pets" /></div>
          <div><label>Ventilation (ACH)</label><input type="range" min="0" max="3" step="0.1" v-model.number="co2.ach" /><span class="muted">{{ co2.ach }} ACH</span></div>
        </div>
        <p class="muted">Effective model ventilation: {{ effectiveAch.toFixed(2) }} ACH (the greater of the slider and illustrative door assumption).</p>
        <label>Door position (illustrative ACH assumptions)</label>
        <select v-model="doorPos">
          <option value="closed">Closed Tight</option>
          <option value="undercut">Undercut Gap 2 cm</option>
          <option value="cracked">Cracked Open 10 cm</option>
          <option value="open">Open</option>
        </select>
        <label for="tog">Bedding insulation: {{ tog }} TOG</label>
        <input id="tog" type="range" min="2" max="20" step="0.5" v-model.number="tog" />
        <Co2Chart :points="co2Result.points" />
        <div class="grid grid-3" style="margin-top: 10px">
          <div class="stat"><div class="num">{{ co2Result.peakPpm }}</div><div class="lbl">Peak ppm</div><span class="badge" :class="co2Badge">{{ co2Result.zone }}</span></div>
          <div class="stat"><div class="num">{{ prescription.achNeeded }} ACH</div><div class="lbl">Estimated target ventilation</div></div>
          <div class="stat"><div class="num">{{ thermo.celsius }}°C</div><div class="lbl">{{ thermo.fahrenheit }}°F · TOG {{ tog }}</div></div>
        </div>
        <p class="muted">{{ prescription.message }}</p>
      </section>

      <!-- MODULE 4: Entrainment -->
      <section v-if="module === 'entrain'" class="glass">
        <h2>Delta &amp; Pink-Noise Entrainment Synth</h2>
        <EntrainmentSynth />
      </section>

      <!-- MODULE 5: Vault -->
      <section v-if="module === 'vault'" class="glass">
        <h2>Polyglot Somnology Vault &amp; Cloud Sync</h2>
        <div v-if="role !== 'admin'" class="stat">
          <p>🔒 Admin tier required for the Polyglot Inspector.</p>
          <button class="btn primary" @click="role = 'admin'">Unlock as Lab Director</button>
        </div>
        <PolyglotVault v-else />
        <h3>Longitudinal Sleep Ledger (IndexedDB)</h3>
        <div class="row">
          <button class="btn" @click="refreshLedger">↻ Refresh</button>
          <button class="btn" @click="exportJson">⬇ Export JSON</button>
          <button class="btn" @click="flushSync">☁ Sync Queue</button>
          <span class="muted">{{ ledgerMsg }}</span>
        </div>
        <div v-for="r in reports" :key="r.id || r.createdAt" class="stat" style="margin-top: 8px; text-align: left">
          <strong>{{ r.createdAt }}</strong> — AHI {{ r.ahi }} ({{ r.grade }}) · Bruxism {{ r.bruxism }} · CO₂ {{ r.co2Ppm }} ppm
        </div>
        <h3>Local PIN check (demo only)</h3>
        <p class="muted">The PIN does not encrypt or restrict access to reports. Do not store sensitive information here.</p>
        <div class="row">
          <input type="password" placeholder="4-digit PIN" v-model="pinInput" />
          <button class="btn" @click="setPin">Set PIN</button>
          <button class="btn" @click="checkPin">Unlock</button>
          <span class="muted">{{ pinMsg }}</span>
        </div>
      </section>
    </div>
  </div>

  <!-- Gooey Metaball Dock: inline SVG liquid-contrast filter merges the blobs -->
  <nav class="dock">
    <svg class="goo-def" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="somno-gooey">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feColorMatrix in="blur" mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" result="goo" />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </defs>
    </svg>
    <div class="goo-layer">
      <span v-for="d in dockItems" :key="'blob-' + d.id" class="goo-blob" :class="{ active: module === d.id }"></span>
    </div>
    <div class="dock-labels">
      <button v-for="d in dockItems" :key="'lbl-' + d.id" :class="{ active: module === d.id }" @click="d.apk ? openApk() : (module = d.id)">{{ d.label }}</button>
    </div>
  </nav>

  <!-- APK Modal -->
  <div v-if="showApk" class="modal-backdrop" @click.self="showApk = false">
    <div class="modal">
      <h2>⬇ Download Android .APK</h2>
      <p class="muted">Android build preview · Capacitor / Java 17. A signed debug build is available only after the GitHub Actions workflow succeeds and publishes it.</p>
      <p class="muted">Status: <strong>{{ apkStatus }}</strong></p>
      <button class="btn primary" :disabled="!apkReady" @click="downloadApk">⬇ Download APK</button>
      <p v-if="apkReady" class="muted">SHA-256 (published sidecar, not verified): <code>{{ apkSha }}</code></p>
      <div v-if="apkReady && apkQr" class="stat" style="margin-top: 12px">
        <img :src="apkQr" alt="QR code linking to the APK download" width="140" height="140" />
        <p class="muted">Scan to download, then allow installation from your browser in Android settings.</p>
      </div>
      <button class="btn" style="margin-top: 12px" @click="showApk = false">Close</button>
    </div>
  </div>

  <!-- Privileges Drawer -->
  <div v-if="showPriv" class="modal-backdrop" @click.self="showPriv = false">
    <div class="modal">
      <h2>Privileges &amp; Polyglot Runtime</h2>
      <h3>Role Preview</h3><p class="muted">This is a UI demo, not authentication or access control.</p>
      <div class="row">
        <button v-for="r in roles" :key="r.id" class="chip" :class="{ active: role === r.id }" @click="role = r.id">{{ r.label }}</button>
      </div>
      <h3>Hardware &amp; OS Sensor Matrix</h3>
      <div v-for="s in sensors" :key="s.id" class="toggle-row">
        <div><strong>{{ s.label }}</strong></div>
        <span class="badge">{{ s.status }}</span>
      </div>
      <button class="btn" style="margin-top: 12px" @click="showPriv = false">Close</button>
    </div>
  </div>

  <!-- Clinical Report Modal -->
  <div v-if="showReport" class="modal-backdrop" @click.self="showReport = false">
    <div class="modal">
      <h2>Illustrative Sleep Report</h2>
      <p class="muted">{{ simId ? "Simulator values only; not a clinical polysomnography report." : "No clinical measurements available." }}</p>
      <div v-if="simId" class="grid grid-3">
        <div class="stat"><div class="num">{{ ahiResult.ahi }}</div><div class="lbl">AHI / hr</div><span class="badge" :class="ahiBadge">{{ ahiResult.grade }}</span></div>
        <div class="stat"><div class="num">{{ formant.site }}</div><div class="lbl">Collapse site</div><span class="badge" :class="formant.severity === 'DANGEROUS' ? 'danger' : 'ok'">{{ formant.severity }}</span></div>
        <div class="stat"><div class="num">{{ brux.grade }}</div><div class="lbl">Bruxism</div><span class="badge" :class="brux.inBand ? 'danger' : 'ok'">{{ brux.estimatedForceN }} N</span></div>
      </div>
      <p class="muted" style="margin-top: 12px">
        AHI grades: Normal &lt;5 · Mild 5–14 · Moderate 15–29 · Severe ≥30.
        Palatal snore 45–160 Hz vs tongue-base 250–950 Hz.
        Bruxism band 1.8–4.8 kHz. CO₂ peak {{ co2Result.peakPpm }} ppm ({{ co2Result.zone }}).
      </p>
      <button class="btn" @click="showReport = false">Close</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import QRCode from 'qrcode';
import NeuralWaveCanvas from './components/NeuralWaveCanvas.vue';
import PsgStripChart from './components/PsgStripChart.vue';
import HypnogramChart from './components/HypnogramChart.vue';
import Co2Chart from './components/Co2Chart.vue';
import SmartAlarm from './components/SmartAlarm.vue';
import ClinicalScorer from './components/ClinicalScorer.vue';
import EntrainmentSynth from './components/EntrainmentSynth.vue';
import PolyglotVault from './components/PolyglotVault.vue';
import { AudioEngine, SIMULATORS } from './engines/audioEngine.js';
import { detectApneaEvents, computeAhi, classifySnoreSite, classifyBruxism } from './engines/rustSomnoBridge.js';
import { simulateCo2, prescribeVentilation, thermostatForTog } from './engines/co2Engine.js';
import { saveReport, listReports, syncQueueLength, flushSyncQueue, vaultSetPin, vaultCheckPin } from './db/somnoDb.js';
import { createSpring } from './composables/useSpringPhysics.js';

const themes = [
  { id: 'obsidian', label: 'Circadian Obsidian' },
  { id: 'scotopic', label: 'Scotopic Red-Amber' },
  { id: 'clinic', label: 'Morning Clinic Frost' },
  { id: 'eco', label: 'Eco-Glass Low-GPU' },
];
const theme = ref('obsidian');
const viewport = ref('desktop');
const module = ref('psg');
const modules = [
  { id: 'psg', label: 'Acoustic PSG' },
  { id: 'hypnogram', label: 'Hypnogram & Alarm' },
  { id: 'co2', label: 'CO₂ Architect' },
  { id: 'entrain', label: 'Entrainment' },
  { id: 'vault', label: 'Vault & Sync' },
];
const roles = [
  { id: 'sleeper', label: 'Sleeper & Partner' },
  { id: 'pro', label: 'Sleep & Dental Specialist Pro' },
  { id: 'admin', label: 'PSG Lab Director' },
];
const role = ref('sleeper');
const roleLabel = computed(() => roles.find((r) => r.id === role.value).label);
const dockItems = computed(() => [...modules, { id: 'apk', label: '⬇ APK', apk: true }]);

// --- Hooke's-law springs (stiffness 290, damping 26, mass 0.85) ---
// Drive the gyroscope/cursor specular sweep and the respiratory chest ring.
const specX = createSpring();
const specY = createSpring();
const chest = createSpring();
let specRaf = null;
let chestRaf = null;
let audioRequest = 0;

function onPointer(e) {
  specX.setTarget(e.clientX / Math.max(window.innerWidth, 1));
  specY.setTarget(e.clientY / Math.max(window.innerHeight, 1));
}
function onTilt(e) {
  const g = typeof e.gamma === 'number' ? e.gamma : 0;
  const b = typeof e.beta === 'number' ? e.beta : 0;
  specX.setTarget(Math.min(Math.max((g + 45) / 90, 0), 1));
  specY.setTarget(Math.min(Math.max((b + 45) / 90, 0), 1));
}
function specLoop() {
  const root = document.documentElement;
  root.style.setProperty('--spec-x', `${(specX.value.value * 100).toFixed(2)}%`);
  root.style.setProperty('--spec-y', `${(specY.value.value * 100).toFixed(2)}%`);
  specRaf = requestAnimationFrame(specLoop);
}
function chestLoop() {
  let env = 0;
  if (engine.mode !== 'idle') {
    const { freq } = engine.getSpectrum();
    if (freq.length) {
      let sum = 0;
      for (let i = 0; i < Math.min(freq.length, 200); i++) sum += Math.max(0, freq[i] + 80);
      env = Math.min(1, sum / 200 / 80);
    }
  }
  chest.setTarget(env);
  chestSize.value = `${(58 + chest.value.value * 46).toFixed(1)}%`;
  chestRaf = requestAnimationFrame(chestLoop);
}
const chestSize = ref('64%');

const engine = new AudioEngine();
const engineMsg = ref('Idle');
const engineStatus = ref('SIMULATOR READY');
const simId = ref(null);
const simMeta = ref('Pick a simulator or go live.');
const saveMsg = ref('');
const showApk = ref(false);
const apkStatus = ref('Checking…');
const apkReady = ref(false);
const apkQr = ref('');
const apkSha = ref('Unavailable');
const showPriv = ref(false);
const showReport = ref(false);
const depthPush = ref(false);
const syncCount = ref(0);
const reports = ref([]);
const ledgerMsg = ref('');
const pinInput = ref('');
const pinMsg = ref('');

const sensors = ref([
  { id: 'audio', label: 'Browser microphone', status: 'Start from Acoustic PSG' },
  { id: 'imu', label: 'Device motion', status: 'Opt in from Acoustic PSG; not validated actigraphy' },
  { id: 'haptic', label: 'Haptic alarm', status: 'Chime test only; no scheduled alarm' },
  { id: 'vault', label: 'Local IndexedDB', status: 'Unencrypted; PIN is a demo' },
]);

const neuralStage = computed(() => {
  if (simId.value === 'osa' || simId.value === 'bruxism') return 2;
  if (simId.value === 'palatal' || simId.value === 'plmd') return 1;
  return 0;
});

// Demo clinical math per simulator (mirrors Rust bridge)
const demo = computed(() => {
  switch (simId.value) {
    case 'osa': return { ahi: 28.5, grade: 'MODERATE', f1: 620, f2: 880, peak: 3200, dur: 400, bpm: 8 };
    case 'palatal': return { ahi: 3.4, grade: 'NORMAL', f1: 92, f2: 210, peak: 0, dur: 0, bpm: 0 };
    case 'bruxism': return { ahi: 1.2, grade: 'NORMAL', f1: 95, f2: 180, peak: 3200, dur: 350, bpm: 6 };
    case 'plmd': return { ahi: 1.8, grade: 'NORMAL', f1: 80, f2: 150, peak: 0, dur: 0, bpm: 0 };
    default: return { ahi: 1.2, grade: 'NORMAL', f1: 95, f2: 180, peak: 0, dur: 0, bpm: 0 };
  }
});
const ahiResult = computed(() => ({ ahi: demo.value.ahi, grade: demo.value.grade }));
const ahiBadge = computed(() => (ahiResult.value.grade === 'NORMAL' ? 'ok' : ahiResult.value.grade === 'MODERATE' ? 'warn' : 'danger'));
const formant = computed(() => classifySnoreSite(demo.value.f1, demo.value.f2));
const brux = computed(() => classifyBruxism(demo.value.peak, demo.value.dur, demo.value.bpm));

// CO2
const co2 = ref({ lengthM: 4.5, widthM: 3.5, heightM: 2.6, occupants: 2, pets: 0, ach: 0.2 });
const doorPos = ref('closed');
const dimensionUnit = ref('m');
const tog = ref(13.5);
function dimension(key) {
  return computed({
    get: () => dimensionUnit.value === 'ft' ? Math.round(co2.value[key] / 0.3048 * 100) / 100 : Math.round(co2.value[key] * 100) / 100,
    set: (value) => { co2.value[key] = Number(value) * (dimensionUnit.value === 'ft' ? 0.3048 : 1); },
  });
}
const roomLength = dimension('lengthM');
const roomWidth = dimension('widthM');
const roomHeight = dimension('heightM');
const effectiveAch = computed(() => {
  // Illustrative door-position assumptions, not measured ventilation rates.
  const achMap = { closed: 0.35, undercut: 0.55, cracked: 0.9, open: 2.0 };
  return Math.max(Number(co2.value.ach) || 0, achMap[doorPos.value] || 0.2);
});
const co2Result = computed(() => simulateCo2({ ...co2.value, ach: effectiveAch.value }));
const prescription = computed(() => prescribeVentilation(co2Result.value));
const thermo = computed(() => thermostatForTog(tog.value));
const co2Badge = computed(() => (co2Result.value.zone === 'OPTIMAL' ? 'ok' : co2Result.value.zone === 'STUFFY' ? 'warn' : 'danger'));

watch(theme, (t) => { document.documentElement.setAttribute('data-theme', t); }, { immediate: true });
watch([showApk, showPriv, showReport], ([a, b, c]) => { depthPush.value = a || b || c; });

async function startLive() {
  const request = ++audioRequest;
  engineMsg.value = 'Requesting microphone…';
  engineStatus.value = 'REQUESTING MICROPHONE';
  simId.value = null;
  try {
    const analyser = await engine.startLive();
    if (request !== audioRequest || !analyser) return;
    engineMsg.value = 'Microphone active. Live clinical measurements are not available.';
    engineStatus.value = 'WEB MICROPHONE ACTIVE';
  } catch (e) {
    if (request !== audioRequest) return;
    engineMsg.value = 'Microphone unavailable: ' + e.message;
    engineStatus.value = 'SIMULATOR READY';
  }
}
async function startSim(id) {
  const request = ++audioRequest;
  simId.value = null;
  engineMsg.value = 'Starting simulator…';
  engineStatus.value = 'STARTING SIMULATOR';
  try {
    const analyser = await engine.startSimulator(id);
    if (request !== audioRequest || !analyser) return;
    simId.value = id;
    simMeta.value = SIMULATORS.find((s) => s.id === id)?.meta || '';
    engineMsg.value = 'Simulator running.';
    engineStatus.value = 'SIMULATOR ACTIVE';
  } catch (e) {
    if (request !== audioRequest) return;
    engineMsg.value = 'Audio error: ' + e.message;
    engineStatus.value = 'SIMULATOR READY';
  }
}
function stopEngine() {
  audioRequest++;
  engine.stopAll();
  simId.value = null;
  simMeta.value = 'Pick a simulator or go live.';
  engineMsg.value = 'Stopped.';
  engineStatus.value = 'SIMULATOR READY';
}
function openApk() {
  showApk.value = true;
  verifyApkArtefact();
}
async function verifyApkArtefact() {
  apkReady.value = false;
  apkQr.value = '';
  apkStatus.value = 'Checking…';
  try {
    // Only an explicitly published manifest can enable the download. A SPA
    // fallback returning HTML with status 200 is not an APK.
    const manifestResponse = await fetch('/releases/manifest.json', { cache: 'no-store' });
    if (!manifestResponse.ok) throw new Error('No published APK');
    const manifest = await manifestResponse.json();
    if (manifest.file !== 'somnopulse-release.apk' || !/^[a-f0-9]{64}$/i.test(manifest.sha256)) throw new Error('Invalid release manifest');
    const response = await fetch('/releases/somnopulse-release.apk', { method: 'HEAD', cache: 'no-store' });
    const type = response.headers.get('content-type') || '';
    if (!response.ok || type.includes('text/html')) throw new Error('APK unavailable');
    apkSha.value = manifest.sha256;
    apkReady.value = true;
    apkStatus.value = 'Published debug build available';
    apkQr.value = await QRCode.toDataURL(new URL('/releases/somnopulse-release.apk', window.location.origin).href, { margin: 2, width: 280 });
  } catch {
    apkStatus.value = 'Not published yet. Build and publish the Android artifact with GitHub Actions.';
  }
}
function downloadApk() {
  if (!apkReady.value) return;
  const a = document.createElement('a');
  a.href = '/releases/somnopulse-release.apk';
  a.download = 'SomnoPulse-SleepPSG-v1.0.0.apk';
  a.click();
}
function openPrivileges() { showPriv.value = true; }
function openReport() { showReport.value = true; }
async function saveCurrentReport() {
  if (!simId.value) { saveMsg.value = 'No report available. Live clinical scoring is not implemented.'; return; }
  try {
    await saveReport({
      ahi: ahiResult.value.ahi, grade: ahiResult.value.grade,
      bruxism: brux.value.grade, co2Ppm: co2Result.value.peakPpm,
      sim: simId.value, source: 'simulator',
    });
    saveMsg.value = 'Saved to IndexedDB + sync queue.';
    syncCount.value = await syncQueueLength();
  } catch (e) {
    saveMsg.value = 'Save failed: ' + e.message;
  }
}
async function refreshLedger() {
  try {
    reports.value = await listReports();
    syncCount.value = await syncQueueLength();
    ledgerMsg.value = `${reports.value.length} reports · queue ${syncCount.value}`;
  } catch (error) {
    ledgerMsg.value = 'Could not read local reports: ' + error.message;
  }
}
function exportJson() {
  const blob = new Blob([JSON.stringify(reports.value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'somnopulse-reports.json'; a.click();
  URL.revokeObjectURL(url);
}
async function flushSync() {
  try { await flushSyncQueue(); } catch (e) { ledgerMsg.value = e.message; }
}
async function setPin() {
  if (!/^\d{4}$/.test(pinInput.value)) { pinMsg.value = 'Enter exactly four digits.'; return; }
  try {
    await vaultSetPin(pinInput.value);
    pinInput.value = '';
    pinMsg.value = 'Demo PIN set; reports remain unencrypted.';
  } catch (error) { pinMsg.value = 'PIN check unavailable: ' + error.message; }
}
async function checkPin() {
  try {
    const ok = await vaultCheckPin(pinInput.value);
    pinInput.value = '';
    pinMsg.value = ok ? 'PIN matches (reports remain unencrypted).' : 'PIN does not match.';
  } catch (error) { pinMsg.value = 'PIN check unavailable: ' + error.message; }
}

onMounted(async () => {
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('deviceorientation', onTilt, { passive: true });
  specX.snap(0.5); specY.snap(0.4);
  specLoop();
  chestLoop();
  try {
    syncCount.value = await syncQueueLength();
    reports.value = await listReports();
  } catch { /* IndexedDB unavailable in some previews */ }
});

onUnmounted(() => {
  audioRequest++;
  window.removeEventListener('pointermove', onPointer);
  window.removeEventListener('deviceorientation', onTilt);
  if (specRaf) cancelAnimationFrame(specRaf);
  if (chestRaf) cancelAnimationFrame(chestRaf);
  engine.stopAll();
  engine.stopEntrainment();
});
</script>
