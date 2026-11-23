import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { saveReport, listReports, syncQueueLength, flushSyncQueue, vaultSetPin, vaultCheckPin } from '../src/db/somnoDb.js';

test('reports and queue persist locally; failed sync retains queue', async () => {
  const before = await syncQueueLength();
  const saved = await saveReport({ ahi: 3.4, sim: 'palatal', source: 'simulator' });
  assert.ok(saved.id);
  const reports = await listReports();
  assert.equal(reports.find((report) => report.id === saved.id).sim, 'palatal');
  assert.equal(await syncQueueLength(), before + 1);
  await assert.rejects(flushSyncQueue(), /not configured/);
  assert.equal(await syncQueueLength(), before + 1);
});

test('demo PIN compares locally without pretending to encrypt data', async () => {
  await vaultSetPin('1234');
  assert.equal(await vaultCheckPin('1234'), true);
  assert.equal(await vaultCheckPin('9999'), false);
});
