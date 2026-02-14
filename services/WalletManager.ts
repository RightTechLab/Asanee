import { NWCClient } from '@getalby/sdk'
import { NWCWalletService, NWCWalletServiceKeyPair } from "@getalby/sdk/nwc"
import { generateSecretKey, getPublicKey } from "nostr-tools"
import { bytesToHex, hexToBytes } from "nostr-tools/utils"
import { sha256 } from '@noble/hashes/sha2.js'
import { SubWallet, WalletConfig } from '../types'
import { StorageService } from './StorageService'

/**
 * Wallet Manager - manages Master NWC connection and sub-wallets
 * Uses @getalby/sdk for robust NWC integration
 */
export class WalletManager {
    private masterNWCUri: string | null = null
    private nwcClient: any = null // NWCClient instance for Master
    private subWallets: Map<string, SubWallet> = new Map()
    private activePubkey: string | null = null
    private subClients: Map<string, any> = new Map() // Map of walletId -> NWCClient
    private walletService: any = null
    private subscriptions: Map<string, () => void> = new Map()
    private readonly relayUrl = "wss://relay.getalby.com/v1"

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
            if (!info) throw new Error('Failed to connect to wallet')

            this.masterNWCUri = masterUri
            this.activePubkey = this.extractPubkey(masterUri)

            // Initialize NWC Wallet Service for sub-wallets
            this.walletService = new NWCWalletService({ relayUrl: this.relayUrl })

            // Save to secure storage
            await StorageService.save('master_nwc_uri', masterUri)

            // Manage Master-NWC rotation (Keep Max 2)
            if (this.activePubkey) {
                const RECENT_KEYS_KEY = 'recent_master_pubkeys'
                let recentKeys = (await StorageService.load<string[]>(RECENT_KEYS_KEY)) || []
                
                // Remove current if exists (to move to top)
                recentKeys = recentKeys.filter(k => k !== this.activePubkey)
                
                // Add to top
                recentKeys.unshift(this.activePubkey)

                // Trim to 2
                while (recentKeys.length > 2) {
                    const removedKey = recentKeys.pop()
                    if (removedKey) {
                        await StorageService.delete(`sub_wallets_${removedKey}`)
                        console.log(`[asanee] Rotated out old master data for: ${removedKey}`)
                    }
                }
                
                // Save updated list
                await StorageService.save(RECENT_KEYS_KEY, recentKeys)
            }

            // Load existing sub-wallets
            await this.loadSubWallets()

