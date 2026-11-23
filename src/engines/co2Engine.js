// co2Engine.js — Offline JS mirror of go_somnology/co2_mass_balance.go.
// Transient mass-balance: dC/dt = (G - Q*(C - C_out)) / V
// Pure ES2024 JavaScript — zero TypeScript.

export const CO2_OUTDOOR_PPM = 420;

export function co2GenerationPerPerson() {
  // ~0.005 L/s CO2 per sleeping adult ≈ 18 L/h
  return 0.005; // L/s
}

export function simulateCo2({
  lengthM = 4.5, widthM = 3.5, heightM = 2.6,
  occupants = 2, pets = 0,
  ach = 0.2, hours = 8, stepMin = 5,
} = {}) {
  const safe = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  lengthM = safe(lengthM, 4.5, 1, 30);
  widthM = safe(widthM, 3.5, 1, 30);
  heightM = safe(heightM, 2.6, 1, 10);
  occupants = safe(occupants, 2, 0, 20);
  pets = safe(pets, 0, 0, 20);
  ach = safe(ach, 0.2, 0, 20);
  hours = safe(hours, 8, 0.1, 48);
  stepMin = safe(stepMin, 5, 0.1, 30);
  const volumeM3 = Math.max(lengthM * widthM * heightM, 5);
  const volumeL = volumeM3 * 1000;
  const people = occupants + pets * 0.4;
  const genLs = co2GenerationPerPerson() * people; // L/s
  const points = [];
  let C = CO2_OUTDOOR_PPM;
  const steps = Math.round((hours * 60) / stepMin);
  for (let i = 0; i <= steps; i++) {
    const tH = (i * stepMin) / 60;
    points.push({ tH: Math.round(tH * 100) / 100, ppm: Math.round(C) });
    // Exact step for constant generation and air exchange, stable at high ACH.
    const dt = stepMin / 60;
    const generationPpmPerHour = genLs * 3600 * 1e6 / volumeL;
    if (ach < 1e-9) C += generationPpmPerHour * dt;
    else C = CO2_OUTDOOR_PPM + (C - CO2_OUTDOOR_PPM) * Math.exp(-ach * dt) + generationPpmPerHour / ach * (-Math.expm1(-ach * dt));
  }
  const peak = Math.max(...points.map((p) => p.ppm));
  const zone = peak < 800 ? 'OPTIMAL' : peak < 1400 ? 'STUFFY' : 'SEVERE';
  return { points, peakPpm: peak, zone, volumeM3, occupants, pets, hours };
}

export function prescribeVentilation({ peakPpm, volumeM3, occupants = 2, pets = 0, hours = 8 }) {
  // Solve the well-mixed model at 8 hours for an illustrative target of 900 ppm.
  // A window opening cannot be converted reliably to ACH without measuring flow.
  const generation = 18 * (occupants + 0.4 * pets) * 1000 / volumeM3;
  const concentration = (ach) => CO2_OUTDOOR_PPM + (ach < 1e-9 ? generation * hours : generation / ach * (1 - Math.exp(-ach * hours)));
  let lo = 0, hi = 1;
  while (concentration(hi) > 900 && hi < 10000) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (concentration(mid) > 900) lo = mid; else hi = mid;
  }
  const achNeeded = Math.ceil(hi * 10) / 10;
  return {
    achNeeded,
    message: `Model estimate: ${achNeeded} ACH for a 900 ppm target (not a measured or guaranteed value). Actual ventilation and outdoor CO₂ vary; use a CO₂ monitor. A crack width cannot reliably predict airflow. Current modeled peak: ${peakPpm} ppm.`,
  };
}

export function thermostatForTog(tog = 13.5) {
  // Higher TOG → cooler room. Baseline 18.3°C at 13.5 TOG.
  const c = Math.round((18.3 - (tog - 13.5) * 0.35) * 10) / 10;
  return { celsius: c, fahrenheit: Math.round((c * 9 / 5 + 32) * 10) / 10 };
}
