import React, { useState, useEffect } from 'react'
import { View, StyleSheet, Platform, Pressable, Alert, Modal, ScrollView, KeyboardAvoidingView } from 'react-native'
import { Text, TextInput, ActivityIndicator } from 'react-native-paper'
import { walletManager } from '../services/WalletManager'
import { useWalletStore } from '../store/walletStore'
import { useBtcPrice } from '../hooks/useBtcPrice'
import { satsToThb, formatThb } from '../services/PriceService'
import QRScanner from './QRScanner'
import { Scan, X, ArrowUpRight, Zap, CheckCircle } from 'lucide-react-native'
import { Colors, Spacing, Radius } from '../theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface SendModalProps {
    visible: boolean
    onDismiss: () => void
    initialInvoice?: string
    onPaymentSuccess: () => void
    walletId?: string
}

export default function SendModal({ visible, onDismiss, initialInvoice = '', onPaymentSuccess, walletId }: SendModalProps) {
    const [invoice, setInvoice] = useState(initialInvoice)
    const [amountSats, setAmountSats] = useState('')
    const [balance, setBalance] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [resolving, setResolving] = useState(false)
    const [error, setError] = useState('')
    const [isLNAddress, setIsLNAddress] = useState(false)
    const [scannerVisible, setScannerVisible] = useState(false)
    const [success, setSuccess] = useState(false)
    const insets = useSafeAreaInsets()
    const btcPrice = useBtcPrice()

    // Determine which wallet to pay from
    const effectiveWalletId = walletId || useWalletStore.getState().selectedWalletId || undefined

    useEffect(() => { if (initialInvoice) setInvoice(initialInvoice) }, [initialInvoice])

    useEffect(() => {
        if (visible && effectiveWalletId) {
            walletManager.getWalletBalance(effectiveWalletId).then(setBalance)
        }
        if (visible) { setSuccess(false); setError('') }
    }, [visible])

    useEffect(() => {
        const lower = invoice.toLowerCase().trim()
        setIsLNAddress(lower.includes('@') && !lower.startsWith('lnbc') && !lower.startsWith('lightning:'))
    }, [invoice])

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

            await walletManager.payInvoice(finalInvoice, finalAmountMsat, effectiveWalletId)
            setSuccess(true)
            onPaymentSuccess()
            setTimeout(() => reset(), 2000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment failed')
        } finally {
            setLoading(false); setResolving(false)
        }
    }

    const handleScan = (data: string) => { setInvoice(data); setScannerVisible(false) }
    const reset = () => { setInvoice(''); setAmountSats(''); setError(''); setSuccess(false); onDismiss() }

    if (scannerVisible) return <QRScanner onScan={handleScan} onClose={() => setScannerVisible(false)} />

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={reset}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <Pressable style={styles.dismissArea} onPress={reset} />
                    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                        <View style={styles.handle} />
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                        >
                            {success ? (
                                /* ═══ Success State ═══ */
                                <View style={styles.successSection}>
                                    <View style={styles.successCircle}>
                                        <CheckCircle size={48} color={Colors.accent} />
                                    </View>
                                    <Text style={styles.successTitle}>Payment Sent!</Text>
                                    <Text style={styles.successSub}>
                                        {isLNAddress ? invoice : 'Invoice paid successfully'}
                                    </Text>
                                </View>
                            ) : (
                                /* ═══ Form State ═══ */
                                <>
                                    {/* Header */}
                                    <View style={styles.header}>
                                        <View style={styles.headerIcon}>
                                            <ArrowUpRight size={20} color={Colors.accentText} />
                                        </View>
                                        <Text style={styles.title}>Send</Text>
                                        <Pressable onPress={reset} style={styles.closeBtn} hitSlop={8}>
                                            <X size={18} color={Colors.textSecondary} />
                                        </Pressable>
                                    </View>

                                    {/* Balance pill */}
                                    {balance !== null && (
                                        <View style={styles.balancePill}>
                                            <Zap size={12} color={Colors.accent} />
                                            <Text style={styles.balanceText}>
                                                {(balance / 1000).toLocaleString()} sats available
                                            </Text>
                                        </View>
                                    )}

                                    {/* Invoice/Address input */}
                                    <Text style={styles.fieldLabel}>TO</Text>
                                    <View style={styles.inputRow}>
                                        <TextInput
                                            value={invoice}
                                            onChangeText={setInvoice}
                                            mode="outlined"
                                            multiline={!isLNAddress}
                                            numberOfLines={isLNAddress ? 1 : 2}
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="lnbc... or user@domain.com"
                                            outlineColor={Colors.surfaceBorder}
                                            activeOutlineColor={Colors.accent}
                                            error={!!error}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            dense
                                        />
                                        <Pressable
                                            style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.7 }]}
                                            onPress={() => setScannerVisible(true)}
                                        >
                                            <Scan size={20} color={Colors.accent} />
                                        </Pressable>
                                    </View>

                                    {/* Amount (for LN address) */}
                                    {isLNAddress && (
                                        <>
                                            <Text style={styles.fieldLabel}>AMOUNT</Text>
                                            <TextInput
                                                value={amountSats}
                                                onChangeText={setAmountSats}
                                                mode="outlined"
                                                keyboardType="numeric"
                                                style={styles.input}
                                                outlineColor={Colors.surfaceBorder}
                                                activeOutlineColor={Colors.accent}
                                                placeholder="0"
                                                dense
                                                right={<TextInput.Affix text="sats" textStyle={{ color: Colors.textSecondary }} />}
                                            />
                                            {amountSats && btcPrice && (
                                                <Text style={styles.fiatAmount}>
                                                    ≈ {formatThb(satsToThb(Number.parseInt(amountSats), btcPrice))}
                                                </Text>
                                            )}
                                        </>
                                    )}

                                    {/* Status */}
                                    {resolving && (
                                        <View style={styles.statusRow}>
                                            <ActivityIndicator size="small" color={Colors.accent} />
                                            <Text style={styles.statusText}>Resolving address...</Text>
                                        </View>
                                    )}

                                    {error ? (
                                        <View style={styles.errorContainer}>
                                            <Text style={styles.errorText}>{error}</Text>
                                        </View>
                                    ) : null}

                                    {/* Pay button */}
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.payButton,
                                            (!invoice || loading || resolving) && { opacity: 0.4 },
                                            pressed && { opacity: 0.85 },
                                        ]}
                                        onPress={handlePay}
                                        disabled={!invoice || loading || resolving}
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color={Colors.accentText} />
                                        ) : (
                                            <>
                                                <ArrowUpRight size={18} color={Colors.accentText} />
                                                <Text style={styles.payText}>
                                                    {isLNAddress ? 'Pay Address' : 'Pay Invoice'}
                                                </Text>
                                            </>
                                        )}
                                    </Pressable>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    dismissArea: {
        flex: 1,
    },
    sheet: {
        backgroundColor: Colors.surfaceElevated,
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        maxHeight: '85%',
        borderTopWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.textTertiary,
        alignSelf: 'center',
        marginBottom: Spacing.lg,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    headerIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: Colors.text,
        fontSize: 20,
        fontWeight: '600',
        flex: 1,
        marginLeft: Spacing.sm,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Balance pill
    balancePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Colors.accentDim,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: Radius.full,
        alignSelf: 'flex-start',
        marginBottom: Spacing.lg,
    },
    balanceText: {
        color: Colors.accent,
        fontSize: 12,
        fontWeight: '500',
    },

    // Fields
    fieldLabel: {
        color: Colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1.5,
        marginBottom: Spacing.xs,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    input: {
        marginBottom: Spacing.md,
        backgroundColor: Colors.surfaceElevated,
    },
    scanBtn: {
        width: 48,
        height: 48,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    fiatAmount: {
        color: Colors.textSecondary,
        fontSize: 14,
        marginTop: Spacing.xs,
        marginLeft: Spacing.xs,
    },

    // Status
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    statusText: {
        color: Colors.accent,
        fontSize: 13,
    },
    errorContainer: {
        backgroundColor: 'rgba(239,68,68,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: Radius.sm,
        marginBottom: Spacing.md,
    },
    errorText: {
        color: Colors.danger,
        fontSize: 13,
    },

    // Pay button
    payButton: {
        backgroundColor: Colors.accent,
        borderRadius: Radius.md,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
        marginBottom: Spacing.md,
    },
    payText: {
        color: Colors.accentText,
        fontSize: 16,
        fontWeight: '600',
    },

    // Success
    successSection: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    successCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.accentDim,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    successTitle: {
        color: Colors.text,
        fontSize: 22,
        fontWeight: '600',
        marginBottom: Spacing.sm,
    },
    successSub: {
        color: Colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
    },
})
