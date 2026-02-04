import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, Alert, Share } from 'react-native'
import { Text, Card, Button, IconButton, ActivityIndicator } from 'react-native-paper'
import { useWalletStore } from '../store/walletStore'
import { walletManager } from '../services/WalletManager'
import { Transaction, SubWallet } from '../types'
import ReceiveModal from '../components/ReceiveModal'
import SendModal from '../components/SendModal'
import QRScanner from '../components/QRScanner'
import WalletInfoModal from '../components/WalletInfoModal'
import { ArrowDownLeft, ArrowUpRight, Scan, History, Link, Eye, EyeOff } from 'lucide-react-native'
import { SecurityService } from '../services/SecurityService'


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
        if (wallet) {
            refreshWalletData()
        }
    }, [selectedWalletId])

    const refreshWalletData = async () => {
        if (!selectedWalletId) return
        setLoading(true)
        try {
            // Fetch balance
            try {
                const walletBalance = await walletManager.getWalletBalance(selectedWalletId)
                setBalance(walletBalance)
            } catch (e) {
            }

            // Fetch transactions separately so failure doesn't block balance
            try {
                const txs = await walletManager.listTransactions(50) // Fetch more to allow for filtering

                // Transform NWC transactions to our Transaction type
                const allTxs: Transaction[] = txs.map((t: any, index: number) => {
                    const txId = t.payment_hash || t.id || `tx-${Date.now()}-${index}`;
                    return {
                        id: txId,
                        type: t.type === 'incoming' ? 'incoming' : 'outgoing',
                        amountMsat: t.amount,
                        description: t.description || (t.type === 'incoming' ? 'Received' : 'Sent'),
                        timestamp: (t.created_at || Date.now() / 1000) * 1000,
                        status: 'completed'
                    }
                })

                // CRITICAL: Refresh wallet in store from manager FIRST to get latest txIds
                const currentWallet = walletManager.getWallet(selectedWalletId)
                if (currentWallet) {
                    updateSubWallet(currentWallet.id, currentWallet)
                }

                const activeWallet = currentWallet || wallet

                // Filter by wallet matching txIds
                // If txIds exists (even if empty), we filter.
                // If it doesn't exist at all (legacy data), we fallback to all for migration.
                const subWalletTxs = activeWallet?.txIds
                    ? allTxs.filter(tx => activeWallet.txIds?.includes(tx.id))
                    : allTxs

                // Update wallet spent/received based on transactions
                let totalSpent = 0
                let totalReceived = 0
                subWalletTxs.forEach(t => {
                    if (t.type === 'outgoing') totalSpent += t.amountMsat
                    else totalReceived += t.amountMsat
                })

                if (activeWallet && (activeWallet.spentMsat !== totalSpent || activeWallet.receivedMsat !== totalReceived)) {
                    await walletManager.syncWalletTotals(activeWallet.id, totalSpent, totalReceived)
                    // Update store again after sync
                    const synced = walletManager.getWallet(activeWallet.id)
                    if (synced) updateSubWallet(synced.id, synced)
                }

                setActiveTransactions(subWalletTxs)
                setBalance(await walletManager.getWalletBalance(selectedWalletId))
            } catch (e) {
                setActiveTransactions([]) // Clear or keep old ones?
            }
        } catch (error) {
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
            if (ok) {
                setBalanceVisible(true)
            }
        } else {
            setBalanceVisible(false)
        }
    }

    if (!wallet) return null

    if (scannerVisible) {
        return <QRScanner onScan={handleScan} onClose={() => setScannerVisible(false)} />
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <IconButton
                    icon="arrow-left"
                    iconColor="#FFD700"
                    onPress={() => setSelectedWalletId(null)}
                />
                <Text variant="titleLarge" style={styles.headerTitle}>{wallet.name}</Text>
                <View style={styles.headerRight}>
                    <IconButton
                        icon={() => <Link size={20} color="#FFD700" />}
                        onPress={async () => {
                            const ok = await SecurityService.authenticate('Authorize to view connection details');
                            if (ok) setInfoVisible(true);
                        }}
                    />
                    <IconButton
                        icon="refresh"
                        iconColor="#FFD700"
                        onPress={refreshWalletData}
                    />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Balance Card */}
                <Card style={styles.balanceCard}>
                    <Card.Content style={styles.balanceContent}>
                        <View style={styles.balanceHeader}>
                            <Text style={styles.balanceLabel}>
                                {wallet.budgetMsat !== undefined ? 'Remaining Budget' : 'Sub-Wallet Balance'}
                            </Text>
                            <View style={styles.eyeIconContainer}>
                                <IconButton
                                    icon={() => isBalanceVisible ? <EyeOff size={18} color="#888" /> : <Eye size={18} color="#888" />}
                                    onPress={toggleBalanceVisibility}
                                />
                            </View>
                        </View>
                        <View>
                            {loading ? (
                                <ActivityIndicator color="#FFD700" style={{ marginVertical: 10 }} />
                            ) : (
                                <>
                                    <Text style={styles.balanceText}>
                                        {isBalanceVisible
                                            ? (balance !== null ? (balance / 1000).toLocaleString() : '---')
                                            : '*****'} <Text style={styles.satsLabel}>{(balance !== null && Math.abs(balance / 1000) === 1) ? 'sat' : 'sats'}</Text>
                                    </Text>
                                    <Text style={styles.budgetUsedText}>
                                        {isBalanceVisible
                                            ? `${((wallet.fundingMsat || 0) / 1000).toLocaleString()} sats allocated • ${(wallet.spentMsat / 1000).toLocaleString()} sats spent`
                                            : '**** sats allocated • **** sats spent'}
                                    </Text>
                                </>
                            )}
                        </View>
                    </Card.Content>
                </Card>

                {/* Quick Actions */}
                <View style={styles.actionRow}>
                    <View style={styles.actionItem}>
                        <IconButton
                            icon={() => <ArrowDownLeft size={24} color="#000" />}
                            style={styles.actionButton}
                            onPress={() => setReceiveVisible(true)}
                        />
                        <Text style={styles.actionLabel}>Receive</Text>
                    </View>
                    <View style={styles.actionItem}>
                        <IconButton
                            icon={() => <Scan size={24} color="#000" />}
                            style={styles.actionButton}
                            onPress={() => setScannerVisible(true)}
                        />
                        <Text style={styles.actionLabel}>Scan</Text>
                    </View>
                    <View style={styles.actionItem}>
                        <IconButton
                            icon={() => <ArrowUpRight size={24} color="#000" />}
                            style={styles.actionButton}
                            onPress={async () => {
                                const ok = await SecurityService.authenticate('Authorize payment');
                                if (ok) {
                                    setScannedInvoice('');
                                    setSendVisible(true);
                                }
                            }}
                        />
                        <Text style={styles.actionLabel}>Send</Text>
                    </View>
                </View>

                {/* Transactions */}
                <View style={styles.historyHeader}>
                    <History size={18} color="#888" />
                    <Text style={styles.historyTitle}>Transaction History</Text>
                </View>

                <View>
                    {transactions.length > 0 ? (
                        transactions.map((tx, index) => (
                            <Card key={`${tx.id}-${index}`} style={styles.txCard}>
                                <Card.Content style={styles.txContent}>
                                    <View style={styles.txIconContainer}>
                                        {tx.type === 'incoming' ? (
                                            <ArrowDownLeft size={20} color="#4CAF50" />
                                        ) : (
                                            <ArrowUpRight size={20} color="#F44336" />
                                        )}
                                    </View>
                                    <View style={styles.txInfo}>
                                        <Text style={styles.txDescription}>{tx.description}</Text>
                                        <Text style={styles.txDate}>
                                            {new Date(tx.timestamp).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <View style={styles.txAmountContainer}>
                                        <Text style={[
                                            styles.txAmount,
                                            { color: tx.type === 'incoming' ? '#4CAF50' : '#F44336' }
                                        ]}>
                                            {tx.type === 'incoming' ? '+' : '-'}{(tx.amountMsat / 1000).toLocaleString()}
                                        </Text>
                                        <Text style={styles.txSats}>sats</Text>
                                    </View>
                                </Card.Content>
                            </Card>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No transactions yet</Text>
                    )}
                </View>
            </ScrollView>

            <ReceiveModal
                visible={receiveVisible}
                onDismiss={() => setReceiveVisible(false)}
                walletName={wallet.name}
                walletId={wallet.id}
            />
            <SendModal
                visible={sendVisible}
                onDismiss={() => setSendVisible(false)}
                initialInvoice={scannedInvoice}
                onPaymentSuccess={refreshWalletData}
            />
            <WalletInfoModal
                visible={infoVisible}
                onDismiss={() => setInfoVisible(false)}
                walletName={wallet.name}
                nwcUri={wallet.nwcUri}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingHorizontal: 10,
        backgroundColor: '#141414',
    },
    headerTitle: {
        color: '#FFD700',
        fontWeight: 'bold',
        fontSize: 24,
        flex: 1,
        textAlign: 'center',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 20,
    },
    balanceCard: {
        backgroundColor: '#141414',
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#333',
    },
    balanceContent: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    balanceHeader: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    eyeIconContainer: {
        position: 'absolute',
        right: 0,
    },
    balanceLabel: {
        color: '#888',
        fontSize: 14,
    },
    balanceText: {
        color: '#FFFFFF',
        fontSize: 42, // Bigger balance
        fontWeight: 'bold',
        textAlign: 'center',
    },
    satsLabel: {
        fontSize: 20,
        color: '#FFD700',
    },
    budgetUsedText: {
        color: '#888',
        fontSize: 13,
        marginTop: 8,
        textAlign: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 32,
    },
    actionItem: {
        alignItems: 'center',
    },
    actionButton: {
        backgroundColor: '#FFD700',
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    actionLabel: {
        color: '#FFFFFF',
        marginTop: 8,
        fontSize: 12,
    },
    historyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    historyTitle: {
        color: '#888',
        fontSize: 16,
        fontWeight: '600',
    },
    txCard: {
        backgroundColor: '#141414',
        marginBottom: 12,
        borderRadius: 12,
    },
    txContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    txIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#222',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    txInfo: {
        flex: 1,
    },
    txDescription: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
    },
    txDate: {
        color: '#666',
        fontSize: 12,
        marginTop: 2,
    },
    txAmountContainer: {
        alignItems: 'flex-end',
    },
    txAmount: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    txSats: {
        color: '#666',
        fontSize: 10,
    },
    emptyText: {
        color: '#444',
        textAlign: 'center',
        marginTop: 40,
        fontSize: 14,
    },
})
