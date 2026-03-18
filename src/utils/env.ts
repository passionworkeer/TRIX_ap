import { getClawbotEndpoints, maskSecret } from '../config/clawbotEndpoints';
import { logger } from './logger';

const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

const LEGACY_PRODUCTION_REQUIRED_ENV_VARS = [
  'VITE_CLAWBOT_CHANNEL_URL',
  'VITE_GATEWAY_WS_URL',
  'VITE_GATEWAY_AUTH_TOKEN',
] as const;

const OPTIONAL_ENV_VARS = [
  'VITE_CLAWBOT_CHANNEL_URL',
  'VITE_GATEWAY_WS_URL',
  'VITE_GATEWAY_AUTH_TOKEN',
  'VITE_TRIX_NATIVE_SERVER_URL',
  'VITE_TRIX_NATIVE_PUBLIC_URL',
  'VITE_CLAWBOT_GATEWAY_URL',
  'VITE_CLAWBOT_GATEWAY_TOKEN',
  'VITE_PC_WEBSOCKET_URL',
  'VITE_PC_AUTH_TOKEN',
  'VITE_USE_SERVER_OSS_UPLOAD',
  'VITE_ALIYUN_OSS_REGION',
  'VITE_ALIYUN_OSS_BUCKET',
  'VITE_ALIYUN_OSS_ACCESS_KEY_ID',
  'VITE_ALIYUN_OSS_ACCESS_KEY_SECRET',
  'VITE_ALIYUN_OSS_ENDPOINT',
  'VITE_OSS_ENDPOINT',
  'VITE_TTS_PROXY_URL',
] as const;

interface ValidationError {
  variable: string;
  message: string;
}

interface AliyunOssEnv {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  endpoint: string;
  usingLegacyEndpointFallback: boolean;
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

function isLoopbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return isLoopbackHost(parsed.hostname);
  } catch (error) {
    logger.debug('Env', 'Failed to parse URL:', error);
    return /(^|:\/\/)(localhost|127\.0\.0\.1|\[::1\]|::1)(:|\/|$)/i.test(url);
  }
}

function validateRequiredVars(
  envVars: readonly string[],
  errors: ValidationError[],
  options?: { prefix?: string }
): void {
  const prefix = options?.prefix ?? '';

  for (const envVar of envVars) {
    const value = import.meta.env[envVar];

    if (!value || value.trim() === '') {
      errors.push({
        variable: envVar,
        message: `${prefix}Missing or empty value`.trim(),
      });
    }
  }
}

function validateEnvVars(): ValidationError[] {
  const errors: ValidationError[] = [];

  validateRequiredVars(REQUIRED_ENV_VARS, errors);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
    errors.push({
      variable: 'VITE_SUPABASE_URL',
      message: 'Invalid format: must start with "https://"',
    });
  }

  if (supabaseAnonKey && supabaseAnonKey.length < 50) {
    errors.push({
      variable: 'VITE_SUPABASE_ANON_KEY',
      message: 'Invalid format: appears too short for a valid Supabase key',
    });
  }

  if (!import.meta.env.DEV) {
    const endpoints = getClawbotEndpoints();
    const hasNativeServerConfig = Boolean(import.meta.env.VITE_TRIX_NATIVE_SERVER_URL?.trim());
    const hasLegacyGatewayConfig = LEGACY_PRODUCTION_REQUIRED_ENV_VARS.every((envVar) => {
      const value = import.meta.env[envVar];
      return Boolean(value && value.trim() !== '');
    });

    if (!hasNativeServerConfig && !hasLegacyGatewayConfig) {
      errors.push({
        variable: 'VITE_TRIX_NATIVE_SERVER_URL',
        message: 'Production requirement: set VITE_TRIX_NATIVE_SERVER_URL for the native channel, or provide the full legacy gateway trio',
      });
    }

    if (hasNativeServerConfig && endpoints.nativeServerUrl && isLoopbackUrl(endpoints.nativeServerUrl)) {
      errors.push({
        variable: 'VITE_TRIX_NATIVE_SERVER_URL',
        message: `Invalid production URL: loopback address is not allowed (${endpoints.nativeServerUrl})`,
      });
    }

    if (import.meta.env.VITE_TRIX_NATIVE_PUBLIC_URL?.trim() && endpoints.nativePublicUrl && isLoopbackUrl(endpoints.nativePublicUrl)) {
      errors.push({
        variable: 'VITE_TRIX_NATIVE_PUBLIC_URL',
        message: `Invalid production URL: loopback address is not allowed (${endpoints.nativePublicUrl})`,
      });
    }

    if (hasLegacyGatewayConfig && endpoints.channelUrl && isLoopbackUrl(endpoints.channelUrl)) {
      errors.push({
        variable: 'VITE_CLAWBOT_CHANNEL_URL',
        message: `Invalid production URL: loopback address is not allowed (${endpoints.channelUrl})`,
      });
    }

    if (hasLegacyGatewayConfig && endpoints.gatewayUrl && isLoopbackUrl(endpoints.gatewayUrl)) {
      errors.push({
        variable: 'VITE_GATEWAY_WS_URL',
        message: `Invalid production URL: loopback address is not allowed (${endpoints.gatewayUrl})`,
      });
    }
  }

  return errors;
}

