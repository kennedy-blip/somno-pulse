import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stopBangScore, stopBangRisk, epworthScore } from '../src/engines/clinicalScoring.js';

test('STOP-BANG categories include high-risk combinations', () => {
  assert.equal(stopBangRisk({}), 'LOW');
  assert.equal(stopBangScore({ s: true, t: true, a: true }), 3);
  assert.equal(stopBangRisk({ s: true, t: true, a: true }), 'INTERMEDIATE');
  assert.equal(stopBangRisk({ s: true, t: true, g: true }), 'HIGH');
  assert.equal(stopBangRisk({ s: true, t: true, o: true, p: true, a: true }), 'HIGH');
});

test('Epworth requires eight valid responses', () => {
  assert.equal(epworthScore([0, 1, 2, 3, 0, 1, 2, 3]), 12);
  assert.equal(epworthScore([0, 1, 2]), null);
  assert.equal(epworthScore([0, 1, 2, 3, 0, 1, 2, null]), null);
  assert.equal(epworthScore([0, 1, 2, 3, 0, 1, 2, 4]), null);
});
