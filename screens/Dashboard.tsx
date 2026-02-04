import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, Alert } from 'react-native'
import { Text, Card, IconButton, FAB, Menu, Button } from 'react-native-paper'
import { useWalletStore } from '../store/walletStore'
import { walletManager } from '../services/WalletManager'
import CreateWalletModal from '../components/CreateWalletModal'
import FundWalletModal from '../components/FundWalletModal'
import { SubWallet } from '../types'
import { SecurityService } from '../services/SecurityService'
import { Eye, EyeOff } from 'lucide-react-native'


export default function Dashboard() {
    const [modalVisible, setModalVisible] = useState(false)
    const [fundModalVisible, setFundModalVisible] = useState(false)
    const [selectedFundWallet, setSelectedFundWallet] = useState<SubWallet | null>(null)
    const [menuVisible, setMenuVisible] = useState<string | null>(null)

    const subWallets = useWalletStore((state) => state.subWallets)
    const setConnected = useWalletStore((state) => state.setConnected)
    const setSubWallets = useWalletStore((state) => state.setSubWallets)
    const updateSubWallet = useWalletStore((state) => state.updateSubWallet)
    const removeSubWallet = useWalletStore((state) => state.removeSubWallet)
    const totalBalance = useWalletStore((state) => state.totalBalance)
    const setTotalBalance = useWalletStore((state) => state.setTotalBalance)
    const isBalanceVisible = useWalletStore((state) => state.isBalanceVisible)
    const setBalanceVisible = useWalletStore((state) => state.setBalanceVisible)

    const [loading, setLoading] = useState(false)
    const [walletBalances, setWalletBalances] = useState<Record<string, number | null>>({})
    const [expandedWallets, setExpandedWallets] = useState<Record<string, boolean>>({})

    useEffect(() => {
        refreshTotalBalance()
    }, [])

    const refreshTotalBalance = async () => {
        setLoading(true)
        try {
            const info = await walletManager.getBalance()
            setTotalBalance(info.balance)

            // Also refresh individual wallet balances
            const balances: Record<string, number | null> = {}
            let sum = 0

            await Promise.all(activeWallets.map(async (w) => {
                const b = await walletManager.getWalletBalance(w.id)
                balances[w.id] = b
                if (b !== null) sum += b
            }))

            setWalletBalances(balances)
            // setTotalBalance(sum) // Remove this - Total Balance should reflect the real wallet, not the sum of budgets
        } catch (error) {
        } finally {
            setLoading(false)
        }
    }

    const handleDisconnect = () => {
        Alert.alert(
            'Disconnect Wallet',
            'Are you sure you want to disconnect?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: async () => {
                        await walletManager.disconnect()
                        setConnected(false)
                        setSubWallets([])
                    },
                },
            ]
        )
    }

    const handleRevokeWallet = (wallet: SubWallet) => {
        Alert.alert(
            'Delete Wallet',
            `Are you sure you want to delete "${wallet.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await walletManager.revokeSubWallet(wallet.id)
                        removeSubWallet(wallet.id)
                        setMenuVisible(null)
                    },
                },
            ]
        )
    }

    const handleFundWallet = (wallet: SubWallet) => {
        setSelectedFundWallet(wallet)
        setFundModalVisible(true)
        setMenuVisible(null)
    }

    const handleCreateWallet = () => {
        setModalVisible(true)
    }

    const handleWalletCreated = (wallet: SubWallet) => {
        const wallets = walletManager.listWallets()
        setSubWallets(wallets)
        setModalVisible(false)
        refreshTotalBalance()
    }

    const toggleBalanceVisibility = async () => {
        if (!isBalanceVisible) {
            const ok = await SecurityService.authenticate('Authorize to reveal balances')
            if (ok) {
                setBalanceVisible(true)
            }
        } else {
            setBalanceVisible(false)
        }
    }

    const activeWallets = subWallets

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text variant="headlineMedium" style={styles.headerTitle}>
                        Asanee ⚡
                    </Text>
                    <Text variant="bodyMedium" style={styles.headerSubtitle}>
                        {activeWallets.length} Active Wallet{activeWallets.length !== 1 ? 's' : ''}
                    </Text>
                </View>
                <IconButton
                    icon="logout"
                    iconColor="#FFD700"
                    size={24}
                    onPress={handleDisconnect}
                />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Total Balance Card */}
                <Card style={styles.totalBalanceCard}>
                    <Card.Content style={styles.totalBalanceContent}>
                        <View style={styles.totalBalanceHeader}>
                            <Text style={styles.totalBalanceLabel}>Total Balance</Text>
                            <View style={styles.eyeIconContainer}>
                                <IconButton
                                    icon={() => isBalanceVisible ? <EyeOff size={18} color="#888" /> : <Eye size={18} color="#888" />}
                                    onPress={toggleBalanceVisibility}
                                />
                            </View>
                        </View>
                        <Text style={styles.totalBalanceAmount}>
                            {isBalanceVisible
                                ? (totalBalance !== null ? (totalBalance / 1000).toLocaleString() : '---')
                                : '*****'} <Text style={styles.totalBalanceSats}>sats</Text>
                        </Text>
                    </Card.Content>
                </Card>

                {/* Active Wallets Title */}
                <View style={styles.sectionHeader}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Sub-Wallets
                    </Text>
                    <IconButton
                        icon="refresh"
                        iconColor="#888"
                        size={20}
                        onPress={refreshTotalBalance}
                        loading={loading}
                    />
                </View>
                {/* Active Wallets */}
                <View>
                    {activeWallets.length > 0 ? (
                        activeWallets.map((wallet) => (
                            <Card
                                key={wallet.id}
                                style={styles.walletCard}
                                onPress={() => useWalletStore.getState().setSelectedWalletId(wallet.id)}
                            >
                                <Card.Title
                                    title={wallet.name}
                                    titleStyle={styles.walletTitle}
                                    subtitle={`${wallet.permissions.length} permission${wallet.permissions.length !== 1 ? 's' : ''}`}
                                    subtitleStyle={styles.walletSubtitle}
                                    right={() => (
                                        <View style={styles.walletRight}>
                                            <Text style={styles.walletBalanceText}>
                                                {isBalanceVisible
                                                    ? (walletBalances[wallet.id] !== undefined && walletBalances[wallet.id] !== null
                                                        ? (walletBalances[wallet.id]! / 1000).toLocaleString()
                                                        : '---')
                                                    : '*****'} sats
                                            </Text>
                                            <IconButton
                                                icon={expandedWallets[wallet.id] ? "chevron-up" : "chevron-down"}
                                                iconColor="#FFD700"
                                                size={20}
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedWallets(prev => ({
                                                        ...prev,
                                                        [wallet.id]: !prev[wallet.id]
                                                    }));
                                                }}
                                            />
                                            <Menu
                                                visible={menuVisible === wallet.id}
                                                onDismiss={() => setMenuVisible(null)}
                                                anchor={
                                                    <IconButton
                                                        icon="dots-vertical"
                                                        iconColor="#FFD700"
                                                        onPress={() => setMenuVisible(wallet.id)}
                                                    />
                                                }
                                            >
                                                <Menu.Item
                                                    onPress={() => handleFundWallet(wallet)}
                                                    title="Allocate Funds"
                                                    leadingIcon="plus-circle"
                                                />
                                                <Menu.Item
                                                    onPress={() => handleRevokeWallet(wallet)}
                                                    title="Delete"
                                                    leadingIcon="delete"
                                                />
                                            </Menu>
                                        </View>
                                    )}
                                />
                                {expandedWallets[wallet.id] && (
                                    <Card.Content>
                                        <View style={styles.permissionContainer}>
                                            {wallet.permissions.map((perm, idx) => (
                                                <View key={`${wallet.id}-perm-${idx}`} style={styles.permissionChip}>
                                                    <Text style={styles.permissionText}>{perm}</Text>
                                                </View>
                                            ))}
                                        </View>
                                        {wallet.budgetMsat && (
                                            <View style={styles.budgetRow}>
                                                <Text style={styles.budgetText}>
                                                    Budget: {(wallet.budgetMsat / 1000).toLocaleString()} sats
                                                </Text>
                                                <Text style={styles.spentText}>
                                                    Spent: {(wallet.spentMsat / 1000).toLocaleString()} sats
                                                </Text>
                                            </View>
                                        )}
                                    </Card.Content>
                                )}
                            </Card>
                        ))
                    ) : (
                        <Card style={styles.emptyCard}>
                            <Card.Content>
                                <Text variant="titleMedium" style={styles.emptyTitle}>
                                    No Sub-Wallets Yet
                                </Text>
                                <Text variant="bodyMedium" style={styles.emptyText}>
                                    Create your first scoped sub-wallet to get started
                                </Text>
                            </Card.Content>
                        </Card>
                    )}
                </View>
            </ScrollView>

            {/* FAB */}
            <FAB
                icon="plus"
                style={styles.fab}
                onPress={handleCreateWallet}
                color="#000000"
            />

            {/* Create Wallet Modal */}
            <CreateWalletModal
                visible={modalVisible}
                onDismiss={() => setModalVisible(false)}
                onWalletCreated={handleWalletCreated}
            />

            {/* Fund Wallet Modal */}
            <FundWalletModal
                visible={fundModalVisible}
                onDismiss={() => setFundModalVisible(false)}
                wallet={selectedFundWallet}
                onFunded={refreshTotalBalance}
                masterBalance={totalBalance}
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
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        backgroundColor: '#141414',
    },
    headerTitle: {
        color: '#FFD700',
        fontWeight: 'bold',
        fontSize: 24,
    },
    headerSubtitle: {
        color: '#E0E0E0',
        marginTop: 4,
    },
    totalBalanceCard: {
        backgroundColor: '#141414',
        marginBottom: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    totalBalanceContent: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    totalBalanceHeader: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    eyeIconContainer: {
        position: 'absolute',
        right: 0,
    },
    totalBalanceLabel: {
        color: '#888',
        fontSize: 14,
    },
    totalBalanceAmount: {
        color: '#FFFFFF',
        fontSize: 38, // Bigger balance
        fontWeight: 'bold',
        textAlign: 'center',
    },
    totalBalanceSats: {
        color: '#FFD700',
        fontSize: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    scrollContent: {
        padding: 20,
    },
    walletCard: {
        backgroundColor: '#141414',
        marginBottom: 16,
    },
    walletTitle: {
        color: '#FFFFFF',
    },
    walletSubtitle: {
        color: '#888888',
    },
    balanceHeader: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceLabel: {
        color: '#888',
        fontSize: 14,
    },
    walletRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    walletBalanceText: {
        color: '#FFD700',
        fontWeight: 'bold',
        fontSize: 14,
    },
    permissionContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    permissionChip: {
        backgroundColor: '#333333',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    permissionText: {
        color: '#FFD700',
        fontSize: 12,
    },
    budgetText: {
        color: '#888',
        fontSize: 12,
    },
    spentText: {
        color: '#F44336',
        fontSize: 12,
        fontWeight: 'bold',
    },
    budgetRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#222',
    },
    emptyCard: {
        backgroundColor: '#141414',
        padding: 20,
    },
    emptyTitle: {
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptyText: {
        color: '#888888',
        textAlign: 'center',
    },
    sectionTitle: {
        color: '#888888',
        marginBottom: 12,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: '#FFD700',
    },
})
