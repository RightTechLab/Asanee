import { NWCClient } from '@getalby/sdk'
import { SubWallet, WalletConfig } from '../types'
import { StorageService } from './StorageService'

/**
 * Wallet Manager - manages Master NWC connection and sub-wallets
 * Uses @getalby/sdk for robust NWC integration
 */
export class WalletManager {
    private masterNWCUri: string | null = null
    private nwcClient: any = null // NWCClient instance
    private subWallets: Map<string, SubWallet> = new Map()
    private activePubkey: string | null = null

    /**
     * Connect to Master NWC
     */
    async connect(masterUri: string): Promise<void> {

        try {
            // Create NWC client using @getalby/sdk
            this.nwcClient = new NWCClient({
                nostrWalletConnectUrl: masterUri,
            })

            // Test connection by calling get_info
            const info = await this.nwcClient.getInfo()

            if (!info) {
                throw new Error('Failed to connect to wallet')
            }

            this.masterNWCUri = masterUri
            this.activePubkey = this.extractPubkey(masterUri)


            // Save to secure storage
            await StorageService.save('master_nwc_uri', masterUri)

            // Load existing sub-wallets
            await this.loadSubWallets()
        } catch (error) {
            this.nwcClient = null
            throw new Error(error instanceof Error ? error.message : 'Invalid NWC URI')
        }
    }

    /**
     * Disconnect Master NWC
     */
    async disconnect(): Promise<void> {

        if (this.nwcClient) {
            // Close NWC connection if possible
            this.nwcClient = null
        }

        this.masterNWCUri = null
        this.activePubkey = null
        this.subWallets.clear()

        await StorageService.delete('master_nwc_uri')
        // We DON'T delete sub_wallets because they are now account-specific 
        // and should stay for when the user reconnects.
    }

    /**
     * Get NWC client for operations
     */
    getNWCClient(): any {
        return this.nwcClient
    }

    /**
     * Create a new sub-wallet connection
     * Note: This creates a logical sub-wallet. In production with full NWC support:
     * 1. Send a 'create_connection' request via Master NWC
     * 2. Receive a new scoped NWC URI with specific permissions
     * 3. Store that scoped URI
     *
     * For now, we create a logical wallet that shares the master connection
     * but tracks permissions locally for UI purposes.
     */
    async createSubWallet(config: WalletConfig): Promise<SubWallet> {

        if (!this.masterNWCUri) {
            throw new Error('Master NWC not connected')
        }

        // Generate unique ID
        const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // Create sub-wallet
        // TODO: When wallet providers support 'create_connection', implement actual scoped URI creation
        const subWallet: SubWallet = {
            id,
            name: config.name,
            nwcUri: this.masterNWCUri, // Uses master URI for now
            permissions: config.permissions,
            budgetMsat: config.budgetMsat,
            spentMsat: 0,
            receivedMsat: 0,
            fundingMsat: 0,
            createdAt: Date.now(),
            status: 'active',
            txIds: []
        }

        this.subWallets.set(id, subWallet)
        await this.saveSubWallets()

        return subWallet
    }

    /**
     * Delete a sub-wallet
     */
    async revokeSubWallet(id: string): Promise<void> {

        const wallet = this.subWallets.get(id)
        if (!wallet) {
            throw new Error('Sub-wallet not found')
        }

        // TODO: In production, send 'revoke_connection' request to wallet provider
        this.subWallets.delete(id)

        await this.saveSubWallets()
    }

    /**
     * Get a sub-wallet by ID
     */
    getWallet(id: string): SubWallet | undefined {
        return this.subWallets.get(id)
    }

    /**
     * List all sub-wallets
     */
    listWallets(): SubWallet[] {
        return Array.from(this.subWallets.values())
    }

    /**
     * Get wallet info (using NWC)
     */
    async getInfo(): Promise<any> {
        if (!this.nwcClient) {
            throw new Error('Not connected')
        }
        return await this.nwcClient.getInfo()
    }

    /**
     * Create a Lightning invoice
     */
    async makeInvoice(amountMsat: number, description?: string, walletId?: string): Promise<any> {
        if (!this.nwcClient) {
            throw new Error('Not connected')
        }
        try {
            const response = await this.nwcClient.makeInvoice({
                amount: amountMsat,
                description: description,
            })


            // If we have a walletId, we should record this invoice ID to track it when paid
            if (walletId) {
                const txId = response.payment_hash || response.id
                if (txId) {
                    const wallet = this.subWallets.get(walletId)
                    if (wallet) {
                        if (!wallet.txIds) wallet.txIds = []
                        if (!wallet.txIds.includes(txId)) {
                            wallet.txIds.push(txId)
                            await this.saveSubWallets()
                        }
                    }
                } else {
                }
            }

            return response
        } catch (error) {
            throw error
        }
    }

    /**
     * Pay a Lightning invoice
     */
    async payInvoice(invoice: string, amountMsat?: number, walletId?: string): Promise<any> {
        if (!this.nwcClient) {
            throw new Error('Not connected')
        }
        try {
            const response = await this.nwcClient.payInvoice({
                invoice: invoice,
            })


            // If we have an amount and walletId, record the spend
            if (walletId) {
                // response.payment_hash or response.id is usually the unique identifier
                const txId = response.payment_hash || response.id
                if (txId) {
                    await this.recordTransaction(walletId, amountMsat || 0, 'spent', txId)
                } else {
                    // Still record the balance change even if we don't have a unique txId
                    await this.recordTransaction(walletId, amountMsat || 0, 'spent')
                }
            }

            return response
        } catch (error) {
            throw error
        }
    }

