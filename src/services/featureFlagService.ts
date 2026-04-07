/**
 * Feature Flag Service
 *
 * Remote configuration system for feature flags using Supabase.
 * Supports percentage rollouts, user targeting, and environment-based flags.
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// ============================================
// Types
// ============================================

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  value?: string | number | boolean;
  description?: string;
  /** Environment: development, staging, production */
  environment: string;
  /** Rollout percentage (0-100), default 100 */
  rolloutPercentage?: number;
  /** User ID targeting (optional) */
  targetUserIds?: string[];
  /** Feature flag group targeting */
  targetGroups?: string[];
  /** When the flag was last updated */
  updatedAt: string;
}

export interface FeatureFlagConfig {
  [key: string]: FeatureFlag;
}

// ============================================
// Storage Keys
// ============================================

const FEATURE_FLAGS_STORAGE_KEY = 'trix_feature_flags';
const FEATURE_FLAGS_TIMESTAMP_KEY = 'trix_feature_flags_timestamp';
const FEATURE_FLAGS_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

// ============================================
// Default Flags (fallback values)
// ============================================

const DEFAULT_FLAGS: FeatureFlagConfig = {
  'new-chat-ui': {
    key: 'new-chat-ui',
    enabled: false,
    description: 'Enable new chat interface',
    environment: 'production',
    rolloutPercentage: 0,
    updatedAt: new Date().toISOString(),
  },
  'voice-messages': {
    key: 'voice-messages',
    enabled: true,
    description: 'Enable voice message recording',
    environment: 'production',
    rolloutPercentage: 100,
    updatedAt: new Date().toISOString(),
  },
  'study-room-v2': {
    key: 'study-room-v2',
    enabled: false,
    description: 'Enable new study room experience',
    environment: 'production',
    rolloutPercentage: 10,
    updatedAt: new Date().toISOString(),
  },
  'ai-companion': {
    key: 'ai-companion',
    enabled: true,
    description: 'Enable AI companion features',
    environment: 'production',
    rolloutPercentage: 100,
    updatedAt: new Date().toISOString(),
  },
  'web-push': {
    key: 'web-push',
    enabled: false,
    description: 'Enable Web Push notifications',
    environment: 'production',
    rolloutPercentage: 0,
    updatedAt: new Date().toISOString(),
  },
  'maintenance-mode': {
    key: 'maintenance-mode',
    enabled: false,
    description: 'Enable maintenance mode',
    environment: 'production',
    rolloutPercentage: 0,
    updatedAt: new Date().toISOString(),
  },
};

// ============================================
// Environment Detection
// ============================================

function getCurrentEnvironment(): string {
  if (typeof window === 'undefined') return 'production';

  // Check for explicit environment override
  const envOverride = import.meta.env.VITE_FEATURE_FLAG_ENV;
  if (envOverride) return envOverride;

  // Infer from hostname
  const hostname = window.location.hostname;
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'development';
  }
  if (hostname.includes('staging') || hostname.includes('preview')) {
    return 'staging';
  }
  return 'production';
}

// ============================================
// Local Storage Cache
// ============================================

function getCachedFlags(): { flags: FeatureFlagConfig; timestamp: number } | null {
  try {
    const rawFlags = localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
    const rawTimestamp = localStorage.getItem(FEATURE_FLAGS_TIMESTAMP_KEY);

    if (!rawFlags || !rawTimestamp) return null;

    const flags = JSON.parse(rawFlags) as FeatureFlagConfig;
    const timestamp = parseInt(rawTimestamp, 10);

    return { flags, timestamp };
  } catch {
    return null;
  }
}

