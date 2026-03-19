import { trixPlugin } from './channel.js';
import { createSetupPluginEntry } from './entry-compat.js';

export default createSetupPluginEntry({
  id: 'trix-native',
  name: 'Trix Native',
  description: 'TRIX native setup entry',
  plugin: trixPlugin,
});
