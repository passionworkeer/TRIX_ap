/**
 * Lumina Design System Tokens
 * "The Digital Atheneum" — warm minimalist light mode
 *
 * Extracted from: stitch/chat/code.html + stitch/lumina_desktop/DESIGN.md
 */

export const luminaTokens = {
  // Surface hierarchy (elevation-based backgrounds)
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#f2f4f6',
  'surface-container': '#eceef0',
  'surface-container-high': '#e6e8ea',
  'surface-container-highest': '#e0e3e5',
  'surface-dim': '#d8dadc',
  'surface-bright': '#f7f9fb',
  'surface-tint': '#732ee4',

  // Primary
  'primary': '#630ed4',
  'primary-container': '#7c3aed',
  'on-primary': '#ffffff',
  'on-primary-container': '#ede0ff',

  // Secondary
  'secondary': '#6a4fa0',
  'secondary-container': '#c4a7ff',
  'on-secondary': '#ffffff',
  'on-secondary-container': '#523787',

  // Tertiary
  'tertiary': '#7d3d00',
  'tertiary-container': '#a15100',
  'on-tertiary': '#ffffff',
  'on-tertiary-container': '#ffe0cd',

  // Error
  'error': '#ba1a1a',
  'error-container': '#ffdad6',
  'on-error': '#ffffff',
  'on-error-container': '#93000a',

  // Text
  'on-surface': '#191c1e',
  'on-surface-variant': '#4a4455',
  'on-background': '#191c1e',

  // Outlines
  'outline': '#7b7487',
  'outline-variant': '#ccc3d8',

  // Inverse (for overlays)
  'inverse-surface': '#2d3133',
  'inverse-on-surface': '#eff1f3',
  'inverse-primary': '#d2bbff',

  // Surface variant
  'surface-variant': '#e0e3e5',

  // Background alias
  'background': '#f7f9fb',
} as const;

export type LuminaToken = keyof typeof luminaTokens;

// Tailwind CSS v4 @theme CSS variable format
export const luminaThemeVars = `
  --color-surface-container-lowest: ${luminaTokens['surface-container-lowest']};
  --color-surface-container-low: ${luminaTokens['surface-container-low']};
  --color-surface-container: ${luminaTokens['surface-container']};
  --color-surface-container-high: ${luminaTokens['surface-container-high']};
  --color-surface-container-highest: ${luminaTokens['surface-container-highest']};
  --color-surface-dim: ${luminaTokens['surface-dim']};
  --color-surface-bright: ${luminaTokens['surface-bright']};
  --color-surface-tint: ${luminaTokens['surface-tint']};

  --color-primary: ${luminaTokens['primary']};
  --color-primary-container: ${luminaTokens['primary-container']};
  --color-on-primary: ${luminaTokens['on-primary']};
  --color-on-primary-container: ${luminaTokens['on-primary-container']};

  --color-secondary: ${luminaTokens['secondary']};
  --color-secondary-container: ${luminaTokens['secondary-container']};
  --color-on-secondary: ${luminaTokens['on-secondary']};
  --color-on-secondary-container: ${luminaTokens['on-secondary-container']};

  --color-tertiary: ${luminaTokens['tertiary']};
  --color-tertiary-container: ${luminaTokens['tertiary-container']};
  --color-on-tertiary: ${luminaTokens['on-tertiary']};
  --color-on-tertiary-container: ${luminaTokens['on-tertiary-container']};

  --color-error: ${luminaTokens['error']};
  --color-error-container: ${luminaTokens['error-container']};
  --color-on-error: ${luminaTokens['on-error']};
  --color-on-error-container: ${luminaTokens['on-error-container']};

  --color-on-surface: ${luminaTokens['on-surface']};
  --color-on-surface-variant: ${luminaTokens['on-surface-variant']};
  --color-on-background: ${luminaTokens['on-background']};

  --color-outline: ${luminaTokens['outline']};
  --color-outline-variant: ${luminaTokens['outline-variant']};

  --color-inverse-surface: ${luminaTokens['inverse-surface']};
  --color-inverse-on-surface: ${luminaTokens['inverse-on-surface']};
  --color-inverse-primary: ${luminaTokens['inverse-primary']};

  --color-surface-variant: ${luminaTokens['surface-variant']};
  --color-background: ${luminaTokens['background']};
`.trim();
