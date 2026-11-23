// main.js — Pure ES2024 JavaScript entry. Zero TypeScript.
import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).mount('#app');

// The production web shell is available offline after its first successful load.
// Never register in dev or on Capacitor's custom/non-web origins.
if (import.meta.env.PROD && 'serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Offline shell unavailable:', error));
  });
}
