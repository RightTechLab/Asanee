import React, { useState } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { Modal, Portal, Text, TextInput, Button, IconButton } from 'react-native-paper'
import { walletManager } from '../services/WalletManager'
import { useWalletStore } from '../store/walletStore'

interface SendModalProps {
    visible: boolean
    onDismiss: () => void
    initialInvoice?: string
    onPaymentSuccess: () => void
}

export default function SendModal({ visible, onDismiss, initialInvoice = '', onPaymentSuccess }: SendModalProps) {
    const [invoice, setInvoice] = useState(initialInvoice)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Auto-update if initialInvoice changes
    React.useEffect(() => {
        if (initialInvoice) setInvoice(initialInvoice)
    }, [initialInvoice])

    const selectedWalletId = useWalletStore.getState().selectedWalletId
    const handlePay = async () => {
        if (!invoice) return
        setLoading(true)
        setError('')
        try {
            // Currently we don't decode amount from invoice here, but if we had it, we'd pass it
            // For now we just pass walletId so it knows WHICH wallet is paying
            await walletManager.payInvoice(invoice, undefined, selectedWalletId || undefined)
            Alert.alert('Success', 'Payment sent successfully!')
            onPaymentSuccess()
            reset()
        } catch (err) {
            console.error('Payment failed:', err)
            setError(err instanceof Error ? err.message : 'Payment failed. Please check your balance and the invoice.')
        } finally {
            setLoading(false)
        }
    }

    const reset = () => {
        setInvoice('')
        setError('')
        onDismiss()
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
                        <Text variant="headlineSmall" style={styles.title}>Send Sats</Text>
                        <IconButton icon="close" iconColor="#888" onPress={reset} />
                    </View>

                    <TextInput
                        label="Lightning Invoice"
                        value={invoice}
                        onChangeText={setInvoice}
                        mode="outlined"
                        multiline
                        numberOfLines={4}
                        style={styles.input}
                        placeholder="lnbc..."
                        error={!!error}
                    />

                    {error ? (
                        <Text style={styles.errorText}>{error}</Text>
                    ) : null}

                    <Button
                        mode="contained"
                        onPress={handlePay}
                        loading={loading}
                        disabled={!invoice || loading}
                        style={styles.button}
                        buttonColor="#FFD700"
                        textColor="#000"
                    >
                        Send Payment
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
        marginBottom: 20,
    },
    title: {
        color: '#FFD700',
        fontWeight: 'bold',
    },
    input: {
        marginBottom: 16,
    },
    errorText: {
        color: '#F44336',
        marginBottom: 16,
        fontSize: 14,
    },
    button: {
        marginTop: 8,
        paddingVertical: 6,
    },
})
