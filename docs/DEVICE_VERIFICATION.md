# Device verification checklist

This is a manual engineering test protocol, not a validation record. No physical Android device is attached to this environment. Do not use the prototype for diagnosis or overnight safety monitoring.

Record the APK SHA-256, model, OS version, WebView version, date and observations for each device tested. Repeat on a supported phone in both the installed APK and an HTTPS browser.

1. In Acoustic PSG, press **Start microphone** and grant permission. Speak near the phone; the RMS and spectrogram should react. Inspect the displayed *browser-reported settings*: if echo cancellation, noise suppression or automatic gain control is on or not reported, do not assume raw audio. Tap Stop, verify the OS microphone indicator disappears, and verify a subsequent permission denial is reported rather than showing stale values.
2. Tap **Enable motion sensor** and grant permission if prompted. Move the phone gently and check the motion trace responds. Tap Stop motion or navigate away; the trace must stop. Some devices or browsers do not expose motion data. Acceleration is not validated actigraphy.
3. Play each simulator briefly at a safe volume. Confirm the audio and spectrum react and simulator-only values are identified as examples. Stop the simulator before testing the microphone again; feedback should not play back microphone input.
4. In Hypnogram, press the chime test, check audio and (where supported) vibration, and remember this does not schedule an alarm.
5. In the Vault, verify a simulator report can be saved and appears after refresh; verify sync reports that no backend is configured. Reports are unencrypted and the PIN is not a security boundary: use test data only.
6. With the web shell loaded once over HTTPS, switch the device offline and reload the root page. Check the app shell loads. Network functions and APK downloads are not available offline unless independently stored. Check app behavior after revoking permissions, backgrounding, screen lock, and app restart. Overnight recording, background reliability, exact alarms and clinical detection are not implemented.
7. For a downloaded APK, independently verify the SHA-256 against the published manifest, install it on a test device and confirm launch. CI builds a debug-signed APK, not a production release.

Document observed failures; do not mark this checklist passed on the basis of automated mocks or a successful build alone.
