import { create } from 'zustand'
import { SubWallet, Transaction } from '../types'

interface WalletState {
    isConnected: boolean
    subWallets: SubWallet[]
    selectedWalletId: string | null
    activeTransactions: Transaction[]
    totalBalance: number | null
    isBalanceVisible: boolean
    setConnected: (connected: boolean) => void
    setSubWallets: (wallets: SubWallet[]) => void
    addSubWallet: (wallet: SubWallet) => void
    updateSubWallet: (id: string, updates: Partial<SubWallet>) => void
    removeSubWallet: (id: string) => void
    setSelectedWalletId: (id: string | null) => void
    setActiveTransactions: (transactions: Transaction[]) => void
    setTotalBalance: (balance: number | null) => void
    setBalanceVisible: (visible: boolean) => void
}

export const useWalletStore = create<WalletState>((set) => ({
    isConnected: false,
    subWallets: [],
    selectedWalletId: null,
    activeTransactions: [],
    totalBalance: null,
    isBalanceVisible: false,

    setConnected: (connected) => set({ isConnected: connected }),

    setSubWallets: (wallets) => set({ subWallets: wallets }),

    addSubWallet: (wallet) => set((state) => ({
        subWallets: [...state.subWallets, wallet]
    })),

    updateSubWallet: (id, updates) => set((state) => ({
        subWallets: state.subWallets.map(w =>
            w.id === id ? { ...w, ...updates } : w
        )
    })),

    removeSubWallet: (id) => set((state) => ({
        subWallets: state.subWallets.filter(w => w.id !== id)
    })),

    setSelectedWalletId: (id) => set({ selectedWalletId: id }),

    setActiveTransactions: (transactions) => set({ activeTransactions: transactions }),

    setTotalBalance: (balance) => set({ totalBalance: balance }),

    setBalanceVisible: (visible) => set({ isBalanceVisible: visible })
}))
