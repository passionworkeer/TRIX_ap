/**
 * Environment Variable Validation
 *
 * Validates that all required environment variables are present at application startup.
 * Displays clear error messages in the console if any are missing.
 */

// Required environment variables
const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

// Optional environment variables (for informational purposes)
const OPTIONAL_ENV_VARS = [
  'VITE_PC_WEBSOCKET_URL',
  'VITE_PC_AUTH_TOKEN',
  'VITE_NANOBOT_SERVER_URL',
  'VITE_OSS_ENDPOINT',
] as const;

interface ValidationError {
  variable: string;
  message: string;
}

/**
 * Validates all required environment variables
 * @returns Array of validation errors (empty if all valid)
 */
function validateEnvVars(): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = import.meta.env[envVar];

    if (!value || value.trim() === '') {
      errors.push({
        variable: envVar,
        message: `Missing or empty value`,
      });
    } else if (envVar === 'VITE_SUPABASE_URL' && !value.startsWith('https://')) {
      errors.push({
        variable: envVar,
        message: `Invalid format: must start with "https://"`,
      });
    } else if (envVar === 'VITE_SUPABASE_ANON_KEY' && value.length < 50) {
      errors.push({
        variable: envVar,
        message: `Invalid format: appears too short for a valid Supabase key`,
      });
    }
  }

  return errors;
}

/**
 * Displays environment variable validation errors in the console
 */
function displayErrors(errors: ValidationError[]): void {
  const separator = '='.repeat(60);

  console.error(`\n${separator}`);
  console.error(`  ❌ Environment Variable Validation Failed`);
  console.error(`${separator}\n`);
  console.error(`The application cannot start because required environment variables are missing.\n`);
  console.error(`Missing Variables:\n`);

  errors.forEach((error, index) => {
    console.error(`  ${index + 1}. ${error.variable}`);
    console.error(`     ${error.message}\n`);
  });

  console.error(`How to Fix:\n`);
  console.error(`  1. Copy the example file:`);
  console.error(`     cp .env.example .env\n`);
  console.error(`  2. Edit .env and fill in the required values:`);

  errors.forEach((error) => {
    console.error(`     ${error.variable}=<your-value-here>`);
  });

  console.error(`\n  3. For more information, see:`);
  console.error(`     https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/api\n`);
  console.error(`${separator}\n`);
}

/**
 * Displays information about optional environment variables
 */
function displayOptionalInfo(): void {
  const optionalSet: string[] = [];

  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = import.meta.env[envVar];
    if (value && value.trim() !== '') {
      optionalSet.push(envVar);
    }
  }

  if (optionalSet.length > 0) {
    console.log(`✅ Environment Variables: ${REQUIRED_ENV_VARS.length + optionalSet.length} variables loaded`);
    console.log(`   - Required: ${REQUIRED_ENV_VARS.length} (all present)`);
    console.log(`   - Optional: ${optionalSet.length} (${optionalSet.join(', ')})`);
  } else {
    console.log(`✅ Environment Variables: All required variables loaded`);
  }
}

/**
 * Validates environment variables and throws an error if any are missing
 * @throws {Error} If any required environment variable is missing or invalid
 */
export function validateEnv(): void {
  const errors = validateEnvVars();

  if (errors.length > 0) {
    displayErrors(errors);
    throw new Error(
      `Environment variable validation failed: ${errors.map(e => e.variable).join(', ')}`
    );
  }

  displayOptionalInfo();
}

/**
 * Checks if a specific environment variable is set
 * @param envVar - The environment variable name
 * @returns true if the variable is set and non-empty
 */
export function isEnvVarSet(envVar: string): boolean {
  const value = import.meta.env[envVar];
  return Boolean(value && value.trim() !== '');
}

/**
 * Gets an environment variable or throws an error if not set
 * @param envVar - The environment variable name
 * @returns The environment variable value
 * @throws {Error} If the variable is not set
 */
export function getRequiredEnv(envVar: string): string {
  const value = import.meta.env[envVar];

  if (!value || value.trim() === '') {
    throw new Error(`Required environment variable "${envVar}" is not set`);
  }

  return value;
}
