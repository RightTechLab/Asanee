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
    budgetMsat?: number
    spentMsat: number
    receivedMsat: number
    fundingMsat?: number // Internal funds allocated from master
    createdAt: number
    status: 'active'
    lastBalanceSync?: number
    txIds?: string[] // Track transaction IDs associated with this wallet
}

export interface WalletConfig {
    name: string
    permissions: NWCPermission[]
    budgetMsat?: number
}
