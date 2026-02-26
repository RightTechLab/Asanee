import React, { useState, useEffect } from 'react'
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Pressable, Alert } from 'react-native'
import { Modal, Portal, Text, TextInput, Button, ActivityIndicator } from 'react-native-paper'
import { walletManager } from '../services/WalletManager'
import { useWalletStore } from '../store/walletStore'
import QRScanner from './QRScanner'
import { Scan, X } from 'lucide-react-native'
import { Colors, Spacing, Radius } from '../theme'

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

    useEffect(() => { if (initialInvoice) setInvoice(initialInvoice) }, [initialInvoice])

    useEffect(() => {
        const selectedId = useWalletStore.getState().selectedWalletId
        if (visible && selectedId) walletManager.getWalletBalance(selectedId).then(setBalance)
    }, [visible])

    useEffect(() => {
        const lower = invoice.toLowerCase().trim()
        setIsLNAddress(lower.includes('@') && !lower.startsWith('lnbc') && !lower.startsWith('lightning:'))
    }, [invoice])

    const selectedWalletId = useWalletStore.getState().selectedWalletId

    const handlePay = async () => {
        if (!invoice.trim()) return
        setLoading(true); setError('')
        try {
            let finalInvoice = invoice.trim()
            let finalAmountMsat: number | undefined

            if (balance !== null && isLNAddress && amountSats) {
                const reqSats = Number.parseInt(amountSats)
                if (reqSats * 1000 > balance) throw new Error(`Insufficient funds. Only ${(balance / 1000).toLocaleString()} sats available.`)
            }

            if (isLNAddress) {
                if (!amountSats) throw new Error('Please enter an amount')
                const amountMsat = Number.parseInt(amountSats) * 1000
                setResolving(true)
                const metadata = await walletManager.resolveLightningAddress(finalInvoice)
                finalInvoice = await walletManager.getInvoiceFromLNURL(metadata.callback, amountMsat)
                finalAmountMsat = amountMsat
                setResolving(false)
            }

            await walletManager.payInvoice(finalInvoice, finalAmountMsat, selectedWalletId || undefined)
            Alert.alert('Success', 'Payment sent!')
            onPaymentSuccess()
            reset()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment failed')
        } finally {
            setLoading(false); setResolving(false)
        }
    }

    const handleScan = (data: string) => { setInvoice(data); setScannerVisible(false) }
    const reset = () => { setInvoice(''); setAmountSats(''); setError(''); onDismiss() }

    if (scannerVisible) return <QRScanner onScan={handleScan} onClose={() => setScannerVisible(false)} />

    return (
        <Portal>
            <Modal visible={visible} onDismiss={reset} contentContainerStyle={styles.container}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.content}>
                            <View style={styles.header}>
                                <Text style={styles.title}>Send</Text>
                                <View style={styles.headerActions}>
                                    <Pressable onPress={() => setScannerVisible(true)} hitSlop={8}>
                                        <Scan size={18} color={Colors.accent} />
                                    </Pressable>
                                    <Pressable onPress={reset} hitSlop={8}>
                                        <X size={18} color={Colors.textSecondary} />
                                    </Pressable>
                                </View>
                            </View>

                            <TextInput
                                label="LN Invoice or Address"
                                value={invoice}
                                onChangeText={setInvoice}
                                mode="outlined"
                                multiline={!isLNAddress}
                                numberOfLines={isLNAddress ? 1 : 3}
                                style={styles.input}
                                placeholder="lnbc... or user@domain.com"
                                outlineColor={Colors.surfaceBorder}
                                activeOutlineColor={Colors.accent}
                                error={!!error}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />

                            {balance !== null && (
                                <Text style={styles.balanceHint}>Available: {(balance / 1000).toLocaleString()} sats</Text>
                            )}

                            {isLNAddress && (
                                <TextInput
                                    label="Amount (sats)"
                                    value={amountSats}
                                    onChangeText={setAmountSats}
                                    mode="outlined"
                                    keyboardType="numeric"
                                    style={styles.input}
                                    outlineColor={Colors.surfaceBorder}
                                    activeOutlineColor={Colors.accent}
                                    placeholder="1000"
                                />
                            )}

                            {resolving && (
                                <View style={styles.statusRow}>
                                    <ActivityIndicator size="small" color={Colors.accent} />
                                    <Text style={styles.statusText}>Resolving address...</Text>
                                </View>
                            )}

                            {error ? <Text style={styles.errorText}>{error}</Text> : null}

                            <Pressable
                                style={[styles.payButton, (!invoice || loading || resolving) && { opacity: 0.5 }]}
                                onPress={handlePay}
                                disabled={!invoice || loading || resolving}
                            >
                                <Text style={styles.payText}>
                                    {loading ? 'Paying...' : isLNAddress ? 'Pay Address' : 'Pay Invoice'}
                                </Text>
                            </Pressable>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>
        </Portal>
    )
}

const styles = StyleSheet.create({
    container: { margin: Spacing.lg },
    content: {
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
        marginBottom: Spacing.md,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    title: {
        color: Colors.text,
        fontSize: 18,
        fontWeight: '600',
    },
    input: {
        marginBottom: Spacing.sm,
        backgroundColor: Colors.surfaceElevated,
    },
    balanceHint: {
        color: Colors.textSecondary,
        fontSize: 12,
        marginBottom: Spacing.sm,
        textAlign: 'right',
    },
    errorText: {
        color: Colors.danger,
        fontSize: 13,
        marginBottom: Spacing.md,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
        gap: Spacing.sm,
    },
    statusText: {
        color: Colors.accent,
        fontSize: 13,
    },
    payButton: {
        backgroundColor: Colors.accent,
        borderRadius: Radius.md,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    payText: {
        color: Colors.accentText,
        fontSize: 16,
        fontWeight: '600',
    },
})
