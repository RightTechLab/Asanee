import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, Alert, Platform, Pressable, Modal as RNModal, KeyboardAvoidingView, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text, Menu, Dialog, Portal, TextInput, Button } from 'react-native-paper'
import { useWalletStore } from '../store/walletStore'
import { walletManager } from '../services/WalletManager'
import CreateWalletModal from '../components/CreateWalletModal'
import QRScanner from '../components/QRScanner'
import type { SubWallet, SavedWallet } from '../types'
import { SecurityService } from '../services/SecurityService'
import { Eye, EyeOff, LogOut, Plus, RefreshCw, Zap, ChevronDown, ChevronUp, MoreVertical, Wallet, Scan, Edit3, Check } from 'lucide-react-native'
import { Colors, Spacing, Radius } from '../theme'


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

    const [nameBeforeLogoutVisible, setNameBeforeLogoutVisible] = useState(false)
    const [logoutWalletName, setLogoutWalletName] = useState('')

    // ─── Wallet Switcher State ──────────────────────────────
    const [currentWalletName, setCurrentWalletName] = useState<string | null>(null)
    const [switcherVisible, setSwitcherVisible] = useState(false)
    const [savedWallets, setSavedWallets] = useState<SavedWallet[]>([])
    const [masterNameEditing, setMasterNameEditing] = useState(false)
    const [masterNameInput, setMasterNameInput] = useState('')
    const [switcherScannerVisible, setSwitcherScannerVisible] = useState(false)
    const [switchingWallet, setSwitchingWallet] = useState(false)

    const activeWallets = subWallets

    useEffect(() => {
        refreshTotalBalance()
        loadCurrentWalletName()
    }, [])

    const loadCurrentWalletName = async () => {
        const name = await walletManager.getCurrentWalletName()
        setCurrentWalletName(name)
    }

    const refreshTotalBalance = async () => {
        setLoading(true)
        try {
            const info = await walletManager.getBalance()
            setTotalBalance(info.balance)

            const balances: Record<string, number | null> = {}
            await Promise.all(activeWallets.map(async (w) => {
                const b = await walletManager.getWalletBalance(w.id)
                balances[w.id] = b
            }))
            setWalletBalances(balances)
        } catch (error) {
            console.error('Failed to refresh total balance', error)
        } finally {
            setLoading(false)
        }
    }

    // ─── Wallet Switcher Logic ──────────────────────────────

    const openSwitcher = async () => {
        const wallets = await walletManager.getSavedWallets()
        setSavedWallets(wallets)
        setMasterNameEditing(false)
        setMasterNameInput(currentWalletName || '')
        setSwitcherVisible(true)
    }

    const handleSaveMasterName = async () => {
        if (masterNameInput.trim()) {
            await walletManager.saveWalletToList(masterNameInput.trim())
            setCurrentWalletName(masterNameInput.trim())
            // Reload saved wallets to reflect name change
            const wallets = await walletManager.getSavedWallets()
            setSavedWallets(wallets)
        }
        setMasterNameEditing(false)
    }

    const handleSwitchWallet = async (wallet: SavedWallet) => {
        setSwitcherVisible(false)
        setSwitchingWallet(true)
        try {
            await walletManager.disconnect()
            await walletManager.connect(wallet.nwcUri)
            const wallets = walletManager.listWallets()
            setSubWallets(wallets)
            setCurrentWalletName(wallet.name || null)
            await refreshTotalBalance()
        } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to connect')
            setConnected(false)
            setSubWallets([])
        } finally {
            setSwitchingWallet(false)
        }
    }

    const handleSwitcherScan = async (data: string) => {
        setSwitcherScannerVisible(false)
        setSwitcherVisible(false)
        setSwitchingWallet(true)
        try {
            await walletManager.disconnect()
            await walletManager.connect(data)
            const wallets = walletManager.listWallets()
            setSubWallets(wallets)
            const name = await walletManager.getCurrentWalletName()
            setCurrentWalletName(name)
            await refreshTotalBalance()
        } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to connect')
            setConnected(false)
            setSubWallets([])
        } finally {
            setSwitchingWallet(false)
        }
    }

    // ─── Disconnect Logic ───────────────────────────────────

    const handleDisconnect = async () => {
        const name = await walletManager.getCurrentWalletName()
        if (!name) {
            setLogoutWalletName('')
            setNameBeforeLogoutVisible(true)
        } else {
            confirmDisconnect()
        }
    }

    const confirmDisconnect = () => {
        Alert.alert(
            'Disconnect',
            'You can reconnect from saved wallets later.',
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

    const handleNameAndDisconnect = async () => {
        if (logoutWalletName.trim()) {
            await walletManager.saveWalletToList(logoutWalletName.trim())
        }
        setNameBeforeLogoutVisible(false)
        confirmDisconnect()
    }

    // ─── Sub-wallet Management ──────────────────────────────

    const handleRevokeWallet = (wallet: SubWallet) => {
        Alert.alert(
            'Delete Wallet',
            `Delete "${wallet.name}"? This cannot be undone.`,
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

    const handleRenameSubmit = async () => {
        if (!walletToRename || !newWalletName.trim()) return
        try {
            await walletManager.renameSubWallet(walletToRename.id, newWalletName.trim())
            const wallets = walletManager.listWallets()
            setSubWallets(wallets)
            setRenameDialogVisible(false)
            setWalletToRename(null)
        } catch (error) {
            Alert.alert('Error', 'Failed to rename wallet')
        }
    }

    const handleTopUpSubmit = async () => {
        if (!walletToTopUp || !topUpAmount.trim()) return

        const amountSats = Number.parseInt(topUpAmount.trim())
        if (Number.isNaN(amountSats) || amountSats <= 0) {
            Alert.alert('Error', 'Please enter a valid amount')
            return
        }

        const amountMsat = amountSats * 1000
        const totalMasterMsat = totalBalance || 0
        const sumSubwalletsMsat = Object.values(walletBalances).reduce((acc, bal) => (acc || 0) + (bal || 0), 0) || 0
        const availableMsat = Math.max(0, totalMasterMsat - sumSubwalletsMsat)

        if (amountMsat > availableMsat) {
            Alert.alert('Insufficient Balance', `Max available: ${Math.floor(availableMsat / 1000).toLocaleString()} sats`)
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
        } catch (error) {
            Alert.alert('Error', 'Failed to top up wallet')
        }
    }

    const handleWalletCreated = (_wallet: SubWallet) => {
        const wallets = walletManager.listWallets()
        setSubWallets(wallets)
        setModalVisible(false)
        refreshTotalBalance()
    }

    const toggleBalanceVisibility = async () => {
        if (!isBalanceVisible) {
            const ok = await SecurityService.authenticate('Authorize to reveal balances')
            if (ok) setBalanceVisible(true)
        } else {
            setBalanceVisible(false)
        }
    }

    const formatBalance = (msat: number | null | undefined): string => {
        if (msat === null || msat === undefined) return '---'
        return Math.ceil(msat / 1000).toLocaleString()
    }

    // ─── QR Scanner for Switcher ────────────────────────────
    if (switcherScannerVisible) {
        return <QRScanner onScan={handleSwitcherScan} onClose={() => setSwitcherScannerVisible(false)} title="Scan NWC Connection" />
    }

    return (
        <View style={styles.container}>
            {/* Header with Wallet Switcher */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
                <Pressable onPress={openSwitcher} style={({ pressed }) => [styles.headerLeft, pressed && { opacity: 0.7 }]}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {currentWalletName || 'Set Wallet Name'}
                    </Text>
                    {!currentWalletName && (
                        <View style={styles.tapToNameBadge}>
                            <Text style={styles.tapToNameText}>tap to name</Text>
                        </View>
                    )}
                    {currentWalletName && (
                        <Text style={styles.headerSubtitle}>
                            {activeWallets.length} wallet{activeWallets.length !== 1 ? 's' : ''} · tap to switch
                        </Text>
                    )}
                </Pressable>
                <Pressable
                    onPress={handleDisconnect}
                    style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.6 }]}
                >
                    <LogOut size={18} color={Colors.textSecondary} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Total Balance */}
                <View style={styles.balanceSection}>
                    <View style={styles.balanceLabelRow}>
                        <Text style={styles.balanceLabel}>Total Balance</Text>
                        <Pressable onPress={toggleBalanceVisibility} hitSlop={12}>
                            {isBalanceVisible
                                ? <EyeOff size={16} color={Colors.textTertiary} />
                                : <Eye size={16} color={Colors.textTertiary} />}
                        </Pressable>
                    </View>
                    <Text style={styles.balanceAmount}>
                        {isBalanceVisible ? formatBalance(totalBalance) : '•••••'}
                        <Text style={styles.balanceSats}> sats</Text>
                    </Text>
                </View>

                {/* Section header */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>SUB-WALLETS</Text>
                    <Pressable onPress={refreshTotalBalance} hitSlop={8}>
                        <RefreshCw size={14} color={loading ? Colors.accent : Colors.textSecondary} />
                    </Pressable>
                </View>

                {/* Wallet cards */}
                {activeWallets.length > 0 ? (
                    activeWallets.map((wallet) => (
                        <Pressable
                            key={wallet.id}
                            style={styles.walletCard}
                            onPress={() => useWalletStore.getState().setSelectedWalletId(wallet.id)}
                        >
                            <View style={styles.walletAccent} />
                            <View style={styles.walletContent}>
                                <View style={styles.walletTop}>
                                    <View style={styles.walletInfo}>
                                        <Text style={styles.walletName}>{wallet.name}</Text>
                                        <Text style={styles.walletType}>
                                            {wallet.permissions.length > 4 ? 'Full access' : 'Receive only'}
                                        </Text>
                                    </View>
                                    <View style={styles.walletRight}>
                                        <Text style={styles.walletBalance}>
                                            {isBalanceVisible ? formatBalance(walletBalances[wallet.id]) : '•••••'}
                                            <Text style={styles.walletBalanceSats}> sats</Text>
                                        </Text>
                                        <View style={styles.walletActions}>
                                            <Pressable
                                                onPress={(e) => {
                                                    e.stopPropagation()
                                                    setExpandedWallets(prev => ({ ...prev, [wallet.id]: !prev[wallet.id] }))
                                                }}
                                                hitSlop={8}
                                            >
                                                {expandedWallets[wallet.id]
                                                    ? <ChevronUp size={16} color={Colors.textSecondary} />
                                                    : <ChevronDown size={16} color={Colors.textSecondary} />}
                                            </Pressable>
                                            <Menu
                                                visible={menuVisible === wallet.id}
                                                onDismiss={() => setMenuVisible(null)}
                                                contentStyle={{ backgroundColor: Colors.surfaceElevated }}
                                                anchor={
                                                    <Pressable onPress={() => setMenuVisible(wallet.id)} hitSlop={8}>
                                                        <MoreVertical size={16} color={Colors.textSecondary} />
                                                    </Pressable>
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
                                    </View>
                                </View>

                                {expandedWallets[wallet.id] && (
                                    <View style={styles.permissionRow}>
                                        {wallet.permissions.map((perm, idx) => (
                                            <View key={`${wallet.id}-perm-${idx}`} style={styles.permissionPill}>
                                                <Text style={styles.permissionText}>{perm}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </Pressable>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Zap size={32} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No Sub-Wallets</Text>
                        <Text style={styles.emptyText}>Tap + to create your first scoped wallet</Text>
                    </View>
                )}
            </ScrollView>

            {/* FAB */}
            <Pressable
                style={({ pressed }) => [
                    styles.fab,
                    { marginBottom: (Platform.OS === 'android' ? 16 : 0) + insets.bottom },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
                ]}
                onPress={() => setModalVisible(true)}
            >
                <Plus size={24} color={Colors.accentText} strokeWidth={2.5} />
            </Pressable>

            {/* ═══ Wallet Switcher Bottom Sheet ═══ */}
            <RNModal
                visible={switcherVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setSwitcherVisible(false)}
            >
                <Pressable style={styles.switcherOverlay} onPress={() => setSwitcherVisible(false)}>
                  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
                    <Pressable style={styles.switcherSheet} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.switcherHandle} />
                        <Text style={styles.switcherTitle}>Switch Wallet</Text>

                        {/* Current wallet name editing */}
                        <View style={styles.switcherCurrentSection}>
                            <Text style={styles.switcherLabel}>CURRENT</Text>
                            {masterNameEditing ? (
                                <View style={styles.switcherEditRow}>
                                    <TextInput
                                        value={masterNameInput}
                                        onChangeText={setMasterNameInput}
                                        mode="outlined"
                                        placeholder="Enter wallet name"
                                        style={styles.switcherNameInput}
                                        outlineColor={Colors.surfaceBorder}
                                        activeOutlineColor={Colors.accent}
                                        autoFocus
                                        dense
                                    />
                                    <Pressable style={styles.switcherEditBtn} onPress={handleSaveMasterName}>
                                        <Check size={18} color={Colors.accent} />
                                    </Pressable>
                                </View>
                            ) : (
                                <Pressable
                                    style={styles.switcherCurrentCard}
                                    onPress={() => {
                                        setMasterNameInput(currentWalletName || '')
                                        setMasterNameEditing(true)
                                    }}
                                >
                                    <View style={styles.switcherIconActive}>
                                        <Wallet size={16} color={Colors.accent} />
                                    </View>
                                    <Text style={styles.switcherCurrentName} numberOfLines={1}>
                                        {currentWalletName || 'Unnamed · tap to set name'}
                                    </Text>
                                    <Edit3 size={14} color={Colors.textSecondary} />
                                </Pressable>
                            )}
                        </View>

                        {/* Other saved wallets */}
                        {savedWallets.filter(w => w.pubkey !== walletManager.getActivePubkey()).length > 0 && (
                            <View style={styles.switcherOtherSection}>
                                <Text style={styles.switcherLabel}>OTHER WALLETS</Text>
                                {savedWallets
                                    .filter(w => w.pubkey !== walletManager.getActivePubkey())
                                    .map((wallet) => (
                                        <Pressable
                                            key={wallet.id}
                                            style={({ pressed }) => [styles.switcherOtherCard, pressed && { borderColor: Colors.accent }]}
                                            onPress={() => handleSwitchWallet(wallet)}
                                        >
                                            <View style={styles.switcherIcon}>
                                                <Wallet size={16} color={Colors.textSecondary} />
                                            </View>
                                            <Text style={styles.switcherOtherName} numberOfLines={1}>
                                                {wallet.name || 'Unnamed Wallet'}
                                            </Text>
                                            <ChevronDown size={14} color={Colors.textTertiary} style={{ transform: [{ rotate: '-90deg' }] }} />
                                        </Pressable>
                                    ))}
                            </View>
                        )}

                        {/* Add new via scan */}
                        <Pressable
                            style={({ pressed }) => [styles.switcherScanBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => {
                                setSwitcherVisible(false)
                                setSwitcherScannerVisible(true)
                            }}
                        >
                            <Scan size={18} color={Colors.accent} />
                            <Text style={styles.switcherScanText}>Scan to add new wallet</Text>
                        </Pressable>
                    </Pressable>
                  </KeyboardAvoidingView>
                </Pressable>
            </RNModal>

            {/* ═══ Switching Wallet Loading Overlay ═══ */}
            {switchingWallet && (
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingContent}>
                        <Zap size={40} color={Colors.accent} />
                        <Text style={styles.loadingTitle}>Connecting...</Text>
                        <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: Spacing.md }} />
                    </View>
                </View>
            )}

            {/* Create Wallet Modal */}
            <CreateWalletModal
                visible={modalVisible}
                onDismiss={() => setModalVisible(false)}
                onWalletCreated={handleWalletCreated}
            />

            {/* Rename Dialog */}
            <Portal>
                <Dialog visible={renameDialogVisible} onDismiss={() => setRenameDialogVisible(false)} style={styles.dialog}>
                    <Dialog.Title style={styles.dialogTitle}>Rename</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Wallet Name"
                            value={newWalletName}
                            onChangeText={setNewWalletName}
                            mode="outlined"
                            style={styles.dialogInput}
                            outlineColor={Colors.surfaceBorder}
                            activeOutlineColor={Colors.accent}
                            autoFocus
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setRenameDialogVisible(false)} textColor={Colors.textSecondary}>Cancel</Button>
                        <Button onPress={handleRenameSubmit} textColor={Colors.accent}>Save</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Top Up Dialog */}
            <Portal>
                <Dialog visible={topUpDialogVisible} onDismiss={() => setTopUpDialogVisible(false)} style={styles.dialog}>
                    <Dialog.Title style={styles.dialogTitle}>Top Up</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Amount (sats)"
                            value={topUpAmount}
                            onChangeText={setTopUpAmount}
                            mode="outlined"
                            keyboardType="numeric"
                            style={styles.dialogInput}
                            outlineColor={Colors.surfaceBorder}
                            activeOutlineColor={Colors.accent}
                            autoFocus
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setTopUpDialogVisible(false)} textColor={Colors.textSecondary}>Cancel</Button>
                        <Button onPress={handleTopUpSubmit} textColor={Colors.accent}>Top Up</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Name Before Logout Dialog */}
            <Portal>
                <Dialog visible={nameBeforeLogoutVisible} onDismiss={() => setNameBeforeLogoutVisible(false)} style={styles.dialog}>
                    <Dialog.Title style={styles.dialogTitle}>Name Your Wallet</Dialog.Title>
                    <Dialog.Content>
                        <Text style={styles.dialogDescription}>
                            Give this wallet a name so you can reconnect later.
                        </Text>
                        <TextInput
                            label="Wallet Name"
                            value={logoutWalletName}
                            onChangeText={setLogoutWalletName}
                            mode="outlined"
                            placeholder="e.g. My Alby Wallet"
                            style={styles.dialogInput}
                            outlineColor={Colors.surfaceBorder}
                            activeOutlineColor={Colors.accent}
                            autoFocus
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => { setNameBeforeLogoutVisible(false); confirmDisconnect() }} textColor={Colors.textSecondary}>Skip</Button>
                        <Button onPress={handleNameAndDisconnect} textColor={Colors.accent}>Save & Disconnect</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    headerLeft: {
        flex: 1,
        marginRight: Spacing.md,
    },
    headerTitle: {
        color: Colors.text,
        fontWeight: '600',
        fontSize: 22,
    },
    headerSubtitle: {
        color: Colors.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    tapToNameBadge: {
        backgroundColor: Colors.accentDim,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: Radius.full,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    tapToNameText: {
        color: Colors.accent,
        fontSize: 11,
        fontWeight: '500',
    },
    logoutButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },

    scrollContent: {
        padding: Spacing.lg,
        paddingTop: Spacing.sm,
    },

    // Balance
    balanceSection: {
        marginBottom: Spacing.xl,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
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
        fontSize: 42,
        fontWeight: '200',
    },
    balanceSats: {
        fontSize: 18,
        fontWeight: '400',
        color: Colors.accent,
    },

    // Section
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.textSecondary,
        letterSpacing: 1.5,
    },

    // Wallet card
    walletCard: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
    },
    walletAccent: {
        width: 3,
        backgroundColor: Colors.accent,
    },
    walletContent: {
        flex: 1,
        padding: Spacing.md,
    },
    walletTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    walletInfo: {
        flex: 1,
    },
    walletName: {
        color: Colors.text,
        fontSize: 15,
        fontWeight: '500',
    },
    walletType: {
        color: Colors.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    walletRight: {
        alignItems: 'flex-end',
    },
    walletBalance: {
        color: Colors.text,
        fontSize: 14,
        fontWeight: '500',
    },
    walletBalanceSats: {
        color: Colors.textSecondary,
        fontSize: 12,
        fontWeight: '400',
    },
    walletActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginTop: Spacing.xs,
    },

    // Permissions
    permissionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.surfaceBorder,
    },
    permissionPill: {
        backgroundColor: Colors.accentDim,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Radius.full,
    },
    permissionText: {
        color: Colors.accent,
        fontSize: 11,
        fontWeight: '500',
    },

    // Empty state
    emptyState: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl,
    },
    emptyTitle: {
        color: Colors.textSecondary,
        fontSize: 16,
        fontWeight: '500',
        marginTop: Spacing.md,
    },
    emptyText: {
        color: Colors.textTertiary,
        fontSize: 13,
        marginTop: Spacing.xs,
    },

    // FAB
    fab: {
        position: 'absolute',
        right: Spacing.lg,
        bottom: Spacing.lg,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },

    // ═══ Wallet Switcher ═══
    switcherOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    switcherSheet: {
        backgroundColor: Colors.surfaceElevated,
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        padding: Spacing.lg,
        paddingBottom: Spacing.xxl,
        borderTopWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    switcherHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.textTertiary,
        alignSelf: 'center',
        marginBottom: Spacing.lg,
    },
    switcherTitle: {
        color: Colors.text,
        fontSize: 18,
        fontWeight: '600',
        marginBottom: Spacing.lg,
    },
    switcherLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.textSecondary,
        letterSpacing: 1.5,
        marginBottom: Spacing.sm,
    },
    switcherCurrentSection: {
        marginBottom: Spacing.lg,
    },
    switcherCurrentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.accentDim,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.accent,
        padding: Spacing.md,
    },
    switcherIconActive: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    switcherCurrentName: {
        flex: 1,
        color: Colors.text,
        fontSize: 15,
        fontWeight: '500',
        marginLeft: Spacing.sm,
    },
    switcherEditRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    switcherNameInput: {
        flex: 1,
        backgroundColor: Colors.surfaceElevated,
    },
    switcherEditBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.accentDim,
        alignItems: 'center',
        justifyContent: 'center',
    },
    switcherOtherSection: {
        marginBottom: Spacing.lg,
    },
    switcherOtherCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    switcherIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.surfaceBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    switcherOtherName: {
        flex: 1,
        color: Colors.text,
        fontSize: 14,
        marginLeft: Spacing.sm,
    },
    switcherScanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: 14,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        borderStyle: 'dashed',
    },
    switcherScanText: {
        color: Colors.accent,
        fontSize: 14,
        fontWeight: '500',
    },

    // Dialogs
    dialog: {
        backgroundColor: Colors.surfaceElevated,
        borderRadius: Radius.lg,
    },
    dialogTitle: {
        color: Colors.text,
        fontWeight: '600',
    },
    dialogInput: {
        backgroundColor: Colors.surfaceElevated,
    },
    dialogDescription: {
        color: Colors.textSecondary,
        fontSize: 14,
        marginBottom: Spacing.md,
    },

    // Loading overlay
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
    },
    loadingContent: {
        alignItems: 'center',
    },
    loadingTitle: {
        color: Colors.text,
        fontSize: 18,
        fontWeight: '500',
        marginTop: Spacing.md,
    },
})
