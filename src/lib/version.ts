// VibeDoc's own version (same source as `vibedoc --version`), bundled at build time: no fs, no API route.
// Default import + `with`: plain node (version.check.mts) only allows a default export from JSON.
import pkg from '../../package.json' with { type: 'json' }

export const VIBEDOC_VERSION: string = pkg.version
