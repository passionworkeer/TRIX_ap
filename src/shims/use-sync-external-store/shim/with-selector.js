/**
 * Shim for use-sync-external-store/shim/with-selector.js
 * React 19 has useSyncExternalStore with useSyncExternalStoreWithSelector built-in.
 */
import React from 'react';

const useSyncExternalStoreWithSelector = React.useSyncExternalStoreWithSelector || React.useSyncExternalStore;

export { useSyncExternalStoreWithSelector };
export default { useSyncExternalStoreWithSelector };
