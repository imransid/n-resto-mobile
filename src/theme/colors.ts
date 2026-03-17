/**
 * Modern POS color palette — refined, accessible, easy on the eyes.
 * Teal primary with warm neutrals for a calm, professional feel.
 */
export const colors = {
  // Primary: teal (distinctive, professional, not harsh)
  primary: '#0d9488',
  primaryDark: '#0f766e',
  primaryLight: '#ccfbf1',
  primaryMuted: 'rgba(13, 148, 136, 0.12)',
  primaryContrast: '#ffffff',

  // Secondary: soft blue for links / secondary actions
  secondary: '#0891b2',
  secondaryMuted: 'rgba(8, 145, 178, 0.12)',

  // Surfaces: warm neutrals
  surface: '#ffffff',
  surfaceSecondary: '#f8fafc',
  surfaceTertiary: '#f1f5f9',
  surfaceElevated: '#ffffff',

  // Text hierarchy
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  textSubtle: '#94a3b8',

  // Borders
  border: '#e2e8f0',
  borderLight: '#f1f5f9',

  // Semantic
  success: '#0d9488',
  warning: '#d97706',
  error: '#dc2626',

  // Overlays
  overlay: 'rgba(15, 23, 42, 0.48)',
  overlayLight: 'rgba(15, 23, 42, 0.32)',

  // Dark (login, header)
  dark: '#0f172a',
  darkCard: 'rgba(30, 41, 59, 0.75)',
  darkBorder: 'rgba(71, 85, 105, 0.45)',
  darkInput: 'rgba(15, 23, 42, 0.85)',
} as const;

export type Colors = typeof colors;
