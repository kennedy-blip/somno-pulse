import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MotionEngine, motionMagnitudeMg } from '../src/engines/motionEngine.js';
import { rmsLevel, spectrumBands } from '../src/engines/chartSignal.js';
import { AudioEngine } from '../src/engines/audioEngine.js';

test('RMS and logarithmic spectrum use actual samples and FFT bin spacing', () => {
  assert.equal(rmsLevel(new Float32Array([1, -1, 1, -1])), 1);
  assert.equal(rmsLevel([]), 0);
  const bins = new Float32Array(1024).fill(-100);
  bins[100] = -20;
  const bands = spectrumBands(bins, 48000, 2048);
  assert.ok(bands.some((value) => value > 0));
  assert.equal(spectrumBands(new Float32Array(0), 48000, 2048).length, 48);
});

test('motion samples are scaled to mG and expire instead of displaying stale readings', async () => {
  const listeners = new Map();
  const target = {
    DeviceMotionEvent: class {},
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name),
  };
  const statuses = [];
  const engine = new MotionEngine(target, (value) => statuses.push(value));
  await engine.start();
  assert.equal(listeners.has('devicemotion'), true);
  listeners.get('devicemotion')({ acceleration: { x: 9.80665, y: 0, z: 0 } });
  assert.ok(Math.abs(engine.sample() - 1000) < 0.001);
  assert.equal(engine.sample(Date.now() + 3000), null);
  assert.equal(motionMagnitudeMg({ x: null, y: 0, z: 0 }), null);
  engine.stop();
  assert.equal(listeners.size, 0);
  assert.match(statuses.at(-1), /sensor active/);
});

test('motion permission resolving after stop does not attach listeners', async () => {
  let resolvePermission;
  const target = {
    DeviceMotionEvent: { requestPermission: () => new Promise((resolve) => { resolvePermission = resolve; }) },
    addEventListener: () => assert.fail('must not attach after cancellation'),
    removeEventListener: () => {},
  };
  const engine = new MotionEngine(target);
  const start = engine.start();
  engine.stop();
  resolvePermission('granted');
  await start;
  assert.equal(engine.active, false);
});

test('microphone granted after stop is immediately released', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let resolveMedia;
  let stopped = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    getUserMedia: () => new Promise((resolve) => { resolveMedia = resolve; }),
  } } });
  try {
    const engine = new AudioEngine();
    engine.ensureCtx = async () => {};
    const start = engine.startLive();
    await Promise.resolve();
    engine.stopAll();
    resolveMedia({ getTracks: () => [{ stop: () => { stopped++; } }] });
    assert.equal(await start, null);
    assert.equal(stopped, 1);
    assert.equal(engine.mode, 'idle');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  }
});

test('microphone diagnostics distinguish actual settings from unknown settings', async () => {
  const { describeAudioSettings } = await import('../src/engines/sensorDiagnostics.js');
  const message = describeAudioSettings({ echoCancellation: false, noiseSuppression: true, sampleRate: 48000 });
  assert.match(message, /echo cancellation: off/);
  assert.match(message, /noise suppression: on/);
  assert.match(message, /automatic gain control: not reported/);
  assert.match(message, /48000 Hz/);
});
