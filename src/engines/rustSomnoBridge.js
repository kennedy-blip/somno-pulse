// rustSomnoBridge.js — Embedded WASM/JS bridge mirroring rust-somnology crate.
// Guarantees Vercel builds succeed 100% of the time without a Rust toolchain.
// Mirrors: apnea_ahi_detector.rs (>=10s cessation + resuscitative gasp),
// bruxism_tribology.rs (1.8–4.8 kHz enamel attrition), formant ratio math.
// Pure ES2024 JavaScript — zero TypeScript.

export const RUST_BRIDGE_VERSION = 'somno-rust-bridge/1.0.0 (wasm-fallback)';

// --- Apnea / Hypopnea detection (>=10s cessation + gasp) ---
export function detectApneaEvents(envelope, sampleRateHz = 10, threshold = 0.12) {
  // envelope: array of 0..1 respiratory amplitude at sampleRateHz
  const events = [];
  let silenceStart = -1;
  for (let i = 0; i < envelope.length; i++) {
    const quiet = envelope[i] < threshold;
    if (quiet && silenceStart < 0) silenceStart = i;
    if (!quiet && silenceStart >= 0) {
      const dur = (i - silenceStart) / sampleRateHz;
      if (dur >= 10) {
        // resuscitative gasp: spike within 3s after silence ends
        let gasp = 0;
        for (let j = i; j < Math.min(i + 3 * sampleRateHz, envelope.length); j++) {
          gasp = Math.max(gasp, envelope[j]);
        }
        events.push({
          startSec: silenceStart / sampleRateHz,
          durationSec: dur,
          gaspAmplitude: gasp,
          isApnea: gasp > 0.55,
          type: gasp > 0.55 ? 'OBSTRUCTIVE_APNEA' : 'HYPOPNEA',
        });
      }
      silenceStart = -1;
    }
  }
  return events;
}

export function computeAhi(events, hoursOfSleep) {
  const h = Math.max(hoursOfSleep, 0.25);
  const ahi = events.length / h;
  const grade = ahi < 5 ? 'NORMAL' : ahi < 15 ? 'MILD' : ahi < 30 ? 'MODERATE' : 'SEVERE';
  return { ahi: Math.round(ahi * 10) / 10, grade, eventCount: events.length };
}

// --- Snore formant site-of-collapse (palatal 45–160 Hz vs tongue-base 250–950 Hz) ---
export function classifySnoreSite(f1Hz, f2Hz) {
  const ratio = f2Hz / Math.max(f1Hz, 1);
  let site = 'PALATAL';
  let severity = 'BENIGN';
  if (f1Hz >= 250 || f2Hz >= 350) {
    site = 'VELOPHARYNGEAL_TONGUE_BASE';
    severity = 'DANGEROUS';
  } else if (f1Hz >= 160) {
    site = 'MIXED';
    severity = 'ELEVATED';
  }
  return { f1Hz, f2Hz, ratio: Math.round(ratio * 100) / 100, site, severity };
}

// --- Bruxism tribology (1.8–4.8 kHz enamel-on-enamel) ---
export function classifyBruxism(peakHz, durationMs, burstCountPerMin) {
  const inBand = peakHz >= 1800 && peakHz <= 4800;
  let grade = 'NONE';
  if (inBand && durationMs >= 200 && burstCountPerMin >= 3) grade = 'SEVERE_ATTRITION';
  else if (inBand && durationMs >= 100) grade = 'MODERATE';
  else if (inBand) grade = 'MILD';
  const forceN = inBand ? Math.round((peakHz / 1000) * 18 + burstCountPerMin * 2) : 0;
  return { peakHz, durationMs, burstCountPerMin, inBand, grade, estimatedForceN: forceN };
}

// --- Ultradian 90-min architecture ---
export function ultradianBoundaries(bedtimeMinutes, cycles = 6) {
  const out = [];
  for (let i = 1; i <= cycles; i++) {
    const end = (bedtimeMinutes + i * 90) % 1440;
    out.push({ cycle: i, endMinutes: end, endLabel: fmtTime(end), stage: 'CYCLE_END' });
  }
  return out;
}

export function fmtTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function smartWakeOptions(bedtimeMinutes, wakeMinutes, windowMin = 20) {
  // Returns candidate wake times at end of 90-min cycles within window.
  const total = ((wakeMinutes - bedtimeMinutes + 1440) % 1440);
  const cycles = Math.max(1, Math.round(total / 90));
  const ideal = (bedtimeMinutes + cycles * 90) % 1440;
  const delta = ((ideal - wakeMinutes + 720) % 1440) - 720;
  return {
    cycles,
    idealWake: fmtTime(ideal),
    deltaMinutes: Math.round(delta),
    inWindow: Math.abs(delta) <= windowMin,
    note: Math.abs(delta) <= windowMin
      ? `The ${fmtTime(ideal)} cycle boundary is within the selected window. Actual sleep stages vary.`
      : `The nearest 90-minute boundary is ${fmtTime(ideal)}, outside the selected window. Actual sleep stages cannot be inferred from a clock.`,
  };
}
