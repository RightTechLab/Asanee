import React, { useState } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Modal, Portal, Text, TextInput, Button, Checkbox, Card, IconButton } from 'react-native-paper'
import { walletManager } from '../services/WalletManager'
import { NWCPermission, WalletConfig, SubWallet } from '../types'
import QRScanner from './QRScanner'
import { Scan } from 'lucide-react-native'

interface CreateWalletModalProps {
    visible: boolean
    onDismiss: () => void
    onWalletCreated: (wallet: SubWallet) => void
}

const AVAILABLE_PERMISSIONS: { key: NWCPermission; label: string }[] = [
    { key: 'get_info', label: 'Get Info' },
    { key: 'get_balance', label: 'Get Balance' },
    { key: 'make_invoice', label: 'Make Invoice' },
    { key: 'pay_invoice', label: 'Pay Invoice' },
    { key: 'list_transactions', label: 'List Transactions' },
]

export default function CreateWalletModal({
    visible,
    onDismiss,
    onWalletCreated,
}: CreateWalletModalProps) {
    const [mode, setMode] = useState<'create' | 'import'>('create')
    const [name, setName] = useState('')
    const [nwcUri, setNwcUri] = useState('')
    const [selectedPermissions, setSelectedPermissions] = useState<Set<NWCPermission>>(
        new Set(['get_info', 'get_balance'])
    )
    const [budgetSats, setBudgetSats] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [scannerVisible, setScannerVisible] = useState(false)

    const togglePermission = (perm: NWCPermission) => {
        const newPerms = new Set(selectedPermissions)
        if (newPerms.has(perm)) {
            newPerms.delete(perm)
        } else {
            newPerms.add(perm)
        }
        setSelectedPermissions(newPerms)
    }

    const handleCreate = async () => {
        if (!name.trim()) {
            setError('Please enter a wallet name')
            return
        }

        if (mode === 'import') {
            if (!nwcUri.trim()) {
                setError('Please enter an NWC URI')
                return
            }
            if (!nwcUri.startsWith('nostr+walletconnect://')) {
                setError('Invalid NWC URI format')
                return
            }
        } else {
            if (selectedPermissions.size === 0) {
                setError('Please select at least one permission')
                return
            }
        }

        setLoading(true)
        setError('')

        try {
            const config: WalletConfig = {
                name: name.trim(),
                permissions: mode === 'create' ? Array.from(selectedPermissions) : [],
                budgetMsat: (mode === 'create' && budgetSats) ? parseInt(budgetSats) * 1000 : undefined,
                nwcUri: mode === 'import' ? nwcUri.trim() : undefined
            }

            const wallet = await walletManager.createSubWallet(config)
            onWalletCreated(wallet)

            // Reset form
            setName('')
            setNwcUri('')
            setSelectedPermissions(new Set(['get_info', 'get_balance']))
            setBudgetSats('')
            setMode('create')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create wallet')
        } finally {
            setLoading(false)
        }
    }

    const handleScan = (data: string) => {
        setNwcUri(data)
        setScannerVisible(false)
    }

    if (scannerVisible) {
        return <QRScanner onScan={handleScan} onClose={() => setScannerVisible(false)} title="Scan NWC" />
    }

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={styles.modalContainer}
            >
                <ScrollView>
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text variant="headlineSmall" style={styles.title}>
                                {mode === 'create' ? 'Create Sub-Wallet' : 'Import Wallet'}
                            </Text>

                            <View style={styles.toggleRow}>
                                <Button
                                    mode={mode === 'create' ? 'contained' : 'outlined'}
                                    onPress={() => setMode('create')}
                                    style={styles.toggleButton}
                                    buttonColor={mode === 'create' ? '#FFD700' : undefined}
                                    textColor={mode === 'create' ? '#000000' : '#888888'}
                                >
                                    New
                                </Button>
                                <Button
                                    mode={mode === 'import' ? 'contained' : 'outlined'}
                                    onPress={() => setMode('import')}
                                    style={styles.toggleButton}
                                    buttonColor={mode === 'import' ? '#FFD700' : undefined}
                                    textColor={mode === 'import' ? '#000000' : '#888888'}
                                >
                                    Import
                                </Button>
                            </View>

                            <TextInput
                                label="Wallet Name"
                                value={name}
                                onChangeText={setName}
                                mode="outlined"
                                placeholder="e.g., Spending, Savings, Merchant"
                                style={styles.input}
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
                                        style={[styles.input, styles.importInput]}
                                        multiline
                                        numberOfLines={3}
                                        error={!!error && (!nwcUri || !nwcUri.startsWith('nostr+walletconnect://'))}
                                    />
                                    <IconButton
                                        icon={() => <Scan size={24} color="#FFD700" />}
                                        onPress={() => setScannerVisible(true)}
                                        style={styles.scanButton}
                                    />
                                </View>
                            ) : (
                                <>
                                    <Text variant="titleMedium" style={styles.sectionTitle}>
                                        Access Level
                                    </Text>
                                    <View style={styles.toggleRow}>
                                        <Button
                                            mode={selectedPermissions.has('pay_invoice') ? 'contained' : 'outlined'}
                                            onPress={() => setSelectedPermissions(new Set(['get_info', 'get_balance', 'make_invoice', 'pay_invoice', 'list_transactions']))}
                                            style={styles.toggleButton}
                                            buttonColor={selectedPermissions.has('pay_invoice') ? '#FFD700' : undefined}
                                            textColor={selectedPermissions.has('pay_invoice') ? '#000000' : '#888888'}
                                        >
                                            Full Access
                                        </Button>
                                        <Button
                                            mode={!selectedPermissions.has('pay_invoice') ? 'contained' : 'outlined'}
                                            onPress={() => setSelectedPermissions(new Set(['get_info', 'get_balance', 'make_invoice', 'list_transactions']))}
                                            style={styles.toggleButton}
                                            buttonColor={!selectedPermissions.has('pay_invoice') ? '#FFD700' : undefined}
                                            textColor={!selectedPermissions.has('pay_invoice') ? '#000000' : '#888888'}
                                        >
                                            Receive Only
                                        </Button>
                                    </View>

                                    {selectedPermissions.has('pay_invoice') && (
                                        <>
                                            <Text variant="titleMedium" style={styles.sectionTitle}>
                                                Budget (Optional)
                                            </Text>
                                            <View style={styles.budgetRow}>
                                                <TextInput
                                                    label="Initial Balance (Sats)"
                                                    value={budgetSats}
                                                    onChangeText={setBudgetSats}
                                                    mode="outlined"
                                                    keyboardType="numeric"
                                                    placeholder="e.g., 1000"
                                                    style={styles.budgetInput}
                                                />
                                            </View>
                                        </>
                                    )}
                                </>
                            )}

                            {error ? (
                                <Text style={styles.errorText}>{error}</Text>
                            ) : null}

                            <View style={styles.buttonRow}>
                                <Button
                                    mode="outlined"
                                    onPress={onDismiss}
                                    style={styles.cancelButton}
                                    textColor="#888888"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    mode="contained"
                                    onPress={handleCreate}
                                    loading={loading}
                                    disabled={loading}
                                    style={styles.createButton}
                                    buttonColor="#FFD700"
                                    textColor="#000000"
                                >
                                    {mode === 'create' ? 'Create' : 'Import'}
                                </Button>
                            </View>
                        </Card.Content>
                    </Card>
                </ScrollView>
            </Modal>
        </Portal>
    )
}

const styles = StyleSheet.create({
    modalContainer: {
        margin: 20,
        maxHeight: '90%',
    },
    card: {
        backgroundColor: '#141414',
    },
    title: {
        color: '#FFD700',
        marginBottom: 20,
    },
    input: {
        marginBottom: 16,
    },
    sectionTitle: {
        color: '#FFFFFF',
        marginTop: 16,
        marginBottom: 12,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    checkboxLabel: {
        color: '#E0E0E0',
        fontSize: 16,
        flex: 1,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 24,
        gap: 12,
    },
    toggleRow: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 12,
    },
    toggleButton: {
        flex: 1,
        borderColor: '#333333',
    },
    cancelButton: {
        flex: 1,
        borderColor: '#333333',
    },
    createButton: {
        flex: 1,
    },
    errorText: {
        color: '#CF6679',
        marginTop: 8,
    },
    budgetRow: {
        marginBottom: 8,
    },
    budgetInput: {
        flex: 1,
    },
    importRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    importInput: {
        flex: 1,
        marginBottom: 16,
    },
    scanButton: {
        margin: 0,
        marginLeft: 8,
        marginBottom: 16,
    },
})