function displayErrors(errors: ValidationError[]): void {
  const separator = '='.repeat(60);

  logger.ui.error(`\n${separator}`);
  logger.ui.error('  Environment Variable Validation Failed');
  logger.ui.error(`${separator}\n`);
  logger.ui.error('The application cannot start because required environment variables are missing or invalid.\n');
  logger.ui.error('Validation Errors:\n');

  errors.forEach((error, index) => {
    logger.ui.error(`  ${index + 1}. ${error.variable}`);
    logger.ui.error(`     ${error.message}\n`);
  });

  logger.ui.error('How to Fix:\n');
  logger.ui.error('  1. Copy the example file:');
  logger.ui.error('     cp .env.example .env\n');
  logger.ui.error('  2. Edit .env and fill in the required values:');

  errors.forEach((error) => {
    logger.ui.error(`     ${error.variable}=<your-value-here>`);
  });

  logger.ui.error('\n  3. For Supabase keys, see:');
  logger.ui.error('     https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/api\n');
  logger.ui.error(`${separator}\n`);
}

function displayOptionalInfo(): void {
  const optionalSet: string[] = [];
  const endpoints = getClawbotEndpoints();

  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = import.meta.env[envVar];
    if (value && value.trim() !== '') {
      optionalSet.push(envVar);
    }
  }

  if (optionalSet.length > 0) {
    logger.ui.debug(`Environment Variables: ${REQUIRED_ENV_VARS.length + optionalSet.length} variables loaded`);
    logger.ui.debug(`  - Required: ${REQUIRED_ENV_VARS.length} (all present)`);
    logger.ui.debug(`  - Optional: ${optionalSet.length} (${optionalSet.join(', ')})`);
  } else {
    logger.ui.debug('Environment Variables: All required variables loaded');
  }

  logger.ui.debug(`  - TRIX Native Server URL: ${endpoints.nativeServerUrl || 'MISSING'}`);
  logger.ui.debug(`  - TRIX Native Public URL: ${endpoints.nativePublicUrl || 'MISSING'}`);
  logger.ui.debug(`  - Clawbot Channel URL: ${endpoints.channelUrl || 'DISABLED'}`);
  logger.ui.debug(`  - OpenClaw Gateway URL: ${endpoints.gatewayUrl || 'DISABLED'}`);
  logger.ui.debug(`  - OpenClaw Gateway Token: ${maskSecret(endpoints.gatewayToken) || 'MISSING'}`);

  if (import.meta.env.VITE_OSS_ENDPOINT?.trim()) {
    logger.ui.warn(
      'Environment Variables: VITE_OSS_ENDPOINT is deprecated; prefer VITE_ALIYUN_OSS_* for OSS config.'
    );
  }
}

function normalizeLegacyOssEndpoint(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.host;
    if (!host) {
      return '';
    }
    return host;
  } catch (error) {
    logger.debug('Env', 'Failed to parse OSS endpoint URL:', error);
    return trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/\/upload\/?$/i, '')
      .replace(/\/$/, '');
  }
}

export function getAliyunOssEnv(): AliyunOssEnv {
  const legacyEndpoint = normalizeLegacyOssEndpoint(import.meta.env.VITE_OSS_ENDPOINT ?? '');
  const endpoint = import.meta.env.VITE_ALIYUN_OSS_ENDPOINT?.trim() || legacyEndpoint;

  return {
    region: import.meta.env.VITE_ALIYUN_OSS_REGION?.trim() || 'oss-cn-shenzhen',
    bucket: import.meta.env.VITE_ALIYUN_OSS_BUCKET?.trim() || 'jmtrick-assets',
    accessKeyId: import.meta.env.VITE_ALIYUN_OSS_ACCESS_KEY_ID?.trim() || '',
    accessKeySecret: import.meta.env.VITE_ALIYUN_OSS_ACCESS_KEY_SECRET?.trim() || '',
    endpoint: endpoint || 'oss-cn-shenzhen.aliyuncs.com',
    usingLegacyEndpointFallback: Boolean(legacyEndpoint) && !import.meta.env.VITE_ALIYUN_OSS_ENDPOINT?.trim(),
  };
}

export function validateEnv(): void {
  const errors = validateEnvVars();

  if (errors.length > 0) {
    displayErrors(errors);
    throw new Error(
      `Environment variable validation failed: ${errors.map((e) => e.variable).join(', ')}`
    );
  }

  if (import.meta.env.DEV) {
    displayOptionalInfo();
  }
}

export function isEnvVarSet(envVar: string): boolean {
  const value = import.meta.env[envVar];
  return Boolean(value && value.trim() !== '');
}

export function getRequiredEnv(envVar: string): string {
  const value = import.meta.env[envVar];

  if (!value || value.trim() === '') {
    throw new Error(`Required environment variable "${envVar}" is not set`);
  }

  return value;
}

export function isDev(): boolean {
  return import.meta.env.DEV;
}
