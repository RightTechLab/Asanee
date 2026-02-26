import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, Pressable } from 'react-native'
import { Text, IconButton, ActivityIndicator } from 'react-native-paper'
import { useWalletStore } from '../store/walletStore'
import { walletManager } from '../services/WalletManager'
import type { Transaction } from '../types'
import ReceiveModal from '../components/ReceiveModal'
import SendModal from '../components/SendModal'
import QRScanner from '../components/QRScanner'
import WalletInfoModal from '../components/WalletInfoModal'
import { ArrowDownLeft, ArrowUpRight, Scan, History, Link, Eye, EyeOff, ArrowLeft, RefreshCw } from 'lucide-react-native'
import { SecurityService } from '../services/SecurityService'
import { Colors, Spacing, Radius } from '../theme'


export default function SubWalletScreen() {
    const selectedWalletId = useWalletStore((state) => state.selectedWalletId)
    const subWallets = useWalletStore((state) => state.subWallets)
    const setSelectedWalletId = useWalletStore((state) => state.setSelectedWalletId)
    const updateSubWallet = useWalletStore((state) => state.updateSubWallet)
    const transactions = useWalletStore((state) => state.activeTransactions)
    const setActiveTransactions = useWalletStore((state) => state.setActiveTransactions)

    const [balance, setBalance] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [receiveVisible, setReceiveVisible] = useState(false)
    const [sendVisible, setSendVisible] = useState(false)
    const [scannerVisible, setScannerVisible] = useState(false)
    const [scannedInvoice, setScannedInvoice] = useState('')
    const [infoVisible, setInfoVisible] = useState(false)
    const isBalanceVisible = useWalletStore((state) => state.isBalanceVisible)
    const setBalanceVisible = useWalletStore((state) => state.setBalanceVisible)

    const wallet = subWallets.find(w => w.id === selectedWalletId)

    useEffect(() => {
        if (wallet) refreshWalletData()
    }, [selectedWalletId])

    const refreshWalletData = async () => {
        if (!selectedWalletId) return
        setLoading(true)
        try {
            try {
                const walletBalance = await walletManager.getWalletBalance(selectedWalletId)
                setBalance(walletBalance)
            } catch (e) {
                console.error('Failed to fetch wallet balance', e)
            }

            try {
                const txs = await walletManager.listTransactions(50, selectedWalletId)
                const allTxs: Transaction[] = txs.map((t: any, index: number) => {
                    const txId = t.payment_hash || t.id || `tx-${Date.now()}-${index}`
                    let type: 'incoming' | 'outgoing' = t.type === 'incoming' ? 'incoming' : 'outgoing'

                    const currentWallet = walletManager.getWallet(selectedWalletId)
                    if (currentWallet?.txRoles?.[txId]) {
                        if (currentWallet.txRoles[txId] === 'payer') type = 'outgoing'
                        if (currentWallet.txRoles[txId] === 'payee') type = 'incoming'
                    }

                    return {
                        id: txId,
                        type,
                        amountMsat: t.amount,
                        description: t.description || (type === 'incoming' ? 'Received' : 'Sent'),
                        timestamp: (t.created_at || Date.now() / 1000) * 1000,
                        status: 'completed'
                    }
                })

                const currentWallet = walletManager.getWallet(selectedWalletId)
                if (currentWallet) updateSubWallet(currentWallet.id, currentWallet)

                const activeWallet = currentWallet || wallet
                const isVirtual = !!activeWallet?.serviceSecretKey
                const txIds = activeWallet?.txIds || []
                const subWalletTxs = isVirtual ? allTxs.filter(tx => txIds.includes(tx.id)) : allTxs

                let totalSpent = 0
                let totalReceived = 0
                subWalletTxs.forEach(t => {
                    if (t.type === 'outgoing') totalSpent += t.amountMsat
                    else totalReceived += t.amountMsat
                })

                if (activeWallet && (activeWallet.spentMsat !== totalSpent || activeWallet.receivedMsat !== totalReceived)) {
                    await walletManager.syncWalletTotals(activeWallet.id, totalSpent, totalReceived)
                    const synced = walletManager.getWallet(activeWallet.id)
                    if (synced) updateSubWallet(synced.id, synced)
                }

                setActiveTransactions(subWalletTxs)
                setBalance(await walletManager.getWalletBalance(selectedWalletId))
            } catch (e) {
                setActiveTransactions([])
            }
        } catch (error) {
            console.error('Error refreshing wallet data', error)
        } finally {
            setLoading(false)
        }
    }

    const handleScan = (data: string) => {
        setScannerVisible(false)
        setScannedInvoice(data)
        setSendVisible(true)
    }

    const toggleBalanceVisibility = async () => {
        if (!isBalanceVisible) {
            const ok = await SecurityService.authenticate('Authorize to reveal balance')
            if (ok) setBalanceVisible(true)
        } else {
            setBalanceVisible(false)
        }
    }

    if (!wallet) return null

    if (scannerVisible) {
        return <QRScanner onScan={handleScan} onClose={() => setScannerVisible(false)} title="Scan Lightning Invoice" />
    }

    const canPay = wallet.permissions.includes('pay_invoice')

    const formatDate = (ts: number) => {
        const d = new Date(ts)
        const now = new Date()
        if (d.toDateString() === now.toDateString()) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => setSelectedWalletId(null)} hitSlop={12}>
                    <ArrowLeft size={22} color={Colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>{wallet.name}</Text>
                <View style={styles.headerRight}>
                    <Pressable
                        onPress={async () => {
                            const ok = await SecurityService.authenticate('Authorize to view connection details')
                            if (ok) setInfoVisible(true)
                        }}
                        hitSlop={8}
                    >
                        <Link size={18} color={Colors.textSecondary} />
                    </Pressable>
                    <Pressable onPress={refreshWalletData} hitSlop={8}>
                        <RefreshCw size={18} color={Colors.textSecondary} />
                    </Pressable>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Balance */}
                <View style={styles.balanceSection}>
                    <View style={styles.balanceLabelRow}>
                        <Text style={styles.balanceLabel}>Balance</Text>
                        <Pressable onPress={toggleBalanceVisibility} hitSlop={12}>
                            {isBalanceVisible
                                ? <EyeOff size={14} color={Colors.textTertiary} />
                                : <Eye size={14} color={Colors.textTertiary} />}
                        </Pressable>
                    </View>
                    {loading ? (
                        <ActivityIndicator color={Colors.accent} style={{ marginVertical: Spacing.md }} />
                    ) : (
                        <>
                            <Text style={styles.balanceAmount}>
                                {isBalanceVisible
                                    ? (balance !== null ? Math.floor(balance / 1000).toLocaleString() : '---')
                                    : '•••••'}
                                <Text style={styles.balanceSats}> {balance !== null && Math.abs(Math.floor(balance / 1000)) === 1 ? 'sat' : 'sats'}</Text>
                            </Text>
                            <Text style={styles.balanceMeta}>
                                {isBalanceVisible
                                    ? `${Math.floor(wallet.receivedMsat / 1000).toLocaleString()} received · ${Math.floor(wallet.spentMsat / 1000).toLocaleString()} spent`
                                    : '•••• received · •••• spent'}
                            </Text>
                        </>
                    )}
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                    <Pressable style={styles.actionItem} onPress={() => setReceiveVisible(true)}>
                        <View style={styles.actionCircle}>
                            <ArrowDownLeft size={22} color={Colors.accentText} />
                        </View>
                        <Text style={styles.actionLabel}>Receive</Text>
                    </Pressable>
                    <Pressable
                        style={styles.actionItem}
                        disabled={!canPay}
                        onPress={() => setScannerVisible(true)}
                    >
                        <View style={[styles.actionCircle, !canPay && styles.actionDisabled]}>
                            <Scan size={22} color={canPay ? Colors.accentText : Colors.textTertiary} />
                        </View>
                        <Text style={[styles.actionLabel, !canPay && { color: Colors.textTertiary }]}>Scan</Text>
                    </Pressable>
                    <Pressable
                        style={styles.actionItem}
                        disabled={!canPay}
                        onPress={async () => {
                            const ok = await SecurityService.authenticate('Authorize payment')
                            if (ok) { setScannedInvoice(''); setSendVisible(true) }
                        }}
                    >
                        <View style={[styles.actionCircle, !canPay && styles.actionDisabled]}>
                            <ArrowUpRight size={22} color={canPay ? Colors.accentText : Colors.textTertiary} />
                        </View>
                        <Text style={[styles.actionLabel, !canPay && { color: Colors.textTertiary }]}>Send</Text>
                    </Pressable>
                </View>

                {/* Transactions */}
                <View style={styles.txHeader}>
                    <History size={14} color={Colors.textSecondary} />
                    <Text style={styles.txHeaderText}>TRANSACTIONS</Text>
                </View>

                {transactions.length > 0 ? (
                    transactions.map((tx, index) => (
                        <View key={`${tx.id}-${index}`} style={styles.txRow}>
                            <View style={[styles.txIcon, { backgroundColor: tx.type === 'incoming' ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                                {tx.type === 'incoming'
                                    ? <ArrowDownLeft size={16} color={Colors.success} />
                                    : <ArrowUpRight size={16} color={Colors.danger} />}
                            </View>
                            <View style={styles.txInfo}>
                                <Text style={styles.txDesc}>{tx.description}</Text>
                                <Text style={styles.txDate}>{formatDate(tx.timestamp)}</Text>
                            </View>
                            <View style={styles.txAmountWrap}>
                                <Text style={[styles.txAmount, { color: tx.type === 'incoming' ? Colors.success : Colors.danger }]}>
                                    {tx.type === 'incoming' ? '+' : '-'}{Math.floor(tx.amountMsat / 1000).toLocaleString()}
                                </Text>
                                <Text style={styles.txSats}>sats</Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>No transactions yet</Text>
                )}
            </ScrollView>

            <ReceiveModal visible={receiveVisible} onDismiss={() => setReceiveVisible(false)} walletName={wallet.name} walletId={wallet.id} />
            <SendModal visible={sendVisible} onDismiss={() => setSendVisible(false)} initialInvoice={scannedInvoice} onPaymentSuccess={refreshWalletData} />
            <WalletInfoModal visible={infoVisible} onDismiss={() => setInfoVisible(false)} walletName={wallet.name} nwcUri={wallet.nwcUri} />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 56,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    headerTitle: {
        color: Colors.text,
        fontWeight: '600',
        fontSize: 18,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    scrollContent: {
        padding: Spacing.lg,
    },

    // Balance
    balanceSection: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    balanceLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    balanceLabel: {
        color: Colors.textSecondary,
        fontSize: 13,
    },
    balanceAmount: {
        color: Colors.text,
        fontSize: 44,
        fontWeight: '200',
    },
    balanceSats: {
        fontSize: 18,
        fontWeight: '400',
        color: Colors.accent,
    },
    balanceMeta: {
        color: Colors.textSecondary,
        fontSize: 12,
        marginTop: Spacing.sm,
    },

    // Actions
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.xxl,
        marginBottom: Spacing.xl,
    },
    actionItem: {
        alignItems: 'center',
    },
    actionCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
    },
    actionDisabled: {
        backgroundColor: Colors.surfaceElevated,
        shadowOpacity: 0,
        elevation: 0,
    },
    actionLabel: {
        color: Colors.text,
        marginTop: Spacing.sm,
        fontSize: 12,
        fontWeight: '500',
    },

    // Transactions
    txHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    txHeaderText: {
        color: Colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1.5,
    },
    txRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
    },
    txIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    txInfo: {
        flex: 1,
    },
    txDesc: {
        color: Colors.text,
        fontSize: 14,
        fontWeight: '500',
    },
    txDate: {
        color: Colors.textTertiary,
        fontSize: 12,
        marginTop: 2,
    },
    txAmountWrap: {
        alignItems: 'flex-end',
    },
    txAmount: {
        fontSize: 14,
        fontWeight: '600',
    },
    txSats: {
        color: Colors.textTertiary,
        fontSize: 10,
    },
    emptyText: {
        color: Colors.textTertiary,
        textAlign: 'center',
        marginTop: Spacing.xxl,
        fontSize: 13,
    },
})
