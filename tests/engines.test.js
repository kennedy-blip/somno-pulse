import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateCo2, prescribeVentilation } from '../src/engines/co2Engine.js';
import { detectApneaEvents, computeAhi, smartWakeOptions } from '../src/engines/rustSomnoBridge.js';

test('CO2 rises without ventilation and ventilation reduces the peak', () => {
  const closed = simulateCo2({ ach: 0 });
  const ventilated = simulateCo2({ ach: 2 });
  assert.equal(closed.points[0].ppm, 420);
  assert.ok(closed.peakPpm > ventilated.peakPpm);
  assert.ok(ventilated.peakPpm > 420);
  const needed = prescribeVentilation(closed).achNeeded;
  assert.ok(simulateCo2({ ach: needed }).peakPpm <= 900);
});

test('invalid CO2 inputs stay finite', () => {
  const result = simulateCo2({ lengthM: NaN, ach: -4, occupants: -2 });
  assert.ok(Number.isFinite(result.peakPpm));
});

test('illustrative apnea detector requires ten seconds of silence', () => {
  const signal = [...Array(100).fill(0), 0.8];
  const events = detectApneaEvents(signal, 10);
  assert.equal(events.length, 1);
  assert.equal(events[0].durationSec, 10);
  assert.equal(computeAhi(events, 1).grade, 'NORMAL');
  assert.equal(detectApneaEvents([...Array(99).fill(0), 0.8], 10).length, 0);
});

test('clock boundaries wrap midnight without claiming a sleep stage', () => {
  const result = smartWakeOptions(22 * 60 + 30, 6 * 60, 20);
  assert.equal(result.idealWake, '06:00');
  assert.equal(result.inWindow, true);
  assert.match(result.note, /sleep stages vary/i);
});

test('CO2 integration remains stable at high air exchange and recommendations can exceed 20 ACH', () => {
  const result = simulateCo2({ lengthM: 1, widthM: 1, heightM: 1, occupants: 20, pets: 20, ach: 20, stepMin: 30 });
  assert.ok(result.points.every((point) => point.ppm >= 420));
  assert.ok(prescribeVentilation(result).achNeeded > 20);
  const normal = simulateCo2({ ach: 20, stepMin: 30 });
  assert.ok(normal.peakPpm < 500);
});
