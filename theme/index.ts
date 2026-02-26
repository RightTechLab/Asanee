import { MD3DarkTheme } from 'react-native-paper'

/**
 * Asanee Design System — Minimal Premium Black/Gold
 */

// ─── Design Tokens ──────────────────────────────────────────────
export const Colors = {
    bg: '#000000',
    surface: '#0A0A0A',
    surfaceElevated: '#111111',
    surfaceBorder: '#1A1A1A',
    accent: '#F7B731',
    accentDim: 'rgba(247,183,49,0.12)',
    accentText: '#000000',
    text: '#F5F5F5',
    textSecondary: '#6B6B6B',
    textTertiary: '#3A3A3A',
    success: '#34D399',
    danger: '#EF4444',
}

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
}

export const Radius = {
    sm: 8,
    md: 14,
    lg: 20,
    full: 999,
}

// ─── React Native Paper Theme ───────────────────────────────────
export const ElectricWaspTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        primary: Colors.accent,
        primaryContainer: '#2A2000',
        secondary: '#E5A825',
        secondaryContainer: '#2A2000',
        background: Colors.bg,
        surface: Colors.surface,
        surfaceVariant: Colors.surfaceElevated,
        error: '#EF4444',
        onPrimary: Colors.accentText,
        onSecondary: Colors.accentText,
        onBackground: Colors.text,
        onSurface: Colors.text,
        onSurfaceVariant: '#CCCCCC',
        outline: Colors.surfaceBorder,
    },
    roundness: Radius.md,
}
