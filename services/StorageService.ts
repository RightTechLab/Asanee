import * as SecureStore from 'expo-secure-store'
import { SubWallet } from '../types'

/**
 * Storage Service - handles encrypted storage using expo-secure-store
 */
export class StorageService {
    /**
     * Save data to secure storage
     */
    /**
     * Save data to secure storage
     * Handles chunking for large data > 2048 bytes
     */
    static async save(key: string, data: any): Promise<void> {
        try {
            const value = typeof data === 'string' ? data : JSON.stringify(data)
            
            // Check if data needs chunking (2000 chars safety margin)
            if (value.length > 2000) {
                const chunks = []
                for (let i = 0; i < value.length; i += 2000) {
                    chunks.push(value.slice(i, i + 2000))
                }

                // Save chunks
                await Promise.all(chunks.map((chunk, index) => 
                    SecureStore.setItemAsync(`${key}_chunk_${index}`, chunk)
                ))

                // Save metadata
                await SecureStore.setItemAsync(key, JSON.stringify({
                    _isChunked: true,
                    count: chunks.length
                }))
            } else {
                await SecureStore.setItemAsync(key, value)
            }
        } catch (error) {
            console.error('Failed to save to secure storage', error)
        }
    }

    /**
     * Load data from secure storage
     */
    /**
     * Load data from secure storage
     * Handles chunked data reassembly
     */
    static async load<T>(key: string): Promise<T | null> {
        try {
            const data = await SecureStore.getItemAsync(key)
            if (!data) return null

            let finalData = data

            // Check for chunked data
            try {
                const parsed = JSON.parse(data)
                if (parsed && parsed._isChunked) {
                    const chunkPromises = []
                    for (let i = 0; i < parsed.count; i++) {
                        chunkPromises.push(SecureStore.getItemAsync(`${key}_chunk_${i}`))
                    }
                    const chunks = await Promise.all(chunkPromises)
                    finalData = chunks.join('')
                }
            } catch {
                // Not JSON or simple string, strictly not chunked metadata
            }

            // Try to parse as JSON, if it fails, return as is (for strings)
            try {
                return JSON.parse(finalData) as T
            } catch {
                return finalData as unknown as T
            }
        } catch (error) {
            console.error('Failed to load from secure storage', error)
            return null
        }
    }

    /**
     * Delete key from secure storage
     */
    /**
     * Delete key from secure storage
     * Handles cleaning up chunks
     */
    static async delete(key: string): Promise<void> {
        try {
            // Check if chunked first
            const data = await SecureStore.getItemAsync(key)
            if (data) {
                try {
                    const parsed = JSON.parse(data)
                    if (parsed && parsed._isChunked) {
                        const deletePromises = []
                        for (let i = 0; i < parsed.count; i++) {
                            deletePromises.push(SecureStore.deleteItemAsync(`${key}_chunk_${i}`))
                        }
                        await Promise.all(deletePromises)
                    }
                } catch {
                    // Not a JSON metadata
                }
            }
            await SecureStore.deleteItemAsync(key)
        } catch (error) {
            console.error('Failed to delete from secure storage', error)
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
