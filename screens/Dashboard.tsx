import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text, Card, IconButton, FAB, Menu, Dialog, Portal, TextInput, Button } from 'react-native-paper'
import { useWalletStore } from '../store/walletStore'
import { walletManager } from '../services/WalletManager'
import CreateWalletModal from '../components/CreateWalletModal'

import { SubWallet } from '../types'
import { SecurityService } from '../services/SecurityService'
import { Eye, EyeOff } from 'lucide-react-native'


export default function Dashboard() {
    const [modalVisible, setModalVisible] = useState(false)
    const insets = useSafeAreaInsets()
    const [menuVisible, setMenuVisible] = useState<string | null>(null)

    const [renameDialogVisible, setRenameDialogVisible] = useState(false)
    const [walletToRename, setWalletToRename] = useState<SubWallet | null>(null)
    const [newWalletName, setNewWalletName] = useState('')

    const [topUpDialogVisible, setTopUpDialogVisible] = useState(false)
    const [walletToTopUp, setWalletToTopUp] = useState<SubWallet | null>(null)
    const [topUpAmount, setTopUpAmount] = useState('')

    const subWallets = useWalletStore((state) => state.subWallets)
    const setConnected = useWalletStore((state) => state.setConnected)
    const setSubWallets = useWalletStore((state) => state.setSubWallets)

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
        } catch (error) {
            console.error('Failed to refresh total balance', error)
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



    const handleCreateWallet = () => {
        setModalVisible(true)
    }

    const handleRenameSubmit = async () => {
        if (!walletToRename || !newWalletName.trim()) return
        try {
            await walletManager.renameSubWallet(walletToRename.id, newWalletName.trim())
            const wallets = walletManager.listWallets()
            setSubWallets(wallets)
            setRenameDialogVisible(false)
            setWalletToRename(null)
        } catch (error) {
            console.error('Failed to rename wallet', error)
            Alert.alert('Error', 'Failed to rename wallet')
        }
    }

    const handleTopUpSubmit = async () => {
        if (!walletToTopUp || !topUpAmount.trim()) return
        
        const amountSats = parseInt(topUpAmount.trim())
        if (Number.isNaN(amountSats) || amountSats <= 0) {
            Alert.alert('Error', 'Please enter a valid amount')
            return
        }
        
        const amountMsat = amountSats * 1000
        const totalMasterMsat = totalBalance || 0
        
        const sumSubwalletsMsat = Object.values(walletBalances).reduce((acc, bal) => (acc || 0) + (bal || 0), 0) || 0
        const availableMsat = Math.max(0, totalMasterMsat - sumSubwalletsMsat)
        
        if (amountMsat > availableMsat) {
            Alert.alert(
                'Insufficient Balance', 
                `Maximum topup available is ${Math.floor(availableMsat / 1000).toLocaleString()} sats.`
            )
            return
        }

        try {
            await walletManager.fundSubWallet(walletToTopUp.id, amountMsat)
            const wallets = walletManager.listWallets()
            setSubWallets(wallets)
            setTopUpDialogVisible(false)
            setWalletToTopUp(null)
            setTopUpAmount('')
            refreshTotalBalance()
            Alert.alert('Success', 'Sub-wallet topped up successfully')
        } catch (error) {
            console.error('Failed to top up wallet', error)
            Alert.alert('Error', 'Failed to top up wallet')
        }
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
                                ? (totalBalance !== null ? Math.ceil(totalBalance / 1000).toLocaleString() : '---')
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
                                    subtitle={wallet.permissions.length > 4 ? 'Full access' : 'Receive only'}
                                    subtitleStyle={styles.walletSubtitle}
                                    right={() => (
                                        <View style={styles.walletRight}>
                                            <Text style={styles.walletBalanceText}>
                                                {isBalanceVisible
                                                    ? (walletBalances[wallet.id] !== undefined && walletBalances[wallet.id] !== null
                                                        ? Math.ceil(walletBalances[wallet.id]! / 1000).toLocaleString()
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
                                                {wallet.permissions.length > 4 && (
                                                    <Menu.Item
                                                        onPress={() => {
                                                            setWalletToTopUp(wallet)
                                                            setTopUpAmount('')
                                                            setTopUpDialogVisible(true)
                                                            setMenuVisible(null)
                                                        }}
                                                        title="Top Up"
                                                        leadingIcon="cash-plus"
                                                    />
                                                )}
                                                <Menu.Item
                                                    onPress={() => {
                                                        setWalletToRename(wallet)
                                                        setNewWalletName(wallet.name)
                                                        setRenameDialogVisible(true)
                                                        setMenuVisible(null)
                                                    }}
                                                    title="Rename"
                                                    leadingIcon="pencil"
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
                style={[styles.fab, { marginBottom: (Platform.OS === 'android' ? 16 : 0) + insets.bottom }]}
                onPress={handleCreateWallet}
                color="#000000"
            />

            {/* Create Wallet Modal */}
            <CreateWalletModal
                visible={modalVisible}
                onDismiss={() => setModalVisible(false)}
                onWalletCreated={handleWalletCreated}
            />

            {/* Rename Wallet Dialog */}
            <Portal>
                <Dialog visible={renameDialogVisible} onDismiss={() => setRenameDialogVisible(false)} style={styles.dialog}>
                    <Dialog.Title style={styles.dialogTitle}>Rename Sub-Wallet</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Wallet Name"
                            value={newWalletName}
                            onChangeText={setNewWalletName}
                            mode="outlined"
                            style={styles.renameInput}
                            autoFocus
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setRenameDialogVisible(false)} textColor="#888">Cancel</Button>
                        <Button onPress={handleRenameSubmit} textColor="#FFD700">Save</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Top Up Wallet Dialog */}
            <Portal>
                <Dialog visible={topUpDialogVisible} onDismiss={() => setTopUpDialogVisible(false)} style={styles.dialog}>
                    <Dialog.Title style={styles.dialogTitle}>Top Up Sub-Wallet</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Amount (sats)"
                            value={topUpAmount}
                            onChangeText={setTopUpAmount}
                            mode="outlined"
                            keyboardType="numeric"
                            style={styles.renameInput}
                            autoFocus
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setTopUpDialogVisible(false)} textColor="#888">Cancel</Button>
                        <Button onPress={handleTopUpSubmit} textColor="#FFD700">Top Up</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

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
    dialog: {
        backgroundColor: '#141414',
    },
    dialogTitle: {
        color: '#FFD700',
    },
    renameInput: {
        backgroundColor: '#141414',
    },
})
