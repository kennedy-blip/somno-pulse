// Local IndexedDB demo ledger. Records are unencrypted; do not store sensitive data.
const DB_NAME = 'somno-pulse-db';
const DB_VERSION = 1;
const STORES = ['reports', 'syncQueue', 'vault'];

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function transaction(stores, mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let result;
    let t;
    try {
      t = db.transaction(stores, mode);
      result = run(t);
    } catch (error) {
      if (t) t.abort();
      db.close();
      reject(error);
      return;
    }
    t.oncomplete = () => { db.close(); resolve(typeof result === 'function' ? result() : result); };
    t.onabort = () => { db.close(); reject(t.error || new Error('IndexedDB transaction aborted')); };
    t.onerror = () => { /* onabort reports failures */ };
  });
}

export async function saveReport(report) {
  const record = { ...report, createdAt: new Date().toISOString(), synced: false };
  delete record.id;
  // The ledger and its queue entry must either both persist or both roll back.
  return transaction(['reports', 'syncQueue'], 'readwrite', (tx) => {
    const add = tx.objectStore('reports').add(record);
    add.onsuccess = () => {
      record.id = add.result;
      tx.objectStore('syncQueue').add({ type: 'REPORT_UPSERT', reportId: record.id, payload: record, queuedAt: Date.now() });
    };
    return () => record;
  });
}

export async function listReports() {
  return transaction('reports', 'readonly', (tx) => {
    const request = tx.objectStore('reports').getAll();
    return () => request.result || [];
  });
}

export async function syncQueueLength() {
  return transaction('syncQueue', 'readonly', (tx) => {
    const request = tx.objectStore('syncQueue').count();
    return () => request.result || 0;
  });
}

export async function flushSyncQueue() {
  // Never discard pending records without a confirmed remote upload.
  throw new Error('Cloud sync is not configured; queued reports remain on this device.');
}

// Demo PIN comparison only. It does not encrypt or restrict access to reports.
export async function vaultSetPin(pin) {
  const hash = await sha256(pin);
  await transaction('vault', 'readwrite', (tx) => { tx.objectStore('vault').put({ id: 'pin', hash }); });
}

export async function vaultCheckPin(pin) {
  const rec = await transaction('vault', 'readonly', (tx) => {
    const request = tx.objectStore('vault').get('pin');
    return () => request.result;
  });
  return Boolean(rec) && rec.hash === await sha256(pin);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
