import React, { useState, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { Modal, Portal, Text, TextInput, Button, IconButton } from 'react-native-paper'
import { walletManager } from '../services/WalletManager'
import { SubWallet } from '../types'

interface FundWalletModalProps {
    visible: boolean
    onDismiss: () => void
    wallet: SubWallet | null
    onFunded: () => void
    masterBalance: number | null
}

export default function FundWalletModal({ visible, onDismiss, wallet, onFunded, masterBalance }: FundWalletModalProps) {
    const [amount, setAmount] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (visible) {
            setAmount('')
            setError('')
        }
    }, [visible])

    const handleFund = async () => {
        if (!wallet || !amount) return

        const amountSats = parseInt(amount)
        if (isNaN(amountSats) || amountSats <= 0) {
            setError('Please enter a valid amount')
            return
        }

        if (masterBalance !== null && amountSats * 1000 > masterBalance) {
            setError('Insufficient master balance')
            return
        }

        setLoading(true)
        try {
            await walletManager.fundSubWallet(wallet.id, amountSats * 1000)
            onFunded()
            onDismiss()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Funding failed')
        } finally {
            setLoading(false)
        }
    }

    if (!wallet) return null

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={styles.container}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text variant="headlineSmall" style={styles.title}>Fund Wallet</Text>
                        <IconButton icon="close" iconColor="#888" onPress={onDismiss} />
                    </View>

                    <Text style={styles.subtitle}>
                        Allocate funds to <Text style={styles.bold}>{wallet.name}</Text>
                    </Text>

                    <TextInput
                        label="Amount (sats)"
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                        mode="outlined"
                        style={styles.input}
                        placeholder="0"
                        error={!!error}
                    />

                    {masterBalance !== null && (
                        <Text style={styles.balanceText}>
                            Available in Master: {(masterBalance / 1000).toLocaleString()} sats
                        </Text>
                    )}

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <Button
                        mode="contained"
                        onPress={handleFund}
                        loading={loading}
                        disabled={!amount || loading}
                        style={styles.button}
                        buttonColor="#FFD700"
                        textColor="#000"
                    >
                        Fund Now
                    </Button>
                </View>
            </Modal>
        </Portal>
    )
}

const styles = StyleSheet.create({
    container: {
        margin: 20,
    },
    content: {
        backgroundColor: '#141414',
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        color: '#FFD700',
        fontWeight: 'bold',
    },
    subtitle: {
        color: '#888',
        marginBottom: 20,
    },
    bold: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    input: {
        marginBottom: 8,
    },
    balanceText: {
        color: '#666',
        fontSize: 12,
        marginBottom: 16,
        textAlign: 'right',
    },
    errorText: {
        color: '#F44336',
        marginBottom: 16,
    },
    button: {
        marginTop: 8,
        paddingVertical: 6,
    },
})
