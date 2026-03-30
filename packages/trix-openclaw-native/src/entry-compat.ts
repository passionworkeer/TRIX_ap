import * as openClawCore from 'openclaw/plugin-sdk/core';
import type { ChannelPlugin, OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import { setTrixPluginConfigProvider } from './account.js';

type ChannelPluginEntryParams = {
  id: string;
  name: string;
  description: string;
  plugin: ChannelPlugin;
};

type PluginDefinitionLike = {
  id?: string;
  name?: string;
  description?: string;
  register?: (api: OpenClawPluginApi) => void | Promise<void>;
};

function withConfigProvider(
  register: ((api: OpenClawPluginApi) => void | Promise<void>) | undefined,
  plugin: ChannelPlugin,
  options: { registerChannel?: boolean } = { registerChannel: true },
) {
  return (api: OpenClawPluginApi) => {
    setTrixPluginConfigProvider(() => api.config);
    if (register) {
      return register(api);
    }
    if (options.registerChannel !== false) {
      api.registerChannel({ plugin });
    }
  };
}

export function createChannelPluginEntry(params: ChannelPluginEntryParams): PluginDefinitionLike {
  const maybeDefine = (openClawCore as Record<string, unknown>).defineChannelPluginEntry;
  if (typeof maybeDefine === 'function') {
    const official = maybeDefine({
      id: params.id,
      name: params.name,
      description: params.description,
      plugin: params.plugin,
    }) as PluginDefinitionLike;
    return {
      ...official,
      register: withConfigProvider(official.register, params.plugin),
    };
  }

  return {
    id: params.id,
    name: params.name,
    description: params.description,
    register: withConfigProvider(undefined, params.plugin),
  };
}

export function createSetupPluginEntry(params: ChannelPluginEntryParams): PluginDefinitionLike {
  const maybeDefine = (openClawCore as Record<string, unknown>).defineSetupPluginEntry;
  if (typeof maybeDefine === 'function') {
    const official = maybeDefine(params.plugin) as PluginDefinitionLike;
    return {
      ...official,
      register: withConfigProvider(official.register, params.plugin),
    };
  }

  return {
    id: `${params.id}-setup`,
    name: `${params.name} Setup`,
    description: params.description,
    register: withConfigProvider(undefined, params.plugin, { registerChannel: false }),
  };
}
