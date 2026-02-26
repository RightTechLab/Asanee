import React, { useState } from 'react'
import { View, StyleSheet, Share, Pressable, Platform, Modal, ScrollView, KeyboardAvoidingView } from 'react-native'
import { Text, TextInput, ActivityIndicator } from 'react-native-paper'
import QRCode from 'react-native-qrcode-svg'
import { Copy, Share2, ArrowDownLeft, CheckCircle, RotateCcw, X } from 'lucide-react-native'
import { walletManager } from '../services/WalletManager'
import { useBtcPrice } from '../hooks/useBtcPrice'
import { satsToThb, formatThb } from '../services/PriceService'
import * as Clipboard from 'expo-clipboard'
import { Colors, Spacing, Radius } from '../theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ReceiveModalProps {
    visible: boolean
    onDismiss: () => void
    walletName: string
    walletId?: string
}

export default function ReceiveModal({ visible, onDismiss, walletName, walletId }: ReceiveModalProps) {
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')
    const [invoice, setInvoice] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)
    const btcPrice = useBtcPrice()
    const insets = useSafeAreaInsets()

    const handleGenerate = async () => {
        if (!amount) return
        setLoading(true)
        try {
            const amountMsat = Number.parseInt(amount) * 1000
            const response = await walletManager.makeInvoice(amountMsat, description || `Funding ${walletName}`, walletId)
            setInvoice(response.invoice)
        } catch (error) {
            // silent
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = async () => {
        if (invoice) {
            await Clipboard.setStringAsync(invoice)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleShare = async () => {
        if (invoice) await Share.share({ message: invoice, title: 'Lightning Invoice' })
    }

    const reset = () => {
        setAmount(''); setDescription(''); setInvoice(null); setCopied(false); onDismiss()
    }

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
                            {/* Header */}
                            <View style={styles.header}>
                                <View style={styles.headerIcon}>
                                    <ArrowDownLeft size={20} color={Colors.accentText} />
                                </View>
                                <Text style={styles.title}>Receive</Text>
                                <Pressable onPress={reset} style={styles.closeBtn} hitSlop={8}>
                                    <X size={18} color={Colors.textSecondary} />
                                </Pressable>
                            </View>

                            {!invoice ? (
                                /* ═══ Form State ═══ */
                                <>
                                    {/* Large amount display */}
                                    <View style={styles.amountDisplay}>
                                        <Text style={styles.amountValue}>
                                            {amount || '0'}
                                        </Text>
                                        <Text style={styles.amountUnit}>sats</Text>
                                    </View>
                                    {amount && btcPrice && (
                                        <Text style={styles.fiatAmount}>
                                            ≈ {formatThb(satsToThb(Number.parseInt(amount), btcPrice))}
                                        </Text>
                                    )}

                                    <TextInput
                                        value={amount}
                                        onChangeText={setAmount}
                                        keyboardType="numeric"
                                        mode="outlined"
                                        style={styles.input}
                                        outlineColor={Colors.surfaceBorder}
                                        activeOutlineColor={Colors.accent}
                                        placeholder="Enter amount"
                                        dense
                                        right={<TextInput.Affix text="sats" textStyle={{ color: Colors.textSecondary }} />}
                                    />

                                    <TextInput
                                        value={description}
                                        onChangeText={setDescription}
                                        mode="outlined"
                                        style={styles.input}
                                        outlineColor={Colors.surfaceBorder}
                                        activeOutlineColor={Colors.accent}
                                        placeholder="What's this for? (optional)"
                                        dense
                                    />

                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.generateBtn,
                                            (!amount || loading) && { opacity: 0.4 },
                                            pressed && { opacity: 0.85 },
                                        ]}
                                        onPress={handleGenerate}
                                        disabled={!amount || loading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color={Colors.accentText} />
                                        ) : (
                                            <>
                                                <ArrowDownLeft size={18} color={Colors.accentText} />
                                                <Text style={styles.generateText}>Generate Invoice</Text>
                                            </>
                                        )}
                                    </Pressable>
                                </>
                            ) : (
                                /* ═══ QR State ═══ */
                                <View style={styles.qrSection}>
                                    {/* Amount pill */}
                                    <View style={styles.amountPill}>
                                        <Text style={styles.amountPillText}>
                                            {Number.parseInt(amount).toLocaleString()} sats
                                        </Text>
                                        {btcPrice && (
                                            <Text style={styles.amountPillFiat}>
                                                ≈ {formatThb(satsToThb(Number.parseInt(amount), btcPrice))}
                                            </Text>
                                        )}
                                    </View>

                                    {/* QR Code */}
                                    <View style={styles.qrOuter}>
                                        <View style={styles.qrInner}>
                                            <QRCode value={invoice} size={200} color="black" backgroundColor="white" />
                                        </View>
                                    </View>

                                    <Text style={styles.invoiceText} numberOfLines={1} ellipsizeMode="middle">
                                        {invoice}
                                    </Text>

                                    {/* Action buttons */}
                                    <View style={styles.actionRow}>
                                        <Pressable
                                            style={({ pressed }) => [styles.actionBtn, styles.copyBtn, pressed && { opacity: 0.8 }]}
                                            onPress={handleCopy}
                                        >
                                            {copied
                                                ? <CheckCircle size={16} color={Colors.success} />
                                                : <Copy size={16} color={Colors.accentText} />}
                                            <Text style={[styles.actionText, styles.copyText]}>
                                                {copied ? 'Copied!' : 'Copy'}
                                            </Text>
                                        </Pressable>
                                        <Pressable
                                            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.8 }]}
                                            onPress={handleShare}
                                        >
                                            <Share2 size={16} color={Colors.accent} />
                                            <Text style={styles.actionText}>Share</Text>
                                        </Pressable>
                                    </View>

                                    {/* New invoice */}
                                    <Pressable
                                        style={({ pressed }) => [styles.newInvoiceBtn, pressed && { opacity: 0.7 }]}
                                        onPress={() => { setInvoice(null); setCopied(false) }}
                                    >
                                        <RotateCcw size={14} color={Colors.textSecondary} />
                                        <Text style={styles.newInvoiceText}>New Invoice</Text>
                                    </Pressable>
                                </View>
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
        backgroundColor: Colors.success,
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

    // Amount display
    amountDisplay: {
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    amountValue: {
        color: Colors.text,
        fontSize: 48,
        fontWeight: '200',
    },
    amountUnit: {
        color: Colors.accent,
        fontSize: 16,
        fontWeight: '500',
        marginTop: Spacing.xs,
    },
    fiatAmount: {
        color: Colors.textSecondary,
        fontSize: 16,
        textAlign: 'center',
        marginTop: -Spacing.xs,
    },

    // Form
    input: {
        marginBottom: Spacing.md,
        backgroundColor: Colors.surfaceElevated,
    },
    generateBtn: {
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
    generateText: {
        color: Colors.accentText,
        fontSize: 16,
        fontWeight: '600',
    },

    // QR
    qrSection: {
        alignItems: 'center',
    },
    amountPill: {
        backgroundColor: Colors.accentDim,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: Radius.full,
        marginBottom: Spacing.lg,
    },
    amountPillText: {
        color: Colors.accent,
        fontSize: 14,
        fontWeight: '600',
    },
    amountPillFiat: {
        color: Colors.textSecondary,
        fontSize: 12,
        marginLeft: Spacing.xs,
    },
    qrOuter: {
        padding: 4,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: Colors.accent,
        marginBottom: Spacing.md,
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 4,
    },
    qrInner: {
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
    },
    invoiceText: {
        color: Colors.textTertiary,
        marginBottom: Spacing.lg,
        width: '100%',
        textAlign: 'center',
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },

    // Actions
    actionRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
        width: '100%',
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: 14,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    copyBtn: {
        backgroundColor: Colors.accent,
        borderColor: Colors.accent,
    },
    actionText: {
        color: Colors.accent,
        fontWeight: '600',
        fontSize: 14,
    },
    copyText: {
        color: Colors.accentText,
    },

    // New invoice
    newInvoiceBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: Spacing.sm,
        marginBottom: Spacing.md,
    },
    newInvoiceText: {
        color: Colors.textSecondary,
        fontSize: 13,
    },
})
