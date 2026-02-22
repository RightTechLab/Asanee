export type NWCPermission =
    | 'get_info'
    | 'get_balance'
    | 'make_invoice'
    | 'pay_invoice'
    | 'list_transactions'
    | 'record_transaction'

export interface Transaction {
    id: string
    type: 'incoming' | 'outgoing'
    amountMsat: number
    description?: string
    timestamp: number
    status: 'pending' | 'completed' | 'failed'
    preimage?: string
    invoice?: string
}

export type SubWallet = {
    id: string
    name: string
    nwcUri: string
    permissions: NWCPermission[]
    spentMsat: number
    receivedMsat: number
    createdAt: number
    status: 'active'
    lastBalanceSync?: number
    txIds?: string[] // Track transaction IDs associated with this wallet
    txRoles?: Record<string, 'payer' | 'payee'> // Track role for each transaction (payer/payee)
    serviceSecretKey?: string // Secret key for the NWC service provider for this wallet
}

export interface WalletConfig {
    name: string
    permissions: NWCPermission[]
    nwcUri?: string
}
