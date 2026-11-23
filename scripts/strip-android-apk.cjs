// A web deployment may contain the previous APK. Never embed that APK into its
// own successor: this would recursively inflate every subsequent Android build.
const { rmSync } = require('node:fs');
const { join } = require('node:path');
rmSync(join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'public', 'releases'), { recursive: true, force: true });
console.log('Removed web release downloads from bundled Android assets.');
