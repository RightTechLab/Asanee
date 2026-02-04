import { SubWallet, NWCPermission } from '../types'

/**
 * Storage Service - handles encrypted storage using expo-secure-store
 */
export class StorageService {
    /**
     * Save encrypted data to secure storage
     */
    static async save(key: string, data: any): Promise<void> {
        const { setItemAsync } = await import('expo-secure-store')
        await setItemAsync(key, JSON.stringify(data))
    }

    /**
     * Load encrypted data from secure storage
     */
    static async load<T>(key: string): Promise<T | null> {
        const { getItemAsync } = await import('expo-secure-store')
        const data = await getItemAsync(key)
        if (!data) return null
        return JSON.parse(data) as T
    }

    /**
     * Delete key from secure storage
     */
    static async delete(key: string): Promise<void> {
        const { deleteItemAsync } = await import('expo-secure-store')
        await deleteItemAsync(key)
    }

    /**
     * Clear all data
     */
    static async clear(): Promise<void> {
        // Note: expo-secure-store doesn't have a clear all method
        // Would need to track keys separately
    }
}
