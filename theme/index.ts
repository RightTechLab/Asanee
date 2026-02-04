import { MD3DarkTheme } from 'react-native-paper'

/**
 * Electric Wasp Theme - Netflix-style Yellow & Black
 */
export const ElectricWaspTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        primary: '#FFD700', // Electric Yellow
        primaryContainer: '#333300',
        secondary: '#F5C518', // Golden Yellow
        secondaryContainer: '#3d3300',
        background: '#000000', // Pure Black
        surface: '#141414', // Netflix Dark Gray
        surfaceVariant: '#1f1f1f',
        error: '#CF6679',
        onPrimary: '#000000', // Black text on yellow
        onSecondary: '#000000',
        onBackground: '#FFFFFF', // White text on black
        onSurface: '#FFFFFF',
        onSurfaceVariant: '#E0E0E0',
        outline: '#FFD700',
    },
    roundness: 8,
}
