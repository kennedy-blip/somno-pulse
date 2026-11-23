import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// Precache only the public app shell. Audio, reports, API responses and APKs
// must never be put in the offline cache. The first visit still needs a network.
function offlineShell() {
  let outDir;
  return {
    name: 'offline-shell',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    async closeBundle() {
      const assets = (await readdir(resolve(outDir, 'assets'))).map((name) => `/assets/${name}`);
      const paths = ['/index.html', ...assets];
      const hash = createHash('sha256');
      for (const path of paths) hash.update(await readFile(resolve(outDir, `.${path}`)));
      const version = hash.digest('hex').slice(0, 16);
      const worker = `const CACHE = ${JSON.stringify(`somno-shell-${version}`)};\n` +
        `const SHELL = ${JSON.stringify(paths)};\n` +
        `self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())); });\n` +
        `self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('somno-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });\n` +
        `self.addEventListener('fetch', event => {\n` +
        `  const url = new URL(event.request.url);\n` +
        `  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;\n` +
        `  if (event.request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) {\n` +
        `    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html')))); return;\n` +
        `  }\n` +
        `  if (SHELL.includes(url.pathname)) event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(hit => hit || fetch(event.request)));\n` +
        `});\n`;
      await writeFile(resolve(outDir, 'sw.js'), worker);
    },
  };
}

export default defineConfig({
  plugins: [vue(), offlineShell()],
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { outDir: 'dist', sourcemap: false },
});
