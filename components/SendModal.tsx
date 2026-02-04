import React, { useState, useEffect } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { Modal, Portal, Text, TextInput, Button, IconButton, ActivityIndicator } from 'react-native-paper'
import { walletManager } from '../services/WalletManager'
import { useWalletStore } from '../store/walletStore'
import QRScanner from './QRScanner'
import { Scan } from 'lucide-react-native'

interface SendModalProps {
    visible: boolean
    onDismiss: () => void
    initialInvoice?: string
    onPaymentSuccess: () => void
}

export default function SendModal({ visible, onDismiss, initialInvoice = '', onPaymentSuccess }: SendModalProps) {
    const [invoice, setInvoice] = useState(initialInvoice)
    const [amountSats, setAmountSats] = useState('')
    const [balance, setBalance] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [resolving, setResolving] = useState(false)
    const [error, setError] = useState('')
    const [isLNAddress, setIsLNAddress] = useState(false)
    const [scannerVisible, setScannerVisible] = useState(false)

    // Auto-update if initialInvoice changes
    useEffect(() => {
        if (initialInvoice) {
            setInvoice(initialInvoice)
        }
    }, [initialInvoice])

    useEffect(() => {
        const selectedId = useWalletStore.getState().selectedWalletId
        if (visible && selectedId) {
            walletManager.getWalletBalance(selectedId).then(setBalance)
        }
    }, [visible])

    // Detect LN Address
    useEffect(() => {
        const lowerInvoice = invoice.toLowerCase().trim()
        setIsLNAddress(
            lowerInvoice.includes('@') &&
            !lowerInvoice.startsWith('lnbc') &&
            !lowerInvoice.startsWith('lightning:')
        )
    }, [invoice])

    const selectedWalletId = useWalletStore.getState().selectedWalletId

    const handlePay = async () => {
        if (!invoice.trim()) return

        setLoading(true)
        setError('')

        try {
            let finalInvoice = invoice.trim()
            let finalAmountMsat: number | undefined = undefined

            // Check balance first
            if (balance !== null) {
                // If it's a LN address, we know the amount early
                if (isLNAddress && amountSats) {
                    const reqSats = parseInt(amountSats)
                    if (reqSats * 1000 > balance) {
                        throw new Error(`Insufficient funds. This sub-wallet only has ${(balance / 1000).toLocaleString()} sats.`)
                    }
                }
            }

            if (isLNAddress) {
                if (!amountSats) {
                    throw new Error('Please enter an amount for the Lightning Address')
                }

                const amountMsat = parseInt(amountSats) * 1000
                setResolving(true)

                // Resolve LN Address to metadata
                const metadata = await walletManager.resolveLightningAddress(finalInvoice)

                // Fetch BOLT11 invoice from provider
                finalInvoice = await walletManager.getInvoiceFromLNURL(metadata.callback, amountMsat)
                finalAmountMsat = amountMsat

                setResolving(false)
            }

            await walletManager.payInvoice(finalInvoice, finalAmountMsat, selectedWalletId || undefined)
            Alert.alert('Success', 'Payment sent successfully!')
            onPaymentSuccess()
            reset()
        } catch (err) {
            console.error('Payment failed:', err)
            setError(err instanceof Error ? err.message : 'Payment failed. Please check the destination and your balance.')
        } finally {
            setLoading(false)
            setResolving(false)
        }
    }

    const handleScan = (data: string) => {
        setInvoice(data)
        setScannerVisible(false)
    }

    const reset = () => {
        setInvoice('')
        setAmountSats('')
        setError('')
        onDismiss()
    }

    if (scannerVisible) {
        return <QRScanner onScan={handleScan} onClose={() => setScannerVisible(false)} />
    }

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={reset}
                contentContainerStyle={styles.container}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text variant="headlineSmall" style={styles.title}>Send Payment</Text>
                        <View style={styles.headerActions}>
                            <IconButton
                                icon={() => <Scan size={20} color="#FFD700" />}
                                onPress={() => setScannerVisible(true)}
                            />
                            <IconButton icon="close" iconColor="#888" onPress={reset} />
                        </View>
                    </View>

                    <TextInput
                        label="LN Invoice or LN Address"
                        value={invoice}
                        onChangeText={setInvoice}
                        mode="outlined"
                        multiline={!isLNAddress}
                        numberOfLines={isLNAddress ? 1 : 3}
                        style={styles.input}
                        placeholder="lnbc... or user@domain.com"
                        error={!!error}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    {balance !== null && (
                        <Text style={styles.balanceHint}>
                            Available: {(balance / 1000).toLocaleString()} sats
                        </Text>
                    )}


                    {isLNAddress && (
                        <TextInput
                            label="Amount (sats)"
                            value={amountSats}
                            onChangeText={setAmountSats}
                            mode="outlined"
                            keyboardType="numeric"
                            style={styles.input}
                            placeholder="1000"
                        />
                    )}

                    {resolving && (
                        <View style={styles.statusRow}>
                            <ActivityIndicator size="small" color="#FFD700" />
                            <Text style={styles.statusText}>Resolving address...</Text>
                        </View>
                    )}

                    {error ? (
                        <Text style={styles.errorText}>{error}</Text>
                    ) : null}

                    <Button
                        mode="contained"
                        onPress={handlePay}
                        loading={loading}
                        disabled={!invoice || loading || resolving}
                        style={styles.button}
                        buttonColor="#FFD700"
                        textColor="#000"
                    >
                        {isLNAddress ? 'Pay Address' : 'Pay Invoice'}
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
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        color: '#FFD700',
        fontWeight: 'bold',
    },
    input: {
        marginBottom: 12,
    },
    errorText: {
        color: '#F44336',
        marginTop: 4,
        marginBottom: 16,
        fontSize: 14,
    },
    balanceHint: {
        color: '#888',
        fontSize: 12,
        marginBottom: 12,
        textAlign: 'right',
    },

    button: {
        marginTop: 8,
        paddingVertical: 4,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    statusText: {
        color: '#FFD700',
        fontSize: 14,
    },
})