function setCachedFlags(flags: FeatureFlagConfig): void {
  try {
    localStorage.setItem(FEATURE_FLAGS_STORAGE_KEY, JSON.stringify(flags));
    localStorage.setItem(FEATURE_FLAGS_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    logger.warn('FeatureFlags', 'Failed to cache flags:', error);
  }
}

// ============================================
// Supabase Fetch
// ============================================

async function fetchFlagsFromSupabase(): Promise<FeatureFlagConfig> {
  const environment = getCurrentEnvironment();

  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('environment', environment)
    .eq('enabled', true);

  if (error) {
    logger.warn('FeatureFlags', 'Failed to fetch from Supabase:', error);
    return {};
  }

  const flags: FeatureFlagConfig = {};
  for (const row of data || []) {
    flags[row.key] = {
      key: row.key,
      enabled: row.enabled,
      value: row.value,
      description: row.description,
      environment: row.environment,
      rolloutPercentage: row.rollout_percentage,
      targetUserIds: row.target_user_ids,
      targetGroups: row.target_groups,
      updatedAt: row.updated_at,
    };
  }

  return flags;
}

// ============================================
// Merge with Defaults
// ============================================

function mergeWithDefaults(remoteFlags: FeatureFlagConfig): FeatureFlagConfig {
  return {
    ...DEFAULT_FLAGS,
    ...remoteFlags,
  };
}

// ============================================
// Core Service
// ============================================

class FeatureFlagServiceImpl {
  private flags: FeatureFlagConfig = { ...DEFAULT_FLAGS };
  private listeners = new Set<(flags: FeatureFlagConfig) => void>();
  private initialized = false;

  /**
   * Initialize the feature flag service.
   * Loads cached flags immediately, then fetches fresh flags from Supabase.
   */
  async initialize(): Promise<void> {
    if (this.initialized && typeof window !== 'undefined') {
      return;
    }

    // Load from cache immediately
    const cached = getCachedFlags();
    if (cached) {
      const cacheAge = Date.now() - cached.timestamp;
      if (cacheAge < FEATURE_FLAGS_TTL_MS) {
        this.flags = mergeWithDefaults(cached.flags);
      }
    }

    this.initialized = true;

    // Fetch fresh flags in background
    this.refresh();
  }

  /**
   * Force refresh flags from Supabase.
   */
  async refresh(): Promise<void> {
    try {
      const remoteFlags = await fetchFlagsFromSupabase();
      const merged = mergeWithDefaults(remoteFlags);
      this.flags = merged;
      setCachedFlags(merged);
      this.notifyListeners();
    } catch (error) {
      logger.error('FeatureFlags', 'Refresh failed:', error);
    }
  }

  /**
   * Check if a feature flag is enabled.
   *
   * @param key - Feature flag key
   * @param userId - Optional user ID for targeting
   * @returns boolean indicating if the feature is enabled
   */
  isEnabled(key: string, userId?: string): boolean {
    const flag = this.flags[key];
    if (!flag) {
      // Unknown flags default to disabled
      return false;
    }

    // Check maintenance mode first
    if (key !== 'maintenance-mode' && this.flags['maintenance-mode']?.enabled) {
      return false;
    }

    // Check user targeting
    if (flag.targetUserIds && flag.targetUserIds.length > 0) {
      if (userId && flag.targetUserIds.includes(userId)) {
        return true;
      }
      // User not in target list, check rollout
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      // Use userId as consistent hash for percentage rollout
      const hashKey = userId || key;
      const hash = this.simpleHash(hashKey);
      const bucket = hash % 100;
      return bucket < flag.rolloutPercentage;
    }

    return flag.enabled;
  }

  /**
   * Get a feature flag value.
   *
   * @param key - Feature flag key
   * @param defaultValue - Default value if flag not found
   * @returns The flag value or default
   */
  getValue<T extends string | number | boolean>(key: string, defaultValue: T): T {
    const flag = this.flags[key];
    if (!flag || flag.value === undefined) {
      return defaultValue;
    }
    return (flag.value as T) ?? defaultValue;
  }

  /**
   * Get all feature flags.
   */
  getAllFlags(): FeatureFlagConfig {
    return { ...this.flags };
  }

  /**
   * Subscribe to flag changes.
   */
  subscribe(listener: (flags: FeatureFlagConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.flags);
      } catch (error) {
        logger.error('FeatureFlags', 'Listener error:', error);
      }
    }
  }

  /**
   * Simple hash function for consistent percentage rollouts.
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// ============================================
// Singleton Instance
// ============================================

export const featureFlagService = new FeatureFlagServiceImpl();

// ============================================
// React Hook (for Web app)
// ============================================

let reactHooksAvailable = false;
try {
  // Check if React is available
  if (typeof window !== 'undefined' && (window as any).React) {
    reactHooksAvailable = true;
  }
} catch {}

// ============================================
// Direct Export
// ============================================

export const isFeatureEnabled = (key: string, userId?: string) =>
  featureFlagService.isEnabled(key, userId);

export const getFeatureValue = <T extends string | number | boolean>(
  key: string,
  defaultValue: T
) => featureFlagService.getValue(key, defaultValue);

export default featureFlagService;
