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
        console.log('🔌 Starting NWC connection...');
        console.log('📝 Master URI length:', masterUri.length);

        try {
            console.log('🏗️  Creating NWC client...');
            // Create NWC client using @getalby/sdk
            this.nwcClient = new NWCClient({
                nostrWalletConnectUrl: masterUri,
            })
            console.log('✅ NWC client created successfully');

            console.log('🔍 Testing connection with get_info...');
            // Test connection by calling get_info
            const info = await this.nwcClient.getInfo()
            console.log('📊 Wallet info received:', JSON.stringify(info, null, 2));

            if (!info) {
                throw new Error('Failed to connect to wallet')
            }

            this.masterNWCUri = masterUri
            this.activePubkey = this.extractPubkey(masterUri)
            console.log('🔑 Active Pubkey:', this.activePubkey);

            console.log('💾 Saving master URI to secure storage...');

            // Save to secure storage
            await StorageService.save('master_nwc_uri', masterUri)
            console.log('✅ Master URI saved');

            console.log('📂 Loading existing sub-wallets for this account...');
            // Load existing sub-wallets
            await this.loadSubWallets()
            console.log(`✅ Connection complete! Loaded ${this.subWallets.size} sub-wallets for account ${this.activePubkey}`);
        } catch (error) {
            console.error('❌ Connection failed:', error);
            console.error('Error details:', error instanceof Error ? error.message : error);
            this.nwcClient = null
            throw new Error(error instanceof Error ? error.message : 'Invalid NWC URI')
        }
    }

    /**
     * Disconnect Master NWC
     */
    async disconnect(): Promise<void> {
        console.log('🔌 Disconnecting wallet...');

        if (this.nwcClient) {
            console.log('🔒 Closing NWC client...');
            // Close NWC connection if possible
            this.nwcClient = null
        }

        this.masterNWCUri = null
        this.activePubkey = null
        console.log(`🗑️  Clearing ${this.subWallets.size} sub-wallets from memory...`);
        this.subWallets.clear()

        console.log('💾 Removing current session data...');
        await StorageService.delete('master_nwc_uri')
        // We DON'T delete sub_wallets because they are now account-specific 
        // and should stay for when the user reconnects.
        console.log('✅ Wallet disconnected successfully');
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
        console.log('🆕 Creating sub-wallet:', config.name);
        console.log('📋 Config:', JSON.stringify(config, null, 2));

        if (!this.masterNWCUri) {
            console.error('❌ Master NWC not connected');
            throw new Error('Master NWC not connected')
        }

        // Generate unique ID
        const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        console.log('🔑 Generated wallet ID:', id);

        // Create sub-wallet
        // TODO: When wallet providers support 'create_connection', implement actual scoped URI creation
        const subWallet: SubWallet = {
            id,
            name: config.name,
            nwcUri: this.masterNWCUri, // Uses master URI for now
            permissions: config.permissions,
            budgetMsat: config.budgetMsat,
            createdAt: Date.now(),
            status: 'active'
        }
        console.log('💼 Sub-wallet created:', JSON.stringify(subWallet, null, 2));

        this.subWallets.set(id, subWallet)
        console.log(`💾 Saving sub-wallets (total: ${this.subWallets.size})...`);
        await this.saveSubWallets()
        console.log('✅ Sub-wallet creation complete');

        return subWallet
    }

    /**
     * Revoke a sub-wallet
     */
    async revokeSubWallet(id: string): Promise<void> {
        console.log('🚫 Revoking sub-wallet:', id);

        const wallet = this.subWallets.get(id)
        if (!wallet) {
            console.error('❌ Sub-wallet not found:', id);
            throw new Error('Sub-wallet not found')
        }

        console.log('📝 Revoking wallet:', wallet.name);
        // TODO: In production, send 'revoke_connection' request to wallet provider
        wallet.status = 'revoked'

        console.log('💾 Saving updated wallet list...');
        await this.saveSubWallets()
        console.log('✅ Sub-wallet revoked successfully');
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
            console.error('❌ Not connected - cannot get info');
            throw new Error('Not connected')
        }
        return await this.nwcClient.getInfo()
    }

    /**
     * Create a Lightning invoice
     */
    async makeInvoice(amountMsat: number, description?: string): Promise<any> {
        console.log(`⚡ Generating invoice: ${amountMsat} msat, desc: ${description || 'N/A'}`);
        if (!this.nwcClient) {
            throw new Error('Not connected')
        }
        try {
            const invoice = await this.nwcClient.makeInvoice({
                amount: amountMsat,
                description: description,
            })
            console.log('✅ Invoice generated:', invoice.invoice);
            return invoice
        } catch (error) {
            console.error('❌ Error generating invoice:', error);
            throw error
        }
    }

    /**
     * Pay a Lightning invoice
     */
    async payInvoice(invoice: string): Promise<any> {
        console.log('💸 Paying invoice:', invoice.substring(0, 30) + '...');
        if (!this.nwcClient) {
            throw new Error('Not connected')
        }
        try {
            const response = await this.nwcClient.payInvoice({
                invoice: invoice,
            })
            console.log('✅ Payment successful:', response.preimage);
            return response
        } catch (error) {
            console.error('❌ Payment failed:', error);
            throw error
        }
    }

    /**
     * List recent transactions
     */
    async listTransactions(limit = 10): Promise<any> {
        console.log('📚 Fetching transaction history...', { limit });
        if (!this.nwcClient) {
            throw new Error('Not connected')
        }
        try {
            const transactions = await this.nwcClient.listTransactions({
                limit,
            })
            console.log(`✅ Fetched ${transactions.length} transactions`);
            return transactions
        } catch (error) {
            console.error('❌ Failed to fetch transactions:', error);
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
     * Load sub-wallets from storage (account-specific)
     */
    private async loadSubWallets(): Promise<void> {
        if (!this.activePubkey) return

        const storageKey = `sub_wallets_${this.activePubkey}`
        console.log(`📂 Loading sub-wallets from storage (key: ${storageKey})...`);

        const wallets = await StorageService.load<SubWallet[]>(storageKey)
        if (wallets) {
            console.log(`📚 Found ${wallets.length} stored sub-wallets for this account`);
            this.subWallets = new Map(wallets.map(w => [w.id, w]))
        } else {
            console.log('📭 No sub-wallets found for this account');
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

        console.log(`💾 Saving ${wallets.length} sub-wallets to storage (key: ${storageKey})...`);
        await StorageService.save(storageKey, wallets)
        console.log('✅ Sub-wallets saved successfully');
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
            console.error('Failed to extract pubkey from URI:', e)
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
