/**
 * Provider Service
 *
 * Manages LLM providers for Gateway
 * Supported providers:
 * - anthropic (Claude)
 * - openai (GPT)
 * - google (Gemini)
 * - openrouter
 * - moonshot (Kimi)
 * - siliconflow
 * - ollama
 * - custom
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Default config path
const CONFIG_DIR = process.env.CLAWPILOT_CONFIG_DIR || path.join(process.env.HOME || process.env.USERPROFILE, '.clawpilot');
const PROVIDERS_FILE = path.join(CONFIG_DIR, 'providers.json');

// Default providers
const DEFAULT_PROVIDERS = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    apiBase: 'https://api.anthropic.com',
    apiKey: '',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-6-20250514', 'claude-haiku-4-5-20251001'],
    defaultModel: 'claude-sonnet-4-6',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI GPT',
    apiBase: 'https://api.openai.com/v1',
    apiKey: '',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o',
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: '',
    models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.0-flash-exp',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    apiBase: 'https://openrouter.ai/api/v1',
    apiKey: '',
    models: ['anthropic/claude-sonnet-4-6', 'openai/gpt-4o', 'google/gemini-pro-1.5'],
    defaultModel: 'anthropic/claude-sonnet-4-6',
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot Kimi',
    apiBase: 'https://api.moonshot.cn/v1',
    apiKey: '',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    defaultModel: 'moonshot-v1-8k',
  },
  siliconflow: {
    id: 'siliconflow',
    name: 'SiliconFlow',
    apiBase: 'https://api.siliconflow.cn/v1',
    apiKey: '',
    models: ['Qwen/Qwen2-72B-Instruct', 'THUDM/glm-4-9b-chat'],
    defaultModel: 'Qwen/Qwen2-72B-Instruct',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    apiBase: 'http://localhost:11434/v1',
    apiKey: 'ollama',
    models: ['llama2', 'mistral', 'codellama'],
    defaultModel: 'llama2',
  },
};

class ProviderService {
  constructor() {
    this.providers = {};
    this.defaultProvider = 'anthropic';
    this.loadProviders();
  }

  /**
   * Load providers from config file
   */
  loadProviders() {
    try {
      if (fs.existsSync(PROVIDERS_FILE)) {
        const data = fs.readFileSync(PROVIDERS_FILE, 'utf8');
        const config = JSON.parse(data);
        this.providers = { ...DEFAULT_PROVIDERS, ...config.providers };
        this.defaultProvider = config.defaultProvider || 'anthropic';
      } else {
        // Create default config
        this.providers = { ...DEFAULT_PROVIDERS };
        this.saveProviders();
      }
    } catch (error) {
      console.error('[ProviderService] Failed to load providers:', error);
      this.providers = { ...DEFAULT_PROVIDERS };
    }
  }

  /**
   * Save providers to config file
   */
  saveProviders() {
    try {
      // Ensure config directory exists
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }

      const config = {
        providers: this.providers,
        defaultProvider: this.defaultProvider,
      };

      fs.writeFileSync(PROVIDERS_FILE, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('[ProviderService] Failed to save providers:', error);
    }
  }

  /**
   * List all providers
   */
  list() {
    return Object.values(this.providers).map(p => ({
      id: p.id,
      name: p.name,
      hasApiKey: !!p.apiKey,
      defaultModel: p.defaultModel,
      models: p.models,
    }));
  }

  /**
   * Get provider by ID
   */
  get(providerId) {
    return this.providers[providerId] || null;
  }

  /**
   * Add or update provider
   */
  add(provider) {
    if (!provider.id) {
      throw new Error('Provider ID is required');
    }

    this.providers[provider.id] = {
      ...DEFAULT_PROVIDERS[provider.id],
      ...provider,
    };

    this.saveProviders();
    return this.providers[provider.id];
  }

  /**
   * Delete provider
   */
  delete(providerId) {
    if (!this.providers[providerId]) {
      throw new Error(`Provider ${providerId} not found`);
    }

    // Prevent deleting default provider
    if (providerId === this.defaultProvider) {
      throw new Error('Cannot delete default provider');
    }

    delete this.providers[providerId];
    this.saveProviders();
  }

  /**
   * Set default provider
   */
  setDefault(providerId) {
    if (!this.providers[providerId]) {
      throw new Error(`Provider ${providerId} not found`);
    }

    this.defaultProvider = providerId;
    this.saveProviders();
  }

  /**
   * Get default provider
   */
  getDefault() {
    return this.providers[this.defaultProvider] || null;
  }

  /**
   * Validate API key for a provider
   */
  async validateKey(providerId, apiKey = null) {
    const provider = this.providers[providerId];
    if (!provider) {
      return { valid: false, error: `Provider ${providerId} not found` };
    }

    const key = apiKey || provider.apiKey;
    if (!key) {
      return { valid: false, error: 'API key is required' };
    }

    try {
      // Test API key based on provider
      switch (providerId) {
        case 'anthropic':
          return await this.validateAnthropicKey(key);

        case 'openai':
          return await this.validateOpenAIKey(key, provider.apiBase);

        case 'google':
          return await this.validateGoogleKey(key);

        case 'openrouter':
          return await this.validateOpenRouterKey(key);

        case 'moonshot':
          return await this.validateMoonshotKey(key, provider.apiBase);

        case 'ollama':
          return await this.validateOllamaKey(provider.apiBase);

        default:
          return { valid: false, error: 'Validation not implemented for this provider' };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Validate Anthropic API key
   */
  async validateAnthropicKey(apiKey) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    if (response.ok) {
      return { valid: true };
    }

    const data = await response.json();
    return { valid: false, error: data.error?.message || 'Invalid API key' };
  }

  /**
   * Validate OpenAI API key
   */
  async validateOpenAIKey(apiKey, apiBase) {
    const response = await fetch(`${apiBase}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    const data = await response.json();
    return { valid: false, error: data.error?.message || 'Invalid API key' };
  }

  /**
   * Validate Google API key
   */
  async validateGoogleKey(apiKey) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (response.ok) {
      return { valid: true };
    }

    const data = await response.json();
    return { valid: false, error: data.error?.message || 'Invalid API key' };
  }

  /**
   * Validate OpenRouter API key
   */
  async validateOpenRouterKey(apiKey) {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    return { valid: false, error: 'Invalid API key' };
  }

  /**
   * Validate Moonshot API key
   */
  async validateMoonshotKey(apiKey, apiBase) {
    const response = await fetch(`${apiBase}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    const data = await response.json();
    return { valid: false, error: data.error?.message || 'Invalid API key' };
  }

  /**
   * Validate Ollama connection
   */
  async validateOllamaKey(apiBase) {
    try {
      const response = await fetch(`${apiBase}/models`);
      if (response.ok) {
        return { valid: true };
      }
      return { valid: false, error: 'Cannot connect to Ollama' };
    } catch (error) {
      return { valid: false, error: 'Cannot connect to Ollama' };
    }
  }

  /**
   * Update provider API key
   */
  async updateApiKey(providerId, apiKey) {
    if (!this.providers[providerId]) {
      throw new Error(`Provider ${providerId} not found`);
    }

    // Validate key first
    const validation = await this.validateKey(providerId, apiKey);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    this.providers[providerId].apiKey = apiKey;
    this.saveProviders();

    return { success: true };
  }
}

module.exports = new ProviderService();