            // Start subscribers for existing wallets
            for (const wallet of this.subWallets.values()) {
                await this.startSubWalletService(wallet).catch(e => {
                    console.error(`Failed to start service for sub-wallet ${wallet.id}`, e)
                })
            }
        } catch (error) {
            this.nwcClient = null
            this.walletService = null
            throw new Error(error instanceof Error ? error.message : 'Invalid NWC URI')
        }
    }

    /**
     * Disconnect Master NWC
     */
    async disconnect(): Promise<void> {
        if (this.nwcClient) this.nwcClient = null
        if (this.walletService) {
            this.walletService.close()
            this.walletService = null
        }

        // Unsubscribe all
        for (const unsub of this.subscriptions.values()) unsub()
        this.subscriptions.clear()

        this.masterNWCUri = null
        this.activePubkey = null
        this.subWallets.clear()
        this.subClients.clear()

        await StorageService.delete('master_nwc_uri')
    }

    /**
     * Get NWC client for a specific wallet or master client
     */
    getClientForWallet(walletId?: string): any {
        if (!walletId) return this.nwcClient

        // Return existing sub-client if already initialized
        if (this.subClients.has(walletId)) {
            return this.subClients.get(walletId)
        }

        const wallet = this.subWallets.get(walletId)
        if (!wallet) throw new Error(`Sub-wallet ${walletId} not found`)

        // Sub-wallets MUST have their own URI now
        if (wallet.nwcUri) {
            try {
                const client = new NWCClient({
                    nostrWalletConnectUrl: wallet.nwcUri,
                })
                this.subClients.set(walletId, client)
                return client
            } catch (e) {
                console.error(`Failed to create client for sub-wallet ${walletId}`, e)
                throw new Error(`Failed to connect to sub-wallet: ${e instanceof Error ? e.message : 'Unknown error'}`)
            }
        }

        throw new Error('Sub-wallet does not have a dedicated connection')
    }

    /**
     * Create a new sub-wallet connection
     */
    async createSubWallet(config: WalletConfig): Promise<SubWallet> {
        // If importing an existing wallet (NWC URI provided)
        if (config.nwcUri) {
            const randomSuffix = this.toHex(generateSecretKey()).substr(0, 8)
            const id = `imported_${Date.now()}_${randomSuffix}`
            const subWallet: SubWallet = {
                id,
                name: config.name,
                nwcUri: config.nwcUri,
                permissions: config.permissions, // Note: permissions on imported wallets are enforced by the remote, not us
                spentMsat: 0,
                receivedMsat: 0,
                createdAt: Date.now(),
                status: 'active',
                txIds: [],
                lastBalanceSync: Date.now(),
                // No serviceSecretKey for imported wallets
            }

            this.subWallets.set(id, subWallet)
            await this.saveSubWallets()
            return subWallet
        }

        // Virtual Wallet Logic (Proxy via Master)
        if (!this.masterNWCUri || !this.nwcClient || !this.walletService) {
            throw new Error('Master NWC not connected')
        }

        // Generate keys for this sub-wallet "service connection"
        const serviceSecretKeyBytes = generateSecretKey()
        const serviceSecretKey = this.toHex(serviceSecretKeyBytes)
        const servicePubkey = getPublicKey(serviceSecretKeyBytes)

        const clientSecretKeyBytes = generateSecretKey()
        const clientSecretKey = this.toHex(clientSecretKeyBytes)

        const nwcUri = `nostr+walletconnect://${servicePubkey}?relay=${encodeURIComponent(this.relayUrl)}&secret=${clientSecretKey}`
        const randomSuffix = this.toHex(generateSecretKey()).substr(0, 8)
        const id = `sub_${Date.now()}_${randomSuffix}`

        const subWallet: SubWallet = {
            id,
            name: config.name,
            nwcUri: nwcUri,
            permissions: config.permissions,
            budgetMsat: config.budgetMsat ?? 0,
            spentMsat: 0,
            receivedMsat: 0,
            fundingMsat: 0,
            createdAt: Date.now(),
            status: 'active',
            txIds: [],
            lastBalanceSync: Date.now(),
            serviceSecretKey: serviceSecretKey
        }

        // Start the service subscriber
        await this.startSubWalletService(subWallet)

        this.subWallets.set(id, subWallet)
        await this.saveSubWallets()

        return subWallet
    }

    /**
     * Start the NWC service for a sub-wallet
     */
    private async startSubWalletService(wallet: SubWallet): Promise<void> {
        if (!wallet.serviceSecretKey || !this.walletService || !this.nwcClient) return

        const serviceSecretKey = wallet.serviceSecretKey
        const serviceSecretKeyBytes = this.fromHex(serviceSecretKey)

        // Extract client pubkey from the URI we generated
        const url = new URL(wallet.nwcUri.replace('nostr+walletconnect://', 'nwc://'))
        const clientSecretKey = url.searchParams.get('secret')
        if (!clientSecretKey) return
        const clientSecretKeyBytes = this.fromHex(clientSecretKey)
        const clientPubkey = getPublicKey(clientSecretKeyBytes)

        // Publish service info
        await this.walletService.publishWalletServiceInfoEvent(
            serviceSecretKey,
            wallet.permissions,
            []
        )

        const keypair = new NWCWalletServiceKeyPair(serviceSecretKey, clientPubkey)

        const unsub = await this.walletService.subscribe(keypair, {
            getInfo: () => Promise.resolve({
                result: {
                    methods: wallet.permissions,
                    alias: `Asanee: ${wallet.name}`,
                    color: "#EFA911",
                    pubkey: getPublicKey(serviceSecretKeyBytes),
                    network: "mainnet",
                    block_height: 0,
                    block_hash: "",
                },
                error: undefined
            }),
            getBalance: async () => {
                try {
                    const masterBalanceRes = await this.nwcClient.getBalance()
                    const masterBalance = masterBalanceRes.balance || 0
                    let subBalance = masterBalance

                    // IF wallet has a specific budget, it is isolated (Limited)
                    if (wallet.budgetMsat !== undefined) {
                        let limit = wallet.budgetMsat
                        if (wallet.fundingMsat !== undefined) limit += wallet.fundingMsat

                        // Add received funds to the limit (allowing the wallet to spend what it earns)
                        limit += (wallet.receivedMsat || 0)

                        subBalance = Math.min(subBalance, Math.max(0, limit - wallet.spentMsat))
                    } else {
                        // IF wallet has NO budget (undefined), calculate from virtual accounting
                        // Virtual balance = funding + received - spent
                        const virtualBalance = (wallet.fundingMsat || 0) + (wallet.receivedMsat || 0) - (wallet.spentMsat || 0)
                        subBalance = Math.max(0, Math.min(masterBalance, virtualBalance))
                    }

                    return {
                        result: { balance: subBalance },
                        error: undefined
                    }
                } catch (err: any) {
                    return { result: undefined, error: { code: "INTERNAL", message: err.message } }
                }
            },
            makeInvoice: (req: any) => this.nwcClient.makeInvoice(req).then(async (res: any) => {
                const txId = res.payment_hash || res.id
                if (txId) {
                    if (!wallet.txIds) wallet.txIds = []
                    if (!wallet.txIds.includes(txId)) {
                        wallet.txIds.push(txId)
                    }
                    // Mark as payee
                    if (!wallet.txRoles) wallet.txRoles = {}
                    wallet.txRoles[txId] = 'payee'
                    await this.saveSubWallets()
                }
                return { result: res, error: undefined }
            }).catch((err: any) => ({ result: undefined, error: { code: "INTERNAL", message: err.message } })),
            payInvoice: async (req: any) => {
                try {
                    let amount = req.amount || 0

                    // Fallback amount detection from BOLT11 if missing
                    if (amount === 0 && req.invoice) {
                        amount = this.parseInvoiceAmount(req.invoice)
                    }

                    const remaining = (wallet.budgetMsat || wallet.fundingMsat || Infinity) - wallet.spentMsat

                    console.log(`[asanee-nwc] Sub-wallet "${wallet.name}" request. Invoice amount: ${amount} msat. Remaining sub-budget: ${remaining} msat`)

                    if (amount > 0 && amount > remaining) {
                        console.warn(`[asanee-nwc] Local budget limit hit! Required: ${amount}, Remaining: ${remaining}`)
                        return { result: undefined, error: { code: "INSUFFICIENT_BALANCE", message: "Insufficient balance in sub-wallet budget" } }
                    }

                    const res = await this.nwcClient.payInvoice(req)
                    console.log(`[asanee-nwc] Proxy payment success for ${wallet.name}:`, JSON.stringify(res))

                    const spentAmount = res.amount || amount

                    // Robust extraction of TX ID
                    let txId = res.payment_hash || res.id
                    if (!txId && res.preimage) {
                        try {
                            // Calculate hash from preimage if missing
                            const preimageBytes = this.fromHex(res.preimage)
                            const hash = sha256(preimageBytes)
                            txId = this.toHex(hash)
                        } catch (e) {
                            console.error('[asanee-nwc] Failed to hash preimage', e)
                        }
                    }


                    if (txId) {
                        // Record spent for payer wallet
                        await this.recordTransaction(wallet.id, spentAmount, 'spent', txId, 'payer')

                        // Check if this payment is to another sub-wallet (internal transfer)
                        console.log(`[asanee-nwc] Checking internal transfer for ${txId}. Total wallets: ${this.subWallets.size}`)
                        for (const [payeeId, payeeWallet] of this.subWallets) {
                            const payeeRole = payeeWallet.txRoles?.[txId]
                            if (payeeRole === 'payee') {
                                // Record received for payee wallet
                                await this.recordTransaction(payeeId, spentAmount, 'received', txId, 'payee')
                                console.log(`[asanee-nwc] Internal transfer detected: ${wallet.name} → ${payeeWallet.name}`)
                                break
                            }
                        }
                    } else {
                        console.warn('[asanee-nwc] Could not extract transaction ID from payment response, verification might fail')
                    }

                    return { result: res, error: undefined }
                } catch (err: any) {
                    console.error('[asanee-nwc] Master NWC ERROR:', err)
                    return { result: undefined, error: { code: "INTERNAL", message: err.message } }
                }
            },
            listTransactions: (req: any) => {
                return this.nwcClient.listTransactions(req).then((res: any) => {
                    let transactions = Array.isArray(res) ? res : (res.transactions || [])
                    const filtered = transactions.filter((tx: any) => {
                        const txId = tx.payment_hash || tx.id
                        return wallet.txIds?.includes(txId)
                    })
                    return { result: { transactions: filtered }, error: undefined }
                }).catch((err: any) => ({ result: undefined, error: { code: "INTERNAL", message: err.message } }))
            },
        })

        this.subscriptions.set(wallet.id, unsub)
    }

    private toHex(bytes: Uint8Array): string {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    }

    private fromHex(hex: string): Uint8Array {
        return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
    }

    /**
     * Delete a sub-wallet
     */
    async revokeSubWallet(id: string): Promise<void> {
        const wallet = this.subWallets.get(id)
        if (!wallet) {
            throw new Error('Sub-wallet not found')
        }

        // Unsubscribe from service
        const unsub = this.subscriptions.get(id)
        if (unsub) {
            unsub()
            this.subscriptions.delete(id)
        }

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
        const client = this.getClientForWallet(walletId)
        if (!client) {
            throw new Error('Not connected')
        }
        try {
            const response = await client.makeInvoice({
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
                            // Mark this wallet as the PAYEE (Receiver) for this transaction
                            if (!wallet.txRoles) wallet.txRoles = {}
                            wallet.txRoles[txId] = 'payee'
                            await this.saveSubWallets()
                        }
                    }
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
        const client = this.getClientForWallet(walletId)
        if (!client) {
            throw new Error('Not connected')
        }
        try {
            const response = await client.payInvoice({
                invoice: invoice,
                amount: amountMsat,
            })

            // Record transaction for Imported Wallets (which lack a local service listener)
            // OR if using the master client directly (fallback case)
            const wallet = walletId ? this.subWallets.get(walletId) : null
            const isImported = wallet && !wallet.serviceSecretKey
            const isMasterFallback = client.nostrWalletConnectUrl === this.masterNWCUri

            if (wallet && (isImported || isMasterFallback)) {
                // Determine TX ID from Invoice (Payment Hash) to match listTransactions
                // Fallback to response ID if extraction fails
                let txId = response.payment_hash || response.id

                try {
                    // Extract payment hash from BOLT11 invoice logic if needed
                    if (!response.payment_hash && invoice) {
                        if (response.preimage) {
                            const preimageBytes = hexToBytes(response.preimage)
                            const hash = sha256(preimageBytes)
                            txId = bytesToHex(hash)
                            console.log(`[asanee-debug] Calculated TxID (Hash) from Preimage: ${txId}`)
                        }
                    }
                } catch (e) { }

                // Try to determine amount
                let spent = amountMsat || response.amount || 0
                if (spent === 0 && invoice) {
                    spent = this.parseInvoiceAmount(invoice)
                }

                await this.recordTransaction(walletId!, spent, 'spent', txId, 'payer')
            }

            return response
        } catch (error) {
            throw error
        }
    }

    /**
     * List recent transactions
     */
    async listTransactions(limit = 10, walletId?: string): Promise<any[]> {
        const client = this.getClientForWallet(walletId)
        if (!client) {
            throw new Error('Not connected')
        }
        try {
            const response = await client.listTransactions({
                limit,
            })
            let transactions: any[] = []
            if (Array.isArray(response)) {
                transactions = response
            } else if (response && Array.isArray(response.transactions)) {
                transactions = response.transactions
            }

            // Apply Sub-Wallet logic if walletId is provided
            if (walletId) {
                const wallet = this.subWallets.get(walletId)
                if (wallet) {
                    // 1. Filter by ID (if virtual/shared client)
                    if (wallet.serviceSecretKey) {
                        transactions = transactions.filter(tx => {
                            const txId = tx.payment_hash || tx.id
                            return wallet.txIds?.includes(txId)
                        })
                    }

                    // 2. Fix Roles (Payer vs Payee) and filter duplicates
                    const seen = new Map<string, any>()

                    transactions.forEach(tx => {
                        const txId = tx.payment_hash || tx.id
                        const role = wallet.txRoles?.[txId]

                        // Only add if we haven't seen this txId yet
                        if (!seen.has(txId)) {
                            if (role === 'payer') {
                                seen.set(txId, { ...tx, type: 'outgoing', description: tx.description || 'Sent' })
                            } else if (role === 'payee') {
                                seen.set(txId, { ...tx, type: 'incoming', description: tx.description || 'Received' })
                            } else {
                                // Default behavior based on existing tx type if no role is found
                                seen.set(txId, tx)
                            }
                        }
                    })

                    transactions = Array.from(seen.values())
                }
            }

            return transactions
        } catch (error) {
            console.error('List transactions failed', error)
            return []
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
    async getBalance(walletId?: string): Promise<any> {
        const client = this.getClientForWallet(walletId)
        if (!client) {
            throw new Error('Not connected')
        }
        return await client.getBalance()
    }

    /**
     * Get specific sub-wallet balance
     */
    async getWalletBalance(id: string): Promise<number | null> {
        try {
            const balanceData = await this.getBalance(id)
            return balanceData.balance
        } catch (e) {
            console.error(`Failed to get balance for sub-wallet ${id}`, e)
            return null
        }
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
    async recordTransaction(walletId: string, amountMsat: number, type: 'spent' | 'received', txId?: string, role?: 'payer' | 'payee'): Promise<void> {
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

            if (role) {
                if (!wallet.txRoles) wallet.txRoles = {}
                wallet.txRoles[txId] = role
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
            this.subWallets = new Map(wallets.map(w => [w.id, { ...w, txIds: w.txIds || [] }]))
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
     * Calculate total funds reserved by OTHER sub-wallets
     */
    private getReservedBalance(excludeWalletId?: string): number {
        let reserved = 0
        for (const w of this.subWallets.values()) {
            if (w.id === excludeWalletId) continue

            // Only count wallets that have a defined budget (are isolated)
            if (w.budgetMsat !== undefined) {
                let limit = w.budgetMsat
                if (w.fundingMsat !== undefined) limit += w.fundingMsat
                limit += (w.receivedMsat || 0)

                // The amount they effectively "hold" is their current balance (Limit - Spent)
                // We assume they haven't overspent (Max(0, ...))
                const currentBalance = Math.max(0, limit - w.spentMsat)
                reserved += currentBalance
            }
        }
        return reserved
    }

    /**
    /**
     * Extract pubkey from NWC URI
     */
    private extractPubkey(uri: string): string | null {
        try {
            const url = new URL(uri.replace('nostr+walletconnect://', 'nwc://'))
            return url.hostname
        } catch (e) {
            return null
        }
    }

    /**
     * Parse amount from BOLT11 invoice
     */
    private parseInvoiceAmount(invoice: string): number {
        try {
            const match = invoice.toLowerCase().match(/lnbc(\d+)([pnum])?/)
            if (match) {
                const val = parseInt(match[1])
                const mult = match[2]
                if (mult === 'p') return Math.floor(val / 10)
                else if (mult === 'n') return val * 100
                else if (mult === 'u') return val * 100000
                else if (mult === 'm') return val * 100000000
                else return val * 100000000000
            }
        } catch (e) { }
        return 0
    }

    isConnected(): boolean {
        return this.masterNWCUri !== null && this.nwcClient !== null
    }
}

// Singleton instance
export const walletManager = new WalletManager()
