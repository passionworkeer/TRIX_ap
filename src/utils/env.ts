import { getClawbotEndpoints, maskSecret } from '../config/clawbotEndpoints';

const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

const PRODUCTION_REQUIRED_ENV_VARS = [
  'VITE_CLAWBOT_CHANNEL_URL',
  'VITE_GATEWAY_WS_URL',
  'VITE_GATEWAY_AUTH_TOKEN',
] as const;

const OPTIONAL_ENV_VARS = [
  'VITE_CLAWBOT_CHANNEL_URL',
  'VITE_GATEWAY_WS_URL',
  'VITE_GATEWAY_AUTH_TOKEN',
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
  } catch {
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
    validateRequiredVars(PRODUCTION_REQUIRED_ENV_VARS, errors, {
      prefix: 'Production requirement: ',
    });

    const endpoints = getClawbotEndpoints();

    if (endpoints.channelUrl && isLoopbackUrl(endpoints.channelUrl)) {
      errors.push({
        variable: 'VITE_CLAWBOT_CHANNEL_URL',
        message: `Invalid production URL: loopback address is not allowed (${endpoints.channelUrl})`,
      });
    }

    if (endpoints.gatewayUrl && isLoopbackUrl(endpoints.gatewayUrl)) {
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

  console.error(`\n${separator}`);
  console.error('  Environment Variable Validation Failed');
  console.error(`${separator}\n`);
  console.error('The application cannot start because required environment variables are missing or invalid.\n');
  console.error('Validation Errors:\n');

  errors.forEach((error, index) => {
    console.error(`  ${index + 1}. ${error.variable}`);
    console.error(`     ${error.message}\n`);
  });

  console.error('How to Fix:\n');
  console.error('  1. Copy the example file:');
  console.error('     cp .env.example .env\n');
  console.error('  2. Edit .env and fill in the required values:');

  errors.forEach((error) => {
    console.error(`     ${error.variable}=<your-value-here>`);
  });

  console.error('\n  3. For Supabase keys, see:');
  console.error('     https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/api\n');
  console.error(`${separator}\n`);
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
    console.log(`Environment Variables: ${REQUIRED_ENV_VARS.length + optionalSet.length} variables loaded`);
    console.log(`  - Required: ${REQUIRED_ENV_VARS.length} (all present)`);
    console.log(`  - Optional: ${optionalSet.length} (${optionalSet.join(', ')})`);
  } else {
    console.log('Environment Variables: All required variables loaded');
  }

  console.log(`  - Clawbot Channel URL: ${endpoints.channelUrl}`);
  console.log(`  - OpenClaw Gateway URL: ${endpoints.gatewayUrl}`);
  console.log(`  - OpenClaw Gateway Token: ${maskSecret(endpoints.gatewayToken) || 'MISSING'}`);

  if (import.meta.env.VITE_OSS_ENDPOINT?.trim()) {
    console.warn(
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
  } catch {
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
