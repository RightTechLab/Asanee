import React, { useState } from 'react'
import { View, StyleSheet, ScrollView, Pressable } from 'react-native'
import { Modal, Portal, Text, TextInput, Button } from 'react-native-paper'
import { walletManager } from '../services/WalletManager'
import type { NWCPermission, WalletConfig, SubWallet } from '../types'
import QRScanner from './QRScanner'
import { Scan, X } from 'lucide-react-native'
import { Colors, Spacing, Radius } from '../theme'

interface CreateWalletModalProps {
    visible: boolean
    onDismiss: () => void
    onWalletCreated: (wallet: SubWallet) => void
}

export default function CreateWalletModal({ visible, onDismiss, onWalletCreated }: CreateWalletModalProps) {
    const [mode, setMode] = useState<'create' | 'import'>('create')
    const [name, setName] = useState('')
    const [nwcUri, setNwcUri] = useState('')
    const [selectedPermissions, setSelectedPermissions] = useState<Set<NWCPermission>>(
        new Set(['get_info', 'get_balance'])
    )
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [scannerVisible, setScannerVisible] = useState(false)

    const handleCreate = async () => {
        if (!name.trim()) { setError('Please enter a wallet name'); return }
        if (mode === 'import') {
            if (!nwcUri.trim()) { setError('Please enter an NWC URI'); return }
            if (!nwcUri.startsWith('nostr+walletconnect://')) { setError('Invalid NWC URI format'); return }
        } else if (selectedPermissions.size === 0) {
            setError('Please select at least one permission'); return
        }

        setLoading(true)
        setError('')
        try {
            const config: WalletConfig = {
                name: name.trim(),
                permissions: mode === 'create' ? Array.from(selectedPermissions) : [],
                nwcUri: mode === 'import' ? nwcUri.trim() : undefined
            }
            const wallet = await walletManager.createSubWallet(config)
            onWalletCreated(wallet)
            setName(''); setNwcUri(''); setSelectedPermissions(new Set(['get_info', 'get_balance'])); setMode('create')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create wallet')
        } finally {
            setLoading(false)
        }
    }

    const handleScan = (data: string) => { setNwcUri(data); setScannerVisible(false) }

    if (scannerVisible) {
        return <QRScanner onScan={handleScan} onClose={() => setScannerVisible(false)} title="Scan NWC" />
    }

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modalContainer}>
                <ScrollView>
                    <View style={styles.card}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.title}>
                                {mode === 'create' ? 'Create Sub-Wallet' : 'Import Wallet'}
                            </Text>
                            <Pressable onPress={onDismiss} hitSlop={8}>
                                <X size={20} color={Colors.textSecondary} />
                            </Pressable>
                        </View>

                        {/* Mode Toggle */}
                        <View style={styles.toggleRow}>
                            <Pressable
                                style={[styles.toggleBtn, mode === 'create' && styles.toggleActive]}
                                onPress={() => setMode('create')}
                            >
                                <Text style={[styles.toggleText, mode === 'create' && styles.toggleTextActive]}>New</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.toggleBtn, mode === 'import' && styles.toggleActive]}
                                onPress={() => setMode('import')}
                            >
                                <Text style={[styles.toggleText, mode === 'import' && styles.toggleTextActive]}>Import</Text>
                            </Pressable>
                        </View>

                        {/* Name Input */}
                        <TextInput
                            label="Wallet Name"
                            value={name}
                            onChangeText={setName}
                            mode="outlined"
                            placeholder="e.g., Spending, Savings"
                            style={styles.input}
                            outlineColor={Colors.surfaceBorder}
                            activeOutlineColor={Colors.accent}
                            error={!!error && !name.trim()}
                        />

                        {mode === 'import' ? (
                            <View style={styles.importRow}>
                                <TextInput
                                    label="NWC URI"
                                    value={nwcUri}
                                    onChangeText={setNwcUri}
                                    mode="outlined"
                                    placeholder="nostr+walletconnect://..."
                                    style={[styles.input, { flex: 1 }]}
                                    outlineColor={Colors.surfaceBorder}
                                    activeOutlineColor={Colors.accent}
                                    multiline
                                    numberOfLines={3}
                                />
                                <Pressable style={styles.scanBtn} onPress={() => setScannerVisible(true)}>
                                    <Scan size={20} color={Colors.accent} />
                                </Pressable>
                            </View>
                        ) : (
                            <>
                                <Text style={styles.sectionLabel}>ACCESS LEVEL</Text>
                                <View style={styles.toggleRow}>
                                    <Pressable
                                        style={[styles.toggleBtn, selectedPermissions.has('pay_invoice') && styles.toggleActive]}
                                        onPress={() => setSelectedPermissions(new Set(['get_info', 'get_balance', 'make_invoice', 'pay_invoice', 'list_transactions']))}
                                    >
                                        <Text style={[styles.toggleText, selectedPermissions.has('pay_invoice') && styles.toggleTextActive]}>Full Access</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.toggleBtn, !selectedPermissions.has('pay_invoice') && styles.toggleActive]}
                                        onPress={() => setSelectedPermissions(new Set(['get_info', 'get_balance', 'make_invoice', 'list_transactions']))}
                                    >
                                        <Text style={[styles.toggleText, !selectedPermissions.has('pay_invoice') && styles.toggleTextActive]}>Receive Only</Text>
                                    </Pressable>
                                </View>
                            </>
                        )}

                        {error ? <Text style={styles.errorText}>{error}</Text> : null}

                        {/* Actions */}
                        <View style={styles.actionRow}>
                            <Pressable style={styles.cancelBtn} onPress={onDismiss}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.createBtn, loading && { opacity: 0.6 }]}
                                onPress={handleCreate}
                                disabled={loading}
                            >
                                <Text style={styles.createText}>
                                    {loading ? 'Creating...' : mode === 'create' ? 'Create' : 'Import'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </Modal>
        </Portal>
    )
}

const styles = StyleSheet.create({
    modalContainer: {
        margin: Spacing.lg,
        maxHeight: '90%',
    },
    card: {
        backgroundColor: Colors.surfaceElevated,
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    title: {
        color: Colors.text,
        fontSize: 18,
        fontWeight: '600',
    },
    toggleRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        alignItems: 'center',
    },
    toggleActive: {
        backgroundColor: Colors.accent,
        borderColor: Colors.accent,
    },
    toggleText: {
        color: Colors.textSecondary,
        fontWeight: '500',
        fontSize: 14,
    },
    toggleTextActive: {
        color: Colors.accentText,
    },
    input: {
        marginBottom: Spacing.md,
        backgroundColor: Colors.surfaceElevated,
    },
    importRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    scanBtn: {
        padding: Spacing.sm,
        marginBottom: Spacing.md,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.textSecondary,
        letterSpacing: 1.5,
        marginBottom: Spacing.sm,
    },
    errorText: {
        color: Colors.danger,
        fontSize: 13,
        marginTop: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    actionRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.lg,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        alignItems: 'center',
    },
    cancelText: {
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    createBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: Radius.md,
        backgroundColor: Colors.accent,
        alignItems: 'center',
    },
    createText: {
        color: Colors.accentText,
        fontWeight: '600',
    },
})
