import { AttachmentStore } from './attachments/AttachmentStore.js';
import { trixPlugin, createTrixNativePlugin } from './channel.js';
import { createChannelPluginEntry } from './entry-compat.js';
import { PairingService } from './pairing/PairingService.js';
import { TrixNativeServer } from './server/TrixNativeServer.js';

export default createChannelPluginEntry({
  id: 'trix-native',
  name: 'Trix Native',
  description: 'TRIX service-backed native channel plugin',
  plugin: trixPlugin,
});

export { trixPlugin, createTrixNativePlugin, AttachmentStore, PairingService, TrixNativeServer };
export type {
  AttachmentDescriptor,
  AttachmentInput,
  AttachmentKind,
  ConversationRecord,
  MessageRecord,
  NativeChannelState,
  PairingRecord,
  ServerConfig,
} from './types.js';
