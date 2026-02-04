import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';

/**
 * Security Service - handles biometric and passcode authentication
 */
export class SecurityService {
    /**
     * Check if hardware supports biometrics
     */
    static async isSupported(): Promise<boolean> {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        return hasHardware && isEnrolled;
    }

    /**
     * Authenticate the user
     * @param reason - The reason for authentication shown to the user
     * @returns Promise<boolean> - true if authenticated
     */
    static async authenticate(reason: string = 'Confirm your identity'): Promise<boolean> {
        try {
            const results = await LocalAuthentication.authenticateAsync({
                promptMessage: reason,
                fallbackLabel: 'Use Passcode',
                disableDeviceFallback: false,
                cancelLabel: 'Cancel',
            });

            if (results.success) {
                return true;
            }

            if (results.error === 'not_enrolled' || results.error === 'not_available') {
                // If biometrics not set up, we assume it's "authenticated" OR we could ask for app password
                // but usually expo-local-authentication handles passcode fallback
                return false;
            }

            return false;
        } catch (error) {
            Alert.alert('Security', 'Authentication failed');
            return false;
        }
    }
}
