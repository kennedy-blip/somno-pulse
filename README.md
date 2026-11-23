# SOMNO-PULSE

An experimental, zero-TypeScript sleep and bedroom-environment visualization built with Vue 3.5, JavaScript, GLSL, Rust, Go, and Android Java/Capacitor.

**Not a medical device.** The charts, clinical classifications, simulator values, hypnogram, and clock-based wake calculations are demonstrations, not validated patient measurements or diagnoses. The browser microphone provides a waveform visualization, not a measured AHI, sleep stages, apnea detection, bruxism diagnosis, airway location or dental force. Seek a qualified clinician for symptoms or formal sleep testing. CO₂ predictions use a simplified well-mixed model; actual air exchange varies and requires measurement.

## Run locally

```sh
npm ci
npm run dev
npm test
npm run build
```

The Vite output is `dist/`. Vercel can build with `npm run build`. Microphone access requires a secure origin and browser permission; the app requests echo cancellation, noise suppression and automatic gain control disabled, but the browser/device ultimately controls the audio path. Simulators are synthetic, not recordings.

## Current scope and limitations

- The synthetic hypnogram and cycle planner do not infer sleep stages or schedule an alarm. The chime button is a local audio/haptic test only. The third trace shows optional browser DeviceMotion acceleration after user permission; it is not validated actigraphy and stops when leaving the module. Native Java plugins are included but not connected to the Vue UI.
- Rust and Go include experimental algorithms; the web app uses the JavaScript mirror and does not execute the compiled WASM. The clinical scorer is local JS; the Go HTTP handler is separately deployable. No algorithm has been clinically validated.
- The role selector is a UI preview, not authorization. IndexedDB reports are unencrypted; the demo PIN check does not lock them. Do not use real sensitive health data. Cloud sync is not configured; the queue is retained rather than falsely marked synced.
- Noise synthesis is local, but noise buffers loop, snore masking is not adaptive and efficacy is not established. The production web shell is cached after the first successful online load; reports remain in IndexedDB. APK downloads, API responses, and sensor data are not cached. The initial visit requires a network.
- The source inspector is a viewer, not a live multi-language execution/benchmark environment. A size distribution target is aspirational, not enforced.

## Android build

`capacitor.config.json` and the Android project provide a starting point. After `npm run build` and `npm run cap:sync`, build with Gradle 8.7 and Android SDK 34. The GitHub Actions workflow runs Rust/Go checks, builds the web bundle, syncs Capacitor and builds a **debug-signed** APK. It uploads the artifact; on non-PR branch pushes it also commits the APK and release manifest to the triggering branch for Vercel to deploy. Tag builds publish a GitHub Release. This is not a production-signed release or a substitute for hardware testing.

No fake APK is shipped. The download control remains disabled until a successful workflow has published the APK and `public/releases/manifest.json`; the QR code is then generated from the deployed URL. Thus the requested immediately available, installable, pre-bundled APK is not provided in this checkout. SHA-256 shown in the app is the published manifest value, not an independent verification of the downloaded bytes.

## Checks

The repository contains no authored `.ts`, `.tsx`, `tsconfig*.json` or Vue `lang="ts"` files. Installed dependency trees can contain their own TypeScript declarations and are excluded from the repository. CI runs the source guard, Rust tests/WASM build, Go vet/build and Android build. Toolchains and real-device permissions/background recording should be verified in their respective environments before use. Capacitor 6 uses a compatibility preload for the patched tar 7 dependency; use `npm run cap:sync` instead of invoking `npx cap` directly.