    /**
     * List recent transactions
     */
    async listTransactions(limit = 10): Promise<any[]> {
        if (!this.nwcClient) {
            throw new Error('Not connected')
        }
        try {
            // First try standard method
            try {
                const response = await this.nwcClient.listTransactions({
                    limit,
                })
                // The response might be the array or an object containing the array
                let transactions: any[] = []
                if (Array.isArray(response)) {
                    transactions = response
                } else if (response && Array.isArray(response.transactions)) {
                    transactions = response.transactions
                }

                return transactions
            } catch (err) {
                // Fallback to raw call if SDK method fails or is missing
                const response = await this.nwcClient.call('list_transactions', {
                    limit,
                })
                const txs = response?.transactions || [];
                return txs
            }
        } catch (error) {
            return [] // Return empty array on error to prevent crashes
        }
    }

    /**
     * Resolve a Lightning Address (user@domain.com) to LNURL-pay metadata
     */
    async resolveLightningAddress(address: string): Promise<any> {
        try {
            const [user, domain] = address.split('@')
            if (!user || !domain) throw new Error('Invalid Lightning Address')

            const url = `https://${domain}/.well-known/lnurlp/${user}`
            const response = await fetch(url)
            const data = await response.json()

            if (data.status === 'ERROR') {
                throw new Error(data.reason || 'Failed to resolve LN Address')
            }

            return data
        } catch (error) {
            throw error
        }
    }

    /**
     * Get a BOLT11 invoice from an LNURL-pay callback
     */
    async getInvoiceFromLNURL(callback: string, amountMsat: number): Promise<string> {
        try {
            const url = new URL(callback)
            url.searchParams.append('amount', amountMsat.toString())

            const response = await fetch(url.toString())
            const data = await response.json()

            if (data.status === 'ERROR') {
                throw new Error(data.reason || 'Failed to fetch invoice from LNURL')
            }

            return data.pr
        } catch (error) {
            throw error
        }
    }

    /**
     * Get wallet balance (using NWC)
     */
    async getBalance(): Promise<any> {
        if (!this.nwcClient) {
            throw new Error('Not connected')
        }
        return await this.nwcClient.getBalance()
    }

    /**
     * Get specific sub-wallet balance
     * If the sub-wallet has its own URI, we fetch from there.
     * If it's the master connection, we show budget - spent.
     */
    async getWalletBalance(id: string): Promise<number | null> {
        const wallet = this.subWallets.get(id)
        if (!wallet) return null

        // If sub-wallet has its own URI that isn't the master one
        if (wallet.nwcUri !== this.masterNWCUri) {
            try {
                const tempClient = new NWCClient({ nostrWalletConnectUrl: wallet.nwcUri })
                const info = await tempClient.getBalance()
                return info.balance
            } catch (e) {
                return null
            }
        }

        // Logical sub-wallet: Balance is funding + received - spent
        return Math.max(0, (wallet.fundingMsat || 0) + wallet.receivedMsat - wallet.spentMsat)
    }

    /**
     * Fund a sub-wallet from master balance (Internal accounting)
     */
    async fundSubWallet(id: string, amountMsat: number): Promise<void> {
        const wallet = this.subWallets.get(id)
        if (!wallet) throw new Error('Wallet not found')

        wallet.fundingMsat = (wallet.fundingMsat || 0) + amountMsat
        await this.saveSubWallets()
    }

    /**
     * Record a transaction against a sub-wallet
     */
    async recordTransaction(walletId: string, amountMsat: number, type: 'spent' | 'received', txId?: string): Promise<void> {
        const wallet = this.subWallets.get(walletId)
        if (!wallet) return

        if (type === 'spent') {
            wallet.spentMsat += amountMsat
        } else {
            wallet.receivedMsat += amountMsat
        }

        if (txId) {
            if (!wallet.txIds) wallet.txIds = []
            if (!wallet.txIds.includes(txId)) {
                wallet.txIds.push(txId)
            }
        }

        await this.saveSubWallets()
    }

    /**
     * Sync wallet totals with reality
     */
    async syncWalletTotals(walletId: string, spentMsat: number, receivedMsat: number): Promise<void> {
        const wallet = this.subWallets.get(walletId)
        if (!wallet) return

        wallet.spentMsat = spentMsat
        wallet.receivedMsat = receivedMsat

        await this.saveSubWallets()
    }

    /**
     * Load sub-wallets from storage (account-specific)
     */
    private async loadSubWallets(): Promise<void> {
        if (!this.activePubkey) return

        const storageKey = `sub_wallets_${this.activePubkey}`

        const wallets = await StorageService.load<SubWallet[]>(storageKey)
        if (wallets) {
            // Ensure txIds exists for all wallets
            const sanitized = wallets.map(w => ({
                ...w,
                txIds: w.txIds || []
            }))
            this.subWallets = new Map(sanitized.map(w => [w.id, w]))
        } else {
            this.subWallets.clear()
        }
    }

    /**
     * Save sub-wallets to storage (account-specific)
     */
    private async saveSubWallets(): Promise<void> {
        if (!this.activePubkey) return

        const storageKey = `sub_wallets_${this.activePubkey}`
        const wallets = Array.from(this.subWallets.values())

        await StorageService.save(storageKey, wallets)
    }

    /**
     * Extract pubkey from NWC URI
     */
    private extractPubkey(uri: string): string | null {
        try {
            // format: nostr+walletconnect://<pubkey>?relay=...
            const url = new URL(uri.replace('nostr+walletconnect://', 'nwc://'))
            return url.hostname
        } catch (e) {
            return null
        }
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.masterNWCUri !== null && this.nwcClient !== null
    }
}

// Singleton instance
export const walletManager = new WalletManager()
