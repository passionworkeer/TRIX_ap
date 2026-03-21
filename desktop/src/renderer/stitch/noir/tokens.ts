/**
 * Monolith Noir Design System Tokens
 * "The Digital Architect" — monochromatic dark mode
 *
 * Extracted from: stitch/ai_monolith_noir/code.html + stitch/monolith_noir/DESIGN.md
 */

export const noirTokens = {
  // Surface hierarchy (dark elevation)
  'surface-container-lowest': '#0e0e0e',
  'surface-container-low': '#1c1b1b',
  'surface-container': '#201f1f',
  'surface-container-high': '#2a2a2a',
  'surface-container-highest': '#353534',
  'surface-bright': '#3a3939',
  'surface-variant': '#353534',
  'surface-dim': '#131313',

  // Primary (white on dark)
  'primary': '#ffffff',
  'on-primary': '#1a1c1c',
  'primary-fixed': '#5d5f5f',
  'primary-fixed-dim': '#454747',
  'primary-container': '#d4d4d4',
  'on-primary-container': '#000000',

  // Secondary
  'secondary': '#c8c6c5',
  'on-secondary': '#1c1b1b',
  'secondary-container': '#474746',
  'on-secondary-container': '#e5e2e1',
  'secondary-fixed': '#c8c6c5',
  'secondary-fixed-dim': '#adabaa',

  // Tertiary
  'tertiary': '#e2e2e2',
  'on-tertiary': '#1a1c1c',
  'tertiary-container': '#909191',
  'on-tertiary-container': '#000000',
  'tertiary-fixed': '#5d5f5f',
  'tertiary-fixed-dim': '#454747',

  // Error
  'error': '#ffb4ab',
  'error-container': '#93000a',
  'on-error': '#690005',
  'on-error-container': '#ffdad6',

  // Text
  'on-surface': '#e5e2e1',
  'on-surface-variant': '#c6c6c6',
  'on-background': '#e5e2e1',

  // Inverse
  'inverse-surface': '#e5e2e1',
  'inverse-on-surface': '#313030',
  'inverse-primary': '#5d5f5f',

  // Outlines
  'outline': '#919191',
  'outline-variant': '#474747',

  // Surface tint
  'surface-tint': '#c6c6c7',

  // Background
  'background': '#131313',
} as const;

export type NoirToken = keyof typeof noirTokens;

// Tailwind CSS v4 @theme CSS variable format
export const noirThemeVars = `
  --color-noir-container-lowest: ${noirTokens['surface-container-lowest']};
  --color-noir-container-low: ${noirTokens['surface-container-low']};
  --color-noir-container: ${noirTokens['surface-container']};
  --color-noir-container-high: ${noirTokens['surface-container-high']};
  --color-noir-container-highest: ${noirTokens['surface-container-highest']};
  --color-noir-bright: ${noirTokens['surface-bright']};
  --color-noir-variant: ${noirTokens['surface-variant']};
  --color-noir-dim: ${noirTokens['surface-dim']};

  --color-noir-primary: ${noirTokens['primary']};
  --color-noir-on-primary: ${noirTokens['on-primary']};
  --color-noir-fixed: ${noirTokens['primary-fixed']};
  --color-noir-fixed-dim: ${noirTokens['primary-fixed-dim']};
  --color-noir-container: ${noirTokens['primary-container']};
  --color-noir-on-container: ${noirTokens['on-primary-container']};

  --color-noir-secondary: ${noirTokens['secondary']};
  --color-noir-on-secondary: ${noirTokens['on-secondary']};
  --color-noir-secondary-container: ${noirTokens['secondary-container']};
  --color-noir-secondary-fixed: ${noirTokens['secondary-fixed']};
  --color-noir-secondary-fixed-dim: ${noirTokens['secondary-fixed-dim']};

  --color-noir-tertiary: ${noirTokens['tertiary']};
  --color-noir-on-tertiary: ${noirTokens['on-tertiary']};
  --color-noir-tertiary-container: ${noirTokens['tertiary-container']};
  --color-noir-tertiary-fixed: ${noirTokens['tertiary-fixed']};
  --color-noir-tertiary-fixed-dim: ${noirTokens['tertiary-fixed-dim']};

  --color-noir-error: ${noirTokens['error']};
  --color-noir-error-container: ${noirTokens['error-container']};
  --color-noir-on-error: ${noirTokens['on-error']};
  --color-noir-on-error-container: ${noirTokens['on-error-container']};

  --color-noir-on-surface: ${noirTokens['on-surface']};
  --color-noir-on-surface-variant: ${noirTokens['on-surface-variant']};
  --color-noir-on-background: ${noirTokens['on-background']};

  --color-noir-outline: ${noirTokens['outline']};
  --color-noir-outline-variant: ${noirTokens['outline-variant']};

  --color-noir-inverse-surface: ${noirTokens['inverse-surface']};
  --color-noir-inverse-on-surface: ${noirTokens['inverse-on-surface']};
  --color-noir-inverse-primary: ${noirTokens['inverse-primary']};

  --color-noir-tint: ${noirTokens['surface-tint']};
  --color-noir-background: ${noirTokens['background']};
`.trim();
