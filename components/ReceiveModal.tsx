import React, { useState } from 'react'
import { View, StyleSheet, Share, Pressable } from 'react-native'
import { Modal, Portal, Text, TextInput, Button, ActivityIndicator } from 'react-native-paper'
import QRCode from 'react-native-qrcode-svg'
import { walletManager } from '../services/WalletManager'
import { Copy, Share2, X } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { Colors, Spacing, Radius } from '../theme'

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

    const handleCopy = async () => { if (invoice) await Clipboard.setStringAsync(invoice) }
    const handleShare = async () => { if (invoice) await Share.share({ message: invoice, title: 'Lightning Invoice' }) }
    const reset = () => { setAmount(''); setDescription(''); setInvoice(null); onDismiss() }

    return (
        <Portal>
            <Modal visible={visible} onDismiss={reset} contentContainerStyle={styles.container}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Receive</Text>
                        <Pressable onPress={reset} hitSlop={8}>
                            <X size={18} color={Colors.textSecondary} />
                        </Pressable>
                    </View>

                    {!invoice ? (
                        <>
                            <TextInput
                                label="Amount (sats)"
                                value={amount}
                                onChangeText={setAmount}
                                keyboardType="numeric"
                                mode="outlined"
                                style={styles.input}
                                outlineColor={Colors.surfaceBorder}
                                activeOutlineColor={Colors.accent}
                                placeholder="0"
                            />
                            <TextInput
                                label="Description (optional)"
                                value={description}
                                onChangeText={setDescription}
                                mode="outlined"
                                style={styles.input}
                                outlineColor={Colors.surfaceBorder}
                                activeOutlineColor={Colors.accent}
                                placeholder="What's this for?"
                            />
                            <Pressable
                                style={[styles.generateBtn, (!amount || loading) && { opacity: 0.5 }]}
                                onPress={handleGenerate}
                                disabled={!amount || loading}
                            >
                                <Text style={styles.generateText}>
                                    {loading ? 'Generating...' : 'Generate Invoice'}
                                </Text>
                            </Pressable>
                        </>
                    ) : (
                        <View style={styles.qrSection}>
                            <View style={styles.qrRing}>
                                <View style={styles.qrWrapper}>
                                    <QRCode value={invoice} size={200} color="black" backgroundColor="white" />
                                </View>
                            </View>

                            <Text style={styles.invoiceText} numberOfLines={1} ellipsizeMode="middle">
                                {invoice}
                            </Text>

                            <View style={styles.actionRow}>
                                <Pressable style={styles.actionBtn} onPress={handleCopy}>
                                    <Copy size={16} color={Colors.accent} />
                                    <Text style={styles.actionText}>Copy</Text>
                                </Pressable>
                                <Pressable style={styles.actionBtn} onPress={handleShare}>
                                    <Share2 size={16} color={Colors.accent} />
                                    <Text style={styles.actionText}>Share</Text>
                                </Pressable>
                            </View>

                            <Pressable onPress={() => setInvoice(null)}>
                                <Text style={styles.newInvoiceText}>Create New Invoice</Text>
                            </Pressable>
                        </View>
                    )}
                </View>
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
        marginBottom: Spacing.lg,
    },
    title: {
        color: Colors.text,
        fontSize: 18,
        fontWeight: '600',
    },
    input: {
        marginBottom: Spacing.md,
        backgroundColor: Colors.surfaceElevated,
    },
    generateBtn: {
        backgroundColor: Colors.accent,
        borderRadius: Radius.md,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    generateText: {
        color: Colors.accentText,
        fontSize: 16,
        fontWeight: '600',
    },
    qrSection: {
        alignItems: 'center',
    },
    qrRing: {
        padding: 3,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: Colors.accent,
        marginBottom: Spacing.lg,
    },
    qrWrapper: {
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
    },
    invoiceText: {
        color: Colors.textTertiary,
        marginBottom: Spacing.lg,
        width: '100%',
        textAlign: 'center',
        fontSize: 12,
    },
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
        paddingVertical: 12,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    actionText: {
        color: Colors.accent,
        fontWeight: '500',
        fontSize: 14,
    },
    newInvoiceText: {
        color: Colors.textSecondary,
        fontSize: 13,
        marginTop: Spacing.sm,
    },
})
