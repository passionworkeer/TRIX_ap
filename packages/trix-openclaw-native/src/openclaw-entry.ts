// OpenClaw Plugin Entry Point
// This file is loaded by OpenClaw when the plugin is installed

import { createTrixNativePlugin } from './plugin/plugin.js';

// Export the plugin factory function as default
export default createTrixNativePlugin;

// Also export named exports for advanced usage
export { createTrixNativePlugin };

// Re-export types and utilities for consumers
export type {
  AttachmentDescriptor,
  AttachmentInput,
  AttachmentKind,
  PairingRecord,
  ConversationRecord,
  MessageRecord,
  ServerConfig,
  NativeChannelState,
} from './types.js';

export { AttachmentStore } from './attachments/AttachmentStore.js';
export { PairingService } from './pairing/PairingService.js';
export { TrixNativeServer } from './server/TrixNativeServer.js';
