import { createTrixNativePlugin } from './plugin/plugin.js';

const plugin = {
  id: 'trix-openclaw-native',
  name: 'TRIX Native',
  description: 'TRIX native OpenClaw multimodal channel with pairing, QR onboarding, LAN relay, and persistent conversations',
  register(api: { registerChannel: (params: { plugin: ReturnType<typeof createTrixNativePlugin> }) => void }) {
    api.registerChannel({ plugin: createTrixNativePlugin() });
  },
};

export default plugin;
