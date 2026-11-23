// Capacitor 6 imports the CommonJS tar API as a default export. Patched tar 7
// marks its CommonJS exports as __esModule but no longer supplies `default`.
// Expose the same API as its default for the CLI process only; extraction is
// still performed by tar 7. Remove once Capacitor supports this natively.
const { createRequire } = require('node:module');
const fromCli = createRequire(require.resolve('@capacitor/cli/package.json'));
const tar = fromCli('tar');
if (tar.__esModule && !tar.default) tar.default = tar;
