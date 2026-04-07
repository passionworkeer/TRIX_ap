/**
 * Shim that properly exports both default AND named exports.
 * use-sync-external-store v1.6.0 shim/index.js only does `module.exports = ...`
 * (no named exports), which breaks when esbuild pre-bundles to ESM.
 * React 19 already has useSyncExternalStore built-in, so we use it directly.
 */
import React from 'react';

const useSyncExternalStore = React.useSyncExternalStore;

export { useSyncExternalStore };
export default { useSyncExternalStore };
