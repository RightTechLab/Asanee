import React, { useState } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Modal, Portal, Text, TextInput, Button, Checkbox, Card } from 'react-native-paper'
import { walletManager } from '../services/WalletManager'
import { NWCPermission, WalletConfig, SubWallet } from '../types'

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
    const [name, setName] = useState('')
    const [selectedPermissions, setSelectedPermissions] = useState<Set<NWCPermission>>(
        new Set(['get_info', 'get_balance'])
    )
    const [budgetSats, setBudgetSats] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

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

        if (selectedPermissions.size === 0) {
            setError('Please select at least one permission')
            return
        }

        setLoading(true)
        setError('')

        try {
            const config: WalletConfig = {
                name: name.trim(),
                permissions: Array.from(selectedPermissions),
                budgetMsat: budgetSats ? parseInt(budgetSats) * 1000 : undefined,
            }

            const wallet = await walletManager.createSubWallet(config)
            onWalletCreated(wallet)

            // Reset form
            setName('')
            setSelectedPermissions(new Set(['get_info', 'get_balance']))
            setBudgetSats('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create wallet')
        } finally {
            setLoading(false)
        }
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
                                Create Sub-Wallet
                            </Text>

                            <TextInput
                                label="Wallet Name"
                                value={name}
                                onChangeText={setName}
                                mode="outlined"
                                placeholder="e.g., Spending, Savings, Merchant"
                                style={styles.input}
                                error={!!error && !name.trim()}
                            />

                            <Text variant="titleMedium" style={styles.sectionTitle}>
                                Permissions
                            </Text>

                            {AVAILABLE_PERMISSIONS.map((perm) => (
                                <View key={perm.key} style={styles.checkboxRow}>
                                    <Checkbox
                                        status={selectedPermissions.has(perm.key) ? 'checked' : 'unchecked'}
                                        onPress={() => togglePermission(perm.key)}
                                        color="#FFD700"
                                    />
                                    <Text style={styles.checkboxLabel} onPress={() => togglePermission(perm.key)}>
                                        {perm.label}
                                    </Text>
                                </View>
                            ))}

                            <Text variant="titleMedium" style={styles.sectionTitle}>
                                Budget (Optional)
                            </Text>

                            <TextInput
                                label="Budget in sats"
                                value={budgetSats}
                                onChangeText={setBudgetSats}
                                mode="outlined"
                                keyboardType="numeric"
                                placeholder="e.g., 100000"
                                style={styles.input}
                            />

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
                                    Create
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
})
