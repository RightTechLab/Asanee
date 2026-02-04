import * as SecureStore from 'expo-secure-store'
import { SubWallet } from '../types'

/**
 * Storage Service - handles encrypted storage using expo-secure-store
 */
export class StorageService {
    /**
     * Save data to secure storage
     */
    static async save(key: string, data: any): Promise<void> {
        try {
            const value = typeof data === 'string' ? data : JSON.stringify(data)
            await SecureStore.setItemAsync(key, value)
        } catch (error) {
            console.error(`Error saving to SecureStore [${key}]:`, error)
        }
    }

    /**
     * Load data from secure storage
     */
    static async load<T>(key: string): Promise<T | null> {
        try {
            const data = await SecureStore.getItemAsync(key)
            if (!data) return null

            // Try to parse as JSON, if it fails, return as is (for strings)
            try {
                return JSON.parse(data) as T
            } catch {
                return data as unknown as T
            }
        } catch (error) {
            console.error(`Error loading from SecureStore [${key}]:`, error)
            return null
        }
    }

    /**
     * Delete key from secure storage
     */
    static async delete(key: string): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(key)
        } catch (error) {
            console.error(`Error deleting from SecureStore [${key}]:`, error)
        }
    }

    /**
     * Clear all data - Note: SecureStore doesn't have a clear all method
     */
    static async clear(): Promise<void> {
        // Implementation would require tracking keys
        // For now, we manually delete known keys in WalletManager.disconnect
    }
}
