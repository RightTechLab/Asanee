import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, Pressable } from 'react-native'
import { TextInput, Button, Text, IconButton } from 'react-native-paper'
import { walletManager } from '../services/WalletManager'
import { useWalletStore } from '../store/walletStore'
import QRScanner from '../components/QRScanner'
import { Eye, EyeOff, Scan, Trash2, Wallet, Zap, ChevronRight } from 'lucide-react-native'
import { Colors, Spacing, Radius } from '../theme'
import type { SavedWallet } from '../types'

export default function ConnectScreen() {
    const [nwcUri, setNwcUri] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [secureEntry, setSecureEntry] = useState(true)
    const [scannerVisible, setScannerVisible] = useState(false)
    const [savedWallets, setSavedWallets] = useState<SavedWallet[]>([])
    const [connectingWalletId, setConnectingWalletId] = useState<string | null>(null)

    const setConnected = useWalletStore((state) => state.setConnected)
    const setSubWallets = useWalletStore((state) => state.setSubWallets)

    useEffect(() => {
        loadSavedWallets()
    }, [])

    const loadSavedWallets = async () => {
        const wallets = await walletManager.getSavedWallets()
        setSavedWallets(wallets)
    }

    const handleConnect = async (uri?: string) => {
        const connectionUri = uri || nwcUri
        if (!connectionUri.trim()) {
            setError('Please enter a valid NWC URI')
            return
        }

        setLoading(true)
        setError('')

        try {
            await walletManager.connect(connectionUri)
            const wallets = walletManager.listWallets()
            setSubWallets(wallets)
            setConnected(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect')
        } finally {
            setLoading(false)
        }
    }

    const handleSavedWalletConnect = async (wallet: SavedWallet) => {
        setConnectingWalletId(wallet.id)
        setError('')

        try {
            await walletManager.connect(wallet.nwcUri)
            const wallets = walletManager.listWallets()
            setSubWallets(wallets)
            setConnected(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reconnect')
        } finally {
            setConnectingWalletId(null)
        }
    }

    const handleDeleteSavedWallet = (wallet: SavedWallet) => {
        Alert.alert(
            'Remove Wallet',
            `Remove "${wallet.name || 'Unnamed Wallet'}" from saved list?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        await walletManager.removeSavedWallet(wallet.id)
                        await loadSavedWallets()
                    },
                },
            ]
        )
    }

    const handleScan = (data: string) => {
        setScannerVisible(false)
        setNwcUri(data)
        handleConnect(data)
    }

    const formatLastUsed = (timestamp: number): string => {
        const diff = Date.now() - timestamp
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 1) return 'just now'
        if (minutes < 60) return `${minutes}m ago`
        if (hours < 24) return `${hours}h ago`
        return `${days}d ago`
    }

    if (scannerVisible) {
        return <QRScanner onScan={handleScan} onClose={() => setScannerVisible(false)} title="Scan NWC Connection" />
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    {/* Hero */}
                    <View style={styles.hero}>
                        <View style={styles.logoContainer}>
                            <Zap size={28} color={Colors.accent} />
                        </View>
                        <Text style={styles.heroTitle}>Asanee</Text>
                        <Text style={styles.heroSubtitle}>
                            {savedWallets.length > 0 ? 'Welcome back' : 'Lightning Wallet Manager'}
                        </Text>
                    </View>

                    {/* Saved Wallets */}
                    {savedWallets.length > 0 && (
                        <View style={styles.savedSection}>
                            <Text style={styles.sectionLabel}>SAVED WALLETS</Text>
                            {savedWallets.map((wallet) => (
                                <Pressable
                                    key={wallet.id}
                                    style={({ pressed }) => [
                                        styles.savedCard,
                                        pressed && styles.savedCardPressed,
                                    ]}
                                    onPress={() => handleSavedWalletConnect(wallet)}
                                >
                                    <View style={styles.savedIconWrap}>
                                        <Wallet size={18} color={Colors.accent} />
                                    </View>
                                    <View style={styles.savedInfo}>
                                        <Text style={styles.savedName}>
                                            {wallet.name || 'Unnamed Wallet'}
                                        </Text>
                                        <Text style={styles.savedMeta}>
                                            {formatLastUsed(wallet.lastUsed)}
                                        </Text>
                                    </View>
                                    {connectingWalletId === wallet.id ? (
                                        <Button loading disabled textColor={Colors.accent} style={{ marginRight: -12 }}>...</Button>
                                    ) : (
                                        <View style={styles.savedActions}>
                                            <IconButton
                                                icon={() => <Trash2 size={16} color={Colors.textTertiary} />}
                                                onPress={() => handleDeleteSavedWallet(wallet)}
                                                size={16}
                                                style={{ margin: 0 }}
                                            />
                                            <ChevronRight size={16} color={Colors.textTertiary} />
                                        </View>
                                    )}
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {/* Divider */}
                    {savedWallets.length > 0 && (
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or connect new</Text>
                            <View style={styles.dividerLine} />
                        </View>
                    )}

                    {/* Connect Input */}
                    <View style={styles.connectSection}>
                        <TextInput
                            label="NWC Connection URI"
                            value={nwcUri}
                            onChangeText={setNwcUri}
                            mode="outlined"
                            placeholder="nostr+walletconnect://..."
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={styles.input}
                            error={!!error}
                            multiline={!secureEntry}
                            secureTextEntry={secureEntry}
                            outlineColor={Colors.surfaceBorder}
                            activeOutlineColor={Colors.accent}
                            textColor={Colors.text}
                            right={
                                <TextInput.Icon
                                    icon={() => secureEntry ? <EyeOff size={18} color={Colors.textSecondary} /> : <Eye size={18} color={Colors.textSecondary} />}
                                    onPress={() => setSecureEntry(!secureEntry)}
                                />
                            }
                        />

                        <Pressable
                            style={({ pressed }) => [styles.scanButton, pressed && { opacity: 0.7 }]}
                            onPress={() => setScannerVisible(true)}
                        >
                            <Scan size={18} color={Colors.accent} />
                            <Text style={styles.scanText}>Scan QR Code</Text>
                        </Pressable>

                        {error ? (
                            <Text style={styles.errorText}>{error}</Text>
                        ) : null}

                        <Pressable
                            style={({ pressed }) => [
                                styles.connectButton,
                                pressed && { opacity: 0.85 },
                                loading && { opacity: 0.6 },
                            ]}
                            onPress={() => handleConnect()}
                            disabled={loading}
                        >
                            <Text style={styles.connectButtonText}>
                                {loading ? 'Connecting...' : 'Connect Wallet'}
                            </Text>
                        </Pressable>

                        <Text style={styles.hint}>
                            Stored securely on device · Fully non-custodial
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    content: {
        maxWidth: 440,
        width: '100%',
        alignSelf: 'center',
    },

    // Hero
    hero: {
        alignItems: 'center',
        marginBottom: Spacing.xxl,
    },
    logoContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.accentDim,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    heroTitle: {
        fontSize: 32,
        fontWeight: '200',
        color: Colors.text,
        letterSpacing: 2,
    },
    heroSubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },

    // Saved wallets
    savedSection: {
        marginBottom: Spacing.lg,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.textSecondary,
        letterSpacing: 1.5,
        marginBottom: Spacing.sm,
    },
    savedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
    },
    savedCardPressed: {
        borderColor: Colors.accent,
        backgroundColor: Colors.accentDim,
    },
    savedIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.accentDim,
        alignItems: 'center',
        justifyContent: 'center',
    },
    savedInfo: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    savedName: {
        color: Colors.text,
        fontSize: 15,
        fontWeight: '500',
    },
    savedMeta: {
        color: Colors.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    savedActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },

    // Divider
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.surfaceBorder,
    },
    dividerText: {
        color: Colors.textTertiary,
        paddingHorizontal: Spacing.md,
        fontSize: 12,
    },

    // Connect
    connectSection: {},
    input: {
        marginBottom: Spacing.sm,
        backgroundColor: Colors.surface,
    },
    scanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: 14,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        marginBottom: Spacing.md,
    },
    scanText: {
        color: Colors.accent,
        fontSize: 14,
        fontWeight: '500',
    },
    errorText: {
        color: Colors.danger,
        fontSize: 13,
        marginBottom: Spacing.md,
    },
    connectButton: {
        backgroundColor: Colors.accent,
        borderRadius: Radius.md,
        paddingVertical: 16,
        alignItems: 'center',
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
    },
    connectButtonText: {
        color: Colors.accentText,
        fontSize: 16,
        fontWeight: '600',
    },
    hint: {
        color: Colors.textTertiary,
        fontSize: 12,
        textAlign: 'center',
        marginTop: Spacing.md,
    },
})
