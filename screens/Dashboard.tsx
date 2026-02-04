import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, Alert } from 'react-native'
import { Text, Card, IconButton, FAB, Menu, Button } from 'react-native-paper'
import { useWalletStore } from '../store/walletStore'
import { walletManager } from '../services/WalletManager'
import CreateWalletModal from '../components/CreateWalletModal'
import { SubWallet } from '../types'

export default function Dashboard() {
    const [modalVisible, setModalVisible] = useState(false)
    const [menuVisible, setMenuVisible] = useState<string | null>(null)

    const subWallets = useWalletStore((state) => state.subWallets)
    const setConnected = useWalletStore((state) => state.setConnected)
    const setSubWallets = useWalletStore((state) => state.setSubWallets)
    const updateSubWallet = useWalletStore((state) => state.updateSubWallet)
    const totalBalance = useWalletStore((state) => state.totalBalance)
    const setTotalBalance = useWalletStore((state) => state.setTotalBalance)

    const [loading, setLoading] = useState(false)
    const [walletBalances, setWalletBalances] = useState<Record<string, number | null>>({})

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
            setTotalBalance(sum)
        } catch (error) {
            console.error('Failed to refresh balances:', error)
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
            'Revoke Wallet',
            `Are you sure you want to revoke "${wallet.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Revoke',
                    style: 'destructive',
                    onPress: async () => {
                        await walletManager.revokeSubWallet(wallet.id)
                        updateSubWallet(wallet.id, { status: 'revoked' })
                        setMenuVisible(null)
                    },
                },
            ]
        )
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

    const activeWallets = subWallets.filter(w => w.status === 'active')
    const revokedWallets = subWallets.filter(w => w.status === 'revoked')

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
                        <Text style={styles.totalBalanceLabel}>Total Balance</Text>
                        <Text style={styles.totalBalanceAmount}>
                            {totalBalance !== null ? (totalBalance / 1000).toLocaleString() : '---'} <Text style={styles.totalBalanceSats}>sats</Text>
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
                                            {walletBalances[wallet.id] !== undefined && walletBalances[wallet.id] !== null
                                                ? (walletBalances[wallet.id]! / 1000).toLocaleString()
                                                : '---'} sats
                                        </Text>
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
                                                onPress={() => handleRevokeWallet(wallet)}
                                                title="Revoke"
                                                leadingIcon="cancel"
                                            />
                                        </Menu>
                                    </View>
                                )}
                            />
                            <Card.Content>
                                <View style={styles.permissionContainer}>
                                    {wallet.permissions.map((perm, idx) => (
                                        <View key={idx} style={styles.permissionChip}>
                                            <Text style={styles.permissionText}>{perm}</Text>
                                        </View>
                                    ))}
                                </View>
                                {wallet.budgetMsat && (
                                    <Text style={styles.budgetText}>
                                        Budget: {(wallet.budgetMsat / 1000).toLocaleString()} sats
                                    </Text>
                                )}
                            </Card.Content>
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

                {/* Revoked Wallets */}
                {revokedWallets.length > 0 && (
                    <View style={styles.revokedSection}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>
                            Revoked Wallets
                        </Text>
                        {revokedWallets.map((wallet) => (
                            <Card key={wallet.id} style={styles.revokedCard}>
                                <Card.Title
                                    title={wallet.name}
                                    titleStyle={styles.revokedTitle}
                                    subtitle="Revoked"
                                    subtitleStyle={styles.revokedSubtitle}
                                />
                            </Card>
                        ))}
                    </View>
                )}
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
        paddingVertical: 20,
    },
    totalBalanceLabel: {
        color: '#888',
        fontSize: 14,
        marginBottom: 4,
    },
    totalBalanceAmount: {
        color: '#FFFFFF',
        fontSize: 32,
        fontWeight: 'bold',
    },
    totalBalanceSats: {
        color: '#FFD700',
        fontSize: 18,
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
        color: '#E0E0E0',
        marginTop: 12,
        fontSize: 14,
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
    revokedSection: {
        marginTop: 24,
    },
    sectionTitle: {
        color: '#888888',
        marginBottom: 12,
    },
    revokedCard: {
        backgroundColor: '#0a0a0a',
        marginBottom: 12,
        opacity: 0.6,
    },
    revokedTitle: {
        color: '#666666',
    },
    revokedSubtitle: {
        color: '#444444',
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: '#FFD700',
    },
})
