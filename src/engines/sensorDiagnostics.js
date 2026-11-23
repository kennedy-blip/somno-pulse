// Report what the browser actually exposes; requested constraints are not proof
// that all device-side processing is disabled.
export function describeAudioSettings(settings = {}) {
  const labels = [
    ['echoCancellation', 'echo cancellation'],
    ['noiseSuppression', 'noise suppression'],
    ['autoGainControl', 'automatic gain control'],
  ];
  const processing = labels.map(([key, label]) => `${label}: ${settings[key] === false ? 'off' : settings[key] === true ? 'on' : 'not reported'}`);
  const details = [];
  if (Number.isFinite(settings.sampleRate)) details.push(`${settings.sampleRate} Hz`);
  if (Number.isFinite(settings.channelCount)) details.push(`${settings.channelCount} channel${settings.channelCount === 1 ? '' : 's'}`);
  return `Browser-reported settings: ${[...processing, ...details].join(' · ')}. Device processing may still be present.`;
}
