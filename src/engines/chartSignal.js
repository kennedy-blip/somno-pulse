// Pure signal helpers for the visualizer; output is not a diagnostic measurement.
export function rmsLevel(samples) {
  if (!samples?.length) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

// Average FFT dB bins into logarithmically spaced frequency bands.
// The analyser frequency bin spacing is sampleRate / fftSize.
export function spectrumBands(frequencyDb, sampleRate, fftSize, count = 48, lowHz = 40, highHz = 5000) {
  const result = new Float32Array(count);
  if (!frequencyDb?.length || !sampleRate || !fftSize) return result;
  const ceiling = Math.min(highHz, sampleRate / 2);
  if (ceiling <= lowHz) return result;
  const binHz = sampleRate / fftSize;
  for (let band = 0; band < count; band++) {
    const fromHz = lowHz * (ceiling / lowHz) ** (band / count);
    const toHz = lowHz * (ceiling / lowHz) ** ((band + 1) / count);
    const start = Math.min(frequencyDb.length - 1, Math.floor(fromHz / binHz));
    const end = Math.min(frequencyDb.length, Math.max(start + 1, Math.ceil(toHz / binHz)));
    let sum = 0;
    for (let i = start; i < end; i++) sum += Number.isFinite(frequencyDb[i]) ? frequencyDb[i] : -100;
    result[band] = Math.max(0, Math.min(1, (sum / (end - start) + 100) / 80));
  }
  return result;
}
